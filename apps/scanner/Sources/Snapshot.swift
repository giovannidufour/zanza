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
