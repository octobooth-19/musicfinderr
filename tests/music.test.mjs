import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMusicLink, searchTerm } from '../src/links.mjs';
import { analyzeFrames, extractChroma, chordName, romanNumeral } from '../src/music.mjs';

test('accepts and normalizes YouTube and Spotify track links only', () => {
  assert.equal(parseMusicLink('https://youtu.be/dQw4w9WgXcQ?t=10').provider, 'youtube');
  assert.equal(parseMusicLink('https://music.youtube.com/watch?v=dQw4w9WgXcQ').provider, 'youtube');
  assert.equal(parseMusicLink('https://open.spotify.com/track/0ofHAoxe9vBkTCp2UQIavz?si=abc').provider, 'spotify');
  for (const url of ['https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ', 'https://open.spotify.com/playlist/0ofHAoxe9vBkTCp2UQIavz', 'javascript:alert(1)', 'not a link', 'https://youtube.com/watch?v=short']) assert.equal(parseMusicLink(url), null);
});

test('cleans provider video titles for preview matching', () => {
  assert.equal(searchTerm('Fleetwood Mac - Dreams (Official Music Video) [HD]'), 'Fleetwood Mac - Dreams');
});

test('transposes chord names and describes their original function', () => {
  assert.equal(chordName({ root: 11, quality: 'minor' }, 2), 'C♯m');
  assert.equal(chordName({ root: 0, quality: 'major' }, -1), 'B');
  assert.equal(romanNumeral({ root: 5, quality: 'major' }, 0, 'major'), 'IV');
  assert.equal(romanNumeral({ root: 0, quality: 'minor' }, 9, 'minor'), 'iii');
});

test('identifies a synthesized C major chord from actual audio samples', () => {
  const sampleRate = 11025;
  const audio = new Float32Array(sampleRate * 6);
  const frequencies = [130.8128, 261.6256, 329.6276, 391.9954];
  for (let i = 0; i < audio.length; i++) audio[i] = frequencies.reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * i / sampleRate), 0) / frequencies.length;
  const result = analyzeFrames(extractChroma(audio, sampleRate), 6);
  assert.equal(result.key, 0);
  assert.equal(result.mode, 'major');
  assert.equal(result.chords[0].root, 0);
  assert.equal(result.chords[0].quality, 'major');
  assert.equal(result.chords[0].duration, 6);
});

test('identifies A minor and handles silence explicitly', () => {
  const sampleRate = 11025, samples = new Float32Array(sampleRate * 4);
  for (let i = 0; i < samples.length; i++) samples[i] = [220, 261.6256, 329.6276].reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * i / sampleRate), 0) / 3;
  const result = analyzeFrames(extractChroma(samples, sampleRate), 4);
  assert.equal(result.key, 9);
  assert.equal(result.mode, 'minor');
  assert.equal(result.chords[0].quality, 'minor');
  assert.throws(() => analyzeFrames(extractChroma(new Float32Array(sampleRate * 4), sampleRate), 4), /No pitched audio/);
  assert.throws(() => analyzeFrames([], 0), /too short/);
});

test('finds chord changes at two-second boundaries', () => {
  const rate = 11025, samples = new Float32Array(rate * 6);
  const progression = [[261.6256, 329.6276, 391.9954], [349.2282, 440, 523.2511], [391.9954, 493.8833, 587.3295]];
  for (let i = 0; i < samples.length; i++) {
    const frequencies = progression[Math.min(2, Math.floor(i / rate / 2))];
    samples[i] = frequencies.reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * i / rate), 0) / 3;
  }
  const result = analyzeFrames(extractChroma(samples, rate), 6);
  assert.deepEqual(result.chords.map(c => c.root), [0, 5, 7]);
  assert.deepEqual(result.chords.map(c => c.start), [0, 2, 4]);
  assert.equal(result.chords.reduce((sum, c) => sum + c.duration, 0), 6);
});
