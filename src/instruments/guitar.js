/**
 * Music & Beats — Canonical Guitar System (V39)
 *
 * Consolidates:
 * - Real audio-interface / microphone hardware input stream handling (v6.js, v10.js)
 * - Input meter data extraction (RMS, dBV, peak clipping detection) (v6.js)
 * - 6 Virtual Amp Patches: Clean Glass, Warm Combo, Edge Crunch, Arena Lead, Ambient Swell, Worship Shimmer
 * - Hardware Rig Controls: input trim, lowpass tone shaping, master output gain, live monitoring
 * - Pedalboard DSP Chain:
 *     Input -> Analyser -> Highpass (68Hz) -> Drive (WaveShaper) -> Tone Filter -> Compressor ->
 *     Dry/Chorus/Delay/Convolution Reverb Buses -> Monitor Bus -> Master Output
 * - Clean device enumeration, switching, and MediaStream lifecycle cleanup
 */

import { clamp } from '../state.js';
import { audioEngine } from '../audio-engine.js';
import { createImpulseBuffer } from '../effects.js';

export const GUITAR_AMP_PATCHES = {
  'Clean Glass': {
    trim: 0.92, tone: 9000, output: 0.88,
    drive:  { on: false, amount: 0.08 },
    chorus: { on: true,  amount: 0.13 },
    delay:  { on: false, amount: 0.10 },
    reverb: { on: true,  amount: 0.16 }
  },
  'Warm Combo': {
    trim: 0.96, tone: 5600, output: 0.90,
    drive:  { on: true,  amount: 0.12 },
    chorus: { on: false, amount: 0.08 },
    delay:  { on: false, amount: 0.08 },
    reverb: { on: true,  amount: 0.12 }
  },
  'Edge Crunch': {
    trim: 0.92, tone: 6100, output: 0.82,
    drive:  { on: true,  amount: 0.38 },
    chorus: { on: false, amount: 0.06 },
    delay:  { on: false, amount: 0.08 },
    reverb: { on: true,  amount: 0.08 }
  },
  'Arena Lead': {
    trim: 0.88, tone: 6800, output: 0.76,
    drive:  { on: true,  amount: 0.64 },
    chorus: { on: false, amount: 0.08 },
    delay:  { on: true,  amount: 0.25 },
    reverb: { on: true,  amount: 0.18 }
  },
  'Ambient Swell': {
    trim: 0.98, tone: 7200, output: 0.86,
    drive:  { on: false, amount: 0.05 },
    chorus: { on: true,  amount: 0.28 },
    delay:  { on: true,  amount: 0.39 },
    reverb: { on: true,  amount: 0.48 }
  },
  'Worship Shimmer': {
    trim: 0.95, tone: 8400, output: 0.84,
    drive:  { on: false, amount: 0.05 },
    chorus: { on: true,  amount: 0.22 },
    delay:  { on: true,  amount: 0.31 },
    reverb: { on: true,  amount: 0.55 }
  }
};

/**
 * Dedicated guitar distortion transfer curve (from v6.js).
 */
export function createGuitarDriveCurve(amount = 0) {
  const n = 1024;
  const c = new Float32Array(n);
  const k = Math.max(0, amount) * 420;

  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = amount < 0.01 ? x : ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x));
  }
  return c;
}

export class GuitarRig {
  constructor(engine = audioEngine) {
    this.engine = engine;

    // Rig State
    this.patch = 'Clean Glass';
    this.deviceId = '';
    this.connected = false;
    this.monitor = false;
    this.trim = 0.92;
    this.tone = 9000;
    this.output = 0.88;

    this.pedals = {
      drive:  { on: false, amount: 0.08 },
      chorus: { on: true,  amount: 0.13 },
      delay:  { on: false, amount: 0.10 },
      reverb: { on: true,  amount: 0.16 }
    };

    // Hardware & AudioNodes
    this.mediaStream = null;
    this.mediaSource = null;
    this.nodes = null;
    this.meterRaf = null;

    // Metering
    this.meterData = {
      rms: 0,
      dbv: -60,
      peak: 0,
      clipping: false,
      signalDetected: false
    };

    this.listeners = new Set();
  }

  // --------------------------------------------------------------------------
  // Audio Graph Construction
  // --------------------------------------------------------------------------

  ensureGraph() {
    this.engine.buildAudio();
    const ctx = this.engine.context;
    if (!ctx) return null;
    if (this.nodes) return this.nodes;

    const n = {};
    n.input = ctx.createGain();

    // Signal Analyser for metering
    n.analyser = ctx.createAnalyser();
    n.analyser.fftSize = 512;

    // DC block / Sub-rumble highpass
    n.hp = ctx.createBiquadFilter();
    n.hp.type = 'highpass';
    n.hp.frequency.value = 68;

    // Amp Drive (WaveShaper)
    n.drive = ctx.createWaveShaper();
    n.drive.oversample = '4x';

    // Tone Cutoff
    n.tone = ctx.createBiquadFilter();
    n.tone.type = 'lowpass';

    // Rig Dynamics Compressor
    n.comp = ctx.createDynamicsCompressor();
    n.comp.threshold.value = -18;
    n.comp.ratio.value = 3;
    n.comp.attack.value = 0.006;
    n.comp.release.value = 0.12;

    // Dry / Wet Pedal Buses
    n.dry = ctx.createGain();

    // Chorus
    n.chorusDelay = ctx.createDelay(0.06);
    n.chorusWet = ctx.createGain();
    n.chorusLfo = ctx.createOscillator();
    n.chorusDepth = ctx.createGain();
    n.chorusLfo.frequency.value = 0.7;
    n.chorusDepth.gain.value = 0.0045;
    n.chorusLfo.connect(n.chorusDepth).connect(n.chorusDelay.delayTime);
    n.chorusLfo.start();

    // Delay
    n.delay = ctx.createDelay(1.2);
    n.feedback = ctx.createGain();
    n.delayWet = ctx.createGain();

    // Convolution Reverb (Impulse)
    n.reverb = ctx.createConvolver();
    n.reverb.buffer = createImpulseBuffer(ctx, 1.5, 2.7);
    n.reverbWet = ctx.createGain();

    // Master Bus & Monitor Output
    n.bus = ctx.createGain();
    n.monitor = ctx.createGain();

    // Wire DSP Chain
    n.input.connect(n.analyser).connect(n.hp).connect(n.drive).connect(n.tone).connect(n.comp);

    n.comp.connect(n.dry).connect(n.bus);
    n.comp.connect(n.chorusDelay).connect(n.chorusWet).connect(n.bus);
    n.comp.connect(n.delay);
    n.delay.connect(n.delayWet).connect(n.bus);
    n.delay.connect(n.feedback).connect(n.delay);
    n.comp.connect(n.reverb).connect(n.reverbWet).connect(n.bus);

    // Monitoring feeds master output
    n.bus.connect(n.monitor).connect(this.engine.master);

    this.nodes = n;
    this.applyState();
    return n;
  }

  applyState() {
    const ctx = this.engine.context;
    if (!ctx || !this.nodes) return;

    const n = this.nodes;
    const t = ctx.currentTime;

    n.input.gain.setTargetAtTime(this.trim, t, 0.02);
    n.tone.frequency.setTargetAtTime(this.tone, t, 0.02);
    n.bus.gain.setTargetAtTime(this.output, t, 0.02);

    n.drive.curve = createGuitarDriveCurve(this.pedals.drive.on ? this.pedals.drive.amount : 0);
    n.chorusWet.gain.setTargetAtTime(this.pedals.chorus.on ? this.pedals.chorus.amount * 0.7 : 0, t, 0.02);
    n.chorusDepth.gain.setTargetAtTime(0.001 + this.pedals.chorus.amount * 0.012, t, 0.02);

    n.delay.delayTime.setTargetAtTime(0.18 + this.pedals.delay.amount * 0.48, t, 0.02);
    n.feedback.gain.setTargetAtTime(
      this.pedals.delay.on ? Math.min(0.62, 0.12 + this.pedals.delay.amount * 0.55) : 0,
      t,
      0.02
    );
    n.delayWet.gain.setTargetAtTime(this.pedals.delay.on ? this.pedals.delay.amount * 0.62 : 0, t, 0.02);

    n.reverbWet.gain.setTargetAtTime(this.pedals.reverb.on ? this.pedals.reverb.amount * 0.82 : 0, t, 0.02);
    n.monitor.gain.setTargetAtTime(this.monitor ? 0.9 : 0, t, 0.02);
  }

  // --------------------------------------------------------------------------
  // Hardware Connection & Life Cycle
  // --------------------------------------------------------------------------

  async connectInput(deviceId = '') {
    await this.engine.ensureAudio();
    this.ensureGraph();

    try {
      this.disconnectInput();

      const audioConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      };
      if (deviceId) {
        audioConstraints.deviceId = { exact: deviceId };
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia not available in this browser');
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      this.mediaSource = this.engine.context.createMediaStreamSource(this.mediaStream);
      this.mediaSource.connect(this.nodes.input);

      this.connected = true;
      this.deviceId = this.mediaStream.getAudioTracks()[0]?.getSettings()?.deviceId || deviceId || '';

      this.startMeter();
      this.notify();
      return true;
    } catch (err) {
      console.warn('Guitar hardware input failed to connect', err);
      this.connected = false;
      this.notify();
      return false;
    }
  }

  disconnectInput() {
    if (this.mediaSource) {
      try { this.mediaSource.disconnect(); } catch {}
      this.mediaSource = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.stopMeter();
    this.connected = false;
    this.notify();
  }

  startMeter() {
    this.stopMeter();
    if (!this.nodes?.analyser) return;

    const data = new Uint8Array(this.nodes.analyser.fftSize);
    const tick = () => {
      if (!this.connected || !this.nodes) return;
      this.nodes.analyser.getByteTimeDomainData(data);

      let sum = 0;
      let peak = 0;
      for (const v of data) {
        const x = (v - 128) / 128;
        sum += x * x;
        peak = Math.max(peak, Math.abs(x));
      }

      const rms = Math.sqrt(sum / data.length);
      const dbv = rms > 0 ? 20 * Math.log10(rms) : -60;

      this.meterData = {
        rms,
        dbv: Math.round(dbv),
        peak,
        clipping: peak > 0.94,
        signalDetected: rms > 0.012
      };

      this.meterRaf = requestAnimationFrame(tick);
    };
    this.meterRaf = requestAnimationFrame(tick);
  }

  stopMeter() {
    if (this.meterRaf) {
      cancelAnimationFrame(this.meterRaf);
      this.meterRaf = null;
    }
    this.meterData = { rms: 0, dbv: -60, peak: 0, clipping: false, signalDetected: false };
  }

  // --------------------------------------------------------------------------
  // Controls & Preset Configuration
  // --------------------------------------------------------------------------

  loadPatch(patchName) {
    const p = GUITAR_AMP_PATCHES[patchName];
    if (!p) return;

    this.patch = patchName;
    this.trim = p.trim;
    this.tone = p.tone;
    this.output = p.output;
    this.pedals = JSON.parse(JSON.stringify({
      drive: p.drive,
      chorus: p.chorus,
      delay: p.delay,
      reverb: p.reverb
    }));

    this.applyState();
    this.notify();
  }

  setTrim(val) {
    this.trim = clamp(+val || 0.92, 0, 1.5);
    this.applyState();
  }

  setTone(val) {
    this.tone = clamp(+val || 9000, 500, 16000);
    this.applyState();
  }

  setOutput(val) {
    this.output = clamp(+val || 0.88, 0, 1.5);
    this.applyState();
  }

  setMonitoring(enabled) {
    this.monitor = !!enabled;
    this.applyState();
    this.notify();
  }

  togglePedal(pedalName) {
    if (this.pedals[pedalName]) {
      this.pedals[pedalName].on = !this.pedals[pedalName].on;
      this.applyState();
      this.notify();
    }
  }

  setPedalAmount(pedalName, amount) {
    if (this.pedals[pedalName]) {
      this.pedals[pedalName].amount = clamp(+amount || 0, 0, 1);
      this.applyState();
      this.notify();
    }
  }

  // --------------------------------------------------------------------------
  // Serialization & Teardown
  // --------------------------------------------------------------------------

  serializeState() {
    return {
      patch: this.patch,
      trim: this.trim,
      tone: this.tone,
      output: this.output,
      monitor: this.monitor,
      pedals: JSON.parse(JSON.stringify(this.pedals))
    };
  }

  restoreState(data) {
    if (!data) return;
    if (data.patch && GUITAR_AMP_PATCHES[data.patch]) this.patch = data.patch;
    if (Number.isFinite(data.trim)) this.trim = data.trim;
    if (Number.isFinite(data.tone)) this.tone = data.tone;
    if (Number.isFinite(data.output)) this.output = data.output;
    if (typeof data.monitor === 'boolean') this.monitor = data.monitor;
    if (data.pedals) this.pedals = JSON.parse(JSON.stringify(data.pedals));
    this.applyState();
    this.notify();
  }

  dispose() {
    this.disconnectInput();
    if (this.nodes) {
      try { this.nodes.chorusLfo?.stop(); } catch {}
      try { this.nodes.input?.disconnect(); } catch {}
      try { this.nodes.bus?.disconnect(); } catch {}
      try { this.nodes.monitor?.disconnect(); } catch {}
      this.nodes = null;
    }
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
export const guitarRig = new GuitarRig();
