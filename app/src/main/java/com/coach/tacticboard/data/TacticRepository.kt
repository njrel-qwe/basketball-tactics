package com.coach.tacticboard.data

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

@Serializable
private data class Storage(val version: Int = 1, val tactics: List<Tactic> = emptyList())

/** Хранит тактики в JSON-файле во внутренней памяти приложения. */
class TacticRepository(context: Context) {
    private val file = File(context.filesDir, "tactics.json")
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val writeLock = Mutex()

    private val _tactics = MutableStateFlow(load())
    val tactics: StateFlow<List<Tactic>> = _tactics.asStateFlow()

    fun get(id: String): Tactic? = _tactics.value.firstOrNull { it.id == id }

    fun upsert(tactic: Tactic) {
        _tactics.update { list ->
            val i = list.indexOfFirst { it.id == tactic.id }
            if (i >= 0) list.toMutableList().also { it[i] = tactic } else listOf(tactic) + list
        }
        persist()
    }

    fun delete(id: String) {
        _tactics.update { list -> list.filterNot { it.id == id } }
        persist()
    }

    private fun load(): List<Tactic> = try {
        if (file.exists()) json.decodeFromString<Storage>(file.readText()).tactics else emptyList()
    } catch (e: Exception) {
        // Повреждённый файл не должен ронять приложение — сохраняем копию и начинаем заново.
        file.copyTo(File(file.parentFile, "tactics.broken.json"), overwrite = true)
        emptyList()
    }

    private fun persist() {
        scope.launch {
            writeLock.withLock {
                // Берём актуальный список внутри блокировки — порядок запусков не важен.
                val snapshot = _tactics.value
                val tmp = File(file.parentFile, "tactics.json.tmp")
                tmp.writeText(json.encodeToString(Storage.serializer(), Storage(tactics = snapshot)))
                if (!tmp.renameTo(file)) {
                    file.delete()
                    tmp.renameTo(file)
                }
            }
        }
    }
}
