package com.coach.tacticboard.editor

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.tween
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Пошаговое воспроизведение: текущий шаг [index] и прогресс анимации [progress]
 * перехода к следующему шагу. Корутины запускаются в scope композиции (нужны кадры).
 */
class StepPlayer {
    var index by mutableIntStateOf(0)
    var progress by mutableFloatStateOf(0f)
        private set
    var playing by mutableStateOf(false)
        private set
    var animating by mutableStateOf(false)
        private set
    var speed by mutableFloatStateOf(1f)

    private var job: Job? = null

    fun togglePlay(scope: CoroutineScope, count: Int) {
        if (playing) stop() else play(scope, count)
    }

    fun play(scope: CoroutineScope, count: Int) {
        stop()
        if (count < 2) return
        if (index >= count - 1) index = 0
        playing = true
        job = scope.launch {
            delay(200)
            while (index < count - 1) {
                animateStep()
                if (index < count - 1) delay((350 / speed).toLong())
            }
            playing = false
        }
    }

    fun next(scope: CoroutineScope, count: Int) {
        stop()
        if (index >= count - 1) return
        job = scope.launch { animateStep() }
    }

    fun prev() {
        stop()
        if (index > 0) index--
    }

    fun goTo(i: Int) {
        stop()
        index = i
    }

    fun stop() {
        job?.cancel()
        job = null
        playing = false
        animating = false
        progress = 0f
    }

    private suspend fun animateStep() {
        animating = true
        animate(0f, 1f, animationSpec = tween((1500 / speed).toInt(), easing = FastOutSlowInEasing)) { v, _ ->
            progress = v
        }
        index++
        progress = 0f
        animating = false
    }
}
