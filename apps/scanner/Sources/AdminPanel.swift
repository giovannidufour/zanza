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

    @ViewBuilder var picker: some View {
        if drafts.newDraftOpen { NewDraftPanel(drafts: drafts) } else { draftList }
    }

    var draftList: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {   // `draft picker` head with the `new draft` button (0145)
                Text("Drafts").labelStyle(12, color: Theme.textModerate)
                Spacer()
                Button("New draft") { drafts.openNewDraft() }.buttonStyle(ZButtonStyle(primary: false))
                    .keyboardShortcut("n", modifiers: .command)
            }
            HStack {
                TextField("SKU, artist, title, cat. no.", text: $drafts.query).textFieldStyle(.plain).font(Theme.body(16))
                Image(systemName: "magnifyingglass").foregroundColor(Theme.textModerate)
            }
            .padding(.horizontal, 12).frame(height: 40).background(Theme.surfaceSubtle)
            Text(drafts.busy ? "Searching…" : drafts.query.isEmpty ? "Latest drafts" : "\(drafts.results.count) drafts match “\(drafts.query)”")
                .labelStyle(10, color: Theme.textModerate)
            if let status = model.pushAllStatus { PushAllRow(status: status) { model.pushAll() } }
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(drafts.results) { d in
                        let open = drafts.draft?.id == d.id
                        VStack(alignment: .leading, spacing: 12) {
                            DraftResult(draft: d, scanned: drafts.scannedCount(d), imageSlots: drafts.slotCounts[d.id]?.images ?? 3,
                                        clips: model.clipCount(d), clipSlots: drafts.slotCounts[d.id]?.clips, selected: open,
                                        imageMedia: model.imageMedia(d), clipMedia: model.clipMedia(d), price: model.pricing.media(d.id),
                                        push: model.pushState(d), onPush: { model.push(d) },
                                        job: model.jobs.latest(for: d.id).flatMap { $0.seen ? nil : $0 }, jobs: model.jobs)
                                .onTapGesture { drafts.pick(d); model.jobs.markSeen(d.id) }
                        }
                        .background(open ? Theme.surfaceHover : Color.clear)
                        .overlay(Rectangle().stroke(open ? Theme.divider : Color.clear, lineWidth: 1))
                    }
                }
            }
            .frame(maxHeight: .infinity)
        }
        .onAppear { if drafts.results.isEmpty { drafts.search() } }
    }
}

/// `draft row` (0141): SKU, record, media status (images scanned/slots, clips/slots; grey = none)
struct DraftResult: View {
    let draft: DraftSummary
    let scanned: Int
    var imageSlots = 3
    var clips = 0
    var clipSlots: Int?
    var selected = false
    var imageMedia: AppModel.Media?
    var clipMedia: AppModel.Media?
    /// price · side A grade (0196); nil until read
    var price: (text: String, state: AppModel.MediaState, note: String)?
    var push: AppModel.PushState = .none
    var onPush: () -> Void = {}
    var job: JobQueue.Job?
    @ObservedObject var jobs: JobQueue
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
                HStack {
                    Text("SKU \(draft.skuText) · Draft").labelStyle(10, color: Theme.textModerate)
                    Spacer()
                    pushButton
                }
                Text(draft.title).bodyStyle(14).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 6) {   // media status chips (Figma 2446:26829): green = some, red = none
                    MediaChip(icon: "photo", media: imageMedia ?? AppModel.Media(count: scanned, state: scanned > 0 ? .partial : .none, note: ""))
                    MediaChip(icon: "waveform", media: clipMedia ?? AppModel.Media(count: clips, state: clips > 0 ? .partial : .none, note: ""))
                    if let price { PriceChip(text: price.text, state: price.state, note: price.note) }
                }
                if let job { JobLine(job: job, jobs: jobs) }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 8).padding(.horizontal, 12)
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
    let remove: () -> Void
    let open: () -> Void
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
            .contentShape(Rectangle())
            .onTapGesture { if slot.scanned { open() } }   // click a scanned thumbnail: lightbox
            .help(slot.scanned ? "Show the scan" : "")
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
                Button(action: remove) {   // icon-x 24: both files to the Trash (Undo in the head)
                    Image(systemName: "xmark").font(.system(size: 16, weight: .light)).foregroundColor(Theme.textStrong)
                        .frame(width: 24, height: 24).contentShape(Rectangle())
                }
                .buttonStyle(.plain).help("Move this scan to the Trash")
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
/// The open draft's slots in the right column (Gio 2026-11-23): Images in the Scans tab, Clips in the Samples tab
struct DraftDetail: View {
    enum Kind { case images, clips }
    @ObservedObject var drafts: DraftSession
    @ObservedObject var session: SessionModel
    @EnvironmentObject var model: AppModel
    var kind: Kind
    var body: some View {
        if drafts.draft != nil {
            if kind == .images { slotList } else { ScrollView { clipList } }
        }
    }

    /// Clips (0141): one slot per Discogs position; drop a session clip on it
    var clipList: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Clips").labelStyle(12)
                Spacer()
                Text(drafts.clips.isEmpty ? "No clip slots yet" : "\(drafts.clips.filter { session.clip(assignedTo: $0.name) != nil }.count) assigned")
                    .bodyStyle(12, color: Theme.textModerate)
            }
            ForEach(drafts.clips, id: \.name) { c in
                ClipSlotRow(slot: c, clip: session.clip(assignedTo: c.name), session: session, drafts: drafts)
            }
        }
    }

    // MARK: Picked draft

    func draftHead(_ d: DraftSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("SKU \(d.skuText) · Draft").labelStyle(12, color: Theme.textModerate)
            Text(d.title).labelStyle(16).lineLimit(3).help(d.title)
        }
    }

    var slotList: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {   // images head (Figma 2439:1860)
                Text("Images").labelStyle(12)
                Spacer()
                Text("\(drafts.slots.filter(\.scanned).count) scanned").bodyStyle(12, color: Theme.textModerate)
            }
            List {
                ForEach(Array(drafts.slots.enumerated()), id: \.element.id) { i, slot in
                    ImageSlotRow(index: i, label: i < drafts.names.count ? drafts.names[i].label : "",
                                 name: i < drafts.names.count ? drafts.names[i].name : "",
                                 slot: slot, isTarget: drafts.target == i,
                                 remove: { drafts.remove(at: i) }, open: { drafts.lightbox = i })
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
            .frame(minHeight: 150, idealHeight: CGFloat(drafts.slots.count) * 76, maxHeight: CGFloat(drafts.slots.count) * 76)
            Text("Drag scanned images to change the order: files are renamed").bodyStyle(12, color: Theme.textModerate)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Lightbox (Figma `image lightbox` 2441:24959): scrim over the window, white panel, role + file name, x; ← → steps
/// through the scans, Esc or x closes.
struct Lightbox: View {
    @ObservedObject var drafts: DraftSession
    @State private var image: CGImage?
    var body: some View {
        if let i = drafts.lightbox {
            ZStack {
                Color.black.opacity(0.48).ignoresSafeArea()   // surface/scrim
                    .onTapGesture { drafts.lightbox = nil }
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Image \(i + 1) · \(i < drafts.names.count ? drafts.names[i].label : "")").labelStyle(10, color: Theme.textModerate)
                            Text(i < drafts.names.count ? drafts.names[i].name : "").bodyStyle(14)
                        }
                        Spacer()
                        Button { drafts.lightbox = nil } label: {
                            Image(systemName: "xmark").font(.system(size: 20, weight: .light)).foregroundColor(Theme.textStrong)
                        }
                        .buttonStyle(.plain).keyboardShortcut(.escape, modifiers: [])
                    }
                    ZStack {
                        Rectangle().fill(Theme.surfaceSubtle)
                        if let image { Image(decorative: image, scale: 1).resizable().scaledToFit() }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    // ← → step through the scans
                    Button("") { drafts.stepLightbox(-1) }.keyboardShortcut(.leftArrow, modifiers: []).hidden().frame(width: 0, height: 0)
                    Button("") { drafts.stepLightbox(1) }.keyboardShortcut(.rightArrow, modifiers: []).hidden().frame(width: 0, height: 0)
                }
                .padding(.horizontal, 24).padding(.vertical, 16)
                .background(Theme.surfaceBase)
                .padding(40)
            }
            .onAppear { image = drafts.image(at: i) }
            .onChange(of: drafts.lightbox) { new in image = new.flatMap { drafts.image(at: $0) } }
        }
    }
}

/// `push all` (0165, Figma 2519:7929): what is pending in the list + one button that pushes it; synced = check icon
struct PushAllRow: View {
    let status: AppModel.PushAllStatus
    let action: () -> Void
    var body: some View {
        HStack(spacing: 8) {
            Text(status.summary).labelStyle(10, color: Theme.textModerate)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.updatesFrequently)
            if let title = status.button {
                Button(title, action: action).buttonStyle(ZButtonStyle(primary: false))
                    .disabled(status.state == .pushing)
                    .keyboardShortcut("p", modifiers: [.command, .shift])
                    .help("Push every listed draft that is not synced (⇧⌘P)")
                    .accessibilityLabel(status.state == .pushing ? "Pushing drafts to the admin"
                                        : "Push \(status.count) draft\(status.count == 1 ? "" : "s") to the admin")
            } else {
                Image(systemName: "checkmark.circle").font(.system(size: 16, weight: .light)).frame(width: 24, height: 24)
                    .padding(.trailing, 12).accessibilityLabel("All listed drafts synced")
            }
        }
        .accessibilityElement(children: .contain)
    }
}

extension DraftResult {
    /// `push status` (0142): upload = push, check = synced, warning = failed (tooltip = reason); hidden with nothing to push
    @ViewBuilder var pushButton: some View {
        switch push {
        case .none: EmptyView()
        case .push, .pushing, .failed:
            let pushing: Bool = { if case .pushing = push { return true }; return false }()
            let failed: String? = { if case .failed(let m) = push { return m }; return nil }()
            Button(action: onPush) {
                Image(systemName: failed != nil ? "exclamationmark.circle" : "arrow.up.circle")
                    .font(.system(size: 16, weight: .light)).frame(width: 24, height: 24)
                    .opacity(pushing ? 0.4 : 1).contentShape(Rectangle())
            }
            .buttonStyle(.plain).disabled(pushing)
            .help(failed.map { "Push failed: \($0). Press to retry" } ?? "Push SKU \(draft.skuText) to the admin")
            .accessibilityLabel("Push SKU \(draft.skuText) to the admin")
        case .synced:
            Image(systemName: "checkmark.circle").font(.system(size: 16, weight: .light)).frame(width: 24, height: 24)
                .help("SKU \(draft.skuText) synced with the admin").accessibilityLabel("SKU \(draft.skuText) synced")
        }
    }
}

/// `media status` (0144): none = red (surface/alert), partial = orange (surface/warning), complete = green
/// (surface/success); the number always shows, the tooltip says what is missing
struct MediaChip: View {
    let icon: String
    let media: AppModel.Media
    var body: some View {
        let (bg, fg): (Color, Color) = {
            switch media.state {
            case .none: return (Theme.alert, Theme.onAlert)
            case .partial: return (Theme.warning, Theme.onWarning)
            case .complete: return (Theme.success, Theme.onSuccess)
            }
        }()
        HStack(spacing: 2) {
            Image(systemName: icon).font(.system(size: 12)).frame(width: 16, height: 16)
            Text("\(media.count)").font(Theme.body(12))
        }
        .foregroundColor(fg)
        .padding(.top, 2).padding(.bottom, 2).padding(.leading, 2).padding(.trailing, 4)
        .background(bg)
        .help(media.note)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(icon == "photo" ? "Images" : "Clips") \(media.count): \(media.note)")
    }
}

/// `new draft panel` (0145): Discogs search → pick a release → the draft is made by the backend and selected.
/// States: results | duplicate | creating | no results. No photo (Gio is always at the laptop).
struct NewDraftPanel: View {
    @ObservedObject var drafts: DraftSession
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("New draft from Discogs").labelStyle(12, color: Theme.textModerate)
                Spacer()
                Button("Cancel") { drafts.closeNewDraft() }.buttonStyle(ZButtonStyle(primary: false)).keyboardShortcut(.escape, modifiers: [])
            }
            HStack {
                TextField("Artist, title, label or cat. no.", text: $drafts.discogsQuery).textFieldStyle(.plain).font(Theme.body(16))
                Image(systemName: "magnifyingglass").foregroundColor(Theme.textModerate)
            }
            .padding(.horizontal, 12).frame(height: 40).background(Theme.surfaceSubtle)
            if let t = drafts.creating {
                Text("Creating the draft of \(t)…").bodyStyle(12, color: Theme.textModerate)
            } else if let dup = drafts.duplicate {
                VStack(alignment: .leading, spacing: 8) {
                    Text(dup.release.title).bodyStyle(14)
                    ForEach(dup.existing, id: \.id) { e in
                        Text("You already have SKU \(e.sku) (\(e.status)) of this release.").bodyStyle(12)
                    }
                    HStack(spacing: 8) {
                        if let e = dup.existing.first(where: { $0.status == "draft" }) ?? dup.existing.first {
                            Button("Open \(e.sku)") { Task { await drafts.openDraft(id: e.id, sku: e.sku) } }.buttonStyle(ZButtonStyle(primary: false))
                        }
                        Button("Create another") { drafts.create(from: dup.release, force: true) }.buttonStyle(ZButtonStyle())
                    }
                }
                .padding(12).background(Theme.surfaceHover).overlay(Rectangle().stroke(Theme.divider, lineWidth: 1))
            } else if drafts.discogsQuery.trimmingCharacters(in: .whitespaces).count < 3 {
                Text("Type at least 3 characters").bodyStyle(12, color: Theme.textModerate)
            } else if drafts.discogsSearching {
                Text("Searching Discogs…").bodyStyle(12, color: Theme.textModerate)
            } else if drafts.discogsResults.isEmpty {
                Text("No release found. Try the catalogue number, or fewer words.").bodyStyle(12, color: Theme.textModerate)
            }
            if drafts.creating == nil && drafts.duplicate == nil {
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(drafts.discogsResults) { r in
                            HStack(alignment: .top, spacing: 12) {
                                ZStack {
                                    Rectangle().fill(Theme.surfaceSubtle)
                                    if let t = r.thumb, let u = URL(string: t), !t.isEmpty {
                                        AsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
                                    }
                                }
                                .frame(width: 40, height: 40).clipped()
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(r.title).bodyStyle(14).fixedSize(horizontal: false, vertical: true)
                                    if let m = r.meta, !m.isEmpty { Text(m).bodyStyle(12, color: Theme.textModerate).fixedSize(horizontal: false, vertical: true) }
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.vertical, 8).padding(.horizontal, 12)
                            .contentShape(Rectangle())
                            .onTapGesture { drafts.create(from: r) }
                            .help("Create a draft of this release")
                        }
                    }
                }
                .frame(maxHeight: .infinity)
            }
        }
    }
}
