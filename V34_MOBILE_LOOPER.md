# V34 — Mobile-first backing looper

V34 changes the product goal from a browser recording workstation into a fast backing-track looper.

## Product flow

1. Home has one primary **Play** action.
2. Play opens the looper directly and unlocks Web Audio from the same user gesture.
3. The looper exposes only three core tracks: **Beats, Keys and Bass**.
4. Beats are pattern data. Keys and Bass are captured as musical events, not rendered audio recordings.
5. Every track shares the same master BPM, bar length and Web Audio clock.

Legacy Guitar, microphone and multi-layer recording screens remain in the codebase for compatibility but are no longer part of the V34 primary product flow.

## Sync model

The old core recording flow used MediaRecorder plus JavaScript timers to begin and end generated-instrument recordings. That made the start of the captured audio dependent on multiple clocks and browser scheduling.

V34 uses one Web Audio clock for the backing looper:

- Master grid: 16th-note steps.
- Loop length: 1, 2, 4 or 8 bars.
- Scheduler: 25 ms look-ahead loop scheduling ~120 ms ahead against `AudioContext.currentTime`.
- Keys/Bass capture: note/chord starts and lengths quantized to the master 16th-note grid.
- Record arm: starts on a bar boundary.
- First recording from a stopped transport gets a one-bar count-in.
- Playback: stored MIDI-style events are synthesized directly at their exact scheduled Web Audio times.
- Beats never need to be recorded; the selected pattern is always derived from the same master step.

This makes loop length and phase deterministic and removes MediaRecorder latency from the three core backing tracks.

## Mobile UX

- Sticky transport with one large Play/Stop action.
- Large BPM stepper and 1/2/4/8-bar choices.
- Three large track cards with mute / variation / loop / clear actions.
- Active track opens one touch-first workspace beneath the track cards.
- Chord and bass pads use large touch targets and disable browser selection/callouts.
- Phone layout stacks track cards and uses 4-column performance pads.
- iPad/tablet/desktop progressively expand without changing the interaction model.

## Indian backing voices

V34 adds synthesized starting points for:

- Harmonium
- Tanpura Drone
- Bansuri Air
- Sitar Pluck

Tanpura uses tonic/fifth/octave drone intervals instead of normal chord voicing. V34 also adds Keherwa and Dadra groove starting points to the beat style list.

These are synthesis approximations intended as the first native instrument layer. A later sample-based instrument pack can replace or augment them without changing the looper timing model.

## Persistence

V34 automatically stores looper state in `localStorage`:

- BPM and loop bars
- Beat style, energy and pattern
- Keys/Bass event loops
- Keys/Bass sounds and keys
- Per-track mute state

## Regression checklist

### Mobile

- Home shows a single Play CTA and no Record/Guitar/Vocal choice.
- Tapping Play opens the looper and audio is already unlocked.
- Transport remains reachable while scrolling.
- Track controls and performance pads are comfortably tappable.
- Beat editor scrolls horizontally instead of compressing 16 steps into unusable buttons.

### Sync

- Start transport and let it run for multiple loop cycles; Beat remains phase locked.
- Arm Keys while transport is running; recording begins on the next bar.
- Hold/release chords; on the next cycle they replay at the same quantized positions.
- Arm Bass and add notes; Bass and Keys restart against the same master loop.
- Change loop length while stopped and verify all events remain within the selected cycle.
- Change BPM and verify all event loops follow the new grid without time-stretch artifacts.

### Indian voices

- Harmonium sustains cleanly for chord loops.
- Tanpura Drone produces tonic/fifth/octave backing rather than a triadic chord.
- Bansuri and Sitar presets respond from the Keys pads.
- Keherwa and Dadra appear in Beat styles and remain bar locked.

## Next hardening pass

The next engineering step should migrate V34 out of the historical patch chain into first-class modules and add automated browser regression tests for mobile Safari, iPad Safari and desktop Chromium. The V34 musical-event model should remain the source of truth for generated backing tracks.