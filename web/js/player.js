// Пошаговое воспроизведение: шаг index и прогресс перехода к следующему (0..1).

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class StepPlayer {
  constructor(onChange) {
    this.index = 0;
    this.progress = 0;
    this.playing = false;
    this.animating = false;
    this.speed = 1;
    this.onChange = onChange;
    this.token = 0; // увеличивается при каждой остановке, чтобы прервать старую анимацию
  }

  emit() { this.onChange?.(); }

  stop() {
    this.token++;
    this.playing = false;
    this.animating = false;
    this.progress = 0;
    this.emit();
  }

  goTo(i) { this.stop(); this.index = i; this.emit(); }

  prev() { this.stop(); if (this.index > 0) this.index--; this.emit(); }

  next(count) {
    this.stop();
    if (this.index < count - 1) this.animateStep(this.token);
  }

  toggle(count) { this.playing ? this.stop() : this.play(count); }

  async play(count) {
    this.stop();
    if (count < 2) return;
    if (this.index >= count - 1) this.index = 0;
    const my = this.token;
    this.playing = true;
    this.emit();
    await wait(200);
    while (my === this.token && this.index < count - 1) {
      await this.animateStep(my);
      if (my === this.token && this.index < count - 1) await wait(350 / this.speed);
    }
    if (my === this.token) { this.playing = false; this.emit(); }
  }

  animateStep(my) {
    return new Promise((resolve) => {
      this.animating = true;
      const dur = 1500 / this.speed;
      const start = performance.now();
      const frame = (now) => {
        if (my !== this.token) return resolve();
        const t = Math.min(1, (now - start) / dur);
        this.progress = ease(t);
        if (t < 1) {
          this.emit();
          requestAnimationFrame(frame);
        } else {
          this.index++;
          this.progress = 0;
          this.animating = false;
          this.emit();
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
