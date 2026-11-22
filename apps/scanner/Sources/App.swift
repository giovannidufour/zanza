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
            CommandGroup(after: .appInfo) {
                Button("Sign Out of the Admin") { model.drafts.signOut() }
            }
        }
    }
}
