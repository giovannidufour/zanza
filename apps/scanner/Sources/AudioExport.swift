import AppKit
import AVFoundation

/// Export of one assigned clip (0141): <name>.wav (source rate, 24-bit if the source is, else 16) and <name>.mp3
/// (LAME 320 kbps CBR, 44.1 kHz), both with ID3v2.4 tags (in the WAV as an "id3 " chunk) and the side's label as cover.
/// Re-export overwrites. Normalize (peak to 0 dB) only when asked: Gio doubts it (clicks on vinyl skew the peak).
enum AudioExport {
    struct Tags {
        var title = "", artist = "", album = "", label = "", year = "", genre = "", track = "", comment = ""
        var cover: Data?   // JPEG
    }

    /// Written next to the target under a temporary name, then moved over it: never a half file (0143)
    static func writeSafely(_ data: Data, to url: URL) throws {
        let tmp = url.deletingLastPathComponent().appendingPathComponent(".\(url.lastPathComponent).part")
        try data.write(to: tmp)
        if FileManager.default.fileExists(atPath: url.path) { _ = try FileManager.default.replaceItemAt(url, withItemAt: tmp) }
        else { try FileManager.default.moveItem(at: tmp, to: url) }
    }

    static var lame: String? {
        ["/opt/homebrew/bin/lame", "/usr/local/bin/lame"].first { FileManager.default.isExecutableFile(atPath: $0) }
    }

    static func export(source: URL, trimStart: Double, trimEnd: Double = 0, name: String, tags: Tags,
                       wavFolder: URL?, mp3Folder: URL, normalize: Bool) throws {
        guard let lame else { throw ScanError.message("LAME is not installed (brew install lame): MP3 not made.") }
        let file = try AVAudioFile(forReading: source)
        let fmt = file.processingFormat
        let rate = fmt.sampleRate, channels = Int(fmt.channelCount)
        let srcBits = (file.fileFormat.settings[AVLinearPCMBitDepthKey] as? Int) ?? 16
        let bits = srcBits >= 24 ? 24 : 16
        let start = AVAudioFramePosition(trimStart * rate)
        file.framePosition = min(start, file.length)
        let stop = trimEnd > 0 ? min(AVAudioFramePosition(trimEnd * rate), file.length) : file.length
        let count = AVAudioFrameCount(max(0, stop - file.framePosition))
        guard let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: max(count, 1)) else { throw ScanError.message("Out of memory") }
        try file.read(into: buf, frameCount: count)
        var gain: Float = 1
        if normalize {
            var peak: Float = 0
            for ch in 0..<channels { let p = buf.floatChannelData![ch]; for i in 0..<Int(buf.frameLength) { peak = max(peak, abs(p[i])) } }
            if peak > 0 { gain = 1 / peak }
        }
        let tag = id3(tags)
        try FileManager.default.createDirectory(at: mp3Folder, withIntermediateDirectories: true)
        if let wavFolder {   // optional (Gio: not always an archive / DJ copy)
            try FileManager.default.createDirectory(at: wavFolder, withIntermediateDirectories: true)
            try writeSafely(wavData(buf, bits: bits, rate: Int(rate), gain: gain, id3: tag), to: wavFolder.appendingPathComponent(name).appendingPathExtension("wav"))
        }

        // MP3: LAME reads a plain 16/24-bit WAV (no tag), the ID3v2.4 tag is put in front afterwards
        let tmpIn = FileManager.default.temporaryDirectory.appendingPathComponent("zanza-\(UUID().uuidString).wav")
        let tmpOut = tmpIn.deletingPathExtension().appendingPathExtension("mp3")
        defer { try? FileManager.default.removeItem(at: tmpIn); try? FileManager.default.removeItem(at: tmpOut) }
        try wavData(buf, bits: bits, rate: Int(rate), gain: gain, id3: nil).write(to: tmpIn)
        let p = Process()
        p.executableURL = URL(fileURLWithPath: lame)
        p.arguments = ["--quiet", "-b", "320", "--cbr", "-q", "0", "--resample", "44.1", tmpIn.path, tmpOut.path]
        try p.run(); p.waitUntilExit()
        guard p.terminationStatus == 0, let mp3 = try? Data(contentsOf: tmpOut) else { throw ScanError.message("LAME could not make the MP3") }
        try writeSafely(tag + mp3, to: mp3Folder.appendingPathComponent(name).appendingPathExtension("mp3"))
    }

    /// MP3 at `kbps` (Push to admin: 128) from the session source, trim applied; no tags (the admin keeps its own data)
    static func mp3(source: URL, trimStart: Double, trimEnd: Double = 0, kbps: Int) throws -> Data {
        guard let lame else { throw ScanError.message("LAME is not installed (brew install lame).") }
        let file = try AVAudioFile(forReading: source)
        let fmt = file.processingFormat, rate = fmt.sampleRate
        file.framePosition = min(AVAudioFramePosition(trimStart * rate), file.length)
        let stop = trimEnd > 0 ? min(AVAudioFramePosition(trimEnd * rate), file.length) : file.length
        let count = AVAudioFrameCount(max(0, stop - file.framePosition))
        guard let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: max(count, 1)) else { throw ScanError.message("Out of memory") }
        try file.read(into: buf, frameCount: count)
        let tmpIn = FileManager.default.temporaryDirectory.appendingPathComponent("zanza-\(UUID().uuidString).wav")
        let tmpOut = tmpIn.deletingPathExtension().appendingPathExtension("mp3")
        defer { try? FileManager.default.removeItem(at: tmpIn); try? FileManager.default.removeItem(at: tmpOut) }
        try wavData(buf, bits: 16, rate: Int(rate), gain: 1, id3: nil).write(to: tmpIn)
        let p = Process()
        p.executableURL = URL(fileURLWithPath: lame)
        p.arguments = ["--quiet", "-b", "\(kbps)", "--cbr", "--resample", "44.1", tmpIn.path, tmpOut.path]
        try p.run(); p.waitUntilExit()
        guard p.terminationStatus == 0 else { throw ScanError.message("LAME could not make the MP3") }
        return try Data(contentsOf: tmpOut)
    }

    /// WebP for the admin (0108): long side `long` (or exact `width`), quality 0.86, through Homebrew cwebp
    static func webp(from url: URL, long: Int? = nil, width: Int? = nil) throws -> Data {
        guard let cwebp = ["/opt/homebrew/bin/cwebp", "/usr/local/bin/cwebp"].first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else {
            throw ScanError.message("cwebp is not installed (brew install webp).")
        }
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
            throw ScanError.message("Cannot read \(url.lastPathComponent)")
        }
        let w0 = CGFloat(img.width), h0 = CGFloat(img.height)
        let f: CGFloat = width.map { CGFloat($0) / w0 } ?? long.map { min(1, CGFloat($0) / max(w0, h0)) } ?? 1
        let w = max(1, Int((w0 * f).rounded())), h = max(1, Int((h0 * f).rounded()))
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
            throw ScanError.message("Out of memory")
        }
        ctx.interpolationQuality = .high
        ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
        let tmpIn = FileManager.default.temporaryDirectory.appendingPathComponent("zanza-\(UUID().uuidString).png")
        let tmpOut = tmpIn.deletingPathExtension().appendingPathExtension("webp")
        defer { try? FileManager.default.removeItem(at: tmpIn); try? FileManager.default.removeItem(at: tmpOut) }
        try ImageOutput.write(ctx.makeImage()!, to: tmpIn, format: .png, dpi: 72)
        let p = Process()
        p.executableURL = URL(fileURLWithPath: cwebp)
        p.arguments = ["-quiet", "-q", "86", tmpIn.path, "-o", tmpOut.path]
        try p.run(); p.waitUntilExit()
        guard p.terminationStatus == 0 else { throw ScanError.message("cwebp could not make the WebP") }
        return try Data(contentsOf: tmpOut)
    }

    // MARK: WAV (PCM, little endian) with an optional "id3 " chunk

    static func wavData(_ buf: AVAudioPCMBuffer, bits: Int, rate: Int, gain: Float, id3: Data?) -> Data {
        let ch = Int(buf.format.channelCount), frames = Int(buf.frameLength), bytes = bits / 8
        var pcm = Data(capacity: frames * ch * bytes)
        let maxV = Float(bits == 24 ? 8_388_607 : 32_767)
        for i in 0..<frames {
            for c in 0..<ch {
                let v = Int32((max(-1, min(1, buf.floatChannelData![c][i] * gain)) * maxV).rounded())
                withUnsafeBytes(of: v.littleEndian) { pcm.append(contentsOf: $0.prefix(bytes)) }
            }
        }
        func u32(_ v: Int) -> Data { withUnsafeBytes(of: UInt32(v).littleEndian) { Data($0) } }
        func u16(_ v: Int) -> Data { withUnsafeBytes(of: UInt16(v).littleEndian) { Data($0) } }
        var fmt = Data()
        fmt += u16(1) + u16(ch) + u32(rate) + u32(rate * ch * bytes) + u16(ch * bytes) + u16(bits)
        var body = Data("WAVE".utf8)
        body += Data("fmt ".utf8) + u32(fmt.count) + fmt
        body += Data("data".utf8) + u32(pcm.count) + pcm
        if pcm.count % 2 == 1 { body.append(0) }
        if let id3 {
            body += Data("id3 ".utf8) + u32(id3.count) + id3
            if id3.count % 2 == 1 { body.append(0) }
        }
        return Data("RIFF".utf8) + u32(body.count) + body
    }

    // MARK: ID3v2.4

    static func id3(_ t: Tags) -> Data {
        func syncsafe(_ n: Int) -> Data { Data([UInt8((n >> 21) & 0x7f), UInt8((n >> 14) & 0x7f), UInt8((n >> 7) & 0x7f), UInt8(n & 0x7f)]) }
        func frame(_ id: String, _ payload: Data) -> Data { Data(id.utf8) + syncsafe(payload.count) + Data([0, 0]) + payload }
        func text(_ id: String, _ s: String) -> Data? { s.isEmpty ? nil : frame(id, Data([3]) + Data(s.utf8)) }   // 3 = UTF-8
        var frames = Data()
        for f in [text("TIT2", t.title), text("TPE1", t.artist), text("TALB", t.album), text("TPUB", t.label),
                  text("TDRC", t.year), text("TCON", t.genre), text("TRCK", t.track)].compactMap({ $0 }) { frames += f }
        if !t.comment.isEmpty { frames += frame("COMM", Data([3]) + Data("eng".utf8) + Data([0]) + Data(t.comment.utf8)) }
        if let jpg = t.cover {   // front cover
            frames += frame("APIC", Data([3]) + Data("image/jpeg".utf8) + Data([0, 3, 0]) + jpg)
        }
        return Data("ID3".utf8) + Data([4, 0, 0]) + syncsafe(frames.count) + frames
    }

    /// The side's label scan as a square JPEG, 1000 px
    static func cover(from url: URL?) -> Data? {
        guard let url, let src = CGImageSourceCreateWithURL(url as CFURL, nil),
              let img = CGImageSourceCreateThumbnailAtIndex(src, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true,
                                                                      kCGImageSourceThumbnailMaxPixelSize: 1000] as CFDictionary) else { return nil }
        let side = min(img.width, img.height)
        guard let sq = img.cropping(to: CGRect(x: (img.width - side) / 2, y: (img.height - side) / 2, width: side, height: side)) else { return nil }
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, "public.jpeg" as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, sq, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
        return CGImageDestinationFinalize(dest) ? out as Data : nil
    }
}
