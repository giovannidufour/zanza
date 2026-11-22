// Makes the Scanner's app icon (decision 0137): the shop logo on the acid-green ground of the staging favicon (0127),
// in multiply, inside the macOS rounded square (Apple template: 824 × 824 at 100, radius 185, on a 1024 canvas).
// Usage: swift tools/make-icon.swift <logo.png> <out.png>   (the logo is the image of the Figma `favicon` component)
import AppKit
let args = CommandLine.arguments
let logo = NSImage(contentsOfFile: args[1])!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
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
