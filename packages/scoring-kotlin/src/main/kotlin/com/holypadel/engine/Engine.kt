package com.holypadel.engine

/**
 * Pure Kotlin port of packages/scoring/src/engine.ts — the fold.
 *
 * `computeMatch(config, events)` replays the rally winners through the FIP
 * rules and derives a full [MatchSnapshot]. Kept structurally identical to the
 * TypeScript source so the golden vectors line up 1:1.
 */

private data class FoldState(
    val completedSets: List<SetSummary>,
    val setGames: TeamValues<Int>,
    val points: TeamValues<Int>,
    val tieBreak: TieBreakKind?,
    val tieBreakStarter: TeamId,
    /** Server of the current standard game; after a game, the next game's server. */
    val gameServer: TeamId,
    val serverConsecutivePoints: Int,
    val setNumber: Int,
    val finished: Boolean,
    val winner: TeamId?,
    val totalPoints: TeamValues<Int>,
    val totalGames: TeamValues<Int>,
)

private val ZERO = TeamValues(0, 0)

private fun bump(values: TeamValues<Int>, team: TeamId): TeamValues<Int> =
    if (team == TeamId.A) TeamValues(values.a + 1, values.b) else TeamValues(values.a, values.b + 1)

private fun setsWonBy(sets: List<SetSummary>, team: TeamId): Int =
    sets.count { it.winner == team }

private fun initialState(config: MatchConfig): FoldState =
    FoldState(
        completedSets = emptyList(),
        setGames = ZERO,
        points = ZERO,
        tieBreak = null,
        tieBreakStarter = config.firstServe,
        gameServer = config.firstServe,
        serverConsecutivePoints = 0,
        setNumber = 1,
        finished = false,
        winner = null,
        totalPoints = ZERO,
        totalGames = ZERO,
    )

/** The deciding set of a best-of-3 match, where third-set variants apply. */
private const val DECIDING_SET = 3

private fun isDecidingSet(config: MatchConfig, setNumber: Int): Boolean =
    config !is MatchConfig.Squash && config.bestOf == DECIDING_SET && setNumber == DECIDING_SET

/** Is the set being played one that runs without a tie-break at 6-6? */
private fun currentSetHasTieBreak(config: MatchConfig, setNumber: Int): Boolean {
    if (config is MatchConfig.Squash) return false
    val thirdSet = (config as? MatchConfig.Padel)?.thirdSet ?: ThirdSetMode.fullSet
    return !(isDecidingSet(config, setNumber) && thirdSetWithoutTieBreak(thirdSet))
}

private fun startNextSet(state: FoldState, config: MatchConfig): FoldState {
    val setNumber = state.setNumber + 1
    val superTieBreakDue =
        config is MatchConfig.Padel &&
        isDecidingSet(config, setNumber) &&
            config.thirdSet == ThirdSetMode.superTieBreak &&
            setsWonBy(state.completedSets, TeamId.A) == setsWonBy(state.completedSets, TeamId.B)
    return state.copy(
        setNumber = setNumber,
        setGames = ZERO,
        points = ZERO,
        tieBreak = if (superTieBreakDue) TieBreakKind.superTieBreak else null,
        tieBreakStarter = state.gameServer,
    )
}

private fun completeSet(state: FoldState, config: MatchConfig, summary: SetSummary): FoldState {
    val completedSets = state.completedSets + summary
    val finished = setsWonBy(completedSets, summary.winner) == setsToWin(config.bestOf)
    val settled = state.copy(completedSets = completedSets)
    if (finished) {
        return settled.copy(finished = true, winner = summary.winner, points = ZERO)
    }
    return startNextSet(settled, config)
}

private fun applyTieBreakPoint(state: FoldState, config: MatchConfig, winner: TeamId): FoldState {
    val kind = state.tieBreak ?: throw IllegalStateException("not in a tie-break")
    val target = if (kind == TieBreakKind.superTieBreak) SUPER_TIE_BREAK_TARGET else TIE_BREAK_TARGET
    val points = bump(state.points, winner)
    val loser = otherTeam(winner)
    if (!tieBreakWon(target, points[winner], points[loser])) {
        return state.copy(points = points)
    }
    val totalGames = bump(state.totalGames, winner)
    if (kind == TieBreakKind.superTieBreak) {
        val summary = SetSummary(games = points, tieBreak = null, winner = winner, kind = SetKind.superTieBreak)
        return completeSet(state.copy(totalGames = totalGames), config, summary)
    }
    val setGames = bump(state.setGames, winner)
    val summary = SetSummary(games = setGames, tieBreak = points, winner = winner, kind = SetKind.set)
    // FIP Rule 1, Tie-break pt 5: the pair who did not begin serving in the
    // tie-break serves first in the following set.
    val afterTieBreak =
        state.copy(
            totalGames = totalGames,
            setGames = setGames,
            tieBreak = null,
            gameServer = otherTeam(state.tieBreakStarter),
        )
    return completeSet(afterTieBreak, config, summary)
}

private fun applyStandardPoint(state: FoldState, config: MatchConfig, winner: TeamId): FoldState {
    if (config is MatchConfig.Squash) throw IllegalStateException("not padel")
    val padelConfig = config as MatchConfig.Padel
    val points = bump(state.points, winner)
    val loser = otherTeam(winner)
    if (!standardGameWon(padelConfig.deuceMode, points[winner], points[loser])) {
        return state.copy(points = points)
    }
    val setGames = bump(state.setGames, winner)
    val totalGames = bump(state.totalGames, winner)
    val afterGame =
        state.copy(
            points = ZERO,
            setGames = setGames,
            totalGames = totalGames,
            gameServer = otherTeam(state.gameServer),
        )
    val withTieBreak = currentSetHasTieBreak(config, state.setNumber)
    if (setWon(setGames[winner], setGames[loser], withTieBreak)) {
        val summary = SetSummary(games = setGames, tieBreak = null, winner = winner, kind = SetKind.set)
        return completeSet(afterGame, config, summary)
    }
    if (tieBreakDue(setGames.a, setGames.b, withTieBreak)) {
        return afterGame.copy(tieBreak = TieBreakKind.setTieBreak, tieBreakStarter = afterGame.gameServer)
    }
    return afterGame
}

private fun applySquashPoint(state: FoldState, config: MatchConfig, winner: TeamId): FoldState {
    val squashConfig = config as MatchConfig.Squash
    val isPar = squashConfig.squashMode == SquashMode.par
    val points = if (isPar || winner == state.gameServer) bump(state.points, winner) else state.points
    val loser = otherTeam(winner)
    
    val serverConsecutivePoints = if (winner == state.gameServer) state.serverConsecutivePoints + 1 else 0
    
    if (!squashGameWon(squashConfig.squashTiebreak, squashConfig.squashTarget, points[winner], points[loser])) {
        return state.copy(points = points, gameServer = winner, serverConsecutivePoints = serverConsecutivePoints)
    }
    val summary = SetSummary(games = points, tieBreak = null, winner = winner, kind = SetKind.set)
    val afterGame = state.copy(
        points = ZERO,
        gameServer = winner,
        serverConsecutivePoints = 0,
        totalGames = bump(state.totalGames, winner)
    )
    return completeSet(afterGame, config, summary)
}

private fun applyPoint(state: FoldState, config: MatchConfig, winner: TeamId): FoldState {
    if (state.finished) {
        throw IllegalStateException("cannot score a point: the match is already finished")
    }
    val counted = state.copy(totalPoints = bump(state.totalPoints, winner))
    if (config is MatchConfig.Squash) {
        return applySquashPoint(counted, config, winner)
    }
    if (counted.tieBreak != null) {
        return applyTieBreakPoint(counted, config, winner)
    }
    return applyStandardPoint(counted, config, winner)
}

private fun pointCalls(points: TeamValues<Int>): TeamValues<PointCall> {
    val call = { own: Int, other: Int ->
        if (own <= DEUCE_POINTS) {
            val calls = arrayOf(PointCall.P0, PointCall.P15, PointCall.P30, PointCall.P40)
            calls[own]
        } else if (own > other) {
            PointCall.AD
        } else {
            PointCall.P40
        }
    }
    return TeamValues(call(points.a, points.b), call(points.b, points.a))
}

private fun leaderOf(points: TeamValues<Int>): TeamId? {
    if (points.a == points.b) {
        return null
    }
    return if (points.a > points.b) TeamId.A else TeamId.B
}

private fun squashMoment(state: FoldState, config: MatchConfig): Moment {
    val squashConfig = config as MatchConfig.Squash
    val points = state.points
    val leader = leaderOf(points) ?: return Moment.Normal
    val loser = otherTeam(leader)
    val potentialPoints = bump(points, leader)
    if (!squashGameWon(squashConfig.squashTiebreak, squashConfig.squashTarget, potentialPoints[leader], potentialPoints[loser])) {
        return Moment.Normal
    }
    val gamesAfter = setsWonBy(state.completedSets, leader) + 1
    if (gamesAfter == setsToWin(config.bestOf)) {
        return Moment.MatchPoint(leader)
    }
    return Moment.GamePoint(leader)
}

private fun standardGameMoment(state: FoldState, config: MatchConfig): Moment {
    if (config is MatchConfig.Squash) return squashMoment(state, config)
    val padelConfig = config as MatchConfig.Padel
    val points = state.points
    val setGames = state.setGames
    val setNumber = state.setNumber
    val completedSets = state.completedSets
    if (isDecidingPoint(padelConfig.deuceMode, points.a, points.b)) {
        return if (padelConfig.deuceMode == DeuceMode.goldenPoint) Moment.GoldenPoint else Moment.StarPoint
    }
    if (points.a >= DEUCE_POINTS && points.b >= DEUCE_POINTS) {
        val leader = leaderOf(points) ?: return Moment.Deuce
        return Moment.Advantage(leader)
    }
    val leader = leaderOf(points) ?: return Moment.Normal
    val loser = otherTeam(leader)
    if (!standardGameWon(padelConfig.deuceMode, points[leader] + 1, points[loser])) {
        return Moment.Normal
    }
    val withTieBreak = currentSetHasTieBreak(config, setNumber)
    if (!setWon(setGames[leader] + 1, setGames[loser], withTieBreak)) {
        return Moment.GamePoint(leader)
    }
    val setsAfter = setsWonBy(completedSets, leader) + 1
    if (setsAfter == setsToWin(config.bestOf)) {
        return Moment.MatchPoint(leader)
    }
    return Moment.SetPoint(leader)
}

private fun deriveMoment(state: FoldState, config: MatchConfig): Moment {
    if (state.finished) {
        val winner = state.winner ?: throw IllegalStateException("finished match without a winner")
        return Moment.Finished(winner)
    }
    if (state.tieBreak == TieBreakKind.superTieBreak) {
        return Moment.SuperTieBreak
    }
    if (state.tieBreak == TieBreakKind.setTieBreak) {
        return Moment.TieBreak(state.setNumber)
    }
    return standardGameMoment(state, config)
}

private fun currentGameOf(state: FoldState, config: MatchConfig): CurrentGame? {
    if (state.finished) {
        return null
    }
    if (config is MatchConfig.Squash) {
        return CurrentGame.Squash(points = state.points)
    }
    val tb = state.tieBreak
    if (tb != null) {
        return CurrentGame.TieBreakGame(
            tieBreakKind = tb,
            target = if (tb == TieBreakKind.superTieBreak) SUPER_TIE_BREAK_TARGET else TIE_BREAK_TARGET,
            points = state.points,
        )
    }
    return CurrentGame.Standard(
        points = state.points,
        calls = pointCalls(state.points),
    )
}

private fun servingTeamOf(state: FoldState, config: MatchConfig): TeamId? {
    if (config.firstServePending == true && state.totalPoints.a == 0 && state.totalPoints.b == 0) {
        return null
    }
    if (state.tieBreak != null) {
        return tieBreakServer(state.tieBreakStarter, state.points.a + state.points.b)
    }
    return state.gameServer
}

private fun servingSideOf(state: FoldState, config: MatchConfig): String? {
    if (config.firstServePending == true && state.totalPoints.a == 0 && state.totalPoints.b == 0) {
        return null
    }
    if (config is MatchConfig.Squash) {
        return if (state.serverConsecutivePoints % 2 == 0) "right" else "left"
    }
    return if ((state.points.a + state.points.b) % 2 == 0) "right" else "left"
}


private fun toSnapshot(state: FoldState, config: MatchConfig): MatchSnapshot =
    MatchSnapshot(
        config = config,
        finished = state.finished,
        winner = state.winner,
        completedSets = state.completedSets,
        setNumber = if (state.finished) state.completedSets.size else state.setNumber,
        currentSetGames = if (state.finished) ZERO else state.setGames,
        currentGame = currentGameOf(state, config),
        servingTeam = servingTeamOf(state, config),
        servingSide = servingSideOf(state, config),
        moment = deriveMoment(state, config),
        totalPoints = state.totalPoints,
        totalGames = state.totalGames,
    )

/**
 * Fold a match from its config and the full list of point events.
 *
 * Events after the match is decided are ignored rather than fatal — mirrors the
 * "break when finished" loop of the canonical TS engine.
 */
fun computeMatch(config: MatchConfig, events: List<PointEvent>): MatchSnapshot {
    var state = initialState(config)
    for (event in events) {
        if (state.finished) {
            break
        }
        state = applyPoint(state, config, event.winner)
    }
    return toSnapshot(state, config)
}

/** Undo is just forgetting the last event — the fold does the rest. */
fun undoLastPoint(events: List<PointEvent>): List<PointEvent> =
    if (events.isEmpty()) events else events.subList(0, events.size - 1).toList()
