import Foundation
import ImageIO
import UniformTypeIdentifiers

/// The whole-record originals online (decision 0202). Every scan of a label also writes the whole record to the
/// Originals folder under the same name (`<sku>_<role>_<slug>`, 0136). Those files go to R2 `originals/` and into
/// `listings.original_keys` (migration 0045, as admin → Take photo, 0200): kept with the SKU, never shown in the shop.
///
/// One sync serves both Push (one SKU) and the backfill at launch (every SKU in the folder). What is already online
/// is remembered in a ledger next to the files (`.originals-online.json`: file → listing, size, date, key), so a
/// file is uploaded once; a rescan (other size or date) uploads again and its new key takes the old one's place
/// (the old one goes to the trash, trigger of 0045). A remembered key no longer on the listing (an admin Save with an
/// older form dropped it) is uploaded again. Keys added by Take photo are never touched.
enum Originals {
    struct Entry: Codable { let listing: String; let size: Int; let modified: Int; let key: String }
    struct File { let sku: String; let role: Int; let url: URL; let size: Int; let modified: Int; var name: String { url.lastPathComponent } }
    struct Result { var uploaded = 0, online = 0, noListing = 0, failed: [String] = []
        var summary: String {
            var parts: [String] = []
            if uploaded > 0 { parts.append("\(uploaded) original\(uploaded == 1 ? "" : "s") uploaded") }
            if online > 0 && uploaded == 0 { parts.append("\(online) original\(online == 1 ? "" : "s") already online") }
            if noListing > 0 { parts.append("\(noListing) with no listing") }
            if !failed.isEmpty { parts.append("\(failed.count) failed: " + failed.prefix(3).joined(separator: " · ")) }
            return parts.joined(separator: " · ")
        }
    }

    static let ledgerName = ".originals-online.json"
    /// sign-upload's limit for kind "original"
    static let maxBytes = 20 * 1024 * 1024
    /// One upload or one write to the ledger at a time: Push and the backfill never send the same file twice
    private static let gate = AsyncGate()

    /// The originals of the folder (not its subfolders: Free scans stay on the Mac), image roles only
    static func files(in folder: URL, sku only: String? = nil) -> [File] {
        let fm = FileManager.default
        let names = (try? fm.contentsOfDirectory(atPath: folder.path)) ?? []
        return names.compactMap { name -> File? in
            guard name.range(of: #"^\d{5}_\d{1,2}(_[^/]*)?\.(jpg|jpeg|png|tif|tiff)$"#, options: [.regularExpression, .caseInsensitive]) != nil else { return nil }
            let parts = name.split(separator: "_", maxSplits: 2).map(String.init)
            let role = Int(parts[1].split(separator: ".")[0]) ?? 0
            guard role > 0, only == nil || parts[0] == only else { return nil }
            let url = folder.appendingPathComponent(name)
            let a = try? fm.attributesOfItem(atPath: url.path)
            return File(sku: parts[0], role: role, url: url, size: (a?[.size] as? Int) ?? 0,
                        modified: Int((a?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0))
        }.sorted { ($0.sku, $0.role, $0.name) < ($1.sku, $1.role, $1.name) }
    }

    static func ledger(in folder: URL) -> [String: Entry] {
        guard let d = try? Data(contentsOf: folder.appendingPathComponent(ledgerName)) else { return [:] }
        return (try? JSONDecoder().decode([String: Entry].self, from: d)) ?? [:]
    }
    private static func save(_ ledger: [String: Entry], in folder: URL) throws {
        let enc = JSONEncoder(); enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        try enc.encode(ledger).write(to: folder.appendingPathComponent(ledgerName), options: .atomic)
    }

    /// The files still to upload, given what the listings hold now (the backfill asks this before queueing a job)
    static func pending(_ files: [File], ledger: [String: Entry], listings: [String: Backend.ListingOriginals]) -> [File] {
        files.filter { f in
            guard let l = listings[f.sku] else { return false }
            guard let e = ledger[f.name] else { return true }
            return !(e.listing == l.id && e.size == f.size && e.modified == f.modified && l.keys.contains(e.key))
        }
    }

    /// Uploads what is missing for these SKUs (all of the folder when `sku` is nil) and writes original_keys
    static func sync(folder: URL, sku: String? = nil, progress: ((Int, Int) -> Void)? = nil) async throws -> Result {
        try await gate.run {
            var result = Result()
            let files = files(in: folder, sku: sku)
            guard !files.isEmpty else { return result }
            var ledger = ledger(in: folder)
            let listings = try await Backend.shared.originals(skus: Array(Set(files.map(\.sku))))
            let todo = pending(files, ledger: ledger, listings: listings)
            result.noListing = files.filter { listings[$0.sku] == nil }.count
            result.online = files.count - result.noListing - todo.count
            var done = 0
            progress?(0, todo.count)
            for (s, group) in Dictionary(grouping: todo, by: \.sku).sorted(by: { $0.key < $1.key }) {
                guard let listing = listings[s] else { continue }
                var keys = listing.keys, sent = 0
                let before = ledger
                for f in group {
                    do {
                        let (data, type) = try bytes(of: f)
                        let key = try await Backend.shared.upload(data, kind: "original", contentType: type)
                        // a rescan takes the place of its old key; a new file goes after the others
                        if let old = ledger[f.name]?.key, let i = keys.firstIndex(of: old) { keys[i] = key } else { keys.append(key) }
                        ledger[f.name] = Entry(listing: listing.id, size: f.size, modified: f.modified, key: key)
                        sent += 1
                    } catch {
                        result.failed.append("\(f.name): \(error.localizedDescription)")
                    }
                    done += 1; progress?(done, todo.count)
                }
                if keys != listing.keys {
                    do { try await Backend.shared.setOriginals(listing.id, keys: keys); result.uploaded += sent }
                    catch {
                        // nothing of this SKU reached the listing: as before, so the next sync uploads again
                        ledger = before
                        result.failed.append("SKU \(s): \(error.localizedDescription)")
                    }
                }
                try save(ledger, in: folder)   // after each SKU: an interrupted backfill goes on from there
            }
            return result
        }
    }

    /// The file as it is when JPEG or PNG (the original, untouched); a TIFF becomes a JPEG (sign-upload takes no TIFF)
    static func bytes(of f: File) throws -> (Data, String) {
        let ext = f.url.pathExtension.lowercased()
        if ext == "jpg" || ext == "jpeg" || ext == "png" {
            guard f.size <= maxBytes else { throw ScanError.message("over 20 MB") }
            return (try Data(contentsOf: f.url), ext == "png" ? "image/png" : "image/jpeg")
        }
        guard let src = CGImageSourceCreateWithURL(f.url as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
            throw ScanError.message("cannot read")
        }
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else { throw ScanError.message("cannot convert") }
        CGImageDestinationAddImage(dest, img, [kCGImageDestinationLossyCompressionQuality: 0.92] as CFDictionary)
        guard CGImageDestinationFinalize(dest), out.length <= maxBytes else { throw ScanError.message("cannot convert under 20 MB") }
        return (out as Data, "image/jpeg")
    }
}

/// Runs one async block at a time, in call order
actor AsyncGate {
    private var tail: Task<Void, Never>?
    func run<T: Sendable>(_ work: @escaping @Sendable () async throws -> T) async throws -> T {
        let previous = tail
        let task = Task { () async throws -> T in
            await previous?.value
            return try await work()
        }
        tail = Task { _ = try? await task.value }
        return try await task.value
    }
}
