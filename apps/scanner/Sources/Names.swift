import Foundation

/// A file to scan, from the names copied in the admin (decision 0136: `<sku>_<role>_<slug>`).
struct ScanStep: Identifiable, Equatable {
    let id = UUID()
    var name: String
    var done = false

    var sku: String? { parts.count > 0 && parts[0].count == 5 ? parts[0] : nil }
    var role: String { parts.count > 1 ? parts[1] : "" }
    var slug: String { parts.count > 2 ? parts[2] : "" }
    private var parts: [String] { name.split(separator: "_", maxSplits: 2).map(String.init) }

    /// Human label of the role (the roles of Bulk create, 0107)
    var roleLabel: String {
        switch role {
        case "1": return "Label A"
        case "2": return "Label B"
        case "": return "File"
        default:
            if let n = Int(role) { return n == 3 ? "Other photo" : "Other photo \(n - 2)" }
            return role.uppercased()
        }
    }
    /// Image roles only: 1, 2, 3, 4… (a1, b1… are audio clips)
    var isImage: Bool { role.isEmpty || Int(role) != nil }
}

enum Names {
    /// Names found in pasted text: one per line, the extension (if any) dropped. Clips (a1, b1…) are left out.
    static func parse(_ text: String) -> [ScanStep] {
        text.split(whereSeparator: \.isNewline)
            .map { line -> String in
                var s = line.trimmingCharacters(in: .whitespaces)
                if let dot = s.lastIndex(of: "."), s[dot...].count <= 5 { s = String(s[..<dot]) }
                return s
            }
            .filter { $0.range(of: #"^\d{5}_[a-z0-9]{1,3}(_[a-z0-9-]*)?$"#, options: .regularExpression) != nil }
            .map { ScanStep(name: $0) }
            .filter(\.isImage)
    }

    /// The next image name for this record: the first role still missing (1 label A, 2 label B, then 3, 4… photos).
    /// Before, a single pasted label A name led straight to _3 and label B was skipped (Gio 2026-11-22).
    static func nextPhoto(after steps: [ScanStep]) -> String? {
        guard let first = steps.first, let sku = first.sku else { return nil }
        let roles = Set(steps.compactMap { Int($0.role) })
        var role = 1
        while roles.contains(role) { role += 1 }
        // the slug only helps in Finder: reuse the one of the same role family (label or photo) when known
        let slug = steps.first(where: { $0.role == (role <= 2 ? "1" : "3") })?.slug ?? first.slug
        return [sku, String(role), slug].filter { !$0.isEmpty }.joined(separator: "_")
    }

    /// Characters that cannot be in a file name on macOS
    static func clean(_ name: String) -> String {
        name.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
