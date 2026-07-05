import SwiftUI

@main
struct HolyPadelWatchApp: App {
    @StateObject private var sync = WatchConnectivityManager()
    @StateObject private var workout = WorkoutManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sync)
                .environmentObject(workout)
        }
    }
}
