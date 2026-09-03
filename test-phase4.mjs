/**
 * Music & Beats — Non-invasive Phase 4 Verification Suite
 * Tests mathematical purity, defaults, subdivision timings, and effect curve caching.
 */

import { NOTES, FLAT_MAP, SOUND_PRESETS, BEAT_PRESETS, clamp, midiToFreq, noteMidi, midiLabel, barSeconds } from './src/state.js';
import { LookAheadScheduler } from './src/scheduler.js';
import { createDriveCurve, createLeadDriveCurve, PERFORMANCE_BOARDS, LEAD_FX_PRESETS } from './src/effects.js';
import { AudioEngine } from './src/audio-engine.js';

let errors = 0;
function assert(condition, msg) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    errors++;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('--- 1. Testing Musical Calculations ---');
assert(NOTES.length === 12, '12 chromatic notes present');
assert(midiToFreq(69) === 440, 'A4 (MIDI 69) is 440Hz');
assert(Math.round(midiToFreq(60) * 100) / 100 === 261.63, 'C4 (MIDI 60) is ~261.63Hz');
assert(noteMidi('C', 4) === 60, 'noteMidi("C", 4) is 60');
assert(noteMidi('A', 4) === 69, 'noteMidi("A", 4) is 69');
assert(midiLabel(60) === 'C4', 'MIDI 60 label is C4');
assert(midiLabel(61) === 'C♯4', 'MIDI 61 label is C♯4');
assert(barSeconds(4, 120) === 8.0, '4 bars at 120 BPM is exactly 8.0s');
assert(clamp(150, 40, 120) === 120, 'clamp(150, 40, 120) upper bound is 120');
assert(clamp(20, 40, 120) === 40, 'clamp(20, 40, 120) lower bound is 40');

console.log('\n--- 2. Testing Sound Presets Integrity ---');
assert(SOUND_PRESETS['Studio Grand']?.oscs?.length === 3, 'Studio Grand has 3 oscillators');
assert(SOUND_PRESETS['Reese Bass']?.v17?.category === 'EDM Bass', 'Reese Bass exists with V17 category');
assert(SOUND_PRESETS['Harmonium']?.oscs?.length === 4, 'Harmonium Indian synth exists');
assert(SOUND_PRESETS['Bansuri Lead']?.filter === 7600, 'Bansuri Lead exists');

console.log('\n--- 3. Testing Scheduler Subdivisions ---');
// At 120 BPM:
// 1 beat (quarter note) = 0.5s
// 1/4 = 0.5s
// 1/8 = 0.25s
// 1/16 = 0.125s
// 1/32 = 0.0625s
// 1/64 = 0.03125s
assert(LookAheadScheduler.getSubdivisionSeconds('1/4', 120) === 0.5, '1/4 at 120 BPM is 0.5s');
assert(LookAheadScheduler.getSubdivisionSeconds('1/8', 120) === 0.25, '1/8 at 120 BPM is 0.25s');
assert(LookAheadScheduler.getSubdivisionSeconds('1/16', 120) === 0.125, '1/16 at 120 BPM is 0.125s');
assert(LookAheadScheduler.getSubdivisionSeconds('1/32', 120) === 0.0625, '1/32 at 120 BPM is 0.0625s');
assert(LookAheadScheduler.getSubdivisionSeconds('1/64', 120) === 0.03125, '1/64 at 120 BPM is 0.03125s');
assert(Math.abs(LookAheadScheduler.getSubdivisionSeconds('1/8T', 120) - (1/3)) < 1e-6, '1/8T triplet at 120 BPM is 0.333s');

console.log('\n--- 4. Testing Effects Mathematics & Curves ---');
const curve1 = createDriveCurve(0.5);
const curve2 = createDriveCurve(0.5);
assert(curve1 === curve2, 'createDriveCurve caches identical curve references');
assert(curve1.length === 1024, 'Performance rack drive curve length is 1024');
const leadCurve = createLeadDriveCurve(4);
assert(leadCurve.length === 2048, 'Lead drive curve length is 2048');
assert(Object.keys(PERFORMANCE_BOARDS).length === 7, '7 Performance Rack boards present');
assert(Object.keys(LEAD_FX_PRESETS).length === 20, '20 V38/V39 Lead FX presets present');

console.log('\n--- 5. Testing AudioEngine State & Panic ---');
const engine = new AudioEngine();
assert(engine.poolSize === 40, 'Default voice pool size is 40');
assert(typeof engine.panic === 'function', 'panic() method exposed');
assert(typeof engine.startVoice === 'function', 'startVoice() method exposed');
assert(typeof engine.schedulePooledVoice === 'function', 'schedulePooledVoice() method exposed');

console.log(`\nTests completed with ${errors} errors.`);
process.exit(errors === 0 ? 0 : 1);
