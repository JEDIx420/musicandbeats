/**
 * Music & Beats — Canonical Live Looper & Multi-Track Session Engine (V39)
 *
 * Consolidates:
 * - Mobile-first live backing looper architecture (v34-looper.js)
 * - Exact loop calculations: bars (1, 2, 4, 8), BPM (40–220), 16 steps per bar
 * - Multi-track playback: Beats, Keys, Bass, and Audio recording layers
 * - Web Audio look-ahead clock synchronizer consuming src/scheduler.js
 * - Musical event playback routing into canonical Smart Keys and Bass instruments
 * - Dynamic backing track ducking during live Lead performance (v38.js, v39-lead.js)
 * - Transpose interaction: live event updates when Keys or Bass transpose changes (v39-core.js)
 * - Safe panic and transport reset preventing stuck audio or voice leaks
 */

import { audioEngine } from './audio-engine.js';
import { scheduler } from './scheduler.js';
import { grooveBox } from './groove-box.js';
import { recordingEngine } from './recording.js';
import { smartKeys } from './instruments/smart-keys.js';
import { bassInstrument } from './instruments/bass.js';
import { clamp, appState } from './state.js';

export class LiveLooper {
  constructor(engine = audioEngine, clock = scheduler) {
    this.engine = engine;
    this.scheduler = clock;

    // Session Configuration
    this.bpm = 100;
    this.bars = 4; // 1, 2, 4, or 8 bars
    this.activeLane = 'beats'; // 'beats' | 'keys' | 'bass' | 'lead'

    // Multi-Track Session State
    this.tracks = {
      beats: { muted: false, level: 0.86 },
      keys:  { muted: false, level: 0.80, events: [], sound: 'Harmonium', key: 'C' },
      bass:  { muted: false, level: 0.84, events: [], sound: 'Sub Bass', key: 'C' },
      lead:  { muted: false, level: 1.10 }
    };

    // Transport State
    this.isRunning = false;
    this.absoluteStep = 0;
    this.subscriptionId = 'looper-master-clock';

    // Output Buses
    this.playbackBus = null;
    this.beatBus = null;

    this.listeners = new Set();
  }

  // ==========================================================================
  // 1. SESSION GEOMETRY & MATHEMATICS
  // ==========================================================================

  get totalSteps() {
    return Math.max(16, this.bars * 16);
  }

  get stepSeconds() {
    return (60 / this.bpm) / 4;
  }

  get loopSeconds() {
    return this.totalSteps * this.stepSeconds;
  }

  wrapStep(step) {
    const n = this.totalSteps;
    return ((step % n) + n) % n;
  }

  setBpm(bpm) {
    this.bpm = clamp(+bpm || 100, 40, 220);
    this.scheduler.setBpm(this.bpm);
    this.notify();
  }

  setBars(bars) {
    if ([1, 2, 4, 8].includes(+bars)) {
      this.bars = +bars;
      // Truncate and wrap any events that exceed new loop length
      ['keys', 'bass'].forEach(lane => {
        this.tracks[lane].events = this.tracks[lane].events
          .filter(e => e.step < this.totalSteps)
          .map(e => ({ ...e, step: this.wrapStep(e.step) }));
      });
      this.notify();
    }
  }

  setActiveLane(lane) {
    if (['beats', 'keys', 'bass', 'lead'].includes(lane)) {
      this.activeLane = lane;
      this.notify();
    }
  }

  // ==========================================================================
  // 2. MIXER & TRACK GAIN CONTROLS
  // ==========================================================================

  setTrackMute(lane, muted) {
    if (this.tracks[lane]) {
      this.tracks[lane].muted = !!muted;
      if (lane === 'beats') {
        grooveBox.setMuted(this.tracks.beats.muted);
      }
      this.notify();
    }
  }

  setTrackLevel(lane, level) {
    if (this.tracks[lane]) {
      this.tracks[lane].level = clamp(+level || 0, 0, 1.5);
      this.applyMixerLevels();
      this.notify();
    }
  }

  applyMixerLevels() {
    const ctx = this.engine.context;
    if (!ctx) return;
    const t = ctx.currentTime;

    if (this.playbackBus?.gain) {
      this.playbackBus.gain.setTargetAtTime(this.tracks.keys.level, t, 0.02);
    }
    if (this.beatBus?.gain) {
      this.beatBus.gain.setTargetAtTime(this.tracks.beats.level, t, 0.02);
    }
  }

  // ==========================================================================
  // 3. TRANSPORT CONTROL (Consuming Canonical Scheduler)
  // ==========================================================================

  async startTransport() {
    if (this.isRunning) return;
    await this.engine.ensureAudio();
    const ctx = this.engine.context;
    if (!ctx) return;

    // Build dedicated sub-buses for clean ducking and mixer isolation
    this.playbackBus = ctx.createGain();
    this.playbackBus.gain.value = this.tracks.keys.level;
    this.playbackBus.connect(this.engine.synthBus);

    this.beatBus = ctx.createGain();
    this.beatBus.gain.value = this.tracks.beats.level;
    this.beatBus.connect(this.engine.drumBus);

    this.isRunning = true;
    this.absoluteStep = 0;

    grooveBox.start();

    // Subscribe to canonical look-ahead clock
    this.scheduler.onStep(this.subscriptionId, (stepIndex, stepAudioTime) => {
      this.onSchedulerStep(stepIndex, stepAudioTime);
    });

    this.scheduler.start({ bpm: this.bpm, totalSteps: this.totalSteps });
    this.notify();
  }

  stopTransport() {
    this.isRunning = false;
    this.scheduler.offStep(this.subscriptionId);
    this.scheduler.stop();
    grooveBox.stop();

    if (this.playbackBus) {
      try { this.playbackBus.disconnect(); } catch {}
      this.playbackBus = null;
    }
    if (this.beatBus) {
      try { this.beatBus.disconnect(); } catch {}
      this.beatBus = null;
    }

    this.absoluteStep = 0;
    this.engine.panic();
    this.notify();
  }

  resetTransport() {
    this.stopTransport();
    this.absoluteStep = 0;
    this.notify();
  }

  // ==========================================================================
  // 4. STEP DISPATCH & EVENT PLAYBACK
  // ==========================================================================

  onSchedulerStep(stepIndex, stepAudioTime) {
    if (!this.isRunning) return;
    const currentLoopStep = this.wrapStep(stepIndex);

    // Play recorded Keys & Bass events for this step
    ['keys', 'bass'].forEach(lane => {
      if (this.tracks[lane].muted || recordingEngine.recordingLane === lane) return;
      this.tracks[lane].events.forEach(event => {
        if (this.wrapStep(event.step) === currentLoopStep) {
          this.playEvent(event, lane, stepAudioTime);
        }
      });
    });

    this.absoluteStep++;
  }

  playEvent(event, lane, startAudioTime) {
    const duration = Math.max(this.stepSeconds, (+event.durationSteps || 1) * this.stepSeconds);
    const preset = event.preset || (lane === 'bass' ? this.tracks.bass.sound : this.tracks.keys.sound);

    (event.midis || []).forEach((midi, i) => {
      this.engine.schedulePooledVoice(
        +midi,
        preset,
        Math.max(0.38, 0.78 - i * 0.025),
        startAudioTime,
        duration
      );
    });
  }

  // ==========================================================================
  // 5. EVENT EDITING & TRANSPOSE INTEGRATION (V39)
  // ==========================================================================

  addEvent(lane, event) {
    if (this.tracks[lane] && Array.isArray(this.tracks[lane].events)) {
      this.tracks[lane].events.push({
        ...event,
        step: this.wrapStep(event.step),
        durationSteps: Math.max(1, +event.durationSteps || 1)
      });
      this.notify();
    }
  }

  clearTrackEvents(lane) {
    if (this.tracks[lane]) {
      this.tracks[lane].events = [];
      this.notify();
    }
  }

  transposeTrackEvents(lane, deltaSemitones) {
    if (this.tracks[lane] && deltaSemitones !== 0) {
      this.tracks[lane].events = this.tracks[lane].events.map(event => ({
        ...event,
        midis: (event.midis || []).map(m => clamp(+m + deltaSemitones, 0, 127))
      }));
      this.notify();
    }
  }

  // ==========================================================================
  // 6. SERIALIZATION
  // ==========================================================================

  serializeSession() {
    return {
      bpm: this.bpm,
      bars: this.bars,
      activeLane: this.activeLane,
      beatStyle: grooveBox.style,
      energy: grooveBox.energy,
      beatPattern: JSON.parse(JSON.stringify(grooveBox.pattern)),
      tracks: {
        beats: { muted: this.tracks.beats.muted, level: this.tracks.beats.level },
        keys:  JSON.parse(JSON.stringify(this.tracks.keys)),
        bass:  JSON.parse(JSON.stringify(this.tracks.bass)),
        lead:  { muted: this.tracks.lead.muted, level: this.tracks.lead.level }
      }
    };
  }

  restoreSession(data) {
    if (!data) return;
    if (Number.isFinite(data.bpm)) this.setBpm(data.bpm);
    if (data.bars) this.setBars(data.bars);
    if (data.activeLane) this.setActiveLane(data.activeLane);

    if (data.beatStyle) {
      grooveBox.loadStyle(data.beatStyle, data.energy || 3);
    }
    if (data.beatPattern?.kick) {
      grooveBox.pattern = JSON.parse(JSON.stringify(data.beatPattern));
    }

    if (data.tracks) {
      if (data.tracks.beats) {
        this.tracks.beats.muted = !!data.tracks.beats.muted;
        if (Number.isFinite(data.tracks.beats.level)) this.tracks.beats.level = data.tracks.beats.level;
        grooveBox.setMuted(this.tracks.beats.muted);
      }
      ['keys', 'bass'].forEach(lane => {
        const src = data.tracks[lane];
        if (src) {
          this.tracks[lane].muted = !!src.muted;
          if (Number.isFinite(src.level)) this.tracks[lane].level = src.level;
          if (src.sound) this.tracks[lane].sound = src.sound;
          if (src.key) this.tracks[lane].key = src.key;
          if (Array.isArray(src.events)) {
            this.tracks[lane].events = src.events
              .filter(e => Array.isArray(e.midis) && Number.isFinite(e.step))
              .map(e => ({ ...e, step: this.wrapStep(e.step), durationSteps: Math.max(1, +e.durationSteps || 1) }));
          }
        }
      });
      if (data.tracks.lead) {
        this.tracks.lead.muted = !!data.tracks.lead.muted;
        if (Number.isFinite(data.tracks.lead.level)) this.tracks.lead.level = data.tracks.lead.level;
      }
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
export const liveLooper = new LiveLooper();
