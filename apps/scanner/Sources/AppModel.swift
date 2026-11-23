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
    enum Tab { case scans, samples }
    @Published var tab: Tab = .scans { didSet { session.active = tab == .samples; if tab == .scans { session.stop() } } }
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
        // draft rows read jobs and session (progress, push state, counts): redraw them when those change
        refreshDisk()
        forward = [jobs.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() },
                   session.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }]
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

    func chooseExportFolder(mp3: Bool) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.canCreateDirectories = true
        panel.prompt = "Choose"; panel.message = mp3 ? "Folder for the MP3 320" : "Folder for the WAV"
        panel.directoryURL = mp3 ? mp3Folder : wavFolder
        if panel.runModal() == .OK, let u = panel.url { if mp3 { mp3Folder = u } else { wavFolder = u } }
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
    struct ExportRecord: Codable { var hash: String; var wav: Bool; var complete: Bool; var missing: String? }
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

    private struct Planned { let clip: SessionClip; let slot: ClipTarget; let tags: AudioExport.Tags; let cover: URL?; let wav: Bool; let hash: String }

    /// Plans the writes of one draft: assigned clips whose inputs changed (or whose files are gone); WAVs unticked go
    private func plan(_ id: String) -> (writes: [Planned], dropWAV: [String])? {
        guard let c = drafts.cache[id] else { return nil }
        let sku = c.draft.skuText
        func labelFile(_ role: Int) -> URL? { c.names.first { $0.role == role }.flatMap { drafts.file(named: $0.name, in: folder) } }
        let labelA = labelFile(1), labelB = labelFile(2)
        var writes: [Planned] = [], dropWAV: [String] = []
        for slot in c.clips {
            guard let clip = session.clip(assignedTo: slot.name) else { continue }
            let wav = session.wantsWAV(slot: slot.name)
            let side = slot.role.lowercased().first == "b" ? labelB : labelA
            var t = AudioExport.Tags()
            t.title = slot.title ?? ""; t.artist = slot.artist ?? ""
            t.album = c.tags?.album ?? c.draft.title; t.albumArtist = c.tags?.album_artist ?? ""
            t.label = c.tags?.label ?? ""; t.year = c.tags?.year.map(String.init) ?? ""
            t.genre = (c.tags?.genres ?? []).joined(separator: ", "); t.track = slot.label; t.comment = sku
            let coverStamp = side.map { "\($0.lastPathComponent):\(disk.labels[$0.lastPathComponent] ?? "")" } ?? "none"
            let hash = [clip.file, "\(clip.trimStart)", "\(clip.trimEnd)", t.title, t.artist, t.album, t.albumArtist, t.label,
                        t.year, t.genre, t.track, t.comment, coverStamp, wav ? "wav" : "", mp3Folder.path, wavFolder.path].joined(separator: "|")
            let mp3 = mp3Folder.appendingPathComponent(slot.name).appendingPathExtension("mp3")
            let old = exports[slot.name]
            if old?.hash != hash || !FileManager.default.fileExists(atPath: mp3.path) {
                writes.append(Planned(clip: clip, slot: slot, tags: t, cover: side, wav: wav, hash: hash))
            }
            if !wav, old?.wav == true { dropWAV.append(slot.name) }
        }
        return (writes, dropWAV)
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
        guard !p.writes.isEmpty else { return }
        let writes = p.writes, wavDir = wavFolder, mp3Dir = mp3Folder, tagsKnown = c.tags != nil
        jobs.enqueue(draftID: id, sku: c.draft.skuText, kind: .export, files: Set(writes.map(\.clip.file))) { progress in
            var done: [(String, ExportRecord)] = []
            for (n, w) in writes.enumerated() {
                progress(Double(n) / Double(writes.count), "clip \(n + 1) of \(writes.count)")
                var tags = w.tags
                tags.cover = AudioExport.cover(from: w.cover)
                try AudioExport.export(source: w.clip.url, trimStart: w.clip.trimStart, trimEnd: w.clip.trimEnd, name: w.slot.name, tags: tags,
                                       wavFolder: w.wav ? wavDir : nil, mp3Folder: mp3Dir, normalize: false)
                let side = w.slot.role.lowercased().first == "b" ? "Label B" : "Label A"
                let missing = tags.cover == nil ? "\(w.slot.label) needs the \(side) scan" : (!tagsKnown ? "\(w.slot.label): tags not loaded" : nil)
                done.append((w.slot.name, ExportRecord(hash: w.hash, wav: w.wav, complete: missing == nil, missing: missing)))
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
        let record = exports[name]
        let assignment = session.assignments.first { $0.value.name == name }
        exports[name] = nil
        session.unassign(slot: name)
        refreshDisk()
        let label = drafts.clips.first { $0.name == name }?.label ?? name
        toasts.show("\(label) unassigned · " + (hadWAV ? "MP3 and WAV" : "MP3") + " moved to Trash") { [weak self] in
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

    /// Push to admin: check what the admin has, ask before replacing, upload (WebP + sizes, MP3 128), attach
    func push(_ d: DraftSummary) {
        // the open draft knows its clip lines; another one is opened first by the user (its lines come from scan-targets)
        guard drafts.draft?.id == d.id else { drafts.pick(d); caption = "Draft opened: press Push again"; return }
        let sku = d.skuText
        let images: [(role: Int, url: URL)] = drafts.names.compactMap { n in drafts.file(named: n.name, in: folder).map { (n.role, $0) } }
        let clips: [(line: Int, url: URL, trim: Double, trimEnd: Double, label: String)] = drafts.clips.compactMap { slot in
            guard let line = slot.line, let c = session.clip(assignedTo: slot.name) else { return nil }
            // "Clip A1 · Artist - Title" for the confirm dialog, never a bare "A"
            let track = [slot.artist, slot.title].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " - ")
            return (line, c.url, c.trimStart, c.trimEnd, "Clip \(slot.label)" + (track.isEmpty ? "" : " · \(track)"))
        }
        let recordTitle = d.title
        guard !images.isEmpty || !clips.isEmpty else { return }
        let snapshot = pushItems(sku: sku)
        let missingLines = drafts.clips.filter { $0.line == nil && session.clip(assignedTo: $0.name) != nil }.count
        jobs.enqueue(draftID: d.id, sku: sku, kind: .push, files: Set(clips.map { $0.url.lastPathComponent })) { progress in
            progress(0, "checking the admin")
            let has = try await Backend.shared.adminHas(d.id)
            func photoName(_ r: Int) -> String { r == 1 ? "Label A" : r == 2 ? "Label B" : "Other photo \(r)" }
            let replacedPhotos = images.map(\.role).filter { has.photos.contains($0) }
            let addedPhotos = images.map(\.role).filter { !has.photos.contains($0) }
            let replacedClips = clips.filter { has.clips.contains($0.line) }.map(\.label)
            let addedClips = clips.filter { !has.clips.contains($0.line) }.map(\.label)
            if !replacedPhotos.isEmpty || !replacedClips.isEmpty {
                // Figma `push · replace confirm` 2458:28040
                func count(_ n: Int, _ one: String, _ many: String) -> String? { n == 0 ? nil : "\(n) \(n == 1 ? one : many)" }
                let what = [count(replacedPhotos.count, "photo", "photos"), count(replacedClips.count, "clip", "clips")].compactMap { $0 }.joined(separator: " and ")
                var body = "SKU \(sku) · \(recordTitle)\n\nReplaced (already in the admin):\n"
                body += (replacedPhotos.map(photoName) + replacedClips).map { "• \($0)" }.joined(separator: "\n")
                let added = addedPhotos.map(photoName) + addedClips
                if !added.isEmpty { body += "\n\nAdded:\n" + added.map { "• \($0)" }.joined(separator: "\n") }
                let n = replacedPhotos.count + replacedClips.count
                body += n == 1 ? "\n\nThe old file stays in storage." : "\n\nThe old files stay in storage."
                let text = body
                let ok = await MainActor.run { () -> Bool in
                    let a = NSAlert()
                    a.messageText = "Replace \(what) in the admin?"
                    a.informativeText = text
                    a.addButton(withTitle: "Replace and push"); a.addButton(withTitle: "Cancel")
                    return a.runModal() == .alertFirstButtonReturn
                }
                if !ok { return ("Cancelled: nothing changed in the admin", nil) }
            }
            let total = Double(images.count + clips.count)
            var photoKeys: [(role: Int, key: String)] = [], clipKeys: [(line: Int, key: String)] = []
            for (i, img) in images.enumerated() {
                progress(Double(i) / total, "image \(i + 1) of \(images.count)")
                let key = try await Backend.shared.upload(try AudioExport.webp(from: img.url, long: 1600), kind: "photo", contentType: "image/webp")
                for w in [200, 400, 800] {
                    _ = try await Backend.shared.upload(try AudioExport.webp(from: img.url, width: w), kind: "photo", contentType: "image/webp", of: key, width: w)
                }
                photoKeys.append((img.role, key))
            }
            for (i, c) in clips.enumerated() {
                progress(Double(images.count + i) / total, "clip \(i + 1) of \(clips.count)")
                let key = try await Backend.shared.upload(try AudioExport.mp3(source: c.url, trimStart: c.trim, trimEnd: c.trimEnd, kbps: 128), kind: "sample", contentType: "audio/mpeg")
                clipKeys.append((c.line, key))
            }
            progress(0.98, "attaching")
            try await Backend.shared.attach(d.id, photos: photoKeys, clips: clipKeys)
            await MainActor.run { self.pushed[d.id] = snapshot }
            var r = "Pushed \(photoKeys.count) image\(photoKeys.count == 1 ? "" : "s") and \(clipKeys.count) clip\(clipKeys.count == 1 ? "" : "s")"
            if missingLines > 0 { r += " · \(missingLines) clip(s) skipped: no line yet (scan-targets)" }
            return (r, nil)
        }
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
                    : "Drag the record so the spindle hole sits in the middle (arrows to fine-tune, [ ] to turn, Return to scan). The dashed square is the \(self.preset == .record7 ? "3.5" : "4")\" label"
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
            let labelInches = preset == .record7 ? "3.5" : "4"
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
