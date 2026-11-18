export const NOTES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
export const chordName = (chord, transpose = 0) => `${NOTES[(chord.root + transpose + 120) % 12]}${chord.quality === 'minor' ? 'm' : chord.quality === 'dim' ? 'dim' : ''}`;
export const chordIntervals = quality => quality === 'minor' ? [0, 3, 7] : quality === 'dim' ? [0, 3, 6] : [0, 4, 7];
export function romanNumeral(chord, key, mode) {
  const steps = mode === 'minor' ? MINOR_STEPS : MAJOR_STEPS;
  const degree = steps.indexOf((chord.root - key + 12) % 12);
  if (degree < 0) return '—';
  const numeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][degree];
  return chord.quality === 'minor' ? numeral.toLowerCase() : chord.quality === 'dim' ? `${numeral.toLowerCase()}°` : numeral;
}

function fft(real, imag) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j], real[i]];
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = -2 * Math.PI / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const c = Math.cos(k * angle), s = Math.sin(k * angle);
        const a = start + k, b = a + size / 2;
        const tr = real[b] * c - imag[b] * s, ti = real[b] * s + imag[b] * c;
        real[b] = real[a] - tr; imag[b] = imag[a] - ti;
        real[a] += tr; imag[a] += ti;
      }
    }
  }
}

export function extractChroma(samples, sampleRate) {
  const size = 4096, hop = 2048;
  const frames = [];
  for (let offset = 0; offset + size <= samples.length; offset += hop) {
    const real = new Float64Array(size), imag = new Float64Array(size);
    for (let i = 0; i < size; i++) real[i] = samples[offset + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
    fft(real, imag);
    const magnitudes = new Float64Array(size / 2);
    for (let i = 1; i < size / 2; i++) magnitudes[i] = Math.hypot(real[i], imag[i]);
    const chroma = new Float64Array(12);
    for (let bin = 2; bin < size / 2 - 1; bin++) {
      const freq = bin * sampleRate / size;
      if (freq < 65 || freq > 2100 || magnitudes[bin] < magnitudes[bin - 1] || magnitudes[bin] < magnitudes[bin + 1]) continue;
      const a = magnitudes[bin - 1], b = magnitudes[bin], c = magnitudes[bin + 1];
      const delta = 0.5 * (a - c) / (a - 2 * b + c || 1);
      const midi = 69 + 12 * Math.log2((bin + delta) * sampleRate / size / 440);
      const note = Math.round(midi);
      const tuning = Math.abs(midi - note);
      if (tuning < 0.4) chroma[(note + 120) % 12] += Math.sqrt(b) * (1 - tuning);
    }
    frames.push({ time: offset / sampleRate, chroma: Array.from(chroma) });
  }
  return frames;
}

function correlate(a, b) {
  const ma = a.reduce((x, y) => x + y, 0) / 12;
  const mb = b.reduce((x, y) => x + y, 0) / 12;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < 12; i++) { dot += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; }
  return dot / (Math.sqrt(aa * bb) || 1);
}

export function analyzeFrames(frames, duration) {
  if (frames.length < 2) throw new Error('This audio is too short. Try a clip of at least 3 seconds.');
  const total = new Array(12).fill(0);
  frames.forEach(frame => frame.chroma.forEach((v, i) => { total[i] += v; }));
  if (total.reduce((a, b) => a + b, 0) < 0.01) throw new Error('No pitched audio was detected. Try a louder musical recording.');
  const profiles = {
    major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
  };
  const candidates = [];
  for (const [mode, profile] of Object.entries(profiles)) {
    for (let key = 0; key < 12; key++) candidates.push({ key, mode, score: correlate(total, total.map((_, i) => profile[(i - key + 12) % 12])) });
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const windowSize = 2;
  const chords = [];
  for (let start = 0; start < duration; start += windowSize) {
    const vector = new Array(12).fill(0);
    frames.filter(f => f.time >= start && f.time < start + windowSize).forEach(f => f.chroma.forEach((v, i) => { vector[i] += v; }));
    if (!vector.some(v => v > 0)) continue;
    let winner = null;
    for (let root = 0; root < 12; root++) {
      for (const quality of ['major', 'minor']) {
        const intervals = chordIntervals(quality);
        const template = vector.map((_, i) => intervals.includes((i - root + 12) % 12) ? 1 : 0);
        const score = correlate(vector, template);
        if (!winner || score > winner.score) winner = { root, quality, score };
      }
    }
    const previous = chords.at(-1);
    if (previous && previous.root === winner.root && previous.quality === winner.quality) previous.duration += Math.min(windowSize, duration - start);
    else chords.push({ root: winner.root, quality: winner.quality, start, duration: Math.min(windowSize, duration - start) });
  }
  return {
    key: best.key, mode: best.mode,
    confidence: Math.round(Math.max(0, Math.min(1, best.score)) * 100),
    alternative: candidates[1], chords, duration,
    chroma: total.map(v => v / Math.max(...total)),
  };
}

export async function analyzeAudio(arrayBuffer, onProgress = () => {}) {
  const context = new AudioContext();
  try {
    onProgress('Decoding your audio…');
    const decoded = await context.decodeAudioData(arrayBuffer);
    if (decoded.duration < 3) throw new Error('This audio is too short. Try a clip of at least 3 seconds.');
    const duration = Math.min(decoded.duration, 90);
    const offline = new OfflineAudioContext(1, Math.ceil(duration * 11025), 11025);
    const source = offline.createBufferSource();
    source.buffer = decoded; source.connect(offline.destination); source.start();
    const mono = await offline.startRendering();
    onProgress('Finding the key and chords…');
    await new Promise(resolve => setTimeout(resolve, 40));
    const result = analyzeFrames(extractChroma(mono.getChannelData(0), 11025), duration);
    return { ...result, fullDuration: decoded.duration };
  } finally { await context.close(); }
}

export const DEMO = {
  id: 'demo-dreams', title: 'Dreams', artist: 'Fleetwood Mac', album: 'Rumours', year: '1977',
  source: 'demo', key: 5, mode: 'major', bpm: 120, meter: '4/4', confidence: 96, duration: 16, fullDuration: 257,
  chords: Array.from({ length: 8 }, (_, i) => ({ root: i % 2 ? 7 : 5, quality: 'major', start: i * 2, duration: 2 })),
  chroma: [0.65, 0.12, 0.57, 0.09, 0.68, 1, 0.08, 0.88, 0.14, 0.76, 0.4, 0.55],
};
