/**
 * Music & Beats — Non-invasive Phase 7 Verification Suite
 * Tests AppCore navigation & lifecycle, PlayUI view-models, RecordUI view-models,
 * HelpSubsystem registry & Explain Mode, and verifies zero listener accumulation.
 */

import { AppCore } from './src/app-core.js';
import { PlayUI } from './src/play-ui.js';
import { RecordUI } from './src/record-ui.js';
import { HelpSubsystem, HELP_REGISTRY } from './src/help.js';
import { smartKeys } from './src/instruments/smart-keys.js';
import { bassInstrument } from './src/instruments/bass.js';
import { leadInstrument } from './src/instruments/lead.js';
import { guitarRig } from './src/instruments/guitar.js';
import { liveLooper } from './src/looper.js';

let errors = 0;
function assert(condition, msg) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    errors++;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log('--- 1. Testing AppCore Lifecycle & Navigation ---');
const app = new AppCore();
assert(app.currentScreen === 'home', 'AppCore initial screen is home');
assert(app.isMounted === false, 'AppCore is initially unmounted');

// Mock DOM container
function createMockElement(tag = 'div') {
  const listeners = [];
  return {
    tagName: tag.toUpperCase(),
    innerHTML: '',
    children: [],
    dataset: {},
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      toggle(c, force) { if (force !== undefined) { force ? this.add(c) : this.remove(c); } else { this.classes.has(c) ? this.remove(c) : this.add(c); } },
      contains(c) { return this.classes.has(c); }
    },
    addEventListener(event, fn, options) {
      listeners.push({ event, fn, options });
    },
    removeEventListener(event, fn) {
      const idx = listeners.findIndex(l => l.event === event && l.fn === fn);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    _listeners: listeners
  };
}

const mockRoot = createMockElement('div');
app.initialize(mockRoot);
assert(app.isMounted === true, 'AppCore mounted successfully');

app.navigateTo('play');
assert(app.currentScreen === 'play', 'AppCore navigated to play screen');

app.navigateTo('record');
assert(app.currentScreen === 'record', 'AppCore navigated to record screen');

app.destroy();
assert(app.isMounted === false, 'AppCore destroyed and unmounted cleanly');


console.log('\n--- 2. Testing PlayUI View Models ---');
const play = new PlayUI();

// Smart Keys View Model
smartKeys.setKey('G');
smartKeys.setTranspose(-2);
const skVM = play.getSmartKeysViewModel();
assert(skVM.key === 'G', 'Smart Keys VM key is G');
assert(skVM.transpose === -2, 'Smart Keys VM transpose is -2 st');
assert(skVM.pads.length === 7, 'Smart Keys VM has 7 chord pads');
assert(skVM.pads[0].label.startsWith('G'), '1st chord pad in key of G starts with G');

// Bass View Model
bassInstrument.setPreset('Acid Bass');
bassInstrument.setTranspose(3);
const bassVM = play.getBassViewModel();
assert(bassVM.preset === 'Acid Bass', 'Bass VM preset is Acid Bass');
assert(bassVM.transpose === 3, 'Bass VM transpose is +3 st');

// Lead View Model
leadInstrument.setVoice('Overdrive Guitar');
leadInstrument.setGlideMs(150);
leadInstrument.setPitchRange(12);
leadInstrument.setModulation(0.85);
const leadVM = play.getLeadViewModel();
assert(leadVM.voice === 'Overdrive Guitar', 'Lead VM voice is Overdrive Guitar');
assert(leadVM.glideMs === 150, 'Lead VM glide is 150ms');
assert(leadVM.pitchRange === 12, 'Lead VM pitch range is ±12 st');
assert(leadVM.mod === 0.85, 'Lead VM mod is 0.85');
assert(leadVM.keyboardModel.whiteCount === 15, 'Lead VM keyboard has 15 white keys');

// Guitar View Model
guitarRig.loadPatch('Ambient Swell');
const guitarVM = play.getGuitarViewModel();
assert(guitarVM.patch === 'Ambient Swell', 'Guitar VM patch is Ambient Swell');
assert(guitarVM.connected === false, 'Guitar VM input not connected on mount');

// Arp View Model
const arpVM = play.getArpViewModel();
assert(arpVM.rates.includes('1/64'), 'Arp VM rates includes 1/64');


console.log('\n--- 3. Testing RecordUI View Models ---');
const record = new RecordUI();
liveLooper.setBpm(132);
liveLooper.setBars(8);

const recVM = record.getLooperViewModel();
assert(recVM.bpm === 132, 'Record looper VM BPM is 132');
assert(recVM.bars === 8, 'Record looper VM bars is 8');
assert(recVM.totalSteps === 128, '8 bars at 16 steps/bar is 128 total steps');

const setupVM = record.getSetupViewModel();
assert(setupVM.barChoices.join(',') === '1,2,4,8', 'Bar choices [1, 2, 4, 8] present');


console.log('\n--- 4. Testing Help Subsystem & Explain Controls ---');
const help = new HelpSubsystem();
assert(Object.keys(HELP_REGISTRY).length >= 20, 'At least 20 documented controls in HELP_REGISTRY');

const smartKeyHelp = help.getTopic('smart.key');
assert(smartKeyHelp.title === 'Key Preset', 'smart.key topic title resolved');
assert(smartKeyHelp.section === 'Smart Keys', 'smart.key section is Smart Keys');

const unknownHelp = help.getTopic('unknown.key');
assert(unknownHelp.title === 'Control Information', 'Fallback help topic resolved');

help.setExplainMode(true);
assert(help.isExplainMode === true, 'Explain Mode active');
help.toggleExplainMode();
assert(help.isExplainMode === false, 'Explain Mode toggled off');


console.log('\n--- 5. Testing Listener Cleanup & Zero Leakage ---');
// Verify PlayUI mount & unmount cleanly clears listeners
const testEl = createMockElement('button');
play.listen(testEl, 'click', () => {});
play.listen(testEl, 'pointerdown', () => {});
assert(testEl._listeners.length === 2, '2 listeners attached via play.listen');

play.unmount();
assert(testEl._listeners.length === 0, 'play.unmount() completely removed all listeners');

console.log(`\nPhase 7 test suite finished with ${errors} errors.`);
process.exit(errors === 0 ? 0 : 1);
