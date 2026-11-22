import AppKit
import SwiftUI

/// The app's state: names to scan, settings, preview and the selection square.
final class AppModel: ObservableObject {
    let scanner = ScannerController()
    /// The admin link (0138): sign in, picked draft, image positions
    let drafts = DraftSession()

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
        didSet { UserDefaults.standard.set(folder, forKey: "folder") }
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
                self.caption = e.localizedDescription
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
                let scale = CGFloat(img.width) / area.width   // px per mm, as scanned
                let c = CGPoint(x: (center.x - area.minX) * scale, y: (center.y - area.minY) * scale)
                var angle = angle
                if self.autoTurn, let a = AutoTurn.angle(in: img, centerPx: c, sidePx: SizePreset.labelMM * scale, current: angle) {
                    angle = a; self.angle = a
                }
                guard let original = ImageOutput.straighten(img, centerPx: c, sidePx: side * scale, angle: angle),
                      let label = ImageOutput.straighten(img, centerPx: c, sidePx: SizePreset.labelMM * scale, angle: angle) else {
                    self.caption = "Could not cut the squares out of the scan"; return
                }
                // The name is read now, so it can still be changed while the scanner runs
                self.save(original: original, label: label, dpi: dpi)
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
            try ImageOutput.write(label ?? original, to: main, format: format, dpi: dpi)
            if let archive { try ImageOutput.write(original, to: archive, format: format, dpi: dpi) }
            caption = archive == nil
                ? "Saved in \(folder.lastPathComponent): \(file)"
                : "Saved \(file): 4\" label in \(folder.lastPathComponent), whole record in \(originalsFolder.lastPathComponent)"
            if drafts.draft != nil, name == drafts.targetName {
                drafts.saved(DraftSession.thumbnail(main) ?? (label ?? original))
            } else {
                if let step = steps.first(where: { $0.name == name }) { thumbs[step.id] = label ?? original }
                advance(after: name)
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
