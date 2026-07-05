// Pure Swift port of packages/scoring/src/rules.ts.

enum Rules {
    /// Points needed to win a standard game before deuce rules kick in.
    static let gameTarget = 4
    /// Games needed to win a set (with a two-game margin).
    static let setTarget = 6
    /// Games in a 7-5 or 7-6 set — the hard ceiling of a tie-break set.
    static let extendedSetTarget = 7
    /// Points target of the tie-break played at 6-6 (FIP Rule 1, Tie-break pt 2).
    static let tieBreakTarget = 7
    /// Points target of the match-deciding super tie-break.
    static let superTieBreakTarget = 10
    /// Margin required to win a game from deuce, a set from 5-5, or any tie-break.
    static let winByTwo = 2
    /// Points each pair needs for deuce to be called.
    static let deucePoints = 3
    /// Point counts at which the star-point deciding rally is reached (deuce 3).
    static let starPointPoints = 5

    static func otherTeam(_ team: TeamId) -> TeamId {
        team == .A ? .B : .A
    }

    /// Has a standard game been won at `winnerPoints`–`loserPoints`?
    static func standardGameWon(_ mode: DeuceMode, _ winnerPoints: Int, _ loserPoints: Int) -> Bool {
        switch mode {
        case .advantage:
            return winnerPoints >= gameTarget && winnerPoints - loserPoints >= winByTwo
        case .goldenPoint:
            // The first deuce (3-3) is decided by a single golden point, so 4 always wins.
            return winnerPoints >= gameTarget
        case .starPoint:
            // Two advantage cycles, then deuce 3 (5-5) is decided by a single star point.
            return (winnerPoints >= gameTarget && winnerPoints - loserPoints >= winByTwo)
                || winnerPoints > starPointPoints
        }
    }

    /// Is the next rally the single deciding point of the game (golden or star point)?
    static func isDecidingPoint(_ mode: DeuceMode, _ pointsA: Int, _ pointsB: Int) -> Bool {
        if mode == .goldenPoint {
            return pointsA == deucePoints && pointsB == deucePoints
        }
        if mode == .starPoint {
            return pointsA == starPointPoints && pointsB == starPointPoints
        }
        return false
    }

    /// Does a set stand won at `winnerGames`–`loserGames` under normal set rules?
    static func setWon(_ winnerGames: Int, _ loserGames: Int, _ withTieBreak: Bool) -> Bool {
        if winnerGames >= setTarget && winnerGames - loserGames >= winByTwo {
            return true
        }
        // 7-5 is reached through the margin rule above; 7-6 only via the tie-break game.
        return withTieBreak && winnerGames == extendedSetTarget && loserGames == setTarget
    }

    /// Do the current games force a tie-break (6-6)?
    static func tieBreakDue(_ gamesA: Int, _ gamesB: Int, _ withTieBreak: Bool) -> Bool {
        withTieBreak && gamesA == setTarget && gamesB == setTarget
    }

    /// Has a tie-break to `target` points been won (two clear, unbounded)?
    static func tieBreakWon(_ target: Int, _ winnerPoints: Int, _ loserPoints: Int) -> Bool {
        winnerPoints >= target && winnerPoints - loserPoints >= winByTwo
    }

    /// Which team serves tie-break point `pointIndex` (0-based), given the starter.
    /// FIP pattern: 1 point, then 2 points per server, alternating pairs (1, 2, 2, 2, …).
    static func tieBreakServer(_ starter: TeamId, _ pointIndex: Int) -> TeamId {
        let serverBlock = (pointIndex + 1) / winByTwo
        return serverBlock % winByTwo == 0 ? starter : otherTeam(starter)
    }

    /// Does the third set of this configuration run without a tie-break?
    static func thirdSetWithoutTieBreak(_ mode: ThirdSetMode) -> Bool {
        mode == .advantageSet
    }

    /// Sets a team must win to take the match.
    static func setsToWin(_ bestOf: BestOf) -> Int {
        bestOf == .one ? 1 : winByTwo
    }
}
