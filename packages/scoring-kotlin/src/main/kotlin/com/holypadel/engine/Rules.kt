package com.holypadel.engine

/**
 * Pure port of packages/scoring/src/rules.ts — the FIP Rule 1 predicates the
 * fold relies on. Kept as top-level functions to mirror the TS module 1:1.
 */

/** Points needed to win a standard game before deuce rules kick in. */
const val GAME_TARGET = 4

/** Games needed to win a set (with a two-game margin). */
const val SET_TARGET = 6

/** Games in a 7-5 or 7-6 set — the hard ceiling of a tie-break set. */
const val EXTENDED_SET_TARGET = 7

/** Points target of the tie-break played at 6-6. */
const val TIE_BREAK_TARGET = 7

/** Points target of the match-deciding super tie-break. */
const val SUPER_TIE_BREAK_TARGET = 10

/** Margin required to win a game from deuce, a set from 5-5, or any tie-break. */
const val WIN_BY_TWO = 2

/** Points each pair needs for deuce to be called. */
const val DEUCE_POINTS = 3

/** Point counts at which the star-point deciding rally is reached (deuce 3). */
const val STAR_POINT_POINTS = 5

/**
 * Has a standard game been won at `winnerPoints`–`loserPoints`?
 * Point counts are raw rally tallies (0, 1, 2, …), not calls.
 */
fun standardGameWon(mode: DeuceMode, winnerPoints: Int, loserPoints: Int): Boolean =
    when (mode) {
        DeuceMode.advantage ->
            winnerPoints >= GAME_TARGET && winnerPoints - loserPoints >= WIN_BY_TWO
        DeuceMode.goldenPoint ->
            // The first deuce (3-3) is decided by a single golden point, so 4 always wins.
            winnerPoints >= GAME_TARGET
        DeuceMode.starPoint ->
            // Two advantage cycles, then deuce 3 (5-5) is decided by a single star point.
            (winnerPoints >= GAME_TARGET && winnerPoints - loserPoints >= WIN_BY_TWO) ||
                winnerPoints > STAR_POINT_POINTS
    }

/** Is the next rally the single deciding point of the game (golden or star point)? */
fun isDecidingPoint(mode: DeuceMode, pointsA: Int, pointsB: Int): Boolean {
    if (mode == DeuceMode.goldenPoint) {
        return pointsA == DEUCE_POINTS && pointsB == DEUCE_POINTS
    }
    if (mode == DeuceMode.starPoint) {
        return pointsA == STAR_POINT_POINTS && pointsB == STAR_POINT_POINTS
    }
    return false
}

/** Does a set stand won at `winnerGames`–`loserGames` under normal set rules? */
fun setWon(winnerGames: Int, loserGames: Int, withTieBreak: Boolean): Boolean {
    if (winnerGames >= SET_TARGET && winnerGames - loserGames >= WIN_BY_TWO) {
        return true
    }
    // 7-5 is reached through the margin rule above; 7-6 only via the tie-break game.
    return withTieBreak && winnerGames == EXTENDED_SET_TARGET && loserGames == SET_TARGET
}

/** Do the current games force a tie-break (6-6)? */
fun tieBreakDue(gamesA: Int, gamesB: Int, withTieBreak: Boolean): Boolean =
    withTieBreak && gamesA == SET_TARGET && gamesB == SET_TARGET

/** Has a tie-break to `target` points been won (two clear, unbounded)? */
fun tieBreakWon(target: Int, winnerPoints: Int, loserPoints: Int): Boolean =
    winnerPoints >= target && winnerPoints - loserPoints >= WIN_BY_TWO

/**
 * Which team serves tie-break point `pointIndex` (0-based), given the team
 * that started the tie-break. FIP pattern: 1 point, then 2 points per server,
 * alternating pairs (1, 2, 2, 2, …).
 */
fun tieBreakServer(starter: TeamId, pointIndex: Int): TeamId {
    val serverBlock = (pointIndex + 1) / WIN_BY_TWO // integer floor for non-negative indices
    return if (serverBlock % WIN_BY_TWO == 0) starter else otherTeam(starter)
}

/** Does the third set of this configuration run without a tie-break? */
fun thirdSetWithoutTieBreak(mode: ThirdSetMode): Boolean = mode == ThirdSetMode.advantageSet

/** Sets a team must win to take the match. */
fun setsToWin(bestOf: Int): Int = if (bestOf == 1) 1 else WIN_BY_TWO
