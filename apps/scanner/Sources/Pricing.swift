import SwiftUI

/// The Price tab (decision 0196, Figma page Scanner → `price · components`, screens "Scanner v3 - price tab, …"):
/// sale type, price and conditions of a draft, the same listing columns the admin's form writes
/// (packages/listing-draft/listing-draft.js → payloadOf). One source of truth: the app reads and writes those columns.

/// The listing columns of the admin's Price and Conditions blocks (Supabase public.listings)
struct ListingTerms: Codable, Equatable {
    static let columns = "id,section,price_mode,price_cents,condition_media,condition_media_b,condition_notes,sleeve_type,condition_sleeve,custom_title,notes,custom_title_links"
    let id: String
    var section: String
    var price_mode: String?
    var price_cents: Int?
    var condition_media: String?
    var condition_media_b: String?
    var condition_notes: String?
    var sleeve_type: String?
    var condition_sleeve: String?
    /// Title block (custom title, 0111/0147) and Description block (notes) of the admin form (Gio 2026-11-27)
    var custom_title: String?
    var notes: String?
    /// artist links over the custom title (0147); nil = never set (the shop derives them, 0111)
    var custom_title_links: [TitleLink]?

    /// The body of the PATCH: every column of the two blocks, null when empty (as admin_save_listing stores them)
    var patch: [String: Any] {
        func v(_ s: String?) -> Any { (s?.isEmpty == false) ? s! : NSNull() }
        return ["section": section, "price_mode": price_mode ?? "fixed", "price_cents": price_cents.map { $0 as Any } ?? NSNull(),
                "condition_media": v(condition_media), "condition_media_b": v(condition_media_b), "condition_notes": v(condition_notes),
                "sleeve_type": sleeve_type ?? "original", "condition_sleeve": sleeve_type == "none" ? NSNull() : v(condition_sleeve),
                "custom_title": v(custom_title), "notes": v(notes)]
    }

    var isOffers: Bool { section == "sale" && price_mode == "offers" }
    /// a price the shop can show: a fixed price, Best offer, or trade (where the price is optional)
    var priced: Bool { isOffers || section == "trade" || price_cents != nil }
    var graded: Bool { !(condition_media ?? "").isEmpty }
}

/// The form of the open draft: text as typed, the same choices as the admin
struct PriceForm: Equatable {
    static let grades = ["M", "NM", "NM-", "EX+", "EX", "EX-", "VG+", "VG", "VG-", "G+", "G", "G-", "F"]   // public.grades, admin GRADES
    static let sleeves = [("original", "Original"), ("generic", "Generic"), ("none", "None")]

    var saleType = "sale"   // sale | offers (Best offer, 0158) | trade
    var price = ""
    var sideA = "", sideB = "", notes = ""
    var sleeveType = "generic", sleeveCondition = ""
    var title = "", description = ""
    /// artist links over `title` (0147), edited like the admin's LinkedInput (Gio's card 2026-11-27: "Come in admin")
    var links: [TitleLink] = []
    /// the listing has no stored links yet (null): the record's artists found in the title are offered, as in the admin
    var linksDerived = false

    init() {}
    init(_ t: ListingTerms) {
        saleType = t.isOffers ? "offers" : t.section
        price = t.price_cents.map(PriceForm.centsText) ?? ""
        sideA = t.condition_media ?? ""; sideB = t.condition_media_b ?? ""; notes = t.condition_notes ?? ""
        sleeveType = t.sleeve_type ?? "original"; sleeveCondition = t.condition_sleeve ?? ""
        title = t.custom_title ?? ""; description = t.notes ?? ""
        links = t.custom_title_links ?? []; linksDerived = t.custom_title_links == nil
    }

    /// as the admin's centsToText: 25, 25.5 → "25.50"
    static func centsText(_ c: Int) -> String {
        let s = String(format: "%.2f", Double(c) / 100)
        return s.hasSuffix(".00") ? String(s.dropLast(3)) : s
    }
    /// as listing-draft textToCents: "" = nil, "25", "25,5", "25.50"; anything else is an error
    static func cents(_ text: String) -> Int?? {
        let s = text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        if s.isEmpty { return .some(nil) }
        guard s.range(of: #"^\d+(\.\d{1,2})?$"#, options: .regularExpression) != nil, let d = Double(s) else { return nil }
        return .some(Int((d * 100).rounded()))
    }
    var priceError: String? {
        if saleType == "offers" { return nil }
        return PriceForm.cents(price) == nil ? "Enter a price like 25 or 25.50." : nil
    }

    /// the links as stored: offsets in the trimmed title (admin titleLinksRow)
    var storedLinks: [TitleLink] {
        let u = Array(title.utf16)
        let lead = u.prefix { $0 == 32 || $0 == 9 || $0 == 10 }.count
        let len = title.trimmingCharacters(in: .whitespacesAndNewlines).utf16.count
        guard len > 0 else { return [] }
        return links.map { TitleLink(start: max(0, $0.start - lead), end: min(len, $0.end - lead), artist_id: $0.artist_id, name: $0.name) }
            .filter { $0.end > $0.start }
    }

    func terms(id: String) -> ListingTerms? {
        guard priceError == nil else { return nil }
        let cents = saleType == "offers" ? nil : (PriceForm.cents(price) ?? nil)
        let note = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        return ListingTerms(id: id, section: saleType == "offers" ? "sale" : saleType, price_mode: saleType == "offers" ? "offers" : "fixed",
                            price_cents: cents, condition_media: sideA, condition_media_b: sideB, condition_notes: note,
                            sleeve_type: sleeveType, condition_sleeve: sleeveType == "none" ? "" : sleeveCondition,
                            custom_title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                            notes: description.trimmingCharacters(in: .whitespacesAndNewlines), custom_title_links: storedLinks)
    }
}

/// Saved terms per draft, the open draft's form, saving
final class PricingModel: ObservableObject {
    /// as saved in the admin, by listing id (drafts of the list)
    @Published var saved: [String: ListingTerms] = [:]
    /// forms edited and not saved yet, by listing id: switching draft keeps them
    @Published var edits: [String: PriceForm] = [:]
    @Published var tradeOn = true
    @Published var saving: String?
    @Published var error: String?
    @Published var savedAt: [String: Date] = [:]
    /// a saved custom title changes the draft's name in the list (scan-targets reads it)
    var onTitleChanged: (() -> Void)?

    private var tradeRead = false
    func load(_ ids: [String]) {
        let missing = ids.filter { saved[$0] == nil }
        guard !missing.isEmpty else { return }
        Task { @MainActor in
            if !self.tradeRead, let on = try? await Backend.shared.tradeEnabled() { self.tradeOn = on; self.tradeRead = true }
            if let t = try? await Backend.shared.terms(of: missing) { self.saved.merge(t) { _, new in new } }
        }
    }
    /// Update (⌘R): read again, the admin may have changed them
    func reload(_ ids: [String]) {
        Task { @MainActor in
            if let t = try? await Backend.shared.terms(of: ids) { self.saved.merge(t) { _, new in new } }
            if let on = try? await Backend.shared.tradeEnabled() { self.tradeOn = on }
        }
    }

    /// the record's artists by listing id (release_line_artists): suggested first in the link menu, derived links
    @Published var artists: [String: [ArtistRef]] = [:]
    /// the Discogs release id of each listing (nil = none: no From Discogs)
    @Published var discogs: [String: Int] = [:]
    @Published var titling: String?
    func loadArtists(_ id: String) {
        guard artists[id] == nil else { return }
        Task { @MainActor in
            if let r = try? await Backend.shared.recordInfo(of: id) {
                self.artists[id] = r.artists.map { ArtistRef(id: $0.id, name: $0.name, note: nil) }
                if let d = r.discogs { self.discogs[id] = d }
            }
        }
    }
    /// From Discogs (admin, 0111): Custom title = "Artist - Title" of the release; links = its artists found in it
    func titleFromDiscogs(_ id: String) {
        guard let rid = discogs[id], titling == nil else { return }
        titling = id; error = nil
        Task { @MainActor in
            do {
                let t = try await Backend.shared.discogsTitle(rid)
                var f = self.form(id)
                f.title = t
                f.links = TitleLink.auto(t, artists: (self.artists[id] ?? []).map { ($0.id, $0.name) })
                self.set(id, f)
            } catch { self.error = error.localizedDescription }
            self.titling = nil
        }
    }

    /// the saved form; a listing without stored links shows the record's artists found in its title (admin autoTitleLinks)
    func baseline(_ id: String) -> PriceForm? {
        guard let s = saved[id] else { return nil }
        var f = PriceForm(s)
        if f.linksDerived, let a = artists[id] { f.links = TitleLink.auto(f.title, artists: a.map { ($0.id, $0.name) }) }
        return f
    }
    func form(_ id: String) -> PriceForm { edits[id] ?? baseline(id) ?? PriceForm() }
    func set(_ id: String, _ f: PriceForm) {
        if let b = baseline(id), b == f { edits[id] = nil } else { edits[id] = f }
        error = nil
    }
    func dirty(_ id: String) -> Bool { edits[id] != nil }

    /// Saves the open form; `then` runs once it is saved (Save and next)
    func save(_ id: String, then: (() -> Void)? = nil) {
        guard let f = edits[id] else { then?(); return }
        guard let t = f.terms(id: id) else { error = f.priceError; return }
        saving = id; error = nil
        Task { @MainActor in
            do {
                let oldTitle = self.saved[id]?.custom_title ?? "", newTitle = t.custom_title ?? ""
                let s = try await Backend.shared.saveTerms(t)
                self.saved[id] = s
                if let now = self.edits[id], now == f { self.edits[id] = nil }   // typed meanwhile: keep the newer text
                self.savedAt[id] = Date()
                if newTitle != oldTitle { self.onTitleChanged?() }
                self.saving = nil
                then?()
            } catch {
                self.saving = nil; self.error = error.localizedDescription
            }
        }
    }

    /// The draft row chip (Figma `media status` kind=price): "25 · VG+", "Offer · VG+", "– · VG", "–"
    func media(_ id: String) -> (text: String, state: AppModel.MediaState, note: String)? {
        guard let t = saved[id] else { return nil }
        let price: String? = t.isOffers ? "Offer" : t.price_cents.map(PriceForm.centsText) ?? (t.section == "trade" ? "Trade" : nil)
        let grade = t.graded ? t.condition_media : nil
        let state: AppModel.MediaState = t.priced && t.graded ? .complete : (price != nil || grade != nil ? .partial : .none)
        let text = price == nil && grade == nil ? "–" : "\(price ?? "–") · \(grade ?? "–")"
        let missing = [t.priced ? nil : "price", t.graded ? nil : "grading of side A"].compactMap { $0 }
        return (text, state, missing.isEmpty ? "Price and grading saved" : "Missing: " + missing.joined(separator: ", "))
    }
}

// MARK: Views

/// `price panel` (centre): the admin's Price block (`price fields`) and Conditions block
struct PricePanel: View {
    @ObservedObject var pricing: PricingModel
    @ObservedObject var drafts: DraftSession
    var body: some View {
        if let d = drafts.draft {
            let f = Binding(get: { pricing.form(d.id) }, set: { pricing.set(d.id, $0) })
            ScrollView {
                VStack(alignment: .leading, spacing: 32) {
                    VStack(alignment: .leading, spacing: 16) {   // Title block (admin: Custom title, Gio 2026-11-27)
                        Text("Title").labelStyle(16)
                        LinkedTitleInput(label: "Custom title", text: f.title, links: f.links, suggested: pricing.artists[d.id] ?? [])
                        if pricing.discogs[d.id] != nil {   // `custom title` boolean `from discogs` (0111)
                            Button(pricing.titling == d.id ? "From Discogs…" : "From Discogs") { pricing.titleFromDiscogs(d.id) }
                                .buttonStyle(ZButtonStyle(primary: false)).disabled(pricing.titling != nil)
                        }
                    }
                    Rectangle().fill(Theme.divider).frame(height: 1)
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Price").labelStyle(16)
                        HStack(alignment: .top, spacing: 0) {
                            Marker(text: "€€")
                            HStack(alignment: .top, spacing: 16) {
                                SelectField(label: "Sale type", value: f.saleType, width: 144,
                                            options: [("sale", "For sale"), ("offers", "Best offer")]
                                                + (pricing.tradeOn || f.wrappedValue.saleType == "trade" ? [("trade", "For trade")] : []))
                                if f.wrappedValue.saleType == "offers" {
                                    Text("No fixed price: buyers send offers, you accept or decline them in Offers.")
                                        .bodyStyle(14).fixedSize(horizontal: false, vertical: true).padding(.top, 20)
                                } else {
                                    TextInput(label: "Price", optional: f.wrappedValue.saleType == "trade", text: f.price, suffix: "€",
                                              error: f.wrappedValue.priceError).frame(width: 144)
                                }
                            }
                        }
                    }
                    Rectangle().fill(Theme.divider).frame(height: 1)
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Conditions").labelStyle(16)
                        HStack(alignment: .top, spacing: 16) {
                            SelectField(label: "Side A conditions", value: f.sideA, options: PriceForm.grades.map { ($0, $0) }, empty: true)
                            SelectField(label: "Side B conditions", optional: true, value: f.sideB, options: PriceForm.grades.map { ($0, $0) }, empty: true)
                        }
                        TextInput(label: "Conditions comment", optional: true, text: f.notes)
                        HStack(alignment: .top, spacing: 16) {
                            SelectField(label: "Cover", value: f.sleeveType, options: PriceForm.sleeves)
                            if f.wrappedValue.sleeveType != "none" {
                                SelectField(label: "Cover conditions", optional: true, value: f.sleeveCondition, options: PriceForm.grades.map { ($0, $0) }, empty: true)
                            } else { Color.clear.frame(maxWidth: .infinity, maxHeight: 1) }
                        }
                    }
                    Rectangle().fill(Theme.divider).frame(height: 1)
                    VStack(alignment: .leading, spacing: 16) {   // Description block (admin: notes)
                        Text("Description").labelStyle(16)
                        TextInput(label: "Description / comment", optional: true, text: f.description)
                    }
                }
                .padding(24)
            }
            .disabled(pricing.saved[d.id] == nil)   // not read yet: nothing to overwrite with blanks
            .task(id: d.id) { pricing.loadArtists(d.id) }
        } else {
            Text("Pick a draft on the left").bodyStyle(14, color: Theme.textModerate).padding(24)
            Spacer(minLength: 0)
        }
    }
}

/// Right column of the Price tab: draft head, `price save` (shop preview, Save, Save and next, status)
struct PriceColumn: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject var pricing: PricingModel
    @ObservedObject var drafts: DraftSession
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            DraftHead(drafts: drafts)
            if let d = drafts.draft {
                let f = pricing.form(d.id)
                VStack(alignment: .leading, spacing: 12) {
                    Text("In the shop").labelStyle(12)
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(preview(f), id: \.self) { Text($0).bodyStyle(12).fixedSize(horizontal: false, vertical: true) }
                    }
                    HStack(spacing: 8) {
                        Button("Save") { pricing.save(d.id) }.buttonStyle(ZButtonStyle())
                            .keyboardShortcut("s", modifiers: .command)
                        Button("Save and next") { saveAndNext(d) }.buttonStyle(ZButtonStyle(primary: false))
                            .keyboardShortcut(.return, modifiers: .command)
                    }
                    .disabled(pricing.saving != nil || pricing.saved[d.id] == nil)
                    Text(status(d.id)).bodyStyle(12, color: pricing.error == nil ? Theme.textModerate : Theme.alert)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
            Text(drafts.signIn.isSignedIn ? "Signed in" : "Signed out").bodyStyle(12, color: Theme.textModerate)
        }
        .padding(24)
        .frame(maxHeight: .infinity, alignment: .top)
    }

    /// The lines the shop shows (apps/storefront/pages/shell.js: priceText, gradingProps)
    func preview(_ f: PriceForm) -> [String] {
        var lines: [String] = []
        switch f.saleType {
        case "offers": lines.append("Best offer")
        case "trade": lines.append("For trade")
        default:
            if case .some(.some(let c)) = PriceForm.cents(f.price) { lines.append((c % 100 == 0 ? "\(c / 100)" : String(format: "%.2f", Double(c) / 100)) + "€") }
            else { lines.append("No price yet") }
        }
        let note = f.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        let cover = f.sleeveType != "none" && !f.sleeveCondition.isEmpty ? "Cover: \(f.sleeveCondition)" : nil
        if !f.sideA.isEmpty {
            let record = "Record: " + [f.sideA, f.sideB].filter { !$0.isEmpty }.joined(separator: " / ")
            lines.append(note.isEmpty || cover != nil ? record : "\(record) (\(note))")
        } else { lines.append("No grading yet") }
        if let cover { lines.append(cover); if !note.isEmpty { lines.append("(\(note))") } }
        return lines
    }

    func status(_ id: String) -> String {
        if let e = pricing.error { return e }
        if pricing.saving == id { return "Saving…" }
        let keys = "⌘S saves, ⌘↩ saves and opens the next draft"
        if pricing.saved[id] == nil { return "Reading the draft from the admin…" }
        if pricing.dirty(id) { return "Not saved yet · " + keys }
        if let t = pricing.savedAt[id] { return "Saved at \(t.formatted(date: .omitted, time: .shortened)) · " + keys }
        return keys
    }

    func saveAndNext(_ d: DraftSummary) {
        pricing.save(d.id) {
            let list = drafts.results
            guard let i = list.firstIndex(where: { $0.id == d.id }), i + 1 < list.count else { return }
            drafts.pick(list[i + 1])
        }
    }
}

/// `marker` (listing form, 0114): 48 × 48 circle, decorative
struct Marker: View {
    let text: String
    var body: some View {
        Text(text).font(Theme.body(20)).foregroundColor(Theme.textStrong)
            .frame(width: 48, height: 48).overlay(Circle().stroke(Theme.divider, lineWidth: 1))
            .accessibilityHidden(true)
    }
}

/// `input` type=select: label (+ Optional), a menu that looks like the field
struct SelectField: View {
    let label: String
    var optional = false
    @Binding var value: String
    var width: CGFloat? = nil
    let options: [(String, String)]
    /// an empty first choice (grades are optional on a draft)
    var empty = false
    @StateObject private var anchor = MenuAnchor()
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            FieldHead(label: label, optional: optional)
            // The field is drawn here (border, ground, chevron: Figma `input` select); a click opens the native menu over
            // it. SwiftUI's Menu would draw its own popup and drop the border (Gio 2026-11-26/27).
            Button { anchor.pop(items: (empty ? [("", "—")] : []) + options, selected: value) { value = $0 } } label: {
                HStack {
                    Text(options.first { $0.0 == value }?.1 ?? "").bodyStyle(16)
                    Spacer()
                    Image(systemName: "chevron.down").font(.system(size: 12, weight: .light)).foregroundColor(Theme.textStrong)
                }
                .padding(.horizontal, 12).frame(height: 40)
                .background(Theme.surfaceSubtle)
                .overlay(Rectangle().stroke(Theme.divider, lineWidth: 1))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .background(MenuAnchorView(anchor: anchor))
            .accessibilityLabel(label)
        }
        .frame(maxWidth: width ?? .infinity, alignment: .leading)
        .frame(width: width)
    }
}

/// `input` type=text field: label (+ Optional), field, suffix, error under it
struct TextInput: View {
    let label: String
    var optional = false
    @Binding var text: String
    var suffix: String? = nil
    var error: String? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            FieldHead(label: label, optional: optional)
            HStack {
                TextField("", text: $text).textFieldStyle(.plain).font(Theme.body(16)).accessibilityLabel(label)
                if let suffix { Text(suffix).bodyStyle(16, color: Theme.textModerate) }
            }
            .padding(.horizontal, 12).frame(height: 40)
            .background(Theme.surfaceSubtle)
            .overlay(Rectangle().stroke(error == nil ? Theme.divider : Theme.alert, lineWidth: 1))
            if let error { Text(error).bodyStyle(12, color: Theme.alert).fixedSize(horizontal: false, vertical: true) }
        }
    }
}

struct FieldHead: View {
    let label: String
    var optional = false
    var body: some View {
        HStack {
            FieldLabel(text: label)
            Spacer()
            if optional { Text("Optional").bodyStyle(14, color: Theme.textModerate) }
        }
    }
}

/// `media status` kind=price: "€" and the price · side A grade; colour = state, the text says it without colour
struct PriceChip: View {
    let text: String
    let state: AppModel.MediaState
    let note: String
    var body: some View {
        let (bg, fg): (Color, Color) = {
            switch state {
            case .none: return (Theme.alert, Theme.onAlert)
            case .partial: return (Theme.warning, Theme.onWarning)
            case .complete: return (Theme.success, Theme.onSuccess)
            }
        }()
        HStack(spacing: 2) {
            Text("€").font(Theme.body(12))
            Text(text).font(Theme.body(12))
        }
        .foregroundColor(fg)
        .padding(.vertical, 2).padding(.horizontal, 4)
        .background(bg)
        .help(note)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Price and grading \(text): \(note)")
    }
}

/// Opens a native NSMenu over a SwiftUI view (the select's field): the selected item sits on the field, like a popup
final class MenuAnchor: ObservableObject {
    weak var view: NSView?
    func pop(items: [(String, String)], selected: String, pick: @escaping (String) -> Void) {
        guard let view else { return }
        let menu = NSMenu()
        menu.autoenablesItems = false
        var current: NSMenuItem?
        for (v, title) in items {
            let item = ClosureMenuItem(title: title) { pick(v) }
            item.state = v == selected ? .on : .off
            if v == selected { current = item }
            menu.addItem(item)
        }
        menu.minimumWidth = view.bounds.width
        menu.font = NSFont(name: "Inter-Regular", size: 14) ?? .menuFont(ofSize: 14)
        menu.popUp(positioning: current, at: NSPoint(x: 4, y: view.isFlipped ? 9 : view.bounds.height - 9), in: view)
    }
}

final class ClosureMenuItem: NSMenuItem {
    private let run: () -> Void
    init(title: String, run: @escaping () -> Void) {
        self.run = run
        super.init(title: title, action: #selector(fire), keyEquivalent: "")
        target = self
    }
    required init(coder: NSCoder) { fatalError("not used") }
    @objc private func fire() { run() }
}

struct MenuAnchorView: NSViewRepresentable {
    let anchor: MenuAnchor
    func makeNSView(context: Context) -> NSView { let v = NSView(); anchor.view = v; return v }
    func updateNSView(_ v: NSView, context: Context) { anchor.view = v }
}

/// One artist link over the custom title (listings.custom_title_links, 0147): UTF-16 offsets, as the admin's LinkedInput
struct TitleLink: Codable, Equatable {
    var start: Int
    var end: Int
    var artist_id: String?
    var name: String

    var json: [String: Any] { ["start": start, "end": end, "artist_id": artist_id.map { $0 as Any } ?? NSNull(), "name": name] }

    /// The record's artists found as whole words in the title, first match each (admin autoTitleLinks + LinkedInput.find)
    static func auto(_ title: String, artists: [(id: String, name: String)]) -> [TitleLink] {
        let t = title as NSString, lower = title.lowercased() as NSString
        var out: [TitleLink] = []
        for a in artists where !a.name.isEmpty && !out.contains(where: { $0.artist_id == a.id }) {
            let part = a.name.lowercased() as NSString
            var from = 0
            while from < lower.length {
                let r = lower.range(of: part as String, range: NSRange(location: from, length: lower.length - from))
                if r.location == NSNotFound { break }
                let before = r.location > 0 ? t.substring(with: NSRange(location: r.location - 1, length: 1)) : ""
                let afterAt = r.location + r.length
                let after = afterAt < t.length ? t.substring(with: NSRange(location: afterAt, length: 1)) : ""
                if !word(before) && !word(after) && !out.contains(where: { r.location < $0.end && afterAt > $0.start }) {
                    out.append(TitleLink(start: r.location, end: afterAt, artist_id: a.id, name: a.name)); break
                }
                from = r.location + 1
            }
        }
        return out.sorted { $0.start < $1.start }
    }
    private static func word(_ c: String) -> Bool { c.range(of: #"[\p{L}\p{N}]"#, options: .regularExpression) != nil }

    /// Links follow an edit of the title (admin LinkedInput.shift): text before and after the change keeps its links
    static func shift(_ links: [TitleLink], from a: String, to b: String) -> [TitleLink] {
        let x = Array(a.utf16), y = Array(b.utf16)
        var pre = 0; while pre < x.count && pre < y.count && x[pre] == y[pre] { pre += 1 }
        var suf = 0; while suf < x.count - pre && suf < y.count - pre && x[x.count - 1 - suf] == y[y.count - 1 - suf] { suf += 1 }
        let oldEnd = x.count - suf, newEnd = y.count - suf, delta = y.count - x.count
        func ms(_ v: Int) -> Int { v >= oldEnd ? v + delta : v <= pre ? v : newEnd }
        func me(_ v: Int) -> Int { v <= pre ? v : v >= oldEnd ? v + delta : pre }
        return links.map { TitleLink(start: ms($0.start), end: me($0.end), artist_id: $0.artist_id, name: $0.name) }.filter { $0.end > $0.start }
    }
}

/// An artist the title can link to: id + official name; `note` = the alias that matched a search
struct ArtistRef: Hashable { let id: String; let name: String; let note: String? }

extension TitleLink {
    /// admin linksCut: the characters [s, e) leave their links (a link can split)
    static func cut(_ links: [TitleLink], _ s: Int, _ e: Int) -> [TitleLink] {
        var out: [TitleLink] = []
        for l in links {
            if l.end <= s || l.start >= e { out.append(l); continue }
            if l.start < s { out.append(TitleLink(start: l.start, end: s, artist_id: l.artist_id, name: l.name)) }
            if l.end > e { out.append(TitleLink(start: e, end: l.end, artist_id: l.artist_id, name: l.name)) }
        }
        return tidy(out)
    }
    /// admin linksTidy: sorted, no empty link, the same artist touching = one link
    static func tidy(_ links: [TitleLink]) -> [TitleLink] {
        var out: [TitleLink] = []
        for l in links.filter({ $0.end > $0.start }).sorted(by: { $0.start < $1.start }) {
            if var p = out.last, (p.artist_id != nil && l.artist_id != nil ? p.artist_id == l.artist_id : p.name == l.name), p.end >= l.start {
                p.end = max(p.end, l.end); out[out.count - 1] = p
            } else { out.append(l) }
        }
        return out
    }
}
