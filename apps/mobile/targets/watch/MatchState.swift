import Foundation

/// The watch mirrors the phone's live match. This is the decoded form of the
/// `/holy-padel/state` payload documented in docs/watch-sync.md. The watch runs
/// no scoring engine — every field here is computed on the phone.

enum Phase: String, Decodable {
    case idle
    case live
    case won
}

struct TeamState: Decodable {
    var short: String = ""
    var serving: Bool = false
}

struct WonState: Decodable {
    var winnerShort: String = ""
    var scoreLine: String = ""
    var duration: String = ""
}

struct LastState: Decodable {
    var line: String = ""
    var won: Bool = false
}

struct MatchState: Decodable {
    var v: Int = 1
    var phase: Phase = .idle
    var clock: String = ""
    var court: String?
    var setLabel: String = ""
    var teamA = TeamState()
    var teamB = TeamState()
    var pointA: String = "0"
    var pointB: String = "0"
    var games: String = ""
    var status: String = ""
    /// True while a live match is paused; scoring is disabled and the workout
    /// session is paused until the phone reports it resumed.
    var paused: Bool = false
    /// Epoch ms the match started — workout session start + dedup key. Nil when idle.
    var startedAt: Double?
    var won: WonState?
    var last: LastState?

    /// The blank state shown before the phone has pushed anything.
    static let idle = MatchState()
}

extension MatchState {
    private enum CodingKeys: String, CodingKey {
        case v, phase, clock, court, setLabel, teamA, teamB, pointA, pointB, games, status,
            paused, startedAt, won, last
    }

    /// Decode defensively: a missing or malformed field falls back to its default
    /// rather than discarding the whole update. The payload is latest-wins, so a
    /// partial decode still moves the watch forward and the next point self-heals.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        v = try c.decodeIfPresent(Int.self, forKey: .v) ?? 1
        phase = try c.decodeIfPresent(Phase.self, forKey: .phase) ?? .idle
        clock = try c.decodeIfPresent(String.self, forKey: .clock) ?? ""
        court = try c.decodeIfPresent(String.self, forKey: .court)
        setLabel = try c.decodeIfPresent(String.self, forKey: .setLabel) ?? ""
        teamA = try c.decodeIfPresent(TeamState.self, forKey: .teamA) ?? TeamState()
        teamB = try c.decodeIfPresent(TeamState.self, forKey: .teamB) ?? TeamState()
        pointA = try c.decodeIfPresent(String.self, forKey: .pointA) ?? "0"
        pointB = try c.decodeIfPresent(String.self, forKey: .pointB) ?? "0"
        games = try c.decodeIfPresent(String.self, forKey: .games) ?? ""
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? ""
        paused = try c.decodeIfPresent(Bool.self, forKey: .paused) ?? false
        startedAt = try c.decodeIfPresent(Double.self, forKey: .startedAt)
        won = try c.decodeIfPresent(WonState.self, forKey: .won)
        last = try c.decodeIfPresent(LastState.self, forKey: .last)
    }
}
