import SwiftUI

/// Routes purely off the mirrored `phase`, exactly like the Wear OS app — and
/// drives the workout session from phase transitions: a live match is a live
/// HealthKit workout.
struct ContentView: View {
    @EnvironmentObject private var sync: WatchConnectivityManager
    @EnvironmentObject private var workout: WorkoutManager

    var body: some View {
        ZStack {
            Court.ink.ignoresSafeArea()

            switch sync.state.phase {
            case .idle:
                IdleView(state: sync.state, onStartLast: sync.startLast)
            case .live:
                LiveView(
                    state: sync.state,
                    liveBpm: workout.heartRate,
                    onScore: sync.score,
                    onUndo: sync.undo,
                    onPause: sync.pause,
                    onStop: sync.stop,
                    onCancel: sync.cancel
                )
            case .won:
                WonView(state: sync.state, onEnd: sync.end)
            }
        }
        .onAppear {
            syncWorkout(to: sync.state.phase)
        }
        .onChange(of: sync.state.phase) { _, newPhase in
            syncWorkout(to: newPhase)
        }
        .onChange(of: sync.state.paused) { _, isPaused in
            if isPaused {
                workout.pause()
            } else {
                workout.resume()
            }
        }
    }

    private func syncWorkout(to phase: Phase) {
        if phase == .live {
            workout.start(startedAtMs: sync.state.startedAt)
        } else {
            workout.end()
        }
    }
}
