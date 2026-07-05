import SwiftUI

// MARK: - Idle

struct IdleView: View {
    let state: MatchState
    let onStartLast: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Text("NO LIVE MATCH")
                .font(.system(size: 12, weight: .semibold))
                .tracking(1)
                .foregroundStyle(Court.white.opacity(0.5))

            if let last = state.last {
                HStack(spacing: 6) {
                    ResultBadge(won: last.won)
                    Text(last.line)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Court.white.opacity(0.55))
                        .lineLimit(1)
                }
            }

            Button(action: onStartLast) {
                VStack(spacing: 1) {
                    Text("START MATCH")
                        .font(.system(size: 15, weight: .heavy))
                    if state.last != nil {
                        Text("LAST LINEUP")
                            .font(.system(size: 9, weight: .semibold))
                            .opacity(0.7)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .foregroundStyle(Court.ink)
                .background(Court.lime, in: Capsule())
            }
            .buttonStyle(.plain)

            Text("or set up on phone")
                .font(.system(size: 10))
                .foregroundStyle(Court.white.opacity(0.4))
        }
        .padding(.horizontal, 16)
        .multilineTextAlignment(.center)
    }
}

// MARK: - Live scoring

/// Apple-Workout-style sideways tabs: swipe between the **controls** (undo,
/// pause, stop-and-save, cancel) and the **scoreboard** (tap a team to score).
/// Separating the two keeps the score face uncluttered and makes an accidental
/// stop impossible while you're rapidly tapping points.
struct LiveView: View {
    let state: MatchState
    let liveBpm: Int
    let onScore: (String) -> Void
    let onUndo: () -> Void
    let onPause: () -> Void
    let onStop: () -> Void
    let onCancel: () -> Void

    // Land on the scoreboard — the surface you touch every rally; controls are
    // one swipe away.
    @State private var tab = Tab.score

    private enum Tab {
        case controls, score
    }

    var body: some View {
        TabView(selection: $tab) {
            ControlsTab(state: state, onUndo: onUndo, onPause: onPause, onStop: onStop, onCancel: onCancel)
                .tag(Tab.controls)
            ScoreTab(state: state, liveBpm: liveBpm, onScore: onScore)
                .tag(Tab.score)
        }
        .tabViewStyle(.page)
    }
}

/// The score face — the only thing on screen is the two tappable team rows.
private struct ScoreTab: View {
    let state: MatchState
    let liveBpm: Int
    let onScore: (String) -> Void

    var body: some View {
        VStack(spacing: 4) {
            header
            TeamScoreRow(
                short: state.teamA.short,
                point: state.pointA,
                serving: state.teamA.serving,
                paused: state.paused,
                onTap: { onScore("A") }
            )
            Rectangle().fill(Court.white.opacity(0.12)).frame(height: 1)
            TeamScoreRow(
                short: state.teamB.short,
                point: state.pointB,
                serving: state.teamB.serving,
                paused: state.paused,
                onTap: { onScore("B") }
            )
        }
        .padding(.horizontal, 14)
        .padding(.top, 2)
    }

    private var header: some View {
        HStack {
            // Live heart rate from the workout session, else the match clock.
            if liveBpm > 0 {
                Text("\(liveBpm)♥")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Court.lime)
            } else {
                Text(state.clock)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Court.white.opacity(0.5))
            }
            Spacer(minLength: 4)
            Text([state.setLabel, state.games].filter { !$0.isEmpty }.joined(separator: "  "))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Court.white.opacity(0.75))
                .lineLimit(1)
            Spacer(minLength: 4)
            if state.paused {
                HStack(spacing: 3) {
                    Circle().fill(Court.white.opacity(0.5)).frame(width: 6, height: 6)
                    Text("PAUSED")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Court.white.opacity(0.5))
                }
            } else {
                HStack(spacing: 3) {
                    Circle().fill(Court.lime).frame(width: 6, height: 6)
                    Text("LIVE").font(.system(size: 10, weight: .bold)).foregroundStyle(Court.lime)
                }
            }
        }
    }
}

/// The actions face — undo, pause/resume, the square stop-and-save, and a
/// guarded full cancel.
private struct ControlsTab: View {
    let state: MatchState
    let onUndo: () -> Void
    let onPause: () -> Void
    let onStop: () -> Void
    let onCancel: () -> Void

    @State private var confirmingCancel = false

    var body: some View {
        VStack(spacing: 9) {
            Text(state.paused ? "PAUSED" : "CONTROLS")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.5)
                .foregroundStyle(state.paused ? Court.white.opacity(0.5) : Court.lime)

            HStack(spacing: 18) {
                labeled("UNDO") {
                    CircleIcon(system: "arrow.uturn.backward", tint: Court.white, fill: Court.white.opacity(0.14), action: onUndo)
                        .disabled(state.paused)
                        .opacity(state.paused ? 0.35 : 1)
                }
                labeled(state.paused ? "RESUME" : "PAUSE") {
                    CircleIcon(
                        system: state.paused ? "play.fill" : "pause.fill",
                        tint: Court.ink,
                        fill: Court.lime,
                        diameter: 44,
                        action: onPause
                    )
                }
            }

            // Stop AND save — the square, "court time's up, don't lose the score".
            Button(action: onStop) {
                HStack(spacing: 6) {
                    Image(systemName: "stop.fill").font(.system(size: 13, weight: .bold))
                    Text("STOP & SAVE").font(.system(size: 14, weight: .heavy))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .foregroundStyle(Court.ink)
                .background(Court.lime, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)

            // Full cancel discards the match — guarded so a stray tap can't wipe it.
            Button(action: { confirmingCancel = true }) {
                Text("CANCEL MATCH")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Court.white.opacity(0.55))
            }
            .buttonStyle(.plain)
            .confirmationDialog("Discard this match?", isPresented: $confirmingCancel) {
                Button("Discard", role: .destructive, action: onCancel)
                Button("Keep playing", role: .cancel) {}
            } message: {
                Text("The score will be lost.")
            }
        }
        .padding(.horizontal, 14)
        .multilineTextAlignment(.center)
    }

    private func labeled<Content: View>(
        _ title: String,
        @ViewBuilder _ content: () -> Content
    ) -> some View {
        VStack(spacing: 3) {
            content()
            Text(title)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(Court.white.opacity(0.5))
        }
    }
}

/// A round icon button — compact and legible on the watch (no wrapping text).
private struct CircleIcon: View {
    let system: String
    let tint: Color
    let fill: Color
    var diameter: CGFloat = 36
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: diameter * 0.4, weight: .bold))
                .foregroundStyle(tint)
                .frame(width: diameter, height: diameter)
                .background(fill, in: Circle())
        }
        .buttonStyle(.plain)
    }
}

private struct TeamScoreRow: View {
    let short: String
    let point: String
    let serving: Bool
    let paused: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                HStack(spacing: 6) {
                    ServingDot(active: serving && !paused)
                    Text(short)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Court.white)
                        .lineLimit(1)
                }
                Spacer()
                Text(point)
                    .font(.system(size: 42, weight: .black, design: .rounded).monospacedDigit())
                    .foregroundStyle(Court.white)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(paused)
        .opacity(paused ? 0.35 : 1)
    }
}

// MARK: - Match won

struct WonView: View {
    let state: MatchState
    let onEnd: () -> Void

    var body: some View {
        VStack(spacing: 5) {
            Text("MATCH WON")
                .font(.system(size: 20, weight: .heavy))
                .foregroundStyle(Court.lime)
            Text(state.won?.winnerShort ?? state.teamA.short)
                .font(.system(size: 26, weight: .black))
                .foregroundStyle(Court.white)
                .lineLimit(1)
            Text(state.won?.scoreLine ?? state.games)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(Court.white.opacity(0.55))
                .lineLimit(1)
            Text([state.won?.duration ?? "", "SAVED TO PHONE"].filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Court.white.opacity(0.5))

            Button(action: onEnd) {
                Text("DONE")
                    .font(.system(size: 14, weight: .heavy))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .foregroundStyle(Court.ink)
                    .background(Court.lime, in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .padding(.horizontal, 14)
        .multilineTextAlignment(.center)
    }
}

// MARK: - Small shared pieces

private struct ServingDot: View {
    let active: Bool

    var body: some View {
        Circle()
            .fill(active ? Court.lime : Color.clear)
            .frame(width: 8, height: 8)
    }
}

private struct ResultBadge: View {
    let won: Bool

    var body: some View {
        Text(won ? "W" : "L")
            .font(.system(size: 12, weight: .black))
            .foregroundStyle(won ? Court.ink : Court.white)
            .frame(width: 20, height: 20)
            .background(
                won ? Court.lime : Court.white.opacity(0.15),
                in: RoundedRectangle(cornerRadius: 5)
            )
    }
}
