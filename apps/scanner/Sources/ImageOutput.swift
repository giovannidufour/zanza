import AppKit
import ImageIO
import UniformTypeIdentifiers

enum FileFormat: String, CaseIterable, Identifiable {
    case jpeg = "JPEG", png = "PNG", tiff = "TIFF"
    var id: String { rawValue }
    var ext: String { switch self { case .jpeg: return "jpg"; case .png: return "png"; case .tiff: return "tif" } }
    var type: UTType { switch self { case .jpeg: return .jpeg; case .png: return .png; case .tiff: return .tiff } }
}

enum ImageOutput {
    /// Cuts the square of side `sidePx` centred on `centerPx` (top-left origin) and turned by `angle` (radians,
    /// clockwise on screen) out of `image`, so the result is straight.
    static func straighten(_ image: CGImage, centerPx: CGPoint, sidePx: CGFloat, angle: CGFloat) -> CGImage? {
        let side = Int(sidePx.rounded())
        guard side > 0,
              let ctx = CGContext(data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
        ctx.setFillColor(CGColor(gray: 1, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: side, height: side))
        ctx.interpolationQuality = .high
        let h = CGFloat(image.height)
        ctx.translateBy(x: CGFloat(side) / 2, y: CGFloat(side) / 2)
        ctx.rotate(by: angle)   // y-up context: positive = counter-clockwise, undoes the clockwise turn on screen
        ctx.draw(image, in: CGRect(x: -centerPx.x, y: -(h - centerPx.y), width: CGFloat(image.width), height: h))
        return ctx.makeImage()
    }

    /// The preview with a fresh scan of `area` painted over it (both in mm on the glass): after each Scan the preview
    /// shows what was just scanned, without another pass of the scanner.
    static func refresh(preview: CGImage?, zone: CGRect, scan: CGImage, area: CGRect) -> CGImage? {
        let w = preview?.width ?? Int(zone.width / 25.4 * 75), h = preview?.height ?? Int(zone.height / 25.4 * 75)
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
        ctx.setFillColor(CGColor(gray: 0.96, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
        if let preview { ctx.draw(preview, in: CGRect(x: 0, y: 0, width: w, height: h)) }
        let k = CGFloat(w) / zone.width   // px per mm
        let r = CGRect(x: (area.minX - zone.minX) * k, y: CGFloat(h) - (area.maxY - zone.minY) * k, width: area.width * k, height: area.height * k)
        ctx.interpolationQuality = .medium
        ctx.draw(scan, in: r)
        return ctx.makeImage()
    }

    static func write(_ image: CGImage, to url: URL, format: FileFormat, dpi: Int) throws {
        guard let dest = CGImageDestinationCreateWithURL(url as CFURL, format.type.identifier as CFString, 1, nil) else {
            throw ScanError.message("Could not write \(url.lastPathComponent).")
        }
        var props: [CFString: Any] = [kCGImagePropertyDPIWidth: dpi, kCGImagePropertyDPIHeight: dpi]
        if format == .jpeg { props[kCGImageDestinationLossyCompressionQuality] = 0.92 }
        CGImageDestinationAddImage(dest, image, props as CFDictionary)
        if !CGImageDestinationFinalize(dest) { throw ScanError.message("Could not write \(url.lastPathComponent).") }
    }
}
