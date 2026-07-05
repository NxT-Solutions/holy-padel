// Pure Swift port of packages/scoring/src/engine.ts.
//
// `computeMatch(config:events:)` folds a match from its config and the full list of
// point events, producing a `MatchSnapshot`. Mirrors the canonical TypeScript engine
// byte-for-byte in behaviour (verified against packages/scoring/vectors/golden.json).

private let ZERO = TeamValues<Int>(A: 0, B: 0)

/// The deciding set of a best-of-3 match, where third-set variants apply.
private let DECIDING_SET = 3

private struct FoldState {
    var completedSets: [SetSummary]
    var setGames: TeamValues<Int>
    var points: TeamValues<Int>
    var tieBreak: TieBreakKind?
    var tieBreakStarter: TeamId
    /// Server of the current standard game; after a game, the next game's server.
    var gameServer: TeamId
    var setNumber: Int
    var finished: Bool
    var winner: TeamId?
    var totalPoints: TeamValues<Int>
    var totalGames: TeamValues<Int>
}

private func bump(_ values: TeamValues<Int>, _ team: TeamId) -> TeamValues<Int> {
    team == .A ? TeamValues(A: values.A + 1, B: values.B) : TeamValues(A: values.A, B: values.B + 1)
}

private func setsWonBy(_ sets: [SetSummary], _ team: TeamId) -> Int {
    sets.filter { $0.winner == team }.count
}

private func initialState(_ config: MatchConfig) -> FoldState {
    FoldState(
        completedSets: [],
        setGames: ZERO,
        points: ZERO,
        tieBreak: nil,
        tieBreakStarter: config.firstServe,
        gameServer: config.firstServe,
        setNumber: 1,
        finished: false,
        winner: nil,
        totalPoints: ZERO,
        totalGames: ZERO
    )
}

private func isDecidingSet(_ config: MatchConfig, _ setNumber: Int) -> Bool {
    config.bestOf == .three && setNumber == DECIDING_SET
}

/// Is the set being played one that runs without a tie-break at 6-6?
private func currentSetHasTieBreak(_ config: MatchConfig, _ setNumber: Int) -> Bool {
    !(isDecidingSet(config, setNumber) && Rules.thirdSetWithoutTieBreak(config.thirdSet))
}

private func startNextSet(_ state: FoldState, _ config: MatchConfig) -> FoldState {
    let setNumber = state.setNumber + 1
    let superTieBreakDue =
        isDecidingSet(config, setNumber)
        && config.thirdSet == .superTieBreak
        && setsWonBy(state.completedSets, .A) == setsWonBy(state.completedSets, .B)
    var next = state
    next.setNumber = setNumber
    next.setGames = ZERO
    next.points = ZERO
    next.tieBreak = superTieBreakDue ? .superTieBreak : nil
    next.tieBreakStarter = state.gameServer
    return next
}

private func completeSet(_ state: FoldState, _ config: MatchConfig, _ summary: SetSummary) -> FoldState {
    var settled = state
    settled.completedSets = state.completedSets + [summary]
    let finished = setsWonBy(settled.completedSets, summary.winner) == Rules.setsToWin(config.bestOf)
    if finished {
        settled.finished = true
        settled.winner = summary.winner
        settled.points = ZERO
        return settled
    }
    return startNextSet(settled, config)
}

private func applyTieBreakPoint(_ state: FoldState, _ config: MatchConfig, _ winner: TeamId) -> FoldState {
    guard let kind = state.tieBreak else {
        // Mirrors the TS throw; unreachable in the fold since we check before calling.
        fatalError("not in a tie-break")
    }
    let target = kind == .superTieBreak ? Rules.superTieBreakTarget : Rules.tieBreakTarget
    let points = bump(state.points, winner)
    let loser = Rules.otherTeam(winner)
    if !Rules.tieBreakWon(target, points[winner], points[loser]) {
        var next = state
        next.points = points
        return next
    }
    let totalGames = bump(state.totalGames, winner)
    if kind == .superTieBreak {
        let summary = SetSummary(games: points, tieBreak: nil, winner: winner, kind: .superTieBreak)
        var withGames = state
        withGames.totalGames = totalGames
        return completeSet(withGames, config, summary)
    }
    let setGames = bump(state.setGames, winner)
    let summary = SetSummary(games: setGames, tieBreak: points, winner: winner, kind: .set)
    // FIP Rule 1, Tie-break pt 5: the pair who did not begin serving in the
    // tie-break serves first in the following set.
    var afterTieBreak = state
    afterTieBreak.totalGames = totalGames
    afterTieBreak.setGames = setGames
    afterTieBreak.tieBreak = nil
    afterTieBreak.gameServer = Rules.otherTeam(state.tieBreakStarter)
    return completeSet(afterTieBreak, config, summary)
}

private func applyStandardPoint(_ state: FoldState, _ config: MatchConfig, _ winner: TeamId) -> FoldState {
    let points = bump(state.points, winner)
    let loser = Rules.otherTeam(winner)
    if !Rules.standardGameWon(config.deuceMode, points[winner], points[loser]) {
        var next = state
        next.points = points
        return next
    }
    let setGames = bump(state.setGames, winner)
    let totalGames = bump(state.totalGames, winner)
    var afterGame = state
    afterGame.points = ZERO
    afterGame.setGames = setGames
    afterGame.totalGames = totalGames
    afterGame.gameServer = Rules.otherTeam(state.gameServer)

    let withTieBreak = currentSetHasTieBreak(config, state.setNumber)
    if Rules.setWon(setGames[winner], setGames[loser], withTieBreak) {
        let summary = SetSummary(games: setGames, tieBreak: nil, winner: winner, kind: .set)
        return completeSet(afterGame, config, summary)
    }
    if Rules.tieBreakDue(setGames.A, setGames.B, withTieBreak) {
        var withTb = afterGame
        withTb.tieBreak = .setTieBreak
        withTb.tieBreakStarter = afterGame.gameServer
        return withTb
    }
    return afterGame
}

private func applyPoint(_ state: FoldState, _ config: MatchConfig, _ winner: TeamId) -> FoldState {
    if state.finished {
        fatalError("cannot score a point: the match is already finished")
    }
    var counted = state
    counted.totalPoints = bump(state.totalPoints, winner)
    if counted.tieBreak != nil {
        return applyTieBreakPoint(counted, config, winner)
    }
    return applyStandardPoint(counted, config, winner)
}

private func pointCalls(_ points: TeamValues<Int>) -> TeamValues<PointCall> {
    func call(_ own: Int, _ other: Int) -> PointCall {
        if own <= Rules.deucePoints {
            let calls: [PointCall] = [.love, .fifteen, .thirty, .forty]
            return calls[own]
        }
        return own > other ? .advantage : .forty
    }
    return TeamValues(A: call(points.A, points.B), B: call(points.B, points.A))
}

private func leaderOf(_ points: TeamValues<Int>) -> TeamId? {
    if points.A == points.B {
        return nil
    }
    return points.A > points.B ? .A : .B
}

private func standardGameMoment(_ state: FoldState, _ config: MatchConfig) -> Moment {
    let points = state.points
    let setGames = state.setGames
    let setNumber = state.setNumber
    let completedSets = state.completedSets

    if Rules.isDecidingPoint(config.deuceMode, points.A, points.B) {
        return config.deuceMode == .goldenPoint ? .goldenPoint : .starPoint
    }
    if points.A >= Rules.deucePoints && points.B >= Rules.deucePoints {
        guard let leader = leaderOf(points) else {
            return .deuce
        }
        return .advantage(team: leader)
    }
    guard let leader = leaderOf(points) else {
        return .normal
    }
    let loser = Rules.otherTeam(leader)
    if !Rules.standardGameWon(config.deuceMode, points[leader] + 1, points[loser]) {
        return .normal
    }
    let withTieBreak = currentSetHasTieBreak(config, setNumber)
    if !Rules.setWon(setGames[leader] + 1, setGames[loser], withTieBreak) {
        return .gamePoint(team: leader)
    }
    let setsAfter = setsWonBy(completedSets, leader) + 1
    if setsAfter == Rules.setsToWin(config.bestOf) {
        return .matchPoint(team: leader)
    }
    return .setPoint(team: leader)
}

private func deriveMoment(_ state: FoldState, _ config: MatchConfig) -> Moment {
    if state.finished {
        guard let winner = state.winner else {
            fatalError("finished match without a winner")
        }
        return .finished(winner: winner)
    }
    if state.tieBreak == .superTieBreak {
        return .superTieBreak
    }
    if state.tieBreak == .setTieBreak {
        return .tieBreak(setNumber: state.setNumber)
    }
    return standardGameMoment(state, config)
}

private func currentGameOf(_ state: FoldState) -> CurrentGame? {
    if state.finished {
        return nil
    }
    if let tieBreak = state.tieBreak {
        return .tieBreak(
            tieBreakKind: tieBreak,
            target: tieBreak == .superTieBreak ? Rules.superTieBreakTarget : Rules.tieBreakTarget,
            points: state.points
        )
    }
    return .standard(points: state.points, calls: pointCalls(state.points))
}

private func servingTeamOf(_ state: FoldState) -> TeamId {
    if state.tieBreak != nil {
        return Rules.tieBreakServer(state.tieBreakStarter, state.points.A + state.points.B)
    }
    return state.gameServer
}

private func toSnapshot(_ state: FoldState, _ config: MatchConfig) -> MatchSnapshot {
    MatchSnapshot(
        config: config,
        finished: state.finished,
        winner: state.winner,
        completedSets: state.completedSets,
        setNumber: state.finished ? state.completedSets.count : state.setNumber,
        currentSetGames: state.finished ? ZERO : state.setGames,
        currentGame: currentGameOf(state),
        servingTeam: servingTeamOf(state),
        moment: deriveMoment(state, config),
        totalPoints: state.totalPoints,
        totalGames: state.totalGames
    )
}

/// Fold a match from its config and the full list of point events.
///
/// Events after the match is decided are ignored rather than fatal, mirroring the
/// canonical engine's "break when finished" loop.
public func computeMatch(config: MatchConfig, events: [PointEvent]) -> MatchSnapshot {
    var state = initialState(config)
    for event in events {
        if state.finished {
            break
        }
        state = applyPoint(state, config, event.winner)
    }
    return toSnapshot(state, config)
}

/// Undo is just forgetting the last event — the fold does the rest.
public func undoLastPoint(_ events: [PointEvent]) -> [PointEvent] {
    events.isEmpty ? events : Array(events.dropLast())
}
