import { Injectable, OnDestroy } from '@angular/core';
import type { Instrument } from './models';

@Injectable({ providedIn: 'root' })
export class AudioService implements OnDestroy {
  private context?: AudioContext;
  private master?: GainNode;
  private voices: OscillatorNode[] = [];
  private request = 0;

  async playNotes(notes: number[], instrument: Instrument, volume: number, duration = 1.1): Promise<void> {
    this.stop();
    const request = this.request;
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    const ctx = this.context;
    await ctx.resume();
    if (request !== this.request) return;
    if (!this.master) throw new Error('Audio output is unavailable.');
    this.master.gain.setValueAtTime(volume, ctx.currentTime);
    for (const [index, midi] of notes.entries()) {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = instrument === 'guitar' ? 'triangle' : 'sine';
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      const start = ctx.currentTime + index * (instrument === 'guitar' ? 0.035 : 0.008);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain); gain.connect(this.master);
      oscillator.start(start); oscillator.stop(start + duration + 0.05);
      this.voices.push(oscillator);
    }
  }

  setVolume(volume: number): void {
    if (this.context && this.master) this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.015);
  }

  stop(): void {
    this.request++;
    for (const voice of this.voices) voice.stop();
    this.voices = [];
  }

  ngOnDestroy(): void {
    this.stop();
    void this.context?.close();
  }
}
