import CoreGraphics
import Foundation

/// "Center" (Gio 2026-11-22, Figma row "preview tools"): where the record's centre is on the preview, in preview pixels
/// (top-left origin). v2 after Gio's "non è molto preciso": the first version fitted the left/right ends of every row
/// of the dark area, so a dark band at the edge of the glass (lid shadow, scanner frame) touching the record pulled the
/// centre towards it.
/// 1. dark mask (vinyl), opened (erode + dilate 2 px) so thin dark lines no longer join the record;
/// 2. largest dark area; from its centroid, 360 rays find the outer edge; rays that reach the image border are dropped;
/// 3. least-squares circle, then two passes that drop the edge points far from it (2.5 × the median residual);
/// 4. spindle hole: the bright area around that centre, if it has the size of a hole, is the better centre (its centroid).
enum AutoCenter {
    struct Result { let center: CGPoint; let radius: CGFloat; let residual: CGFloat; let fromHole: Bool }

    static func recordCenter(in image: CGImage) -> CGPoint? { find(in: image)?.center }

    static func find(in image: CGImage) -> Result? {
        let f = min(1, 1000 / CGFloat(max(image.width, image.height)))
        let w = max(1, Int(CGFloat(image.width) * f)), h = max(1, Int(CGFloat(image.height) * f))
        guard let g = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                                space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue),
              let data = (g.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h)), g.data).1 else { return nil }
        let px = data.bindMemory(to: UInt8.self, capacity: w * h)   // row 0 = top

        // 1. dark, opened
        var dark = [Bool](repeating: false, count: w * h)
        for i in 0..<(w * h) { dark[i] = px[i] < 80 }
        dark = dilate(erode(dark, w, h, 2), w, h, 2)

        // 2. largest dark area
        let (labels, best, size) = largestComponent(dark, w, h)
        guard size > (w * h) / 60 else { return nil }
        var cx = 0.0, cy = 0.0
        for i in 0..<(w * h) where labels[i] == best { cx += Double(i % w); cy += Double(i / w) }
        cx /= Double(size); cy /= Double(size)
        let maxR = Double(max(w, h))
        /// edge points on 360 rays from (ox, oy); rays whose edge is the image border are dropped
        func rays(_ ox: Double, _ oy: Double, limit: Double) -> [(Double, Double)] {
            var out: [(Double, Double)] = []
            for deg in 0..<360 {
                let a = Double(deg) * .pi / 180, dx = cos(a), dy = sin(a)
                var last: (Double, Double)? = nil, hitBorder = false, r = 0.0
                while r < limit {
                    let x = Int(ox + dx * r), y = Int(oy + dy * r)
                    if x < 0 || y < 0 || x >= w || y >= h { break }
                    if labels[y * w + x] == best {
                        last = (ox + dx * r, oy + dy * r)
                        if x == 0 || y == 0 || x == w - 1 || y == h - 1 { hitBorder = true }
                    }
                    r += 0.5
                }
                if let last, !hitBorder { out.append(last) }
            }
            return out
        }
        /// least squares, then two passes dropping points far from the circle (2.5 × the median residual)
        func robustFit(_ p0: [(Double, Double)]) -> (x: Double, y: Double, r: Double, pts: [(Double, Double)])? {
            guard p0.count >= 30, var c = fit(p0) else { return nil }
            var p = p0
            for _ in 0..<2 {
                let res = p.map { abs(hypot($0.0 - c.x, $0.1 - c.y) - c.r) }
                let median = res.sorted()[res.count / 2]
                let keep = zip(p, res).filter { $0.1 <= max(1.5, 2.5 * median) }.map(\.0)
                guard keep.count >= 30, let c2 = fit(keep) else { break }
                p = keep; c = c2
            }
            return (c.x, c.y, c.r, p)
        }
        // first from the centroid, then twice from the fitted centre (a dark band joined to the record moves the
        // centroid; rays from the real centre stop at the record's edge, only the few crossing the band are outliers)
        guard var c = robustFit(rays(cx, cy, limit: maxR)) else { return nil }
        for _ in 0..<2 {
            guard let c2 = robustFit(rays(c.x, c.y, limit: c.r * 1.15)) else { break }
            c = c2
        }
        let pts = c.pts
        var residual = 0.0
        let final = pts.map { abs(hypot($0.0 - c.x, $0.1 - c.y) - c.r) }
        residual = final.sorted()[final.count / 2]

        // 4. the spindle hole (bright, round, centred): its centroid
        var center = CGPoint(x: c.x, y: c.y), fromHole = false
        let hx = Int(c.x), hy = Int(c.y)
        if hx >= 0, hy >= 0, hx < w, hy < h {
            var bright = [Bool](repeating: false, count: w * h)
            for i in 0..<(w * h) { bright[i] = px[i] > 215 }
            if bright[hy * w + hx] {
                var seen = [Bool](repeating: false, count: w * h)
                var stack = [hy * w + hx]; seen[hy * w + hx] = true
                var n = 0, sx = 0.0, sy = 0.0, touches = false
                while let i = stack.popLast() {
                    n += 1; let x = i % w, y = i / w; sx += Double(x); sy += Double(y)
                    if x == 0 || y == 0 || x == w - 1 || y == h - 1 { touches = true }
                    if n > w * h / 4 { break }
                    for k in [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]
                    where k >= 0 && bright[k] && !seen[k] { seen[k] = true; stack.append(k) }
                }
                let holeR = (Double(n) / .pi).squareRoot()
                let hc = CGPoint(x: sx / Double(n), y: sy / Double(n))
                if !touches, holeR > 0.02 * c.r, holeR < 0.35 * c.r, hypot(hc.x - c.x, hc.y - c.y) < 0.1 * c.r {
                    center = hc; fromHole = true
                }
            }
        }
        // a ragged fit (record mostly hidden, or joined to large dark areas) and no hole: better not to move it
        if !fromHole && residual > 3 { return nil }
        return Result(center: CGPoint(x: center.x / f, y: center.y / f), radius: c.r / f, residual: residual / f, fromHole: fromHole)
    }

    // MARK: helpers

    static func fit(_ p: [(Double, Double)]) -> (x: Double, y: Double, r: Double)? {
        var sxx = 0.0, sxy = 0.0, syy = 0.0, sx = 0.0, sy = 0.0, n = 0.0, sxz = 0.0, syz = 0.0, sz = 0.0
        for (x, y) in p {
            let z = x * x + y * y
            sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y; n += 1; sxz += x * z; syz += y * z; sz += z
        }
        let a = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], b = [-sxz, -syz, -sz]
        func det(_ m: [[Double]]) -> Double {
            m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
        }
        let d = det(a); guard abs(d) > 1e-9 else { return nil }
        func col(_ k: Int) -> [[Double]] { a.enumerated().map { i, row in row.enumerated().map { j, v in j == k ? b[i] : v } } }
        let D = det(col(0)) / d, E = det(col(1)) / d, F = det(col(2)) / d
        let x = -D / 2, y = -E / 2, r2 = x * x + y * y - F
        return r2 > 0 ? (x, y, r2.squareRoot()) : nil
    }

    static func erode(_ m: [Bool], _ w: Int, _ h: Int, _ r: Int) -> [Bool] { morph(m, w, h, r, all: true) }
    static func dilate(_ m: [Bool], _ w: Int, _ h: Int, _ r: Int) -> [Bool] { morph(m, w, h, r, all: false) }
    /// separable box min (erode) / max (dilate)
    static func morph(_ m: [Bool], _ w: Int, _ h: Int, _ r: Int, all: Bool) -> [Bool] {
        var tmp = m, out = m
        for y in 0..<h { for x in 0..<w {
            var v = all
            for dx in -r...r { let xx = min(max(x + dx, 0), w - 1); if all { v = v && m[y * w + xx] } else { v = v || m[y * w + xx] } }
            tmp[y * w + x] = v
        } }
        for y in 0..<h { for x in 0..<w {
            var v = all
            for dy in -r...r { let yy = min(max(y + dy, 0), h - 1); if all { v = v && tmp[yy * w + x] } else { v = v || tmp[yy * w + x] } }
            out[y * w + x] = v
        } }
        return out
    }

    static func largestComponent(_ m: [Bool], _ w: Int, _ h: Int) -> ([Int32], Int32, Int) {
        var label = [Int32](repeating: 0, count: w * h)
        var best: (Int32, Int) = (0, 0), next: Int32 = 1, stack: [Int] = []
        for s in 0..<(w * h) where m[s] && label[s] == 0 {
            var size = 0; label[s] = next; stack.append(s)
            while let i = stack.popLast() {
                size += 1; let x = i % w, y = i / w
                for n in [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]
                where n >= 0 && m[n] && label[n] == 0 { label[n] = next; stack.append(n) }
            }
            if size > best.1 { best = (next, size) }
            next += 1
        }
        return (label, best.0, best.1)
    }
}
