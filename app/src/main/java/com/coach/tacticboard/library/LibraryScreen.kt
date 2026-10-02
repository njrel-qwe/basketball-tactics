package com.coach.tacticboard.library

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SportsBasketball
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.coach.tacticboard.court.BoardCanvas
import com.coach.tacticboard.data.CourtType
import com.coach.tacticboard.data.Playbook
import com.coach.tacticboard.data.PlaybookEntry
import com.coach.tacticboard.data.Tactic
import com.coach.tacticboard.data.TacticRepository
import com.coach.tacticboard.data.Variant
import com.coach.tacticboard.data.newId
import com.coach.tacticboard.editor.startingFrame
import com.coach.tacticboard.ui.ConfirmDialog
import com.coach.tacticboard.ui.TacticInfoDialog
import com.coach.tacticboard.ui.TextInputDialog
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Копия тактики с новыми идентификаторами (для дублирования и копирования из справочника). */
fun Tactic.duplicate(newName: String = name) = copy(
    id = newId(),
    name = newName,
    variants = variants.map { it.copy(id = newId()) },
    updatedAt = System.currentTimeMillis(),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    repo: TacticRepository,
    onOpenTactic: (String) -> Unit,
    onOpenPlaybook: (String) -> Unit,
) {
    var tab by rememberSaveable { mutableStateOf(0) }
    var showNew by remember { mutableStateOf(false) }
    val tactics by repo.tactics.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.SportsBasketball, null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(10.dp))
                        Text("Тактический планшет", fontWeight = FontWeight.SemiBold)
                    }
                },
            )
        },
        floatingActionButton = {
            if (tab == 0) {
                ExtendedFloatingActionButton(
                    onClick = { showNew = true },
                    icon = { Icon(Icons.Filled.Add, null) },
                    text = { Text("Новая тактика") },
                )
            }
        },
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            PrimaryTabRow(selectedTabIndex = tab, containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Мои тактики (${tactics.size})") })
                Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Готовые комбинации") })
            }
            if (tab == 0) {
                MyTactics(
                    tactics = tactics,
                    repo = repo,
                    onOpen = onOpenTactic,
                    onNew = { showNew = true },
                    onShowPlaybook = { tab = 1 },
                )
            } else {
                PlaybookList(Playbook.entries, onOpenPlaybook)
            }
        }
    }

    if (showNew) {
        var court by remember { mutableStateOf(CourtType.HALF) }
        var setup by remember { mutableStateOf(2) }
        TacticInfoDialog(
            title = "Новая тактика",
            name = "",
            category = "Нападение",
            description = "",
            confirmText = "Создать",
            extra = { NewTacticOptions(court, { court = it }, setup, { setup = it }) },
            onDismiss = { showNew = false },
            onConfirm = { n, c, d ->
                val (home, away) = when (setup) { 0 -> 0 to 0; 1 -> 5 to 0; else -> 5 to 5 }
                val tactic = Tactic(
                    name = n.trim(), category = c, description = d.trim(), court = court,
                    variants = listOf(Variant(name = "Вариант A", frames = listOf(startingFrame(home, away, home > 0)))),
                )
                repo.upsert(tactic)
                showNew = false
                onOpenTactic(tactic.id)
            },
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NewTacticOptions(court: CourtType, onCourt: (CourtType) -> Unit, setup: Int, onSetup: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Площадка", style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FilterChip(court == CourtType.HALF, { onCourt(CourtType.HALF) }, { Text("Половина") })
            FilterChip(court == CourtType.FULL, { onCourt(CourtType.FULL) }, { Text("Вся") })
        }
        Text("Расстановка", style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FilterChip(setup == 0, { onSetup(0) }, { Text("Пусто") })
            FilterChip(setup == 1, { onSetup(1) }, { Text("5 нападающих") })
            FilterChip(setup == 2, { onSetup(2) }, { Text("5 на 5") })
        }
    }
}

@Composable
private fun MyTactics(
    tactics: List<Tactic>,
    repo: TacticRepository,
    onOpen: (String) -> Unit,
    onNew: () -> Unit,
    onShowPlaybook: () -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    var renaming by remember { mutableStateOf<Tactic?>(null) }
    var deleting by remember { mutableStateOf<Tactic?>(null) }

    if (tactics.isEmpty()) {
        Column(
            Modifier.fillMaxSize().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Icon(Icons.Filled.SportsBasketball, null, Modifier.size(72.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(16.dp))
            Text("Пока нет сохранённых тактик", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Text(
                "Создайте первую схему или возьмите за основу готовую комбинацию из справочника.",
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                androidx.compose.material3.Button(onClick = onNew) { Text("Создать") }
                androidx.compose.material3.OutlinedButton(onClick = onShowPlaybook) {
                    Icon(Icons.AutoMirrored.Filled.MenuBook, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Справочник")
                }
            }
        }
        return
    }

    val filtered = tactics
        .filter { query.isBlank() || it.name.contains(query, true) || it.category.contains(query, true) }
        .sortedByDescending { it.updatedAt }

    LazyVerticalGrid(
        columns = GridCells.Adaptive(340.dp),
        contentPadding = PaddingValues(12.dp, 12.dp, 12.dp, 96.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        if (tactics.size > 4) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text("Поиск по названию или категории") },
                    leadingIcon = { Icon(Icons.Filled.Search, null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        items(filtered, key = { it.id }) { t ->
            TacticCard(
                tactic = t,
                subtitle = buildString {
                    if (t.category.isNotBlank()) append(t.category).append(" · ")
                    val steps = t.variants.sumOf { it.frames.size }
                    append(variantsWord(t.variants.size)).append(" · шагов: ").append(steps)
                },
                footer = SimpleDateFormat("d MMM yyyy, HH:mm", Locale.forLanguageTag("ru")).format(Date(t.updatedAt)),
                onClick = { onOpen(t.id) },
                menu = { close ->
                    DropdownMenuItem(text = { Text("Переименовать") }, onClick = { close(); renaming = t })
                    DropdownMenuItem(text = { Text("Дублировать") }, onClick = {
                        close(); repo.upsert(t.duplicate("${t.name} (копия)"))
                    })
                    DropdownMenuItem(text = { Text("Удалить") }, onClick = { close(); deleting = t })
                },
            )
        }
    }

    renaming?.let { t ->
        TextInputDialog(
            title = "Переименовать тактику",
            initial = t.name,
            onDismiss = { renaming = null },
            onConfirm = { repo.upsert(t.copy(name = it.trim(), updatedAt = System.currentTimeMillis())); renaming = null },
        )
    }
    deleting?.let { t ->
        ConfirmDialog(
            title = "Удалить «${t.name}»?",
            text = "Тактика и все её варианты будут удалены без возможности восстановления.",
            confirmText = "Удалить",
            onDismiss = { deleting = null },
            onConfirm = { repo.delete(t.id) },
        )
    }
}

private fun variantsWord(n: Int): String {
    val mod10 = n % 10
    val mod100 = n % 100
    val word = when {
        mod10 == 1 && mod100 != 11 -> "вариант"
        mod10 in 2..4 && mod100 !in 12..14 -> "варианта"
        else -> "вариантов"
    }
    return "$n $word"
}

@Composable
private fun PlaybookList(entries: List<PlaybookEntry>, onOpen: (String) -> Unit) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(340.dp),
        contentPadding = PaddingValues(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Text(
                "Классические комбинации с пошаговой анимацией и объяснениями. Откройте, посмотрите и скопируйте к себе, чтобы изменить.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(4.dp),
            )
        }
        items(entries, key = { it.tactic.id }) { e ->
            TacticCard(
                tactic = e.tactic,
                subtitle = e.summary,
                footer = e.tactic.category + " · " + variantsWord(e.tactic.variants.size),
                onClick = { onOpen(e.tactic.id) },
                menu = null,
                previewStep = 1,
            )
        }
    }
}

@Composable
private fun TacticCard(
    tactic: Tactic,
    subtitle: String,
    footer: String,
    onClick: () -> Unit,
    menu: (@Composable (close: () -> Unit) -> Unit)?,
    previewStep: Int = 0,
) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            val frames = tactic.variants.first().frames
            BoardCanvas(
                court = tactic.court,
                frame = frames[previewStep.coerceAtMost(frames.lastIndex)],
                modifier = Modifier.size(96.dp).clip(RoundedCornerShape(8.dp)),
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(tactic.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                Text(
                    subtitle, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(6.dp))
                Text(footer, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
            }
            if (menu != null) {
                var open by remember { mutableStateOf(false) }
                Box {
                    IconButton(onClick = { open = true }) { Icon(Icons.Filled.MoreVert, "Действия") }
                    DropdownMenu(expanded = open, onDismissRequest = { open = false }) { menu { open = false } }
                }
            }
        }
    }
}

