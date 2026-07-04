package com.holypadel.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.holypadel.wear.ui.WatchApp

/**
 * The whole Wear app: mirror the phone's live match and send score/undo intents
 * back. All scoring lives on the phone (see docs/watch-sync.md).
 */
class MainActivity : ComponentActivity() {
    private lateinit var sync: WatchSync

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sync = WatchSync(this)
        setContent {
            val state by sync.state.collectAsState()
            WatchApp(
                state = state,
                onScore = { team -> sync.score(team) },
                onUndo = { sync.undo() },
                onStartLast = { sync.startLast() },
            )
        }
    }

    override fun onResume() {
        super.onResume()
        sync.start()
    }

    override fun onPause() {
        super.onPause()
        sync.stop()
    }
}
