package com.holypadel.engine

import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Reads the committed golden vectors produced by the canonical TS engine and
 * asserts that this Kotlin port reproduces every serialised snapshot exactly.
 *
 * The vectors file lives in a sibling package; resolve it relative to this
 * module so the test runs from any working directory.
 */
class VectorTest {
    private val json = Json { ignoreUnknownKeys = false }

    private fun goldenFile(): File {
        // Candidate locations relative to common working directories.
        val candidates =
            listOf(
                File("../scoring/vectors/golden.json"),
                File("../../packages/scoring/vectors/golden.json"),
                File("packages/scoring/vectors/golden.json"),
                File(System.getProperty("user.dir"), "../scoring/vectors/golden.json"),
            )
        candidates.firstOrNull { it.exists() }?.let { return it }
        // Absolute fallback anchored on this module's known repo location.
        val abs = File("/Users/noah/dev/holy-padel/packages/scoring/vectors/golden.json")
        if (abs.exists()) return abs
        error("golden.json not found; tried: ${candidates.joinToString { it.absolutePath }}")
    }

    private fun parseTeam(s: String): TeamId = if (s == "A") TeamId.A else TeamId.B

    private fun parseConfig(obj: JsonObject): MatchConfig =
        MatchConfig(
            bestOf = obj.getValue("bestOf").jsonPrimitive.content.toInt(),
            deuceMode = DeuceMode.valueOf(obj.getValue("deuceMode").jsonPrimitive.content),
            thirdSet = ThirdSetMode.valueOf(obj.getValue("thirdSet").jsonPrimitive.content),
            firstServe = parseTeam(obj.getValue("firstServe").jsonPrimitive.content),
        )

    private fun eventsFrom(winners: String): List<PointEvent> =
        winners.mapIndexed { i, c -> PointEvent(winner = parseTeam(c.toString()), at = i.toLong()) }

    @Test
    fun everyGoldenVectorMatches() {
        val file = goldenFile()
        val root = json.parseToJsonElement(file.readText()) as JsonArray
        assertEquals(972, root.size, "expected 972 golden vectors")

        var pass = 0
        val failures = mutableListOf<String>()

        root.forEachIndexed { index, elemAny ->
            val elem = elemAny.jsonObject
            val config = parseConfig(elem.getValue("config").jsonObject)
            val winners = elem.getValue("winners").jsonPrimitive.content
            val expected: JsonElement = elem.getValue("snapshot")

            val actual = serializeSnapshot(computeMatch(config, eventsFrom(winners)))

            if (actual == expected) {
                pass += 1
            } else {
                failures.add(
                    "vector #$index (config=$config, winners.len=${winners.length}):\n" +
                        "  expected: $expected\n" +
                        "  actual:   $actual",
                )
            }
        }

        if (failures.isNotEmpty()) {
            val shown = failures.take(5).joinToString("\n")
            System.err.println("FAILED ${failures.size}/972 vectors. First few:\n$shown")
        }
        assertTrue(failures.isEmpty(), "${failures.size} vector mismatch(es); ${pass}/972 passed")
        assertEquals(972, pass, "all 972 vectors must pass")
        println("scoring-kotlin: $pass/972 golden vectors passed")
    }
}
