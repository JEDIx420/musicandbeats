/**
 * Music & Beats — Canonical Effects Rack & DSP Utilities (V39)
 *
 * Consolidates:
 * - Reusable DSP primitives: Waveshaper distortion curves, convolution impulse responses
 * - General Synth Performance Rack (Clean Studio, Neon Wide, Festival Stack, Dream Hall, Lo-Fi Tape, Acid Room, Bass Forge)
 * - Rotary Hardware Knobs & Pedal Stomp graph management (v17.js)
 * - Complete V39 Lead FX Graph: 20 Deep FX presets (Dry, Studio, Wide Chorus, Deep Phaser, Tremolo, Vibrato,
 *   Auto Wah, Warm Drive, Crunch, Fuzz Lead, Slapback, Tape Echo, Ping Pong, Plate, Hall, Cathedral, Dream Space,
 *   Lo-Fi, Indian Space, Fusion Solo) with Stereo Panner, LFO modulation, Highpass/Presence filtering, Compressor,
 *   and dynamic backing mixer output scaling (v39-lead.js)
 */

import { audioEngine } from './audio-engine.js';
import { appState, clamp } from './state.js';

// ============================================================================
// 1. REUSABLE DSP MATHEMATICS & RESOURCE GENERATORS
// ============================================================================

/**
 * Generates an asymmetric hyperbolic tangent distortion transfer curve.
 * Cached to eliminate redundant allocation on note trigger.
 */
const driveCurveCache = new Map();

export function createDriveCurve(amount = 0) {
  const rounded = Math.round(amount * 1000) / 1000;
  if (driveCurveCache.has(rounded)) {
    return driveCurveCache.get(rounded);
  }

  const n = 1024;
  const curve = new Float32Array(n);
  const k = 1 + rounded * 55;

  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(x * k) / Math.tanh(k);
  }

  driveCurveCache.set(rounded, curve);
  return curve;
}

/**
 * Generates an algebraic saturation transfer curve (used in V38/V39 Lead FX).
 */
export function createLeadDriveCurve(amount = 0) {
  const n = 2048;
  const arr = new Float32Array(n);
  const a = Math.max(0, amount);

  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    arr[i] = ((1 + a) * x) / (1 + a * Math.abs(x));
  }

  return arr;
}

/**
 * Synthesizes a stereo exponential impulse response for convolver reverb.
 */
export function createImpulseBuffer(ctx, durationSeconds = 1.5, decay = 2.7) {
  if (!ctx) return null;
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }

  return buffer;
}

// ============================================================================
// 2. PERFORMANCE RACK PRESETS & RACK MANAGER (V17)
// ============================================================================

export const PERFORMANCE_BOARDS = {
  'Clean Studio':   { drive: { on: false, amount: 0.05 }, chorus: { on: false, amount: 0.12 }, delay: { on: false, amount: 0.12 }, reverb: { on: true,  amount: 0.18 } },
  'Neon Wide':      { drive: { on: false, amount: 0.08 }, chorus: { on: true,  amount: 0.46 }, delay: { on: true,  amount: 0.19 }, reverb: { on: true,  amount: 0.24 } },
  'Festival Stack': { drive: { on: true,  amount: 0.34 }, chorus: { on: true,  amount: 0.24 }, delay: { on: true,  amount: 0.31 }, reverb: { on: true,  amount: 0.20 } },
  'Dream Hall':     { drive: { on: false, amount: 0.04 }, chorus: { on: true,  amount: 0.31 }, delay: { on: true,  amount: 0.39 }, reverb: { on: true,  amount: 0.62 } },
  'Lo-Fi Tape':     { drive: { on: true,  amount: 0.19 }, chorus: { on: true,  amount: 0.14 }, delay: { on: true,  amount: 0.16 }, reverb: { on: true,  amount: 0.13 } },
  'Acid Room':      { drive: { on: true,  amount: 0.47 }, chorus: { on: false, amount: 0.08 }, delay: { on: true,  amount: 0.18 }, reverb: { on: true,  amount: 0.10 } },
  'Bass Forge':     { drive: { on: true,  amount: 0.24 }, chorus: { on: false, amount: 0.05 }, delay: { on: false, amount: 0.06 }, reverb: { on: true,  amount: 0.08 } }
};

export class PerformanceRack {
  constructor(engine = audioEngine) {
    this.engine = engine;
    this.board = 'Clean Studio';
    this.state = JSON.parse(JSON.stringify(PERFORMANCE_BOARDS['Clean Studio']));
    this.nodes = null;
  }

  ensureGraph() {
    this.engine.buildAudio();
    const ctx = this.engine.context;
    if (!ctx) return null;
    if (this.nodes) return this.nodes;

    const n = {};
    n.input = ctx.createGain();

    // Drive (WaveShaper)
    n.drive = ctx.createWaveShaper();
    n.drive.oversample = '4x';

    // Tone Filter
    n.tone = ctx.createBiquadFilter();
    n.tone.type = 'lowpass';

    // Bus Compressor
    n.comp = ctx.createDynamicsCompressor();
    n.comp.threshold.value = -12;
    n.comp.knee.value = 10;
    n.comp.ratio.value = 3;
    n.comp.attack.value = 0.004;
    n.comp.release.value = 0.16;

    // Dry / Wet Paths
    n.dry = ctx.createGain();

    // Chorus
    n.chorus = ctx.createDelay(0.06);
    n.chorus.delayTime.value = 0.018;
    n.chorusWet = ctx.createGain();
    n.lfo = ctx.createOscillator();
    n.lfoDepth = ctx.createGain();
    n.lfo.frequency.value = 0.66;
    n.lfoDepth.gain.value = 0.003;
    n.lfo.connect(n.lfoDepth).connect(n.chorus.delayTime);
    n.lfo.start();

    // Delay & Feedback
    n.delay = ctx.createDelay(1.4);
    n.feedback = ctx.createGain();
    n.delayWet = ctx.createGain();

    // Reverb
    n.reverb = ctx.createConvolver();
    n.reverb.buffer = createImpulseBuffer(ctx, 1.5, 2.7);
    n.reverbWet = ctx.createGain();

    // Wire graph
    const synthBus = this.engine.synthBus;
    const master = this.engine.master;

    try { synthBus.disconnect(); } catch {}
    synthBus.connect(n.input).connect(n.drive).connect(n.tone).connect(n.comp);

    n.comp.connect(n.dry).connect(master);
    n.comp.connect(n.chorus).connect(n.chorusWet).connect(master);
    n.comp.connect(n.delay);
    n.delay.connect(n.delayWet).connect(master);
    n.delay.connect(n.feedback).connect(n.delay);
    n.comp.connect(n.reverb).connect(n.reverbWet).connect(master);

    this.nodes = n;
    this.apply();
    return n;
  }

  apply() {
    const ctx = this.engine.context;
    if (!ctx || !this.nodes) return;

    const n = this.nodes;
    const s = this.state;
    const expr = appState.expression;
    const t = ctx.currentTime;

    // Drive curve
    n.drive.curve = createDriveCurve(s.drive.on ? s.drive.amount : 0);

    // Tone cutoff
    n.tone.frequency.setTargetAtTime(clamp(expr.tone || 7000, 700, 14000), t, 0.02);

    // Chorus
    n.chorusWet.gain.setTargetAtTime(s.chorus.on ? s.chorus.amount * 0.52 : 0, t, 0.02);
    n.lfoDepth.gain.setTargetAtTime(0.001 + s.chorus.amount * 0.011, t, 0.02);

    // Delay
    n.delay.delayTime.setTargetAtTime(0.12 + s.delay.amount * 0.52, t, 0.02);
    n.feedback.gain.setTargetAtTime(s.delay.on ? Math.min(0.62, 0.08 + s.delay.amount * 0.56) : 0, t, 0.02);
    n.delayWet.gain.setTargetAtTime(s.delay.on ? s.delay.amount * 0.48 : 0, t, 0.02);

    // Reverb Space
    const space = clamp(expr.space ?? 0.18, 0, 0.75);
    n.reverbWet.gain.setTargetAtTime(
      s.reverb.on ? space * 0.36 + s.reverb.amount * 0.34 : space * 0.18,
      t,
      0.02
    );
  }

  loadBoard(boardName) {
    const preset = PERFORMANCE_BOARDS[boardName];
    if (!preset) return;
    this.board = boardName;
    ['drive', 'chorus', 'delay', 'reverb'].forEach(effect => {
      this.state[effect] = { ...preset[effect] };
    });
    this.apply();
  }
}

// ============================================================================
// 3. V38 / V39 LEAD DEEP FX GRAPH BUILDER (v39-lead.js)
// ============================================================================

export const LEAD_FX_PRESETS = {
  'Dry':          { mod: 'Off',      drive: 'Off',    delay: 'Off',       space: 'Off',       intensity: 20, wet: 0,  tone: 82 },
  'Studio':       { mod: 'Off',      drive: 'Warm',   delay: 'Slap',      space: 'Room',      intensity: 28, wet: 20, tone: 76 },
  'Wide Chorus':  { mod: 'Chorus',   drive: 'Off',    delay: 'Off',       space: 'Plate',     intensity: 55, wet: 38, tone: 78 },
  'Deep Phaser':  { mod: 'Phaser',   drive: 'Warm',   delay: 'Tape',      space: 'Plate',     intensity: 62, wet: 42, tone: 72 },
  'Tremolo':      { mod: 'Tremolo',  drive: 'Off',    delay: 'Off',       space: 'Room',      intensity: 58, wet: 30, tone: 80 },
  'Vibrato':      { mod: 'Vibrato',  drive: 'Off',    delay: 'Slap',      space: 'Plate',     intensity: 44, wet: 30, tone: 82 },
  'Auto Wah':     { mod: 'Auto Wah', drive: 'Warm',   delay: 'Off',       space: 'Room',      intensity: 64, wet: 34, tone: 70 },
  'Warm Drive':   { mod: 'Off',      drive: 'Warm',   delay: 'Slap',      space: 'Room',      intensity: 48, wet: 22, tone: 65 },
  'Crunch':       { mod: 'Off',      drive: 'Crunch', delay: 'Tape',      space: 'Plate',     intensity: 60, wet: 30, tone: 58 },
  'Fuzz Lead':    { mod: 'Off',      drive: 'Fuzz',   delay: 'Stereo',    space: 'Hall',      intensity: 72, wet: 38, tone: 52 },
  'Slapback':     { mod: 'Off',      drive: 'Warm',   delay: 'Slap',      space: 'Room',      intensity: 42, wet: 34, tone: 74 },
  'Tape Echo':    { mod: 'Chorus',   drive: 'Warm',   delay: 'Tape',      space: 'Plate',     intensity: 56, wet: 46, tone: 62 },
  'Ping Pong':    { mod: 'Off',      drive: 'Off',    delay: 'Ping Pong', space: 'Hall',      intensity: 60, wet: 48, tone: 78 },
  'Plate':        { mod: 'Off',      drive: 'Off',    delay: 'Off',       space: 'Plate',     intensity: 48, wet: 44, tone: 82 },
  'Hall':         { mod: 'Off',      drive: 'Off',    delay: 'Stereo',    space: 'Hall',      intensity: 52, wet: 50, tone: 80 },
  'Cathedral':    { mod: 'Chorus',   drive: 'Off',    delay: 'Stereo',    space: 'Cathedral', intensity: 70, wet: 66, tone: 74 },
  'Dream Space':  { mod: 'Chorus',   drive: 'Off',    delay: 'Ping Pong', space: 'Cathedral', intensity: 76, wet: 70, tone: 76 },
  'Lo-Fi':        { mod: 'Tremolo',  drive: 'Crunch', delay: 'Tape',      space: 'Room',      intensity: 46, wet: 32, tone: 34 },
  'Indian Space': { mod: 'Vibrato',  drive: 'Warm',   delay: 'Tape',      space: 'Hall',      intensity: 50, wet: 48, tone: 72 },
  'Fusion Solo':  { mod: 'Chorus',   drive: 'Crunch', delay: 'Stereo',    space: 'Plate',     intensity: 58, wet: 40, tone: 68 }
};

export class LeadEffectsGraph {
  constructor(engine = audioEngine) {
    this.engine = engine;
    this.presetName = 'Studio';
    this.fxConfig = { ...LEAD_FX_PRESETS.Studio };
    this.nodes = [];
    this.lfos = [];
    this.inputNode = null;
    this.outputNode = null;
  }

  cleanGraph() {
    for (const lfo of this.lfos) {
      try { lfo.stop(); } catch {}
    }
    this.lfos = [];
    for (const node of this.nodes) {
      try { node.disconnect(); } catch {}
    }
    this.nodes = [];
    this.inputNode = null;
    this.outputNode = null;
  }

  buildGraph(config = this.fxConfig) {
    this.engine.buildAudio();
    const ctx = this.engine.context;
    if (!ctx) return null;

    this.cleanGraph();
    this.fxConfig = { ...config };

    const f = this.fxConfig;
    const intensity = (+f.intensity || 0) / 100;
    const wet = (+f.wet || 0) / 100;

    const input = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1800 + Math.pow((+f.tone || 70) / 100, 1.5) * 15000;
    tone.Q.value = 0.25;

    const drive = ctx.createWaveShaper();
    const driveAmount = f.drive === 'Warm' ? 1.2 : f.drive === 'Crunch' ? 4 : f.drive === 'Fuzz' ? 12 : 0;
    drive.curve = createLeadDriveCurve(driveAmount);
    drive.oversample = '2x';

    input.connect(tone).connect(drive);
    let current = drive;
    this.nodes.push(input, tone, drive);

    // 1. Modulation Stage (Chorus, Vibrato, Tremolo, Phaser, Auto-Wah)
    if (f.mod === 'Chorus' || f.mod === 'Vibrato') {
      const isVib = f.mod === 'Vibrato';
      const dry = ctx.createGain();
      const delay = ctx.createDelay(0.06);
      const modWet = ctx.createGain();
      const sum = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      dry.gain.value = isVib ? 0.18 : 0.72;
      modWet.gain.value = isVib ? 0.92 : 0.48;
      delay.delayTime.value = isVib ? 0.004 : 0.014;
      lfo.frequency.value = isVib ? 4.8 : 1.1;
      lfoGain.gain.value = (isVib ? 0.0025 : 0.006) * intensity;

      lfo.connect(lfoGain).connect(delay.delayTime);
      current.connect(dry).connect(sum);
      current.connect(delay).connect(modWet).connect(sum);
      lfo.start();

      this.lfos.push(lfo);
      this.nodes.push(dry, delay, modWet, sum, lfoGain);
      current = sum;
    } else if (f.mod === 'Tremolo') {
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      gain.gain.value = 1 - intensity * 0.35;
      lfo.frequency.value = 3.2 + intensity * 4;
      lfoGain.gain.value = intensity * 0.34;

      lfo.connect(lfoGain).connect(gain.gain);
      current.connect(gain);
      lfo.start();

      this.lfos.push(lfo);
      this.nodes.push(gain, lfoGain);
      current = gain;
    } else if (f.mod === 'Phaser') {
      const sum = ctx.createGain();
      let chain = current;

      for (let i = 0; i < 4; i++) {
        const ap = ctx.createBiquadFilter();
        ap.type = 'allpass';
        ap.frequency.value = 550 + i * 420;
        ap.Q.value = 1.1 + intensity * 4;
        chain.connect(ap);
        chain = ap;
        this.nodes.push(ap);
      }

      const dry = ctx.createGain();
      const modWet = ctx.createGain();
      dry.gain.value = 0.64;
      modWet.gain.value = 0.58;

      current.connect(dry).connect(sum);
      chain.connect(modWet).connect(sum);
      this.nodes.push(sum, dry, modWet);
      current = sum;
    } else if (f.mod === 'Auto Wah') {
      const wah = ctx.createBiquadFilter();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      wah.type = 'bandpass';
      wah.frequency.value = 700 + intensity * 600;
      wah.Q.value = 2.5 + intensity * 5;
      lfo.frequency.value = 1.2 + intensity * 2.6;
      lfoGain.gain.value = 500 + intensity * 1600;

      lfo.connect(lfoGain).connect(wah.frequency);
      current.connect(wah);
      lfo.start();

      this.lfos.push(lfo);
      this.nodes.push(wah, lfoGain);
      current = wah;
    }

    // 2. Delay & Stereo Stage (Slap, Tape, Stereo, Ping Pong)
    const delayDry = ctx.createGain();
    const delayWetGain = ctx.createGain();
    const delayNode = ctx.createDelay(1.2);
    const feedback = ctx.createGain();
    const delaySum = ctx.createGain();

    delayDry.gain.value = 1;
    delayWetGain.gain.value = f.delay === 'Off' ? 0 : Math.min(0.72, wet * 0.85 + 0.08);
    delayNode.delayTime.value =
      f.delay === 'Slap' ? 0.09 :
      f.delay === 'Tape' ? 0.29 :
      f.delay === 'Stereo' ? 0.38 :
      f.delay === 'Ping Pong' ? 0.46 : 0.01;
    feedback.gain.value = f.delay === 'Off' ? 0 : Math.min(0.68, 0.18 + intensity * 0.45);

    current.connect(delayDry).connect(delaySum);
    current.connect(delayNode);
    delayNode.connect(feedback).connect(delayNode);

    let delayOut = delayNode;
    if ((f.delay === 'Stereo' || f.delay === 'Ping Pong') && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = f.delay === 'Ping Pong' ? 0.72 : 0.38;
      delayNode.connect(panner);
      delayOut = panner;
      this.nodes.push(panner);
    }
    delayOut.connect(delayWetGain).connect(delaySum);
    this.nodes.push(delayDry, delayWetGain, delayNode, feedback, delaySum);
    current = delaySum;

    // 3. Reverb Convolution Stage (Room, Plate, Hall, Cathedral)
    const reverbDry = ctx.createGain();
    const reverbWetGain = ctx.createGain();
    const convolver = ctx.createConvolver();
    const reverbSum = ctx.createGain();

    const sec =
      f.space === 'Room' ? 0.7 :
      f.space === 'Plate' ? 1.3 :
      f.space === 'Hall' ? 2.4 :
      f.space === 'Cathedral' ? 4.2 : 0.2;
    const decay =
      f.space === 'Cathedral' ? 3.2 :
      f.space === 'Hall' ? 2.8 : 2.2;

    convolver.buffer = createImpulseBuffer(ctx, sec, decay);
    reverbDry.gain.value = 1;
    reverbWetGain.gain.value = f.space === 'Off' ? 0 : Math.min(0.78, wet);

    current.connect(reverbDry).connect(reverbSum);
    current.connect(convolver).connect(reverbWetGain).connect(reverbSum);
    this.nodes.push(reverbDry, reverbWetGain, convolver, reverbSum);
    current = reverbSum;

    // 4. Mastering & Backing Mixer Output Stage (Highpass, Peaking EQ, Compressor)
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 75;

    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2700;
    presence.Q.value = 0.75;
    presence.gain.value = 2.8;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 10;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.12;

    const out = ctx.createGain();
    out.gain.value = appState.mix?.lead ?? 1.1;

    current.connect(hp).connect(presence).connect(comp).connect(out).connect(this.engine.synthBus);
    this.nodes.push(hp, presence, comp, out);

    this.inputNode = input;
    this.outputNode = out;
    return input;
  }
}

// Global Singletons
export const performanceRack = new PerformanceRack();
export const leadEffectsGraph = new LeadEffectsGraph();
