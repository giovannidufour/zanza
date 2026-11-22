import CoreGraphics

/// "Center" (Gio 2026-11-22, Figma row "preview tools"): finds the record on the preview — the dark vinyl on the white
/// glass — and returns the centre of the circle fitted to its outer edge, in pixels of the preview (top-left origin).
enum AutoCenter {
    static func recordCenter(in image: CGImage) -> CGPoint? {
        // small grey copy: the record is ~150 px across, plenty for a circle fit
        let f = min(1, 320 / CGFloat(max(image.width, image.height)))
        let w = max(1, Int(CGFloat(image.width) * f)), h = max(1, Int(CGFloat(image.height) * f))
        guard let g = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                                space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return nil }
        g.interpolationQuality = .medium
        g.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        guard let data = g.data else { return nil }
        let px = data.bindMemory(to: UInt8.self, capacity: w * h)   // row 0 = top (bitmap memory order)

        // dark = vinyl
        var dark = [Bool](repeating: false, count: w * h)
        for i in 0..<(w * h) { dark[i] = px[i] < 80 }

        // largest connected dark area (4-neighbours)
        var label = [Int32](repeating: 0, count: w * h)
        var best = (id: Int32(0), size: 0)
        var next: Int32 = 1
        var stack: [Int] = []
        for start in 0..<(w * h) where dark[start] && label[start] == 0 {
            var size = 0
            label[start] = next; stack.append(start)
            while let i = stack.popLast() {
                size += 1
                let x = i % w, y = i / w
                for n in [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]
                where n >= 0 && dark[n] && label[n] == 0 { label[n] = next; stack.append(n) }
            }
            if size > best.size { best = (next, size) }
            next += 1
        }
        guard best.size > (w * h) / 50 else { return nil }   // nothing record-sized

        // outer edge: first and last pixel of that area on every row, then a least-squares circle (Kåsa)
        var pts: [(Double, Double)] = []
        for y in 0..<h {
            var first = -1, last = -1
            for x in 0..<w where label[y * w + x] == best.id { if first < 0 { first = x }; last = x }
            if first >= 0 && last - first > 2 { pts.append((Double(first), Double(y))); pts.append((Double(last), Double(y))) }
        }
        guard pts.count >= 10, let c = fitCircle(pts) else { return nil }
        return CGPoint(x: c.x / f, y: c.y / f)
    }

    /// x² + y² + D x + E y + F = 0, least squares
    static func fitCircle(_ p: [(Double, Double)]) -> CGPoint? {
        var sxx = 0.0, sxy = 0.0, syy = 0.0, sx = 0.0, sy = 0.0, n = 0.0, sxz = 0.0, syz = 0.0, sz = 0.0
        for (x, y) in p {
            let z = x * x + y * y
            sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y; n += 1
            sxz += x * z; syz += y * z; sz += z
        }
        // [sxx sxy sx; sxy syy sy; sx sy n] [D E F] = -[sxz syz sz]
        let a = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], b = [-sxz, -syz, -sz]
        func det(_ m: [[Double]]) -> Double {
            m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
        }
        let d = det(a); guard abs(d) > 1e-9 else { return nil }
        func col(_ k: Int) -> [[Double]] { a.enumerated().map { i, row in row.enumerated().map { j, v in j == k ? b[i] : v } } }
        let D = det(col(0)) / d, E = det(col(1)) / d
        return CGPoint(x: -D / 2, y: -E / 2)
    }
}
