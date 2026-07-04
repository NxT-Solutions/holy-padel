package com.holypadel.wear

import android.content.Context
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

    fun score(team: String) = broadcast(SyncPaths.SCORE, team)

    fun undo() = broadcast(SyncPaths.UNDO, "")

    fun startLast() = broadcast(SyncPaths.START_LAST, "")
}
