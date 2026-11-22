import SwiftUI

@main
struct ZanzaScannerApp: App {
    @StateObject private var model = AppModel()

    @MainActor init() { Snapshot.runIfAsked(); TestScan.runIfAsked(); GlassSnapshot.runIfAsked() }

    var body: some Scene {
        WindowGroup("Rythem-Works Scanner") {
            ContentView(scanner: model.scanner)
                .environmentObject(model)
                .onAppear { if !CommandLine.arguments.contains("--test-scan") { model.scanner.start(); model.pasteNames(onlyIfNew: true) } }
        }
        .defaultSize(width: 1440, height: 900)
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(replacing: .undoRedo) {
                Button("Undo") {
                    if model.tab == .samples && model.session.canUndo { model.session.undo() }
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
