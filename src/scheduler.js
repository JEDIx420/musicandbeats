/**
 * Music & Beats — Canonical Web Audio Look-Ahead Scheduler (V39)
 *
 * Consolidates:
 * - Web Audio look-ahead clock scheduling replacing drift-prone recursive setTimeout
 * - High-speed subdivision conversions (1/4 down to 1/64, triplets)
 * - Look-ahead window (100ms horizon, waking every 25ms)
 * - Drift calculation and compensation against AudioContext.currentTime
 * - Clean event dispatching for UI synchronizers (step highlights, visualizers)
 */

import { audioEngine } from './audio-engine.js';
import { appState, clamp } from './state.js';

export class LookAheadScheduler {
  constructor(engine = audioEngine) {
    this.engine = engine;
    this.intervalId = null;
    this.bpm = 100;
    this.isRunning = false;

    // Timing state
    this.nextStepTime = 0;
    this.currentStep = 0;
    this.totalSteps = 16;
    this.lookaheadMs = 25;       // Cadence at which JS wakes up
    this.scheduleAheadSec = 0.10; // Scheduling horizon ahead of AudioContext.currentTime

    // Registered consumer callbacks: Map<string, Function(stepIndex, stepAudioTime)>
    this.stepCallbacks = new Map();
    // UI dispatch queue: Array<{ step, time }>
    this.uiQueue = [];
    this.uiRaf = null;

    // Diagnostics
    this.metrics = {
      wakeups: 0,
      scheduledSteps: 0,
      maxDriftMs: 0
    };
  }

  // ==========================================================================
  // 1. SUBDIVISION MATHEMATICS
  // ==========================================================================

  /**
   * Calculates the exact duration in seconds of a musical subdivision at a given BPM.
   * Rates supported: '1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32', '1/64'
   */
  static getSubdivisionSeconds(rate = '1/8', bpm = 100) {
    const safeBpm = clamp(+bpm || 100, 40, 220);
    const quarterNoteSec = 60 / safeBpm;

    switch (rate) {
      case '1/4':   return quarterNoteSec;
      case '1/8':   return quarterNoteSec / 2;
      case '1/8T':  return (quarterNoteSec * 2) / 3; // Triplet
      case '1/16':  return quarterNoteSec / 4;
      case '1/16T': return (quarterNoteSec * 4) / 6;
      case '1/32':  return quarterNoteSec / 8;
      case '1/64':  return quarterNoteSec / 16;
      default:      return quarterNoteSec / 2;
    }
  }

  // ==========================================================================
  // 2. SCHEDULER LIFECYCLE
  // ==========================================================================

  start({ bpm = appState.bpm, totalSteps = 16, startDelay = 0.05 } = {}) {
    this.stop();
    this.engine.primeAudio();
    const ctx = this.engine.context;
    if (!ctx) return;

    this.bpm = clamp(+bpm || 100, 40, 220);
    this.totalSteps = Math.max(1, totalSteps);
    this.currentStep = 0;
    this.nextStepTime = ctx.currentTime + startDelay;
    this.isRunning = true;
    appState.transportRunning = true;

    this.intervalId = setInterval(() => this.tick(), this.lookaheadMs);
    this.startUiDispatcher();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    appState.transportRunning = false;
    this.uiQueue = [];
    if (this.uiRaf) {
      cancelAnimationFrame(this.uiRaf);
      this.uiRaf = null;
    }
  }

  reset() {
    this.stop();
    this.currentStep = 0;
    this.nextStepTime = 0;
  }

  setBpm(newBpm) {
    this.bpm = clamp(+newBpm || 100, 40, 220);
    appState.bpm = this.bpm;
  }

  // ==========================================================================
  // 3. STEP SUBSCRIPTION
  // ==========================================================================

  onStep(id, callback) {
    this.stepCallbacks.set(id, callback);
  }

  offStep(id) {
    this.stepCallbacks.delete(id);
  }

  // ==========================================================================
  // 4. TICK & LOOK-AHEAD WINDOW
  // ==========================================================================

  tick() {
    const ctx = this.engine.context;
    if (!ctx || !this.isRunning) return;

    this.metrics.wakeups++;
    const stepDuration = (60 / this.bpm) / 4; // Standard 16th-note step

    // Schedule all steps falling within the look-ahead horizon
    while (this.nextStepTime < ctx.currentTime + this.scheduleAheadSec) {
      const stepIndex = this.currentStep;
      const stepAudioTime = this.nextStepTime;

      // Track clock drift
      const driftMs = Math.max(0, (ctx.currentTime - stepAudioTime) * 1000);
      if (driftMs > this.metrics.maxDriftMs) {
        this.metrics.maxDriftMs = driftMs;
      }

      // Notify registered audio consumers (GrooveBox, ArpEngine, etc.)
      for (const callback of this.stepCallbacks.values()) {
        try {
          callback(stepIndex, stepAudioTime, stepDuration);
        } catch (err) {
          console.error('Error in step callback', err);
        }
      }

      // Queue step for UI animation
      this.uiQueue.push({ step: stepIndex, time: stepAudioTime });

      this.metrics.scheduledSteps++;
      this.nextStepTime += stepDuration;
      this.currentStep = (this.currentStep + 1) % this.totalSteps;
    }
  }

  // ==========================================================================
  // 5. UI SYNCHRONIZATION DISPATCHER
  // ==========================================================================

  startUiDispatcher() {
    const dispatch = () => {
      if (!this.isRunning) return;
      const ctx = this.engine.context;
      if (ctx) {
        const now = ctx.currentTime;
        while (this.uiQueue.length && this.uiQueue[0].time <= now) {
          const item = this.uiQueue.shift();
          window.dispatchEvent(
            new CustomEvent('musicandbeats:step', {
              detail: { step: item.step, time: item.time }
            })
          );
        }
      }
      this.uiRaf = requestAnimationFrame(dispatch);
    };
    this.uiRaf = requestAnimationFrame(dispatch);
  }
}

// Global Singleton Instance
export const scheduler = new LookAheadScheduler();
