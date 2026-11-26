import SwiftUI

/// The Price tab (decision 0196, Figma page Scanner → `price · components`, screens "Scanner v3 - price tab, …"):
/// sale type, price and conditions of a draft, the same listing columns the admin's form writes
/// (packages/listing-draft/listing-draft.js → payloadOf). One source of truth: the app reads and writes those columns.

/// The listing columns of the admin's Price and Conditions blocks (Supabase public.listings)
struct ListingTerms: Codable, Equatable {
    static let columns = "id,section,price_mode,price_cents,condition_media,condition_media_b,condition_notes,sleeve_type,condition_sleeve"
    let id: String
    var section: String
    var price_mode: String?
    var price_cents: Int?
    var condition_media: String?
    var condition_media_b: String?
    var condition_notes: String?
    var sleeve_type: String?
    var condition_sleeve: String?

    /// The body of the PATCH: every column of the two blocks, null when empty (as admin_save_listing stores them)
    var patch: [String: Any] {
        func v(_ s: String?) -> Any { (s?.isEmpty == false) ? s! : NSNull() }
        return ["section": section, "price_mode": price_mode ?? "fixed", "price_cents": price_cents.map { $0 as Any } ?? NSNull(),
                "condition_media": v(condition_media), "condition_media_b": v(condition_media_b), "condition_notes": v(condition_notes),
                "sleeve_type": sleeve_type ?? "original", "condition_sleeve": sleeve_type == "none" ? NSNull() : v(condition_sleeve)]
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

    init() {}
    init(_ t: ListingTerms) {
        saleType = t.isOffers ? "offers" : t.section
        price = t.price_cents.map(PriceForm.centsText) ?? ""
        sideA = t.condition_media ?? ""; sideB = t.condition_media_b ?? ""; notes = t.condition_notes ?? ""
        sleeveType = t.sleeve_type ?? "original"; sleeveCondition = t.condition_sleeve ?? ""
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

    func terms(id: String) -> ListingTerms? {
        guard priceError == nil else { return nil }
        let cents = saleType == "offers" ? nil : (PriceForm.cents(price) ?? nil)
        let note = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        return ListingTerms(id: id, section: saleType == "offers" ? "sale" : saleType, price_mode: saleType == "offers" ? "offers" : "fixed",
                            price_cents: cents, condition_media: sideA, condition_media_b: sideB, condition_notes: note,
                            sleeve_type: sleeveType, condition_sleeve: sleeveType == "none" ? "" : sleeveCondition)
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

    func form(_ id: String) -> PriceForm { edits[id] ?? saved[id].map(PriceForm.init) ?? PriceForm() }
    func set(_ id: String, _ f: PriceForm) {
        if let s = saved[id], PriceForm(s) == f { edits[id] = nil } else { edits[id] = f }
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
                let s = try await Backend.shared.saveTerms(t)
                self.saved[id] = s
                if let now = self.edits[id], now == f { self.edits[id] = nil }   // typed meanwhile: keep the newer text
                self.savedAt[id] = Date()
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
                }
                .padding(24)
            }
            .disabled(pricing.saved[d.id] == nil)   // not read yet: nothing to overwrite with blanks
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
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            FieldHead(label: label, optional: optional)
            Menu {
                if empty { Button("—") { value = "" } }
                ForEach(options, id: \.0) { o in Button(o.1) { value = o.0 } }
            } label: {
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
            // .button + .plain: macOS draws our label (border, ground, chevron) instead of its own popup (Gio 2026-11-26)
            .menuStyle(.button).buttonStyle(.plain).menuIndicator(.hidden)
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
