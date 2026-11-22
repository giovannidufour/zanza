import AppKit
import SwiftUI

/// The preview under the fixed guide, drawn by AppKit (Gio 2026-11-22: the SwiftUI version lagged while dragging).
/// The glass image is moved and turned under the guide; centre (mm on the glass) and angle (radians; the image turns
/// counter-clockwise by it on screen) are handed to the model when the mouse is released.
final class GlassView: NSView {
    var image: CGImage? { didSet { if image !== oldValue { glassLayer.contents = image.flatMap { GlassView.light($0) }; place() } } }
    var glass = CGRect(x: 0, y: 0, width: 216, height: 297) { didSet { if glass != oldValue { place() } } }
    var side: CGFloat? { didSet { if side != oldValue { place(); guide.needsDisplay = true; window?.invalidateCursorRects(for: self) } } }
    var record: CGFloat = 0 { didSet { if record != oldValue { guide.needsDisplay = true } } }
    var label: CGFloat = 101.6
    var center = CGPoint(x: 108, y: 148) { didSet { place() } }
    var angle: CGFloat = 0 { didSet { place() } }
    var aids = false { didSet { if aids != oldValue { guide.needsDisplay = true } } }   // grid + "up" figure while turning
    var onCommit: ((CGPoint, CGFloat) -> Void)?
    /// Arrow-key nudges: saved without the automatic turn, so a fine-tuned angle is kept
    var onNudge: ((CGPoint, CGFloat) -> Void)?
    private(set) var interacting = false

    /// The glass image is one layer moved and turned by the GPU: dragging changes only its transform, nothing is redrawn
    private let glassLayer = CALayer()
    private let guide = GuideView()
    private enum Mode { case drag(start: NSPoint, center: CGPoint), turn(pointer: CGFloat, angle: CGFloat) }
    private var mode: Mode?
    private var pinching = false

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.backgroundColor = NSColor(white: 0.96, alpha: 1).cgColor   // surface-subtle over surface-base
        layer?.masksToBounds = true
        glassLayer.backgroundColor = NSColor.white.cgColor
        glassLayer.contentsGravity = .resize
        glassLayer.minificationFilter = .linear
        glassLayer.magnificationFilter = .linear
        layer?.addSublayer(glassLayer)
        guide.glass = self
        guide.autoresizingMask = [.width, .height]
        guide.frame = bounds
        addSubview(guide)
    }
    required init?(coder: NSCoder) { fatalError() }

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func layout() { super.layout(); place(); guide.needsDisplay = true }

    /// At most 1000 px on the long side: enough to place the record, light to move
    static func light(_ image: CGImage) -> CGImage {
        let f = min(1, 1000 / CGFloat(max(image.width, image.height)))
        return f < 1 ? (AutoTurn.scaled(image, by: f) ?? image) : image
    }

    // MARK: Geometry

    var mid: CGPoint { CGPoint(x: bounds.midX, y: bounds.midY) }
    /// points per mm
    var k: CGFloat {
        guard let side else { return min(bounds.width / glass.width, bounds.height / glass.height) }
        return min(bounds.width, bounds.height) * 0.78 / side
    }
    var handle: CGPoint { CGPoint(x: mid.x, y: mid.y - (side ?? 0) * k / 2 - 30) }

    private func place() {
        CATransaction.begin(); CATransaction.setDisableActions(true)
        let k = self.k
        glassLayer.bounds = CGRect(x: 0, y: 0, width: glass.width * k, height: glass.height * k)
        if side == nil {
            glassLayer.anchorPoint = CGPoint(x: 0.5, y: 0.5)
            glassLayer.position = mid
            glassLayer.setAffineTransform(.identity)
        } else {
            // the guide's centre (mm on the glass) is the point that sits in the middle; the glass turns around it
            glassLayer.anchorPoint = CGPoint(x: (center.x - glass.minX) / glass.width, y: (center.y - glass.minY) / glass.height)
            glassLayer.position = mid
            glassLayer.setAffineTransform(CGAffineTransform(rotationAngle: -angle))   // flipped: negative = counter-clockwise
        }
        CATransaction.commit()
    }

    // MARK: Mouse and trackpad

    override func resetCursorRects() { if side != nil { addCursorRect(bounds, cursor: .openHand) } }

    override func mouseDown(with e: NSEvent) {
        guard side != nil else { return }
        let p = convert(e.locationInWindow, from: nil)
        window?.makeFirstResponder(self)   // so the arrow keys reach the preview
        interacting = true
        if hypot(p.x - handle.x, p.y - handle.y) < 22 {
            mode = .turn(pointer: pointerAngle(p), angle: angle); aids = true
        } else {
            mode = .drag(start: p, center: center); NSCursor.closedHand.set()
        }
    }

    override func mouseDragged(with e: NSEvent) {
        let p = convert(e.locationInWindow, from: nil)
        switch mode {
        case .drag(let start, let c0):
            let dx = p.x - start.x, dy = p.y - start.y, a = angle, k = self.k
            let gx = (dx * cos(a) - dy * sin(a)) / k, gy = (dx * sin(a) + dy * cos(a)) / k
            center = CGPoint(x: min(max(c0.x - gx, glass.minX), glass.maxX), y: min(max(c0.y - gy, glass.minY), glass.maxY))
        case .turn(let p0, let a0):
            angle = a0 - (pointerAngle(p) - p0)
        case nil: break
        }
    }

    override func mouseUp(with e: NSEvent) {
        guard mode != nil else { return }
        mode = nil; aids = false; interacting = false
        NSCursor.openHand.set()
        onCommit?(center, angle)
    }

    override func rotate(with e: NSEvent) {   // two fingers on the trackpad
        guard side != nil else { return }
        interacting = true; aids = true; pinching = true
        angle += CGFloat(e.rotation) * .pi / 180
        if e.phase == .ended || e.phase == .cancelled { endPinch() }
    }

    override func endGesture(with event: NSEvent) { if pinching { endPinch() } }

    private func endPinch() {
        pinching = false; aids = false; interacting = false
        onCommit?(center, angle)
    }

    /// Arrows move the record 0.2 mm (⇧ 2 mm) the way they point; ⌥← / ⌥→ turn it 0.2° (⇧ 2°)
    override func keyDown(with e: NSEvent) {
        guard side != nil, let key = e.specialKey,
              [NSEvent.SpecialKey.leftArrow, .rightArrow, .upArrow, .downArrow].contains(key) else { super.keyDown(with: e); return }
        let big = e.modifierFlags.contains(.shift)
        if e.modifierFlags.contains(.option) {
            guard key == .leftArrow || key == .rightArrow else { return }
            let step = (big ? 2 : 0.2) * CGFloat.pi / 180
            angle += key == .leftArrow ? step : -step      // ← counter-clockwise, → clockwise
        } else {
            let mm: CGFloat = big ? 2 : 0.2
            var dx: CGFloat = 0, dy: CGFloat = 0
            switch key { case .leftArrow: dx = -mm; case .rightArrow: dx = mm; case .upArrow: dy = -mm; default: dy = mm }
            // the image moves on screen: undo its turn to get the move on the glass (same as a drag)
            let a = angle
            let gx = dx * cos(a) - dy * sin(a), gy = dx * sin(a) + dy * cos(a)
            center = CGPoint(x: min(max(center.x - gx, glass.minX), glass.maxX), y: min(max(center.y - gy, glass.minY), glass.maxY))
        }
        onNudge?(center, angle)
    }

    /// clockwise from straight up
    private func pointerAngle(_ p: CGPoint) -> CGFloat { atan2(p.x - mid.x, -(p.y - mid.y)) }
}

/// The fixed guide over the glass: drawn only when the size or the aids change, never while dragging.
final class GuideView: NSView {
    weak var glass: GlassView?
    override var isFlipped: Bool { true }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }   // the mouse goes to the glass

    override func draw(_ dirtyRect: NSRect) {
        guard let g = glass, let side = g.side, let ctx = NSGraphicsContext.current?.cgContext else { return }
        let ink = NSColor.black.cgColor, k = g.k, mid = g.mid
        let s = side * k
        let square = CGRect(x: mid.x - s / 2, y: mid.y - s / 2, width: s, height: s)
        ctx.setStrokeColor(ink); ctx.setLineWidth(1)
        if g.aids {   // horizontal lines every 1/12 of the guide, to line the text up
            ctx.setStrokeColor(NSColor.black.withAlphaComponent(0.16).cgColor)   // black-a16
            for i in 1..<12 {
                let y = (square.minY + s * CGFloat(i) / 12).rounded() + 0.5
                ctx.move(to: CGPoint(x: square.minX, y: y)); ctx.addLine(to: CGPoint(x: square.maxX, y: y))
            }
            ctx.strokePath()
            ctx.setStrokeColor(ink)
        }
        ctx.stroke(square.insetBy(dx: 0.5, dy: 0.5))
        if g.record > 0 && g.record <= side * 1.05 {
            let r = g.record * k
            ctx.setLineDash(phase: 0, lengths: [2, 4])
            ctx.strokeEllipse(in: CGRect(x: mid.x - r / 2, y: mid.y - r / 2, width: r, height: r))
        }
        let l = g.label * k
        ctx.setLineDash(phase: 0, lengths: [6, 6])
        ctx.stroke(CGRect(x: mid.x - l / 2, y: mid.y - l / 2, width: l, height: l))
        ctx.setLineDash(phase: 0, lengths: [])
        ctx.strokeEllipse(in: CGRect(x: mid.x - 4, y: mid.y - 4, width: 8, height: 8))   // spindle hole
        for c in [CGPoint(x: square.minX, y: square.minY), CGPoint(x: square.maxX, y: square.minY),
                  CGPoint(x: square.minX, y: square.maxY), CGPoint(x: square.maxX, y: square.maxY)] {
            let h = CGRect(x: c.x - 4, y: c.y - 4, width: 8, height: 8)
            ctx.setFillColor(NSColor.white.cgColor); ctx.fill(h); ctx.stroke(h.insetBy(dx: 0.5, dy: 0.5))
        }
        let handle = g.handle
        ctx.move(to: CGPoint(x: mid.x, y: square.minY)); ctx.addLine(to: CGPoint(x: mid.x, y: handle.y + 9)); ctx.strokePath()
        let hr = CGRect(x: handle.x - 9, y: handle.y - 9, width: 18, height: 18)
        ctx.setFillColor(NSColor.white.cgColor); ctx.fillEllipse(in: hr); ctx.strokeEllipse(in: hr)
        if g.aids, let figure = NSImage(systemSymbolName: "figure.stand", accessibilityDescription: "Up") {
            let img = figure.withSymbolConfiguration(.init(pointSize: 28, weight: .regular)) ?? figure
            let r = CGRect(x: mid.x - img.size.width / 2, y: square.minY + 12, width: img.size.width, height: img.size.height)
            ctx.setFillColor(NSColor.white.withAlphaComponent(0.85).cgColor)
            ctx.fillEllipse(in: r.insetBy(dx: -8, dy: -6))
            img.draw(in: r, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
        }
    }
}

struct GlassCanvas: NSViewRepresentable {
    @ObservedObject var model: AppModel

    func makeNSView(context: Context) -> GlassView {
        let v = GlassView()
        v.onCommit = { c, a in
            model.center = c; model.angle = a
            model.turnFromPreview()
        }
        v.onNudge = { c, a in model.center = c; model.angle = a }
        return v
    }

    func updateNSView(_ v: GlassView, context: Context) {
        if v.image !== model.preview { v.image = model.preview }
        v.glass = model.previewZone
        v.side = model.sideMM
        v.record = model.preset.recordMM ?? 0
        v.label = SizePreset.labelMM
        if !v.interacting {
            v.center = model.center; v.angle = model.angle
            v.aids = model.turnAids
        }
    }
}
