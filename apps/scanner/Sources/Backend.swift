import Foundation
import Security

/// The admin link (decision 0138): sign in with the admin email (Supabase email OTP, the 6-digit code of the Magic Link
/// email) and read drafts and file names from the Edge Function `scan-targets`. Read only.
/// Config comes from Info.plist, filled by build.sh from apps/storefront/.supabase.env and site.json (never committed).
enum Config {
    static let supabaseURL = (Bundle.main.object(forInfoDictionaryKey: "ZanzaSupabaseURL") as? String) ?? ""
    static let supabaseKey = (Bundle.main.object(forInfoDictionaryKey: "ZanzaSupabaseKey") as? String) ?? ""
    static let mediaBaseURL = (Bundle.main.object(forInfoDictionaryKey: "ZanzaMediaBaseURL") as? String) ?? ""
    static var configured: Bool { !supabaseURL.isEmpty && !supabaseKey.isEmpty }
}

struct DraftSummary: Codable, Identifiable, Equatable {
    let id: String
    let sku: Int?
    let title: String
    let cat_no: String?
    let photo_key: String?
    var skuText: String { sku.map { String(format: "%05d", $0) } ?? "" }
    var photoURL: URL? {
        guard let k = photo_key, !Config.mediaBaseURL.isEmpty else { return nil }
        return URL(string: Config.mediaBaseURL + "/" + k)
    }
}

struct ImageTarget: Codable { let role: Int; let label: String; let name: String }
/// A clip slot (0141): one per line with a clip role (a1, b1… or a / b); artist/title for the ID3 tags
struct ClipTarget: Codable, Equatable { let role: String; let label: String; let name: String; let artist: String?; let title: String?; let line: Int? }
/// What the Samples tab writes in the tags (0141); every field optional until scan-targets is redeployed
struct DraftTags: Codable, Equatable {
    let album: String?           // label + format, e.g. `Blue Trac 7"` (Gio, PR #212), else the record title
    let album_artist: String?    // always "Gio"
    let label: String?; let cat_no: String?; let year: Int?; let genres: [String]?
    let record: String?; let format: String?
}
/// A Discogs release found by discogs-lookup { query } (as the admin's Memo)
struct DiscogsResult: Codable, Identifiable, Equatable { let id: Int; let title: String; let meta: String?; let thumb: String? }
enum NewDraftResult { case created(id: String, sku: String), existing([(id: String, sku: String, status: String)]) }

struct DraftInfo { let images: [ImageTarget]; let clips: [ClipTarget]; let tags: DraftTags? }

enum BackendError: LocalizedError {
    case notConfigured, signedOut, server(String)
    var errorDescription: String? {
        switch self {
        case .notConfigured: return "The app has no Supabase settings (rebuild it on the Mac with apps/storefront/.supabase.env)."
        case .signedOut: return "Signed out: sign in again."
        case .server(let m): return m
        }
    }
}

final class Backend {
    static let shared = Backend()
    private var accessToken: String?
    private var expiry = Date.distantPast
    private(set) var email: String? = UserDefaults.standard.string(forKey: "adminEmail")

    /// The refresh token, read from the Keychain once per launch and kept in memory (each read could ask for access)
    private lazy var refreshToken: String? = Keychain.read()
    var signedIn: Bool { refreshToken != nil }

    // MARK: Sign in

    func sendCode(to email: String) async throws {
        _ = try await post("/auth/v1/otp", ["email": email, "create_user": false], auth: false)
        self.email = email
        UserDefaults.standard.set(email, forKey: "adminEmail")
    }

    func verify(email: String, code: String) async throws {
        let r = try await post("/auth/v1/verify", ["type": "email", "email": email, "token": code], auth: false)
        try keep(r)
    }

    func signOut() {
        lock.lock(); defer { lock.unlock() }
        Keychain.delete(); refreshToken = nil; accessToken = nil; expiry = .distantPast
    }

    private func keep(_ r: [String: Any]) throws {
        guard let access = r["access_token"] as? String, let refresh = r["refresh_token"] as? String else {
            throw BackendError.server("The code was not accepted.")
        }
        lock.lock(); defer { lock.unlock() }
        accessToken = access
        expiry = Date().addingTimeInterval(TimeInterval((r["expires_in"] as? Int) ?? 3600) - 60)
        if refresh != refreshToken { Keychain.save(refresh); refreshToken = refresh }
    }

    /// Push uploads several files at once (0198): the token is read under a lock, and an expired one is refreshed by
    /// ONE request that every upload waits for (two refreshes with the same refresh token would sign the app out).
    private let lock = NSLock()
    private var refreshing: Task<String, Error>?

    private func token() async throws -> String {
        lock.lock()
        if let t = accessToken, Date() < expiry { lock.unlock(); return t }
        if let running = refreshing { lock.unlock(); return try await running.value }
        guard let refresh = refreshToken else { lock.unlock(); throw BackendError.signedOut }
        let task = Task { () throws -> String in
            do {
                let r = try await self.post("/auth/v1/token?grant_type=refresh_token", ["refresh_token": refresh], auth: false)
                try self.keep(r)
                guard let access = r["access_token"] as? String else { throw BackendError.signedOut }
                return access
            } catch {
                self.signOut(); throw BackendError.signedOut
            }
        }
        refreshing = task
        lock.unlock()
        defer { lock.lock(); refreshing = nil; lock.unlock() }
        return try await task.value
    }

    // MARK: scan-targets

    func drafts(matching query: String) async throws -> [DraftSummary] {
        let r = try await post("/functions/v1/scan-targets", ["query": query], auth: true)
        let data = try JSONSerialization.data(withJSONObject: r["drafts"] ?? [])
        return try JSONDecoder().decode([DraftSummary].self, from: data)
    }

    /// Image names, and (after the 0141 redeploy) clip slots and tags: missing ones are simply empty
    func detail(of id: String, roles: Int) async throws -> DraftInfo {
        let r = try await post("/functions/v1/scan-targets", ["id": id, "roles": roles], auth: true)
        let images = try JSONDecoder().decode([ImageTarget].self, from: JSONSerialization.data(withJSONObject: r["images"] ?? []))
        let clips = (try? JSONDecoder().decode([ClipTarget].self, from: JSONSerialization.data(withJSONObject: r["clips"] ?? []))) ?? []
        let tags = (r["tags"] as? [String: Any]).flatMap { try? JSONDecoder().decode(DraftTags.self, from: JSONSerialization.data(withJSONObject: $0)) }
        return DraftInfo(images: images, clips: clips, tags: tags)
    }

    // MARK: Push to admin (0142)

    /// scanner-push { id, check } → what the admin has now: photo roles and clip lines with a key
    func adminHas(_ id: String) async throws -> (photos: [Int], clips: [Int]) {
        let r = try await post("/functions/v1/scanner-push", ["id": id, "check": true], auth: true)
        let photos = (r["photos"] as? [[String: Any]] ?? []).compactMap { $0["role"] as? Int }
        let clips = (r["clips"] as? [[String: Any]] ?? []).compactMap { $0["line"] as? Int }
        return (photos, clips)
    }

    /// mode "replace" = what is pushed replaces the admin's; "fill" = only empty roles/lines are set (0165)
    func attach(_ id: String, photos: [(role: Int, key: String)], clips: [(line: Int, key: String)], mode: String = "replace") async throws {
        _ = try await post("/functions/v1/scanner-push", ["id": id, "mode": mode,
                                                          "photos": photos.map { ["role": $0.role, "key": $0.key] },
                                                          "clips": clips.map { ["line": $0.line, "key": $0.key] }], auth: true)
    }

    /// sign-upload, then PUT the bytes to R2; returns the key. `of`/`width` = a smaller copy of a photo.
    func upload(_ data: Data, kind: String, contentType: String, of: String? = nil, width: Int? = nil) async throws -> String {
        var body: [String: Any] = ["kind": kind, "contentType": contentType, "size": data.count]
        if let of, let width { body["of"] = of; body["width"] = width }
        let r = try await post("/functions/v1/sign-upload", body, auth: true)
        guard let key = r["key"] as? String, let u = r["uploadUrl"] as? String, let url = URL(string: u) else {
            throw BackendError.server("sign-upload gave no URL")
        }
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue(contentType, forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 120
        let (_, res) = try await URLSession.shared.upload(for: req, from: data)
        guard let code = (res as? HTTPURLResponse)?.statusCode, (200..<300).contains(code) else {
            throw BackendError.server("Upload to storage failed (\((res as? HTTPURLResponse)?.statusCode ?? 0))")
        }
        return key
    }

    // MARK: Originals (0202): listings.original_keys (migration 0045), read and written directly (PostgREST, RLS listings_admin)

    struct ListingOriginals { let id: String; let keys: [String] }

    /// The listing of each SKU (any status) with its original_keys, by 5-digit SKU text
    func originals(skus: [String]) async throws -> [String: ListingOriginals] {
        let numbers = skus.compactMap { Int($0) }
        var out: [String: ListingOriginals] = [:]
        for chunk in stride(from: 0, to: numbers.count, by: 100).map({ Array(numbers[$0..<min($0 + 100, numbers.count)]) }) {
            let q = "/rest/v1/listings?select=id,sku,original_keys&sku=in.(\(chunk.map(String.init).joined(separator: ",")))"
            let rows = (try JSONSerialization.jsonObject(with: try await rest("GET", q, nil))) as? [[String: Any]] ?? []
            for r in rows {
                guard let id = r["id"] as? String, let sku = r["sku"] as? Int else { continue }
                out[String(format: "%05d", sku)] = ListingOriginals(id: id, keys: (r["original_keys"] as? [String]) ?? [])
            }
        }
        return out
    }

    func setOriginals(_ id: String, keys: [String]) async throws {
        let data = try await rest("PATCH", "/rest/v1/listings?id=eq.\(id)&select=id", ["original_keys": keys])
        let rows = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] ?? []
        if rows.isEmpty { throw BackendError.server("The listing is no longer in the admin") }
    }

    // MARK: New draft from Discogs (0145)

    func discogsSearch(_ query: String) async throws -> [DiscogsResult] {
        let r = try await post("/functions/v1/discogs-lookup", ["query": query], auth: true)
        return (try? JSONDecoder().decode([DiscogsResult].self, from: JSONSerialization.data(withJSONObject: r["results"] ?? []))) ?? []
    }

    /// scanner-draft { releaseId, force? }: the draft, or 409 with the listings of that release already there
    func createDraft(releaseId: Int, force: Bool) async throws -> NewDraftResult {
        var body: [String: Any] = ["releaseId": releaseId]
        if force { body["force"] = true }
        let (status, r) = try await raw("/functions/v1/scanner-draft", body)
        if status == 409 {
            let list = (r["existing"] as? [[String: Any]] ?? []).map { e -> (String, String, String) in
                let sku = (e["sku"] as? Int).map { String(format: "%05d", $0) } ?? "\(e["sku"] ?? "")"
                return ((e["id"] as? String) ?? "", sku, (e["status"] as? String) ?? "")
            }
            return .existing(list)
        }
        guard (200..<300).contains(status), let d = r["draft"] as? [String: Any], let id = d["id"] as? String else {
            throw BackendError.server((r["error"] as? String) ?? "Could not create the draft (\(status))")
        }
        let sku = (d["sku"] as? Int).map { String(format: "%05d", $0) } ?? "\(d["sku"] ?? "")"
        return .created(id: id, sku: sku)
    }

    // MARK: Price and conditions (0196): the listing columns the admin's form writes, read and written directly
    // (PostgREST, the admin's own session: RLS listings_admin). No Edge Function, no copy of the data.

    /// The price and conditions of these listings, by id
    func terms(of ids: [String]) async throws -> [String: ListingTerms] {
        guard !ids.isEmpty else { return [:] }
        var out: [String: ListingTerms] = [:]
        for chunk in stride(from: 0, to: ids.count, by: 100).map({ Array(ids[$0..<min($0 + 100, ids.count)]) }) {
            let q = "/rest/v1/listings?select=\(ListingTerms.columns)&id=in.(\(chunk.joined(separator: ",")))"
            let data = try await rest("GET", q, nil)
            for t in try JSONDecoder().decode([ListingTerms].self, from: data) { out[t.id] = t }
        }
        return out
    }

    /// Writes only these columns of one listing; answers the row as saved
    func saveTerms(_ t: ListingTerms) async throws -> ListingTerms {
        var body = t.patch
        if let links = t.custom_title_links { body["custom_title_links"] = links.map(\.json) }   // only when the title changed
        let data = try await rest("PATCH", "/rest/v1/listings?id=eq.\(t.id)&select=\(ListingTerms.columns)", body)
        guard let saved = try JSONDecoder().decode([ListingTerms].self, from: data).first else {
            throw BackendError.server("The draft was not saved: it is no longer in the admin")
        }
        return saved
    }

    /// The artists of the record's lines, in line order (release_line_artists), for the custom title links
    func lineArtists(of id: String) async throws -> [(id: String, name: String)] { try await recordInfo(of: id).artists }

    /// The record's artists in line order and its Discogs release id (From Discogs is offered only with one)
    func recordInfo(of id: String) async throws -> (artists: [(id: String, name: String)], discogs: Int?) {
        let q = "/rest/v1/listings?id=eq.\(id)&select=release:releases(discogs_release_id,lines:release_lines(position,credits:release_line_artists(position,artist:artists(id,name))))"
        let rows = (try JSONSerialization.jsonObject(with: try await rest("GET", q, nil))) as? [[String: Any]] ?? []
        let release = rows.first?["release"] as? [String: Any]
        let lines = (release?["lines"] as? [[String: Any]] ?? [])
            .sorted { ($0["position"] as? Int ?? 0) < ($1["position"] as? Int ?? 0) }
        var out: [(id: String, name: String)] = []
        for l in lines {
            for c in ((l["credits"] as? [[String: Any]]) ?? []).sorted(by: { ($0["position"] as? Int ?? 0) < ($1["position"] as? Int ?? 0) }) {
                if let a = c["artist"] as? [String: Any], let i = a["id"] as? String, let n = a["name"] as? String { out.append((i, n)) }
            }
        }
        return (out, release?["discogs_release_id"] as? Int)
    }

    /// From Discogs (0111): "Artist - Title" as Discogs titles the release (artist as printed), via discogs-lookup
    func discogsTitle(_ releaseId: Int) async throws -> String {
        let d = try await post("/functions/v1/discogs-lookup", ["releaseId": releaseId], auth: true)
        let artist = ((d["artistCredit"] as? String).flatMap { $0.isEmpty ? nil : $0 }) ?? (d["artist"] as? String) ?? ""
        let title = [artist, (d["title"] as? String) ?? ""].filter { !$0.isEmpty }.joined(separator: " - ")
        guard !title.isEmpty else { throw BackendError.server("Discogs: the release has no title") }
        return title
    }

    /// Artists whose name or alias contains `q` (the link menu, as the admin's entityMatches): official name, alias as note
    func searchArtists(_ q: String) async throws -> [ArtistRef] {
        let enc = q.replacingOccurrences(of: "*", with: "").addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
        let names = try JSONSerialization.jsonObject(with: try await rest("GET", "/rest/v1/artists?select=id,name&name=ilike.*\(enc)*&order=name&limit=8", nil)) as? [[String: Any]] ?? []
        var out = names.compactMap { r -> ArtistRef? in
            guard let i = r["id"] as? String, let n = r["name"] as? String else { return nil }
            return ArtistRef(id: i, name: n, note: nil)
        }
        let aliases = (try? JSONSerialization.jsonObject(with: try await rest("GET", "/rest/v1/artist_aliases?select=name,artist:artists(id,name)&name=ilike.*\(enc)*&limit=8", nil))) as? [[String: Any]] ?? []
        for r in aliases {
            guard let a = r["artist"] as? [String: Any], let i = a["id"] as? String, let n = a["name"] as? String,
                  !out.contains(where: { $0.id == i }) else { continue }
            out.append(ArtistRef(id: i, name: n, note: r["name"] as? String))
        }
        return out
    }

    /// shop_settings.trade_enabled (0102): For trade is offered only while trade is on
    func tradeEnabled() async throws -> Bool {
        let data = try await rest("GET", "/rest/v1/shop_settings?select=*", nil)
        let rows = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] ?? []
        return (rows.first?["trade_enabled"] as? Bool) ?? true
    }

    private func rest(_ method: String, _ path: String, _ body: [String: Any]?) async throws -> Data {
        guard Config.configured, let url = URL(string: Config.supabaseURL + path) else { throw BackendError.notConfigured }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=representation", forHTTPHeaderField: "Prefer")
        req.setValue(Config.supabaseKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer " + (try await token()), forHTTPHeaderField: "Authorization")
        if let body { req.httpBody = try JSONSerialization.data(withJSONObject: body) }
        req.timeoutInterval = 30
        let (data, res) = try await URLSession.shared.data(for: req)
        let status = (res as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { signOut(); throw BackendError.signedOut }
        guard (200..<300).contains(status) else {
            let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            throw BackendError.server((json["message"] as? String) ?? "Error \(status)")
        }
        return data
    }

    /// POST that hands back any status (scanner-draft answers 409 on purpose)
    private func raw(_ path: String, _ body: [String: Any]) async throws -> (Int, [String: Any]) {
        guard Config.configured, let url = URL(string: Config.supabaseURL + path) else { throw BackendError.notConfigured }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(Config.supabaseKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer " + (try await token()), forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        req.timeoutInterval = 60
        let (data, res) = try await URLSession.shared.data(for: req)
        let status = (res as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { signOut(); throw BackendError.signedOut }
        return (status, (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:])
    }

    // MARK: HTTP

    private func post(_ path: String, _ body: [String: Any], auth: Bool) async throws -> [String: Any] {
        guard Config.configured, let url = URL(string: Config.supabaseURL + path) else { throw BackendError.notConfigured }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(Config.supabaseKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer " + (auth ? try await token() : Config.supabaseKey), forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        req.timeoutInterval = 30
        let (data, res) = try await URLSession.shared.data(for: req)
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        let status = (res as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 && auth { signOut(); throw BackendError.signedOut }
        guard (200..<300).contains(status) else {
            let m = (json["error"] as? String) ?? (json["msg"] as? String) ?? (json["error_description"] as? String) ?? "Error \(status)"
            throw BackendError.server(m)
        }
        return json
    }
}

/// The refresh token, in the login Keychain
enum Keychain {
    private static let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                               kSecAttrService as String: "xyz.gio-d.zanza.scanner",
                                               kSecAttrAccount as String: "supabase-refresh-token"]
    static func save(_ value: String) {
        delete()
        var q = query; q[kSecValueData as String] = Data(value.utf8)
        SecItemAdd(q as CFDictionary, nil)
    }
    static func read() -> String? {
        var q = query; q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
    static func delete() { SecItemDelete(query as CFDictionary) }
}
