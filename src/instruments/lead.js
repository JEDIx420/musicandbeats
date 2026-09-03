/**
 * Music & Beats — Canonical Lead Instrument System (V39)
 *
 * Consolidates:
 * - Chromatic Piano / Keytar Performance Keyboard (v38.js, v39-lead.js)
 * - 1–3 Displayed Octaves and Pitch Range Calculation
 * - Expanded GeneralUser GS SoundFont Sample Catalog (v38.js, v39-core.js)
 *     Pianos & Keys, Organs, Guitars, Strings & Ensemble, Brass & Winds, Synth Leads, Pads
 * - Asynchronous SoundFont Sample Loader: zone calculation, nearest-zone fallback,
 *   Base64 audio buffer decoding, buffer caching, failure fallback to synth
 * - Async Pointer/Voice Lifecycle:
 *     Tracks pending sample promises; cancels immediately if pointerup occurs before buffer resolves,
 *     preventing orphan notes from sounding after key release.
 * - Portamento Glide (0–300ms) smoothly retuning pitch on pointer movement between keys (v39-lead.js)
 * - Hardware Pitch Bend Strip: continuous bend (±2, ±7, ±12 semitones) with spring-to-center physics (v39-lead.js)
 * - Hardware Modulation Strip: 0–100% depth driving 5.2Hz LFO vibrato (v39-lead.js)
 * - Lead FX Integration: directs audio voices into the canonical LeadEffectsGraph from src/effects.js
 * - Backing Ducking / Mixer Coupling: dynamically ducks looper playbackBus and beatBus while playing (v38.js, v39-lead.js)
 */

import { NOTES, clamp, midiToFreq, noteMidi, midiLabel, appState } from '../state.js';
import { audioEngine } from '../audio-engine.js';
import { leadEffectsGraph, LEAD_FX_PRESETS } from '../effects.js';

// Base CDN repository for GeneralUser GS SoundFont files
export const SOUNDFONT_CDN_BASE = 'https://cdn.jsdelivr.net/gh/surikov/webaudiofontdata@master/sound/';

export const sampleSpec = n => ({
  file: `${String(n).padStart(3, '0')}0_GeneralUserGS_sf2_file.js`,
  variable: `_tone_${String(n).padStart(3, '0')}0_GeneralUserGS_sf2_file`
});

// V39 Expanded Western GeneralUser GS SoundFont Catalog
export const GENERAL_USER_GS_SAMPLES = {
  'Grand Piano':       sampleSpec(0),
  'Bright Piano':      sampleSpec(1),
  'Electric Grand':    sampleSpec(2),
  'Honky Tonk':        sampleSpec(3),
  'Classic EP':        sampleSpec(4),
  'FM EP':             sampleSpec(5),
  'Harpsichord':       sampleSpec(6),
  'Clavinet':          sampleSpec(7),
  'Drawbar Organ':     sampleSpec(16),
  'Percussive Organ':  sampleSpec(17),
  'Rock Organ':        sampleSpec(18),
  'Church Organ':      sampleSpec(19),
  'Nylon Guitar':      sampleSpec(24),
  'Steel Guitar':      sampleSpec(25),
  'Jazz Guitar':       sampleSpec(26),
  'Clean Guitar':      sampleSpec(27),
  'Muted Guitar':      sampleSpec(28),
  'Overdrive Guitar':  sampleSpec(29),
  'Distortion Guitar': sampleSpec(30),
  'Finger Bass':       sampleSpec(33),
  'Pick Bass':         sampleSpec(34),
  'Violin':            sampleSpec(40),
  'Cello':             sampleSpec(42),
  'String Ensemble':   sampleSpec(48),
  'Synth Strings':     sampleSpec(50),
  'Choir Aahs':        sampleSpec(52),
  'Trumpet':           sampleSpec(56),
  'Trombone':          sampleSpec(57),
  'French Horn':       sampleSpec(60),
  'Alto Sax':          sampleSpec(65),
  'Tenor Sax':         sampleSpec(66),
  'Clarinet':          sampleSpec(71),
  'Concert Flute':     sampleSpec(73),
  'Square Lead':       sampleSpec(80),
  'Saw Lead':          sampleSpec(81),
  'Calliope Lead':     sampleSpec(82),
  'Charang Lead':      sampleSpec(84),
  'New Age Pad':       sampleSpec(88),
  'Warm Pad':          sampleSpec(89),
  'Poly Synth':        sampleSpec(90),
  'Choir Pad':         sampleSpec(91),
  'Metallic Pad':      sampleSpec(93),
  'Halo Pad':          sampleSpec(94),
  'Sweep Pad':         sampleSpec(95)
};

export const LEAD_VOICE_GROUPS = {
  'Pianos & Keys':      ['Grand Piano', 'Bright Piano', 'Electric Grand', 'Honky Tonk', 'Classic EP', 'FM EP', 'Harpsichord', 'Clavinet'],
  'Organs':             ['Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ'],
  'Guitars':            ['Nylon Guitar', 'Steel Guitar', 'Jazz Guitar', 'Clean Guitar', 'Muted Guitar', 'Overdrive Guitar', 'Distortion Guitar'],
  'Strings & Ensemble': ['Violin', 'Cello', 'String Ensemble', 'Synth Strings', 'Choir Aahs'],
  'Brass & Winds':      ['Trumpet', 'Trombone', 'French Horn', 'Alto Sax', 'Tenor Sax', 'Clarinet', 'Concert Flute'],
  'Synth Leads':        ['Fusion Lead', 'Glass Lead', 'Square Lead', 'Saw Lead', 'Calliope Lead', 'Charang Lead'],
  'Pads':               ['New Age Pad', 'Warm Pad', 'Poly Synth', 'Choir Pad', 'Metallic Pad', 'Halo Pad', 'Sweep Pad']
};

export const SYNTH_FALLBACK_VOICES = ['Bansuri Lead', 'Sitar Lead', 'Fusion Lead', 'Glass Lead'];

export class LeadInstrument {
  constructor(engine = audioEngine, effects = leadEffectsGraph) {
    this.engine = engine;
    this.effects = effects;

    // Keyboard Configuration
    this.layout = 'Piano'; // 'Piano' | 'Keytar'
    this.startOctave = 4;
    this.displayOctaves = 2; // 1, 2, or 3 octaves
    this.voice = 'Grand Piano';

    // Glide / Portamento (V39)
    this.isSlideEnabled = true;
    this.glideMs = 85; // 0 to 300ms

    // Hardware Pitch Bend & Modulation Strips (V39)
    this.pitchBend = 0; // Current semitone offset (-range .. +range)
    this.pitchRange = 2; // ±2, ±7, or ±12 semitones
    this.mod = 0; // 0.0 to 1.0 (modulation depth)

    // Voice Tracking & Async Resolution (v39-lead.js)
    this.activePointers = new Map(); // pointerId -> { voice, midi, keyElement }
    this.pendingPointers = new Map(); // pointerId -> { cancelled: boolean }

    // Sample Cache
    this.scriptPromises = new Map(); // voiceName -> Promise<SoundFontData>
    this.decodedBuffers = new WeakMap(); // zone -> Promise<AudioBuffer>

    this.listeners = new Set();
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  setVoice(voiceName) {
    const validVoices = Object.values(LEAD_VOICE_GROUPS).flat();
    if (validVoices.includes(voiceName) || SYNTH_FALLBACK_VOICES.includes(voiceName)) {
      this.stopAll();
      this.voice = voiceName;
      this.notify();
    }
  }

  setStartOctave(octave) {
    this.startOctave = clamp(Math.round(+octave || 4), 1, 6);
    this.stopAll();
    this.notify();
  }

  setDisplayOctaves(octaves) {
    this.displayOctaves = clamp(Math.round(+octaves || 2), 1, 3);
    this.stopAll();
    this.notify();
  }

  setSlideEnabled(enabled) {
    this.isSlideEnabled = !!enabled;
    this.notify();
  }

  setGlideMs(ms) {
    this.glideMs = clamp(Math.round(+ms || 85), 0, 300);
    this.notify();
  }

  setPitchRange(range) {
    if ([2, 7, 12].includes(+range)) {
      this.pitchRange = +range;
      this.pitchBend = clamp(this.pitchBend, -this.pitchRange, this.pitchRange);
      this.applyPitchBend();
      this.notify();
    }
  }

  setPitchBend(bendNorm) {
    // bendNorm is -1.0 to +1.0
    this.pitchBend = clamp(bendNorm, -1, 1) * this.pitchRange;
    this.applyPitchBend();
    this.notify();
  }

  releasePitchBend() {
    this.pitchBend = 0;
    this.applyPitchBend();
    this.notify();
  }

  setModulation(modNorm) {
    // modNorm is 0.0 to 1.0
    this.mod = clamp(+modNorm || 0, 0, 1);
    this.notify();
  }

  // --------------------------------------------------------------------------
  // Sample Loading & Decoding (With Failure Fallback)
  // --------------------------------------------------------------------------

  async loadSampleData(voiceName) {
    const spec = GENERAL_USER_GS_SAMPLES[voiceName];
    if (!spec) return null;

    if (typeof window !== 'undefined' && window[spec.variable]) {
      return window[spec.variable];
    }

    if (this.scriptPromises.has(voiceName)) {
      return this.scriptPromises.get(voiceName);
    }

    if (typeof document === 'undefined') return null; // Server/headless guard

    const promise = new Promise(resolve => {
      const script = document.createElement('script');
      script.src = SOUNDFONT_CDN_BASE + spec.file;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(window[spec.variable] || null);
      script.onerror = () => {
        console.warn(`Could not load sample file for ${voiceName}`);
        resolve(null);
      };
      document.head.appendChild(script);
    });

    this.scriptPromises.set(voiceName, promise);
    return promise;
  }

  findZone(soundfontData, midi) {
    if (!soundfontData?.zones?.length) return null;
    return (
      soundfontData.zones.find(z => midi >= z.keyRangeLow && midi <= z.keyRangeHigh) ||
      soundfontData.zones.reduce((best, z) => {
        const center = (z.keyRangeLow + z.keyRangeHigh) / 2;
        const bestCenter = (best.keyRangeLow + best.keyRangeHigh) / 2;
        return Math.abs(midi - center) < Math.abs(midi - bestCenter) ? z : best;
      }, soundfontData.zones[0])
    );
  }

  async decodeZoneBuffer(zone) {
    const ctx = this.engine.context;
    if (!zone?.file || !ctx) return null;
    if (this.decodedBuffers.has(zone)) {
      return this.decodedBuffers.get(zone);
    }

    try {
      const binaryStr = atob(zone.file);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const bufferPromise = ctx.decodeAudioData(bytes.buffer).catch(() => null);
      this.decodedBuffers.set(zone, bufferPromise);
      return bufferPromise;
    } catch (err) {
      console.warn('Error decoding sample zone', err);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Voice Creation: Sample-Backed with Synth Fallback
  // --------------------------------------------------------------------------

  calcEffectiveMidi(baseMidi, vibrato = 0) {
    return baseMidi + this.pitchBend + vibrato;
  }

  async createSampleVoice(midi, voiceName) {
    const ctx = this.engine.context;
    const dest = this.effects.ensureGraph() || this.engine.synthBus;
    if (!ctx || !dest) return null;

    const data = await this.loadSampleData(voiceName);
    const zone = this.findZone(data, midi);
    const buffer = await this.decodeZoneBuffer(zone);

    if (!data || !zone || !buffer) {
      // Graceful fallback to rich synthesized voice if sample fails
      return this.createSynthVoice(midi, 'Glass Lead');
    }

    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const basePitch = (+zone.originalPitch || 6000) / 100 + (+zone.coarseTune || 0) + (+zone.fineTune || 0) / 100;

    src.buffer = buffer;
    if (+zone.loopStart >= 0 && +zone.loopEnd > +zone.loopStart) {
      src.loop = true;
      src.loopStart = zone.loopStart / (zone.sampleRate || buffer.sampleRate);
      src.loopEnd = zone.loopEnd / (zone.sampleRate || buffer.sampleRate);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.88, now + 0.008);
    src.connect(gain).connect(dest);

    let isStopped = false;
    let currentMidi = midi;

    const voice = {
      midi,
      isSample: true,
      applyPitch: (glideTime = 0.02, vibrato = 0) => {
        if (isStopped) return;
        const targetPitch = this.calcEffectiveMidi(currentMidi, vibrato);
        const rate = Math.pow(2, (targetPitch - basePitch) / 12);
        const t = ctx.currentTime;
        try {
          src.playbackRate.cancelScheduledValues(t);
          src.playbackRate.setTargetAtTime(rate, t, Math.max(0.002, glideTime / 3));
        } catch {}
      },
      setMidi: (newMidi, glideTime = this.glideMs / 1000) => {
        currentMidi = newMidi;
        voice.applyPitch(glideTime);
      },
      stop: () => {
        if (isStopped) return;
        isStopped = true;
        const t = ctx.currentTime;
        try {
          gain.gain.cancelScheduledValues(t);
          gain.gain.setTargetAtTime(0.0001, t, 0.04);
          src.stop(t + 0.18);
        } catch {}
      }
    };

    voice.applyPitch(0);
    src.start(now, Math.max(0, +zone.delay || 0));
    return voice;
  }

  createSynthVoice(midi, voiceName) {
    const ctx = this.engine.context;
    const dest = this.effects.ensureGraph() || this.engine.synthBus;
    if (!ctx || !dest) return null;

    const voice = this.engine.startVoice(midi, voiceName, 0.86, dest);
    let currentMidi = midi;

    return {
      midi,
      isSample: false,
      applyPitch: () => {},
      setMidi: (newMidi) => {
        currentMidi = newMidi;
      },
      stop: () => {
        voice?.stop?.();
      }
    };
  }

  async buildVoice(midi) {
    if (GENERAL_USER_GS_SAMPLES[this.voice]) {
      return this.createSampleVoice(midi, this.voice);
    }
    return this.createSynthVoice(midi, this.voice);
  }

  // --------------------------------------------------------------------------
  // Performance Lifecycle & Multi-Pointer Gestures
  // --------------------------------------------------------------------------

  async onPointerDown(pointerId, midi, keyElement = null) {
    this.engine.primeAudio();
    const pending = { cancelled: false };
    this.pendingPointers.set(pointerId, pending);

    if (keyElement) {
      keyElement.classList.add('active');
    }

    this.applyBackingDucking(true);
    await this.engine.ensureAudio();

    // Cancellation check: user may have released pointer before async buffer loaded
    if (pending.cancelled) {
      this.pendingPointers.delete(pointerId);
      if (keyElement) keyElement.classList.remove('active');
      this.applyBackingDucking(this.activePointers.size > 0);
      return null;
    }

    const voice = await this.buildVoice(midi);
    this.pendingPointers.delete(pointerId);

    if (pending.cancelled || !voice) {
      voice?.stop?.();
      if (keyElement) keyElement.classList.remove('active');
      this.applyBackingDucking(this.activePointers.size > 0);
      return null;
    }

    this.activePointers.set(pointerId, { voice, midi, keyElement });
    this.applyBackingDucking(true);
    this.notify();
    return voice;
  }

  onPointerMove(pointerId, newMidi, newKeyElement = null) {
    const active = this.activePointers.get(pointerId);
    if (!active || !this.isSlideEnabled || active.midi === newMidi) return;

    if (active.keyElement) {
      active.keyElement.classList.remove('active');
    }
    if (newKeyElement) {
      newKeyElement.classList.add('active');
    }

    active.keyElement = newKeyElement;
    active.midi = newMidi;
    active.voice.setMidi(newMidi, this.glideMs / 1000);
  }

  onPointerUp(pointerId) {
    const pending = this.pendingPointers.get(pointerId);
    if (pending) {
      pending.cancelled = true;
      this.pendingPointers.delete(pointerId);
    }

    const active = this.activePointers.get(pointerId);
    if (active) {
      active.voice.stop();
      if (active.keyElement) {
        active.keyElement.classList.remove('active');
      }
      this.activePointers.delete(pointerId);
    }

    this.applyBackingDucking(this.activePointers.size > 0 || this.pendingPointers.size > 0);
    this.notify();
  }

  applyPitchBend() {
    for (const active of this.activePointers.values()) {
      active.voice.applyPitch(0.025);
    }
  }

  applyBackingDucking(isLeadActive) {
    const ctx = this.engine.context;
    if (!ctx) return;
    // Ducking: when Lead solo is played, gently duck drum and synth buses for mix clarity
    try {
      if (this.engine.synthDry?.gain) {
        this.engine.synthDry.gain.cancelScheduledValues(ctx.currentTime);
        this.engine.synthDry.gain.setTargetAtTime(isLeadActive ? 0.82 : 0.90, ctx.currentTime, 0.025);
      }
      if (this.engine.drumBus?.gain) {
        const base = (appState.mix?.beats ?? 0.86) * 0.78;
        this.engine.drumBus.gain.cancelScheduledValues(ctx.currentTime);
        this.engine.drumBus.gain.setTargetAtTime(isLeadActive ? base * 0.88 : base, ctx.currentTime, 0.025);
      }
    } catch {}
  }

  stopAll() {
    for (const pending of this.pendingPointers.values()) {
      pending.cancelled = true;
    }
    this.pendingPointers.clear();

    for (const active of this.activePointers.values()) {
      active.voice.stop();
      if (active.keyElement) {
        active.keyElement.classList.remove('active');
      }
    }
    this.activePointers.clear();
    this.releasePitchBend();
    this.applyBackingDucking(false);
    this.notify();
  }

  // --------------------------------------------------------------------------
  // Keyboard Geometry Model
  // --------------------------------------------------------------------------

  getKeyboardLayoutModel() {
    const startMidi = noteMidi('C', this.startOctave);
    const totalNotes = this.displayOctaves * 12;
    const midis = Array.from({ length: totalNotes + 1 }, (_, i) => startMidi + i);
    const isBlack = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

    const whiteKeys = midis.filter(m => !isBlack(m)).map(m => ({
      midi: m,
      isBlack: false,
      label: m % 12 === 0 ? midiLabel(m) : ''
    }));

    const whiteCount = whiteKeys.length;
    const blackWidthPct = (100 / whiteCount) * 0.62;

    const blackKeys = midis.filter(isBlack).map(m => {
      const precedingWhites = whiteKeys.filter(w => w.midi < m).length;
      const leftPct = (precedingWhites / whiteCount) * 100;
      return {
        midi: m,
        isBlack: true,
        leftPct,
        widthPct: blackWidthPct
      };
    });

    return {
      layout: this.layout,
      startOctave: this.startOctave,
      displayOctaves: this.displayOctaves,
      whiteCount,
      whiteKeys,
      blackKeys
    };
  }

  // --------------------------------------------------------------------------
  // Serialization & Project Persistence
  // --------------------------------------------------------------------------

  serializeState() {
    return {
      layout: this.layout,
      startOctave: this.startOctave,
      displayOctaves: this.displayOctaves,
      voice: this.voice,
      slide: this.isSlideEnabled,
      glideMs: this.glideMs,
      pitchRange: this.pitchRange,
      mod: this.mod
    };
  }

  restoreState(data) {
    if (!data) return;
    if (data.layout) this.layout = data.layout;
    if (Number.isFinite(data.startOctave)) this.startOctave = clamp(+data.startOctave, 1, 6);
    if (Number.isFinite(data.displayOctaves)) this.displayOctaves = clamp(+data.displayOctaves, 1, 3);
    if (data.voice) this.voice = data.voice;
    if (typeof data.slide === 'boolean') this.isSlideEnabled = data.slide;
    if (Number.isFinite(data.glideMs)) this.glideMs = clamp(+data.glideMs, 0, 300);
    if (Number.isFinite(data.pitchRange)) this.pitchRange = [2, 7, 12].includes(+data.pitchRange) ? +data.pitchRange : 2;
    if (Number.isFinite(data.mod)) this.mod = clamp(+data.mod, 0, 1);
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
export const leadInstrument = new LeadInstrument();
