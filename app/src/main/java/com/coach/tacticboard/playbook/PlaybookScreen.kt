package com.coach.tacticboard.playbook

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.coach.tacticboard.court.BoardCanvas
import com.coach.tacticboard.data.PlaybookEntry
import com.coach.tacticboard.editor.StepPlayer

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaybookScreen(entry: PlaybookEntry, onBack: () -> Unit, onCopy: () -> Unit) {
    val tactic = entry.tactic
    var variantIndex by remember { mutableIntStateOf(0) }
    val player = remember { StepPlayer() }
    val scope = rememberCoroutineScope()
    val frames = tactic.variants[variantIndex].frames

    val view = LocalView.current
    DisposableEffect(Unit) {
        view.keepScreenOn = true
        onDispose { view.keepScreenOn = false }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
                navigationIcon = {
                    IconButton(onClick = { player.stop(); onBack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Назад") }
                },
                title = { Text(tactic.name) },
                actions = {
                    IconButton(onClick = { player.stop(); onCopy() }) {
                        Icon(Icons.Filled.ContentCopy, "Скопировать в мои тактики")
                    }
                },
            )
        },
    ) { pad ->
        BoxWithConstraints(Modifier.padding(pad).fillMaxSize()) {
            val wide = maxWidth > maxHeight && maxWidth >= 600.dp
            val boardHeight = maxWidth * 0.95f
            val board: @Composable (Modifier) -> Unit = { m ->
                val idx = player.index.coerceIn(0, frames.lastIndex)
                BoardCanvas(
                    court = tactic.court,
                    frame = frames[idx],
                    next = frames.getOrNull(idx + 1),
                    progress = player.progress,
                    modifier = m,
                )
            }
            val controls: @Composable () -> Unit = {
                Column(Modifier.padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (tactic.variants.size > 1) {
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            tactic.variants.forEachIndexed { i, v ->
                                FilterChip(
                                    selected = i == variantIndex,
                                    onClick = { player.stop(); variantIndex = i; player.goTo(0) },
                                    label = { Text(v.name) },
                                )
                            }
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = player::prev, enabled = player.index > 0) { Icon(Icons.Filled.SkipPrevious, "Назад") }
                        FilledIconButton(onClick = { player.togglePlay(scope, frames.size) }, modifier = Modifier.size(52.dp)) {
                            Icon(if (player.playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, "Воспроизвести")
                        }
                        IconButton(onClick = { player.next(scope, frames.size) }, enabled = player.index < frames.lastIndex) {
                            Icon(Icons.Filled.SkipNext, "Вперёд")
                        }
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "Шаг ${player.index + 1} из ${frames.size}",
                            style = MaterialTheme.typography.titleSmall,
                        )
                    }
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
                        modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
                    ) {
                        Text(
                            frames[player.index.coerceIn(0, frames.lastIndex)].note,
                            modifier = Modifier.padding(12.dp),
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                }
            }
            val explanation: @Composable () -> Unit = {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Суть", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                    Text(tactic.description, style = MaterialTheme.typography.bodyMedium)
                    Text(
                        "Ключевые моменты", style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 4.dp),
                    )
                    entry.keyPoints.forEach { point ->
                        Row {
                            Text("•  ", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                            Text(point, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Button(onClick = { player.stop(); onCopy() }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Filled.ContentCopy, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Скопировать в мои тактики и изменить")
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }

            if (wide) {
                Row(Modifier.fillMaxSize()) {
                    board(Modifier.weight(1f).fillMaxHeight().padding(8.dp))
                    Column(Modifier.width(380.dp).fillMaxHeight().verticalScroll(rememberScrollState()).padding(top = 8.dp)) {
                        controls()
                        explanation()
                    }
                }
            } else {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    board(Modifier.fillMaxWidth().height(boardHeight).padding(4.dp))
                    controls()
                    explanation()
                }
            }
        }
    }
}
