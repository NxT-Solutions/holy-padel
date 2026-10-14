package com.holypadel.wear

import org.json.JSONObject

/** Which screen the watch shows — driven entirely by the phone's payload. */
enum class Phase { IDLE, LIVE, WON }

data class TeamState(val short: String, val serving: Boolean, val servingSide: String?)

data class WonState(val winnerShort: String, val scoreLine: String, val duration: String)

data class LastState(val line: String, val won: Boolean)

/** The user's highlight and Team B colours as ARGB — mirrored from the phone's Settings. */
data class Palette(val accent: Long, val teamB: Long)

/** `#RRGGBB` → opaque ARGB, or null when it isn't a 6-digit hex colour. */
internal fun parseHexColor(hex: String): Long? {
    val digits = hex.removePrefix("#")
    if (digits.length != 6) return null
    return digits.toLongOrNull(16)?.let { it or 0xFF000000L }
}

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
    /** Squash "choice" tie-break at target-1 all — show the SHORT/LONG buttons. */
    val choicePending: Boolean,
    val won: WonState?,
    val last: LastState?,
    /** Null from older phone builds — the watch keeps its built-in colours. */
    val palette: Palette? = null,
) {
    companion object {
        val IDLE = MatchState(
            phase = Phase.IDLE,
            clock = "",
            court = "",
            setLabel = "",
            teamA = TeamState("N&J", serving = false, servingSide = null),
            teamB = TeamState("M&L", serving = false, servingSide = null),
            pointA = "",
            pointB = "",
            games = "",
            status = "",
            startedAt = 0L,
            paused = false,
            choicePending = false,
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
                TeamState(
                    short = obj.optString("short"),
                    serving = obj.optBoolean("serving", false),
                    servingSide = if (obj.has("servingSide") && !obj.isNull("servingSide")) obj.getString("servingSide") else null
                )
            }
            val won = root.optJSONObject("won")?.let {
                WonState(it.optString("winnerShort"), it.optString("scoreLine"), it.optString("duration"))
            }
            val last = root.optJSONObject("last")?.let {
                LastState(it.optString("line"), it.optBoolean("won", false))
            }
            val palette = root.optJSONObject("palette")?.let {
                val accent = parseHexColor(it.optString("accent"))
                val teamB = parseHexColor(it.optString("teamB"))
                if (accent != null && teamB != null) Palette(accent, teamB) else null
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
                choicePending = root.optBoolean("choicePending", false),
                won = won,
                last = last,
                palette = palette,
            )
        }
    }
}
