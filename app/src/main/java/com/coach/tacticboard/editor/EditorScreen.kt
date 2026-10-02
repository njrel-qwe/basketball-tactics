package com.coach.tacticboard.editor

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Redo
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoFixNormal
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.SportsBasketball
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material.icons.filled.Timeline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coach.tacticboard.court.BoardCanvas
import com.coach.tacticboard.court.BoardColors
import com.coach.tacticboard.data.CourtType
import com.coach.tacticboard.data.Team
import com.coach.tacticboard.export.ImageExporter
import com.coach.tacticboard.ui.ConfirmDialog
import com.coach.tacticboard.ui.LineTypeIcon
import com.coach.tacticboard.ui.TacticInfoDialog
import com.coach.tacticboard.ui.TextInputDialog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private enum class ExportKind { STEP_SAVE, SHEET_SAVE, STEP_SHARE, SHEET_SHARE }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorScreen(vm: EditorViewModel, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var showInfo by remember { mutableStateOf(false) }
    var showClear by remember { mutableStateOf(false) }
    var showNote by remember { mutableStateOf(false) }
    var showDeleteStep by remember { mutableStateOf(false) }
    var variantMenuFor by remember { mutableStateOf<Int?>(null) }
    var renameVariant by remember { mutableStateOf<Int?>(null) }
    var exporting by remember { mutableStateOf(false) }

    // Экран не гаснет, пока тренер показывает схему.
    val view = LocalView.current
    DisposableEffect(Unit) {
        view.keepScreenOn = true
        onDispose { view.keepScreenOn = false }
    }

    BackHandler {
        vm.player.stop()
        vm.saveNow()
        onBack()
    }

    fun export(kind: ExportKind) {
        if (exporting) return
        exporting = true
        scope.launch {
            try {
                val t = vm.tactic
                val v = vm.variant
                val bmp = withContext(Dispatchers.Default) {
                    when (kind) {
                        ExportKind.STEP_SAVE, ExportKind.STEP_SHARE -> ImageExporter.renderStep(t, v, vm.frameIndex)
                        else -> ImageExporter.renderSheet(t, v)
                    }
                }
                when (kind) {
                    ExportKind.STEP_SHARE, ExportKind.SHEET_SHARE -> withContext(Dispatchers.IO) {
                        ImageExporter.share(context, bmp, t)
                    }
                    else -> {
                        val where = withContext(Dispatchers.IO) { ImageExporter.saveToGallery(context, bmp, t) }
                        Toast.makeText(context, "Изображение сохранено: $where", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Не удалось сохранить: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                exporting = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
                navigationIcon = {
                    IconButton(onClick = { vm.player.stop(); vm.saveNow(); onBack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Назад")
                    }
                },
                title = {
                    Column(Modifier.clickable { showInfo = true }) {
                        Text(vm.tactic.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 18.sp)
                        Text(
                            vm.tactic.category.ifBlank { "Нажмите, чтобы изменить название" },
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                        )
                    }
                },
                actions = {
                    IconButton(onClick = vm::undo, enabled = vm.canUndo) { Icon(Icons.AutoMirrored.Filled.Undo, "Отменить") }
                    IconButton(onClick = vm::redo, enabled = vm.canRedo) { Icon(Icons.AutoMirrored.Filled.Redo, "Повторить") }
                    ExportMenu(enabled = !exporting, onExport = ::export)
                    MoreMenu(
                        court = vm.tactic.court,
                        onInfo = { showInfo = true },
                        onToggleCourt = vm::toggleCourt,
                        onClear = { showClear = true },
                    )
                },
            )
        },
    ) { pad ->
        BoxWithConstraints(
            Modifier
                .padding(pad)
                .fillMaxSize()
        ) {
            val wide = maxWidth > maxHeight && maxWidth >= 600.dp
            if (wide) {
                Row(Modifier.fillMaxSize()) {
                    Board(vm, Modifier.weight(1f).fillMaxHeight().padding(8.dp))
                    Column(
                        Modifier
                            .width(340.dp)
                            .fillMaxHeight()
                            .background(MaterialTheme.colorScheme.surfaceContainerLow)
                            .verticalScroll(rememberScrollState())
                            .padding(vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        VariantBar(vm, onChipMenu = { variantMenuFor = it }, menuFor = variantMenuFor,
                            onDismissMenu = { variantMenuFor = null }, onRename = { renameVariant = it })
                        StepBar(vm, scope, onDeleteStep = { showDeleteStep = true })
                        NoteRow(vm.frame.note) { showNote = true }
                        HorizontalDivider()
                        ToolGrid(vm, columns = 3)
                        ActionRow(vm, onClear = { showClear = true })
                    }
                }
            } else {
                Column(Modifier.fillMaxSize()) {
                    VariantBar(vm, onChipMenu = { variantMenuFor = it }, menuFor = variantMenuFor,
                        onDismissMenu = { variantMenuFor = null }, onRename = { renameVariant = it })
                    Board(vm, Modifier.weight(1f).fillMaxWidth().padding(horizontal = 4.dp))
                    NoteRow(vm.frame.note) { showNote = true }
                    StepBar(vm, scope, onDeleteStep = { showDeleteStep = true })
                    Surface(color = MaterialTheme.colorScheme.surfaceContainer) {
                        Column(Modifier.padding(vertical = 4.dp)) {
                            ToolGrid(vm, columns = 6)
                            ActionRow(vm, onClear = { showClear = true })
                        }
                    }
                }
            }
        }
    }

    // ---------- Диалоги ----------

    if (showInfo) {
        TacticInfoDialog(
            title = "Тактика",
            name = vm.tactic.name,
            category = vm.tactic.category,
            description = vm.tactic.description,
            onDismiss = { showInfo = false },
            onConfirm = { n, c, d -> vm.updateInfo(n, c, d); showInfo = false },
        )
    }
    if (showNote) {
        TextInputDialog(
            title = "Комментарий к шагу ${vm.frameIndex + 1}",
            initial = vm.frame.note,
            label = "Что происходит на этом шаге",
            singleLine = false,
            allowEmpty = true,
            onDismiss = { showNote = false },
            onConfirm = { vm.setNote(it); showNote = false },
        )
    }
    if (showClear) {
        AlertDialog(
            onDismissRequest = { showClear = false },
            title = { Text("Очистить") },
            text = {
                Column {
                    ClearOption("Стереть линии на этом шаге") { vm.clearLines(); showClear = false }
                    ClearOption("Очистить всю схему (пустая площадка)") { vm.clearAll(); showClear = false }
                    ClearOption("Начать заново: 5 на 5") { vm.resetToStart(5, 5); showClear = false }
                    ClearOption("Начать заново: только нападение") { vm.resetToStart(5, 0); showClear = false }
                    Text(
                        "Действие можно отменить кнопкой «Отменить».",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { showClear = false }) { Text("Отмена") } },
        )
    }
    if (showDeleteStep) {
        ConfirmDialog(
            title = "Удалить шаг ${vm.frameIndex + 1}?",
            text = "Игроки и линии этого шага будут удалены.",
            confirmText = "Удалить",
            onDismiss = { showDeleteStep = false },
            onConfirm = vm::deleteStep,
        )
    }
    renameVariant?.let { i ->
        TextInputDialog(
            title = "Название варианта",
            initial = vm.tactic.variants.getOrNull(i)?.name ?: "",
            onDismiss = { renameVariant = null },
            onConfirm = { vm.renameVariant(i, it); renameVariant = null },
        )
    }
    vm.labelEditTokenId?.let { id ->
        val token = vm.tokenById(id)
        if (token == null) vm.labelEditTokenId = null else {
            TextInputDialog(
                title = "Номер / метка игрока",
                initial = token.label,
                label = "До 3 символов: 7, C, PG…",
                onDismiss = { vm.labelEditTokenId = null },
                onConfirm = { vm.setTokenLabel(id, it); vm.labelEditTokenId = null },
            )
        }
    }
}

@Composable
private fun ClearOption(text: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Text(text, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun Board(vm: EditorViewModel, modifier: Modifier) {
    val frames = vm.frames
    val idx = vm.frameIndex.coerceIn(0, frames.lastIndex)
    BoardCanvas(
        court = vm.tactic.court,
        frame = frames[idx],
        next = frames.getOrNull(idx + 1),
        progress = vm.player.progress,
        draft = vm.draft,
        highlightId = vm.highlightId,
        input = vm,
        modifier = modifier,
    )
}

@Composable
private fun ExportMenu(enabled: Boolean, onExport: (ExportKind) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }, enabled = enabled) { Icon(Icons.Filled.Image, "Сохранить изображение") }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text("Сохранить шаг в галерею") },
                leadingIcon = { Icon(Icons.Filled.Image, null) },
                onClick = { open = false; onExport(ExportKind.STEP_SAVE) },
            )
            DropdownMenuItem(
                text = { Text("Сохранить все шаги (лист)") },
                leadingIcon = { Icon(Icons.Filled.ContentCopy, null) },
                onClick = { open = false; onExport(ExportKind.SHEET_SAVE) },
            )
            HorizontalDivider()
            DropdownMenuItem(
                text = { Text("Поделиться шагом") },
                leadingIcon = { Icon(Icons.Filled.Share, null) },
                onClick = { open = false; onExport(ExportKind.STEP_SHARE) },
            )
            DropdownMenuItem(
                text = { Text("Поделиться листом") },
                leadingIcon = { Icon(Icons.Filled.Share, null) },
                onClick = { open = false; onExport(ExportKind.SHEET_SHARE) },
            )
        }
    }
}

@Composable
private fun MoreMenu(court: CourtType, onInfo: () -> Unit, onToggleCourt: () -> Unit, onClear: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }) { Icon(Icons.Filled.MoreVert, "Ещё") }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text("Название и описание") },
                leadingIcon = { Icon(Icons.Filled.Edit, null) },
                onClick = { open = false; onInfo() },
            )
            DropdownMenuItem(
                text = { Text(if (court == CourtType.HALF) "Вся площадка" else "Половина площадки") },
                leadingIcon = { Icon(Icons.Filled.SportsBasketball, null) },
                onClick = { open = false; onToggleCourt() },
            )
            DropdownMenuItem(
                text = { Text("Очистить…") },
                leadingIcon = { Icon(Icons.Filled.DeleteSweep, null) },
                onClick = { open = false; onClear() },
            )
        }
    }
}

@Composable
private fun VariantBar(
    vm: EditorViewModel,
    onChipMenu: (Int) -> Unit,
    menuFor: Int?,
    onDismissMenu: () -> Unit,
    onRename: (Int) -> Unit,
) {
    var addMenu by remember { mutableStateOf(false) }
    Row(
        Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        vm.tactic.variants.forEachIndexed { i, v ->
            val selected = i == vm.variantIndex
            Box {
                FilterChip(
                    selected = selected,
                    onClick = { if (selected) onChipMenu(i) else vm.selectVariant(i) },
                    label = { Text(v.name, maxLines = 1) },
                    trailingIcon = if (selected) ({ Icon(Icons.Filled.Edit, null, Modifier.size(14.dp)) }) else null,
                )
                DropdownMenu(expanded = menuFor == i, onDismissRequest = onDismissMenu) {
                    DropdownMenuItem(text = { Text("Переименовать") }, onClick = { onDismissMenu(); onRename(i) })
                    DropdownMenuItem(
                        text = { Text("Удалить вариант") },
                        enabled = vm.tactic.variants.size > 1,
                        onClick = { onDismissMenu(); vm.deleteVariant(i) },
                    )
                }
            }
        }
        Box {
            TextButton(onClick = { addMenu = true }, contentPadding = PaddingValues(horizontal = 8.dp)) {
                Icon(Icons.Filled.Add, null, Modifier.size(18.dp))
                Text("Вариант")
            }
            DropdownMenu(expanded = addMenu, onDismissRequest = { addMenu = false }) {
                DropdownMenuItem(
                    text = { Text("Копия текущего варианта") },
                    onClick = { addMenu = false; vm.addVariant(copyCurrent = true) },
                )
                DropdownMenuItem(
                    text = { Text("С начальной расстановки") },
                    onClick = { addMenu = false; vm.addVariant(copyCurrent = false) },
                )
            }
        }
    }
}

@Composable
private fun NoteRow(note: String, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.EditNote, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(8.dp))
        Text(
            note.ifBlank { "Добавить комментарий к шагу" },
            style = MaterialTheme.typography.bodyMedium,
            color = if (note.isBlank()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun StepBar(vm: EditorViewModel, scope: CoroutineScope, onDeleteStep: () -> Unit) {
    val player = vm.player
    val count = vm.frames.size
    var stepsMenu by remember { mutableStateOf(false) }
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = player::prev, enabled = player.index > 0 || player.animating) {
            Icon(Icons.Filled.SkipPrevious, "Назад")
        }
        Box {
            TextButton(onClick = { stepsMenu = true }, contentPadding = PaddingValues(horizontal = 6.dp)) {
                Text("Шаг ${player.index + 1}/$count", fontWeight = FontWeight.SemiBold)
            }
            DropdownMenu(expanded = stepsMenu, onDismissRequest = { stepsMenu = false }) {
                vm.frames.forEachIndexed { i, f ->
                    DropdownMenuItem(
                        text = { Text("${i + 1}. " + f.note.ifBlank { "Шаг ${i + 1}" }, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                        onClick = { stepsMenu = false; player.goTo(i) },
                    )
                }
            }
        }
        FilledIconButton(
            onClick = { player.togglePlay(scope, count) },
            enabled = count > 1,
            modifier = Modifier.size(48.dp),
        ) {
            Icon(if (player.playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (player.playing) "Пауза" else "Воспроизвести")
        }
        IconButton(onClick = { player.next(scope, count) }, enabled = player.index < count - 1) {
            Icon(Icons.Filled.SkipNext, "Вперёд")
        }
        TextButton(onClick = {
            player.speed = when (player.speed) { 1f -> 2f; 2f -> 0.5f; else -> 1f }
        }, contentPadding = PaddingValues(horizontal = 4.dp)) {
            Text(
                when (player.speed) { 2f -> "2×"; 0.5f -> "½×"; else -> "1×" },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.weight(1f))
        TextButton(onClick = vm::addStep, contentPadding = PaddingValues(horizontal = 8.dp)) {
            Icon(Icons.Filled.Add, null, Modifier.size(18.dp))
            Text("Шаг")
        }
        IconButton(onClick = onDeleteStep, enabled = count > 1) {
            Icon(Icons.Filled.Delete, "Удалить шаг")
        }
    }
}

@Composable
private fun ToolGrid(vm: EditorViewModel, columns: Int) {
    val tools = Tool.entries
    Column(Modifier.padding(horizontal = 6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        tools.chunked(columns).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                row.forEach { tool -> ToolButton(vm, tool) }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun RowScope.ToolButton(vm: EditorViewModel, tool: Tool) {
    val selected = vm.tool == tool
    val fg = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
    Column(
        Modifier
            .weight(1f)
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) MaterialTheme.colorScheme.primary else Color.Transparent)
            .clickable { vm.tool = tool }
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.height(26.dp), contentAlignment = Alignment.Center) {
            when {
                tool.lineType != null -> LineTypeIcon(tool.lineType, fg)
                tool == Tool.SELECT -> Icon(Icons.Filled.PanTool, null, tint = fg, modifier = Modifier.size(22.dp))
                else -> Icon(Icons.Filled.AutoFixNormal, null, tint = fg, modifier = Modifier.size(22.dp))
            }
        }
        Text(tool.title, fontSize = 11.sp, color = fg, maxLines = 1)
    }
}

@Composable
private fun ActionRow(vm: EditorViewModel, onClear: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        ActionButton("Свой", Icons.Filled.PersonAdd, Color(0xFF7FB8FF)) { vm.addPlayer(Team.HOME) }
        ActionButton("Соперник", Icons.Filled.PersonAdd, Color(0xFFFF8A80)) { vm.addPlayer(Team.AWAY) }
        ActionButton(
            if (vm.frame.ball == null) "Мяч" else "Убрать мяч",
            Icons.Filled.SportsBasketball,
            BoardColors.Ball,
        ) { vm.toggleBall() }
        ActionButton(
            if (vm.straightLines) "Прямые" else "Кривые",
            if (vm.straightLines) Icons.Filled.Straighten else Icons.Filled.Timeline,
            MaterialTheme.colorScheme.onSurface,
        ) { vm.straightLines = !vm.straightLines }
        ActionButton("Очистить", Icons.Filled.DeleteSweep, MaterialTheme.colorScheme.onSurface, onClick = onClear)
    }
}

@Composable
private fun RowScope.ActionButton(label: String, icon: ImageVector, tint: Color, onClick: () -> Unit) {
    Column(
        Modifier
            .weight(1f)
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(22.dp))
        Text(label, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
