import AVFoundation
import CoreGraphics
import CoreVideo
import ImageIO

/// The square video of one clip (0177): the label crop of its side, still and full frame, with the clip audio.
/// 1080 × 1080, H.264 at 30 fps + AAC, one file for Instagram feed and Reels alike. Same trim and same +8 dB boost as the MP3 (0157).
enum VideoExport {
    static let side = 1080
    static let fps: Int32 = 30

    static func write(source: URL, trimStart: Double, trimEnd: Double = 0, label: URL, to out: URL) throws {
        guard let image = squareImage(label) else { throw ScanError.message("Cannot read \(label.lastPathComponent)") }

        // the clip, trimmed and boosted, as a plain WAV the writer can read
        let file = try AVAudioFile(forReading: source)
        let fmt = file.processingFormat, rate = fmt.sampleRate
        file.framePosition = min(AVAudioFramePosition(trimStart * rate), file.length)
        let stop = trimEnd > 0 ? min(AVAudioFramePosition(trimEnd * rate), file.length) : file.length
        let count = AVAudioFrameCount(max(0, stop - file.framePosition))
        guard count > 0, let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: count) else { throw ScanError.message("The clip is empty") }
        try file.read(into: buf, frameCount: count)
        let tmpWAV = FileManager.default.temporaryDirectory.appendingPathComponent("zanza-\(UUID().uuidString).wav")
        defer { try? FileManager.default.removeItem(at: tmpWAV) }
        try AudioExport.wavData(buf, bits: 16, rate: Int(rate), gain: AudioExport.boost(buf), id3: nil).write(to: tmpWAV)
        let duration = Double(buf.frameLength) / rate
        let channels = Int(fmt.channelCount)

        // reader: the WAV as PCM
        let asset = AVURLAsset(url: tmpWAV)
        guard let track = asset.tracks(withMediaType: .audio).first else { throw ScanError.message("No audio in the clip") }
        let reader = try AVAssetReader(asset: asset)
        let pcm = AVAssetReaderTrackOutput(track: track, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
        reader.add(pcm)

        // writer: written next to the target under a temporary name, then moved over it (never a half file, 0143)
        try FileManager.default.createDirectory(at: out.deletingLastPathComponent(), withIntermediateDirectories: true)
        let tmp = out.deletingLastPathComponent().appendingPathComponent(".\(out.deletingPathExtension().lastPathComponent).part.mp4")
        try? FileManager.default.removeItem(at: tmp)
        let writer = try AVAssetWriter(outputURL: tmp, fileType: .mp4)
        let video = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: side, AVVideoHeightKey: side,
            AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 6_000_000, AVVideoMaxKeyFrameIntervalKey: Int(fps) * 2,
                                              AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel]])
        video.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: video, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: side,
            kCVPixelBufferHeightKey as String: side])
        let audio = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: min(rate, 48_000), AVNumberOfChannelsKey: min(channels, 2),   // AAC tops out at 48 kHz
            AVEncoderBitRateKey: channels == 1 ? 160_000 : 320_000])
        audio.expectsMediaDataInRealTime = false
        writer.add(video); writer.add(audio)

        guard reader.startReading() else { throw reader.error ?? ScanError.message("Cannot read the clip") }
        guard writer.startWriting() else { throw writer.error ?? ScanError.message("Cannot write the video") }
        writer.startSession(atSourceTime: .zero)
        guard let pixels = pixelBuffer(image) else { throw ScanError.message("Cannot draw the label") }

        // the same still frame 30 times a second and the audio, each input fed on its own queue when the writer asks for it:
        // the writer interleaves by time, so feeding both from one loop can wait forever on the input it is not asking for
        let frames = Int64(max(1, (duration * Double(fps)).rounded(.up)))
        var frame: Int64 = 0
        let group = DispatchGroup()
        group.enter(); group.enter()
        video.requestMediaDataWhenReady(on: DispatchQueue(label: "zanza.video.frames")) {
            while video.isReadyForMoreMediaData {
                if frame >= frames || writer.status != .writing { video.markAsFinished(); group.leave(); return }
                if !adaptor.append(pixels, withPresentationTime: CMTime(value: frame, timescale: fps)) { video.markAsFinished(); group.leave(); return }
                frame += 1
            }
        }
        audio.requestMediaDataWhenReady(on: DispatchQueue(label: "zanza.video.audio")) {
            while audio.isReadyForMoreMediaData {
                guard writer.status == .writing, let sample = pcm.copyNextSampleBuffer(), audio.append(sample) else {
                    audio.markAsFinished(); group.leave(); return
                }
            }
        }
        group.wait()
        if writer.status == .failed { reader.cancelReading(); try? FileManager.default.removeItem(at: tmp); throw writer.error ?? ScanError.message("Could not write \(out.lastPathComponent)") }
        writer.endSession(atSourceTime: CMTime(seconds: duration, preferredTimescale: 600))
        let done = DispatchSemaphore(value: 0)
        writer.finishWriting { done.signal() }
        done.wait()
        guard writer.status == .completed else {
            try? FileManager.default.removeItem(at: tmp)
            throw writer.error ?? ScanError.message("Could not write \(out.lastPathComponent)")
        }
        if FileManager.default.fileExists(atPath: out.path) { _ = try FileManager.default.replaceItemAt(out, withItemAt: tmp) }
        else { try FileManager.default.moveItem(at: tmp, to: out) }
    }

    /// The label scan, centre square, at most 1080 px (the crop is already square: 3.8" or 4", 0153)
    static func squareImage(_ url: URL) -> CGImage? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
              let img = CGImageSourceCreateThumbnailAtIndex(src, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true,
                                                                      kCGImageSourceCreateThumbnailWithTransform: true,
                                                                      kCGImageSourceThumbnailMaxPixelSize: side] as CFDictionary) else { return nil }
        let s = min(img.width, img.height)
        return img.cropping(to: CGRect(x: (img.width - s) / 2, y: (img.height - s) / 2, width: s, height: s))
    }

    /// The label drawn full frame into one BGRA buffer, reused for every frame
    static func pixelBuffer(_ image: CGImage) -> CVPixelBuffer? {
        var pb: CVPixelBuffer?
        CVPixelBufferCreate(kCFAllocatorDefault, side, side, kCVPixelFormatType_32BGRA,
                            [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary, &pb)
        guard let pb else { return nil }
        CVPixelBufferLockBaseAddress(pb, [])
        defer { CVPixelBufferUnlockBaseAddress(pb, []) }
        guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb), width: side, height: side, bitsPerComponent: 8,
                                  bytesPerRow: CVPixelBufferGetBytesPerRow(pb), space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) else { return nil }
        ctx.interpolationQuality = .high
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: side, height: side))
        return pb
    }
}
