/**
 * Music & Beats — Canonical Groove Box / Beat Engine (V39)
 *
 * Consolidates:
 * - 16-step pattern programming for Kick, Snare, and Hi-Hat (app.js, v18.js, v34-looper.js)
 * - 10 Genre Styles & Indian Rhythms: Worship, Pop, Rock, Funk, House, Trap, Reggaeton, Lo-Fi, Keherwa, Dadra
 * - Energy levels (1–5) and procedural variation generators
 * - Master drum bus sound synthesis (clean analog kicks, crisp snares, metallic hats)
 * - Clock synchronization driven strictly by src/scheduler.js
 * - UI playhead step model and event dispatching
 */

import { audioEngine } from './audio-engine.js';
import { scheduler } from './scheduler.js';
import { BEAT_PRESETS, createEmptyPattern, clamp } from './state.js';

export const GROOVE_STYLES = Object.keys(BEAT_PRESETS);

export class GrooveBox {
  constructor(engine = audioEngine, clock = scheduler) {
    this.engine = engine;
    this.scheduler = clock;

    // Pattern State
    this.style = 'Worship';
    this.energy = 3; // 1 to 5
    this.muted = false;
    this.pattern = createEmptyPattern();

    // Step Tracking
    this.currentStep = 0;
    this.subscriptionId = 'groove-box-clock';

    this.listeners = new Set();
    this.loadStyle(this.style, this.energy);
  }

  // ==========================================================================
  // 1. PATTERN GENERATION & PRESETS
  // ==========================================================================

  loadStyle(styleName, energy = this.energy, variation = false) {
    const preset = BEAT_PRESETS[styleName] || BEAT_PRESETS.Worship;
    this.style = BEAT_PRESETS[styleName] ? styleName : 'Worship';
    this.energy = clamp(Math.round(+energy || 3), 1, 5);

    const pat = createEmptyPattern();

    // Map base preset steps
    preset.kick.forEach(s => { pat.kick[s % 16] = true; });
    preset.snare.forEach(s => { pat.snare[s % 16] = true; });
    preset.hat.forEach(s => { pat.hat[s % 16] = true; });

    // Energy scaling additions
    if (this.energy >= 4) {
      // Extra ghost kicks on 16th boundaries
      [3, 11, 14].forEach(s => { pat.kick[s] = true; });
    }
    if (this.energy === 5) {
      // Snare roll and continuous hat
      pat.snare[15] = true;
      for (let i = 0; i < 16; i++) pat.hat[i] = true;
    }
    if (this.energy <= 2) {
      // Stripped back hats
      pat.hat = pat.hat.map((on, i) => (i % 4 === 2 ? on : false));
    }

    if (variation) {
      // Subtly alter off-beats
      pat.kick[7] = !pat.kick[7];
      pat.snare[11] = !pat.snare[11];
    }

    this.pattern = pat;
    this.notify();
    return this.pattern;
  }

  toggleStep(instrument, stepIndex) {
    if (this.pattern[instrument] && stepIndex >= 0 && stepIndex < 16) {
      this.pattern[instrument][stepIndex] = !this.pattern[instrument][stepIndex];
      this.notify();
    }
  }

  setStep(instrument, stepIndex, active) {
    if (this.pattern[instrument] && stepIndex >= 0 && stepIndex < 16) {
      this.pattern[instrument][stepIndex] = !!active;
      this.notify();
    }
  }

  clearPattern() {
    this.pattern = createEmptyPattern();
    this.notify();
  }

  setMuted(muted) {
    this.muted = !!muted;
    this.notify();
  }

  // ==========================================================================
  // 2. SYNTHESIZED DRUM VOICES (Canonical Drum Audio Graph)
  // ==========================================================================

  playKick(time) {
    this.engine.primeAudio();
    const ctx = this.engine.context;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const dest = this.engine.drumBus || this.engine.master;

    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.08);

    gain.gain.setValueAtTime(0.98, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain).connect(dest);
    osc.start(time);
    osc.stop(time + 0.30);
  }

  playSnare(time) {
    this.engine.primeAudio();
    const ctx = this.engine.context;
    if (!ctx) return;

    const dest = this.engine.drumBus || this.engine.master;

    // Body tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(185, time);
    osc.frequency.exponentialRampToValueAtTime(75, time + 0.06);

    oscGain.gain.setValueAtTime(0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    osc.connect(oscGain).connect(dest);
    osc.start(time);
    osc.stop(time + 0.16);

    // Noise snap
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.18));
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.85, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    whiteNoise.connect(filter).connect(noiseGain).connect(dest);
    whiteNoise.start(time);
    whiteNoise.stop(time + 0.20);
  }

  playHat(time) {
    this.engine.primeAudio();
    const ctx = this.engine.context;
    if (!ctx) return;

    const dest = this.engine.drumBus || this.engine.master;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.05));
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 9500;
    filter.Q.value = 3.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    noise.connect(filter).connect(gain).connect(dest);
    noise.start(time);
    noise.stop(time + 0.05);
  }

  // ==========================================================================
  // 3. SCHEDULER INTEGRATION & TIMING
  // ==========================================================================

  start() {
    this.scheduler.onStep(this.subscriptionId, (stepIndex, stepAudioTime) => {
      this.onStep(stepIndex % 16, stepAudioTime);
    });
  }

  stop() {
    this.scheduler.offStep(this.subscriptionId);
    this.currentStep = 0;
  }

  onStep(step16, stepAudioTime) {
    this.currentStep = step16;
    if (this.muted) return;

    if (this.pattern.kick[step16]) {
      this.playKick(stepAudioTime);
    }
    if (this.pattern.snare[step16]) {
      this.playSnare(stepAudioTime);
    }
    if (this.pattern.hat[step16]) {
      this.playHat(stepAudioTime);
    }
  }

  // ==========================================================================
  // 4. SERIALIZATION
  // ==========================================================================

  serializeState() {
    return {
      style: this.style,
      energy: this.energy,
      muted: this.muted,
      pattern: JSON.parse(JSON.stringify(this.pattern))
    };
  }

  restoreState(data) {
    if (!data) return;
    if (data.style && BEAT_PRESETS[data.style]) this.style = data.style;
    if (Number.isFinite(data.energy)) this.energy = clamp(+data.energy, 1, 5);
    if (typeof data.muted === 'boolean') this.muted = data.muted;
    if (data.pattern?.kick?.length === 16) {
      this.pattern = JSON.parse(JSON.stringify(data.pattern));
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try { listener(this); } catch {}
    }
  }
}

// Global Singleton Instance
export const grooveBox = new GrooveBox();
