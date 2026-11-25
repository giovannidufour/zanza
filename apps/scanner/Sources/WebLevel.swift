import AVFoundation
import JavaScriptCore

/// Decision 0192: the 128 kbps copy that Push to admin uploads for the shop plays at the shop's level, made by the SAME
/// file as the admin's (`packages/audio/web-level.js`, copied into the app's Resources by build.sh) run in
/// JavaScriptCore. The JS works in place on the buffer's float channels (no copy). The exported WAV and MP3 320 never
/// come here: they keep the plain boost of 0157.
enum WebLevel {
    /// Levels `buf` in place. Throws only when the script is missing from the app (a build without it).
    static func apply(_ buf: AVAudioPCMBuffer) throws {
        guard let url = Bundle.main.url(forResource: "web-level", withExtension: "js"),
              let source = try? String(contentsOf: url, encoding: .utf8) else {
            throw ScanError.message("web-level.js is missing from the app: rebuild it with build.sh.")
        }
        guard let ctx = JSContext(), let data = buf.floatChannelData else { return }
        var failure: String?
        ctx.exceptionHandler = { _, e in failure = e?.toString() }
        ctx.evaluateScript(source)
        let level = ctx.objectForKeyedSubscript("HighmuzikWebLevel").objectForKeyedSubscript("level")
        let frames = Int(buf.frameLength), channels = min(2, Int(buf.format.channelCount))
        let arrays = JSValue(newArrayIn: ctx)!
        for c in 0..<channels {
            var exception: JSValueRef?
            let ref = JSObjectMakeTypedArrayWithBytesNoCopy(ctx.jsGlobalContextRef, kJSTypedArrayTypeFloat32Array,
                                                            data[c], frames * MemoryLayout<Float>.size, nil, nil, &exception)
            arrays.setObject(JSValue(jsValueRef: ref, in: ctx), atIndexedSubscript: c)
        }
        _ = level?.call(withArguments: [arrays, buf.format.sampleRate])
        if let failure { throw ScanError.message("Could not level the sample: \(failure)") }
    }
}
