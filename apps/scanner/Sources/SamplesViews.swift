import SwiftUI
import Combine
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
            Button("Price") { model.tab = .price }.buttonStyle(ZButtonStyle(primary: model.tab == .price))   // 0196
                .keyboardShortcut("3", modifiers: .command)
            Spacer()
        }
    }
}

func timeText(_ t: Double) -> String { String(format: "%d:%02d", Int(t) / 60, Int(t) % 60) }

/// `waveform` (Figma 2446:26014): played bars text/strong, unplayed waveform-unplayed; the start silence (before
/// `cut`) and end silence (after `cutEnd`) in waveform-silence (red), at 32% once the silence is removed.
/// 0173: one tone, 480 thin bars, height = (bar peak / clip peak)² so the peak differences show
struct Waveform: View {
    let peaks: [Float]
    var cut: Double = 0
    var cutEnd: Double = 1
    var played: Double = 0
    var removed = false
    /// small row waveforms have no playhead: all bars "played" (black)
    var tone = false
    var body: some View {
        GeometryReader { g in
            Canvas { ctx, size in
                guard !peaks.isEmpty else { return }
                let n = peaks.count, w = size.width / CGFloat(n)
                for (i, p) in peaks.enumerated() {
                    let x = CGFloat(i) * w, h = max(1, CGFloat(p) * size.height)
                    let r = CGRect(x: x, y: (size.height - h) / 2, width: max(1, w * 0.5), height: h)
                    let f = (Double(i) + 0.5) / Double(n)
                    let color: Color = f < cut || f > cutEnd
                        ? Theme.waveformSilence.opacity(removed ? 0.32 : 1)
                        : (tone || f < played ? Theme.waveformPlayed : Theme.waveformUnplayed)
                    ctx.fill(Path(r), with: .color(color))
                }
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
                if !session.clips.isEmpty {
                    Button("Clear") { model.clearSession() }.buttonStyle(ZButtonStyle(primary: false))
                        .help("Empty the list (the local copies go to the Trash; the card is never touched)")
                }
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
                if session.current != nil { ClipPreview(session: session) }   // no placeholder (Gio)
            }
            if let m = session.message { Text(m).bodyStyle(12, color: Theme.textModerate) }
        }
        .background(dropping ? Theme.surfaceHover : Color.clear)
        .dropDestination(for: URL.self) { urls, _ in session.importItems(urls); return true } isTargeted: { dropping = $0 }
    }
}

/// `session clip`: original name, length, waveform; assigned = grey with "SKU · A1"; drag it onto a clip slot
struct SessionRow: View {
    @EnvironmentObject var model: AppModel
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
                if let a {   // the track it is assigned to: "A1 · Artist - Title" (Figma `track`)
                    let track = [a.artist, a.title].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " - ")
                    Text(track.isEmpty ? a.label : "\(a.label) · \(track)").bodyStyle(12, color: Theme.textModerate)
                        .lineLimit(1).truncationMode(.tail).help(track)
                }
            }
            .frame(width: 220, alignment: .leading)
            Waveform(peaks: clip.peaks, cut: clip.duration > 0 ? clip.trimStart / clip.duration : 0,
                     cutEnd: clip.duration > 0 && clip.trimEnd > 0 ? clip.trimEnd / clip.duration : 1,
                     removed: clip.silenceRemoved, tone: true).frame(height: 24)
            if let a {
                Text("\(a.sku) · \(a.label)").bodyStyle(12).padding(.horizontal, 4).padding(.vertical, 2).background(Color.black.opacity(0.08))
            }
            Button { session.remove(clip.file); model.toasts.show("Removed from the session") { session.undo(); return nil } } label: {   // out of the list; ⌘Z restores it
                Image(systemName: "xmark").font(.system(size: 14, weight: .light)).frame(width: 24, height: 24).contentShape(Rectangle())
            }
            .buttonStyle(.plain).help("Remove from the list (the copy goes to the Trash, ⌘Z restores it)")
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

/// `clip preview` (Figma 2446:26790): the selected clip large with its start and end silence shaded (−45 dBFS, 50 ms
/// kept). Three plays: red = only the start silence, black = the clip, red = only the end silence (Gio: to check that
/// what is cut is not part of the track). Remove silence cuts both ends for export; Undo restores. No fades.
struct ClipPreview: View {
    @ObservedObject var session: SessionModel
    @ObservedObject var playhead: PlayheadRef
    init(session: SessionModel) { self.session = session; self.playhead = PlayheadRef(session.playhead) }
    var body: some View {
        if let c = session.current {
            let a = session.assignments[c.file]
            let d = max(c.duration, 0.001)
            let startSil = c.soundStart ?? 0, endSil = c.soundEnd.map { c.duration - $0 } ?? 0
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("\((c.file as NSString).deletingPathExtension) · \(a.map { "\($0.sku) · \($0.label)" } ?? "not assigned")").labelStyle(12)
                    Spacer()
                    Text("\(timeText(session.position)) / \(timeText(c.duration))").bodyStyle(12, color: Theme.textModerate)
                }
                GeometryReader { g in
                    Waveform(peaks: c.peaks,
                             cut: (c.silenceRemoved ? c.trimStart : startSil) / d,
                             cutEnd: (c.silenceRemoved ? (c.trimEnd > 0 ? c.trimEnd : c.duration) : (c.soundEnd ?? c.duration)) / d,
                             played: session.position / d, removed: c.silenceRemoved)
                        .contentShape(Rectangle())
                        .gesture(DragGesture(minimumDistance: 0).onChanged { v in
                            session.seek(to: Double(v.location.x / g.size.width) * c.duration)
                        })
                }
                .frame(height: 90)
                HStack(spacing: 12) {
                    // silence lengths on the outer side of the red buttons, 2 decimals
                    Text(String(format: "%.2f s", startSil)).bodyStyle(12, color: Theme.waveformSilence)
                    playButton(.startSilence, red: true, help: "Play only the start silence").disabled(startSil < 0.01)
                    playButton(.clip, red: false, help: "Play the clip (Space)")
                    playButton(.endSilence, red: true, help: "Play only the end silence").disabled(endSil < 0.01)
                    Text(String(format: "%.2f s", endSil)).bodyStyle(12, color: Theme.waveformSilence)
                    Text(c.soundStart == nil ? "Reading the silence…" : (c.silenceRemoved ? "Silence removed" : "Silence at start and end"))
                        .bodyStyle(12, color: Theme.textModerate)
                    Spacer()
                    if c.silenceRemoved {
                        Button("Undo") { session.undoTrim() }.buttonStyle(ZButtonStyle(primary: false))
                    } else {
                        Button("Remove silence") { session.removeSilence() }.buttonStyle(ZButtonStyle(primary: false))
                            .disabled(c.soundStart == nil || (startSil < 0.01 && endSil < 0.01))
                    }
                }
            }
            .padding(16)
            .background(Theme.surfaceBase)
            .overlay(Rectangle().stroke(Theme.divider, lineWidth: 1))
        }
    }

    func playButton(_ part: SessionModel.Part, red: Bool, help: String) -> some View {
        Button { session.play(part) } label: {
            Image(systemName: session.playing && session.playingPart == part ? "pause.fill" : "play.fill")
                .font(.system(size: red ? 16 : 22))
                .foregroundColor(red ? Theme.alert : Theme.textStrong)   // surface/alert (backend)
                .frame(width: 28, height: 28).contentShape(Rectangle())
        }
        .buttonStyle(.plain).help(help)
    }
}

/// `clip slot` (0141): filled (from STE-003 · 0:58, play, x) · empty (Drop to assign); drop a session clip on it
struct ClipSlotRow: View {
    @EnvironmentObject var model: AppModel
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
                if clip != nil {   // per clip, off by default: also a WAV (archive / DJ) and a square video (0177)
                    HStack(spacing: 8) {
                        Toggle(isOn: Binding(get: { session.wantsWAV(slot: slot.name) }, set: { session.setWAV($0, slot: slot.name) })) {
                            Text("WAV").bodyStyle(12)
                        }
                        .toggleStyle(.checkbox)
                        Toggle(isOn: Binding(get: { session.wantsVideo(slot: slot.name) }, set: { session.setVideo($0, slot: slot.name) })) {
                            Text("Video").bodyStyle(12)
                        }
                        .toggleStyle(.checkbox)
                        .help("Square 1080 video: the label of this side, still, with this clip (Instagram feed and Reels)")
                    }
                }
            }
            Spacer(minLength: 0)
            if let clip {
                Button { session.select(clip.file); session.togglePlay() } label: {
                    Image(systemName: session.playing && session.selected == clip.file ? "pause.fill" : "play.fill")
                }.buttonStyle(.plain)
                Button { model.unassignClip(slot.name) } label: {
                    Image(systemName: "xmark").font(.system(size: 16, weight: .light)).frame(width: 24, height: 24)
                }.buttonStyle(.plain).help("Unassign: its exported files go to the Trash (⌘Z re-assigns and rewrites them)")
            }
        }
        .foregroundColor(Theme.textStrong)
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(over ? Theme.surfaceHover : Color.clear)
        .overlay(Rectangle().stroke(over ? Theme.divider : Color.clear, lineWidth: 1))
        .dropDestination(for: String.self) { files, _ in
            guard let f = files.first, let d = drafts.draft else { return false }
            session.assign(f, to: Assignment(draftID: d.id, sku: d.skuText, role: slot.role, label: slot.label, name: slot.name,
                                             artist: slot.artist, title: slot.title))
            return true
        } isTargeted: { over = $0 }
    }
}

/// Right column of the Samples tab: folders and Export (WAV + MP3 320, tags, label cover). +8 dB boost, peak ≤ −2 dBFS (0157); no normalize.
struct ExportPanel: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var session: SessionModel
    @ObservedObject var drafts: DraftSession
    @ObservedObject var jobs: JobQueue
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Export · automatic").labelStyle(12)
            FolderField(title: "MP3 320 kbps to", url: model.mp3Folder) { model.chooseExportFolder(.mp3) }
            FolderField(title: "WAV to (clips with WAV ticked)", url: model.wavFolder) { model.chooseExportFolder(.wav) }
            FolderField(title: "Videos to (clips with Video ticked)", url: model.videoFolder) { model.chooseExportFolder(.video) }
            Text("Assigned clips are written by themselves and kept up to date (trim, WAV, label scan as cover, tags). Video ticked: also <name>.mp4, square 1080, the label of that side with the clip. Unassigning moves their files to the Trash.")
                .bodyStyle(12, color: Theme.textModerate).fixedSize(horizontal: false, vertical: true)
            if AudioExport.lame == nil {
                Text("LAME is not installed, so no MP3: install it with Homebrew (brew install lame).").bodyStyle(12, color: Theme.alert)
            }
            Text(status).bodyStyle(12).fixedSize(horizontal: false, vertical: true)
        }
    }
    /// "Up to date · 2 clips" / "Exporting 1 of 2…" / "A1 exported without cover: scan Label A"
    var status: String {
        guard let d = drafts.draft else { return "Open a draft on the left" }
        if let j = jobs.jobs.first(where: { $0.draftID == d.id && $0.kind == .export && ($0.state == .running || $0.state == .waiting) }) {
            return j.state == .waiting ? "Waiting to export…" : "Exporting \(j.detail)…"
        }
        let assigned = drafts.clips.filter { session.clip(assignedTo: $0.name) != nil }
        if assigned.isEmpty { return "Nothing assigned yet" }
        let missing = assigned.compactMap { model.exports[$0.name]?.missing }
        if !missing.isEmpty {
            return missing.map { $0.replacingOccurrences(of: " needs the ", with: " exported without cover: scan ") }.joined(separator: " · ")
        }
        return "Up to date · \(assigned.count) clip\(assigned.count == 1 ? "" : "s")"
    }
}

/// `activity bar` (0143): the running (or last) job, a 240 px bar and "+N waiting"; Show in Finder when done,
/// the reason and Retry when failed. Hidden until a job has run in this session. Clicking selects that draft.
/// One line per lane (0193): an export and a push running together show as two lines, export first.
struct ActivityBar: View {
    @ObservedObject var jobs: JobQueue
    @ObservedObject var drafts: DraftSession
    var body: some View {
        let lines = jobs.shown
        if !lines.isEmpty {
            VStack(spacing: 0) {
                ForEach(lines) { j in line(j, waiting: lines.count > 1 ? jobs.waitingCount(j.kind) : jobs.waitingCount) }
            }
        }
    }
    func line(_ j: JobQueue.Job, waiting: Int) -> some View {
        HStack(spacing: 12) {
            Text(text(j)).bodyStyle(12).lineLimit(1)
            if j.state == .running || j.state == .waiting {
                ZStack(alignment: .leading) {
                    Rectangle().fill(Color.black.opacity(0.08))
                    Rectangle().fill(Theme.textStrong).frame(width: 240 * j.progress)
                }
                .frame(width: 240, height: 4)
            }
            if waiting > 0 { Text("+\(waiting) waiting").bodyStyle(12, color: Theme.textModerate) }
            Spacer()
            if j.state == .done, let f = j.folder {
                Button("Show in Finder") { NSWorkspace.shared.activateFileViewerSelecting([f]) }.buttonStyle(.plain).bodyStyle(12).underline()
            }
            if case .failed = j.state { Button("Retry") { jobs.retry(j.id) }.buttonStyle(.plain).bodyStyle(12).underline() }
        }
        .padding(.horizontal, 24).frame(height: 36)
        .background(Theme.surfacePage)
        .overlay(Rectangle().fill(Theme.divider).frame(height: 1), alignment: .top)
        .contentShape(Rectangle())
        .onTapGesture { if let d = drafts.results.first(where: { $0.id == j.draftID }) { drafts.pick(d) } }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.updatesFrequently)
    }
    func text(_ j: JobQueue.Job) -> String {
        let verb = j.kind == .export ? "Exporting" : "Pushing"
        switch j.state {
        case .waiting: return "Waiting · SKU \(j.sku)"
        case .running: return "\(verb) SKU \(j.sku)" + (j.detail.isEmpty ? "" : " · \(j.detail)")
        case .done: return "SKU \(j.sku) · \(j.result)"
        case .failed(let m): return "SKU \(j.sku) · \(j.kind == .export ? "Export" : "Push") failed: \(m)"
        }
    }
}

/// `job progress` under the chips of a draft row: "Exporting 1 of 2 · 45%", "Waiting to export", "Exported 2 clips",
/// "Export failed · retry"; gone once the done row is selected again
struct JobLine: View {
    let job: JobQueue.Job
    @ObservedObject var jobs: JobQueue
    var body: some View {
        let what = job.kind == .export ? "export" : "push"
        Group {
            switch job.state {
            case .waiting: Text("Waiting to \(what)")
            case .running: Text("\(job.kind == .export ? "Exporting" : "Pushing") \(job.detail) · \(Int(job.progress * 100))%")
            case .done: Text(job.result)
            case .failed: Button("\(what.capitalized) failed · retry") { jobs.retry(job.id) }.buttonStyle(.plain)
            }
        }
        .bodyStyle(11, color: Theme.textModerate).lineLimit(2)
    }
}

/// Observing the session's playhead from the preview only
final class PlayheadRef: ObservableObject {
    let source: Playhead
    private var sub: Any?
    init(_ p: Playhead) { source = p; sub = p.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() } }
}
