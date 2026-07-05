package com.holypadel.wear

import org.json.JSONObject

/** Which screen the watch shows — driven entirely by the phone's payload. */
enum class Phase { IDLE, LIVE, WON }

data class TeamState(val short: String, val serving: Boolean)

data class WonState(val winnerShort: String, val scoreLine: String, val duration: String)

data class LastState(val line: String, val won: Boolean)

/**
 * The mirrored match state pushed by the phone. See docs/watch-sync.md — the
 * watch renders this and never computes score itself.
 */
data class MatchState(
    val phase: Phase,
    val clock: String,
    val court: String,
    val setLabel: String,
    val teamA: TeamState,
    val teamB: TeamState,
    val pointA: String,
    val pointB: String,
    val games: String,
    val status: String,
    /** Epoch ms the match started — workout session start + dedup key. 0 when idle. */
    val startedAt: Long,
    /** True while a live match is paused — dim scoring and pause the workout. */
    val paused: Boolean,
    val won: WonState?,
    val last: LastState?,
) {
    companion object {
        val IDLE = MatchState(
            phase = Phase.IDLE,
            clock = "",
            court = "",
            setLabel = "",
            teamA = TeamState("N&J", serving = false),
            teamB = TeamState("M&L", serving = false),
            pointA = "",
            pointB = "",
            games = "",
            status = "",
            startedAt = 0L,
            paused = false,
            won = null,
            last = null,
        )

        fun fromJson(json: String): MatchState {
            val root = JSONObject(json)
            val phase = when (root.optString("phase")) {
                "live" -> Phase.LIVE
                "won" -> Phase.WON
                else -> Phase.IDLE
            }
            val team = { key: String ->
                val obj = root.optJSONObject(key) ?: JSONObject()
                TeamState(obj.optString("short"), obj.optBoolean("serving", false))
            }
            val won = root.optJSONObject("won")?.let {
                WonState(it.optString("winnerShort"), it.optString("scoreLine"), it.optString("duration"))
            }
            val last = root.optJSONObject("last")?.let {
                LastState(it.optString("line"), it.optBoolean("won", false))
            }
            return MatchState(
                phase = phase,
                clock = root.optString("clock"),
                court = root.optString("court"),
                setLabel = root.optString("setLabel"),
                teamA = team("teamA"),
                teamB = team("teamB"),
                pointA = root.optString("pointA"),
                pointB = root.optString("pointB"),
                games = root.optString("games"),
                status = root.optString("status"),
                startedAt = root.optLong("startedAt", 0L),
                paused = root.optBoolean("paused", false),
                won = won,
                last = last,
            )
        }
    }
}
