# Keynote

An interactive music workspace for finding a song's key, exploring estimated chords, and playing or transposing a progression.

Built with **Angular 22**, standalone TypeScript components, signals, Angular Forms, and the Angular CLI. Express provides the streaming-link API; Web Audio handles analysis and synthesized playback. No React runtime is used.

## Run

Use Node.js 22.22.3+, 24.15.0+, or 26+ (see `package.json` for the supported ranges).

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. Development runs the Angular dev server on port 3000 and the Express API on port 3001, with `/api` proxied to Express.

```sh
npm test
npm run build
npm start
```

`npm run build` performs strict TypeScript and Angular template checks, then creates the production app in `dist/`. `npm start` serves both the app and API on port 3000; set `PORT` to change the production port. The `npm test` command exercises the shared, framework-independent analysis and link-parsing modules.

## Audio and streaming links

- Upload MP3, WAV, M4A, OGG, or FLAC (browser codec support varies), up to 40 MB. Audio stays in the browser; the first 90 seconds are analyzed.
- YouTube and Spotify track links are resolved through their public oEmbed endpoints. A title-based Apple Music preview lookup supplies a 30-second clip when a close match exists. Preview results are explicitly labeled and can differ from the original recording. If no preview is available, upload an audio file you have permission to use.
- Link lookup requires outbound HTTPS and DNS access to YouTube, Spotify, and Apple's iTunes API. Provider/network failures are surfaced in the app; local audio uploads remain available without those services.
- Key detection uses FFT pitch-class energy and Krumhansl-Schmuckler profile correlation. Major/minor chord estimates use two-second windows. Results are estimates, not professional transcriptions; profile match is not a calibrated probability. Tempo and time signature are not estimated.
- The initial Dreams screen is a curated, illustrative demo, not a live recording analysis. Its playback is synthesized chord audio, not the copyrighted song.
- Playback uses Web Audio synthesis. Guitar mode is a plucked-style synth with an interactive fretboard note map, not a fingering chart.
- Saved tracks use browser local storage. No account or API credentials are required.
