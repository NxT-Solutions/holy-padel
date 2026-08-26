// Pure Swift port of packages/scoring/src/types.ts.
//
// Value types only — no Foundation dependency, no platform (WatchKit/HealthKit) imports.
// The canonical engine is the TypeScript one; this must reproduce its behaviour exactly
// (see packages/scoring/vectors/golden.json).

/// One of the two pairs on court.
public enum TeamId: String, Sendable, Equatable {
    case A
    case B
}

/// How a game is decided from deuce — the three official options of FIP Rule 1.
public enum DeuceMode: String, Sendable, Equatable {
    case advantage
    case starPoint
    case goldenPoint
}

/// What is played when a best-of-3 match reaches one set all.
public enum ThirdSetMode: String, Sendable, Equatable {
    case fullSet
    case advantageSet
    case superTieBreak
}

/// Best-of length of the match.
public enum BestOf: Int, Sendable, Equatable {
    case one = 1
    case three = 3
    case five = 5
}

public enum SquashMode: String, Sendable, Equatable {
    case par
    case hiho
}

public enum SquashTiebreak: String, Sendable, Equatable {
    case winByTwo
    case setOne
    case setTwo
}

public enum MatchConfig: Sendable, Equatable {
    case padel(bestOf: BestOf, deuceMode: DeuceMode, thirdSet: ThirdSetMode, firstServe: TeamId)
    case squash(bestOf: BestOf, squashMode: SquashMode, squashTarget: Int, squashTiebreak: SquashTiebreak, firstServe: TeamId)

    public var bestOf: BestOf {
        switch self {
        case .padel(let bestOf, _, _, _): return bestOf
        case .squash(let bestOf, _, _, _, _): return bestOf
        }
    }
    public var firstServe: TeamId {
        switch self {
        case .padel(_, _, _, let firstServe): return firstServe
        case .squash(_, _, _, _, let firstServe): return firstServe
        }
    }
}

/// The only mutating event of a match: a rally ended and `winner` won it.
public struct PointEvent: Sendable, Equatable {
    public let winner: TeamId
    /// Epoch milliseconds — used for durations, never for scoring.
    public let at: Int

    public init(winner: TeamId, at: Int) {
        self.winner = winner
        self.at = at
    }
}

/// A per-team pair of values.
public struct TeamValues<T: Sendable & Equatable>: Sendable, Equatable {
    public let A: T
    public let B: T

    public init(A: T, B: T) {
        self.A = A
        self.B = B
    }

    public subscript(_ team: TeamId) -> T {
        team == .A ? A : B
    }
}

/// Display call for a standard game: 0, 15, 30, 40 or advantage.
public enum PointCall: String, Sendable, Equatable {
    case love = "0"
    case fifteen = "15"
    case thirty = "30"
    case forty = "40"
    case advantage = "AD"
}

public enum TieBreakKind: String, Sendable, Equatable {
    case setTieBreak
    case superTieBreak
}

/// A finished set (a super tie-break counts as the deciding set).
public struct SetSummary: Sendable, Equatable {
    public enum Kind: String, Sendable, Equatable {
        case set
        case superTieBreak
    }

    public let games: TeamValues<Int>
    /// Present when the set was decided by a tie-break at 6-6.
    public let tieBreak: TeamValues<Int>?
    public let winner: TeamId
    public let kind: Kind
}

/// What the current point means — drives the status pill in the live UI.
public enum Moment: Sendable, Equatable {
    case normal
    case gamePoint(team: TeamId)
    case setPoint(team: TeamId)
    case matchPoint(team: TeamId)
    case deuce
    case advantage(team: TeamId)
    case goldenPoint
    case starPoint
    case tieBreak(setNumber: Int)
    case superTieBreak
    case finished(winner: TeamId)
}

/// The live game being played, in one of its two shapes.
public enum CurrentGame: Sendable, Equatable {
    case standard(points: TeamValues<Int>, calls: TeamValues<PointCall>)
    case tieBreak(tieBreakKind: TieBreakKind, target: Int, points: TeamValues<Int>)
    case squash(points: TeamValues<Int>)
}



/// Everything the UI needs about a match, derived from config + events.
public struct MatchSnapshot: Sendable, Equatable {
    public let config: MatchConfig
    public let finished: Bool
    public let winner: TeamId?
    public let completedSets: [SetSummary]
    /// 1-based number of the set in play (or the last one when finished).
    public let setNumber: Int
    /// Games in the set in play; zeros when the match is finished.
    public let currentSetGames: TeamValues<Int>
    /// The game in play; nil once the match is finished.
    public let currentGame: CurrentGame?
    /// Team serving the point in play (tie-break rotation included).
    public let servingTeam: TeamId

    public let moment: Moment
    /// Rally points won over the whole match.
    public let totalPoints: TeamValues<Int>
    /// Games won over the whole match (tie-breaks count as one game).
    public let totalGames: TeamValues<Int>
}
