import AppKit
import SwiftUI

/// One feedback for every removal (decision 0149): the DS toast (message + Undo + ×), no confirmation.
/// Undo (button, or ⌘Z while it is up) puts the files back from the Trash and restores the app state.
final class ToastCenter: ObservableObject {
    struct Item: Identifiable {
        let id = UUID()
        let message: String
        let undo: (() -> String?)?      // returns an error to show inline, nil = done
    }
    @Published var item: Item?
    @Published var error: String?
    private var timer: Timer?
    var hovering = false { didSet { if hovering { timer?.invalidate() } else { arm() } } }

    /// A new removal replaces the toast: the earlier one stays done (its files stay in the Trash)
    func show(_ message: String, undo: (() -> String?)? = nil) {
        item = Item(message: message, undo: undo); error = nil
        NSAccessibility.post(element: NSApp as Any, notification: .announcementRequested,
                             userInfo: [.announcement: message, .priority: NSAccessibilityPriorityLevel.medium.rawValue])
        arm()
    }
    func dismiss() { timer?.invalidate(); item = nil; error = nil }
    @discardableResult func performUndo() -> Bool {
        guard let u = item?.undo else { return false }
        if let e = u() { error = e; arm() } else { dismiss() }
        return true
    }
    private func arm() {   // about 6 s, paused while the pointer is over it
        timer?.invalidate()
        guard item != nil, !hovering else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 6, repeats: false) { [weak self] _ in self?.dismiss() }
    }
}

/// Files moved to the Trash, with the URL the Trash gave each (so Undo can put them back where they were)
struct Trashed {
    var moves: [(trashed: URL, original: URL)] = []
    @discardableResult mutating func trash(_ url: URL) -> Bool {
        guard FileManager.default.fileExists(atPath: url.path) else { return false }
        var t: NSURL?
        guard (try? FileManager.default.trashItem(at: url, resultingItemURL: &t)) != nil, let tu = t as URL? else { return false }
        moves.append((tu, url)); return true
    }
    /// back from the Trash; fails (and leaves them there) when an original path is taken again
    func restore() -> String? {
        for m in moves where FileManager.default.fileExists(atPath: m.original.path) {
            return "Can't restore: \(m.original.lastPathComponent) exists"
        }
        for m in moves {
            try? FileManager.default.createDirectory(at: m.original.deletingLastPathComponent(), withIntermediateDirectories: true)
            do { try FileManager.default.moveItem(at: m.trashed, to: m.original) }
            catch { return "Can't restore \(m.original.lastPathComponent): \(error.localizedDescription)" }
        }
        return nil
    }
}

/// DS `toast` (2177:439): white, dashed [16,16] border, message, Undo, ×; top right, 16 below the title bar, 400 wide
struct ToastView: View {
    @ObservedObject var center: ToastCenter
    var body: some View {
        if let t = center.item {
            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 12) {
                    Text(t.message).bodyStyle(14).fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if t.undo != nil {
                        Button("Undo") { center.performUndo() }.buttonStyle(ZButtonStyle(primary: false))
                            .accessibilityLabel("Undo: \(t.message)")
                    }
                    Button { center.dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 14, weight: .light)).frame(width: 24, height: 24)
                    }
                    .buttonStyle(.plain).accessibilityLabel("Close")
                }
                .padding(13)
                .background(Theme.surfaceBase)
                .overlay(Rectangle().stroke(Theme.textStrong, style: StrokeStyle(lineWidth: 1, dash: [16, 16])))
                if let e = center.error { Text(e).bodyStyle(12, color: Theme.alert) }
            }
            .frame(width: 400)
            .onHover { center.hovering = $0 }
            .transition(.opacity.combined(with: .move(edge: .top)))
            .padding(.top, 16).padding(.trailing, 16)
        }
    }
}
