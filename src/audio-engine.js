/**
 * Music & Beats — Canonical Audio Engine (V39)
 *
 * Consolidates:
 * - AudioContext creation, state tracking & idempotent resumption (app.js, core-performance.js)
 * - Master audio graph: Dynamics compressor limiter, synth bus, drum bus, input bus
 * - Voice construction: Multi-oscillator synthesis with detune cents and filter envelope (v17.js)
 * - Expression scaling: velocity, sustain, tone, space (v4-fixes.js)
 * - Fast hard note killing: voice.hardStop() with 6ms linear ramp (v13.js)
 * - Bounded 40-slot ARP voice pool: voice reuse, voice stealing, pitch cancellation, idle cleanup (core-performance.js, core-performance-fixes.js)
 * - Panic / Stop-All: instantly terminates manual notes, latched notes, and voice pool activity
 */

import { SOUND_PRESETS, midiToFreq, clamp, appState } from './state.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.synthBus = null;
    this.synthDry = null;
    this.reverbNode = null;
    this.reverbWet = null;
    this.drumBus = null;
    this.inputGain = null;

    // Active manual & latched voices
    this.activeVoices = new Set();
    this.pointerVoices = new Map();
    this.chordVoices = new Map();

    // Bounded ARP Voice Pool (40 slots)
    this.poolSize = 40;
    this.pool = null;
    this.poolMetrics = {
      poolBuilds: 0,
      poolSteals: 0,
      oscillatorStarts: 0
    };
    this.idleTimer = null;
    this.idleSince = 0;
  }

  // ==========================================================================
  // 1. CONTEXT INITIALIZATION & GRAPH SETUP
  // ==========================================================================

  get context() {
    return this.ctx;
  }

  buildAudio() {
    if (this.ctx) return this.ctx;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });

    // Master bus & DynamicsCompressor limiter
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.88;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -10;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;

    this.master.connect(this.compressor).connect(this.ctx.destination);

    // Synth Bus
    this.synthBus = this.ctx.createGain();
    this.synthDry = this.ctx.createGain();
    this.synthDry.gain.value = 0.9;

    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.createImpulseBuffer(1.5, 2.7);
    this.reverbWet = this.ctx.createGain();
    this.reverbWet.gain.value = 0.16;

    this.synthBus.connect(this.synthDry).connect(this.master);
    this.synthBus.connect(this.reverbNode).connect(this.reverbWet).connect(this.master);

    // Drum Bus
    this.drumBus = this.ctx.createGain();
    this.drumBus.gain.value = 0.78;
    this.drumBus.connect(this.master);

    // Input Gain Bus
    this.inputGain = this.ctx.createGain();

    this.startPoolCleaner();
    return this.ctx;
  }

  createImpulseBuffer(durationSeconds = 1.5, decay = 2.7) {
    if (!this.ctx) return null;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * durationSeconds));
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  async ensureAudio() {
    this.buildAudio();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('AudioContext resume was blocked', err);
      }
    }
    appState.audioReady = !!(this.ctx && this.ctx.state === 'running');
    return this.ctx;
  }

  primeAudio() {
    this.buildAudio();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    appState.audioReady = true;
    return this.ctx;
  }

  // ==========================================================================
  // 2. EFFECTIVE MANUAL & LATCH VOICE (V13, V17 Cumulative Engine)
  // ==========================================================================

  startVoice(midi, presetName = 'Studio Grand', velocity = 0.86, customDest = null) {
    this.primeAudio();
    if (!this.ctx) return null;

    const preset = SOUND_PRESETS[presetName] || SOUND_PRESETS['Studio Grand'];
    const expr = appState.expression;
    const now = this.ctx.currentTime;

    const gainNode = this.ctx.createGain();
    const filterNode = this.ctx.createBiquadFilter();
    filterNode.type = 'lowpass';

    // Expression & Filter Envelope (from V17)
    const baseCut = Math.min(16000, Math.max(500, expr.tone || preset.filter));
    const startCut = Math.min(16000, baseCut * (preset.v17?.filterEnv || 1));
    filterNode.frequency.setValueAtTime(startCut, now);
    filterNode.frequency.exponentialRampToValueAtTime(
      Math.max(450, baseCut),
      now + Math.max(0.04, preset.decay * 0.72)
    );
    filterNode.Q.value = preset.q || 0.3;

    // Amplitude ADSR Envelope (from V4/V17)
    const scaledVel = clamp((velocity || 0.86) * (expr.velocity || 0.78), 0.03, 1.25);
    const peakGain = Math.max(0.001, preset.gain * scaledVel);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(peakGain, now + preset.attack + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(0.001, peakGain * preset.sustain),
      now + preset.attack + preset.decay + 0.01
    );

    // Audio Graph Routing
    const destination = customDest || this.synthBus;
    filterNode.connect(gainNode).connect(destination);

    // Multi-Oscillator Array with Detune Cents (from V17)
    const oscillators = (preset.oscs || [['triangle', 0, 0.72]]).map(def => {
      const [type, semi, level, cents = 0] = def;
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = midiToFreq(midi + semi);
      osc.detune.value = cents;
      oscGain.gain.value = level;
      osc.connect(oscGain).connect(filterNode);
      osc.start(now);
      return osc;
    });

    let isStopped = false;
    const naturalRelease = Math.max(0.035, (expr.sustain || 0.8) * 0.68 + preset.release * 0.34);

    const voice = {
      midi,
      preset: presetName,
      // Natural release
      stop: () => {
        if (isStopped) return;
        isStopped = true;
        const t = this.ctx.currentTime;
        try {
          gainNode.gain.cancelScheduledValues(t);
          gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), t);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, t + naturalRelease);
          oscillators.forEach(osc => osc.stop(t + naturalRelease + 0.04));
        } catch {}
        this.activeVoices.delete(voice);
      },
      // Fast hard kill (from V13: avoids bass/transport note hanging)
      hardStop: () => {
        if (isStopped) return;
        isStopped = true;
        const t = this.ctx.currentTime;
        try {
          gainNode.gain.cancelScheduledValues(t);
          gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), t);
          gainNode.gain.linearRampToValueAtTime(0, t + 0.006);
          oscillators.forEach(osc => osc.stop(t + 0.012));
        } catch {}
        this.activeVoices.delete(voice);
      }
    };

    this.activeVoices.add(voice);
    return voice;
  }

  // ==========================================================================
  // 3. BOUNDED VOICE POOL FOR HIGH-RATE ARP (core-performance.js)
  // ==========================================================================

  makePoolSlot(preset) {
    const amp = this.ctx.createGain();
    amp.gain.value = 0.0001;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = preset.filter || 7600;
    filter.Q.value = preset.q || 0.3;

    filter.connect(amp).connect(this.synthBus);

    const oscs = (preset.oscs || [['triangle', 0, 0.72]]).map(def => {
      const [type, semi, level, cents = 0] = def;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      gain.gain.value = level;
      osc.detune.value = cents;
      osc.connect(gain).connect(filter);
      osc.start();
      this.poolMetrics.oscillatorStarts++;
      return { osc, gain, semi, cents };
    });

    return { amp, filter, oscs, busyUntil: 0, lastMidi: null };
  }

  ensurePool(presetName) {
    this.primeAudio();
    if (!this.ctx) return null;

    const preset = SOUND_PRESETS[presetName] || SOUND_PRESETS['Studio Grand'];
    if (this.pool && this.pool.name === presetName && this.pool.preset === preset) {
      return this.pool;
    }

    this.disposePool();
    const slots = Array.from({ length: this.poolSize }, () => this.makePoolSlot(preset));
    this.pool = {
      name: presetName,
      preset,
      slots,
      cursor: 0,
      oscillatorCount: slots.length * (preset.oscs ? preset.oscs.length : 1)
    };
    this.poolMetrics.poolBuilds++;
    return this.pool;
  }

  chooseSlot(when) {
    if (!this.pool) return null;
    const slots = this.pool.slots;
    for (let n = 0; n < slots.length; n++) {
      const i = (this.pool.cursor + n) % slots.length;
      const slot = slots[i];
      if (slot.busyUntil <= when - 0.001) {
        this.pool.cursor = (i + 1) % slots.length;
        return slot;
      }
    }
    // Eviction / Voice Stealing: find earliest finishing slot
    let slot = slots[0];
    for (const s of slots) {
      if (s.busyUntil < slot.busyUntil) slot = s;
    }
    this.poolMetrics.poolSteals++;
    return slot;
  }

  schedulePooledVoice(midi, presetName, velocity, when, duration) {
    const pool = this.ensurePool(presetName);
    if (!pool) return;
    const slot = this.chooseSlot(when);
    if (!slot) return;

    const preset = pool.preset;
    const expr = appState.expression;
    const amp = slot.amp.gain;
    const filter = slot.filter.frequency;

    const vel = clamp((velocity || 0.76) * (expr?.velocity || 0.78), 0.03, 1.2);
    const peak = Math.max(0.001, preset.gain * vel);
    const cut = Math.min(16000, Math.max(500, expr?.tone || preset.filter));
    const startCut = Math.min(16000, cut * (preset.v17?.filterEnv || 1));

    duration = Math.max(0.004, +duration || 0.02);
    const attack = Math.max(0.001, Math.min(0.018, preset.attack + 0.002, duration * 0.28));
    const decay = Math.max(0.003, Math.min(Math.max(0.006, preset.decay * 0.42), duration * 0.34));
    const release = Math.max(0.004, Math.min(0.045, duration * 0.34));

    const attackEnd = when + attack;
    const decayEnd = Math.min(when + duration * 0.72, attackEnd + decay);
    const off = when + duration;
    const sustain = Math.max(0.001, peak * Math.max(0.08, preset.sustain));

    // Cancel prior automation
    try {
      if (typeof amp.cancelAndHoldAtTime === 'function') {
        amp.cancelAndHoldAtTime(when);
      } else {
        amp.cancelScheduledValues(when);
        amp.setValueAtTime(Math.max(0.0001, amp.value), when);
      }
      amp.setValueAtTime(0.0001, when);
      amp.exponentialRampToValueAtTime(peak, attackEnd);
      amp.exponentialRampToValueAtTime(sustain, Math.max(attackEnd + 0.001, decayEnd));
      amp.setValueAtTime(sustain, off);
      amp.exponentialRampToValueAtTime(0.0001, off + release);
    } catch {}

    try {
      filter.cancelScheduledValues(when);
      filter.setValueAtTime(startCut, when);
      filter.exponentialRampToValueAtTime(
        Math.max(450, cut),
        Math.max(when + 0.004, Math.min(off, when + Math.max(0.02, preset.decay * 0.55)))
      );
    } catch {}
    slot.filter.Q.value = preset.q || 0.3;

    // Retarget oscillator frequencies & detunes
    slot.oscs.forEach(({ osc, semi, cents }) => {
      try {
        osc.frequency.setValueAtTime(midiToFreq(midi + semi), when);
        osc.detune.setValueAtTime(cents, when);
      } catch {}
    });

    slot.busyUntil = off + release + 0.002;
    slot.lastMidi = midi;
  }

  clearFuturePitch(at) {
    if (!this.pool || !this.ctx) return;
    this.pool.slots.forEach(slot => {
      slot.oscs.forEach(({ osc }) => {
        try {
          const f = osc.frequency.value;
          osc.frequency.cancelScheduledValues(at);
          osc.frequency.setValueAtTime(f, at);
        } catch {}
        try {
          const d = osc.detune.value;
          osc.detune.cancelScheduledValues(at);
          osc.detune.setValueAtTime(d, at);
        } catch {}
      });
    });
  }

  disposePool() {
    if (!this.pool) return;
    this.pool.slots.forEach(slot => {
      slot.oscs.forEach(({ osc, gain }) => {
        try { osc.stop(); } catch {}
        try { osc.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      });
      try { slot.filter.disconnect(); } catch {}
      try { slot.amp.disconnect(); } catch {}
    });
    this.pool = null;
  }

  startPoolCleaner() {
    if (this.idleTimer) return;
    this.idleTimer = setInterval(() => {
      if (appState.transportRunning) {
        this.idleSince = 0;
        return;
      }
      if (!this.pool) {
        this.idleSince = 0;
        return;
      }
      if (!this.idleSince) {
        this.idleSince = performance.now();
        return;
      }
      // Idle for >2.6 seconds clears pooled audio nodes to reclaim memory
      if (performance.now() - this.idleSince >= 2600) {
        this.disposePool();
        this.idleSince = 0;
      }
    }, 900);
  }

  // ==========================================================================
  // 4. PANIC & CLEANUP
  // ==========================================================================

  panic() {
    // 1. Stop all active manual pointer voices
    this.pointerVoices.forEach(v => {
      try { v.voice?.hardStop?.() || v.voice?.stop?.(); } catch {}
    });
    this.pointerVoices.clear();

    // 2. Stop all latched chord voices
    this.chordVoices.forEach(voices => {
      voices.forEach(v => {
        try { v.hardStop?.() || v.stop?.(); } catch {}
      });
    });
    this.chordVoices.clear();

    // 3. Stop all remaining active voices
    [...this.activeVoices].forEach(v => {
      try { v.hardStop?.() || v.stop?.(); } catch {}
    });
    this.activeVoices.clear();

    // 4. Clear pool scheduled pitches
    if (this.ctx) {
      this.clearFuturePitch(this.ctx.currentTime + 0.002);
    }
  }
}

// Global Singleton Instance
export const audioEngine = new AudioEngine();
