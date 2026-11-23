import AppKit

/// One image position of the picked draft (0138): position = role = file name. `scanned` = its files are on disk.
struct Slot: Identifiable, Equatable {
    let id = UUID()          // follows the scan when rows are reordered
    var scanned: Bool
    var thumb: CGImage?
    static func == (a: Slot, b: Slot) -> Bool { a.id == b.id && a.scanned == b.scanned && a.thumb === b.thumb }
}

/// Sign-in state, draft search, the picked draft and its image slots.
final class DraftSession: ObservableObject {
    enum SignIn {
        case signedOut, codeSent(String), signedIn
        var isSignedIn: Bool { if case .signedIn = self { return true }; return false }
    }
    @Published var signIn: SignIn = Backend.shared.signedIn ? .signedIn : .signedOut
    @Published var busy = false
    @Published var error: String?

    @Published var query = "" { didSet { scheduleSearch() } }
    @Published var results: [DraftSummary] = []
    @Published var draft: DraftSummary?
    /// names of positions 1…N, from scan-targets (the app never builds a name)
    @Published var names: [ImageTarget] = []
    /// clip slots and tag data of the open draft (0141)
    @Published var clips: [ClipTarget] = []
    @Published var tags: DraftTags?
    /// slots per draft id once opened, for the media status of the rows (images, clips)
    @Published var slotCounts: [String: (images: Int, clips: Int)] = [:]
    /// what each opened draft needs for the automatic export (0144): kept after switching draft
    struct Cached { let draft: DraftSummary; let names: [ImageTarget]; let clips: [ClipTarget]; let tags: DraftTags? }
    var cache: [String: Cached] = [:]
    /// what is at each position (same count as names)
    @Published var slots: [Slot] = []
    @Published var target: Int?          // the first empty position: the next Scan fills it (rows are not selectable)
    /// Lightbox (Figma 2441:24959): index of the scan shown large, nil = closed
    @Published var lightbox: Int?

    weak var app: AppModel?

    // MARK: New draft from Discogs (0145): pick a release, the backend makes the draft (as Memo → Create draft)

    @Published var newDraftOpen = false
    @Published var discogsQuery = "" { didSet { scheduleDiscogs() } }
    @Published var discogsResults: [DiscogsResult] = []
    @Published var discogsSearching = false
    @Published var creating: String?                       // release title while scanner-draft runs
    @Published var duplicate: (release: DiscogsResult, existing: [(id: String, sku: String, status: String)])?
    private var discogsTask: Task<Void, Never>?

    func openNewDraft() { newDraftOpen = true; discogsQuery = ""; discogsResults = []; duplicate = nil; creating = nil; error = nil }
    func closeNewDraft() { newDraftOpen = false; discogsTask?.cancel(); duplicate = nil; creating = nil }

    private func scheduleDiscogs() {
        discogsTask?.cancel()
        let q = discogsQuery.trimmingCharacters(in: .whitespaces)
        guard q.count >= 3 else { discogsResults = []; discogsSearching = false; return }
        discogsTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            self.discogsSearching = true
            let found = (try? await Backend.shared.discogsSearch(q)) ?? []
            guard !Task.isCancelled, self.discogsQuery.trimmingCharacters(in: .whitespaces) == q else { return }
            self.discogsResults = found; self.discogsSearching = false
        }
    }

    func create(from r: DiscogsResult, force: Bool = false) {
        creating = r.title; duplicate = nil; error = nil
        Task { @MainActor in
            do {
                switch try await Backend.shared.createDraft(releaseId: r.id, force: force) {
                case .created(let id, let sku):
                    self.creating = nil; self.closeNewDraft()
                    self.query = ""
                    await self.openDraft(id: id, sku: sku)
                case .existing(let list):
                    self.creating = nil; self.duplicate = (r, list)
                }
            } catch {
                self.creating = nil; self.error = error.localizedDescription
            }
        }
    }

    /// Select a draft by id: refresh the list, then pick it (its SKU is a sure search hit)
    @MainActor func openDraft(id: String, sku: String) async {
        closeNewDraft()
        let latest = (try? await Backend.shared.drafts(matching: "")) ?? []
        let bySKU = (try? await Backend.shared.drafts(matching: sku)) ?? []
        results = latest
        if let d = (latest + bySKU).first(where: { $0.id == id }) {
            if !results.contains(where: { $0.id == id }) { results.insert(d, at: 0) }
            pick(d)
        } else {
            app?.caption = "SKU \(sku) is not a draft (it may be published): open it in the admin"
        }
    }
    private var searchTask: Task<Void, Never>?

    // MARK: Sign in

    func sendCode(_ email: String) {
        run { try await Backend.shared.sendCode(to: email.trimmingCharacters(in: .whitespaces)); return { self.signIn = .codeSent(email) } }
    }
    func verify(_ code: String) {
        guard case .codeSent(let email) = signIn else { return }
        run {
            try await Backend.shared.verify(email: email, code: code.trimmingCharacters(in: .whitespaces))
            return { self.signIn = .signedIn; self.search() }
        }
    }
    func signOut() {
        Backend.shared.signOut()
        signIn = .signedOut; draft = nil; names = []; slots = []; results = []; target = nil
    }

    // MARK: Search and pick

    private func scheduleSearch() {
        searchTask?.cancel()
        searchTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 300_000_000)
            if !Task.isCancelled { self.search() }
        }
    }

    func search() {
        let q = query
        run { let found = try await Backend.shared.drafts(matching: q); return { if self.query == q { self.results = found } } }
    }

    /// Picking a draft rebuilds the list from that draft only (bug 2026-11-22: the previous draft's scans stayed in the
    /// list under the new SKU's names). Nothing carries over: positions, thumbnails, target, undo, lightbox.
    func pick(_ d: DraftSummary) {
        guard d.id != draft?.id else { return }
        // a scan in progress belongs to the draft it was started for: switch only when it is saved
        if app?.scanner.busy == true { app?.caption = "Wait for the scan to finish, then pick the other draft"; return }
        loadToken = UUID()
        draft = d; names = []; slots = []; clips = []; tags = nil; target = nil; lastRemoval = nil; lightbox = nil
        app?.syncFileName()
        let onDisk = scannedRoles(sku: d.skuText)
        load(roles: max(3, onDisk.max() ?? 0))
    }

    func changeDraft() { loadToken = UUID(); draft = nil; names = []; slots = []; clips = []; tags = nil; target = nil; lastRemoval = nil; lightbox = nil; search() }

    /// A load started for one draft never applies to another one picked meanwhile
    private var loadToken = UUID()

    func addImage() { load(roles: names.count + 1) }

    /// Fetch the names of positions 1…roles and read which ones already have files on disk
    private func load(roles: Int) {
        guard let d = draft else { return }
        let token = loadToken
        run {
            let detail = try await Backend.shared.detail(of: d.id, roles: roles)
            let list = detail.images
            return {
                guard token == self.loadToken, self.draft?.id == d.id else { return }   // another draft was picked
                self.names = list
                self.clips = detail.clips; self.tags = detail.tags
                self.slotCounts[d.id] = (list.count, detail.clips.count)
                self.cache[d.id] = Cached(draft: d, names: list, clips: detail.clips, tags: detail.tags)
                self.app?.scheduleSync(d.id)   // tags may have changed on the server: rewrite what is out of date
                var s = self.slots
                while s.count < list.count { s.append(Slot(scanned: false, thumb: nil)) }
                if s.count > list.count { s = Array(s.prefix(list.count)) }
                for (i, n) in list.enumerated() where !s[i].scanned {
                    if let f = self.file(named: n.name, in: self.app?.folder) { s[i].scanned = true; s[i].thumb = Self.thumbnail(f) }
                }
                self.slots = s
                self.target = s.firstIndex { !$0.scanned }
                self.app?.syncFileName()
            }
        }
    }

    /// Roles of this SKU that already have a label file in the labels folder ("<sku>_<n>_…")
    func scannedRoles(sku: String) -> [Int] {
        guard let items = app?.disk.labels.keys else { return [] }   // the disk index, not a folder listing per redraw
        return items.compactMap { f -> Int? in
            let p = f.split(separator: "_")
            return p.count >= 2 && p[0] == sku ? Int(p[1]) : nil
        }
    }
    func scannedCount(_ d: DraftSummary) -> Int { Set(scannedRoles(sku: d.skuText)).count }

    // MARK: Scan, reorder, delete

    var targetName: String? { target.flatMap { $0 < names.count ? names[$0].name : nil } }

    func saved(_ thumb: CGImage) {
        guard let t = target, t < slots.count else { return }
        slots[t].scanned = true; slots[t].thumb = thumb
        target = slots.firstIndex { !$0.scanned }
        if target == nil { addImage() }   // all filled: the next Scan gets a new row (4, 5…), no Add image button
        app?.syncFileName()
    }

    /// Drag-and-drop or ⌥↑/⌥↓: the scans move, the names stay with the positions, files are renamed at once
    func move(from source: IndexSet, to destination: Int) {
        guard source.allSatisfy({ slots[$0].scanned }) else { return }   // only scanned images move
        lastRemoval = nil
        var s = slots
        s.move(fromOffsets: source, toOffset: destination)
        renameFiles(from: slots, to: s)
        let targetID = target.map { slots[$0].id }
        slots = s
        target = targetID.flatMap { id in s.firstIndex { $0.id == id } } ?? s.firstIndex { !$0.scanned }
        app?.syncFileName()
        app?.refreshDisk()
        app?.caption = "Order changed: files renamed"
    }

    func moveTarget(by delta: Int) {
        guard let t = target, t < slots.count, slots[t].scanned else { return }   // only scanned images move
        let to = t + delta
        guard to >= 0, to < slots.count else { return }
        move(from: IndexSet(integer: t), to: delta > 0 ? to + 1 : to)
    }

    /// Last removal, for Undo: (file in the Trash, where it was), plus the position and its thumbnail
    @Published var lastRemoval: (files: [(URL, URL)], index: Int, thumb: CGImage?)?

    /// Delete / context menu: both files of that position go to the Trash (Undo puts them back)
    func remove(at i: Int) {
        guard i < slots.count, i < names.count, slots[i].scanned, ofCurrentDraft(names[i].name) else { return }
        var moved: [(URL, URL)] = []
        for folder in folders {
            if let f = file(named: names[i].name, in: folder) {
                var trashed: NSURL?
                if (try? FileManager.default.trashItem(at: f, resultingItemURL: &trashed)) != nil, let t = trashed as URL? { moved.append((t, f)) }
            }
        }
        lastRemoval = (moved, i, slots[i].thumb)
        slots[i].scanned = false; slots[i].thumb = nil
        target = slots.firstIndex { !$0.scanned }
        app?.syncFileName()
        app?.refreshDisk()
        app?.caption = "Moved to the Trash: \(names[i].name)"
    }

    /// The label file of a scanned position, full size
    func image(at i: Int) -> CGImage? {
        guard i < names.count, let f = file(named: names[i].name, in: app?.folder),
              let src = CGImageSourceCreateWithURL(f as CFURL, nil) else { return nil }
        return CGImageSourceCreateThumbnailAtIndex(src, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true,
                                                            kCGImageSourceThumbnailMaxPixelSize: 2000] as CFDictionary)
    }
    /// ← → in the lightbox: the previous / next scanned position
    func stepLightbox(_ d: Int) {
        guard let i = lightbox else { return }
        var j = i + d
        while j >= 0 && j < slots.count && !slots[j].scanned { j += d }
        if j >= 0 && j < slots.count { lightbox = j }
    }

    func undoRemove() {
        guard let r = lastRemoval else { return }
        for (trashed, original) in r.files { try? FileManager.default.moveItem(at: trashed, to: original) }
        if r.index < slots.count { slots[r.index].scanned = true; slots[r.index].thumb = r.thumb }
        lastRemoval = nil
        target = slots.firstIndex { !$0.scanned }
        app?.syncFileName()
        app?.caption = "Scan restored"
    }

    private var folders: [URL] { [app?.folder, app?.originalsFolder].compactMap { $0 } }

    /// Guard: only names of the current draft's SKU are ever renamed or trashed
    private func ofCurrentDraft(_ name: String) -> Bool {
        guard let sku = draft?.skuText, !sku.isEmpty else { return false }
        return name.hasPrefix(sku + "_")
    }

    /// The file with this base name (any extension) in a folder
    func file(named base: String, in folder: URL?) -> URL? {
        guard let folder, let items = try? FileManager.default.contentsOfDirectory(atPath: folder.path) else { return nil }
        guard let f = items.first(where: { ($0 as NSString).deletingPathExtension == base }) else { return nil }
        return folder.appendingPathComponent(f)
    }

    /// Old order → new order: each scan's files take the name of their new position. Two passes through temporary
    /// names, so swapping 1 and 2 never overwrites a file.
    private func renameFiles(from old: [Slot], to new: [Slot]) {
        let fm = FileManager.default
        for folder in folders {
            var moved: [(URL, String)] = []   // temp file → new base name
            for (newIndex, slot) in new.enumerated() where slot.scanned {
                guard let oldIndex = old.firstIndex(where: { $0.id == slot.id }), oldIndex != newIndex,
                      ofCurrentDraft(names[oldIndex].name), ofCurrentDraft(names[newIndex].name),
                      let f = file(named: names[oldIndex].name, in: folder) else { continue }
                let tmp = folder.appendingPathComponent(".zanza-move-\(UUID().uuidString).\(f.pathExtension)")
                if (try? fm.moveItem(at: f, to: tmp)) != nil { moved.append((tmp, names[newIndex].name)) }
            }
            for (tmp, base) in moved {
                try? fm.moveItem(at: tmp, to: folder.appendingPathComponent(base).appendingPathExtension(tmp.pathExtension))
            }
        }
    }

    static func thumbnail(_ url: URL) -> CGImage? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        return CGImageSourceCreateThumbnailAtIndex(src, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true,
                                                            kCGImageSourceThumbnailMaxPixelSize: 160] as CFDictionary)
    }

    // MARK: Helpers

    /// Runs a backend call; the returned closure applies the result on the main thread
    private func run(_ work: @escaping () async throws -> (() -> Void)) {
        busy = true; error = nil
        Task {
            do {
                let apply = try await work()
                await MainActor.run { self.busy = false; apply() }
            } catch {
                await MainActor.run {
                    self.busy = false
                    self.error = error.localizedDescription
                    if case BackendError.signedOut = error { self.signIn = .signedOut }
                }
            }
        }
    }
}
