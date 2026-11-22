import SwiftUI

struct ContentView: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var scanner: ScannerController

    var body: some View {
        HStack(spacing: 0) {
            RecordColumn(scanner: scanner)
                .frame(width: 368)
            Rectangle().fill(Theme.divider).frame(width: 1)
            ScanColumn(scanner: scanner)
                .frame(minWidth: 560, maxWidth: .infinity)
        }
        .frame(minHeight: 760)
        .background(Theme.surfaceBase)
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            model.pasteNames(onlyIfNew: true)
        }
    }
}

// MARK: Left: record, steps, settings, scanner status

struct RecordColumn: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var scanner: ScannerController

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 8) {
                Text(model.sku.map { "SKU \($0)" } ?? "No record").labelStyle(12, color: Theme.textModerate)
                Text(model.recordTitle ?? "Copy the names of a draft").labelStyle(18)
                    .fixedSize(horizontal: false, vertical: true)
                if model.steps.isEmpty {
                    Text("In the admin, open the draft, then File names → Copy all. Come back here: the names are pasted by themselves (or press Paste names). One name works too, or just type it.")
                        .bodyStyle(14, color: Theme.textModerate).fixedSize(horizontal: false, vertical: true)
                }
                Button("Paste names") { model.pasteNames() }
                    .buttonStyle(ZButtonStyle(primary: false))
                    .keyboardShortcut("v", modifiers: [.command, .shift])
            }

            if !model.steps.isEmpty {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(model.steps) { step in
                            StepRow(step: step, current: step.id == model.currentID, thumb: model.thumbs[step.id])
                                .onTapGesture { model.select(step) }
                        }
                        Button("Add photo") { model.addPhoto() }
                            .buttonStyle(.plain).bodyStyle(14, color: Theme.textModerate)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.leading, 12).padding(.top, 4)
                    }
                }
                .frame(maxHeight: 260)
            }

            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    FieldLabel(text: "Record")
                    Picker("", selection: $model.preset) {
                        ForEach(SizePreset.allCases) { Text($0.menuTitle).tag($0) }
                    }.labelsHidden()
                }
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        FieldLabel(text: "Resolution")
                        Picker("", selection: $model.dpi) {
                            ForEach(dpiChoices, id: \.self) { Text("\($0) dpi").tag($0) }
                        }.labelsHidden()
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        FieldLabel(text: "File type")
                        Picker("", selection: $model.format) {
                            ForEach(FileFormat.allCases) { Text($0.rawValue).tag($0) }
                        }.labelsHidden()
                    }
                }
                FolderField(title: model.preset.sideMM == nil ? "Save to" : "Labels (4\") to", url: model.folder) { model.chooseFolder() }
                if model.preset.sideMM != nil {
                    FolderField(title: "Originals to", url: model.originalsFolder) { model.chooseFolder(originals: true) }
                }
            }

            Spacer(minLength: 0)

            HStack(spacing: 8) {
                Circle().fill(scanner.ready ? Color.black : Theme.alert).frame(width: 8, height: 8)
                Text(scanner.status).bodyStyle(12, color: Theme.textModerate)
            }
        }
        .padding(24)
        .frame(maxHeight: .infinity, alignment: .top)
    }

    /// The scanner's resolutions, plus the chosen one so the menu always shows it
    var dpiChoices: [Int] {
        Array(Set(scanner.resolutions.filter { $0 >= 75 && $0 <= 2400 } + [model.dpi])).sorted()
    }
}

struct FolderField: View {
    let title: String
    let url: URL
    let choose: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            FieldLabel(text: title)
            Button(action: choose) {
                HStack {
                    Text(url.lastPathComponent).bodyStyle(16).lineLimit(1)
                    Spacer()
                    Text("Change").bodyStyle(14, color: Theme.textModerate)
                }
                .padding(.horizontal, 12).frame(height: 40)
                .background(Theme.surfaceSubtle)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .help(url.path)
        }
    }
}

struct StepRow: View {
    let step: ScanStep
    let current: Bool
    let thumb: CGImage?

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Rectangle().fill(Theme.surfaceSubtle)
                if let thumb { Image(decorative: thumb, scale: 1).resizable().scaledToFill() }
            }
            .frame(width: 48, height: 48).clipped()
            VStack(alignment: .leading, spacing: 2) {
                Text(step.roleLabel).labelStyle(12, color: Theme.textModerate)
                Text(step.name).bodyStyle(14).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Image(systemName: step.done ? "checkmark.circle" : "circle")
                .font(.system(size: 18, weight: .light)).foregroundColor(Theme.textStrong)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(current ? Theme.surfaceHover : Color.clear)
        .overlay(Rectangle().stroke(current ? Theme.divider : Color.clear, lineWidth: 1))
        .contentShape(Rectangle())
    }
}

// MARK: Right: preview, file name, Preview + Scan

struct ScanColumn: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var scanner: ScannerController

    var body: some View {
        VStack(spacing: 12) {
            PreviewCanvas(scanner: scanner)
                .aspectRatio(model.sideMM == nil ? model.previewZone.width / model.previewZone.height : 1, contentMode: .fit)
                .padding(.top, 36)   // room for the turn handle above the square
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            if model.sideMM != nil {
                HStack(spacing: 12) {
                    Text("Turn").bodyStyle(14)
                    Slider(value: Binding(get: { -Double(model.angle) * 180 / .pi },
                                          set: { model.angle = -CGFloat($0) * .pi / 180 }), in: -180...180)
                    Text(String(format: "%.1f°", -Double(model.angle) * 180 / .pi)).bodyStyle(14, color: Theme.textModerate)
                        .frame(width: 56, alignment: .trailing)
                    Button("0°") { model.angle = 0 }.buttonStyle(ZButtonStyle(primary: false))
                }
                Toggle(isOn: $model.autoTurn) {
                    Text(model.turning ? "Reading the label…" : "Turn by itself (reads the label text)").bodyStyle(14)
                }
                .toggleStyle(.checkbox)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Text(scanner.busy ? "\(model.caption) · \(Int(scanner.progress * 100))%" : model.caption)
                .bodyStyle(12, color: Theme.textModerate).lineLimit(2).multilineTextAlignment(.center)
            HStack(alignment: .bottom, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    FieldLabel(text: "File name")
                    HStack(spacing: 4) {
                        TextField("48213_1_artist-title", text: $model.fileName)
                            .textFieldStyle(.plain).font(Theme.body(16))
                        Text(".\(model.format.ext)").bodyStyle(16, color: Theme.textModerate)
                    }
                    .padding(.horizontal, 12).frame(height: 40)
                    .background(Theme.surfaceSubtle)
                }
                Button("Preview") { model.runPreview() }
                    .buttonStyle(ZButtonStyle(primary: false))
                    .disabled(!scanner.ready || scanner.busy)
                    .keyboardShortcut("p", modifiers: .command)
                Button("Scan") { model.runScan() }
                    .buttonStyle(ZButtonStyle(primary: true))
                    .disabled(!scanner.ready || scanner.busy || model.fileName.trimmingCharacters(in: .whitespaces).isEmpty)
                    .keyboardShortcut(.return, modifiers: .command)
            }
        }
        .padding(24)
    }
}

/// The preview under a fixed guide (Gio 2026-11-22): the guide stays in the middle, the record is dragged under it and
/// turned from the handle above the guide. The model keeps the square in glass coordinates (centre, clockwise angle):
/// moving or turning the image is the inverse move of the square.
struct PreviewCanvas: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var scanner: ScannerController
    @State private var dragStart: CGPoint?
    @State private var turnStart: (angle: CGFloat, pointer: CGFloat)?
    @State private var pinchStart: CGFloat?

    var body: some View {
        GeometryReader { geo in
            if let side = model.sideMM { guided(side: side, size: geo.size) } else { wholeGlass(size: geo.size) }
        }
    }

    /// Whole glass: the preview as it is, nothing to place
    func wholeGlass(size: CGSize) -> some View {
        ZStack {
            Rectangle().fill(Theme.surfaceSubtle)
            if let img = model.preview { Image(decorative: img, scale: 1).resizable().scaledToFit() }
        }
    }

    func guided(side: CGFloat, size: CGSize) -> some View {
        let glass = model.previewZone
        let view = min(size.width, size.height)
        let k = view * 0.78 / side                          // points per mm: the guide fills 78% of the frame
        let mid = CGPoint(x: size.width / 2, y: size.height / 2)
        // where the glass's corner lands so that model.center sits in the middle
        let imgSize = CGSize(width: glass.width * k, height: glass.height * k)
        let offset = CGSize(width: (glass.midX - model.center.x) * k, height: (glass.midY - model.center.y) * k)
        let s = side * k, r = s / 2 + 30
        return ZStack {
            Rectangle().fill(Theme.surfaceSubtle)
            // the glass (preview or empty), moved and turned under the guide
            ZStack {
                Rectangle().fill(Color.white)
                if let img = model.preview { Image(decorative: img, scale: 1).resizable() }
            }
            .frame(width: imgSize.width, height: imgSize.height)
            .offset(offset)
            .rotationEffect(.radians(-model.angle))   // around the frame centre = the guide centre
            .position(mid)
            // fixed guide
            SelectionSquare(side: s, record: (model.preset.recordMM ?? 0) * k, label: SizePreset.labelMM * k)
                .position(mid)
                .allowsHitTesting(false)
            // turn handle, fixed above the guide
            Circle().fill(Theme.surfaceBase).overlay(Circle().stroke(Theme.textStrong, lineWidth: 1))
                .frame(width: 18, height: 18)
                .contentShape(Circle().inset(by: -14))
                .position(x: mid.x, y: mid.y - r)
                .gesture(DragGesture(minimumDistance: 0, coordinateSpace: .named("canvas"))
                    .onChanged { v in
                        let p = atan2(v.location.x - mid.x, -(v.location.y - mid.y))
                        if turnStart == nil { turnStart = (model.angle, p) }
                        model.angle = turnStart!.angle - (p - turnStart!.pointer)   // the image turns with the pointer
                    }
                    .onEnded { _ in turnStart = nil })
                .help("Drag sideways to turn the record")
        }
        .clipped()
        .contentShape(Rectangle())
        .coordinateSpace(name: "canvas")
        .simultaneousGesture(RotationGesture()
            .onChanged { v in
                if pinchStart == nil { pinchStart = model.angle }
                model.angle = pinchStart! - CGFloat(v.radians)   // two fingers on the trackpad turn the record
            }
            .onEnded { _ in pinchStart = nil })
        .gesture(DragGesture(minimumDistance: 1)
            .onChanged { v in
                if dragStart == nil { dragStart = model.center }
                // screen move → glass move: undo the image's turn, then scale
                let a = model.angle, dx = v.translation.width, dy = v.translation.height
                let gx = (dx * cos(a) - dy * sin(a)) / k, gy = (dx * sin(a) + dy * cos(a)) / k
                model.center = CGPoint(x: dragStart!.x - gx, y: dragStart!.y - gy)
                model.clampCenter()
            }
            .onEnded { _ in dragStart = nil; model.turnFromPreview() })
    }
}

struct SelectionSquare: View {
    let side: CGFloat
    let record: CGFloat   // record diameter, points
    let label: CGFloat    // 4" label crop, points
    var body: some View {
        ZStack {
            Rectangle().strokeBorder(Theme.textStrong, lineWidth: 1)
            if record > 0 && record <= side * 1.05 {   // the record's edge (10" and 12" do not fit the glass)
                Circle().stroke(Theme.textStrong, style: StrokeStyle(lineWidth: 1, dash: [2, 4])).frame(width: record, height: record)
            }
            Rectangle().stroke(Theme.textStrong, style: StrokeStyle(lineWidth: 1, dash: [6, 6])).frame(width: label, height: label)  // the 4" label image
            Circle().stroke(Theme.textStrong, lineWidth: 1).frame(width: 8, height: 8)   // spindle hole
            Rectangle().fill(Theme.textStrong).frame(width: 1, height: 30).offset(y: -side / 2 - 15)
        }
        .frame(width: side, height: side)
        .overlay(alignment: .topLeading) { handle.offset(x: -4, y: -4) }
        .overlay(alignment: .topTrailing) { handle.offset(x: 4, y: -4) }
        .overlay(alignment: .bottomLeading) { handle.offset(x: -4, y: 4) }
        .overlay(alignment: .bottomTrailing) { handle.offset(x: 4, y: 4) }
    }
    var handle: some View {
        Rectangle().fill(Theme.surfaceBase).overlay(Rectangle().stroke(Theme.textStrong, lineWidth: 1)).frame(width: 8, height: 8)
    }
}
