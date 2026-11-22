// Makes the Scanner's app icon (decision 0137): the shop logo on the acid-green ground of the staging favicon (0127),
// in multiply, inside the macOS rounded square (Apple template: 824 × 824 at 100, radius 185, on a 1024 canvas).
// Usage: swift tools/make-icon.swift <logo.png> <out.png>   (the logo is the image of the Figma `favicon` component)
import AppKit
let args = CommandLine.arguments
let source = NSImage(contentsOfFile: args[1])!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
/// The only logo file is 186 × 180 px: enlarge it smoothly, then cut it at mid grey so the edges stay crisp
/// (the logo is black ink on white) instead of blurred.
func sharpened(_ img: CGImage, width: Int) -> CGImage {
    let height = width * img.height / img.width
    let g = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width,
                      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
    g.setFillColor(gray: 1, alpha: 1); g.fill(CGRect(x: 0, y: 0, width: width, height: height))
    g.interpolationQuality = .high
    g.draw(img, in: CGRect(x: 0, y: 0, width: width, height: height))
    let p = g.data!.bindMemory(to: UInt8.self, capacity: width * height)
    for i in 0..<(width * height) {
        // a narrow ramp around 50% keeps a 1-px antialiased edge
        let v = Int(p[i]); p[i] = UInt8(max(0, min(255, (v - 128) * 6 + 128)))
    }
    return g.makeImage()!
}
let logo = sharpened(source, width: 670)
let size = 1024
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
let tile = CGRect(x: 100, y: 100, width: 824, height: 824)
let shape = CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil)
ctx.addPath(shape); ctx.clip()
ctx.setFillColor(CGColor(srgbRed: 0x73 / 255, green: 0xff / 255, blue: 0x61 / 255, alpha: 1))   // acid-green
ctx.fill(tile)
ctx.setBlendMode(.multiply)
ctx.interpolationQuality = .high
// as the favicon: logo 52/64 of the tile, centred, aspect kept (186 × 180)
let w = tile.width * 52 / 64, h = w * CGFloat(logo.height) / CGFloat(logo.width)
ctx.draw(logo, in: CGRect(x: tile.midX - w / 2, y: tile.midY - h / 2, width: w, height: h))
let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
