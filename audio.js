// ============================================================================
// SOUND SYSTEM - Procedural Web Audio API sound effects
// Halo CE-inspired FPS browser game
// ============================================================================

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.ambientSource = null;
    this._initOnGesture();
  }

  _initOnGesture() {
    const init = () => {
      if (this.initialized) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.initialized = true;
        // Start ambient after init
        setTimeout(() => this.playAmbient(), 100);
      } catch (e) {
        console.warn('Web Audio API not available:', e);
      }
    };
    window.addEventListener('click', init, { once: true });
    window.addEventListener('keydown', init, { once: true });
  }

  _ensureCtx() {
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.initialized;
  }

  // --- Utility: create noise buffer ---
  _createNoiseBuffer(duration) {
    const sampleRate = this.ctx.sampleRate;
    const bufLen = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufLen, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // --- Gunshot: AR (noisy burst ~80ms) or Pistol (sharper crack ~60ms) ---
  playShot(weaponType = 'rifle') {
    if (!this._ensureCtx()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (weaponType === 'rifle') {
      // Assault Rifle: low crack + noise burst, ~80ms
      const duration = 0.08;

      // Noise source
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = this._createNoiseBuffer(duration);

      // Bandpass filter for body of shot
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(800, now);
      bpf.frequency.exponentialRampToValueAtTime(200, now + duration);
      bpf.Q.value = 0.8;

      // Gain envelope: sharp attack, fast decay
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(1.0, now + 0.003);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(bpf);
      bpf.connect(gainNode);
      gainNode.connect(ctx.destination);
      noiseSource.start(now);
      noiseSource.stop(now + duration);

      // Low thump oscillator
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.06);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);

    } else {
      // Pistol: sharper crack, ~60ms, higher frequency
      const duration = 0.06;

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = this._createNoiseBuffer(duration);

      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.setValueAtTime(1200, now);
      hpf.frequency.exponentialRampToValueAtTime(400, now + duration);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(1.2, now + 0.002);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(hpf);
      hpf.connect(gainNode);
      gainNode.connect(ctx.destination);
      noiseSource.start(now);
      noiseSource.stop(now + duration);

      // Quick crack transient
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.04);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.4, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  }

  // --- Explosion: low rumble boom using filtered noise ---
  playExplosion() {
    if (!this._ensureCtx()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const duration = 1.2;

    // Low-pass filtered noise for rumble
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this._createNoiseBuffer(duration);

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(400, now);
    lpf.frequency.exponentialRampToValueAtTime(80, now + duration);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1.5, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(lpf);
    lpf.connect(gainNode);
    gainNode.connect(ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + duration);

    // Sub-bass thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(1.0, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // --- Pickup: pleasant chime (two ascending sine tones) ---
  playPickup() {
    if (!this._ensureCtx()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [523.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now + i * 0.08);
      gainNode.gain.linearRampToValueAtTime(0.35, now + i * 0.08 + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.35);
    });
  }

  // --- Player damage: brief distorted buzz ---
  playPlayerDamage() {
    if (!this._ensureCtx()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const duration = 0.12;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this._createNoiseBuffer(duration);

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 300;
    bpf.Q.value = 2;

    // Waveshaper for distortion feel
    const waveshaper = ctx.createWaveShaper();
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
    }
    waveshaper.curve = curve;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.8, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(bpf);
    bpf.connect(waveshaper);
    waveshaper.connect(gainNode);
    gainNode.connect(ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + duration);
  }

  // --- Enemy death: descending filtered noise ---
  playEnemyDeath() {
    if (!this._ensureCtx()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const duration = 0.4;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this._createNoiseBuffer(duration);

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(600, now);
    bpf.frequency.exponentialRampToValueAtTime(100, now + duration);
    bpf.Q.value = 1.5;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(bpf);
    bpf.connect(gainNode);
    gainNode.connect(ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + duration);
  }

  // --- Ambient: looping low-frequency filtered noise, very quiet ---
  playAmbient() {
    if (!this._ensureCtx()) return;
    if (this.ambientSource) return; // Already playing
    const ctx = this.ctx;

    // Create a longer noise buffer for seamless looping
    const duration = 4.0;
    const buffer = this._createNoiseBuffer(duration);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 120;
    lpf.Q.value = 0.5;

    // Second filter for wind texture
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 20;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.04; // Very quiet

    source.connect(lpf);
    lpf.connect(hpf);
    hpf.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();

    this.ambientSource = source;
  }

  stopAmbient() {
    if (this.ambientSource) {
      try { this.ambientSource.stop(); } catch (e) {}
      this.ambientSource = null;
    }
  }
}

window.soundSystem = new SoundSystem();
