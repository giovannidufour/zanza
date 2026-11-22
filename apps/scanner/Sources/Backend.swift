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

    var signedIn: Bool { Keychain.read() != nil }

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
        Keychain.delete(); accessToken = nil; expiry = .distantPast
    }

    private func keep(_ r: [String: Any]) throws {
        guard let access = r["access_token"] as? String, let refresh = r["refresh_token"] as? String else {
            throw BackendError.server("The code was not accepted.")
        }
        accessToken = access
        expiry = Date().addingTimeInterval(TimeInterval((r["expires_in"] as? Int) ?? 3600) - 60)
        Keychain.save(refresh)
    }

    private func token() async throws -> String {
        if let t = accessToken, Date() < expiry { return t }
        guard let refresh = Keychain.read() else { throw BackendError.signedOut }
        do {
            let r = try await post("/auth/v1/token?grant_type=refresh_token", ["refresh_token": refresh], auth: false)
            try keep(r)
            return accessToken!
        } catch {
            signOut(); throw BackendError.signedOut
        }
    }

    // MARK: scan-targets

    func drafts(matching query: String) async throws -> [DraftSummary] {
        let r = try await post("/functions/v1/scan-targets", ["query": query], auth: true)
        let data = try JSONSerialization.data(withJSONObject: r["drafts"] ?? [])
        return try JSONDecoder().decode([DraftSummary].self, from: data)
    }

    func images(of id: String, roles: Int) async throws -> [ImageTarget] {
        let r = try await post("/functions/v1/scan-targets", ["id": id, "roles": roles], auth: true)
        let data = try JSONSerialization.data(withJSONObject: r["images"] ?? [])
        return try JSONDecoder().decode([ImageTarget].self, from: data)
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
