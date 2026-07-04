package com.holypadel.wear.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape

/** Anton-style display text: heavy weight + slight tracking approximates the condensed face. */
@Composable
fun DisplayText(
    text: String,
    sizeSp: Int,
    color: Color = CourtColors.White,
    modifier: Modifier = Modifier,
) {
    BasicText(
        text = text,
        modifier = modifier,
        style = TextStyle(
            color = color,
            fontSize = sizeSp.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.5.sp,
            textAlign = TextAlign.Center,
        ),
    )
}

/** Small 800-weight uppercase label with wide tracking. */
@Composable
fun LabelText(
    text: String,
    color: Color = CourtColors.White40,
    sizeSp: Int = 10,
    modifier: Modifier = Modifier,
) {
    BasicText(
        text = text,
        modifier = modifier,
        style = TextStyle(
            color = color,
            fontSize = sizeSp.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 1.4.sp,
            textAlign = TextAlign.Center,
        ),
    )
}

@Composable
fun BodyText(
    text: String,
    color: Color = CourtColors.White,
    sizeSp: Int = 12,
    weight: FontWeight = FontWeight.SemiBold,
    modifier: Modifier = Modifier,
) {
    BasicText(
        text = text,
        modifier = modifier,
        style = TextStyle(color = color, fontSize = sizeSp.sp, fontWeight = weight),
    )
}

/** W/L result chip from the design. */
@Composable
fun ResultBadge(won: Boolean, sizeDp: Int = 22) {
    Box(
        modifier = Modifier
            .size(sizeDp.dp)
            .clip(RoundedCornerShape((sizeDp * 0.28).dp))
            .background(if (won) CourtColors.Lime else CourtColors.Greige),
        contentAlignment = Alignment.Center,
    ) {
        DisplayText(if (won) "W" else "L", sizeSp = (sizeDp * 0.45).toInt(), color = CourtColors.Ink)
    }
}

/** The lime serve/live dot. */
@Composable
fun Dot(sizeDp: Int = 8, color: Color = CourtColors.Lime, visible: Boolean = true) {
    Box(
        modifier = Modifier
            .size(sizeDp.dp)
            .clip(CircleShape)
            .background(if (visible) color else Color.Transparent),
    )
}
