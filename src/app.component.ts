import {
  Component, ElementRef, HostListener, Injector, OnDestroy, afterNextRender,
  computed, inject, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlbumArtComponent } from './album-art.component';
import { AudioService } from './audio.service';
import { IconDirective } from './icon.directive';
import { analyzeAudio, chordIntervals, chordName, DEMO, MAJOR_STEPS, MINOR_STEPS, NOTES, romanNumeral } from './music.mjs';
import { parseMusicLink } from './links.mjs';
import type { Chord, Instrument, Modal, ResolvedTrack, Track, TrackMetadata, View } from './models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, AlbumArtComponent, IconDirective],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnDestroy {
  readonly view = signal<View>('analyze');
  readonly track = signal<Track>(DEMO);
  readonly url = signal('');
  readonly inputMode = signal<'link' | 'upload'>('link');
  readonly busy = signal('');
  readonly error = signal('');
  readonly pending = signal<ResolvedTrack | null>(null);
  readonly transpose = signal(0);
  readonly selected = signal(0);
  readonly playing = signal(false);
  readonly position = signal(0);
  readonly loop = signal(true);
  readonly volume = signal(0.55);
  readonly instrument = signal<Instrument>('piano');
  readonly modal = signal<Modal | null>(null);
  readonly toast = signal('');
  readonly mobileNav = signal(false);
  readonly library = signal<Track[]>(this.readLibrary());
  readonly history = signal<Track[]>([]);
  readonly librarySearch = signal('');
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  readonly linkInput = viewChild<ElementRef<HTMLInputElement>>('linkInput');
  readonly notes = NOTES;
  readonly demo = DEMO;
  readonly keyboard = Array.from({ length: 24 }, (_, i) => i);
  readonly frets = [0, 1, 2, 3, 4, 5];
  readonly guitarStrings = [64, 59, 55, 50, 45, 40];
  readonly waveHeights = Array.from({ length: 27 }, (_, i) => 7 + Math.sin(i * 1.7) ** 2 * 22);
  readonly chordName = chordName;
  readonly romanNumeral = romanNumeral;
  readonly currentKey = computed(() => (this.track().key + this.transpose() + 12) % 12);
  readonly activeChord = computed(() => this.track().chords[this.selected()] || this.track().chords[0]);
  readonly isSaved = computed(() => this.library().some(t => t.id === this.track().id));
  readonly scaleSteps = computed(() => this.track().mode === 'minor' ? MINOR_STEPS : MAJOR_STEPS);
  readonly visibleTracks = computed(() => this.view() === 'library' ? this.library() : this.history());
  readonly filteredTracks = computed(() => this.visibleTracks().filter(track =>
    `${track.title} ${track.artist}`.toLowerCase().includes(this.librarySearch().toLowerCase())));
  readonly uniqueChords = computed(() => this.track().chords.filter((chord, i, all) =>
    all.findIndex(other => other.root === chord.root && other.quality === chord.quality) === i));
  readonly activeNotes = computed(() => chordIntervals(this.activeChord().quality)
    .map(interval => (this.activeChord().root + this.transpose() + interval + 12) % 12));
  readonly activeNoteNames = computed(() => this.activeNotes().map(note => NOTES[note]).join(' · '));
  readonly timelineMax = computed(() => Math.max(0.1, this.track().duration - 0.1));

  private readonly synth = inject(AudioService);
  private readonly injector = inject(Injector);
  private clock?: ReturnType<typeof setInterval>;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private previousFocus?: HTMLElement;
  private destroyed = false;

  private readLibrary(): Track[] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('keynote-library') || '[]');
      if (!Array.isArray(saved)) throw new Error('Saved library is not a list.');
      return saved.filter((value: unknown): value is Track => {
        if (!value || typeof value !== 'object') return false;
        const track = value as Partial<Track>;
        return typeof track.id === 'string' && typeof track.title === 'string' &&
          typeof track.artist === 'string' && typeof track.key === 'number' &&
          (track.mode === 'major' || track.mode === 'minor') &&
          Array.isArray(track.chords) && track.chords.length > 0;
      });
    } catch (error) {
      console.warn('Keynote could not restore the saved library:', error);
      return [];
    }
  }

  formatTime(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  setInputMode(mode: 'link' | 'upload'): void {
    this.inputMode.set(mode); this.error.set('');
  }

  updateUrl(value: string): void {
    this.url.set(value); this.error.set('');
  }

  notify(message: string): void {
    clearTimeout(this.toastTimer);
    this.toast.set(message);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3500);
  }

  navigate(view: View): void {
    this.view.set(view); this.mobileNav.set(false); this.pause();
  }

  loadTrack(track: Track): void {
    this.pause(); this.position.set(0); this.selected.set(0); this.transpose.set(0);
    this.track.set(track); this.pending.set(null); this.error.set('');
    this.view.set('analyze'); this.mobileNav.set(false);
  }

  async handleLink(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    if (!parseMusicLink(this.url())) {
      this.error.set('Add a valid YouTube video or Spotify track link to get started.'); return;
    }
    this.error.set(''); this.pending.set(null); this.busy.set('Finding your track…'); this.pause();
    try {
      const response = await fetch('/api/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: this.url() }),
      });
      if (!response.ok) throw new Error(await this.responseError(response));
      const data: ResolvedTrack = await response.json();
      if (!data.preview) {
        this.pending.set(data);
        this.notify('Track found. Add an audio file to reveal its key and chords.');
      } else {
        this.busy.set('Loading a 30-second preview…');
        const audio = await fetch(data.preview.url);
        if (!audio.ok) throw new Error(await this.responseError(audio));
        await this.processAudio(await audio.arrayBuffer(), {
          ...data, title: data.preview.title, artist: data.preview.artist, source: 'preview',
        });
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Analysis failed. Please try again.');
    } finally { this.busy.set(''); }
  }

  private async responseError(response: Response): Promise<string> {
    const data: { error?: string } = await response.json();
    return data.error || `The request failed (${response.status}). Please try again.`;
  }

  openFilePicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  onFileChange(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) void this.handleFile(input.files?.[0]);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (!this.busy()) void this.handleFile(event.dataTransfer?.files[0]);
  }

  async handleFile(file?: File): Promise<void> {
    if (!file || this.busy()) return;
    this.error.set('');
    if (!file.type.startsWith('audio/') && !/\.(wav|mp3|m4a|ogg|flac|aac)$/i.test(file.name)) {
      this.error.set('Choose an audio file: MP3, WAV, M4A, OGG, or FLAC.'); return;
    }
    if (file.size > 40 * 1024 * 1024) {
      this.error.set('This file is over 40 MB. Please upload a smaller file.'); return;
    }
    this.busy.set('Reading your audio…'); this.pause();
    try {
      const pending = this.pending();
      await this.processAudio(await file.arrayBuffer(), pending
        ? { ...pending, source: 'upload' }
        : { title: file.name.replace(/\.[^.]+$/, ''), artist: 'Your audio', source: 'upload' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The audio could not be analyzed. Please try again.';
      this.error.set(message.toLowerCase().includes('decode')
        ? 'Your browser couldn’t read this audio. Try an MP3 or WAV file.' : message);
    } finally {
      this.busy.set('');
      const input = this.fileInput()?.nativeElement;
      if (input) input.value = '';
    }
  }

  private async processAudio(buffer: ArrayBuffer, metadata: TrackMetadata): Promise<void> {
    const analysis = await analyzeAudio(buffer, message => this.busy.set(message));
    if (this.destroyed) return;
    const track: Track = { ...metadata, ...analysis, id: crypto.randomUUID(), bpm: null, meter: null };
    this.loadTrack(track);
    this.history.update(previous => [track, ...previous].slice(0, 12));
    this.notify('Your analysis is ready. Let’s find your sound.');
  }

  saveTrack(): void {
    const saved = this.isSaved();
    const next = saved ? this.library().filter(track => track.id !== this.track().id) : [this.track(), ...this.library()];
    try {
      localStorage.setItem('keynote-library', JSON.stringify(next));
      this.library.set(next);
      this.notify(saved ? 'Removed from your library.' : 'Saved to your library.');
    } catch {
      this.notify('Your browser storage is full. This track could not be saved.');
    }
  }

  exportTrack(): void {
    const track = this.track();
    const rows = [
      `${track.title} — ${track.artist}`, `Key: ${NOTES[this.currentKey()]} ${track.mode}`,
      `Source: ${track.source === 'demo' ? 'Illustrative demo, not an audio analysis' : track.source === 'preview' ? '30-second matched preview; may differ from linked recording' : 'Uploaded audio, first 90 seconds maximum'}`,
      '', 'Start\tDuration\tChord\tDegree',
      ...track.chords.map(chord => `${this.formatTime(chord.start)}\t${chord.duration.toFixed(1)}s\t${chordName(chord, this.transpose())}\t${romanNumeral(chord, track.key, track.mode)}`),
    ];
    const objectUrl = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = objectUrl; link.download = `${track.title.replace(/[^a-z0-9 -]/gi, '')}-chords.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    this.notify('Your chord sheet is downloaded.');
  }

  private playNotes(notes: number[], duration = 1.1): void {
    void this.synth.playNotes(notes, this.instrument(), this.volume(), duration).catch(error => {
      console.error('Chord playback failed:', error);
      this.pause();
      this.notify('Enable audio in your browser to hear chords.');
    });
  }

  private soundChord(chord: Chord, duration = 1.1): void {
    const root = chord.root + this.transpose();
    this.playNotes([root + 48, ...chordIntervals(chord.quality).map(note => note + root + 60)], duration);
  }

  previewNote(midi: number): void {
    this.pause(); this.playNotes([midi], 0.8);
  }

  previewActiveChord(): void {
    this.pause(); this.soundChord(this.activeChord());
  }

  chooseChord(index: number): void {
    this.pause(); this.selected.set(index); this.position.set(this.track().chords[index].start);
    this.soundChord(this.track().chords[index]);
  }

  chooseUniqueChord(chord: Chord): void {
    this.chooseChord(this.track().chords.indexOf(chord));
  }

  togglePlayback(): void {
    if (this.playing()) this.pause();
    else {
      if (this.position() >= this.track().duration - 0.2) this.position.set(0);
      this.startPlayback();
    }
  }

  private startPlayback(): void {
    this.pause();
    this.playing.set(true);
    let time = this.position(), lastChord = -1;
    const tick = () => {
      const track = this.track();
      const index = track.chords.findIndex(chord => time >= chord.start && time < chord.start + chord.duration);
      if (index >= 0 && index !== lastChord) {
        lastChord = index; this.selected.set(index);
        this.soundChord(track.chords[index], Math.min(track.chords[index].duration, 3));
      }
      this.position.set(time);
      time += 0.1;
      if (time >= track.duration) {
        if (this.loop()) { time = 0; lastChord = -1; }
        else { this.pause(); this.position.set(0); }
      }
    };
    this.clock = setInterval(tick, 100);
    tick();
  }

  pause(): void {
    this.playing.set(false); clearInterval(this.clock); this.clock = undefined; this.synth.stop();
  }

  restart(): void {
    this.pause(); this.position.set(0); this.selected.set(0);
  }

  seek(value: number): void {
    this.pause(); this.position.set(value);
    const index = this.track().chords.findIndex(chord => value >= chord.start && value < chord.start + chord.duration);
    if (index >= 0) this.selected.set(index);
  }

  setTranspose(value: number): void {
    this.transpose.set(Math.max(-6, Math.min(6, value)));
    if (this.playing()) this.startPlayback();
  }

  setInstrument(instrument: Instrument): void {
    this.instrument.set(instrument);
    if (this.playing()) this.startPlayback();
  }

  setVolume(volume: number): void {
    this.volume.set(volume); this.synth.setVolume(volume);
  }

  isBlackKey(note: number): boolean {
    return [1, 3, 6, 8, 10].includes(note % 12);
  }

  octave(note: number): number {
    return Math.floor(note / 12) + 4;
  }

  openModal(modal: Modal): void {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.modal.set(modal); document.body.style.overflow = 'hidden';
    afterNextRender(() => document.querySelector<HTMLButtonElement>('.modal-close')?.focus(), { injector: this.injector });
  }

  closeModal(): void {
    this.modal.set(null); document.body.style.overflow = ''; this.previousFocus?.focus();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !this.modal()) {
      event.preventDefault(); this.view.set('analyze'); this.inputMode.set('link');
      afterNextRender(() => this.linkInput()?.nativeElement.focus(), { injector: this.injector });
    }
    if (!this.modal()) return;
    if (event.key === 'Escape') this.closeModal();
    if (event.key !== 'Tab') return;
    const controls = [...document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('.modal button, .modal input')]
      .filter(control => !control.disabled);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  ngOnDestroy(): void {
    this.destroyed = true; this.pause(); clearTimeout(this.toastTimer);
    document.body.style.overflow = '';
  }
}
