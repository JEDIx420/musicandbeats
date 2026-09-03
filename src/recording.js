/**
 * Music & Beats — Canonical Recording Engine & Worklet Bridge (V39)
 *
 * Consolidates:
 * - Direct coordination with the low-level recorder-worklet.js AudioWorklet
 * - Exact sample and frame counting (replaces drift-prone JavaScript chunk timers)
 * - Record arming, count-in tracking, and phase-aligned loop boundaries (v34-looper.js)
 * - Capture grace window logic ensuring notes held right up to the bar line resolve cleanly
 * - Separation of raw recorded audio buffers from musical event metadata
 * - Multi-layer audio capture and event recording state management
 */

import { audioEngine } from './audio-engine.js';
import { clamp } from './state.js';

export class RecordingEngine {
  constructor(engine = audioEngine) {
    this.engine = engine;

    // Worklet Node & Communication
    this.workletNode = null;
    this.isWorkletReady = false;

    // Recording State
    this.state = 'idle'; // 'idle' | 'armed' | 'countIn' | 'recording'
    this.recordingLane = null; // 'keys' | 'bass' | 'audio'
    this.startFrame = 0;
    this.totalFrames = 0;
    this.channels = 2;

    // Musical Event Capture State
    this.capturedEvents = [];
    this.activeLiveHolds = new Map(); // pointerId/note -> { startTime, startStep, midis, preset }

    // Phase & Boundary Metadata
    this.countInSteps = 0;
    this.recordStartStep = 0;
    this.recordStartTime = 0;
    this.captureGrace = null;

    this.onBufferComplete = null;
    this.listeners = new Set();
  }

  // ==========================================================================
  // 1. AUDIOWORKLET INITIALIZATION & LIFECYCLE
  // ==========================================================================

  async initializeWorklet() {
    if (this.isWorkletReady && this.workletNode) return this.workletNode;
    await this.engine.ensureAudio();
    const ctx = this.engine.context;
    if (!ctx || !ctx.audioWorklet) {
      console.warn('AudioWorklet not supported in this environment');
      return null;
    }

    try {
      await ctx.audioWorklet.addModule('recorder-worklet.js');
      this.workletNode = new AudioWorkletNode(ctx, 'loop-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });

      this.workletNode.port.onmessage = (event) => {
        const data = event.data || {};
        if (data.type === 'complete') {
          this.onCaptureComplete(data);
        }
      };

      // Connect worklet node in parallel with input
      if (this.engine.inputGain) {
        this.engine.inputGain.connect(this.workletNode);
      }

      this.isWorkletReady = true;
      return this.workletNode;
    } catch (err) {
      console.warn('Failed to initialize LoopCaptureProcessor worklet', err);
      return null;
    }
  }

  // ==========================================================================
  // 2. WORKLET ARMING & SAMPLE-EXACT BOUNDARIES
  // ==========================================================================

  /**
   * Arms the audio worklet to capture exactly `frames` samples starting at `startFrame`.
   */
  armAudioCapture({ startFrame = 0, frames = 0, channels = 2 } = {}) {
    if (!this.workletNode) return;
    this.startFrame = Math.max(0, Math.round(startFrame));
    this.totalFrames = Math.max(1, Math.round(frames));
    this.channels = clamp(Math.round(channels), 1, 2);

    this.workletNode.port.postMessage({
      type: 'arm',
      startFrame: this.startFrame,
      frames: this.totalFrames,
      channels: this.channels
    });
  }

  cancelAudioCapture() {
    if (!this.workletNode) return;
    this.workletNode.port.postMessage({ type: 'cancel' });
    this.state = 'idle';
    this.recordingLane = null;
    this.notify();
  }

  onCaptureComplete(data) {
    const { channels, frames } = data;
    const ctx = this.engine.context;
    if (!ctx || !channels) return;

    // Convert raw transfer ArrayBuffers back to Float32AudioBuffer
    const audioBuffer = ctx.createBuffer(channels.length, frames, ctx.sampleRate);
    for (let c = 0; c < channels.length; c++) {
      audioBuffer.copyToChannel(new Float32Array(channels[c]), c);
    }

    this.state = 'idle';
    this.recordingLane = null;

    if (typeof this.onBufferComplete === 'function') {
      this.onBufferComplete(audioBuffer);
    }
    this.notify();
  }

  // ==========================================================================
  // 3. MUSICAL EVENT RECORDING (Keys & Bass Lanes)
  // ==========================================================================

  armLane(lane, { countIn = true } = {}) {
    this.recordingLane = lane;
    this.state = countIn ? 'countIn' : 'armed';
    this.capturedEvents = [];
    this.activeLiveHolds.clear();
    this.notify();
  }

  startRecording(absStep, startTime, totalSteps) {
    this.state = 'recording';
    this.recordStartStep = absStep % totalSteps;
    this.recordStartTime = startTime;
    this.capturedEvents = [];
    this.notify();
  }

  /**
   * Records the start of a musical note/chord.
   */
  recordNoteStart(id, { midis = [], preset = 'Studio Grand', currentStep = 0, currentTime = 0 }) {
    if (this.state !== 'recording' || !this.recordingLane) return;
    this.activeLiveHolds.set(id, {
      startTime: currentTime,
      startStep: currentStep,
      midis: [...midis],
      preset
    });
  }

  /**
   * Records the release of a musical note/chord and generates a quantizable event.
   */
  recordNoteRelease(id, { currentStep = 0, currentTime = 0, stepSeconds = 0.125 }) {
    const hold = this.activeLiveHolds.get(id);
    if (!hold) return;

    const durationSeconds = Math.max(0.02, currentTime - hold.startTime);
    const durationSteps = Math.max(1, Math.round(durationSeconds / (stepSeconds || 0.125)));

    const event = {
      step: hold.startStep,
      durationSteps,
      midis: hold.midis,
      preset: hold.preset
    };

    this.capturedEvents.push(event);
    this.activeLiveHolds.delete(id);
    this.notify();
    return event;
  }

  /**
   * Finishes recording, applying capture grace to clamp notes held past the end loop boundary.
   */
  finishRecording({ boundaryTime = 0, stepSeconds = 0.125, wrapTotalSteps = 16 } = {}) {
    // Flush any live holds still being pressed at loop end
    for (const [id, hold] of this.activeLiveHolds.entries()) {
      const durationSeconds = Math.max(0.02, (boundaryTime || hold.startTime) - hold.startTime);
      const durationSteps = Math.max(1, Math.round(durationSeconds / (stepSeconds || 0.125)));
      this.capturedEvents.push({
        step: hold.startStep % wrapTotalSteps,
        durationSteps,
        midis: hold.midis,
        preset: hold.preset
      });
      this.activeLiveHolds.delete(id);
    }

    const recordedLane = this.recordingLane;
    const finalEvents = [...this.capturedEvents];

    this.state = 'idle';
    this.recordingLane = null;
    this.notify();

    return {
      lane: recordedLane,
      events: finalEvents
    };
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
export const recordingEngine = new RecordingEngine();
