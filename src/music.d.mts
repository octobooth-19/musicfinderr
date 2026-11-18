import type { Analysis, Chord, ChordQuality, ChromaFrame, Mode, Track } from './models';

export const NOTES: string[];
export const MAJOR_STEPS: number[];
export const MINOR_STEPS: number[];
export const DEMO: Track;
export function chordName(chord: Pick<Chord, 'root' | 'quality'>, transpose?: number): string;
export function chordIntervals(quality: ChordQuality): number[];
export function romanNumeral(chord: Pick<Chord, 'root' | 'quality'>, key: number, mode: Mode): string;
export function extractChroma(samples: Float32Array, sampleRate: number): ChromaFrame[];
export function analyzeFrames(frames: ChromaFrame[], duration: number): Analysis;
export function analyzeAudio(arrayBuffer: ArrayBuffer, onProgress?: (message: string) => void): Promise<Analysis & { fullDuration: number }>;
