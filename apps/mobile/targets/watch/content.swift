import SwiftUI

/// Routes purely off the mirrored `phase`, exactly like the Wear OS app.
struct ContentView: View {
    @EnvironmentObject private var sync: WatchConnectivityManager

    var body: some View {
        ZStack {
            Court.ink.ignoresSafeArea()

            switch sync.state.phase {
            case .idle:
                IdleView(state: sync.state, onStartLast: sync.startLast)
            case .live:
                LiveView(state: sync.state, onScore: sync.score, onUndo: sync.undo)
            case .won:
                WonView(state: sync.state)
            }
        }
    }
}
