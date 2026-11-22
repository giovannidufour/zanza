import SwiftUI

/// Column 1 (0138, Figma "Scanner v2 - wide, search column" 2437:1540): sign in, then the draft search, always visible;
/// the picked draft stays selected in the results.
struct DraftColumn: View {
    @ObservedObject var drafts: DraftSession
    @EnvironmentObject var model: AppModel
    @State private var email = Backend.shared.email ?? ""
    @State private var code = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            switch drafts.signIn {
            case .signedOut: signInEmail
            case .codeSent(let address): signInCode(address)
            case .signedIn: picker
            }
            if let e = drafts.error { Text(e).bodyStyle(12, color: Theme.alert).fixedSize(horizontal: false, vertical: true) }
        }
    }

    // MARK: Sign in

    var signInEmail: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Sign in to the admin").labelStyle(14)
            Text("The Scanner reads your drafts from the admin. Same email you use for the admin; we send you a code.")
                .bodyStyle(12, color: Theme.textModerate).fixedSize(horizontal: false, vertical: true)
            FieldLabel(text: "Email")
            TextField("Admin email", text: $email).textFieldStyle(.plain).font(Theme.body(16))
                .padding(.horizontal, 12).frame(height: 40).background(Theme.surfaceSubtle)
                .onSubmit { send() }
            Button("Send code") { send() }.buttonStyle(ZButtonStyle()).disabled(drafts.busy || !email.contains("@"))
        }
    }
    func send() { if email.contains("@") { drafts.sendCode(email) } }

    func signInCode(_ address: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Enter the code").labelStyle(14)
            Text("We sent a 6-digit code to \(address).").bodyStyle(12, color: Theme.textModerate)
            FieldLabel(text: "Code")
            TextField("123456", text: $code).textFieldStyle(.plain).font(Theme.body(16))
                .padding(.horizontal, 12).frame(height: 40).background(Theme.surfaceSubtle)
                .onSubmit { drafts.verify(code) }
            HStack(spacing: 12) {
                Button("Sign in") { drafts.verify(code) }.buttonStyle(ZButtonStyle()).disabled(drafts.busy || code.count < 6)
                Button("Other email") { drafts.signIn = .signedOut; code = "" }.buttonStyle(ZButtonStyle(primary: false))
            }
        }
    }

    // MARK: Pick a draft

    var picker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Drafts").labelStyle(12, color: Theme.textModerate)
            HStack {
                TextField("SKU, artist, title, cat. no.", text: $drafts.query).textFieldStyle(.plain).font(Theme.body(16))
                Image(systemName: "magnifyingglass").foregroundColor(Theme.textModerate)
            }
            .padding(.horizontal, 12).frame(height: 40).background(Theme.surfaceSubtle)
            Text(drafts.busy ? "Searching…" : drafts.query.isEmpty ? "Latest drafts" : "\(drafts.results.count) drafts match “\(drafts.query)”")
                .labelStyle(10, color: Theme.textModerate)
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(drafts.results) { d in
                        DraftResult(draft: d, scanned: drafts.scannedCount(d), selected: drafts.draft?.id == d.id)
                            .onTapGesture { drafts.pick(d) }
                    }
                }
            }
            .frame(maxHeight: .infinity)
        }
        .onAppear { if drafts.results.isEmpty { drafts.search() } }
    }
}

struct DraftResult: View {
    let draft: DraftSummary
    let scanned: Int
    var selected = false
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Rectangle().fill(Theme.surfaceSubtle)
                if let url = draft.photoURL {
                    AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
                }
            }
            .frame(width: 40, height: 40).clipped()
            VStack(alignment: .leading, spacing: 2) {
                Text("SKU \(draft.skuText) · Draft").labelStyle(10, color: Theme.textModerate)
                Text(draft.title).bodyStyle(14).fixedSize(horizontal: false, vertical: true)
                Text("\(scanned) of 3 images").labelStyle(10, color: Theme.textModerate)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 8).padding(.horizontal, 12)
        .background(selected ? Theme.surfaceHover : Color.clear)
        .overlay(Rectangle().stroke(selected ? Theme.divider : Color.clear, lineWidth: 1))
        .contentShape(Rectangle())
    }
}

/// `image slot` (Figma 2431:750): scanned (handle, check) · target (highlighted, "Next scan" tag, no handle) ·
/// empty (dashed thumbnail, "Not scanned", no handle). Rows without a handle are padded 36 so thumbnails line up.
struct ImageSlotRow: View {
    let index: Int
    let label: String
    let name: String
    let slot: Slot
    let isTarget: Bool
    var body: some View {
        HStack(spacing: 12) {
            if slot.scanned && !isTarget {
                Image(systemName: "line.3.horizontal").foregroundColor(Theme.textStrong).frame(width: 24)
            } else {
                Color.clear.frame(width: 24, height: 1)
            }
            ZStack {
                if slot.scanned, let t = slot.thumb { Image(decorative: t, scale: 1).resizable().scaledToFill() }
                else if slot.scanned { Rectangle().fill(Theme.surfaceSubtle) }
                else { Rectangle().strokeBorder(Theme.textModerate, style: StrokeStyle(lineWidth: 1, dash: [3, 3])) }
            }
            .frame(width: 40, height: 40).clipped()
            VStack(alignment: .leading, spacing: 2) {
                Text("Image \(index + 1) · \(label)").labelStyle(10, color: Theme.textModerate)
                Text(name).bodyStyle(13, color: slot.scanned || isTarget ? Theme.textStrong : Theme.textModerate)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            if isTarget {
                Text("Next scan").bodyStyle(12).padding(.horizontal, 4).padding(.vertical, 2)
                    .background(Color.black.opacity(0.08))   // tag item extra small: surface-support-1 (backend black-a8)
            } else if slot.scanned {
                Image(systemName: "checkmark.circle").font(.system(size: 18, weight: .light)).foregroundColor(Theme.textStrong)
            } else {
                Text("Not scanned").bodyStyle(12, color: Theme.textModerate)
            }
        }
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(isTarget ? Theme.surfaceHover : Color.clear)
        .overlay(Rectangle().stroke(isTarget ? Theme.divider : Color.clear, lineWidth: 1))
    }
}

/// Column 3 top (0138): the picked draft and its image positions
struct DraftDetail: View {
    @ObservedObject var drafts: DraftSession
    @EnvironmentObject var model: AppModel
    var body: some View {
        if let d = drafts.draft {
            VStack(alignment: .leading, spacing: 16) { draftHead(d); slotList }
        }
    }

    // MARK: Picked draft

    func draftHead(_ d: DraftSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("SKU \(d.skuText) · Draft").labelStyle(12, color: Theme.textModerate)
            Text(d.title).labelStyle(18).fixedSize(horizontal: false, vertical: true)
        }
    }

    var slotList: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {   // images head (Figma 2439:1860)
                Text("Images").labelStyle(12)
                Spacer()
                if drafts.lastRemoval != nil {
                    Button("Undo") { drafts.undoRemove() }.buttonStyle(.plain).bodyStyle(12).underline()
                }
                Text("\(drafts.slots.filter(\.scanned).count) of \(drafts.slots.count) scanned").bodyStyle(12, color: Theme.textModerate)
            }
            List {
                ForEach(Array(drafts.slots.enumerated()), id: \.element.id) { i, slot in
                    ImageSlotRow(index: i, label: i < drafts.names.count ? drafts.names[i].label : "",
                                 name: i < drafts.names.count ? drafts.names[i].name : "",
                                 slot: slot, isTarget: drafts.target == i)
                        .contentShape(Rectangle())
                        .onTapGesture { drafts.target = i; model.syncFileName() }
                        .contextMenu {
                            if slot.scanned { Button("Move Scan to Trash") { drafts.remove(at: i) } }
                        }
                        .moveDisabled(!slot.scanned)
                        .listRowInsets(EdgeInsets(top: 2, leading: 0, bottom: 2, trailing: 0))
                        .listRowSeparator(.hidden)
                }
                .onMove { drafts.move(from: $0, to: $1) }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .onDeleteCommand { if let t = drafts.target { drafts.remove(at: t) } }
            .frame(height: min(CGFloat(drafts.slots.count) * 72, 290))
            HStack(spacing: 12) {
                Button("Add image") { drafts.addImage() }.buttonStyle(ZButtonStyle(primary: false))
                Text("Drag scanned images (or ⌥↑ ⌥↓) to change the order: files are renamed").bodyStyle(12, color: Theme.textModerate)
                    .fixedSize(horizontal: false, vertical: true)
            }
            // ⌥↑ / ⌥↓ move the selected scanned image
            Button("") { drafts.moveTarget(by: -1) }.keyboardShortcut(.upArrow, modifiers: .option).hidden().frame(width: 0, height: 0)
            Button("") { drafts.moveTarget(by: 1) }.keyboardShortcut(.downArrow, modifiers: .option).hidden().frame(width: 0, height: 0)
        }
    }
}
