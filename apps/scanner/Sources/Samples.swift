import AppKit
import AVFoundation

/// One recording of the session (0141): a COPY of a file from the Zoom, original name kept.
struct SessionClip: Identifiable, Equatable {
    var id: String { file }          // the file name in the session folder
    let file: String
    let url: URL
    var duration: Double = 0
    var peaks: [Float] = []          // 0…1, for the waveform
    var trimStart: Double = 0        // seconds cut at the start (Remove silence), 0 = none
    var trimEnd: Double = 0          // where the clip ends after Remove silence (seconds), 0 = the real end
    /// detected silence (−45 dBFS, 50 ms kept): sound starts at `soundStart`, ends at `soundEnd`; nil = not analysed
    var soundStart: Double?
    var soundEnd: Double?
    var silenceRemoved: Bool { trimStart > 0 || trimEnd > 0 }
    var end: Double { trimEnd > 0 ? trimEnd : duration }
}

/// Where a clip was dropped: the clip slot of a draft (name from scan-targets, never built here)
struct Assignment: Codable, Equatable {
    let draftID: String
    let sku: String
    let role: String                 // a1, b1… (clip role)
    let label: String                // A1, B1…
    let name: String                 // <sku>_<role>_<slug>
    var wav: Bool? = false           // also a WAV for this clip (Gio: per clip, off by default)
    var artist: String? = nil        // the line it is assigned to, shown under the clip in the session (Gio)
    var title: String? = nil
    var wantsWAV: Bool { wav ?? false }
}

/// The Samples session: local copies of the Zoom files, assignments, trims; kept across restarts until cleared.
final class SessionModel: ObservableObject {
    @Published var clips: [SessionClip] = []
    @Published var assignments: [String: Assignment] = [:]     // clip file → slot
    @Published var onlyUnassigned = false
    @Published var selected: String?                            // clip in the preview
    @Published var playing = false
    /// The playhead lives in its own object, observed only by the preview: publishing it here 30 times a second
    /// redrew the whole window while a clip played
    let playhead = Playhead()
    var position: Double {
        get { playhead.value }
        set { if newValue != playhead.value { playhead.value = newValue } }
    }
    @Published var sourceLabel = ""                             // where the session came from (folder name)
    @Published var message: String?

    private var player: AVAudioPlayer?
    private var timer: Timer?
    private var undoStack: [[String: Assignment]] = []
    private var keyMonitor: Any?

    static let folder: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Zanza Scanner/Session", isDirectory: true)
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }()
    private static var stateFile: URL { folder.appendingPathComponent(".session.json") }
    static let audioTypes: Set<String> = ["wav", "wave", "aif", "aiff", "mp3", "m4a", "flac", "caf"]

    init() {
        load()
        // Space = play / pause, ←/→ = 5 s, but never while typing in a text field
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] e in
            guard let self, self.active, self.selected != nil,
                  !(NSApp.keyWindow?.firstResponder is NSText), e.modifierFlags.intersection([.command, .option, .control]).isEmpty
            else { return e }
            switch e.keyCode {
            case 49: self.togglePlay(); return nil
            case 123: self.seek(to: self.position - 5); return nil
            case 124: self.seek(to: self.position + 5); return nil
            default: return e
            }
        }
    }
    /// true while the Samples tab is shown
    var active = false

    // MARK: Import (copies, the card is never written)

    func importItems(_ urls: [URL]) {
        var files: [URL] = []
        for u in urls {
            var isDir: ObjCBool = false
            if FileManager.default.fileExists(atPath: u.path, isDirectory: &isDir), isDir.boolValue {
                if sourceLabel.isEmpty { sourceLabel = u.lastPathComponent }
                let e = FileManager.default.enumerator(at: u, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles])
                while let f = e?.nextObject() as? URL { if Self.audioTypes.contains(f.pathExtension.lowercased()) { files.append(f) } }
            } else if Self.audioTypes.contains(u.pathExtension.lowercased()) { files.append(u) }
        }
        guard !files.isEmpty else { message = "No audio files there"; return }
        message = "Copying \(files.count) files…"
        DispatchQueue.global(qos: .userInitiated).async {
            var copied: [URL] = []
            for f in files.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
                var dest = Self.folder.appendingPathComponent(f.lastPathComponent)
                // same name already in the session (another card / folder): keep both
                var n = 2
                while FileManager.default.fileExists(atPath: dest.path) {
                    if let a = try? FileManager.default.attributesOfItem(atPath: dest.path)[.size] as? Int,
                       let b = try? FileManager.default.attributesOfItem(atPath: f.path)[.size] as? Int, a == b { break }   // same file again
                    dest = Self.folder.appendingPathComponent("\(f.deletingPathExtension().lastPathComponent) \(n).\(f.pathExtension)"); n += 1
                }
                if !FileManager.default.fileExists(atPath: dest.path) { try? FileManager.default.copyItem(at: f, to: dest) }
                copied.append(dest)
            }
            DispatchQueue.main.async { self.message = nil; self.reloadFiles(); self.save() }
        }
    }

    func chooseImport() {
        let p = NSOpenPanel()
        p.canChooseDirectories = true; p.canChooseFiles = true; p.allowsMultipleSelection = true
        p.message = "Choose the Zoom's folder or some recordings: they are copied, the card is not touched"
        p.prompt = "Import"
        if p.runModal() == .OK { importItems(p.urls) }
    }

    /// Clear the list: local copies to the Trash (a file a job still reads waits until the job ends). Undo puts back
    /// the files, rows, assignments and trims (0149).
    func clear(keeping inUse: (String) -> Bool = { _ in false }) -> (() -> String?) {
        stop()
        var t = Trashed()
        let before = (clips: clips, assignments: assignments, source: sourceLabel)
        for c in clips { if inUse(c.file) { pendingRemoval.insert(c.url) } else { t.trash(c.url) } }
        clips = []; assignments = [:]; selected = nil; sourceLabel = ""; undoStack = []; removed = []
        save()
        return { [weak self] in
            guard let self else { return nil }
            if let e = t.restore() { return e }
            for c in before.clips { self.pendingRemoval.remove(c.url) }
            self.clips = before.clips; self.assignments = before.assignments; self.sourceLabel = before.source
            self.save()
            return nil
        }
    }

    /// x on a session clip: out of the list, its copy to the Trash, its slot emptied; ⌘Z restores it
    var inJob: (String) -> Bool = { _ in false }
    private var pendingRemoval: Set<URL> = []
    private var removed: [(clip: SessionClip, assignment: Assignment?, trashed: URL?)] = []
    func remove(_ file: String) {
        guard let c = clips.first(where: { $0.file == file }) else { return }
        if selected == file { stop(); selected = nil }
        let a = assignments[file]
        var trashed: URL?
        if inJob(file) { pendingRemoval.insert(c.url) }
        else { var t = Trashed(); t.trash(c.url); trashed = t.moves.first?.trashed }
        removed.append((c, a, trashed))
        undoStack.append(assignments)
        assignments[file] = nil
        clips.removeAll { $0.file == file }
        save()
    }
    func flushPendingRemovals() {
        for u in pendingRemoval where !clips.contains(where: { $0.url == u }) { var t = Trashed(); t.trash(u) }
        pendingRemoval = []
    }

    // MARK: Files, waveforms, persistence

    private func reloadFiles() {
        let fm = FileManager.default
        let files = ((try? fm.contentsOfDirectory(at: Self.folder, includingPropertiesForKeys: nil)) ?? [])
            .filter { Self.audioTypes.contains($0.pathExtension.lowercased()) }
            .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }
        let old = Dictionary(uniqueKeysWithValues: clips.map { ($0.file, $0) })
        clips = files.map { old[$0.lastPathComponent] ?? SessionClip(file: $0.lastPathComponent, url: $0) }
        for c in clips where c.peaks.isEmpty { analyse(c) }
    }

    private func analyse(_ clip: SessionClip) {
        DispatchQueue.global(qos: .utility).async {
            guard let file = try? AVAudioFile(forReading: clip.url) else { return }
            let frames = file.length, rate = file.processingFormat.sampleRate
            let buckets = 240, per = max(1, Int(frames) / buckets)
            var peaks = [Float](repeating: 0, count: buckets)
            guard let buf = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(per)) else { return }
            for b in 0..<buckets {
                guard (try? file.read(into: buf, frameCount: AVAudioFrameCount(per))) != nil, buf.frameLength > 0 else { break }
                var m: Float = 0
                for ch in 0..<Int(buf.format.channelCount) {
                    let p = buf.floatChannelData![ch]
                    for i in 0..<Int(buf.frameLength) { m = max(m, abs(p[i])) }
                }
                peaks[b] = m
            }
            let edges = Self.soundEdges(in: clip.url)
            DispatchQueue.main.async {
                if let i = self.clips.firstIndex(where: { $0.file == clip.file }) {
                    self.clips[i].peaks = peaks; self.clips[i].duration = Double(frames) / rate
                    self.clips[i].soundStart = edges.map { max(0, $0.0 - 0.05) }
                    self.clips[i].soundEnd = edges.map { min(Double(frames) / rate, $0.1 + 0.05) }
                }
            }
        }
    }

    private struct Saved: Codable { var assignments: [String: Assignment]; var trims: [String: Double]; var source: String; var trimEnds: [String: Double]? }
    /// called after any change the exported files mirror (assignments, trims, WAV ticks): automatic export (0144)
    var onChange: (() -> Void)?

    func save() {
        defer { onChange?() }
        let s = Saved(assignments: assignments, trims: Dictionary(uniqueKeysWithValues: clips.filter { $0.trimStart > 0 }.map { ($0.file, $0.trimStart) }),
                      source: sourceLabel, trimEnds: Dictionary(uniqueKeysWithValues: clips.filter { $0.trimEnd > 0 }.map { ($0.file, $0.trimEnd) }))
        try? JSONEncoder().encode(s).write(to: Self.stateFile)
    }
    private func load() {
        reloadFiles()
        if let d = try? Data(contentsOf: Self.stateFile), let s = try? JSONDecoder().decode(Saved.self, from: d) {
            assignments = s.assignments.filter { k, _ in clips.contains { $0.file == k } }
            sourceLabel = s.source
            for (k, t) in s.trims { if let i = clips.firstIndex(where: { $0.file == k }) { clips[i].trimStart = t } }
            for (k, t) in s.trimEnds ?? [:] { if let i = clips.firstIndex(where: { $0.file == k }) { clips[i].trimEnd = t } }
        }
    }

    // MARK: Assign

    func clip(assignedTo name: String) -> SessionClip? {
        guard let file = assignments.first(where: { $0.value.name == name })?.key else { return nil }
        return clips.first { $0.file == file }
    }

    /// Drop a clip on a slot: a slot holds one clip (the old one goes back), a clip fills one slot
    func assign(_ file: String, to a: Assignment) {
        undoStack.append(assignments)
        assignments = assignments.filter { $0.value.name != a.name && $0.key != file }
        assignments[file] = a
        save()
    }
    func unassign(slot name: String) {
        undoStack.append(assignments)
        assignments = assignments.filter { $0.value.name != name }
        save()
    }
    /// The WAV tick of a filled slot, stored with its assignment
    func setWAV(_ on: Bool, slot name: String) {
        guard let k = assignments.first(where: { $0.value.name == name })?.key else { return }
        assignments[k]?.wav = on
        save()
    }
    func wantsWAV(slot name: String) -> Bool { assignments.values.first { $0.name == name }?.wantsWAV ?? false }

    func undo() {
        // the last action was a removal: bring the clip back first
        if let r = removed.last, undoStack.last != nil, assignments[r.clip.file] == nil, !clips.contains(where: { $0.file == r.clip.file }) {
            removed.removeLast()
            if let t = r.trashed { try? FileManager.default.moveItem(at: t, to: r.clip.url) }
            pendingRemoval.remove(r.clip.url)
            clips.append(r.clip)
            clips.sort { $0.file.localizedStandardCompare($1.file) == .orderedAscending }
        }
        guard let last = undoStack.popLast() else { return }
        assignments = last; save()
    }
    var canUndo: Bool { !undoStack.isEmpty }

    var notAssignedCount: Int { clips.filter { assignments[$0.file] == nil }.count }
    func assignedCount(sku: String) -> Int { assignments.values.filter { $0.sku == sku }.count }

    // MARK: Player

    func select(_ file: String) {
        if selected != file { stop(); selected = file; position = clips.first { $0.file == file }?.trimStart ?? 0 }
    }
    var current: SessionClip? { selected.flatMap { s in clips.first { $0.file == s } } }

    /// The black play: the clip (without the removed silence); red plays: only the start / end silence (Gio: to check
    /// that what is cut is not part of the track)
    enum Part { case clip, startSilence, endSilence }
    @Published var playingPart: Part?

    func togglePlay() { play(.clip) }

    func play(_ part: Part) {
        guard let c = current else { return }
        if playing && playingPart == part { player?.pause(); playing = false; playingPart = nil; return }
        if player == nil || player?.url != c.url { player = try? AVAudioPlayer(contentsOf: c.url) }
        guard let p = player else { return }
        let range: (Double, Double)
        switch part {
        case .clip: range = (max(position, c.trimStart) < c.end - 0.05 ? max(position, c.trimStart) : c.trimStart, c.end)
        case .startSilence: range = (0, c.soundStart ?? 0)
        case .endSilence: range = (c.soundEnd ?? c.duration, c.duration)
        }
        guard range.1 > range.0 else { return }
        p.currentTime = range.0
        p.play(); playing = true; playingPart = part
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.03, repeats: true) { [weak self] _ in
            guard let self, let p = self.player else { return }
            self.position = p.currentTime
            if !p.isPlaying || p.currentTime >= range.1 {
                p.pause(); self.playing = false; self.playingPart = nil; self.timer?.invalidate()
            }
        }
    }
    func seek(to t: Double) {
        guard let c = current else { return }
        position = min(max(t, 0), c.duration)
        player?.currentTime = position
    }
    func stop() { player?.stop(); player = nil; playing = false; timer?.invalidate() }

    // MARK: Remove silence (start and end, −45 dBFS, 50 ms kept; never automatic, no fades)

    func removeSilence() {
        guard let c = current, let i = clips.firstIndex(of: c), let a = c.soundStart, let b = c.soundEnd else {
            message = "No sound above −45 dBFS"; return
        }
        clips[i].trimStart = a; clips[i].trimEnd = b < c.duration - 0.01 ? b : 0
        position = a; save()
    }
    func undoTrim() {
        guard let c = current, let i = clips.firstIndex(of: c) else { return }
        clips[i].trimStart = 0; clips[i].trimEnd = 0; save()
    }

    /// First and last sample above −45 dBFS, in seconds
    static func soundEdges(in url: URL) -> (Double, Double)? {
        guard let file = try? AVAudioFile(forReading: url) else { return nil }
        let threshold: Float = pow(10, -45 / 20)
        let rate = file.processingFormat.sampleRate
        guard let buf = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: 16384) else { return nil }
        var frame: AVAudioFramePosition = 0, first: AVAudioFramePosition? = nil, last: AVAudioFramePosition? = nil
        while (try? file.read(into: buf, frameCount: 16384)) != nil, buf.frameLength > 0 {
            for i in 0..<Int(buf.frameLength) {
                for ch in 0..<Int(buf.format.channelCount) where abs(buf.floatChannelData![ch][i]) > threshold {
                    let f = frame + AVAudioFramePosition(i)
                    if first == nil { first = f }
                    last = f
                    break
                }
            }
            frame += AVAudioFramePosition(buf.frameLength)
        }
        guard let first, let last else { return nil }
        return (Double(first) / rate, Double(last) / rate)
    }

    static func firstSound(in url: URL) -> Double? {
        guard let file = try? AVAudioFile(forReading: url) else { return nil }
        let threshold: Float = pow(10, -45 / 20)
        let rate = file.processingFormat.sampleRate
        guard let buf = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: 4096) else { return nil }
        var frame: AVAudioFramePosition = 0
        while (try? file.read(into: buf, frameCount: 4096)) != nil, buf.frameLength > 0 {
            for i in 0..<Int(buf.frameLength) {
                for ch in 0..<Int(buf.format.channelCount) where abs(buf.floatChannelData![ch][i]) > threshold {
                    return Double(frame + AVAudioFramePosition(i)) / rate
                }
            }
            frame += AVAudioFramePosition(buf.frameLength)
        }
        return nil
    }
}

final class Playhead: ObservableObject { @Published var value: Double = 0 }
