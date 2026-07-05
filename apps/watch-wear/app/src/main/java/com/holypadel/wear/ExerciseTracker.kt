package com.holypadel.wear

import android.content.Context
import androidx.health.services.client.ExerciseUpdateCallback
import androidx.health.services.client.HealthServices
import androidx.health.services.client.data.Availability
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.ExerciseConfig
import androidx.health.services.client.data.ExerciseLapSummary
import androidx.health.services.client.data.ExerciseType
import androidx.health.services.client.data.ExerciseUpdate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.guava.await
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * Tracks the live match as a Health Services exercise: workout-grade heart rate
 * and calories while the scoreboard is up. Everything is best-effort — a watch
 * without sensors (or a declined permission) just means no fitness data; the
 * scoreboard itself must never be affected.
 *
 * Health Services has no padel type; RACQUETBALL is the closest calorie model
 * (enclosed-court racquet sport). Health Connect does not exist on Wear OS, so
 * the finished summary is sent to the phone (via WatchSync), which owns the
 * single Health Connect write.
 */
class ExerciseTracker(context: Context) {
    data class LiveStats(val bpm: Int, val kcal: Double, val tracking: Boolean)

    private val client = HealthServices.getClient(context.applicationContext).exerciseClient
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val statsFlow = MutableStateFlow(LiveStats(bpm = 0, kcal = 0.0, tracking = false))
    val stats: StateFlow<LiveStats> = statsFlow

    /** Fired once per finished exercise with the summary JSON for the phone. */
    var onSummary: ((String) -> Unit)? = null

    private var matchStartedAt = 0L
    private var maxBpm = 0
    private val samples = mutableListOf<Pair<Long, Int>>()
    private var lastSampleAt = 0L

    private val callback = object : ExerciseUpdateCallback {
        override fun onExerciseUpdateReceived(update: ExerciseUpdate) {
            val now = System.currentTimeMillis()
            val bpm = update.latestMetrics.getData(DataType.HEART_RATE_BPM)
                .lastOrNull()?.value?.toInt()
            val kcal = update.latestMetrics.getData(DataType.CALORIES_TOTAL)?.total
            if (bpm != null && bpm > 0) {
                if (bpm > maxBpm) maxBpm = bpm
                // Downsample the stored series to one point per 15s — a 90-minute
                // match stays well under the Data Layer message size limit.
                if (now - lastSampleAt >= SAMPLE_INTERVAL_MS) {
                    samples.add(now to bpm)
                    lastSampleAt = now
                }
            }
            statsFlow.value = LiveStats(
                bpm = bpm ?: statsFlow.value.bpm,
                kcal = kcal ?: statsFlow.value.kcal,
                tracking = true,
            )
        }

        override fun onLapSummaryReceived(lapSummary: ExerciseLapSummary) = Unit
        override fun onAvailabilityChanged(dataType: DataType<*, *>, availability: Availability) = Unit
        override fun onRegistered() = Unit
        override fun onRegistrationFailed(throwable: Throwable) = Unit
    }

    /** Start tracking; safe to call when unsupported — it just stays idle. */
    fun start(startedAt: Long) {
        if (statsFlow.value.tracking) return
        matchStartedAt = if (startedAt > 0) startedAt else System.currentTimeMillis()
        maxBpm = 0
        samples.clear()
        lastSampleAt = 0L
        scope.launch {
            runCatching {
                client.setUpdateCallback(callback)
                client.startExerciseAsync(
                    ExerciseConfig(
                        exerciseType = ExerciseType.RACQUETBALL,
                        dataTypes = setOf(DataType.HEART_RATE_BPM, DataType.CALORIES_TOTAL),
                        isAutoPauseAndResumeEnabled = false,
                        isGpsEnabled = false,
                        exerciseGoals = emptyList(),
                    ),
                ).await()
                statsFlow.value = LiveStats(bpm = 0, kcal = 0.0, tracking = true)
            }
        }
    }

    /** Pause the exercise session while the match is paused. No-op when idle. */
    fun pause() {
        if (!statsFlow.value.tracking) return
        scope.launch {
            runCatching { client.pauseExerciseAsync().await() }
        }
    }

    /** Resume the exercise session when the match resumes. No-op when idle. */
    fun resume() {
        if (!statsFlow.value.tracking) return
        scope.launch {
            runCatching { client.resumeExerciseAsync().await() }
        }
    }

    /** End tracking and hand the summary to [onSummary]. No-op when idle. */
    fun end() {
        if (!statsFlow.value.tracking) return
        statsFlow.value = statsFlow.value.copy(tracking = false)
        scope.launch {
            runCatching { client.endExerciseAsync().await() }
            val summary = buildSummary()
            statsFlow.value = LiveStats(bpm = 0, kcal = 0.0, tracking = false)
            if (summary != null) {
                onSummary?.invoke(summary)
            }
        }
    }

    private fun buildSummary(): String? {
        val kcal = statsFlow.value.kcal
        if (samples.isEmpty() && kcal <= 0.0) {
            return null
        }
        val avgBpm = if (samples.isEmpty()) 0 else samples.sumOf { it.second } / samples.size
        return JSONObject().apply {
            put("startedAt", matchStartedAt)
            put("endedAt", System.currentTimeMillis())
            put("kcal", kcal)
            put("avgBpm", avgBpm)
            put("maxBpm", maxBpm)
            put(
                "samples",
                JSONArray().apply {
                    for ((t, bpm) in samples) {
                        put(JSONObject().apply { put("t", t); put("bpm", bpm) })
                    }
                },
            )
        }.toString()
    }

    private companion object {
        const val SAMPLE_INTERVAL_MS = 15_000L
    }
}
