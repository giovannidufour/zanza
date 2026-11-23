import SwiftUI
import UniformTypeIdentifiers

/// `scanner tabs` (0141): Scans / Samples switch the centre and right columns only (⌘1 / ⌘2)
struct ScannerTabs: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        HStack(spacing: 8) {
            Button("Scans") { model.tab = .scans }.buttonStyle(ZButtonStyle(primary: model.tab == .scans))
                .keyboardShortcut("1", modifiers: .command)
            Button("Samples") { model.tab = .samples }.buttonStyle(ZButtonStyle(primary: model.tab == .samples))
                .keyboardShortcut("2", modifiers: .command)
            Spacer()
        }
    }
}

func timeText(_ t: Double) -> String { String(format: "%d:%02d", Int(t) / 60, Int(t) % 60) }

/// `waveform`: bars from the peaks; the part before `cut` (0…1) is shaded (Trim silence), `played` (0…1) is darker
struct Waveform: View {
    let peaks: [Float]
    var cut: Double = 0
    var played: Double = 0
    var body: some View {
        GeometryReader { g in
            Canvas { ctx, size in
                guard !peaks.isEmpty else { return }
                let n = peaks.count, w = size.width / CGFloat(n)
                for (i, p) in peaks.enumerated() {
                    let x = CGFloat(i) * w, h = max(1, CGFloat(p) * size.height)
                    let r = CGRect(x: x, y: (size.height - h) / 2, width: max(1, w * 0.6), height: h)
                    let f = Double(i) / Double(n)
                    ctx.fill(Path(r), with: .color(f < cut ? Theme.textModerate.opacity(0.4) : (f < played ? Theme.textStrong : Theme.textStrong.opacity(0.8))))
                }
                if cut > 0 { ctx.fill(Path(CGRect(x: 0, y: 0, width: size.width * cut, height: size.height)), with: .color(Color.black.opacity(0.08))) }
            }
            .frame(width: g.size.width, height: g.size.height)
        }
    }
}

/// Centre of the Samples tab: the session (local copies of the Zoom files) and the preview player
struct SessionPanel: View {
    @ObservedObject var session: SessionModel
    @EnvironmentObject var model: AppModel
    @State private var dropping = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Session").labelStyle(12)
                    Text(session.clips.isEmpty ? "No recordings yet"
                         : "\(session.sourceLabel.isEmpty ? "" : session.sourceLabel + " · ")\(session.clips.count) clips · \(session.notAssignedCount) not assigned")
                        .bodyStyle(12, color: Theme.textModerate)
                }
                Spacer()
                Button("Import…") { session.chooseImport() }.buttonStyle(ZButtonStyle(primary: false))
            }
            if session.clips.isEmpty {
                ZStack {
                    Rectangle().strokeBorder(Theme.textModerate, style: StrokeStyle(lineWidth: 1, dash: [6, 6]))
                    VStack(spacing: 8) {
                        Image(systemName: "sdcard").font(.system(size: 32, weight: .light))
                        Text("Drop the Zoom's folder or some recordings here").bodyStyle(16)
                        Text("They are copied to the Mac: the card is never written, renamed or emptied.").bodyStyle(12, color: Theme.textModerate)
                    }
                }
                .frame(maxHeight: .infinity)
            } else {
                Toggle(isOn: $session.onlyUnassigned) { Text("Only not assigned").bodyStyle(14) }.toggleStyle(.checkbox)
                ScrollView {
                    VStack(spacing: 2) {
                        ForEach(session.clips.filter { !session.onlyUnassigned || session.assignments[$0.file] == nil }) { c in
                            SessionRow(clip: c, session: session)
                        }
                    }
                }
                .frame(maxHeight: .infinity)
                ClipPreview(session: session)
            }
            if let m = session.message { Text(m).bodyStyle(12, color: Theme.textModerate) }
        }
        .background(dropping ? Theme.surfaceHover : Color.clear)
        .dropDestination(for: URL.self) { urls, _ in session.importItems(urls); return true } isTargeted: { dropping = $0 }
    }
}

/// `session clip`: original name, length, waveform; assigned = grey with "SKU · A1"; drag it onto a clip slot
struct SessionRow: View {
    let clip: SessionClip
    @ObservedObject var session: SessionModel
    var body: some View {
        let a = session.assignments[clip.file]
        let isPlaying = session.playing && session.selected == clip.file
        HStack(spacing: 12) {
            Image(systemName: "line.3.horizontal").frame(width: 20)
            Button { session.select(clip.file); session.togglePlay() } label: {
                Image(systemName: isPlaying ? "pause.fill" : "play.fill").font(.system(size: 16)).frame(width: 20)
            }.buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 1) {
                Text((clip.file as NSString).deletingPathExtension).bodyStyle(14)
                Text(timeText(clip.duration)).bodyStyle(12, color: Theme.textModerate)
            }
            .frame(width: 110, alignment: .leading)
            Waveform(peaks: clip.peaks, cut: clip.duration > 0 ? clip.trimStart / clip.duration : 0).frame(height: 24)
            if let a {
                Text("\(a.sku) · \(a.label)").bodyStyle(12).padding(.horizontal, 4).padding(.vertical, 2).background(Color.black.opacity(0.08))
            }
        }
        .foregroundColor(Theme.textStrong)
        .opacity(a == nil ? 1 : 0.5)
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(session.selected == clip.file ? Theme.surfaceHover : Color.clear)
        .contentShape(Rectangle())
        .onTapGesture { session.select(clip.file) }
        .draggable(clip.file) {   // drag preview
            Text((clip.file as NSString).deletingPathExtension).bodyStyle(14).padding(8).background(Theme.surfacePage)
        }
    }
}

/// `clip preview`: the selected clip large; Space plays, click the waveform to seek; Trim silence (start only)
struct ClipPreview: View {
    @ObservedObject var session: SessionModel
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let c = session.current {
                let a = session.assignments[c.file]
                HStack {
                    Text("\((c.file as NSString).deletingPathExtension) · \(a.map { "\($0.sku) · \($0.label)" } ?? "not assigned")").labelStyle(12)
                    Spacer()
                    Text("\(timeText(session.position)) / \(timeText(c.duration))").bodyStyle(12, color: Theme.textModerate)
                }
                GeometryReader { g in
                    Waveform(peaks: c.peaks, cut: c.duration > 0 ? c.trimStart / c.duration : 0,
                             played: c.duration > 0 ? session.position / c.duration : 0)
                        .contentShape(Rectangle())
                        .gesture(DragGesture(minimumDistance: 0).onChanged { v in
                            session.seek(to: Double(v.location.x / g.size.width) * c.duration)
                        })
                }
                .frame(height: 90)
                HStack(spacing: 12) {
                    Button { session.togglePlay() } label: {
                        Image(systemName: session.playing ? "pause.fill" : "play.fill").font(.system(size: 20))
                    }.buttonStyle(.plain).help("Play / pause (Space)")
                    Text(c.trimStart > 0 ? "Start trimmed at \(String(format: "%.2f", c.trimStart)) s" : "Space plays · ← → 5 s")
                        .bodyStyle(12, color: Theme.textModerate)
                    Spacer()
                    if c.trimStart > 0 {
                        Button("Undo trim") { session.undoTrim() }.buttonStyle(ZButtonStyle(primary: false))
                    } else {
                        Button("Trim silence") { session.trimSilence() }.buttonStyle(ZButtonStyle(primary: false))
                            .help("Moves the start to the first sound (−45 dBFS), keeps 50 ms before it. The end is never trimmed.")
                    }
                }
            } else {
                Text("Click a recording to listen to it").bodyStyle(14, color: Theme.textModerate)
            }
        }
        .padding(16)
        .background(Theme.surfaceBase)
        .overlay(Rectangle().stroke(Theme.divider, lineWidth: 1))
    }
}

/// `clip slot` (0141): filled (from STE-003 · 0:58, play, x) · empty (Drop to assign); drop a session clip on it
struct ClipSlotRow: View {
    let slot: ClipTarget
    let clip: SessionClip?
    @ObservedObject var session: SessionModel
    @ObservedObject var drafts: DraftSession
    @State private var over = false
    var body: some View {
        HStack(spacing: 12) {
            Color.clear.frame(width: 24, height: 1)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(slot.label) · Side \(slot.role.prefix(1).uppercased())").labelStyle(10, color: Theme.textModerate)
                Text(slot.name).bodyStyle(13, color: clip == nil ? Theme.textModerate : Theme.textStrong).fixedSize(horizontal: false, vertical: true)
                Text(clip.map { "From \(($0.file as NSString).deletingPathExtension) · \(timeText($0.duration))" } ?? "Drop to assign")
                    .bodyStyle(12, color: Theme.textModerate)
                if clip != nil {   // per clip: also a WAV (archive / DJ), off by default
                    Toggle(isOn: Binding(get: { session.wantsWAV(slot: slot.name) }, set: { session.setWAV($0, slot: slot.name) })) {
                        Text("WAV").bodyStyle(12)
                    }
                    .toggleStyle(.checkbox)
                }
            }
            Spacer(minLength: 0)
            if let clip {
                Button { session.select(clip.file); session.togglePlay() } label: {
                    Image(systemName: session.playing && session.selected == clip.file ? "pause.fill" : "play.fill")
                }.buttonStyle(.plain)
                Button { session.unassign(slot: slot.name) } label: {
                    Image(systemName: "xmark").font(.system(size: 16, weight: .light)).frame(width: 24, height: 24)
                }.buttonStyle(.plain).help("Unassign (⌘Z undoes)")
            }
        }
        .foregroundColor(Theme.textStrong)
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(over ? Theme.surfaceHover : Color.clear)
        .overlay(Rectangle().stroke(over ? Theme.divider : Color.clear, lineWidth: 1))
        .dropDestination(for: String.self) { files, _ in
            guard let f = files.first, let d = drafts.draft else { return false }
            session.assign(f, to: Assignment(draftID: d.id, sku: d.skuText, role: slot.role, label: slot.label, name: slot.name))
            return true
        } isTargeted: { over = $0 }
    }
}

/// Right column of the Samples tab: folders and Export (WAV + MP3 320, tags, label cover). No normalize (Gio).
struct ExportPanel: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var session: SessionModel
    @ObservedObject var drafts: DraftSession
    var body: some View {
        let assigned = drafts.clips.filter { session.clip(assignedTo: $0.name) != nil }
        let empty = drafts.clips.filter { session.clip(assignedTo: $0.name) == nil }.map(\.label)
        VStack(alignment: .leading, spacing: 16) {
            Text("Export").labelStyle(12)
            FolderField(title: "MP3 320 kbps to", url: model.mp3Folder) { model.chooseExportFolder(mp3: true) }
            FolderField(title: "WAV to (clips with WAV ticked)", url: model.wavFolder) { model.chooseExportFolder(mp3: false) }
            Text("Every assigned clip becomes an MP3; a WAV too when its WAV box is ticked. Files are named as the slot. Each file gets the tags (title, artist, album, label, year, genre, track A1/B1, SKU in the comment) and the cover: the label scan of that side, square.")
                .bodyStyle(12, color: Theme.textModerate).fixedSize(horizontal: false, vertical: true)
            if AudioExport.lame == nil {
                Text("LAME is not installed, so no MP3: install it with Homebrew (brew install lame).").bodyStyle(12, color: Theme.alert)
            }
            Button { model.exportClips() } label: {
                Text(model.exporting ? "Exporting…" : "Export \(assigned.count) clip\(assigned.count == 1 ? "" : "s")").frame(maxWidth: .infinity)
            }
            .buttonStyle(ZButtonStyle())
            .disabled(assigned.isEmpty || model.exporting || drafts.draft == nil)
            Text(drafts.draft == nil ? "Open a draft on the left"
                 : "\(assigned.count) clips assigned" + (empty.isEmpty ? "" : " · \(empty.joined(separator: ", ")) still empty"))
                .bodyStyle(12, color: Theme.textModerate)
            if let r = model.exportReport { Text(r).bodyStyle(12).fixedSize(horizontal: false, vertical: true) }
        }
    }
}
