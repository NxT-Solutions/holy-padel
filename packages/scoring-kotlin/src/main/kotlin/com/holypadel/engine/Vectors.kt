package com.holypadel.engine

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Serialise a [MatchSnapshot] into the language-neutral shape defined by
 * `SerializedSnapshot` in packages/scoring/src/vectors.ts. This is the exact
 * contract the golden vectors compare against (structural JSON equality — key
 * order is irrelevant because both sides parse into [JsonElement]).
 */

private fun team(t: TeamId): String = t.name // "A" / "B"

private fun teamValues(v: TeamValues<Int>): JsonElement =
    buildJsonObject {
        put("A", v.a)
        put("B", v.b)
    }

private fun serializeGame(game: CurrentGame?): JsonElement =
    when (game) {
        null -> JsonNull
        is CurrentGame.Standard ->
            buildJsonObject {
                put("kind", "standard")
                put(
                    "calls",
                    buildJsonObject {
                        put("A", game.calls.a.label)
                        put("B", game.calls.b.label)
                    },
                )
                put("points", teamValues(game.points))
            }
        is CurrentGame.TieBreakGame ->
            buildJsonObject {
                put("kind", "tieBreak")
                put("tieBreakKind", game.tieBreakKind.label)
                put("target", game.target)
                put("points", teamValues(game.points))
            }
        is CurrentGame.Squash ->
            buildJsonObject {
                put("kind", "squash")
                put("points", teamValues(game.points))
            }
        is CurrentGame.Pickleball ->
            buildJsonObject {
                put("kind", "pickleball")
                put("points", teamValues(game.points))
                if (game.serverNumber != null) {
                    put("serverNumber", game.serverNumber)
                } else {
                    put("serverNumber", JsonNull)
                }
            }
    }

private fun serializeMoment(moment: Moment): JsonElement =
    buildJsonObject {
        when (moment) {
            is Moment.Normal -> put("kind", "normal")
            is Moment.GamePoint -> {
                put("kind", "gamePoint")
                put("team", team(moment.team))
            }
            is Moment.SetPoint -> {
                put("kind", "setPoint")
                put("team", team(moment.team))
            }
            is Moment.MatchPoint -> {
                put("kind", "matchPoint")
                put("team", team(moment.team))
            }
            is Moment.Deuce -> put("kind", "deuce")
            is Moment.Advantage -> {
                put("kind", "advantage")
                put("team", team(moment.team))
            }
            is Moment.GoldenPoint -> put("kind", "goldenPoint")
            is Moment.StarPoint -> put("kind", "starPoint")
            is Moment.SetChoice -> put("kind", "setChoice")
            is Moment.TieBreak -> {
                put("kind", "tieBreak")
                put("setNumber", moment.setNumber)
            }
            is Moment.SuperTieBreak -> put("kind", "superTieBreak")
            is Moment.Finished -> {
                put("kind", "finished")
                put("winner", team(moment.winner))
            }
        }
    }

fun serializeSnapshot(snap: MatchSnapshot): JsonElement =
    buildJsonObject {
        put("finished", snap.finished)
        val w = snap.winner
        if (w == null) {
            put("winner", JsonNull)
        } else {
            put("winner", team(w))
        }
        put("setNumber", snap.setNumber)
        put("currentSetGames", teamValues(snap.currentSetGames))
        put("currentGame", serializeGame(snap.currentGame))
        // The TS generator serialises via JSON.stringify, which DROPS keys
        // whose value is undefined — servingTeam/servingSide must be omitted,
        // not null, when no serving team is resolved (e.g. pickleball games
        // 2+ before the first serve is decided).
        val st = snap.servingTeam
        if (st != null) {
            put("servingTeam", team(st))
        }
        val ss = snap.servingSide
        if (ss != null) {
            put("servingSide", ss)
        }

        put("moment", serializeMoment(snap.moment))
        put("totalGames", teamValues(snap.totalGames))
        put("totalPoints", teamValues(snap.totalPoints))
        put(
            "completedSets",
            buildJsonArray {
                for (set in snap.completedSets) {
                    add(
                        buildJsonObject {
                            put("games", teamValues(set.games))
                            val tb = set.tieBreak
                            if (tb == null) {
                                put("tieBreak", JsonNull)
                            } else {
                                put("tieBreak", teamValues(tb))
                            }
                            put("winner", team(set.winner))
                            put("kind", set.kind.label)
                        },
                    )
                }
            },
        )
    }
