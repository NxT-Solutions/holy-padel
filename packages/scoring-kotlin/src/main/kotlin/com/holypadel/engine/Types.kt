package com.holypadel.engine

/**
 * Pure Kotlin port of the canonical TypeScript scoring engine at
 * packages/scoring/src/{engine,rules,types}.ts.
 *
 * No Android / platform dependencies — plain JVM data & sealed classes so the
 * Wear OS app can import it and the golden vectors can be verified off-device.
 */

/** One of the two pairs on court. */
enum class TeamId { A, B }

fun otherTeam(team: TeamId): TeamId = if (team == TeamId.A) TeamId.B else TeamId.A

/**
 * How a game is decided from deuce — the three official options of
 * FIP Rule 1 ("Score in a game").
 */
enum class DeuceMode { advantage, starPoint, goldenPoint }

/**
 * What is played when a best-of-3 match reaches one set all.
 * - fullSet: a normal third set, tie-break at 6-6.
 * - advantageSet: a third set without tie-break — two clear games win.
 * - superTieBreak: a tie-break to 10 points replaces the third set.
 */
enum class ThirdSetMode { fullSet, advantageSet, superTieBreak }

data class MatchConfig(
    val bestOf: Int, // 1 or 3
    val deuceMode: DeuceMode,
    val thirdSet: ThirdSetMode,
    /** Team serving the first game of the match. */
    val firstServe: TeamId,
)

/** The only mutating event of a match: a rally ended and `winner` won it. */
data class PointEvent(
    val winner: TeamId,
    /** Epoch milliseconds — used for durations, never for scoring. */
    val at: Long,
)

data class TeamValues<T>(val a: T, val b: T) {
    operator fun get(team: TeamId): T = if (team == TeamId.A) a else b
}

/** Display call for a standard game: 0, 15, 30, 40 or advantage. */
enum class PointCall(val label: String) {
    P0("0"),
    P15("15"),
    P30("30"),
    P40("40"),
    AD("AD"),
}

enum class TieBreakKind(val label: String) {
    setTieBreak("setTieBreak"),
    superTieBreak("superTieBreak"),
}

/** kind label for a completed set. */
enum class SetKind(val label: String) {
    set("set"),
    superTieBreak("superTieBreak"),
}

/** A finished set (a super tie-break counts as the deciding set). */
data class SetSummary(
    val games: TeamValues<Int>,
    /** Present when the set was decided by a tie-break at 6-6. */
    val tieBreak: TeamValues<Int>?,
    val winner: TeamId,
    val kind: SetKind,
)

/** What the current point means — drives the status pill in the live UI. */
sealed class Moment {
    object Normal : Moment()
    data class GamePoint(val team: TeamId) : Moment()
    data class SetPoint(val team: TeamId) : Moment()
    data class MatchPoint(val team: TeamId) : Moment()
    object Deuce : Moment()
    data class Advantage(val team: TeamId) : Moment()
    object GoldenPoint : Moment()
    object StarPoint : Moment()
    data class TieBreak(val setNumber: Int) : Moment()
    object SuperTieBreak : Moment()
    data class Finished(val winner: TeamId) : Moment()
}

/** The live game being played, in one of its two shapes. */
sealed class CurrentGame {
    data class Standard(
        val points: TeamValues<Int>,
        val calls: TeamValues<PointCall>,
    ) : CurrentGame()

    data class TieBreakGame(
        val tieBreakKind: TieBreakKind,
        val target: Int,
        val points: TeamValues<Int>,
    ) : CurrentGame()
}

/** Everything the UI needs about a match, derived from config + events. */
data class MatchSnapshot(
    val config: MatchConfig,
    val finished: Boolean,
    val winner: TeamId?,
    val completedSets: List<SetSummary>,
    /** 1-based number of the set in play (or the last one when finished). */
    val setNumber: Int,
    /** Games in the set in play; zeros when the match is finished. */
    val currentSetGames: TeamValues<Int>,
    /** The game in play; null once the match is finished. */
    val currentGame: CurrentGame?,
    /** Team serving the point in play (tie-break rotation included). */
    val servingTeam: TeamId,
    val moment: Moment,
    /** Rally points won over the whole match. */
    val totalPoints: TeamValues<Int>,
    /** Games won over the whole match (tie-breaks count as one game). */
    val totalGames: TeamValues<Int>,
)
