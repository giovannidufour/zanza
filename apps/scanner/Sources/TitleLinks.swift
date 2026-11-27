import SwiftUI
import AppKit

/// Custom title with artist links, as the admin's `LinkedInput` (decision 0147; Figma BACKEND → Create → `custom title`,
/// `title link bar`, `title link menu`; Gio's card 2026-11-27 "Come in admin"):
/// links are character ranges drawn underlined in the field. Select characters, or click a link or a name of the record:
/// the bar under the field offers Link artist / Change link and Clear link / Remove link. Link artist or ⌘K opens the
/// menu: a search box, the record's artists first ("Suggested" / "On this record"), then the artists that match.
/// Clear unlinks exactly the selected characters. Typing moves the links with the text (admin LinkedInput.shift).
struct LinkedTitleInput: View {
    let label: String
    @Binding var text: String
    @Binding var links: [TitleLink]
    /// the record's artists (suggested first in the menu, and a click on their name selects it)
    let suggested: [ArtistRef]

    /// the range the bar acts on; `whole` = a link clicked as a whole (Change link / Remove link)
    struct Target: Equatable { var start: Int; var end: Int; var x: CGFloat; var whole: TitleLink? }
    @State private var target: Target?
    @State private var menuOpen = false
    @State private var focusTick = 0   // bumps to give the focus back to the field (after the menu)
    @State private var selectEnd: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            FieldHead(label: label, optional: true)
            LinkedTextField(text: $text, links: $links, names: suggested.map(\.name), focusTick: focusTick, selectEnd: $selectEnd,
                            onTarget: { t in target = t; if t == nil { menuOpen = false } },
                            onCommandK: { if target != nil { menuOpen = true } })
                .frame(height: 40)
                .background(Theme.surfaceSubtle)
                .overlay(Rectangle().stroke(Theme.divider, lineWidth: 1))
                .overlay(alignment: .topLeading) {
                    if let t = target {
                        Group {
                            if menuOpen {
                                LinkMenu(text: substring(t), suggested: suggested, current: t.whole,
                                         pick: { a in link(t, a) }, close: { menuOpen = false; focusTick += 1 })
                            } else {
                                bar(t)
                            }
                        }
                        .offset(x: min(t.x, 320), y: 44)
                    }
                }
                .zIndex(1)
        }
        .zIndex(1)
    }

    /// `title link bar`: two small secondary buttons; they never take the focus from the field
    func bar(_ t: Target) -> some View {
        let inside = links.contains { $0.start < t.end && $0.end > t.start }
        return HStack(spacing: 4) {
            Button(t.whole != nil ? "Change link" : "Link artist") { menuOpen = true }
                .buttonStyle(SmallButtonStyle()).help("⌘K")
            if inside {
                Button(t.whole != nil ? "Remove link" : "Clear link") {
                    links = TitleLink.cut(links, t.start, t.end); target = nil; focusTick += 1
                }.buttonStyle(SmallButtonStyle())
            }
        }
        .padding(4).background(Theme.surfaceBase).overlay(Rectangle().stroke(Theme.divider, lineWidth: 1))
    }

    func substring(_ t: Target) -> String {
        let u = Array(text.utf16)
        guard t.start >= 0, t.end <= u.count, t.start < t.end else { return "" }
        return String(utf16CodeUnits: Array(u[t.start..<t.end]), count: t.end - t.start)
    }

    func link(_ t: Target, _ a: ArtistRef) {
        links = TitleLink.tidy(TitleLink.cut(links, t.start, t.end) + [TitleLink(start: t.start, end: t.end, artist_id: a.id, name: a.name)])
        menuOpen = false; target = nil
        selectEnd = t.end; focusTick += 1
    }
}

/// `button` secondary, size extra-small (the bar's buttons)
struct SmallButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.labelStyle(12).padding(.horizontal, 8).frame(height: 28)
            .overlay(Rectangle().stroke(Theme.textStrong, lineWidth: 1))
            .background(configuration.isPressed ? Theme.surfaceHover : Theme.surfaceBase)
            .contentShape(Rectangle())
    }
}

/// `title link menu`: search box + options (the record's artists first, then matches from the admin's artists)
struct LinkMenu: View {
    let text: String
    let suggested: [ArtistRef]
    let current: TitleLink?
    let pick: (ArtistRef) -> Void
    let close: () -> Void
    @State private var query = ""
    @State private var found: [ArtistRef] = []
    @State private var active = 0
    @FocusState private var focused: Bool

    var list: [(ArtistRef, String?)] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        var sug = suggested.filter { q.isEmpty || $0.name.lowercased().contains(q) }
        let x = text.trimmingCharacters(in: .whitespaces).lowercased()
        // admin LinkMenu: the record artist the selected text names goes first, marked Suggested
        let guess = x.isEmpty ? nil : sug.first { a in
            let n = a.name.lowercased()
            return n.contains(x) || n.split(separator: " ").contains { $0.count > 2 && x.contains($0) }
        }
        if let g = guess { sug = [g] + sug.filter { $0 != g } }
        let taken = Set(sug.map(\.id))
        let rows: [(ArtistRef, String?)] = sug.map { ($0, $0 == guess && current == nil ? "Suggested" : "On this record") }
            + found.filter { !taken.contains($0.id) }.map { ($0, $0.note) }
        return Array(rows.prefix(8))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TextField("Search artist", text: $query)
                .textFieldStyle(.plain).font(Theme.body(16)).focused($focused)
                .padding(.horizontal, 12).frame(height: 40)
                .onSubmit { let l = list; if !l.isEmpty { pick(l[min(active, l.count - 1)].0) } }
                .onExitCommand { close() }
            Rectangle().fill(Theme.divider).frame(height: 1)
            let l = list
            ForEach(Array(l.enumerated()), id: \.offset) { i, row in
                let isCurrent = current.map { c in c.artist_id != nil ? c.artist_id == row.0.id : c.name == row.0.name } ?? false
                Button { pick(row.0) } label: {
                    HStack {
                        Text(row.0.name).bodyStyle(16)
                        Spacer()
                        if let n = row.1 { Text(n).bodyStyle(12, color: Theme.textModerate) }
                        if isCurrent { Image(systemName: "checkmark").font(.system(size: 12)) }
                    }
                    .padding(.horizontal, 12).frame(height: 36)
                    .background(i == active ? Theme.surfaceHover : Color.clear)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .onHover { if $0 { active = i } }
            }
        }
        .frame(width: 320)
        .background(Theme.surfaceBase)
        .overlay(Rectangle().stroke(Theme.divider, lineWidth: 1))
        .onAppear { focused = true }
        .task(id: query) {
            let q = query.trimmingCharacters(in: .whitespaces)
            guard q.count >= 2 else { found = []; return }
            try? await Task.sleep(nanoseconds: 200_000_000)
            guard !Task.isCancelled else { return }
            if let r = try? await Backend.shared.searchArtists(q), !Task.isCancelled { found = r; active = 0 }
        }
    }
}

/// The field itself: a one-line NSTextView, links underlined, selection reported in UTF-16 offsets (as the admin's input)
struct LinkedTextField: NSViewRepresentable {
    @Binding var text: String
    @Binding var links: [TitleLink]
    let names: [String]
    let focusTick: Int
    @Binding var selectEnd: Int?
    let onTarget: (LinkedTitleInput.Target?) -> Void
    let onCommandK: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeNSView(context: Context) -> NSScrollView {
        let tv = OneLineTextView()
        tv.delegate = context.coordinator
        tv.onCommandK = { context.coordinator.parent.onCommandK() }
        tv.font = NSFont(name: "Inter-Regular", size: 16) ?? .systemFont(ofSize: 16)
        tv.textColor = .black
        tv.drawsBackground = false
        tv.isRichText = false
        tv.allowsUndo = true
        tv.isHorizontallyResizable = true
        tv.isVerticallyResizable = false
        tv.textContainer?.widthTracksTextView = false
        tv.textContainer?.containerSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: 40)
        tv.textContainer?.maximumNumberOfLines = 1
        tv.textContainerInset = NSSize(width: 12, height: 10)
        tv.string = text
        let sv = NSScrollView()
        sv.drawsBackground = false
        sv.hasHorizontalScroller = false
        sv.hasVerticalScroller = false
        sv.documentView = tv
        tv.minSize = NSSize(width: 0, height: 40)
        tv.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: 40)
        tv.autoresizingMask = [.height]
        context.coordinator.textView = tv
        context.coordinator.underline()
        return sv
    }

    func updateNSView(_ sv: NSScrollView, context: Context) {
        let c = context.coordinator
        c.parent = self
        guard let tv = c.textView else { return }
        if tv.string != text { c.applying = true; tv.string = text; c.applying = false }
        tv.frame.size.width = max(sv.contentSize.width, tv.frame.width)
        c.underline()
        if c.lastFocusTick != focusTick {
            c.lastFocusTick = focusTick
            DispatchQueue.main.async {
                tv.window?.makeFirstResponder(tv)
                if let e = selectEnd { tv.setSelectedRange(NSRange(location: e, length: 0)); selectEnd = nil }
            }
        }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: LinkedTextField
        weak var textView: OneLineTextView?
        var applying = false
        var lastFocusTick = 0
        init(_ p: LinkedTextField) { parent = p; lastFocusTick = p.focusTick }

        func underline() {
            guard let tv = textView, let lm = tv.layoutManager else { return }
            let all = NSRange(location: 0, length: (tv.string as NSString).length)
            lm.removeTemporaryAttribute(.underlineStyle, forCharacterRange: all)
            for l in parent.links where l.end <= all.length && l.start < l.end {
                lm.addTemporaryAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue, forCharacterRange: NSRange(location: l.start, length: l.end - l.start))
            }
        }

        func textDidChange(_ n: Notification) {
            guard !applying, let tv = textView else { return }
            let new = tv.string, old = parent.text
            parent.links = TitleLink.shift(parent.links, from: old, to: new)   // inside a link stays in it
            parent.text = new
            parent.onTarget(nil)
            underline()
        }

        func textViewDidChangeSelection(_ n: Notification) {
            guard !applying, let tv = textView else { return }
            let r = tv.selectedRange()
            let mouse = NSApp.currentEvent.map { [NSEvent.EventType.leftMouseUp, .leftMouseDown, .leftMouseDragged].contains($0.type) } ?? false
            let shift = NSApp.currentEvent?.modifierFlags.contains(.shift) == true
            func open(_ s: Int, _ e: Int, _ whole: TitleLink?) {
                var x: CGFloat = 0
                if let lm = tv.layoutManager, let tc = tv.textContainer {
                    let g = lm.glyphRange(forCharacterRange: NSRange(location: s, length: 0), actualCharacterRange: nil)
                    x = lm.boundingRect(forGlyphRange: g, in: tc).minX + tv.textContainerInset.width - (tv.enclosingScrollView?.contentView.bounds.minX ?? 0)
                }
                parent.onTarget(LinkedTitleInput.Target(start: s, end: e, x: max(0, x), whole: whole))
            }
            if r.length > 0 { if mouse || shift { open(r.location, r.location + r.length, nil) }; return }
            guard mouse else { parent.onTarget(nil); return }
            let s = r.location
            if let at = parent.links.first(where: { s >= $0.start && s <= $0.end }) { open(at.start, at.end, at); return }
            for name in parent.names {   // a click on a name of the record selects it
                let found = TitleLink.auto(tv.string, artists: [("", name)])
                if let f = found.first, s >= f.start, s <= f.end { open(f.start, f.end, nil); return }
            }
            parent.onTarget(nil)
        }

        func textView(_ tv: NSTextView, doCommandBy sel: Selector) -> Bool {
            if sel == #selector(NSResponder.insertNewline(_:)) || sel == #selector(NSResponder.insertTab(_:)) {
                if sel == #selector(NSResponder.insertTab(_:)) { tv.window?.selectNextKeyView(nil) }
                return true
            }
            if sel == #selector(NSResponder.cancelOperation(_:)) { parent.onTarget(nil); return true }
            return false
        }
    }
}

/// ⌘K opens the menu (admin: ⌘K / Ctrl+K)
final class OneLineTextView: NSTextView {
    var onCommandK: (() -> Void)?
    override func performKeyEquivalent(with e: NSEvent) -> Bool {
        if window?.firstResponder === self, e.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command,
           e.charactersIgnoringModifiers?.lowercased() == "k" { onCommandK?(); return true }
        return super.performKeyEquivalent(with: e)
    }
}
