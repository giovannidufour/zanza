import SwiftUI

/// `ZanzaScanner --snapshot out.png`: renders the window with sample names to a PNG and quits (design check, no scanner needed).
enum Snapshot {
    @MainActor static func runIfAsked() {
        let args = CommandLine.arguments
        guard let i = args.firstIndex(of: "--snapshot"), i + 1 < args.count else { return }
        let model = AppModel()
        model.steps = Names.parse("48213_1_gregory-isaacs-why-did-you-leave\n48213_2_sly-and-robbie-hard-drugs-dub\n48213_3_gregory-isaacs-why-did-you-leave\n48213_a1_gregory-isaacs-why-did-you-leave")
        model.steps[0].done = true
        model.select(model.steps[1])
        model.angle = -0.1
        model.center = CGPoint(x: 100, y: 104)
        model.caption = "Drag the square onto the record; turn it from the top handle"
        if let j = args.firstIndex(of: "--with-preview"), j + 1 < args.count,
           let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[j + 1]) as CFURL, nil),
           let img = CGImageSourceCreateImageAtIndex(src, 0, nil) { model.preview = ScannerController.decoded(img); model.center = CGPoint(x: 112, y: 150) }
        let view = ContentView(scanner: model.scanner).environmentObject(model).frame(width: 929, height: 760)
        let r = ImageRenderer(content: view)
        r.scale = 1
        if let img = r.nsImage, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
           let png = rep.representation(using: .png, properties: [:]) {
            try? png.write(to: URL(fileURLWithPath: args[i + 1]))
        }
        exit(0)
    }
}

/// `ZanzaScanner --test-scan <folder> <centerX mm> <centerY mm>`: real Preview + Scan with the scanner, files in <folder>, then quits.
enum TestScan {
    @MainActor static func runIfAsked() {
        let a = CommandLine.arguments
        guard let i = a.firstIndex(of: "--test-scan"), i + 3 < a.count else { return }
        let dir = URL(fileURLWithPath: a[i + 1])
        // the test must not change Gio's remembered settings
        let keys = ["preset", "dpi", "format", "folder", "originalsFolder"]
        let saved = keys.map { UserDefaults.standard.object(forKey: $0) }
        atexit_b {
            for (k, v) in zip(keys, saved) { if let v { UserDefaults.standard.set(v, forKey: k) } else { UserDefaults.standard.removeObject(forKey: k) } }
            UserDefaults.standard.synchronize()
        }
        let model = AppModel()
        model.folder = dir.appendingPathComponent("labels"); model.originalsFolder = dir.appendingPathComponent("originals")
        model.dpi = 300; model.format = .jpeg; model.preset = .record7
        model.center = CGPoint(x: Double(a[i + 2])!, y: Double(a[i + 3])!)
        model.fileName = "00000_1_test"
        model.scanner.start()
        func waitReady() {
            if !model.scanner.ready { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: waitReady); return }
            print("glass mm", model.scanner.glassMM)
            model.scanner.scan(areaMM: model.previewZone, dpi: model.previewDPI) { r in
                if case .success(let img) = r { try? ImageOutput.write(img, to: dir.appendingPathComponent("preview.png"), format: .png, dpi: 75) }
                print("preview", r)
                model.runScan()
                func waitDone() {
                    if model.scanner.busy || model.caption.hasPrefix("Scanning") { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: waitDone); return }
                    if let p = model.preview { try? ImageOutput.write(p, to: dir.appendingPathComponent("refreshed.png"), format: .png, dpi: 75) }
                    print(model.caption); exit(0)
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: waitDone)
            }
        }
        DispatchQueue.main.async(execute: waitReady)
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) { print("timeout"); exit(1) }
    }
}

/// `ZanzaScanner --glass out.png preview.png`: draws the GlassView alone (turned, with the aids) and quits.
enum GlassSnapshot {
    @MainActor static func runIfAsked() {
        let a = CommandLine.arguments
        guard let i = a.firstIndex(of: "--glass"), i + 2 < a.count,
              let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[i + 2]) as CFURL, nil),
              let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { return }
        let v = GlassView(frame: NSRect(x: 0, y: 0, width: 520, height: 520))
        v.glass = CGRect(x: 0, y: 0, width: 216, height: 216 * CGFloat(img.height) / CGFloat(img.width))
        v.image = img; v.side = 180; v.record = 177.8; v.center = CGPoint(x: 110, y: 160); v.angle = 0.4; v.aids = true
        if let rep = v.bitmapImageRepForCachingDisplay(in: v.bounds) {
            v.cacheDisplay(in: v.bounds, to: rep)
            try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: a[i + 1]))
        }
        exit(0)
    }
}
