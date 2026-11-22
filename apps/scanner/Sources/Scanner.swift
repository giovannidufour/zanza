import AppKit
import ImageCaptureCore

/// The record on the glass (Gio 2026-11-22): the whole record is scanned for the archive, and a 4" square around the
/// spindle hole is cut for the shop. Sizes in millimetres.
enum SizePreset: String, CaseIterable, Identifiable {
    case record7 = "7\""
    case record10 = "10\""
    case record12 = "12\""
    case wholeGlass = "Whole glass"
    var id: String { rawValue }
    /// The label image for the shop: 4" whatever the record (Gio's standard)
    static let labelMM: CGFloat = 101.6
    /// Record diameter, drawn on the preview
    var recordMM: CGFloat? {
        switch self { case .record7: return 177.8; case .record10: return 254; case .record12: return 304.8; case .wholeGlass: return nil }
    }
    /// Side of the original (archive) square: the record plus a margin, at most the width of the glass; nil = whole zone
    var sideMM: CGFloat? {
        switch self { case .record7: return 180; case .record10, .record12: return 216; case .wholeGlass: return nil }
    }
    /// The zone the preview scans: the whole glass (clamped to it), so a record shows wherever it lies (Gio 2026-11-22)
    var zoneMM: CGSize { CGSize(width: 1000, height: 1000) }
    var menuTitle: String {
        switch self {
        case .record7: return "7\" · whole record + 4\" label"
        case .record10, .record12: return "\(rawValue) · centre (fits the glass) + 4\" label"
        case .wholeGlass: return "Whole glass · one file"
        }
    }
}

enum ScanError: LocalizedError {
    case noScanner, noFile, message(String)
    var errorDescription: String? {
        switch self {
        case .noScanner: return "No scanner: connect the CanoScan and switch it on."
        case .noFile: return "The scanner returned no image."
        case .message(let m): return m
        }
    }
}

/// Finds the scanner (ImageCaptureCore), opens it and scans an area of the flatbed to a CGImage.
final class ScannerController: NSObject, ObservableObject, ICDeviceBrowserDelegate, ICScannerDeviceDelegate {
    @Published var status = "Looking for a scanner…"
    @Published var ready = false
    @Published var busy = false
    @Published var progress: Double = 0
    @Published var resolutions: [Int] = [75, 150, 300, 600, 1200]
    /// Size of the glass in millimetres (A4-ish until the scanner says)
    @Published var glassMM = CGSize(width: 216, height: 297)

    private let browser = ICDeviceBrowser()
    private var scanner: ICScannerDevice?
    private var flatbed: ICScannerFunctionalUnit? { scanner?.selectedFunctionalUnit }
    private var scannedURL: URL?
    private var completion: ((Result<CGImage, Error>) -> Void)?
    private var timer: Timer?
    private let tempDir: URL = {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent("zanza-scanner", isDirectory: true)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }()

    func start() {
        browser.delegate = self
        let mask = ICDeviceTypeMask.scanner.rawValue | ICDeviceLocationTypeMask.local.rawValue
        browser.browsedDeviceTypeMask = ICDeviceTypeMask(rawValue: mask)!
        browser.start()
    }

    var scannerName: String { scanner?.name ?? "Scanner" }

    // MARK: Scan

    /// Scans `areaMM` (origin = corner of the glass) at `dpi`, then hands back the image.
    func scan(areaMM: CGRect, dpi: Int, completion: @escaping (Result<CGImage, Error>) -> Void) {
        guard let scanner, let unit = flatbed, ready else { completion(.failure(ScanError.noScanner)); return }
        let glass = CGRect(origin: .zero, size: glassMM)
        let area = areaMM.intersection(glass)
        unit.measurementUnit = .inches
        unit.resolution = closestResolution(to: dpi)
        unit.pixelDataType = .RGB
        unit.bitDepth = .depth8Bits
        unit.scanArea = NSRect(x: area.minX / 25.4, y: area.minY / 25.4, width: area.width / 25.4, height: area.height / 25.4)
        scanner.transferMode = .fileBased
        scanner.downloadsDirectory = tempDir
        scanner.documentName = "scan-\(UUID().uuidString)"
        scanner.documentUTI = "public.tiff"
        scannedURL = nil
        self.completion = completion
        busy = true; progress = 0
        status = "\(scannerName) · scanning"
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            guard let self, let u = self.flatbed else { return }
            self.progress = Double(u.scanProgressPercentDone) / 100
        }
        scanner.requestScan()
    }

    func cancel() { scanner?.cancelScan() }

    private func closestResolution(to dpi: Int) -> Int {
        resolutions.min(by: { abs($0 - dpi) < abs($1 - dpi) }) ?? dpi
    }

    private func finish(_ result: Result<CGImage, Error>) {
        timer?.invalidate(); timer = nil
        busy = false
        status = ready ? "\(scannerName) · ready" : status
        let done = completion; completion = nil
        done?(result)
    }

    // MARK: ICDeviceBrowserDelegate

    func deviceBrowser(_ browser: ICDeviceBrowser, didAdd device: ICDevice, moreComing: Bool) {
        guard scanner == nil, let s = device as? ICScannerDevice else { return }
        scanner = s
        s.delegate = self
        status = "\(s.name ?? "Scanner") · opening"
        s.requestOpenSession()
    }

    func deviceBrowser(_ browser: ICDeviceBrowser, didRemove device: ICDevice, moreGoing: Bool) {
        if device === scanner { lost() }
    }

    func didRemove(_ device: ICDevice) {
        if device === scanner { lost() }
    }

    private func lost() {
        scanner = nil; ready = false
        if busy { finish(.failure(ScanError.noScanner)) }
        status = "No scanner: connect the CanoScan and switch it on"
    }

    // MARK: ICScannerDeviceDelegate

    func device(_ device: ICDevice, didOpenSessionWithError error: Error?) {
        if let error { status = "Could not open the scanner: \(error.localizedDescription)"; return }
        scanner?.requestSelect(.flatbed)
    }

    func device(_ device: ICDevice, didCloseSessionWithError error: Error?) {
        ready = false
    }

    func scannerDevice(_ scanner: ICScannerDevice, didSelect functionalUnit: ICScannerFunctionalUnit, error: Error?) {
        if error != nil { return }   // the LiDE 100 first answers with -9922 and an empty unit, then with the flatbed
        let size = functionalUnit.physicalSize
        let mmPerUnit: CGFloat = functionalUnit.measurementUnit == .centimeters ? 10 : 25.4
        if size.width > 0 { glassMM = CGSize(width: size.width * mmPerUnit, height: size.height * mmPerUnit) }
        functionalUnit.measurementUnit = .inches
        let list = functionalUnit.supportedResolutions.map { $0 }
        if !list.isEmpty { resolutions = list }
        ready = true
        status = "\(scannerName) · ready"
    }

    /// A copy of the image in memory (sRGB, 8 bits), independent of the file it came from
    static func decoded(_ image: CGImage) -> CGImage? {
        guard let ctx = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        return ctx.makeImage()
    }

    func scannerDevice(_ scanner: ICScannerDevice, didScanTo url: URL) {
        scannedURL = url
    }

    func scannerDevice(_ scanner: ICScannerDevice, didCompleteScanWithError error: Error?) {
        if let error { finish(.failure(error)); return }
        // Decode now: a CGImage from a source is read lazily, and the file is deleted right after (the preview was black)
        guard let url = scannedURL,
              let src = CGImageSourceCreateWithURL(url as CFURL, nil),
              let lazy = CGImageSourceCreateImageAtIndex(src, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary),
              let image = Self.decoded(lazy) else { finish(.failure(ScanError.noFile)); return }
        try? FileManager.default.removeItem(at: url)
        finish(.success(image))
    }
}
