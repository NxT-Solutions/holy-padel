package com.holypadel.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.holypadel.wear.MatchState
import com.holypadel.wear.Phase

/** Routes to the right screen purely from the mirrored [MatchState.phase]. */
@Composable
fun WatchApp(
    state: MatchState,
    liveBpm: Int,
    onScore: (String) -> Unit,
    onUndo: () -> Unit,
    onStartLast: () -> Unit,
    onPause: () -> Unit,
    onEnd: () -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxSize().background(CourtColors.Black),
        contentAlignment = Alignment.Center,
    ) {
        when (state.phase) {
            Phase.IDLE -> IdleScreen(state, onStartLast)
            Phase.LIVE -> LiveScoreScreen(state, liveBpm, onScore, onUndo, onPause, onEnd)
            Phase.WON -> MatchWonScreen(state, onEnd)
        }
    }
}

@Composable
private fun IdleScreen(state: MatchState, onStartLast: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 22.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        LabelText("NO LIVE MATCH", sizeSp = 11)
        state.last?.let { last ->
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                ResultBadge(last.won, sizeDp = 20)
                Spacer(Modifier.width(8.dp))
                BodyText("Last · ${last.line}", color = CourtColors.White45, sizeSp = 12)
            }
        }
        Spacer(Modifier.height(18.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(28.dp))
                .background(CourtColors.Lime)
                .clickable { onStartLast() }
                .padding(vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            DisplayText("START MATCH", sizeSp = 16, color = CourtColors.Ink)
            state.last?.let {
                LabelText("LAST LINEUP", color = CourtColors.Ink, sizeSp = 9)
            }
        }
        Spacer(Modifier.height(10.dp))
        BodyText("or set up on phone", color = CourtColors.White40, sizeSp = 10)
    }
}

@Composable
private fun LiveScoreScreen(
    state: MatchState,
    liveBpm: Int,
    onScore: (String) -> Unit,
    onUndo: () -> Unit,
    onPause: () -> Unit,
    onEnd: () -> Unit,
) {
    val paused = state.paused
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp)) {
        // Header: clock (or live bpm) · set/games · LIVE (or PAUSED)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (liveBpm > 0) {
                BodyText("$liveBpm♥", color = CourtColors.Lime, sizeSp = 12)
            } else {
                BodyText(state.clock, color = CourtColors.White45, sizeSp = 12)
            }
            LabelText(listOf(state.setLabel, state.games).filter { it.isNotEmpty() }.joinToString("  "))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Dot(sizeDp = 6, color = if (paused) CourtColors.White45 else CourtColors.Lime)
                Spacer(Modifier.width(4.dp))
                LabelText(
                    if (paused) "PAUSED" else "LIVE",
                    color = if (paused) CourtColors.White45 else CourtColors.Lime,
                    sizeSp = 10,
                )
            }
        }

        // While paused, dim the halves and swallow taps — the phone rejects points
        // when paused anyway, but this keeps the watch honest (docs/watch-sync.md).
        val scoreEnabled = !paused
        TeamRow(
            modifier = Modifier
                .weight(1f)
                .alpha(if (paused) 0.35f else 1f)
                .clickable(enabled = scoreEnabled) { onScore("A") },
            short = state.teamA.short,
            point = state.pointA,
            serving = state.teamA.serving,
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(CourtColors.White25),
        )
        TeamRow(
            modifier = Modifier
                .weight(1f)
                .alpha(if (paused) 0.35f else 1f)
                .clickable(enabled = scoreEnabled) { onScore("B") },
            short = state.teamB.short,
            point = state.pointB,
            serving = state.teamB.serving,
        )

        // Footer: undo · pause/resume · end
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PillButton("UNDO", onClick = onUndo)
            PillButton(if (paused) "RESUME" else "PAUSE", onClick = onPause, accent = paused)
            PillButton("END", onClick = onEnd)
        }
    }
}

/** Rounded outline control matching the LIVE footer style. */
@Composable
private fun PillButton(label: String, onClick: () -> Unit, accent: Boolean = false) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(99.dp))
            .let {
                if (accent) {
                    it.background(CourtColors.Lime)
                } else {
                    it.border(1.dp, CourtColors.White25, RoundedCornerShape(99.dp))
                }
            }
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        LabelText(label, color = if (accent) CourtColors.Ink else CourtColors.White, sizeSp = 10)
    }
}

@Composable
private fun TeamRow(modifier: Modifier, short: String, point: String, serving: Boolean) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Dot(sizeDp = 8, visible = serving)
            Spacer(Modifier.width(7.dp))
            DisplayText(short, sizeSp = 20, color = CourtColors.White)
        }
        DisplayText(point, sizeSp = 56, color = CourtColors.White)
    }
}

@Composable
private fun MatchWonScreen(state: MatchState, onEnd: () -> Unit) {
    val won = state.won
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        DisplayText("MATCH WON", sizeSp = 24, color = CourtColors.Lime)
        Spacer(Modifier.height(6.dp))
        DisplayText(won?.winnerShort ?: state.teamA.short, sizeSp = 30, color = CourtColors.White)
        Spacer(Modifier.height(6.dp))
        DisplayText(won?.scoreLine ?: state.games, sizeSp = 26, color = CourtColors.White45)
        Spacer(Modifier.height(10.dp))
        LabelText(
            listOf(won?.duration ?: "", "SAVED TO PHONE").filter { it.isNotEmpty() }.joinToString(" · "),
            sizeSp = 10,
        )
        Spacer(Modifier.height(14.dp))
        // DONE lets the user leave MATCH WON — the phone persists the finished
        // match and the next state push lands the watch back on IDLE.
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(28.dp))
                .background(CourtColors.Lime)
                .clickable { onEnd() }
                .padding(horizontal = 22.dp, vertical = 10.dp),
        ) {
            DisplayText("DONE", sizeSp = 15, color = CourtColors.Ink)
        }
    }
}
