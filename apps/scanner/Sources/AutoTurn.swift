import CoreGraphics
import Vision

/// Finds how much to turn a label so its text reads upright (macOS text recognition, no network).
enum AutoTurn {
    /// `image`: a scan; `centerPx`: the spindle hole in it; `sidePx`: the label square (4"); `angle`: the turn already set.
    /// Returns the new angle (same convention as ImageOutput.straighten), or nil when no text is found.
    static func angle(in image: CGImage, centerPx: CGPoint, sidePx: CGFloat, current: CGFloat) -> CGFloat? {
        // Small copies are enough to read a label and keep the twelve tries fast
        let shrink = min(1, 700 / sidePx)
        guard let small = scaled(image, by: shrink) else { return nil }
        let c = CGPoint(x: centerPx.x * shrink, y: centerPx.y * shrink), side = sidePx * shrink
        var best: (score: Double, angle: CGFloat, lines: [VNRecognizedTextObservation])? = nil
        for step in 0..<12 {
            let a = current + CGFloat(step) * .pi / 6
            guard let cut = ImageOutput.straighten(small, centerPx: c, sidePx: side, angle: a) else { continue }
            let lines = read(cut)
            let score = lines.reduce(0.0) { sum, o in
                guard let t = o.topCandidates(1).first else { return sum }
                let letters = t.string.filter(\.isLetter).count
                return sum + Double(t.confidence) * Double(letters)
            }
            if score > (best?.score ?? 0) { best = (score, a, lines) }
        }
        guard let best, best.score >= 4 else { return nil }
        // Refine with the slope of the recognised lines (weighted by length); Vision's coordinates are y-up
        var sum: CGFloat = 0, weight: CGFloat = 0
        for o in best.lines {
            let dx = o.bottomRight.x - o.bottomLeft.x, dy = o.bottomRight.y - o.bottomLeft.y
            let len = hypot(dx, dy); guard len > 0.05 else { continue }
            sum += atan2(dy, dx) * len; weight += len
        }
        let slope = weight > 0 ? sum / weight : 0      // counter-clockwise tilt of the text
        return normalized(best.angle - slope)
    }

    static func read(_ image: CGImage) -> [VNRecognizedTextObservation] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        try? VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
        return request.results ?? []
    }

    static func scaled(_ image: CGImage, by f: CGFloat) -> CGImage? {
        if f >= 1 { return image }
        let w = Int(CGFloat(image.width) * f), h = Int(CGFloat(image.height) * f)
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
        ctx.interpolationQuality = .medium
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        return ctx.makeImage()
    }

    /// −π…π
    static func normalized(_ a: CGFloat) -> CGFloat {
        var x = a.truncatingRemainder(dividingBy: 2 * .pi)
        if x > .pi { x -= 2 * .pi }; if x < -.pi { x += 2 * .pi }
        return x
    }
}
