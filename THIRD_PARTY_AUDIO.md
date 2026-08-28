# Third-party audio sources

Music & Beats V38 adds optional sample-backed lead voices while keeping the application static and local-first after first load.

## WebAudioFont data / GeneralUser GS

Sample preset data is loaded lazily from the public `surikov/webaudiofontdata` repository through jsDelivr and is cached by the Music & Beats service worker after it is requested. The preset JavaScript files contain the encoded audio zones used by the browser sampler.

Upstream: `https://github.com/surikov/webaudiofontdata`

V38 currently uses these exact GeneralUser GS preset files:

- `sound/0000_GeneralUserGS_sf2_file.js` — Acoustic Grand Piano
- `sound/0040_GeneralUserGS_sf2_file.js` — Electric Piano
- `sound/0200_GeneralUserGS_sf2_file.js` — Reed Organ
- `sound/0730_GeneralUserGS_sf2_file.js` — Flute
- `sound/0770_GeneralUserGS_sf2_file.js` — Shakuhachi
- `sound/1040_GeneralUserGS_sf2_file.js` — Sitar

The WebAudioFont data repository is distributed under its upstream license and explicitly links the source SoundFont licenses. GeneralUser GS License v2.0 permits use in software projects and modification/repackaging. See the upstream license text before redistributing a local copy of the complete bank.

GeneralUser GS project/license: `https://schristiancollins.com/generaluser.php`

### Why these are lazy-loaded instead of copied wholesale

Each WebAudioFont preset embeds encoded sample data. Copying the complete SoundFont or large generated catalog into this small static repository would add significant repository and first-load weight. V38 therefore pulls only the selected instrument preset on first use. The browser/service worker then caches that asset, so subsequent use can reuse the downloaded preset.

No sample from an unknown or unverified random source is bundled by V38.

## Effects implementation

V38's effects rack is implemented with the browser Web Audio API. Its available effect vocabulary and workflow were informed by open-source browser audio projects including Tone.js (MIT), which exposes effects such as chorus, phaser, tremolo, vibrato, AutoWah, distortion, feedback delay, ping-pong delay, reverbs and stereo processing.

Tone.js: `https://github.com/Tonejs/Tone.js`

V38 does not copy Tone.js source code or add Tone.js as a second transport/audio engine. The effects are native Music & Beats Web Audio graphs so they share the existing looper context and remain compatible with the current static GitHub Pages architecture.
