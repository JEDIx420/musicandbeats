/**
 * Music & Beats — Non-invasive Phase 5 Verification Suite
 * Tests canonical instrument logic across Smart Keys, Bass, Guitar, and Lead.
 */

import { SmartKeys, SMART_CHORD_TYPES, getDiatonicChords, parseCustomIntervals, resolveChordIntervals, applyVoicing } from './src/instruments/smart-keys.js';
import { BassInstrument, BASS_PRESETS } from './src/instruments/bass.js';
import { GuitarRig, GUITAR_AMP_PATCHES, createGuitarDriveCurve } from './src/instruments/guitar.js';
import { LeadInstrument, GENERAL_USER_GS_SAMPLES, LEAD_VOICE_GROUPS, SYNTH_FALLBACK_VOICES } from './src/instruments/lead.js';

let errors = 0;
function assert(condition, msg) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    errors++;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('--- 1. Testing Smart Keys Musical Model ---');
const sk = new SmartKeys();

// Diatonic Chords
const chordsC = getDiatonicChords('C');
assert(chordsC.length === 7, '7 diatonic chords generated for key of C');
assert(chordsC[0].root === 'C' && chordsC[0].type === 'Major', '1st chord in C is C Major');
assert(chordsC[1].root === 'D' && chordsC[1].type === 'Minor', '2nd chord in C is D Minor');
assert(chordsC[6].root === 'B' && chordsC[6].type === 'Diminished', '7th chord in C is B Diminished');

const chordsG = getDiatonicChords('G');
assert(chordsG[6].root === 'F#' && chordsG[6].type === 'Diminished', '7th chord in G is F# Diminished');

// Chord Catalog & Custom Semitone Parser
assert(Object.keys(SMART_CHORD_TYPES).length >= 33, 'At least 33 chord types present in catalog');
assert(SMART_CHORD_TYPES['7b9'].join(',') === '0,4,7,10,13', '7b9 intervals correct: 0,4,7,10,13');
assert(SMART_CHORD_TYPES['maj7#11'].join(',') === '0,4,7,11,18', 'maj7#11 intervals correct: 0,4,7,11,18');

const parsedCustom = parseCustomIntervals('0, 4, 7, 10, 14, 4, 0');
assert(parsedCustom.join(',') === '0,4,7,10,14', 'Custom interval duplicates removed and sorted');

const emptyCustom = parseCustomIntervals('');
assert(emptyCustom.length === 0, 'Empty custom interval returns empty array');
assert(resolveChordIntervals({ type: 'Custom', custom: '' }).join(',') === '0,4,7', 'Empty custom defaults to Major triad');

// Voicing
const close = [0, 4, 7];
const openVoicing = applyVoicing(close, 'open');
assert(openVoicing.join(',') === '0,7,16', 'Open voicing raises second note by 12 (4+12=16)');
const wideVoicing = applyVoicing(close, 'wide');
assert(wideVoicing.join(',') === '0,16,19', 'Wide voicing raises 2nd and highest note by 12');

// Transpose
sk.setKey('C');
sk.setOctave(3);
sk.setTranspose(2); // D
assert(sk.transpose === 2, 'Transpose set to +2 st');
const transposedMidis = sk.resolvePadMidis(0); // C Major root becomes D (Midi 50)
assert(transposedMidis[0] === 50, 'C root transposed +2 semitones is D (MIDI 50)');

// Keyboard Layout Math
const layout = sk.getKeyboardLayoutModel();
assert(layout.whiteCount === 15, '2 displayed octaves produces 15 white keys');
assert(layout.blackKeys.length === 10, '2 displayed octaves produces 10 black keys');


console.log('\n--- 2. Testing Bass Instrument ---');
const bass = new BassInstrument();
assert(BASS_PRESETS.length === 7, '7 Bass presets present');
bass.setPreset('Reese Bass');
assert(bass.preset === 'Reese Bass', 'Preset set to Reese Bass');

bass.setTranspose(-2);
assert(bass.transpose === -2, 'Bass transpose set to -2 st');
const bassMidi = bass.resolveNoteMidi('C', 2); // C2 = 36 - 2 = 34
assert(bassMidi === 34, 'C2 transposed -2 semitones is 34');

// Latch & Note Killing Mock
let stopped = false;
let hardStopped = false;
const mockVoice = {
  stop: () => { stopped = true; },
  hardStop: () => { hardStopped = true; }
};
bass.setLatchEnabled(true);
bass.latchedVoice = mockVoice;
bass.latchedNote = 36;
bass.releaseLatch(true);
assert(hardStopped === true, 'releaseLatch(true) executes hardStop()');
assert(bass.latchedNote === null, 'Latched note cleared');


console.log('\n--- 3. Testing Guitar Rig ---');
const guitar = new GuitarRig();
assert(Object.keys(GUITAR_AMP_PATCHES).length === 6, '6 Guitar Amp patches present');
guitar.loadPatch('Arena Lead');
assert(guitar.patch === 'Arena Lead', 'Patch loaded Arena Lead');
assert(guitar.pedals.drive.on === true, 'Arena Lead drive pedal is active');
assert(guitar.output === 0.76, 'Arena Lead output set to 0.76');

const gCurve = createGuitarDriveCurve(0.5);
assert(gCurve.length === 1024, 'Guitar drive curve length is 1024');


console.log('\n--- 4. Testing Lead Instrument ---');
const lead = new LeadInstrument();
assert(Object.keys(GENERAL_USER_GS_SAMPLES).length === 44, '44 SoundFont sample presets cataloged');
assert(Object.keys(LEAD_VOICE_GROUPS).length === 7, '7 Lead voice groups present');
assert(SYNTH_FALLBACK_VOICES.length === 4, '4 Synth fallback voices present');

lead.setStartOctave(4);
lead.setDisplayOctaves(2);
const leadLayout = lead.getKeyboardLayoutModel();
assert(leadLayout.whiteCount === 15, 'Lead 2 displayed octaves has 15 white keys');
assert(leadLayout.blackKeys.length === 10, 'Lead 2 displayed octaves has 10 black keys');

// Glide & Pitch Strips
lead.setGlideMs(120);
assert(lead.glideMs === 120, 'Glide set to 120ms');
lead.setPitchRange(7);
assert(lead.pitchRange === 7, 'Pitch range set to ±7 st');
lead.setPitchBend(0.5);
assert(lead.pitchBend === 3.5, 'Pitch bend 0.5 with range 7 equals 3.5 st');
lead.releasePitchBend();
assert(lead.pitchBend === 0, 'Pitch bend released to center 0');

lead.setModulation(0.75);
assert(lead.mod === 0.75, 'Modulation set to 0.75');

// Async Pointer Cancellation Test
lead.pendingPointers.set(99, { cancelled: false });
lead.onPointerUp(99);
assert(lead.pendingPointers.has(99) === false, 'Pointer release cancels pending async voice');

console.log(`\nPhase 5 test suite finished with ${errors} errors.`);
process.exit(errors === 0 ? 0 : 1);
