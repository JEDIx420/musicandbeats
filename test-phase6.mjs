/**
 * Music & Beats — Non-invasive Phase 6 Verification Suite
 * Tests ARP engine, Groove Box, Recording Engine, Live Looper, and Project persistence.
 */

import { ArpEngine, ARP_PATTERNS, ARP_RATES } from './src/arp-engine.js';
import { GrooveBox, GROOVE_STYLES } from './src/groove-box.js';
import { RecordingEngine } from './src/recording.js';
import { LiveLooper } from './src/looper.js';
import { ProjectManager } from './src/projects.js';
import { smartKeys } from './src/instruments/smart-keys.js';
import { bassInstrument } from './src/instruments/bass.js';

let errors = 0;
function assert(condition, msg) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    errors++;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('--- 1. Testing ArpEngine Logic & Rates ---');
const arp = new ArpEngine();
assert(ARP_PATTERNS.length === 5, '5 ARP patterns supported');
assert(ARP_RATES.includes('1/64'), '1/64 subdivision supported');
assert(ARP_RATES.includes('1/8T'), 'Triplet rates supported');

// Test note expansion across octaves and pattern sorting
arp.setPattern('up');
arp.setOctaves(2);
arp.setNotes([60, 64, 67]); // C4, E4, G4
assert(arp.expandedNotes.length === 6, '3 notes expanded over 2 octaves equals 6 notes');
assert(arp.expandedNotes[0] === 60 && arp.expandedNotes[5] === 79, 'Up pattern starts at 60 and ends at 79 (G5)');

arp.setPattern('down');
assert(arp.expandedNotes[0] === 79 && arp.expandedNotes[5] === 60, 'Down pattern reverses sequence');

arp.setPattern('upDown');
// base: 60, 64, 67, 72, 76, 79 -> interior slice reversed: 76, 72, 67, 64
assert(arp.expandedNotes.length === 10, 'upDown pattern creates ping-pong sequence of length 10');

// Smart Keys Target & Transpose
smartKeys.setKey('C');
smartKeys.setOctave(3);
smartKeys.setTranspose(2); // D root (Midi 50)
arp.setTarget('keys');
assert(arp.activeMidis[0] === 50, 'ARP reflects Smart Keys +2 st transpose (C root becomes D = 50)');


console.log('\n--- 2. Testing GrooveBox & Patterns ---');
const gb = new GrooveBox();
assert(GROOVE_STYLES.length === 10, '10 Groove styles present including Keherwa & Dadra');

gb.loadStyle('House', 3);
assert(gb.pattern.kick[0] && gb.pattern.kick[4] && gb.pattern.kick[8] && gb.pattern.kick[12], 'House 4-on-the-floor kicks present');
assert(gb.pattern.hat[2] && gb.pattern.hat[6] && gb.pattern.hat[10] && gb.pattern.hat[14], 'House offbeat hats present');

gb.toggleStep('snare', 4);
assert(gb.pattern.snare[4] === false, 'toggleStep toggles snare step off');
gb.toggleStep('snare', 4);
assert(gb.pattern.snare[4] === true, 'toggleStep toggles snare step on');


console.log('\n--- 3. Testing Recording Engine Logic ---');
const rec = new RecordingEngine();
rec.armLane('keys', { countIn: false });
assert(rec.state === 'armed', 'Recording state is armed');

rec.startRecording(0, 10.0, 16);
assert(rec.state === 'recording', 'Recording state is recording');

// Record a simulated chord hit
rec.recordNoteStart('p1', { midis: [60, 64, 67], preset: 'Studio Grand', currentStep: 0, currentTime: 10.0 });
const recordedEvent = rec.recordNoteRelease('p1', { currentStep: 2, currentTime: 10.25, stepSeconds: 0.125 });

assert(recordedEvent.step === 0, 'Event recorded with start step 0');
assert(recordedEvent.durationSteps === 2, '0.25s duration at 0.125s/step is 2 steps');
assert(recordedEvent.midis.join(',') === '60,64,67', 'Recorded midis preserved');

const finished = rec.finishRecording({ boundaryTime: 12.0, stepSeconds: 0.125, wrapTotalSteps: 16 });
assert(finished.lane === 'keys', 'Finished recording returned keys lane');
assert(finished.events.length === 1, '1 event recorded and finalized');


console.log('\n--- 4. Testing Live Looper Session & Event Math ---');
const looper = new LiveLooper();
looper.setBpm(120);
looper.setBars(4);
assert(looper.totalSteps === 64, '4 bars equals 64 steps');
assert(looper.stepSeconds === 0.125, '120 BPM step time is 0.125s');
assert(looper.loopSeconds === 8.0, '64 steps at 0.125s is exactly 8.0s loop');

looper.addEvent('keys', { step: 65, durationSteps: 2, midis: [60, 64, 67] });
assert(looper.tracks.keys.events[0].step === 1, 'Step 65 wrapped to step 1 in 64-step loop');

looper.transposeTrackEvents('keys', 3);
assert(looper.tracks.keys.events[0].midis[0] === 63, 'Transposing keys events +3 st updates 60 to 63');

looper.setTrackMute('beats', true);
assert(looper.tracks.beats.muted === true, 'Beats track muted');


console.log('\n--- 5. Testing Project Persistence & Schema Adapters ---');
const pm = new ProjectManager();

// Fixture 1: Legacy V35 snapshot
const legacyV35Fixture = {
  version: 'v36',
  name: 'Legacy Soul Jam',
  looper: {
    bpm: 96,
    bars: 2,
    beatStyle: 'Funk',
    energy: 4,
    keys: { sound: 'Neo Soul EP', key: 'F', events: [{ step: 0, durationSteps: 4, midis: [53, 57, 60] }] },
    bass: { sound: 'Acid Bass', key: 'F', events: [{ step: 0, durationSteps: 2, midis: [29] }] }
  },
  extras: { metronome: true }
};

const normalizedV35 = pm.normalizeProject(legacyV35Fixture);
assert(normalizedV35.session.bpm === 96, 'Normalized V35 project BPM is 96');
assert(normalizedV35.session.bars === 2, 'Normalized V35 project bars is 2');
assert(normalizedV35.session.tracks.keys.sound === 'Neo Soul EP', 'Normalized V35 keys sound is Neo Soul EP');
assert(normalizedV35.groove.style === 'Funk', 'Normalized V35 groove style is Funk');
assert(normalizedV35.smartKeys.transpose === 0, 'Missing V39 transpose safely defaulted to 0');

// Fixture 2: V39 snapshot with custom chords, Keys transpose, and Lead glide
const v39Fixture = {
  id: 'v39-test-proj',
  name: 'Modern Neo Track',
  v39: {
    transpose: { keys: 3, bass: -2 },
    chords: [
      { root: 'D', type: 'Custom', custom: '0,4,7,10,14' },
      { root: 'G', type: '7', custom: '' },
      { root: 'C', type: 'maj9', custom: '' },
      { root: 'A', type: 'Minor', custom: '' },
      { root: 'F', type: 'Major', custom: '' },
      { root: 'E', type: 'm7', custom: '' },
      { root: 'B', type: 'Diminished', custom: '' }
    ],
    chordsCustomized: true,
    slide: true,
    glideMs: 140,
    pitchRange: 7,
    mod: 0.65
  }
};

const normalizedV39 = pm.normalizeProject(v39Fixture);
assert(normalizedV39.smartKeys.transpose === 3, 'V39 Keys transpose 3 survived');
assert(normalizedV39.bass.transpose === -2, 'V39 Bass transpose -2 survived');
assert(normalizedV39.smartKeys.chords[0].custom === '0,4,7,10,14', 'V39 custom chord definition survived');
assert(normalizedV39.lead.glideMs === 140, 'V39 Lead glide 140ms survived');
assert(normalizedV39.lead.pitchRange === 7, 'V39 Lead pitch range 7 survived');
assert(normalizedV39.lead.mod === 0.65, 'V39 Lead modulation 0.65 survived');

console.log(`\nPhase 6 test suite finished with ${errors} errors.`);
process.exit(errors === 0 ? 0 : 1);
