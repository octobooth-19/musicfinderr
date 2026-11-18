export type Mode = 'major' | 'minor';
export type ChordQuality = Mode | 'dim';
export type Instrument = 'piano' | 'guitar';
export type View = 'analyze' | 'library' | 'history';
export type Modal = 'help' | 'settings' | 'instrument';

export interface Chord {
  root: number;
  quality: ChordQuality;
  start: number;
  duration: number;
}

export interface KeyCandidate {
  key: number;
  mode: Mode;
  score: number;
}

export interface Analysis {
  key: number;
  mode: Mode;
  confidence: number;
  alternative?: KeyCandidate;
  chords: Chord[];
  duration: number;
  chroma: number[];
}

export interface TrackMetadata {
  title: string;
  artist: string;
  artwork?: string;
  album?: string;
  year?: string;
  source: 'demo' | 'youtube' | 'spotify' | 'preview' | 'upload';
  sourceUrl?: string;
}

export interface Track extends Analysis, TrackMetadata {
  id: string;
  fullDuration: number;
  bpm: number | null;
  meter: string | null;
}

export interface ResolvedTrack extends TrackMetadata {
  preview: { url: string; title: string; artist: string } | null;
}

export interface ChromaFrame {
  time: number;
  chroma: number[];
}
