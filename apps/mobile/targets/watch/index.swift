import SwiftUI

@main
struct HolyPadelWatchApp: App {
    @StateObject private var sync = WatchConnectivityManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sync)
        }
    }
}
