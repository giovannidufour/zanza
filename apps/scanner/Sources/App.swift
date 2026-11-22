import SwiftUI

@main
struct ZanzaScannerApp: App {
    @StateObject private var model = AppModel()

    @MainActor init() { Snapshot.runIfAsked(); TestScan.runIfAsked() }

    var body: some Scene {
        WindowGroup("Zanza Scanner") {
            ContentView(scanner: model.scanner)
                .environmentObject(model)
                .onAppear { if !CommandLine.arguments.contains("--test-scan") { model.scanner.start(); model.pasteNames(onlyIfNew: true) } }
        }
        .windowResizability(.contentMinSize)
    }
}
