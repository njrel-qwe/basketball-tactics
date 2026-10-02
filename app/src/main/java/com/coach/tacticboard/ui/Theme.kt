package com.coach.tacticboard.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Scheme = darkColorScheme(
    primary = Color(0xFFFF9A2E),
    onPrimary = Color(0xFF2A1500),
    primaryContainer = Color(0xFF5A3200),
    onPrimaryContainer = Color(0xFFFFDDB8),
    secondary = Color(0xFF7FB8FF),
    onSecondary = Color(0xFF00213F),
    secondaryContainer = Color(0xFF1D3A5C),
    onSecondaryContainer = Color(0xFFD3E4FF),
    tertiary = Color(0xFFFF8A80),
    background = Color(0xFF121820),
    onBackground = Color(0xFFE3E7EC),
    surface = Color(0xFF121820),
    onSurface = Color(0xFFE3E7EC),
    surfaceVariant = Color(0xFF243140),
    onSurfaceVariant = Color(0xFFB9C4D0),
    surfaceContainer = Color(0xFF1A2330),
    surfaceContainerHigh = Color(0xFF212C3A),
    surfaceContainerHighest = Color(0xFF2A3646),
    surfaceContainerLow = Color(0xFF161E29),
    outline = Color(0xFF5B6878),
    outlineVariant = Color(0xFF364252),
    error = Color(0xFFFF6B6B),
)

@Composable
fun TacticTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Scheme, content = content)
}
