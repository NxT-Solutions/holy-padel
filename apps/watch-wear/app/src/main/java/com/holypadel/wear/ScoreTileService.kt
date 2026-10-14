package com.holypadel.wear

import android.content.Context
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.DimensionBuilders.wrap
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.guava.future
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/** The extra MainActivity reads when it's opened from the tile's button. */
const val TILE_ACTION_EXTRA = "tileAction"
const val TILE_ACTION_START_LAST = "start-last"

private const val RESOURCES_VERSION = "1"
private const val WHITE = 0xFFFFFFFF.toInt()
private const val WHITE_55 = 0x8CFFFFFF.toInt()
private const val INK = 0xFF0E1116.toInt()
private const val DEFAULT_ACCENT = 0xFFFF6B35L
private const val DEFAULT_TEAM_B = 0xFF8B7CFFL

/** The last state the phone published, read straight from the Data Layer. */
private suspend fun readState(context: Context): MatchState = suspendCancellableCoroutine { cont ->
    Wearable.getDataClient(context).dataItems
        .addOnSuccessListener { buffer ->
            var state = MatchState.IDLE
            try {
                for (item in buffer) {
                    if (item.uri.path == SyncPaths.STATE) {
                        val json = DataMapItem.fromDataItem(item).dataMap.getString(SyncPaths.STATE_KEY)
                        if (json != null) state = MatchState.fromJson(json)
                    }
                }
            } finally {
                buffer.release()
            }
            cont.resume(state)
        }
        .addOnFailureListener { cont.resume(MatchState.IDLE) }
}

private fun text(value: String, sizeSp: Float, color: Int, bold: Boolean = true): LayoutElementBuilders.Text =
    LayoutElementBuilders.Text.Builder()
        .setText(value)
        .setMaxLines(1)
        .setOverflow(LayoutElementBuilders.TEXT_OVERFLOW_ELLIPSIZE_END)
        .setFontStyle(
            LayoutElementBuilders.FontStyle.Builder()
                .setSize(sp(sizeSp))
                .setColor(argb(color))
                .setWeight(
                    if (bold) LayoutElementBuilders.FONT_WEIGHT_BOLD else LayoutElementBuilders.FONT_WEIGHT_NORMAL,
                )
                .build(),
        )
        .build()

private fun gap(heightDp: Float): LayoutElementBuilders.Spacer =
    LayoutElementBuilders.Spacer.Builder().setHeight(dp(heightDp)).build()

private fun launch(context: Context, action: String?): ModifiersBuilders.Clickable {
    val activity = ActionBuilders.AndroidActivity.Builder()
        .setPackageName(context.packageName)
        .setClassName(MainActivity::class.java.name)
    if (action != null) {
        activity.addKeyToExtraMapping(
            TILE_ACTION_EXTRA,
            ActionBuilders.AndroidStringExtra.Builder().setValue(action).build(),
        )
    }
    return ModifiersBuilders.Clickable.Builder()
        .setId(action ?: "open")
        .setOnClick(ActionBuilders.LaunchAction.Builder().setAndroidActivity(activity.build()).build())
        .build()
}

/** A pill button: accent fill, ink label. */
private fun button(label: String, accent: Int, clickable: ModifiersBuilders.Clickable): LayoutElementBuilders.Box =
    LayoutElementBuilders.Box.Builder()
        .setWidth(wrap())
        .setHeight(dp(40f))
        .setModifiers(
            ModifiersBuilders.Modifiers.Builder()
                .setClickable(clickable)
                .setBackground(
                    ModifiersBuilders.Background.Builder()
                        .setColor(argb(accent))
                        .setCorner(ModifiersBuilders.Corner.Builder().setRadius(dp(20f)).build())
                        .build(),
                )
                .setPadding(
                    ModifiersBuilders.Padding.Builder().setStart(dp(18f)).setEnd(dp(18f)).build(),
                )
                .build(),
        )
        .addContent(text(label, 14f, INK))
        .build()

/** A live match: the point score big between the team initials, the match line, and an OPEN button. */
private fun liveLayout(context: Context, state: MatchState, accent: Int, teamB: Int): LayoutElementBuilders.Column {
    val score = LayoutElementBuilders.Row.Builder()
        .addContent(text(state.teamA.short, 13f, accent))
        .addContent(LayoutElementBuilders.Spacer.Builder().setWidth(dp(8f)).build())
        .addContent(text("${state.pointA} – ${state.pointB}", 30f, WHITE))
        .addContent(LayoutElementBuilders.Spacer.Builder().setWidth(dp(8f)).build())
        .addContent(text(state.teamB.short, 13f, teamB))
        .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
        .build()
    val line = listOf(state.setLabel, state.games).filter { it.isNotEmpty() }.joinToString("  ")
    return LayoutElementBuilders.Column.Builder()
        .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
        .addContent(text(if (state.paused) "PAUSED" else "● LIVE", 12f, if (state.paused) WHITE_55 else accent))
        .addContent(gap(4f))
        .addContent(score)
        .addContent(gap(2f))
        .addContent(text(line, 13f, WHITE_55, bold = false))
        .addContent(gap(10f))
        .addContent(button("OPEN", accent, launch(context, null)))
        .build()
}

/** Idle: the last result and a one-tap rematch of the last setup. */
private fun idleLayout(context: Context, state: MatchState, accent: Int): LayoutElementBuilders.Column {
    val column = LayoutElementBuilders.Column.Builder()
        .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
        .addContent(text("HOLY PADEL", 12f, accent))
        .addContent(gap(6f))
    val last = state.last
    if (last != null && last.line.isNotEmpty()) {
        column
            .addContent(text(if (last.won) "LAST · WON" else "LAST · LOST", 10f, WHITE_55))
            .addContent(gap(2f))
            .addContent(text(last.line, 15f, WHITE))
            .addContent(gap(12f))
    } else {
        column.addContent(text("No matches yet", 14f, WHITE_55, bold = false)).addContent(gap(12f))
    }
    return column.addContent(button("START LAST", accent, launch(context, TILE_ACTION_START_LAST))).build()
}

/** A just-won match: the winner and the final score. */
private fun wonLayout(context: Context, state: MatchState, accent: Int): LayoutElementBuilders.Column =
    LayoutElementBuilders.Column.Builder()
        .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
        .addContent(text("MATCH WON", 12f, accent))
        .addContent(gap(4f))
        .addContent(text(state.won?.winnerShort ?: "", 20f, WHITE))
        .addContent(gap(2f))
        .addContent(text(state.won?.scoreLine ?: state.games, 15f, WHITE_55))
        .addContent(gap(10f))
        .addContent(button("OPEN", accent, launch(context, null)))
        .build()

/**
 * The Holy Padel tile, one swipe from the watch face: the live score while a
 * match is on, otherwise the last result and START LAST — a rematch of the last
 * setup without opening the app first. Like the app it only mirrors the
 * phone's state; the rematch itself is the same start-last intent the app sends.
 */
class ScoreTileService : TileService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
        scope.future {
            val state = readState(this@ScoreTileService)
            val accent = (state.palette?.accent ?: DEFAULT_ACCENT).toInt()
            val teamB = (state.palette?.teamB ?: DEFAULT_TEAM_B).toInt()
            val content = when (state.phase) {
                Phase.LIVE -> liveLayout(this@ScoreTileService, state, accent, teamB)
                Phase.WON -> wonLayout(this@ScoreTileService, state, accent)
                Phase.IDLE -> idleLayout(this@ScoreTileService, state, accent)
            }
            val root = LayoutElementBuilders.Box.Builder()
                .setWidth(expand())
                .setHeight(expand())
                .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
                .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
                .addContent(content)
                .build()
            TileBuilders.Tile.Builder()
                .setResourcesVersion(RESOURCES_VERSION)
                // Updates are pushed by StateListenerService on every state change;
                // this is only a fallback.
                .setFreshnessIntervalMillis(if (state.phase == Phase.IDLE) 30 * 60_000L else 60_000L)
                .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(root))
                .build()
        }

    override fun onTileResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest,
    ): ListenableFuture<ResourceBuilders.Resources> =
        scope.future { ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build() }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
