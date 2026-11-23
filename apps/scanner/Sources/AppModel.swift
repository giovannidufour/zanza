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
        didSet { UserDefaults.standard.set(wavFolder, forKey: "wavFolder"); refreshDisk() }
    }
    @Published var mp3Folder: URL = UserDefaults.standard.url(forKey: "mp3Folder")
        ?? FileManager.default.urls(for: .musicDirectory, in: .userDomainMask)[0].appendingPathComponent("Zanza samples/MP3") {
        didSet { UserDefaults.standard.set(mp3Folder, forKey: "mp3Folder"); refreshDisk() }
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

    /// Turn the record by itself so the label text reads upright (Gio 2026-11-22)
    @Published var autoTurn: Bool = UserDefaults.standard.object(forKey: "autoTurn") as? Bool ?? true {
        didSet { UserDefaults.standard.set(autoTurn, forKey: "autoTurn"); if autoTurn { turnFromPreview() } }
    }
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

    /// Export every assigned clip of the open draft as a background job: MP3 320 always, WAV for ticked clips, tags,
    /// the side's label as cover. Overwrites. What it exports is fixed when queued (0143).
    func exportClips() {
        guard let d = drafts.draft else { return }
        let jobs: [(SessionClip, ClipTarget)] = drafts.clips.compactMap { slot in session.clip(assignedTo: slot.name).map { ($0, slot) } }
        guard !jobs.isEmpty else { return }
        let t = drafts.tags, sku = d.skuText
        let labelA = drafts.names.first { $0.role == 1 }.flatMap { drafts.file(named: $0.name, in: folder) }
        let labelB = drafts.names.first { $0.role == 2 }.flatMap { drafts.file(named: $0.name, in: folder) }
        let wav = wavFolder, mp3 = mp3Folder
        let wavFor = Set(drafts.clips.map(\.name).filter { session.wantsWAV(slot: $0) })
        self.jobs.enqueue(draftID: d.id, sku: sku, kind: .export, files: Set(jobs.map(\.0.file))) { progress in
            var noCover: [String] = []
            for (n, (clip, slot)) in jobs.enumerated() {
                progress(Double(n) / Double(jobs.count), "clip \(n + 1) of \(jobs.count)")
                let side = slot.role.lowercased().first == "b" ? labelB : labelA
                let cover = AudioExport.cover(from: side)
                if cover == nil { noCover.append(slot.label) }
                var tags = AudioExport.Tags()
                tags.title = slot.title ?? ""; tags.artist = slot.artist ?? ""
                tags.album = t?.album ?? d.title; tags.label = t?.label ?? ""
                tags.year = t?.year.map(String.init) ?? ""; tags.genre = (t?.genres ?? []).joined(separator: ", ")
                tags.track = slot.label; tags.comment = sku; tags.cover = cover
                try AudioExport.export(source: clip.url, trimStart: clip.trimStart, trimEnd: clip.trimEnd, name: slot.name, tags: tags,
                                       wavFolder: wavFor.contains(slot.name) ? wav : nil, mp3Folder: mp3, normalize: false)
            }
            var r = "Exported \(jobs.count) clip\(jobs.count == 1 ? "" : "s")"
            if !wavFor.isEmpty { r += " (\(wavFor.count) with WAV)" }
            if !noCover.isEmpty { r += " · no cover for \(noCover.joined(separator: ", "))" }
            return (r, mp3)
        }
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
            return (line, c.url, c.trimStart, c.trimEnd, slot.label)
        }
        guard !images.isEmpty || !clips.isEmpty else { return }
        let snapshot = pushItems(sku: sku)
        let missingLines = drafts.clips.filter { $0.line == nil && session.clip(assignedTo: $0.name) != nil }.count
        jobs.enqueue(draftID: d.id, sku: sku, kind: .push, files: Set(clips.map { $0.url.lastPathComponent })) { progress in
            progress(0, "checking the admin")
            let has = try await Backend.shared.adminHas(d.id)
            let replacedPhotos = images.map(\.role).filter { has.photos.contains($0) }
            let replacedClips = clips.filter { has.clips.contains($0.line) }.map(\.label)
            if !replacedPhotos.isEmpty || !replacedClips.isEmpty {
                let names = replacedPhotos.map { $0 == 1 ? "Label A" : $0 == 2 ? "Label B" : "Photo \($0)" } + replacedClips
                let added = images.count - replacedPhotos.count + clips.count - replacedClips.count
                let ok = await MainActor.run { () -> Bool in
                    let a = NSAlert()
                    a.messageText = "Replace in the admin?"
                    a.informativeText = "SKU \(sku) already has: \(names.joined(separator: ", ")). They will be replaced" + (added > 0 ? "; \(added) more will be added." : ".")
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

    /// Clear asks first only when some assigned clips are not exported yet
    func clearSession() {
        let unexported = session.assignments.values.filter { !FileManager.default.fileExists(atPath: mp3Folder.appendingPathComponent($0.name).appendingPathExtension("mp3").path) }.count
        if unexported > 0 {
            let a = NSAlert()
            a.messageText = "Clear \(session.clips.count) clips?"
            a.informativeText = "\(unexported) assigned clip\(unexported == 1 ? " is" : "s are") not exported yet."
            a.addButton(withTitle: "Clear"); a.addButton(withTitle: "Cancel")
            guard a.runModal() == .alertFirstButtonReturn else { return }
        }
        session.clear(keeping: { self.jobs.uses($0) })
    }

    /// With a draft picked, the file name is the name of the target position (from the admin)
    func syncFileName() {
        guard drafts.draft != nil else { return }
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
                self.turnFromPreview()
                self.caption = self.preset.sideMM == nil
                    ? "Whole glass: Scan saves everything you see"
                    : "Drag the record so the spindle hole sits in the middle (arrows to fine-tune, [ ] to turn, Return to scan). The dashed square is the 4\" label"
            case .failure(let e):
                self.caption = (e as? ScanError).map { if case .cancelled = $0 { return "Preview cancelled" }; return e.localizedDescription } ?? e.localizedDescription
            }
        }
    }

    /// Reads the label in the preview around the guide's centre and turns the record upright (in the background)
    func turnFromPreview() {
        guard autoTurn, let img = preview, sideMM != nil, !turning else { return }
        let k = CGFloat(img.width) / previewZone.width
        let c = CGPoint(x: (center.x - previewZone.minX) * k, y: (center.y - previewZone.minY) * k)
        let current = angle
        turning = true
        DispatchQueue.global(qos: .userInitiated).async {
            let a = AutoTurn.angle(in: img, centerPx: c, sidePx: SizePreset.labelMM * k, current: current)
            DispatchQueue.main.async {
                self.turning = false
                if let a { self.angle = a }
            }
        }
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
                self.turnFromPreview()
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
        let side = sideMM, angle = self.angle, center = self.center, dpi = self.dpi
        caption = "Scanning \(name).\(format.ext)"
        scanner.scan(areaMM: area, dpi: dpi) { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let e): self.caption = e.localizedDescription
            case .success(let img):
                self.preview = ImageOutput.refresh(preview: self.preview, zone: self.previewZone, scan: img, area: area)
                guard let side else { self.save(original: img, label: nil, dpi: dpi); return }
                let autoTurn = self.autoTurn
                self.caption = "Cutting the label…"
                // reading the label (OCR) and cutting two squares out of a ~25 MP scan: off the main thread
                DispatchQueue.global(qos: .userInitiated).async {
                    let scale = CGFloat(img.width) / area.width   // px per mm, as scanned
                    let c = CGPoint(x: (center.x - area.minX) * scale, y: (center.y - area.minY) * scale)
                    var angle = angle
                    if autoTurn, let a = AutoTurn.angle(in: img, centerPx: c, sidePx: SizePreset.labelMM * scale, current: angle) { angle = a }
                    let original = ImageOutput.straighten(img, centerPx: c, sidePx: side * scale, angle: angle)
                    let label = ImageOutput.straighten(img, centerPx: c, sidePx: SizePreset.labelMM * scale, angle: angle)
                    DispatchQueue.main.async {
                        if autoTurn { self.angle = angle }
                        guard let original, let label else { self.caption = "Could not cut the squares out of the scan"; return }
                        // The name is read now, so it can still be changed while the scanner runs
                        self.save(original: original, label: label, dpi: dpi)
                    }
                }
            }
        }
    }

    /// Label (4") in Save to, original (whole record) in Originals; whole glass = one file in Save to.
    private func save(original: CGImage, label: CGImage?, dpi: Int) {
        let name = Names.clean(fileName)
        let fm = FileManager.default
        let file = name + "." + format.ext
        let main = folder.appendingPathComponent(file)
        let archive = label == nil ? nil : originalsFolder.appendingPathComponent(file)
        do {
            try fm.createDirectory(at: folder, withIntermediateDirectories: true)
            if archive != nil { try fm.createDirectory(at: originalsFolder, withIntermediateDirectories: true) }
            let existing = [main, archive].compactMap { $0 }.filter { fm.fileExists(atPath: $0.path) }
            if !existing.isEmpty {
                let alert = NSAlert()
                alert.messageText = "\(file) already exists"
                alert.informativeText = "Replace it with this scan? (" + existing.map { $0.deletingLastPathComponent().lastPathComponent }.joined(separator: " and ") + ")"
                alert.addButton(withTitle: "Replace")
                alert.addButton(withTitle: "Cancel")
                if alert.runModal() != .alertFirstButtonReturn { caption = "Not saved: the file already exists"; return }
            }
            let fmt = format, folderName = folder.lastPathComponent, origName = originalsFolder.lastPathComponent
            caption = "Saving \(file)…"
            DispatchQueue.global(qos: .userInitiated).async {   // JPEG / TIFF encoding of large images: not on the main thread
                do {
                    try ImageOutput.write(label ?? original, to: main, format: fmt, dpi: dpi)
                    if let archive { try ImageOutput.write(original, to: archive, format: fmt, dpi: dpi) }
                    let thumb = DraftSession.thumbnail(main)
                    DispatchQueue.main.async {
                        self.caption = archive == nil
                            ? "Saved in \(folderName): \(file)"
                            : "Saved \(file): 4\" label in \(folderName), whole record in \(origName)"
                        self.refreshDisk()
                        if self.drafts.draft != nil, name == self.drafts.targetName {
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
