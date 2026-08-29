# Third-party audio sources

Music & Beats uses optional sample-backed browser instruments while keeping the application static and local-first after each selected preset has been downloaded.

## WebAudioFont data / GeneralUser GS

Sample preset data is loaded lazily from the public `surikov/webaudiofontdata` repository through jsDelivr and is cached by the Music & Beats service worker after it is requested. The preset JavaScript files contain the encoded audio zones used by the browser sampler.

Upstream: `https://github.com/surikov/webaudiofontdata`

GeneralUser GS project/license: `https://schristiancollins.com/generaluser.php`

The WebAudioFont data repository links the source SoundFont licenses. GeneralUser GS License v2.0 permits use in software projects and modification/repackaging. The GeneralUser GS documentation also contains provenance notes for its historical constituent samples, so Music & Beats keeps the upstream attribution and does not describe the bank as CC0.

### V39 Western instrument catalog

V39 deliberately focuses the performance Lead catalog on Western General MIDI instruments and hides the earlier Indian-specific Lead entries from the current UI. The complete program mapping lives in `v39-core.js` and uses the corresponding `sound/NNN0_GeneralUserGS_sf2_file.js` presets.

Current families and GM programs include:

- Pianos & keys: Acoustic Grand (0), Bright Piano (1), Electric Grand (2), Honky Tonk (3), Electric Piano 1/2 (4/5), Harpsichord (6), Clavinet (7)
- Organs: Drawbar (16), Percussive (17), Rock (18), Church (19)
- Guitars: Nylon (24), Steel (25), Jazz (26), Clean (27), Muted (28), Overdrive (29), Distortion (30)
- Bass: Finger (33), Pick (34)
- Strings & ensemble: Violin (40), Cello (42), String Ensemble (48), Synth Strings (50), Choir Aahs (52)
- Brass & winds: Trumpet (56), Trombone (57), French Horn (60), Alto Sax (65), Tenor Sax (66), Clarinet (71), Concert Flute (73)
- Synth leads: Square (80), Saw (81), Calliope (82), Charang (84)
- Pads: New Age (88), Warm (89), Poly Synth (90), Choir (91), Metallic (93), Halo (94), Sweep (95)

These are actual sample-backed GeneralUser GS programs, not renamed copies of one placeholder oscillator patch. Music & Beats lazy-loads only the selected program rather than bundling the complete SoundFont catalog, which keeps repository and initial page weight much smaller. Subsequent use can reuse the browser/service-worker cache.

### Earlier V38 presets

V38 initially introduced these GeneralUser GS presets:

- `sound/0000_GeneralUserGS_sf2_file.js` — Acoustic Grand Piano
- `sound/0040_GeneralUserGS_sf2_file.js` — Electric Piano
- `sound/0200_GeneralUserGS_sf2_file.js` — Reed Organ
- `sound/0730_GeneralUserGS_sf2_file.js` — Flute
- `sound/0770_GeneralUserGS_sf2_file.js` — Shakuhachi
- `sound/1040_GeneralUserGS_sf2_file.js` — Sitar

V39 retains compatibility with old V38 projects but the current Lead selector prioritizes the expanded Western catalog.

## Effects implementation

The Lead effects rack is implemented with the browser Web Audio API. Its available effect vocabulary and workflow were informed by open-source browser audio projects including Tone.js (MIT), which exposes effects such as chorus, phaser, tremolo, vibrato, AutoWah, distortion, feedback delay, ping-pong delay, reverbs and stereo processing.

Tone.js: `https://github.com/Tonejs/Tone.js`

Music & Beats does not copy Tone.js source code or add Tone.js as a second transport/audio engine. The effects are native Music & Beats Web Audio graphs so they share the existing looper context and remain compatible with the current static GitHub Pages architecture.
