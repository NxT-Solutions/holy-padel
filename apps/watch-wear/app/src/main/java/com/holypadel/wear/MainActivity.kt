package com.holypadel.wear

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.lifecycleScope
import com.holypadel.wear.ui.WatchApp
import kotlinx.coroutines.launch

/**
 * The whole Wear app: mirror the phone's live match, send score/undo intents
 * back, and track the match as a Health Services exercise (heart rate +
 * calories) while it runs. All scoring lives on the phone (docs/watch-sync.md);
 * the finished workout summary is sent there too — the phone is the single
 * Health Connect writer (Health Connect does not exist on Wear OS).
 */
class MainActivity : ComponentActivity() {
    private lateinit var sync: WatchSync
    private lateinit var tracker: ExerciseTracker
    private var lastPhase = Phase.IDLE
    private var lastPaused = false
    private var pendingStartedAt = 0L

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            // Start regardless of the exact grants — Health Services simply omits
            // streams it has no permission for; a scoreboard with no bpm is fine.
            if (grants.values.any { it }) {
                tracker.start(pendingStartedAt)
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sync = WatchSync(this)
        tracker = ExerciseTracker(this)
        tracker.onSummary = { summary -> sync.sendWorkout(summary) }

        // Drive the exercise session from phase transitions in the mirrored state.
        lifecycleScope.launch {
            sync.state.collect { state ->
                val phase = state.phase
                if (phase == Phase.LIVE && lastPhase != Phase.LIVE) {
                    startTracking(state.startedAt)
                } else if (phase != Phase.LIVE && lastPhase == Phase.LIVE) {
                    tracker.end()
                }
                // Mirror pause/resume onto the workout session while live; only act
                // on a real change so we never spam the exercise client.
                if (phase == Phase.LIVE && state.paused != lastPaused) {
                    if (state.paused) tracker.pause() else tracker.resume()
                }
                lastPhase = phase
                lastPaused = if (phase == Phase.LIVE) state.paused else false
            }
        }

        setContent {
            val state by sync.state.collectAsState()
            val stats by tracker.stats.collectAsState()
            WatchApp(
                state = state,
                liveBpm = if (stats.tracking) stats.bpm else 0,
                onScore = { team -> sync.score(team) },
                onUndo = { sync.undo() },
                onStartLast = { sync.startLast() },
                onPause = { sync.pause() },
                onEnd = { sync.end() },
            )
        }
    }

    private fun startTracking(startedAt: Long) {
        pendingStartedAt = startedAt
        val heartRatePermission = if (Build.VERSION.SDK_INT >= 36) {
            // Wear OS 6 (API 36) replaces BODY_SENSORS with granular health permissions.
            "android.permission.health.READ_HEART_RATE"
        } else {
            Manifest.permission.BODY_SENSORS
        }
        permissionLauncher.launch(
            arrayOf(heartRatePermission, Manifest.permission.ACTIVITY_RECOGNITION),
        )
    }

    override fun onResume() {
        super.onResume()
        sync.start()
    }

    override fun onPause() {
        super.onPause()
        sync.stop()
    }

    override fun onDestroy() {
        super.onDestroy()
        // The scoreboard is the workout: leaving the app for good ends the session.
        tracker.end()
    }
}
