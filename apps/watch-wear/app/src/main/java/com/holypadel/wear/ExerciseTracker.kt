package com.holypadel.wear

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import androidx.core.content.ContextCompat
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
import java.time.Instant

/**
 * Tracks the live match as a Health Services exercise: workout-grade heart rate,
 * calories, steps and distance while the scoreboard is up. Everything is best-effort — a watch
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

    private val appContext = context.applicationContext
    private val client = HealthServices.getClient(appContext).exerciseClient
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val statsFlow = MutableStateFlow(LiveStats(bpm = 0, kcal = 0.0, tracking = false))
    val stats: StateFlow<LiveStats> = statsFlow

    /** Fired once per finished exercise with the summary JSON for the phone. */
    var onSummary: ((String) -> Unit)? = null

    private var matchStartedAt = 0L
    private var maxBpm = 0
    private val samples = mutableListOf<Pair<Long, Int>>()
    private var lastSampleAt = 0L

    /** Steps and metres per [MOTION_BUCKET_MS] bucket, keyed by the bucket's end. */
    private val motion = sortedMapOf<Long, DoubleArray>()

    /** The wall-clock instant the device booted — data points are stamped from boot. */
    private fun bootInstant(): Instant =
        Instant.ofEpochMilli(System.currentTimeMillis() - SystemClock.elapsedRealtime())

    private val callback = object : ExerciseUpdateCallback {
        override fun onExerciseUpdateReceived(update: ExerciseUpdate) {
            val boot = bootInstant()
            val metrics = update.latestMetrics
            // Keep EVERY reading in the update at its own timestamp. With the
            // screen off Health Services batches readings and delivers them
            // minutes apart; taking only the newest one per delivery (stamped
            // with arrival time) left long gaps in the stored series.
            val heartRate = metrics.getData(DataType.HEART_RATE_BPM)
            for (point in heartRate) {
                val bpm = point.value.toInt()
                if (bpm <= 0) continue
                if (bpm > maxBpm) maxBpm = bpm
                val t = point.getTimeInstant(boot).toEpochMilli()
                // Downsample to one point per 5s — a 90-minute match stays well
                // under the Data Layer message size limit.
                if (t - lastSampleAt >= SAMPLE_INTERVAL_MS) {
                    samples.add(t to bpm)
                    lastSampleAt = t
                }
            }
            for (point in metrics.getData(DataType.STEPS)) {
                addMotion(point.getEndInstant(boot).toEpochMilli(), steps = point.value.toDouble())
            }
            for (point in metrics.getData(DataType.DISTANCE)) {
                addMotion(point.getEndInstant(boot).toEpochMilli(), meters = point.value)
            }
            val kcal = metrics.getData(DataType.CALORIES_TOTAL)?.total
            statsFlow.value = LiveStats(
                bpm = heartRate.lastOrNull()?.value?.toInt()?.takeIf { it > 0 } ?: statsFlow.value.bpm,
                kcal = kcal ?: statsFlow.value.kcal,
                tracking = true,
            )
        }

        override fun onLapSummaryReceived(lapSummary: ExerciseLapSummary) = Unit
        override fun onAvailabilityChanged(dataType: DataType<*, *>, availability: Availability) = Unit
        override fun onRegistered() = Unit
        override fun onRegistrationFailed(throwable: Throwable) = Unit
    }

    /**
     * True once the heart-rate permission has actually been granted. Health
     * Services throws SecurityException if we start an exercise that streams
     * HEART_RATE_BPM without it — checking here keeps the whole thing opt-in and
     * lets the scoreboard run untouched when the grant is missing.
     */
    private fun hasHeartRatePermission(): Boolean {
        val permission = if (Build.VERSION.SDK_INT >= 36) {
            // Wear OS 6 (API 36) replaces BODY_SENSORS with granular health permissions.
            "android.permission.health.READ_HEART_RATE"
        } else {
            Manifest.permission.BODY_SENSORS
        }
        return ContextCompat.checkSelfPermission(appContext, permission) ==
            PackageManager.PERMISSION_GRANTED
    }

    /** Fold one steps/distance delta into its time bucket. */
    private fun addMotion(endedAt: Long, steps: Double = 0.0, meters: Double = 0.0) {
        val bucketEnd = (endedAt / MOTION_BUCKET_MS + 1) * MOTION_BUCKET_MS
        val bucket = motion.getOrPut(bucketEnd) { DoubleArray(2) }
        bucket[0] += steps
        bucket[1] += meters
    }

    /**
     * The data types to request: heart rate and calories always, steps and
     * distance only when the device supports them for this exercise — asking
     * for an unsupported type makes the whole exercise fail to start.
     */
    private suspend fun requestedDataTypes(): Set<DataType<*, *>> {
        val wanted = setOf<DataType<*, *>>(DataType.STEPS, DataType.DISTANCE)
        val supported = runCatching {
            client.getCapabilitiesAsync().await()
                .typeToCapabilities[ExerciseType.RACQUETBALL]
                ?.supportedDataTypes
                .orEmpty()
        }.getOrDefault(emptySet())
        return setOf<DataType<*, *>>(DataType.HEART_RATE_BPM, DataType.CALORIES_TOTAL) +
            wanted.intersect(supported)
    }

    /** Start tracking; safe to call when unsupported — it just stays idle. */
    fun start(startedAt: Long) {
        if (statsFlow.value.tracking) return
        // Opt-in only: with no sensor permission the exercise would fail to start
        // (or throw), so skip it silently — the scoreboard never depends on it.
        if (!hasHeartRatePermission()) return
        matchStartedAt = if (startedAt > 0) startedAt else System.currentTimeMillis()
        maxBpm = 0
        samples.clear()
        lastSampleAt = 0L
        motion.clear()
        scope.launch {
            runCatching {
                client.setUpdateCallback(callback)
                client.startExerciseAsync(
                    ExerciseConfig(
                        exerciseType = ExerciseType.RACQUETBALL,
                        dataTypes = requestedDataTypes(),
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
        if (samples.isEmpty() && kcal <= 0.0 && motion.isEmpty()) {
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
            put(
                "motion",
                JSONArray().apply {
                    for ((t, bucket) in motion) {
                        put(
                            JSONObject().apply {
                                put("t", t)
                                put("steps", bucket[0].toLong())
                                put("meters", Math.round(bucket[1] * 10) / 10.0)
                            },
                        )
                    }
                },
            )
        }.toString()
    }

    private companion object {
        const val SAMPLE_INTERVAL_MS = 5_000L
        const val MOTION_BUCKET_MS = 10_000L
    }
}
