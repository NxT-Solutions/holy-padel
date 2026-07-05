package com.holypadel.wear

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Data Layer paths — must match the phone side (docs/watch-sync.md). */
object SyncPaths {
    const val STATE = "/holy-padel/state"
    const val SCORE = "/holy-padel/score"
    const val UNDO = "/holy-padel/undo"
    const val START_LAST = "/holy-padel/start-last"
    const val PAUSE = "/holy-padel/pause"
    const val STOP = "/holy-padel/stop"
    const val CANCEL = "/holy-padel/cancel"
    const val END = "/holy-padel/end"
    const val WORKOUT = "/holy-padel/workout"
    const val STATE_KEY = "json"
}

/**
 * Bridges the Wearable Data Layer to a [MatchState] flow, and sends score/undo
 * intents back to the phone. The phone owns the engine; this only mirrors state.
 * Callback-based so it needs no extra coroutine dependencies.
 */
class WatchSync(context: Context) : DataClient.OnDataChangedListener {
    private val appContext = context.applicationContext
    private val dataClient: DataClient = Wearable.getDataClient(appContext)
    private val messageClient = Wearable.getMessageClient(appContext)
    private val nodeClient = Wearable.getNodeClient(appContext)
    private val vibrator = appContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator

    private val stateFlow = MutableStateFlow(MatchState.IDLE)
    val state: StateFlow<MatchState> = stateFlow

    fun start() {
        dataClient.addListener(this)
        // Pull any state already published before we started listening.
        dataClient.dataItems.addOnSuccessListener { buffer ->
            try {
                for (item in buffer) {
                    if (item.uri.path == SyncPaths.STATE) {
                        val json = DataMapItem.fromDataItem(item).dataMap.getString(SyncPaths.STATE_KEY)
                        if (json != null) stateFlow.value = MatchState.fromJson(json)
                    }
                }
            } finally {
                buffer.release()
            }
        }
    }

    fun stop() {
        dataClient.removeListener(this)
    }

    override fun onDataChanged(events: DataEventBuffer) {
        for (event in events) {
            if (event.type != DataEvent.TYPE_CHANGED) continue
            val item = event.dataItem
            if (item.uri.path != SyncPaths.STATE) continue
            val json = DataMapItem.fromDataItem(item).dataMap.getString(SyncPaths.STATE_KEY)
            if (json != null) {
                stateFlow.value = MatchState.fromJson(json)
            }
        }
    }

    /** Send a fire-and-forget intent to every connected phone node. */
    private fun broadcast(path: String, body: String) {
        nodeClient.connectedNodes.addOnSuccessListener { nodes ->
            for (node in nodes) {
                messageClient.sendMessage(node.id, path, body.toByteArray())
            }
        }
    }

    /**
     * Broadcast a user-initiated tap with instant local feedback — the visible
     * score still comes from the phone's next state push (docs/watch-sync.md).
     */
    private fun tap(path: String, body: String) {
        buzz()
        broadcast(path, body)
    }

    /** Short haptic tick so a tap feels acknowledged before the round-trip. */
    private fun buzz() {
        val v = vibrator ?: return
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(20L, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(20L)
            }
        }
    }

    fun score(team: String) = tap(SyncPaths.SCORE, team)

    fun undo() = tap(SyncPaths.UNDO, "")

    fun startLast() = tap(SyncPaths.START_LAST, "")

    /** Toggle pause<->resume — the phone owns the pause state. */
    fun pause() = tap(SyncPaths.PAUSE, "")

    /** Stop AND save — the phone credits the leader if the match isn't finished. */
    fun stop() = tap(SyncPaths.STOP, "")

    /** Discard the match entirely — nothing is saved. */
    fun cancel() = tap(SyncPaths.CANCEL, "")

    /** Legacy alias kept for the won screen's DONE (the phone treats it as `stop`). */
    fun end() = tap(SyncPaths.END, "")

    /** Ship the finished exercise summary — the phone writes it to Health Connect. */
    fun sendWorkout(summaryJson: String) = broadcast(SyncPaths.WORKOUT, summaryJson)
}
