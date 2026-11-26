import AppKit

/// Background jobs for Export and Push to admin (decision 0143). Two lanes (decision 0193): exports run one at a time,
/// pushes run one at a time, and the two lanes run side by side, so a push never waits for an export (or the reverse).
/// A job snapshots what it works on when it starts, so picking another draft, scanning, renaming or importing never stops it.
final class JobQueue: ObservableObject {
    enum Kind { case export, push }
    enum State: Equatable { case waiting, running, done, failed(String) }
    typealias Progress = (_ fraction: Double, _ detail: String) -> Void
    typealias Work = (_ progress: @escaping Progress) async throws -> (text: String, folder: URL?)

    struct Job: Identifiable {
        let id = UUID()
        let draftID: String
        let sku: String
        let kind: Kind
        var state: State = .waiting
        var progress: Double = 0
        var detail = ""
        var result = ""
        var folder: URL?
        var seen = false          // the done row was selected again: its line goes away
        let work: Work
        /// session files the job reads: they are not trashed before it ends
        let files: Set<String>
    }

    @Published var jobs: [Job] = []
    /// the lanes with a job running now: at most one export and one push (0193)
    private var running: Set<Kind> = []
    /// called when the queue becomes idle (pending removals can go)
    var onIdle: (() -> Void)?

    var busy: Bool { jobs.contains { $0.state == .waiting || $0.state == .running } }
    var activeCount: Int { jobs.filter { $0.state == .waiting || $0.state == .running }.count }
    func uses(_ file: String) -> Bool { jobs.contains { ($0.state == .waiting || $0.state == .running) && $0.files.contains(file) } }

    /// The job a draft's row shows: one running for it (a push and an export can run together, 0193), else its latest
    func latest(for draftID: String) -> Job? {
        jobs.last { $0.draftID == draftID && $0.state == .running } ?? jobs.last { $0.draftID == draftID }
    }
    func isActive(_ draftID: String, _ kind: Kind) -> Bool {
        jobs.contains { $0.draftID == draftID && $0.kind == kind && ($0.state == .waiting || $0.state == .running) }
    }
    /// What the activity bar shows, one line per lane (0193, Figma "Scanner v3 - push in parallel with export"):
    /// each running job (export first, then push) and the last failure of an idle lane; with nothing running, the last job.
    var shown: [Job] {
        let lines: [Job] = [Kind.export, .push].compactMap { k in
            if let r = jobs.first(where: { $0.kind == k && $0.state == .running }) { return r }
            if let last = jobs.last(where: { $0.kind == k }), case .failed = last.state, !running.isEmpty { return last }
            return nil
        }
        if !lines.isEmpty { return lines }
        return jobs.last.map { [$0] } ?? []
    }
    var waitingCount: Int { jobs.filter { $0.state == .waiting }.count }
    func waitingCount(_ kind: Kind) -> Int { jobs.filter { $0.kind == kind && $0.state == .waiting }.count }

    func enqueue(draftID: String, sku: String, kind: Kind, files: Set<String> = [], work: @escaping Work) {
        jobs.append(Job(draftID: draftID, sku: sku, kind: kind, work: work, files: files))
        runNext()
    }

    func retry(_ id: UUID) {
        guard let i = jobs.firstIndex(where: { $0.id == id }) else { return }
        var j = jobs[i]; jobs.remove(at: i)
        j = Job(draftID: j.draftID, sku: j.sku, kind: j.kind, work: j.work, files: j.files)
        jobs.append(j); runNext()
    }

    func markSeen(_ draftID: String) {
        for i in jobs.indices where jobs[i].draftID == draftID && (jobs[i].state == .done || { if case .failed = jobs[i].state { return true }; return false }()) {
            jobs[i].seen = true
        }
    }

    /// Starts the first waiting job of every idle lane
    private func runNext() {
        for kind in [Kind.export, .push] where !running.contains(kind) {
            guard let i = jobs.firstIndex(where: { $0.kind == kind && $0.state == .waiting }) else { continue }
            start(i)
        }
        if running.isEmpty { onIdle?() }
    }

    private func start(_ i: Int) {
        running.insert(jobs[i].kind)
        jobs[i].state = .running
        let id = jobs[i].id, work = jobs[i].work
        Task {
            do {
                let r = try await work { fraction, detail in
                    DispatchQueue.main.async {
                        if let k = self.jobs.firstIndex(where: { $0.id == id }) { self.jobs[k].progress = fraction; self.jobs[k].detail = detail }
                    }
                }
                await MainActor.run { self.finish(id, .done, r.text, r.folder) }
            } catch {
                await MainActor.run { self.finish(id, .failed(error.localizedDescription), "", nil) }
            }
        }
    }

    private func finish(_ id: UUID, _ state: State, _ text: String, _ folder: URL?) {
        if let k = jobs.firstIndex(where: { $0.id == id }) {
            running.remove(jobs[k].kind)
            jobs[k].state = state; jobs[k].result = text; jobs[k].folder = folder; jobs[k].progress = 1
            let verb = jobs[k].kind == .export ? "Export" : "Push"
            NSAccessibility.post(element: NSApp as Any, notification: .announcementRequested,
                                 userInfo: [.announcement: state == .done ? "\(verb) done: SKU \(jobs[k].sku)" : "\(verb) failed: SKU \(jobs[k].sku)"])
        }
        runNext()
    }
}

/// Thrown by a push the user cancelled at the "Replace in the admin?" question: nothing changed
struct Cancelled: LocalizedError { var errorDescription: String? { "Cancelled: nothing changed in the admin" } }
