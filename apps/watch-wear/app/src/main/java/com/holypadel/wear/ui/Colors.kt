package com.holypadel.wear.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import com.holypadel.wear.Palette

/** "Court Bold" palette from the design — watch surfaces are near-black. */
object CourtColors {
    val Black = Color(0xFF000000)
    val Ink = Color(0xFF0E1116)
    val InkDeep = Color(0xFF0B0D11)

    /**
     * The highlight and Team B colours are the user's picks on the phone,
     * mirrored through the state payload's `palette`. Snapshot state, so every
     * face recomposes when they change; orange / violet until the first push.
     */
    var Accent by mutableStateOf(Color(0xFFFF6B35))
        private set
    var TeamB by mutableStateOf(Color(0xFF8B7CFF))
        private set

    fun applyPalette(palette: Palette?) {
        if (palette == null) return
        Accent = Color(palette.accent)
        TeamB = Color(palette.teamB)
    }

    val White = Color(0xFFFFFFFF)
    val Greige = Color(0xFFE4E2D9)
    val White45 = Color(0x73FFFFFF)
    val White40 = Color(0x66FFFFFF)
    val White25 = Color(0x40FFFFFF)
}
