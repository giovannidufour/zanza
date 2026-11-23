import SwiftUI

@main
struct ZanzaScannerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var model = AppModel()

    @MainActor init() { Snapshot.runIfAsked(); TestScan.runIfAsked(); GlassSnapshot.runIfAsked() }

    var body: some Scene {
        WindowGroup("Rythem-Works Scanner") {
            ContentView(scanner: model.scanner)
                .environmentObject(model)
                .onAppear {
                    delegate.jobs = model.jobs; if !CommandLine.arguments.contains("--test-scan") { model.scanner.start(); model.syncFileName() } }
        }
        .defaultSize(width: 1440, height: 900)
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(replacing: .undoRedo) {
                Button("Undo") {
                    if model.tab == .samples && model.session.canUndo { model.session.undo() }
                    else if model.tab == .scans && model.angleBeforeTurn != nil && !(NSApp.keyWindow?.firstResponder is NSText) { model.undoTurn() }
                    else { NSApp.sendAction(Selector(("undo:")), to: nil, from: nil) }
                }.keyboardShortcut("z", modifiers: .command)
                Button("Redo") { NSApp.sendAction(Selector(("redo:")), to: nil, from: nil) }.keyboardShortcut("z", modifiers: [.command, .shift])
            }
            CommandGroup(after: .appInfo) {
                Button("Sign Out of the Admin") { model.drafts.signOut() }
                Button("Clear Samples Session…") {
                    let a = NSAlert(); a.messageText = "Clear the session?"
                    a.informativeText = "The local copies of the recordings and their assignments are removed. Exported files and the card are not touched."
                    a.addButton(withTitle: "Clear"); a.addButton(withTitle: "Cancel")
                    if a.runModal() == .alertFirstButtonReturn { model.session.clear() }
                }
            }
        }
    }
}

/// Quitting while a job runs asks first (0143)
final class AppDelegate: NSObject, NSApplicationDelegate {
    weak var jobs: JobQueue?
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard let n = jobs?.activeCount, n > 0 else { return .terminateNow }
        let a = NSAlert()
        a.messageText = "Quit and stop \(n) job\(n == 1 ? "" : "s")?"
        a.informativeText = "Exports and pushes still running or waiting will not finish."
        a.addButton(withTitle: "Quit"); a.addButton(withTitle: "Cancel")
        return a.runModal() == .alertFirstButtonReturn ? .terminateNow : .terminateCancel
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
