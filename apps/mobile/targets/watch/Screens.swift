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

struct LiveView: View {
    let state: MatchState
    let liveBpm: Int
    let onScore: (String) -> Void
    let onUndo: () -> Void
    let onPause: () -> Void
    let onEnd: () -> Void

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
            footer
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 4)
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

    private var footer: some View {
        HStack(spacing: 8) {
            Button(action: onUndo) {
                Text("UNDO")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Court.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .overlay(Capsule().stroke(Court.white.opacity(0.25), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(state.paused)
            .opacity(state.paused ? 0.4 : 1)

            Button(action: onPause) {
                Text(state.paused ? "RESUME" : "PAUSE")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(state.paused ? Court.ink : Court.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(state.paused ? Court.lime : Color.clear, in: Capsule())
                    .overlay(Capsule().stroke(Court.white.opacity(0.25), lineWidth: state.paused ? 0 : 1))
            }
            .buttonStyle(.plain)

            Spacer(minLength: 2)

            Button(action: onEnd) {
                Text("END")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Court.ink)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Court.white.opacity(0.85), in: Capsule())
            }
            .buttonStyle(.plain)
        }
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
