package com.coach.tacticboard

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import com.coach.tacticboard.data.Playbook
import com.coach.tacticboard.data.TacticRepository
import com.coach.tacticboard.editor.EditorScreen
import com.coach.tacticboard.editor.EditorViewModel
import com.coach.tacticboard.library.LibraryScreen
import com.coach.tacticboard.library.duplicate
import com.coach.tacticboard.playbook.PlaybookScreen
import com.coach.tacticboard.ui.TacticTheme

class TacticApp : Application() {
    val repository by lazy { TacticRepository(this) }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val repo = (application as TacticApp).repository
        setContent {
            TacticTheme {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    App(repo)
                }
            }
        }
    }
}

/** Маршрут: "library", "editor:<id>", "playbook:<id>". */
@Composable
private fun App(repo: TacticRepository) {
    var route by rememberSaveable { mutableStateOf("library") }

    when {
        route.startsWith("editor:") -> {
            val id = route.removePrefix("editor:")
            val tactic = repo.get(id)
            if (tactic == null) {
                route = "library"
            } else {
                ScreenScope(route) {
                    val vm = viewModel { EditorViewModel(repo, tactic, persistent = true) }
                    EditorScreen(vm, onBack = { route = "library" })
                }
            }
        }
        route.startsWith("playbook:") -> {
            val entry = Playbook.find(route.removePrefix("playbook:"))
            if (entry == null) {
                route = "library"
            } else {
                BackHandler { route = "library" }
                PlaybookScreen(
                    entry = entry,
                    onBack = { route = "library" },
                    onCopy = {
                        val copy = entry.tactic.duplicate()
                        repo.upsert(copy)
                        route = "editor:${copy.id}"
                    },
                )
            }
        }
        else -> LibraryScreen(
            repo = repo,
            onOpenTactic = { route = "editor:$it" },
            onOpenPlaybook = { route = "playbook:$it" },
        )
    }
}

/** Отдельное хранилище ViewModel для экрана — очищается при уходе с него. */
@Composable
private fun ScreenScope(key: String, content: @Composable () -> Unit) {
    val owner = remember(key) {
        object : ViewModelStoreOwner {
            override val viewModelStore = ViewModelStore()
        }
    }
    DisposableEffect(owner) { onDispose { owner.viewModelStore.clear() } }
    CompositionLocalProvider(LocalViewModelStoreOwner provides owner) {
        Box(Modifier.fillMaxSize()) { content() }
    }
}
