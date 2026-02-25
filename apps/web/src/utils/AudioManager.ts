class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  constructor() {
    // Read initial state
    const stored = localStorage.getItem('bb-sound-enabled');
    if (stored !== null) {
      this.enabled = stored === 'true';
    }

    // Listen for changes from React
    if (typeof window !== 'undefined') {
      window.addEventListener('sound-setting-changed', (e: Event) => {
        const customEvent = e as CustomEvent<{ isSoundEnabled: boolean }>;
        this.enabled = customEvent.detail.isSoundEnabled;
      });
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playKick(intensity: number = 1) {
    if (!this.enabled) return;
    this.initCtx();
    const ctx = this.ctx!;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.2 * intensity, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  playBounce(intensity: number = 0.5) {
    if (!this.enabled) return;
    this.initCtx();
    const ctx = this.ctx!;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1 * intensity, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }
  playGoal() {
    if (!this.enabled) return;
    this.initCtx();
    const ctx = this.ctx!;

    // Simple fanfare arpeggio
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    const duration = 0.15;

    notes.forEach((freq, idx) => {
      if (!this.enabled) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.value = freq;

      const startTime = ctx.currentTime + idx * duration;
      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });

    // Hold last note
    const lastOsc = ctx.createOscillator();
    const lastGain = ctx.createGain();
    lastOsc.type = 'square';
    lastOsc.frequency.value = notes[3];

    const lastStartTime = ctx.currentTime + notes.length * duration;
    lastGain.gain.setValueAtTime(0.1, lastStartTime);
    lastGain.gain.linearRampToValueAtTime(0, lastStartTime + 0.5);

    lastOsc.connect(lastGain);
    lastGain.connect(ctx.destination);

    lastOsc.start(lastStartTime);
    lastOsc.stop(lastStartTime + 0.5);
  }
}

export const AudioManager = new AudioManagerImpl();
