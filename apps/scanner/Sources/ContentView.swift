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
            VStack(spacing: 0) {   // centre: tabs switch the centre and right columns only (0141)
                ScannerTabs().padding(.horizontal, 24).padding(.top, 24)
                if model.tab == .scans { ScanColumn(scanner: scanner) }
                else { SessionPanel(session: model.session).padding(24) }
            }
            .frame(minWidth: 560, maxWidth: .infinity)
            Rectangle().fill(Theme.divider).frame(width: 1)
            Group {
                if model.tab == .scans { RecordColumn(scanner: scanner) }
                else { SamplesColumn(scanner: scanner) }
            }
            .frame(width: 360)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { ActivityBar(jobs: model.jobs, drafts: model.drafts) }
        .frame(minWidth: 1280, minHeight: 860)
        .background(Theme.surfacePage)
        .overlay { Lightbox(drafts: model.drafts) }
        .overlay { FreeLightbox() }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            model.refreshDisk()   // files may have changed in Finder
        }
    }
}

// MARK: Left: record, steps, settings, scanner status

struct RecordColumn: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var scanner: ScannerController

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            DraftHead(drafts: model.drafts)
            if model.drafts.draft != nil { DraftDetail(drafts: model.drafts, session: model.session, kind: .images) }
            if model.drafts.draft == nil { FreeScanSection() }   // free scans (0147)

            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    FieldLabel(text: "File name")
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        TextField("48213_1_artist-title", text: $model.fileName, axis: .vertical)   // wraps, never cut
                            .textFieldStyle(.plain).font(Theme.body(16)).lineLimit(1...4)
                        Text(".\(model.format.ext)").bodyStyle(16, color: Theme.textModerate)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 10).frame(minHeight: 40)
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
                        Picker("", selection: Binding(get: { AppModel.nearest(model.dpi, in: dpiChoices) }, set: { model.dpi = $0 })) {
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

    /// Main steps only (Gio: not every dpi the scanner accepts), among those the scanner supports
    var dpiChoices: [Int] { AppModel.dpiSteps(supported: scanner.resolutions) }
}

/// Right column head, same in both tabs: SKU · Draft and the record title, with × to deselect (0147, also Esc);
/// without a draft, `free scan head`
struct DraftHead: View {
    @ObservedObject var drafts: DraftSession
    @EnvironmentObject var model: AppModel
    var body: some View {
        if let d = drafts.draft {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("SKU \(d.skuText) · Draft").labelStyle(12, color: Theme.textModerate)
                    Text(d.title).labelStyle(16).lineLimit(3).help(d.title)
                }
                Spacer(minLength: 8)
                let escFree = !model.scanner.busy && drafts.lightbox == nil && !drafts.newDraftOpen && model.freeLightbox == nil
                Button { drafts.deselect() } label: {
                    Image(systemName: "xmark").font(.system(size: 16, weight: .light)).frame(width: 24, height: 24).contentShape(Rectangle())
                }
                .buttonStyle(.plain).help("Deselect the draft: free scans (Esc)")
                .keyboardShortcut(escFree ? .escape : KeyEquivalent("\u{0}"), modifiers: escFree ? [] : [.command, .option, .control])
            }
        } else {
            VStack(alignment: .leading, spacing: 4) {   // `free scan head`
                Text("No draft").labelStyle(12, color: Theme.textModerate)
                Text("Free scan").labelStyle(16)
                Text("Scans are saved in “Free scans” inside your labels folder. Pick a draft on the left to scan for it.")
                    .bodyStyle(12, color: Theme.textModerate).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// Free scans of this session (0147): rows like image slots without handle; thumbnail = lightbox, × = Trash;
/// last row = the next scan with its name
struct FreeScanSection: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Free scans").labelStyle(12)
                Spacer()
                Text("\(model.freeScans.count) this session").bodyStyle(12, color: Theme.textModerate)
            }
            ScrollView {
                VStack(spacing: 4) {
                    ForEach(model.freeScans) { s in
                        HStack(spacing: 12) {
                            Color.clear.frame(width: 24, height: 1)
                            ZStack {
                                Rectangle().fill(Theme.surfaceSubtle)
                                if let t = s.thumb { Image(decorative: t, scale: 1).resizable().scaledToFill() }
                            }
                            .frame(width: 40, height: 40).clipped()
                            .contentShape(Rectangle()).onTapGesture { model.freeLightbox = s.label }
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Free scan").labelStyle(10, color: Theme.textModerate)
                                Text(s.name).bodyStyle(13)
                            }
                            Spacer(minLength: 0)
                            Button { model.trashFreeScan(s) } label: {
                                Image(systemName: "xmark").font(.system(size: 16, weight: .light)).frame(width: 24, height: 24)
                            }.buttonStyle(.plain).help("Move both files to the Trash")
                        }
                        .padding(.horizontal, 8).padding(.vertical, 6)
                    }
                    HStack(spacing: 12) {   // target: next scan
                        Color.clear.frame(width: 24, height: 1)
                        Rectangle().strokeBorder(Theme.textModerate, style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(width: 40, height: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Free scan").labelStyle(10, color: Theme.textModerate)
                            Text(model.fileName).bodyStyle(13)
                        }
                        Spacer(minLength: 0)
                        Text("Next scan").bodyStyle(12).padding(.horizontal, 4).padding(.vertical, 2).background(Color.black.opacity(0.08))
                    }
                    .padding(.horizontal, 8).padding(.vertical, 6)
                    .background(Theme.surfaceHover).overlay(Rectangle().stroke(Theme.divider, lineWidth: 1))
                }
            }
            .frame(maxHeight: 290)
        }
    }
}

/// Lightbox of a free scan
struct FreeLightbox: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        if let u = model.freeLightbox {
            ZStack {
                Color.black.opacity(0.48).ignoresSafeArea().onTapGesture { model.freeLightbox = nil }
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Free scan").labelStyle(10, color: Theme.textModerate)
                            Text(u.deletingPathExtension().lastPathComponent).bodyStyle(14)
                        }
                        Spacer()
                        Button { model.freeLightbox = nil } label: { Image(systemName: "xmark").font(.system(size: 20, weight: .light)) }
                            .buttonStyle(.plain).keyboardShortcut(.escape, modifiers: [])
                    }
                    ZStack {
                        Rectangle().fill(Theme.surfaceSubtle)
                        if let img = NSImage(contentsOf: u) { Image(nsImage: img).resizable().scaledToFit() }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .padding(.horizontal, 24).padding(.vertical, 16).background(Theme.surfaceBase).padding(40)
            }
        }
    }
}

/// Right column of the Samples tab: draft head, clip slots (drop targets), Export pinned at the bottom, status
struct SamplesColumn: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var scanner: ScannerController
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            DraftHead(drafts: model.drafts)
            if model.drafts.draft != nil {
                DraftDetail(drafts: model.drafts, session: model.session, kind: .clips).frame(maxHeight: .infinity, alignment: .top)
            } else {
                Text("Pick a draft on the left").bodyStyle(14, color: Theme.textModerate)
                Spacer(minLength: 0)
            }
            ExportPanel(session: model.session, drafts: model.drafts, jobs: model.jobs)
            Text(model.drafts.signIn.isSignedIn ? "Signed in" : "Signed out").bodyStyle(12, color: Theme.textModerate)
        }
        .padding(24)
        .frame(maxHeight: .infinity, alignment: .top)
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
            HStack(spacing: 12) {   // caption row (Figma 2423:4111): Cancel next to it while scanning
                ScanCaption(text: model.caption, busy: scanner.busy, progress: scanner.progressInfo)
                if scanner.busy {
                    Button("Cancel") { scanner.cancel() }.buttonStyle(ZButtonStyle(primary: false))
                        .keyboardShortcut(.escape, modifiers: [])
                }
            }
            if model.sideMM != nil {   // preview tools (Figma 2438:1771)
                HStack(spacing: 16) {
                    Button("Center") { model.centerRecord() }
                        .buttonStyle(ZButtonStyle(primary: false))
                        .disabled(model.preview == nil)
                        .keyboardShortcut("e", modifiers: .command)
                        .help("Put the record in the middle of the guide (⌘E)")
                    Button(model.turning ? "Reading the label…" : "Turn by itself") { model.turnFromPreview() }
                        .buttonStyle(ZButtonStyle(primary: false))
                        .disabled(model.preview == nil || model.turning)
                        .help("Read the label text once and turn the record upright (⌘Z undoes)")
                }
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

/// The caption with the scan percent: the only view that redraws on progress
struct ScanCaption: View {
    let text: String
    let busy: Bool
    @ObservedObject var progress: ScanProgress
    var body: some View {
        Text(busy ? "\(text) · \(Int(progress.value * 100))%" : text)
            .bodyStyle(14, color: Theme.textModerate).lineLimit(2).multilineTextAlignment(.center)
    }
}
