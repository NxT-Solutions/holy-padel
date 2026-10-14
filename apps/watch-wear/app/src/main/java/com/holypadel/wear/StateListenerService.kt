package com.holypadel.wear

import androidx.wear.tiles.TileService
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.WearableListenerService

/**
 * Wakes on every state push from the phone — even with the app closed — and
 * asks the system to refresh the tile, so it never shows a stale score.
 */
class StateListenerService : WearableListenerService() {
    override fun onDataChanged(dataEvents: DataEventBuffer) {
        TileService.getUpdater(this).requestUpdate(ScoreTileService::class.java)
    }
}
