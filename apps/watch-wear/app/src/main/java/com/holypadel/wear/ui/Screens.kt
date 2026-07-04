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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.holypadel.wear.MatchState
import com.holypadel.wear.Phase

/** Routes to the right screen purely from the mirrored [MatchState.phase]. */
@Composable
fun WatchApp(
    state: MatchState,
    onScore: (String) -> Unit,
    onUndo: () -> Unit,
    onStartLast: () -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxSize().background(CourtColors.Black),
        contentAlignment = Alignment.Center,
    ) {
        when (state.phase) {
            Phase.IDLE -> IdleScreen(state, onStartLast)
            Phase.LIVE -> LiveScoreScreen(state, onScore, onUndo)
            Phase.WON -> MatchWonScreen(state)
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
    onScore: (String) -> Unit,
    onUndo: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 16.dp)) {
        // Header: clock · set/games · LIVE
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BodyText(state.clock, color = CourtColors.White45, sizeSp = 12)
            LabelText(listOf(state.setLabel, state.games).filter { it.isNotEmpty() }.joinToString("  "))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Dot(sizeDp = 6)
                Spacer(Modifier.width(4.dp))
                LabelText("LIVE", color = CourtColors.Lime, sizeSp = 10)
            }
        }

        TeamRow(
            modifier = Modifier.weight(1f).clickable { onScore("A") },
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
            modifier = Modifier.weight(1f).clickable { onScore("B") },
            short = state.teamB.short,
            point = state.pointB,
            serving = state.teamB.serving,
        )

        // Footer: undo + status
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(99.dp))
                    .border(1.dp, CourtColors.White25, RoundedCornerShape(99.dp))
                    .clickable { onUndo() }
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                LabelText("UNDO", color = CourtColors.White, sizeSp = 10)
            }
            if (state.status.isNotEmpty()) {
                DisplayText(state.status, sizeSp = 14, color = CourtColors.Lime)
            }
        }
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
private fun MatchWonScreen(state: MatchState) {
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
    }
}
