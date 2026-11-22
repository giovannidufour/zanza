import AppKit
import SwiftUI

/// The app's state: names to scan, settings, preview and the selection square.
final class AppModel: ObservableObject {
    let scanner = ScannerController()

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

    /// Last preview and the glass area it shows (mm, origin = corner of the glass)
    @Published var preview: CGImage?
    @Published var previewZone = CGRect(x: 0, y: 0, width: 216, height: 216)
    /// Selection square: centre in mm (glass coordinates) and clockwise angle in radians
    @Published var center = CGPoint(x: 108, y: 108)
    @Published var angle: CGFloat = 0

    private var lastClipboard = -1

    init() {
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

    func clampCenter() {
        let half = (sideMM ?? 0) / 2
        center.x = min(max(center.x, previewZone.minX + half * 0.5), previewZone.maxX - half * 0.5)
        center.y = min(max(center.y, previewZone.minY + half * 0.5), previewZone.maxY - half * 0.5)
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
        steps = found
        select(found[0])
        caption = found.count == 1 ? "1 name pasted" : "\(found.count) names pasted"
        return true
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

    func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.canCreateDirectories = true
        panel.prompt = "Choose"
        panel.directoryURL = folder
        if panel.runModal() == .OK, let url = panel.url { folder = url }
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
                    : "Drag the square onto the record; turn it from the top handle"
            case .failure(let e):
                self.caption = e.localizedDescription
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
                var out: CGImage? = img
                if let side {
                    let scale = CGFloat(img.width) / area.width   // px per mm, as scanned
                    out = ImageOutput.straighten(img,
                                                 centerPx: CGPoint(x: (center.x - area.minX) * scale, y: (center.y - area.minY) * scale),
                                                 sidePx: side * scale, angle: angle)
                }
                guard let out else { self.caption = "Could not cut the square out of the scan"; return }
                // The name is read now, so it can still be changed while the scanner runs
                self.save(out, dpi: dpi)
            }
        }
    }

    private func save(_ image: CGImage, dpi: Int) {
        let name = Names.clean(fileName)
        let fm = FileManager.default
        do {
            try fm.createDirectory(at: folder, withIntermediateDirectories: true)
            let url = folder.appendingPathComponent(name).appendingPathExtension(format.ext)
            if fm.fileExists(atPath: url.path) {
                let alert = NSAlert()
                alert.messageText = "\(url.lastPathComponent) already exists"
                alert.informativeText = "Replace it with this scan?"
                alert.addButton(withTitle: "Replace")
                alert.addButton(withTitle: "Cancel")
                if alert.runModal() != .alertFirstButtonReturn { caption = "Not saved: the file already exists"; return }
            }
            try ImageOutput.write(image, to: url, format: format, dpi: dpi)
            caption = "Saved in \(folder.lastPathComponent): \(url.lastPathComponent)"
            if let step = steps.first(where: { $0.name == name }) { thumbs[step.id] = image }
            advance(after: name)
        } catch {
            caption = error.localizedDescription
        }
    }

    private func advance(after name: String) {
        if let i = steps.firstIndex(where: { $0.name == name }) { steps[i].done = true }
        if let next = steps.first(where: { !$0.done }) { select(next) }
        else if !steps.isEmpty { addPhoto() }
    }
}
