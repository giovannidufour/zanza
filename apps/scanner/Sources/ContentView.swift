import SwiftUI

/// The window (Figma "Scanner v2 - wide, search column" 2437:1540, 1440 × 900): drafts 360 | preview 720 | record 360,
/// on the admin's cream ground (surface/page, backend).
struct ContentView: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var scanner: ScannerController

    var body: some View {
        HStack(spacing: 0) {
            Group {
                if Config.configured { DraftColumn(drafts: model.drafts).padding(24) }
                else { Text("No admin settings in this build.").bodyStyle(14, color: Theme.textModerate).padding(24) }
            }
            .frame(width: 360).frame(maxHeight: .infinity, alignment: .top)
            Rectangle().fill(Theme.divider).frame(width: 1)
            ScanColumn(scanner: scanner)
                .frame(minWidth: 560, maxWidth: .infinity)
            Rectangle().fill(Theme.divider).frame(width: 1)
            RecordColumn(scanner: scanner)
                .frame(width: 360)
        }
        .frame(minWidth: 1280, minHeight: 860)
        .background(Theme.surfacePage)
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            if model.drafts.draft == nil { model.pasteNames(onlyIfNew: true) }
        }
    }
}

// MARK: Left: record, steps, settings, scanner status

struct RecordColumn: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var scanner: ScannerController

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            DraftDetail(drafts: model.drafts)
            if model.drafts.draft == nil {   // v1: names pasted or typed (also when signed out or offline)
                VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(model.sku.map { "SKU \($0)" } ?? "No record").labelStyle(12, color: Theme.textModerate)
                    Text(model.recordTitle ?? "Copy the names of a draft").labelStyle(18)
                        .fixedSize(horizontal: false, vertical: true)
                    if model.steps.isEmpty {
                        Text("In the admin, open the draft and copy a name from File names. Come back here: it is pasted by itself (or press Paste names). Or just type the name.")
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
                }
            }

            VStack(alignment: .leading, spacing: 12) {
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
                HStack(spacing: 12) {
                    Button { model.runPreview() } label: { Text("Preview").frame(maxWidth: .infinity) }
                        .buttonStyle(ZButtonStyle(primary: false))
                        .disabled(!scanner.ready || scanner.busy)
                        .keyboardShortcut("p", modifiers: .command)
                    Button { model.runScan() } label: { Text("Scan").frame(maxWidth: .infinity) }
                        .buttonStyle(ZButtonStyle(primary: true))
                        .disabled(!scanner.ready || scanner.busy || model.fileName.trimmingCharacters(in: .whitespaces).isEmpty)
                        .keyboardShortcut(.return, modifiers: .command)
                }
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

/// Column 2: the preview fills the column; caption and the automatic turn under it
struct ScanColumn: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var scanner: ScannerController

    var body: some View {
        VStack(spacing: 12) {
            GlassCanvas(model: model)
                .aspectRatio(model.sideMM == nil ? model.previewZone.width / model.previewZone.height : 1, contentMode: .fit)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            Text(scanner.busy ? "\(model.caption) · \(Int(scanner.progress * 100))%" : model.caption)
                .bodyStyle(14, color: Theme.textModerate).lineLimit(2).multilineTextAlignment(.center)
            if model.sideMM != nil {
                Toggle(isOn: $model.autoTurn) {
                    Text(model.turning ? "Reading the label…" : "Turn by itself (reads the label text)").bodyStyle(12)
                }
                .toggleStyle(.checkbox)
            }
        }
        .padding(24)
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
