import AppKit
import Combine
import SwiftUI

/// The app's state: names to scan, settings, preview and the selection square.
final class AppModel: ObservableObject {
    let scanner = ScannerController()
    /// The admin link (0138): sign in, picked draft, image positions
    let drafts = DraftSession()
    /// The Samples tab (0141)
    let session = SessionModel()
    /// Price and conditions of the drafts (0196)
    let pricing = PricingModel()
    enum Tab { case scans, samples, price }
    @Published var tab: Tab = .scans { didSet { session.active = tab == .samples; if tab != .samples { session.stop() } } }
    /// Export and Push to admin run here, one at a time, in the background (0143)
    let jobs = JobQueue()
    /// Removal feedback with Undo (0149)
    let toasts = ToastCenter()
    /// What is on disk, read in the background when something changes (rows used to list folders on every redraw)
    struct DiskIndex { var labels: [String: String] = [:]; var exported: Set<String> = [] }
    @Published var disk = DiskIndex()
    func refreshDisk() {
        let labels = folder, wav = wavFolder, mp3 = mp3Folder
        DispatchQueue.global(qos: .utility).async {
            let fm = FileManager.default
            var idx = DiskIndex()
            for f in (try? fm.contentsOfDirectory(atPath: labels.path)) ?? [] where !f.hasPrefix(".") {
                let a = try? fm.attributesOfItem(atPath: labels.appendingPathComponent(f).path)
                idx.labels[f] = "\((a?[.size] as? Int) ?? 0):\(Int((a?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0))"
            }
            for dir in [wav, mp3] {
                for f in (try? fm.contentsOfDirectory(atPath: dir.path)) ?? [] where f.hasSuffix(".wav") || f.hasSuffix(".mp3") {
                    idx.exported.insert((f as NSString).deletingPathExtension)
                }
            }
            DispatchQueue.main.async { self.disk = idx }
        }
    }
    private var forward: [AnyCancellable] = []
    /// per draft id: the slot files last pushed to the admin (synced = the same now), 0142
    @Published var pushed: [String: [String]] = (UserDefaults.standard.dictionary(forKey: "pushed") as? [String: [String]]) ?? [:] {
        didSet { UserDefaults.standard.set(pushed, forKey: "pushed") }
    }
    @Published var wavFolder: URL = UserDefaults.standard.url(forKey: "wavFolder")
        ?? FileManager.default.urls(for: .musicDirectory, in: .userDomainMask)[0].appendingPathComponent("Zanza samples/WAV") {
        didSet { UserDefaults.standard.set(wavFolder, forKey: "wavFolder"); refreshDisk(); scheduleSync() }
    }
    @Published var mp3Folder: URL = UserDefaults.standard.url(forKey: "mp3Folder")
        ?? FileManager.default.urls(for: .musicDirectory, in: .userDomainMask)[0].appendingPathComponent("Zanza samples/MP3") {
        didSet { UserDefaults.standard.set(mp3Folder, forKey: "mp3Folder"); refreshDisk(); scheduleSync() }
    }
    /// Square videos of the clips with Video ticked (0177)
    @Published var videoFolder: URL = UserDefaults.standard.url(forKey: "videoFolder")
        ?? FileManager.default.urls(for: .moviesDirectory, in: .userDomainMask)[0].appendingPathComponent("Zanza videos") {
        didSet { UserDefaults.standard.set(videoFolder, forKey: "videoFolder"); scheduleSync() }
    }

    @Published var steps: [ScanStep] = []
    /// Saved scans, shown as thumbnails in the steps
    @Published var thumbs: [UUID: CGImage] = [:]
    @Published var currentID: UUID?
    @Published var fileName = ""
    @Published var caption = "Press Preview: a quick scan of the area of the record"

    @Published var preset: SizePreset = SizePreset(rawValue: UserDefaults.standard.string(forKey: "preset") ?? "") ?? .record7 {
        didSet { UserDefaults.standard.set(preset.rawValue, forKey: "preset"); resetSelectionIfNeeded() }
    }
    @Published var dpi: Int = UserDefaults.standard.object(forKey: "dpi") as? Int ?? 600 {
        didSet { UserDefaults.standard.set(dpi, forKey: "dpi") }
    }
    @Published var format: FileFormat = FileFormat(rawValue: UserDefaults.standard.string(forKey: "format") ?? "") ?? .jpeg {
        didSet { UserDefaults.standard.set(format.rawValue, forKey: "format") }
    }
    @Published var folder: URL = UserDefaults.standard.url(forKey: "folder")
        ?? FileManager.default.urls(for: .picturesDirectory, in: .userDomainMask)[0].appendingPathComponent("Zanza scans") {
        didSet { UserDefaults.standard.set(folder, forKey: "folder"); refreshDisk() }
    }
    /// Where the whole-record originals are archived
    @Published var originalsFolder: URL = UserDefaults.standard.url(forKey: "originalsFolder")
        ?? FileManager.default.urls(for: .picturesDirectory, in: .userDomainMask)[0].appendingPathComponent("Zanza scans/Originals") {
        didSet { UserDefaults.standard.set(originalsFolder, forKey: "originalsFolder") }
    }

    static func dpiSteps(supported: [Int]) -> [Int] {
        let main = [150, 300, 600, 1200, 2400].filter { supported.contains($0) }
        return main.isEmpty ? [150, 300, 600, 1200, 2400] : main
    }
    /// a saved setting not in the list snaps to the nearest step
    static func nearest(_ v: Int, in list: [Int]) -> Int { list.min { abs($0 - v) < abs($1 - v) } ?? v }

    /// angle before the last "Turn by itself", for ⌘Z
    @Published var angleBeforeTurn: CGFloat?
    @Published var turning = false
    /// Grid and "up" figure on the guide while the Turn slider is held
    @Published var turnAids = false
    /// set for one update: the preview animates to the new centre (Center)
    var animateCenter = false

    /// Last preview and the glass area it shows (mm, origin = corner of the glass)
    @Published var preview: CGImage?
    @Published var previewZone = CGRect(x: 0, y: 0, width: 216, height: 297)
    /// Selection square: centre in mm (glass coordinates) and clockwise angle in radians
    @Published var center = CGPoint(x: 108, y: 108)
    @Published var angle: CGFloat = 0

    private var lastClipboard = -1

    init() {
        drafts.app = self
        session.inJob = { [weak self] f in self?.jobs.uses(f) ?? false }
        jobs.onIdle = { [weak self] in self?.session.flushPendingRemovals(); self?.refreshDisk() }
        session.onChange = { [weak self] in self?.scheduleSync() }
        pricing.onTitleChanged = { [weak self] in self?.drafts.search() }
        // draft rows read jobs and session (progress, push state, counts): redraw them when those change
        refreshDisk()
        forward = [jobs.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() },
                   session.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() },
                   pricing.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() },
                   // the price chip of every listed draft (0196): read the terms of drafts not read yet
                   drafts.$results.sink { [weak self] list in self?.pricing.load(list.map(\.id)) }]
        previewZone = zone(for: preset)
        center = CGPoint(x: previewZone.midX, y: previewZone.midY)
    }

    var current: ScanStep? { steps.first { $0.id == currentID } }
    var sku: String? { steps.first?.sku }
    /// "gregory isaacs why did you leave", from label A's slug (the names only carry slugs)
    var recordTitle: String? {
        guard let s = (steps.first { $0.role == "1" } ?? steps.first)?.slug, !s.isEmpty else { return nil }
        return s.replacingOccurrences(of: "-", with: " ")
    }
    var sideMM: CGFloat? { preset.sideMM }

    func zone(for preset: SizePreset) -> CGRect {
        let g = scanner.glassMM
        return CGRect(x: 0, y: 0, width: min(preset.zoneMM.width, g.width), height: min(preset.zoneMM.height, g.height))
    }

    private func resetSelectionIfNeeded() {
        let z = zone(for: preset)
        if z != previewZone { previewZone = z; preview = nil; caption = "Press Preview: a quick scan of the area of the record" }
        if preset.sideMM == nil { angle = 0 }
        clampCenter()
    }

    /// The guide's centre stays on the glass
    func clampCenter() {
        center.x = min(max(center.x, previewZone.minX), previewZone.maxX)
        center.y = min(max(center.y, previewZone.minY), previewZone.maxY)
    }

    // MARK: Names

    /// Reads names from the clipboard. `onlyIfNew`: when the app comes to the front, take them only if they changed.
    @discardableResult
    func pasteNames(onlyIfNew: Bool = false) -> Bool {
        let pb = NSPasteboard.general
        if onlyIfNew && pb.changeCount == lastClipboard { return false }
        lastClipboard = pb.changeCount
        guard let text = pb.string(forType: .string) else { return false }
        let found = Names.parse(text)
        guard !found.isEmpty else {
            if !onlyIfNew { caption = "No file names on the clipboard: copy them in the admin (Edit listing → File names)" }
            return false
        }
        if onlyIfNew && found.map(\.name) == steps.map(\.name) { return false }
        if scanner.busy { return false }
        if let sku = found[0].sku, sku == steps.first?.sku {
            // same record: add the new roles (or the new name of a role), keep what is already scanned and ticked
            for f in found {
                if let i = steps.firstIndex(where: { $0.role == f.role }) { if !steps[i].done { steps[i].name = f.name } }
                else { steps.append(f) }
            }
            steps.sort { (Int($0.role) ?? 99) < (Int($1.role) ?? 99) }
            if let s = steps.first(where: { $0.role == found[0].role }) { select(s) }
        } else {
            steps = found
            select(found[0])
        }
        caption = found.count == 1 ? "1 name pasted" : "\(found.count) names pasted"
        return true
    }

    enum ExportKind { case mp3, wav, video }
    func chooseExportFolder(_ kind: ExportKind) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.canCreateDirectories = true
        panel.prompt = "Choose"
        panel.message = kind == .mp3 ? "Folder for the MP3 320" : kind == .wav ? "Folder for the WAV" : "Folder for the videos"
        panel.directoryURL = kind == .mp3 ? mp3Folder : kind == .wav ? wavFolder : videoFolder
        if panel.runModal() == .OK, let u = panel.url {
            switch kind { case .mp3: mp3Folder = u; case .wav: wavFolder = u; case .video: videoFolder = u }
        }
    }

    /// Clips of a draft for its row: assigned in the session or already exported (WAV of that SKU)
    func clipCount(_ d: DraftSummary) -> Int {
        let sku = d.skuText
        var names = Set(session.assignments.values.filter { $0.sku == sku }.map(\.name))
        for f in disk.exported where f.hasPrefix(sku + "_") {
            let parts = f.split(separator: "_")
            if parts.count > 1, Int(parts[1]) == nil { names.insert(f) }
        }
        return names.count
    }

    // MARK: Automatic export (0144): the exported files mirror each draft's clip assignments

    /// What was last written for a clip slot: the inputs' fingerprint, with/without WAV, complete = tags and cover
    struct ExportRecord: Codable { var hash: String; var wav: Bool; var complete: Bool; var missing: String?; var video: Bool? = false }
    @Published var exports: [String: ExportRecord] = {   // slot name → record
        (UserDefaults.standard.data(forKey: "exports").flatMap { try? JSONDecoder().decode([String: ExportRecord].self, from: $0) }) ?? [:]
    }() { didSet { UserDefaults.standard.set(try? JSONEncoder().encode(exports), forKey: "exports") } }
    private var dirty: Set<String> = []
    private var syncTimer: Timer?

    /// Debounced: rewrite what is out of date for a draft (the open one by default)
    func scheduleSync(_ draftID: String? = nil) {
        guard let id = draftID ?? drafts.draft?.id else { return }
        dirty.insert(id)
        syncTimer?.invalidate()
        syncTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: false) { [weak self] _ in
            guard let self else { return }
            for id in self.dirty where !self.jobs.isActive(id, .export) { self.dirty.remove(id); self.sync(id) }
        }
    }

    private struct Planned { let clip: SessionClip; let slot: ClipTarget; let tags: AudioExport.Tags; let cover: URL?; let wav: Bool; let video: Bool; let hash: String }

    func videoURL(_ name: String) -> URL { videoFolder.appendingPathComponent(name).appendingPathExtension("mp4") }

    /// Plans the writes of one draft: assigned clips whose inputs changed (or whose files are gone); WAVs and videos unticked go
    private func plan(_ id: String) -> (writes: [Planned], dropWAV: [String], dropVideo: [String])? {
        guard let c = drafts.cache[id] else { return nil }
        let sku = c.draft.skuText
        func labelFile(_ role: Int) -> URL? { c.names.first { $0.role == role }.flatMap { drafts.file(named: $0.name, in: folder) } }
        let labelA = labelFile(1), labelB = labelFile(2)
        var writes: [Planned] = [], dropWAV: [String] = [], dropVideo: [String] = []
        for slot in c.clips {
            guard let clip = session.clip(assignedTo: slot.name) else { continue }
            let wav = session.wantsWAV(slot: slot.name), video = session.wantsVideo(slot: slot.name)
            let side = slot.role.lowercased().first == "b" ? labelB : labelA
            var t = AudioExport.Tags()
            t.title = slot.title ?? ""; t.artist = slot.artist ?? ""
            t.album = c.tags?.album ?? c.draft.title; t.albumArtist = c.tags?.album_artist ?? ""
            t.label = c.tags?.label ?? ""; t.year = c.tags?.year.map(String.init) ?? ""
            t.genre = (c.tags?.genres ?? []).joined(separator: ", "); t.track = slot.label; t.comment = sku
            let coverStamp = side.map { "\($0.lastPathComponent):\(disk.labels[$0.lastPathComponent] ?? "")" } ?? "none"
            let hash = [clip.file, "\(clip.trimStart)", "\(clip.trimEnd)", t.title, t.artist, t.album, t.albumArtist, t.label,
                        t.year, t.genre, t.track, t.comment, coverStamp, wav ? "wav" : "", mp3Folder.path, wavFolder.path,
                        video ? "video:" + videoFolder.path : ""].joined(separator: "|")
            let mp3 = mp3Folder.appendingPathComponent(slot.name).appendingPathExtension("mp3")
            let old = exports[slot.name]
            let videoGone = video && side != nil && !FileManager.default.fileExists(atPath: videoURL(slot.name).path)
            if old?.hash != hash || !FileManager.default.fileExists(atPath: mp3.path) || videoGone {
                writes.append(Planned(clip: clip, slot: slot, tags: t, cover: side, wav: wav, video: video, hash: hash))
            }
            if !wav, old?.wav == true { dropWAV.append(slot.name) }
            if !video, old?.video == true { dropVideo.append(slot.name) }
        }
        return (writes, dropWAV, dropVideo)
    }

    func sync(_ id: String) {
        guard let p = plan(id), let c = drafts.cache[id] else { return }
        for name in p.dropWAV {   // WAV unticked: that WAV goes to the Trash, the toast offers Undo
            var t = Trashed()
            t.trash(wavFolder.appendingPathComponent(name).appendingPathExtension("wav"))
            let old = exports[name]
            exports[name]?.wav = false
            let label = c.clips.first { $0.name == name }?.label ?? name
            if !t.moves.isEmpty {
                toasts.show("\(label) WAV moved to Trash") { [weak self] in
                    guard let self else { return nil }
                    if let e = t.restore() { return e }
                    self.exports[name] = old          // same fingerprint: no rewrite
                    self.session.setWAV(true, slot: name)
                    self.refreshDisk()
                    return nil
                }
            }
        }
        for name in p.dropVideo {   // Video unticked: the video goes to the Trash, Undo ticks it again (0177)
            var t = Trashed()
            t.trash(videoURL(name))
            let old = exports[name]
            exports[name]?.video = false
            let label = c.clips.first { $0.name == name }?.label ?? name
            if !t.moves.isEmpty {
                toasts.show("\(label) video moved to Trash") { [weak self] in
                    guard let self else { return nil }
                    if let e = t.restore() { return e }
                    self.exports[name] = old
                    self.session.setVideo(true, slot: name)
                    return nil
                }
            }
        }
        guard !p.writes.isEmpty else { return }
        let writes = p.writes, wavDir = wavFolder, mp3Dir = mp3Folder, tagsKnown = c.tags != nil
        let videoOf = { [videoFolder] (name: String) in videoFolder.appendingPathComponent(name).appendingPathExtension("mp4") }
        jobs.enqueue(draftID: id, sku: c.draft.skuText, kind: .export, files: Set(writes.map(\.clip.file))) { progress in
            var done: [(String, ExportRecord)] = []
            for (n, w) in writes.enumerated() {
                progress(Double(n) / Double(writes.count), "clip \(n + 1) of \(writes.count)")
                var tags = w.tags
                tags.cover = AudioExport.cover(from: w.cover)
                try AudioExport.export(source: w.clip.url, trimStart: w.clip.trimStart, trimEnd: w.clip.trimEnd, name: w.slot.name, tags: tags,
                                       wavFolder: w.wav ? wavDir : nil, mp3Folder: mp3Dir)
                // the square video (0177): only with the label scan of that side, never a video without its label
                var madeVideo = false
                if w.video, let label = w.cover {
                    progress((Double(n) + 0.5) / Double(writes.count), "video \(w.slot.label)")
                    try VideoExport.write(source: w.clip.url, trimStart: w.clip.trimStart, trimEnd: w.clip.trimEnd, label: label, to: videoOf(w.slot.name))
                    madeVideo = true
                }
                let side = w.slot.role.lowercased().first == "b" ? "Label B" : "Label A"
                let missing = tags.cover == nil ? "\(w.slot.label) needs the \(side) scan" + (w.video ? " (MP3 cover and video)" : "")
                    : (!tagsKnown ? "\(w.slot.label): tags not loaded" : nil)
                done.append((w.slot.name, ExportRecord(hash: w.hash, wav: w.wav, complete: missing == nil, missing: missing, video: madeVideo)))
            }
            let finished = done
            await MainActor.run {
                for (k, r) in finished { self.exports[k] = r }
                self.refreshDisk()
                self.scheduleSync(id)   // anything changed while writing gets its turn
            }
            let noCover = done.compactMap { $0.1.missing }
            return ("Exported \(done.count) clip\(done.count == 1 ? "" : "s")" + (noCover.isEmpty ? "" : " · " + noCover.joined(separator: ", ")), mp3Dir)
        }
    }

    /// x on a clip slot: unassign, and its exported files go to the Trash; Undo puts both back (0149)
    func unassignClip(_ name: String) {
        var t = Trashed()
        let hadWAV = t.trash(wavFolder.appendingPathComponent(name).appendingPathExtension("wav"))
        t.trash(mp3Folder.appendingPathComponent(name).appendingPathExtension("mp3"))
        let hadVideo = t.trash(videoURL(name))
        let record = exports[name]
        let assignment = session.assignments.first { $0.value.name == name }
        exports[name] = nil
        session.unassign(slot: name)
        refreshDisk()
        let label = drafts.clips.first { $0.name == name }?.label ?? name
        let files = ["MP3", hadWAV ? "WAV" : nil, hadVideo ? "video" : nil].compactMap { $0 }
        let list = files.count > 1 ? files.dropLast().joined(separator: ", ") + " and " + files.last! : files[0]
        toasts.show("\(label) unassigned · \(list) moved to Trash") { [weak self] in
            guard let self else { return nil }
            if let e = t.restore() { return e }
            self.exports[name] = record
            if let a = assignment { self.session.assign(a.key, to: a.value) }
            self.refreshDisk()
            return nil
        }
    }

    // MARK: Media status (0144): none = red, partial = orange, some = green

    enum MediaState { case none, partial, complete }
    struct Media { let count: Int; let state: MediaState; let note: String }

    func imageMedia(_ d: DraftSummary) -> Media {
        let roles = Set(drafts.scannedRoles(sku: d.skuText))
        let missing = [roles.contains(1) ? nil : "Label A", roles.contains(2) ? nil : "Label B"].compactMap { $0 }
        if roles.isEmpty { return Media(count: 0, state: .none, note: "No scans yet") }
        return Media(count: roles.count, state: missing.isEmpty ? .complete : .partial,
                     note: missing.isEmpty ? "\(roles.count) scans, both labels" : "Missing: " + missing.joined(separator: ", "))
    }

    func clipMedia(_ d: DraftSummary) -> Media {
        let sku = d.skuText
        let assigned = Set(session.assignments.values.filter { $0.sku == sku }.map(\.name))
        let written = Set(exports.keys.filter { $0.hasPrefix(sku + "_") })
        let all = assigned.union(written)
        if all.isEmpty { return Media(count: 0, state: .none, note: "No clips yet") }
        var notes: [String] = []
        for n in all.sorted() {
            let role = n.split(separator: "_").dropFirst().first.map { $0.uppercased() } ?? n
            if let r = exports[n] { if let m = r.missing { notes.append(m) } }
            else { notes.append("\(role) not written yet") }
        }
        if jobs.isActive(d.id, .export) { notes.append("writing…") }
        return Media(count: all.count, state: notes.isEmpty ? .complete : .partial,
                     note: notes.isEmpty ? "\(all.count) clips complete" : notes.joined(separator: " · "))
    }

    // MARK: Push to admin (0142)

    /// What a draft would push now, as comparable strings: its scans (Labels folder, by SKU) and its assigned clips
    func pushItems(sku: String) -> [String] {
        var items: [String] = []
        for f in disk.labels.keys.sorted() where f.hasPrefix(sku + "_") {
            let p = f.split(separator: "_"); guard p.count > 1, Int(p[1]) != nil else { continue }
            items.append("img:\(f):\(disk.labels[f]!)")
        }
        for (file, a) in session.assignments.sorted(by: { $0.value.name < $1.value.name }) where a.sku == sku {
            let c = session.clips.first { $0.file == file }
            items.append("clip:\(a.name):\(file):\(c?.trimStart ?? 0):\(c?.trimEnd ?? 0)")
        }
        return items
    }

    enum PushState { case none, push, pushing, synced, failed(String) }
    func pushState(_ d: DraftSummary) -> PushState {
        if jobs.isActive(d.id, .push) { return .pushing }
        let now = pushItems(sku: d.skuText)
        if now.isEmpty { return .none }
        if let j = jobs.jobs.last(where: { $0.draftID == d.id && $0.kind == .push }), case .failed(let m) = j.state, pushed[d.id] != now { return .failed(m) }
        return pushed[d.id] == now ? .synced : .push
    }

    /// What one push sends: the draft's scanned images by role and its assigned clips by line (0142)
    struct PushPlan {
        let draft: DraftSummary
        let images: [(role: Int, url: URL)]
        let clips: [(line: Int, url: URL, trim: Double, trimEnd: Double, label: String)]
        let missingLines: Int
        let snapshot: [String]
        /// private copies of the scans (0193): renaming, rescanning or trashing a scan while the push runs never changes what it sends
        let copies: URL?
        var isEmpty: Bool { images.isEmpty && clips.isEmpty }
        var files: Set<String> { Set(clips.map { $0.url.lastPathComponent }) }
        /// the copies go once the push has ended (done, failed or cancelled)
        func discard() { if let copies { try? FileManager.default.removeItem(at: copies) } }
        /// false once a push used them: a Retry plans again from the scans as they are then
        var hasCopies: Bool { copies.map { FileManager.default.fileExists(atPath: $0.path) } ?? true }
    }

    /// Copies the scans a push sends into a folder of its own, at the moment the push is planned (0193). APFS makes the
    /// copy a clone, so it costs nothing; the session clips need no copy: a running job keeps them from the Trash (`uses`).
    private static func copyScans(_ images: [(role: Int, url: URL)]) throws -> (images: [(role: Int, url: URL)], folder: URL?) {
        guard !images.isEmpty else { return (images, nil) }
        let fm = FileManager.default
        let dir = fm.temporaryDirectory.appendingPathComponent("zanza-push-\(UUID().uuidString)", isDirectory: true)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        do {
            let copied = try images.map { img -> (role: Int, url: URL) in
                let to = dir.appendingPathComponent(img.url.lastPathComponent)
                try fm.copyItem(at: img.url, to: to)
                return (img.role, to)
            }
            return (copied, dir)
        } catch { try? fm.removeItem(at: dir); throw error }
    }

    /// The plan of a draft. The open draft uses what the app shows; any other draft reads its image names and clip
    /// lines from scan-targets, so it never has to be opened first (0165).
    @MainActor func pushPlan(_ d: DraftSummary) async throws -> PushPlan {
        let sku = d.skuText
        var names = drafts.names, slots = drafts.clips
        if drafts.draft?.id != d.id || names.isEmpty {
            let detail = try await Backend.shared.detail(of: d.id, roles: max(3, drafts.scannedRoles(sku: sku).max() ?? 0))
            names = detail.images; slots = detail.clips
        }
        let found: [(role: Int, url: URL)] = names.compactMap { n in drafts.file(named: n.name, in: folder).map { (n.role, $0) } }
        let clips: [(line: Int, url: URL, trim: Double, trimEnd: Double, label: String)] = slots.compactMap { slot in
            guard let line = slot.line, let c = session.clip(assignedTo: slot.name) else { return nil }
            // "Clip A1 · Artist - Title" for the confirm dialog, never a bare "A"
            let track = [slot.artist, slot.title].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " - ")
            return (line, c.url, c.trimStart, c.trimEnd, "Clip \(slot.label)" + (track.isEmpty ? "" : " · \(track)"))
        }
        let missingLines = slots.filter { $0.line == nil && session.clip(assignedTo: $0.name) != nil }.count
        // snapshot and copies in the same main-actor step: no rename or rescan can fall between them
        let snapshot = pushItems(sku: sku)
        let (images, copies) = try Self.copyScans(found)
        return PushPlan(draft: d, images: images, clips: clips, missingLines: missingLines, snapshot: snapshot, copies: copies)
    }

    /// What a push would replace in the admin, as readable names ("Label A", "Clip A1 · …")
    struct PushCheck { let replaced: [String]; let added: [String]; let has: (photos: [Int], clips: [Int]) }
    static func photoName(_ r: Int) -> String { r == 1 ? "Label A" : r == 2 ? "Label B" : "Other photo \(r)" }
    func check(_ plan: PushPlan) async throws -> PushCheck {
        let has = try await Backend.shared.adminHas(plan.draft.id)
        let replaced = plan.images.map(\.role).filter { has.photos.contains($0) }.map(Self.photoName)
            + plan.clips.filter { has.clips.contains($0.line) }.map(\.label)
        let added = plan.images.map(\.role).filter { !has.photos.contains($0) }.map(Self.photoName)
            + plan.clips.filter { !has.clips.contains($0.line) }.map(\.label)
        return PushCheck(replaced: replaced, added: added, has: has)
    }

    /// Upload and attach one plan. `fill` = keep what the admin has: those files are not even uploaded (0165).
    func send(_ plan: PushPlan, fill: Bool, has: (photos: [Int], clips: [Int]), progress: JobQueue.Progress) async throws -> String {
        defer { plan.discard() }
        let images = fill ? plan.images.filter { !has.photos.contains($0.role) } : plan.images
        let clips = fill ? plan.clips.filter { !has.clips.contains($0.line) } : plan.clips
        // Every image and clip is made and uploaded on its own task, a few at a time (0198): the clips' levelling
        // (web-level.js) and LAME run while the photos upload, instead of one file after the other.
        enum Item { case photo(role: Int, url: URL), clip(line: Int, url: URL, trim: Double, trimEnd: Double) }
        struct Done { let index: Int; let key: String }
        let items = images.map { Item.photo(role: $0.role, url: $0.url) }
            + clips.map { Item.clip(line: $0.line, url: $0.url, trim: $0.trim, trimEnd: $0.trimEnd) }
        let total = Double(max(1, items.count))
        func make(_ item: Item) async throws -> String {
            switch item {
            case let .photo(_, url):
                let img = try AudioExport.image(url)
                let key = try await Backend.shared.upload(try AudioExport.webp(from: img, long: 1600), kind: "photo", contentType: "image/webp")
                try await withThrowingTaskGroup(of: Void.self) { sizes in
                    for w in [200, 400, 800] {
                        sizes.addTask {
                            _ = try await Backend.shared.upload(try AudioExport.webp(from: img, width: w), kind: "photo", contentType: "image/webp", of: key, width: w)
                        }
                    }
                    try await sizes.waitForAll()
                }
                return key
            case let .clip(_, url, trim, trimEnd):
                let mp3 = try AudioExport.mp3(source: url, trimStart: trim, trimEnd: trimEnd, kbps: 128, web: true)
                return try await Backend.shared.upload(mp3, kind: "sample", contentType: "audio/mpeg")
            }
        }
        // 3 at a time: a long 96 kHz side needs a few hundred MB while it is levelled
        let width = min(3, max(1, ProcessInfo.processInfo.activeProcessorCount - 1))
        var keys = [String?](repeating: nil, count: items.count), finished = 0
        progress(0, "\(items.count) file\(items.count == 1 ? "" : "s")")
        try await withThrowingTaskGroup(of: Done.self) { group in
            var next = 0
            while next < min(width, items.count) {
                let i = next, item = items[i]; next += 1
                group.addTask { Done(index: i, key: try await make(item)) }
            }
            while let done = try await group.next() {
                keys[done.index] = done.key; finished += 1
                progress(Double(finished) / total, "\(finished) of \(items.count) file\(items.count == 1 ? "" : "s")")
                if next < items.count {
                    let i = next, item = items[i]; next += 1
                    group.addTask { Done(index: i, key: try await make(item)) }
                }
            }
        }
        // the admin gets them in the plan's order, whatever finished first
        var photoKeys: [(role: Int, key: String)] = [], clipKeys: [(line: Int, key: String)] = []
        for (item, key) in zip(items, keys) {
            guard let key else { continue }
            switch item {
            case let .photo(role, _): photoKeys.append((role, key))
            case let .clip(line, _, _, _): clipKeys.append((line, key))
            }
        }
        if !photoKeys.isEmpty || !clipKeys.isEmpty {
            progress(0.98, "attaching")
            try await Backend.shared.attach(plan.draft.id, photos: photoKeys, clips: clipKeys, mode: fill ? "fill" : "replace")
        }
        await MainActor.run { self.pushed[plan.draft.id] = plan.snapshot }
        var r = "Pushed \(photoKeys.count) image\(photoKeys.count == 1 ? "" : "s") and \(clipKeys.count) clip\(clipKeys.count == 1 ? "" : "s")"
        // the whole-record originals of this SKU (0202): kept with the listing, never shown; a failure never fails the push
        // (the backfill at the next launch sends them)
        progress(0.99, "originals")
        let originals = await MainActor.run { self.originalsFolder }
        do {
            let o = try await Originals.sync(folder: originals, sku: plan.draft.skuText)
            if o.uploaded > 0 { r += " · \(o.uploaded) original\(o.uploaded == 1 ? "" : "s")" }
            if !o.failed.isEmpty { r += " · originals not uploaded: " + o.failed.joined(separator: " · ") }
        } catch { r += " · originals not uploaded: \(error.localizedDescription)" }
        let kept = (plan.images.count - images.count) + (plan.clips.count - clips.count)
        if kept > 0 { r += " · \(kept) kept as in the admin" }
        if plan.missingLines > 0 { r += " · \(plan.missingLines) clip(s) skipped: no line yet (scan-targets)" }
        return r
    }

    /// Push to admin (row button): check what the admin has, ask before replacing, upload (WebP + sizes, MP3 128),
    /// attach. Works on any listed draft, open or not (0165).
    func push(_ d: DraftSummary) {
        guard !jobs.isActive(d.id, .push) else { return }
        let sku = d.skuText, recordTitle = d.title
        jobs.enqueue(draftID: d.id, sku: sku, kind: .push, files: Set(session.assignments.filter { $0.value.sku == sku }.map(\.key))) { progress in
            progress(0, "reading the draft")
            let plan = try await self.pushPlan(d)
            guard !plan.isEmpty else { plan.discard(); return ("Nothing to push", nil) }
            progress(0, "checking the admin")
            let c: PushCheck
            do { c = try await self.check(plan) } catch { plan.discard(); throw error }
            if !c.replaced.isEmpty {
                // Figma `push · replace confirm` 2458:28040
                let photos = plan.images.filter { c.has.photos.contains($0.role) }.count
                let clips = plan.clips.filter { c.has.clips.contains($0.line) }.count
                func count(_ n: Int, _ one: String, _ many: String) -> String? { n == 0 ? nil : "\(n) \(n == 1 ? one : many)" }
                let what = [count(photos, "photo", "photos"), count(clips, "clip", "clips")].compactMap { $0 }.joined(separator: " and ")
                var body = "SKU \(sku) · \(recordTitle)\n\nReplaced (already in the admin):\n"
                body += c.replaced.map { "• \($0)" }.joined(separator: "\n")
                if !c.added.isEmpty { body += "\n\nAdded:\n" + c.added.map { "• \($0)" }.joined(separator: "\n") }
                body += c.replaced.count == 1 ? "\n\nThe old file stays in storage." : "\n\nThe old files stay in storage."
                let text = body
                let ok = await MainActor.run { () -> Bool in
                    let a = NSAlert()
                    a.messageText = "Replace \(what) in the admin?"
                    a.informativeText = text
                    a.addButton(withTitle: "Replace and push"); a.addButton(withTitle: "Cancel")
                    return a.runModal() == .alertFirstButtonReturn
                }
                if !ok { plan.discard(); return ("Cancelled: nothing changed in the admin", nil) }
            }
            return (try await self.send(plan, fill: false, has: c.has, progress: progress), nil)
        }
    }

    // MARK: Originals backfill (0202)

    private var originalsChecked = false
    /// Once per launch, signed in: every original of the Originals folder whose listing exists (any status) and that
    /// is not online yet goes up, on the push lane (one job, only when there is something to send)
    func backfillOriginals() {
        guard !originalsChecked, Backend.shared.signedIn else { return }
        originalsChecked = true
        let folder = originalsFolder
        Task { @MainActor in
            do {
                let files = Originals.files(in: folder)
                guard !files.isEmpty else { return }
                let listings = try await Backend.shared.originals(skus: Array(Set(files.map(\.sku))))
                let todo = Originals.pending(files, ledger: Originals.ledger(in: folder), listings: listings)
                guard !todo.isEmpty else { return }
                self.jobs.enqueue(draftID: "originals", sku: "", kind: .push) { progress in
                    let r = try await Originals.sync(folder: folder) { done, total in
                        progress(Double(done) / Double(max(1, total)), "\(done) of \(total) originals")
                    }
                    if !r.failed.isEmpty && r.uploaded == 0 { throw ScanError.message(r.summary) }
                    return (r.summary, nil)
                }
            } catch {
                self.originalsChecked = false   // try again at the next sign-in or draft search
            }
        }
    }

    // MARK: Push all (0165)

    /// Listed drafts a Push all would send: push or failed. Synced, empty and already queued ones are skipped.
    var pushAllPending: [DraftSummary] {
        drafts.results.filter { d in
            switch pushState(d) { case .push, .failed: return true; default: return false }
        }
    }
    /// true while Push all checks the admin before queueing (the button reads "Checking…")
    @Published var pushAllChecking = false
    /// the drafts of the last Push all, for "1 of 3 · 2 waiting"
    @Published var pushAllBatch: [String] = []

    /// Check every pending draft, ask ONCE if any already has files in the admin (replace, or keep and add only
    /// what is missing), then queue one push job per draft in list order (0143).
    func pushAll() {
        let list = pushAllPending
        guard !list.isEmpty, !pushAllChecking else { return }
        pushAllChecking = true
        Task { @MainActor in
            defer { self.pushAllChecking = false }
            var items: [(plan: PushPlan, check: PushCheck)] = []
            var failures: [String] = []
            for d in list {
                do {
                    let plan = try await self.pushPlan(d)
                    if plan.isEmpty { plan.discard(); continue }
                    do { items.append((plan, try await self.check(plan))) } catch { plan.discard(); throw error }
                } catch { failures.append("SKU \(d.skuText): \(error.localizedDescription)") }
            }
            guard !items.isEmpty else {
                self.caption = failures.isEmpty ? "Nothing to push" : "Push all: " + failures.joined(separator: " · ")
                return
            }
            var fill = false
            let withFiles = items.filter { !$0.check.replaced.isEmpty }
            if !withFiles.isEmpty {
                // Figma `push all · replace confirm` 2519:7935: one question for the whole batch
                let n = items.count
                var body = "\(withFiles.count == 1 ? "1 of them already has" : "\(withFiles.count) of them already have") files in the admin:\n"
                for it in withFiles {
                    body += "\nSKU \(it.plan.draft.skuText) · \(it.plan.draft.title)\n• " + it.check.replaced.joined(separator: " · ")
                }
                body += "\n\nEverything else is added. Old files stay in storage."
                if !failures.isEmpty { body += "\n\nNot checked (left out): " + failures.joined(separator: " · ") }
                let a = NSAlert()
                a.messageText = "Push \(n) draft\(n == 1 ? "" : "s") to the admin?"
                a.informativeText = body
                let group = RadioGroup()
                let replace = NSButton(radioButtonWithTitle: "Replace them with the Scanner’s files", target: group, action: #selector(RadioGroup.pick(_:)))
                let keep = NSButton(radioButtonWithTitle: "Keep them, add only what is missing", target: group, action: #selector(RadioGroup.pick(_:)))
                replace.state = .on
                group.buttons = [replace, keep]
                let stack = NSStackView(views: [replace, keep]); stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 6
                stack.frame = NSRect(x: 0, y: 0, width: 320, height: 44)
                a.accessoryView = stack
                a.addButton(withTitle: "Push \(n) draft\(n == 1 ? "" : "s")"); a.addButton(withTitle: "Cancel")
                let ok = a.runModal() == .alertFirstButtonReturn
                withExtendedLifetime(group) {}
                guard ok else { items.forEach { $0.plan.discard() }; self.caption = "Push all cancelled: nothing changed in the admin"; return }
                fill = keep.state == .on
            }
            self.pushAllBatch = items.map(\.plan.draft.id)
            for it in items {
                let plan = it.plan, has = it.check.has
                self.jobs.enqueue(draftID: plan.draft.id, sku: plan.draft.skuText, kind: .push, files: plan.files) { progress in
                    let p = plan.hasCopies ? plan : try await self.pushPlan(plan.draft)   // Retry: plan again
                    return (try await self.send(p, fill: fill, has: has, progress: progress), nil)
                }
            }
            if !failures.isEmpty { self.caption = "Push all: " + failures.joined(separator: " · ") }
        }
    }

    /// The `push all` row (Figma 2519:7929): ready | pushing | failed | synced, nil = hidden
    struct PushAllStatus { enum State { case ready, pushing, failed, synced }; let state: State; let summary: String; let button: String?; let count: Int }
    var pushAllStatus: PushAllStatus? {
        let listed = drafts.results
        guard !listed.isEmpty else { return nil }
        let states = listed.map { pushState($0) }
        let synced = states.filter { if case .synced = $0 { return true }; return false }.count
        let failed = states.filter { if case .failed = $0 { return true }; return false }.count
        let pending = pushAllPending.count
        let active = pushAllBatch.filter { jobs.isActive($0, .push) }.count
        if pushAllChecking { return PushAllStatus(state: .pushing, summary: "Checking \(pending) draft\(pending == 1 ? "" : "s")", button: "Pushing…", count: 0) }
        if active > 0 {
            let total = pushAllBatch.count, waiting = active - 1
            return PushAllStatus(state: .pushing, summary: "\(total - active + 1) of \(total)" + (waiting > 0 ? " · \(waiting) waiting" : ""), button: "Pushing…", count: 0)
        }
        if failed > 0 {
            let pushedNow = pushAllBatch.filter { id in listed.first { $0.id == id }.map { if case .synced = pushState($0) { return true }; return false } ?? false }.count
            var s = "\(failed) push\(failed == 1 ? "" : "es") failed"
            if pushedNow > 0 { s += " · \(pushedNow) pushed" }
            if pending > failed { s += " · \(pending - failed) to push" }
            return PushAllStatus(state: .failed, summary: s, button: pending == failed ? "Retry \(failed)" : "Push \(pending)", count: pending)
        }
        if pending > 0 {
            return PushAllStatus(state: .ready, summary: "\(pending) to push" + (synced > 0 ? " · \(synced) synced" : ""), button: "Push \(pending)", count: pending)
        }
        if synced > 0 { return PushAllStatus(state: .synced, summary: "All \(synced) synced", button: nil, count: 0) }
        return nil
    }

    // MARK: Session: remove and clear (0141)

    /// Clear: no confirmation, a toast with Undo (0149)
    func clearSession() {
        let n = session.clips.count
        let undo = session.clear(keeping: { self.jobs.uses($0) })
        toasts.show("Session cleared (\(n) clip\(n == 1 ? "" : "s"))", undo: undo)
    }

    /// With a draft picked, the file name is the name of the target position (from the admin)
    func syncFileName() {
        guard drafts.draft != nil else { fileName = nextFreeName(); return }   // free scan (0147)
        fileName = drafts.targetName ?? ""
        if drafts.targetName == nil { caption = "All positions scanned: Add image for another photo" }
    }

    func select(_ step: ScanStep) {
        currentID = step.id
        fileName = step.name
    }

    func addPhoto() {
        guard let name = Names.nextPhoto(after: steps) else { return }
        let s = ScanStep(name: name)
        steps.append(s)
        select(s)
    }

    func chooseFolder(originals: Bool = false) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.canCreateDirectories = true
        panel.prompt = "Choose"
        panel.message = originals ? "Folder for the originals (whole record)" : "Folder for the label images (4\")"
        panel.directoryURL = originals ? originalsFolder : folder
        if panel.runModal() == .OK, let url = panel.url { if originals { originalsFolder = url } else { folder = url } }
    }

    // MARK: Preview and scan

    var previewDPI: Int {
        scanner.resolutions.filter { $0 >= 50 }.min() ?? scanner.resolutions.min() ?? 75
    }

    func runPreview() {
        resetSelectionIfNeeded()
        let zone = previewZone
        caption = "Preview…"
        scanner.scan(areaMM: zone, dpi: previewDPI) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let img):
                self.preview = img
                self.caption = self.preset.sideMM == nil
                    ? "Whole glass: Scan saves everything you see"
                    : "Drag the record so the spindle hole sits in the middle (arrows to fine-tune, [ ] to turn, Return to scan). The dashed square is the \(self.preset == .record7 ? "3.8" : "4")\" label"
            case .failure(let e):
                self.caption = (e as? ScanError).map { if case .cancelled = $0 { return "Preview cancelled" }; return e.localizedDescription } ?? e.localizedDescription
            }
        }
    }

    /// "Turn by itself" (a one-shot button since Gio 2026-11-23: moving the image by hand never turns it again):
    /// reads the label in the preview around the guide's centre and turns the record upright, in the background
    func turnFromPreview() {
        guard let img = preview, sideMM != nil, !turning else { return }
        let k = CGFloat(img.width) / previewZone.width
        let c = CGPoint(x: (center.x - previewZone.minX) * k, y: (center.y - previewZone.minY) * k)
        let current = angle, labelMM = preset.labelMM
        turning = true
        DispatchQueue.global(qos: .userInitiated).async {
            let a = AutoTurn.angle(in: img, centerPx: c, sidePx: labelMM * k, current: current)
            DispatchQueue.main.async {
                self.turning = false
                if let a { self.angleBeforeTurn = current; self.animateCenter = true; self.angle = a; self.caption = "Turned by the label text: ⌘Z to undo" }
                else { self.caption = "Couldn't read the label: turn it by hand" }
            }
        }
    }

    func undoTurn() {
        guard let a = angleBeforeTurn else { return }
        animateCenter = true; angle = a; angleBeforeTurn = nil; caption = "Turn undone"
    }

    /// Center (⌘E): finds the record's outer edge on the preview and puts its centre on the guide's centre; angle kept
    func centerRecord() {
        guard let img = preview, sideMM != nil else { caption = "Press Preview first"; return }
        DispatchQueue.global(qos: .userInitiated).async {
            let c = AutoCenter.recordCenter(in: img)
            DispatchQueue.main.async {
                guard let c else { self.caption = "Couldn't find the record edge: drag it by hand"; return }
                let k = self.previewZone.width / CGFloat(img.width)   // mm per preview pixel
                self.animateCenter = true
                self.center = CGPoint(x: self.previewZone.minX + c.x * k, y: self.previewZone.minY + c.y * k)
                self.caption = "Record centred: fine-tune with the arrows"
            }
        }
    }

    /// The glass area to scan: the box around the turned square (or the whole zone)
    var scanArea: CGRect {
        guard let side = sideMM else { return previewZone }
        let r = side / 2 * (abs(cos(angle)) + abs(sin(angle)))
        return CGRect(x: center.x - r, y: center.y - r, width: 2 * r, height: 2 * r)
    }

    func runScan() {
        let name = Names.clean(fileName)
        guard !name.isEmpty else { caption = "Give the file a name first"; return }
        let area = scanArea.intersection(CGRect(origin: .zero, size: scanner.glassMM))
        let side = sideMM, angle = self.angle, center = self.center
        let dpi = AppModel.nearest(self.dpi, in: AppModel.dpiSteps(supported: scanner.resolutions))   // a main step only
        caption = "Scanning \(name).\(format.ext)"
        scanner.scan(areaMM: area, dpi: dpi) { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let e): self.caption = e.localizedDescription
            case .success(let img):
                self.preview = ImageOutput.refresh(preview: self.preview, zone: self.previewZone, scan: img, area: area)
                guard let side else { self.save(original: img, label: nil, dpi: dpi); return }
                self.caption = "Cutting the label…"
                let labelMM = self.preset.labelMM   // 3.5" for a 7", 4" for 10" / 12" (0153)
                // reading the label (OCR) and cutting two squares out of a ~25 MP scan: off the main thread
                DispatchQueue.global(qos: .userInitiated).async {
                    let scale = CGFloat(img.width) / area.width   // px per mm, as scanned
                    let c = CGPoint(x: (center.x - area.minX) * scale, y: (center.y - area.minY) * scale)
                    let angle = angle   // the angle set on the preview: a scan never turns by itself
                    let original = ImageOutput.straighten(img, centerPx: c, sidePx: side * scale, angle: angle)
                    let label = ImageOutput.straighten(img, centerPx: c, sidePx: labelMM * scale, angle: angle)
                    DispatchQueue.main.async {
                        guard let original, let label else { self.caption = "Could not cut the squares out of the scan"; return }
                        // The name is read now, so it can still be changed while the scanner runs
                        self.save(original: original, label: label, dpi: dpi)
                    }
                }
            }
        }
    }

    /// Label (4") in Save to, original (whole record) in Originals; whole glass = one file in Save to.
    // MARK: Free scans (0147): no draft selected

    struct FreeScan: Identifiable { var id: String { name }; let name: String; let label: URL; let original: URL?; let thumb: CGImage? }
    @Published var freeScans: [FreeScan] = []      // this session
    @Published var freeLightbox: URL?
    var freeFolder: URL { folder.appendingPathComponent("Free scans", isDirectory: true) }
    var freeOriginals: URL { originalsFolder.appendingPathComponent("Free scans", isDirectory: true) }

    /// scan_<yyyy-mm-dd>_<hhmm>, then _2, _3… when taken: a free scan never overwrites
    func nextFreeName(base: String? = nil) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd_HHmm"; f.locale = Locale(identifier: "en_US_POSIX")
        let root = base ?? "scan_" + f.string(from: Date())
        func taken(_ n: String) -> Bool {
            let file = n + "." + format.ext
            return FileManager.default.fileExists(atPath: freeFolder.appendingPathComponent(file).path)
                || FileManager.default.fileExists(atPath: freeOriginals.appendingPathComponent(file).path)
                || freeScans.contains { $0.name == n }
        }
        if !taken(root) { return root }
        var i = 2
        while taken("\(root)_\(i)") { i += 1 }
        return "\(root)_\(i)"
    }

    /// Clear list (0154): empties the session list only; the files stay in Free scans, the next name is unchanged
    func clearFreeList() {
        let kept = freeScans
        guard !kept.isEmpty else { return }
        freeScans = []
        toasts.show("List cleared · \(kept.count) scan\(kept.count == 1 ? "" : "s") kept in Free scans") { [weak self] in
            guard let self else { return nil }
            self.freeScans = kept + self.freeScans
            return nil
        }
    }

    func trashFreeScan(_ s: FreeScan) {
        var t = Trashed()
        for u in [s.label, s.original].compactMap({ $0 }) { t.trash(u) }
        let index = freeScans.firstIndex { $0.name == s.name } ?? freeScans.count
        freeScans.removeAll { $0.name == s.name }
        if drafts.draft == nil { fileName = nextFreeName() }
        toasts.show("Moved to Trash: \(s.label.lastPathComponent)") { [weak self] in
            guard let self else { return nil }
            if let e = t.restore() { return e }
            self.freeScans.insert(s, at: min(index, self.freeScans.count))
            if self.drafts.draft == nil { self.fileName = self.nextFreeName() }
            return nil
        }
    }

    private func save(original: CGImage, label: CGImage?, dpi: Int) {
        let free = drafts.draft == nil
        // a free scan: the typed name, made unique (never overwrites), in the "Free scans" subfolders
        let name = free ? nextFreeName(base: Names.clean(fileName)) : Names.clean(fileName)
        let fm = FileManager.default
        let file = name + "." + format.ext
        let labelDir = free ? freeFolder : folder, origDir = free ? freeOriginals : originalsFolder
        let main = labelDir.appendingPathComponent(file)
        let archive = label == nil ? nil : origDir.appendingPathComponent(file)
        do {
            try fm.createDirectory(at: labelDir, withIntermediateDirectories: true)
            if archive != nil { try fm.createDirectory(at: origDir, withIntermediateDirectories: true) }
            let existing = [main, archive].compactMap { $0 }.filter { fm.fileExists(atPath: $0.path) }
            if !existing.isEmpty {
                let alert = NSAlert()
                alert.messageText = "\(file) already exists"
                alert.informativeText = "Replace it with this scan? (" + existing.map { $0.deletingLastPathComponent().lastPathComponent }.joined(separator: " and ") + ")"
                alert.addButton(withTitle: "Replace")
                alert.addButton(withTitle: "Cancel")
                if alert.runModal() != .alertFirstButtonReturn { caption = "Not saved: the file already exists"; return }
            }
            let fmt = format, folderName = labelDir.lastPathComponent, origName = origDir.lastPathComponent
            let labelInches = preset == .record7 ? "3.8" : "4"
            caption = "Saving \(file)…"
            DispatchQueue.global(qos: .userInitiated).async {   // JPEG / TIFF encoding of large images: not on the main thread
                do {
                    try ImageOutput.write(label ?? original, to: main, format: fmt, dpi: dpi)
                    if let archive { try ImageOutput.write(original, to: archive, format: fmt, dpi: dpi) }
                    let thumb = DraftSession.thumbnail(main)
                    DispatchQueue.main.async {
                        self.caption = archive == nil
                            ? "Saved in \(folderName): \(file)"
                            : "Saved \(file): \(labelInches)\" label in \(folderName), whole record in \(origName)"
                        self.refreshDisk()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.scheduleSync() }   // a label scan is a cover
                        if free {
                            self.freeScans.append(FreeScan(name: name, label: main, original: archive, thumb: thumb ?? label ?? original))
                            if self.drafts.draft == nil { self.fileName = self.nextFreeName() }
                        } else if self.drafts.draft != nil, name == self.drafts.targetName {
                            self.drafts.saved(thumb ?? (label ?? original))
                        } else {
                            if let step = self.steps.first(where: { $0.name == name }) { self.thumbs[step.id] = thumb ?? label ?? original }
                            self.advance(after: name)
                        }
                    }
                } catch {
                    DispatchQueue.main.async { self.caption = error.localizedDescription }
                }
            }
        } catch {
            caption = error.localizedDescription
        }
    }

    private func advance(after name: String) {
        if let i = steps.firstIndex(where: { $0.name == name }) { steps[i].done = true }
        else if let sku = Names.parse(name).first?.sku, sku == steps.first?.sku || steps.isEmpty {
            // a typed name of this record: show it in the list as scanned
            var s = ScanStep(name: name); s.done = true; steps.append(s)
            steps.sort { (Int($0.role) ?? 99) < (Int($1.role) ?? 99) }
        }
        if let next = steps.first(where: { !$0.done }) { select(next) }
        else if !steps.isEmpty { addPhoto() }
    }
}

/// Two or more radio buttons in an NSAlert accessory: one on at a time
final class RadioGroup: NSObject {
    var buttons: [NSButton] = []
    @objc func pick(_ sender: NSButton) { for b in buttons { b.state = b === sender ? .on : .off } }
}
