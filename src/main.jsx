import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AudioLines, ArrowUpRight, ArrowRight, ArrowLeft, ChevronDown, ChevronRight, Plus, Minus,
  Search, Bookmark, Clock3, CircleHelp, Settings2, Link2, Upload, Play, Pause, SkipBack,
  Volume2, VolumeX, Repeat2, Check, X, Music2, Headphones, Sparkles, Download, ExternalLink,
  LoaderCircle, Disc3, Command, Menu, Guitar, Piano, CheckCircle2, Info, SlidersHorizontal,
} from 'lucide-react';
import { analyzeAudio, chordIntervals, chordName, DEMO, MAJOR_STEPS, MINOR_STEPS, NOTES, romanNumeral } from './music.mjs';
import { parseMusicLink } from './links.mjs';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';

const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const uid = () => crypto.randomUUID();

function YoutubeIcon({ size = 17 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M23 7a3 3 0 0 0-2.1-2.1C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7a31 31 0 0 0-.5 5A31 31 0 0 0 1 17a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5A3 3 0 0 0 23 17a31 31 0 0 0 .5-5A31 31 0 0 0 23 7ZM9.7 15.3V8.7l5.8 3.3Z"/></svg>;
}
function SpotifyIcon({ size = 17 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.8.8 0 0 1-1.1.3c-3-1.8-6.7-1.4-9.2-.8a.8.8 0 1 1-.4-1.5c2.8-.7 6.9-1.1 10.4.9.4.2.5.7.3 1.1Zm1.5-3.1a1 1 0 0 1-1.3.3c-3.3-2-8.1-2.3-11.9-1.2a1 1 0 0 1-.6-1.8c4.3-1.3 9.6-.9 13.5 1.4.4.3.6.9.3 1.3Zm.1-3.2C15.2 8.7 8.8 8.5 5.1 9.6a1.1 1.1 0 0 1-.7-2.1c4.3-1.3 11.4-1.1 15.8 1.5a1.1 1.1 0 1 1-1.1 2Z"/></svg>;
}
function AlbumArt({ small = false, artwork }) {
  if (artwork) return <img className={`album-art ${small ? 'small' : ''}`} src={artwork} alt="Track artwork" referrerPolicy="no-referrer" />;
  return <div className={`album-art ${small ? 'small' : ''}`} aria-label="Rumours inspired album artwork"><div className="album-title">FLEETWOOD MAC<span>RUMOURS</span></div><div className="art-moon"/><div className="art-person one"/><div className="art-person two"/><div className="art-line"/></div>;
}

function App() {
  const [view, setView] = useState('analyze');
  const [track, setTrack] = useState(DEMO);
  const [url, setUrl] = useState('');
  const [inputMode, setInputMode] = useState('link');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [transpose, setTranspose] = useState(0);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audition, setAudition] = useState(null);
  const [position, setPosition] = useState(0);
  const [loop, setLoop] = useState(true);
  const [volume, setVolume] = useState(0.55);
  const [instrument, setInstrument] = useState('piano');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [library, setLibrary] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('keynote-library') || '[]'); return Array.isArray(saved) ? saved.filter(t => t.id && t.title && Array.isArray(t.chords)) : []; } catch { return []; }
  });
  const [history, setHistory] = useState([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const fileInput = useRef(null), linkInput = useRef(null), audioContext = useRef(null);
  const voices = useRef([]), clock = useRef(null), volumeRef = useRef(volume);
  const currentKey = (track.key + transpose + 12) % 12;
  const activeChord = track.chords[selected] || track.chords[0];
  const isSaved = library.some(t => t.id === track.id);

  function notify(message) { setToast(message); }
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => {
    const handler = event => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault(); setView('analyze'); linkInput.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!modal) return;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const handler = event => {
      if (event.key === 'Escape') setModal(null);
      if (event.key !== 'Tab') return;
      const buttons = [...document.querySelectorAll('.modal button, .modal input')].filter(el => !el.disabled);
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', handler); previousFocus?.focus(); };
  }, [modal]);

  function stopVoices() {
    voices.current.forEach(voice => { try { voice.stop(); } catch { /* Already ended. */ } });
    voices.current = [];
  }
  function playNotes(notes, duration = 1.1) {
    if (!audioContext.current || audioContext.current.state === 'closed') audioContext.current = new AudioContext();
    const ctx = audioContext.current;
    ctx.resume().catch(() => notify('Enable audio in your browser to hear chords.'));
    stopVoices();
    notes.forEach((midi, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = instrument === 'guitar' ? 'triangle' : 'sine';
      osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      const start = ctx.currentTime + i * (instrument === 'guitar' ? 0.035 : 0.008);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volumeRef.current * 0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(start); osc.stop(start + duration + 0.05);
      voices.current.push(osc);
    });
  }
  function soundChord(chord, duration = 1.1) {
    const root = chord.root + transpose;
    playNotes([root + 48, ...chordIntervals(chord.quality).map(n => n + root + 60)], duration);
  }
  function previewNote(midi) {
    setPlaying(false); setAudition({ note: midi });
  }
  useEffect(() => {
    if (!playing) { clearInterval(clock.current); stopVoices(); return; }
    let time = position;
    let lastChord = -1;
    const tick = () => {
      const index = track.chords.findIndex(chord => time >= chord.start && time < chord.start + chord.duration);
      if (index >= 0 && index !== lastChord) {
        lastChord = index; setSelected(index);
        soundChord(track.chords[index], Math.min(track.chords[index].duration, 3));
      }
      setPosition(time);
      time += 0.1;
      if (time >= track.duration) {
        if (loop) { time = 0; lastChord = -1; }
        else { setPlaying(false); setPosition(0); }
      }
    };
    tick(); clock.current = setInterval(tick, 100);
    return () => { clearInterval(clock.current); stopVoices(); };
  }, [playing, track, transpose, loop, instrument]);
  useEffect(() => {
    if (audition?.note !== undefined) playNotes([audition.note], 0.8);
    else if (audition) soundChord(audition);
  }, [audition]);
  useEffect(() => () => { clearInterval(clock.current); stopVoices(); audioContext.current?.close(); }, []);

  function loadTrack(next) {
    setPlaying(false); setPosition(0); setSelected(0); setTranspose(0); setTrack(next);
    setPending(null); setError(''); setView('analyze');
  }
  async function processAudio(buffer, metadata) {
    const result = await analyzeAudio(buffer, setBusy);
    const next = { ...metadata, ...result, id: uid(), bpm: null, meter: null };
    loadTrack(next);
    setHistory(previous => [next, ...previous].slice(0, 12));
    notify('Your analysis is ready. Let’s find your sound.');
  }
  async function handleLink(event) {
    event.preventDefault();
    if (!parseMusicLink(url)) { setError('Add a valid YouTube video or Spotify track link to get started.'); return; }
    setError(''); setPending(null); setBusy('Finding your track…'); setPlaying(false);
    try {
      const response = await fetch('/api/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!data.preview) {
        setPending(data);
        notify('Track found. Add an audio file to reveal its key and chords.');
      } else {
        setBusy('Loading a 30-second preview…');
        const audio = await fetch(data.preview.url);
        if (!audio.ok) throw new Error((await audio.json()).error);
        await processAudio(await audio.arrayBuffer(), { ...data, title: data.preview.title, artist: data.preview.artist, source: 'preview' });
      }
    } catch (err) { setError(err.message || 'Analysis failed. Please try again.'); }
    finally { setBusy(''); }
  }
  async function handleFile(file) {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('audio/') && !/\.(wav|mp3|m4a|ogg|flac|aac)$/i.test(file.name)) {
      setError('Choose an audio file: MP3, WAV, M4A, OGG, or FLAC.'); return;
    }
    if (file.size > 40 * 1024 * 1024) { setError('This file is over 40 MB. Please upload a smaller file.'); return; }
    setBusy('Reading your audio…'); setPlaying(false);
    try {
      await processAudio(await file.arrayBuffer(), pending
        ? { ...pending, source: 'upload' }
        : { title: file.name.replace(/\.[^.]+$/, ''), artist: 'Your audio', source: 'upload' });
    } catch (err) { setError(err.message?.includes('decode') ? 'Your browser couldn’t read this audio. Try an MP3 or WAV file.' : err.message); }
    finally { setBusy(''); if (fileInput.current) fileInput.current.value = ''; }
  }
  function saveTrack() {
    const next = isSaved ? library.filter(t => t.id !== track.id) : [track, ...library];
    try { localStorage.setItem('keynote-library', JSON.stringify(next)); setLibrary(next); notify(isSaved ? 'Removed from your library.' : 'Saved to your library.'); }
    catch { notify('Your browser storage is full. This track could not be saved.'); }
  }
  function exportTrack() {
    const rows = [
      `${track.title} — ${track.artist}`, `Key: ${NOTES[currentKey]} ${track.mode}`,
      `Source: ${track.source === 'demo' ? 'Illustrative demo, not an audio analysis' : track.source === 'preview' ? '30-second matched preview; may differ from linked recording' : 'Uploaded audio, first 90 seconds maximum'}`,
      '', 'Start\tDuration\tChord\tDegree',
      ...track.chords.map(chord => `${formatTime(chord.start)}\t${chord.duration.toFixed(1)}s\t${chordName(chord, transpose)}\t${romanNumeral(chord, track.key, track.mode)}`),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/plain' });
    const objectUrl = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = objectUrl; a.download = `${track.title.replace(/[^a-z0-9 -]/gi, '')}-chords.txt`; a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); notify('Your chord sheet is downloaded.');
  }
  function chooseChord(index) {
    setPlaying(false); setSelected(index); setPosition(track.chords[index].start); setAudition({ ...track.chords[index] });
  }
  function navigate(next) { setView(next); setMobileNav(false); setPlaying(false); }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
      <a className="brand" href="/" onClick={event => { event.preventDefault(); navigate('analyze'); }}><span className="brand-mark"><AudioLines size={23}/></span>keynote<span className="brand-dot">.</span></a>
      <div className="workspace-label">YOUR WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={view === 'analyze' ? 'active' : ''} onClick={() => navigate('analyze')}><AudioLines size={19}/>Song analyzer<span className="nav-active-dot"/></button>
        <button className={view === 'library' ? 'active' : ''} onClick={() => navigate('library')}><Bookmark size={18}/>My library{library.length > 0 && <span className="nav-count">{library.length}</span>}</button>
        <button className={view === 'history' ? 'active' : ''} onClick={() => navigate('history')}><Clock3 size={18}/>Recent analyses</button>
      </nav>
      <div className="sidebar-collection">
        <div className="collection-heading">A LITTLE INSPIRATION <Sparkles size={13}/></div>
        <button className="demo-link" onClick={() => { loadTrack(DEMO); setMobileNav(false); }}><span className="tiny-album"><Disc3 size={16}/></span><span>Start with a classic<small>Explore a sample analysis</small></span><ArrowUpRight size={14}/></button>
      </div>
      <div className="sidebar-bottom">
        <div className="made-for"><span className="headphone-bubble"><Headphones size={20}/></span><h3>Less guessing.<br/>More playing.</h3><p>Your next musical lightbulb<br/>moment starts here.</p><span className="mini-soundwave">{Array.from({ length: 27 }, (_, i) => <i key={i} style={{ height: `${7 + Math.sin(i * 1.7) ** 2 * 22}px` }}/>)}</span></div>
        <button className="bottom-link" onClick={() => setModal('help')}><CircleHelp size={18}/>How it works<ArrowUpRight size={14}/></button>
        <div className="profile"><div className="avatar">J</div><div>Just you & the music<small>Personal workspace</small></div><Settings2 size={17} onClick={() => setModal('settings')} role="button" aria-label="Playback settings" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setModal('settings')}/></div>
      </div>
    </aside>
    {mobileNav && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <main>
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{view === 'analyze' ? 'Song analyzer' : view === 'library' ? 'My library' : 'Recent analyses'}</strong></div><div className="topbar-right"><span className="status-dot"/>A little theory. A lot of possibility.<button className="help-button" aria-label="About Keynote" onClick={() => setModal('help')}><CircleHelp size={18}/></button></div></header>
      <div className="page-content">
        {view === 'analyze' ? <>
          <section className="intro"><div className="eyebrow"><span/>TUNE IN TO WHAT’S UNDERNEATH</div><h1>Every song has a <span>little secret.</span></h1><p>Find its key. Uncover the chords. Make it your own.</p></section>
          <section className="intake-card">
            <div className="input-tabs"><button className={inputMode === 'link' ? 'selected' : ''} onClick={() => { setInputMode('link'); setError(''); }}><Link2 size={16}/>Paste a song link</button><button className={inputMode === 'upload' ? 'selected' : ''} onClick={() => { setInputMode('upload'); setError(''); }}><Upload size={15}/>Upload audio</button><span className="private-note"><span className="status-dot"/>No sign-up. Just music.</span></div>
            {inputMode === 'link' ? <form onSubmit={handleLink}><div className={`link-field ${error ? 'has-error' : ''}`}><Link2 size={20}/><input ref={linkInput} type="text" aria-label="YouTube or Spotify song link" placeholder="Drop a YouTube or Spotify link here…" value={url} onChange={event => { setUrl(event.target.value); setError(''); }} disabled={!!busy}/><span className="keyboard-hint"><Command size={11}/> K</span><button className="primary-button analyze-button" disabled={!!busy || !url.trim()}>{busy ? <><LoaderCircle size={16} className="spin"/>Analyzing</> : <>Find my key<ArrowRight size={17}/></>}</button></div><div className="input-footer"><span>Good music starts with a little curiosity.</span><div className="provider-label youtube"><YoutubeIcon size={15}/>YouTube</div><div className="provider-label spotify"><SpotifyIcon size={14}/>Spotify</div></div></form>
              : <button className="upload-zone" disabled={!!busy} onClick={() => fileInput.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) handleFile(e.dataTransfer.files[0]); }}><span className="upload-circle"><Upload size={20}/></span><strong>Drop your track here, or <em>browse files</em></strong><span>MP3, WAV, M4A, OGG or FLAC · Up to 40 MB · Analyzed on your device</span></button>}
            <input ref={fileInput} hidden type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.aac" onChange={event => handleFile(event.target.files[0])}/>
            {busy && <div className="analysis-progress" role="status"><LoaderCircle size={14} className="spin"/>{busy}<span>Listening for the little details</span></div>}
            {error && <div className="error-message" role="alert"><Info size={16}/>{error}</div>}
            {pending && <div className="pending-track"><Music2 size={22}/><div><strong>{pending.title}</strong><p>Track found. A playable preview isn’t available. Upload audio you have permission to use to analyze this recording.</p></div><button className="secondary-button" onClick={() => fileInput.current?.click()} disabled={!!busy}><Upload size={15}/>Add audio</button></div>}
          </section>

          <div className="section-title"><h2>Your song, <span>decoded.</span></h2><span className="example-tag"><span/>{track.source === 'demo' ? 'EXAMPLE ANALYSIS' : track.source === 'preview' ? 'PREVIEW ANALYSIS' : 'AUDIO ANALYSIS'}</span></div>
          <section className="result-overview">
            <div className="track-info"><AlbumArt artwork={track.artwork}/><div className="track-copy"><span className="track-source">{track.source === 'demo' ? <><SpotifyIcon size={13}/>THE CLASSICS COLLECTION</> : track.source === 'preview' ? <><Headphones size={13}/>30-SECOND PREVIEW</> : <><AudioLines size={13}/>YOUR AUDIO</>}</span><h2>{track.title}</h2><p>{track.artist}</p><small>{track.album ? `${track.album} · ${track.year}` : `${formatTime(track.fullDuration)} · ${track.source === 'preview' ? 'Matched preview' : 'Local analysis'}`}</small></div></div>
            <div className="overview-right"><span className="complete-tag"><CheckCircle2 size={13}/>{track.source === 'demo' ? 'Ready to explore' : 'Analysis complete'}</span><button className={`secondary-button save-button ${isSaved ? 'saved' : ''}`} onClick={saveTrack}>{isSaved ? <Check size={15}/> : <Bookmark size={15}/>}<span>{isSaved ? 'Saved to library' : 'Save to library'}</span></button></div>
          </section>
          {track.source === 'preview' && <div className="preview-disclaimer"><Info size={14}/><p>Analyzed a matched 30-second preview. It may be a different version from your link.</p><a href={track.sourceUrl} target="_blank" rel="noreferrer">Original track<ExternalLink size={12}/></a></div>}
          <section className="metrics-grid">
            <div className="metric key-metric"><div className="metric-label"><span><Music2 size={15}/>MUSICAL KEY</span><Info size={14}><title>Estimated tonal center</title></Info></div><div className="key-value">{NOTES[currentKey]} <span>{track.mode}</span><span className="key-note">♮</span></div><div className="key-caption"><span className="coral-dot"/>{transpose ? `Transposed ${transpose > 0 ? '+' : ''}${transpose} semitones` : 'The heart of your song'}</div></div>
            <div className="metric"><div className="metric-label"><span><AudioLines size={15}/>TEMPO</span></div><div className="metric-value">{track.bpm || '—'}<span>BPM</span></div><div className="metric-caption">{track.bpm ? 'A steady, easy-going groove' : 'Tempo not estimated'}</div></div>
            <div className="metric"><div className="metric-label"><span><Clock3 size={15}/>TIME SIGNATURE</span></div><div className="metric-value">{track.meter || '—'}<span>{track.meter ? 'time' : ''}</span></div><div className="metric-caption">{track.meter ? 'Four beats. Endless possibilities.' : 'Listen for the beat'}</div></div>
            <div className="metric confidence-metric"><div className="metric-label"><span><Sparkles size={15}/>{track.source === 'demo' ? 'ILLUSTRATIVE RESULT' : 'KEY PROFILE MATCH'}</span></div><div className="metric-value">{track.confidence}<span>%</span><span className="confidence-status">{track.confidence >= 80 ? 'Strong match' : 'Best estimate'}</span></div><div className="confidence-track"><span style={{ width: `${track.confidence}%` }}/></div><div className="metric-caption">{track.source === 'demo' ? 'Curated demo · not a live analysis' : 'Tonal fit, not a certainty score'}</div></div>
          </section>

          <section className="chord-section panel">
            <div className="panel-heading"><div><h2>Follow the progression<span className="tiny-badge">{track.chords.length} chords</span></h2><p>The building blocks of the song. Click a chord to hear it.</p></div><button className="text-button export-button" onClick={exportTrack}><Download size={15}/><span>Export chords</span></button></div>
            <div className="progression-toolbar"><div className="segmented-control"><button className={instrument === 'piano' ? 'active' : ''} onClick={() => setInstrument('piano')}><Piano size={15}/>Piano</button><button className={instrument === 'guitar' ? 'active' : ''} onClick={() => setInstrument('guitar')}><Guitar size={15}/>Guitar</button></div><div className="transpose"><span>Transpose</span><div className="stepper"><button aria-label="Transpose down" disabled={transpose <= -6} onClick={() => setTranspose(t => t - 1)}><Minus size={13}/></button><span>{transpose > 0 ? '+' : ''}{transpose}</span><button aria-label="Transpose up" disabled={transpose >= 6} onClick={() => setTranspose(t => t + 1)}><Plus size={13}/></button></div><span className="semitone-label">semitones</span>{transpose !== 0 && <button className="reset-transpose" onClick={() => setTranspose(0)}>Reset</button>}</div></div>
            <div className={`chord-grid ${track.chords.length > 8 ? 'many-chords' : ''}`}>
              {track.chords.map((chord, i) => <button key={`${i}-${chord.root}`} className={`chord-card ${selected === i ? 'active' : ''}`} onClick={() => chooseChord(i)} aria-label={`Play ${chordName(chord, transpose)} chord ${i + 1}`}><span className="chord-index">{String(i + 1).padStart(2, '0')}{selected === i && <span className={`chord-playing ${playing ? 'animated' : ''}`}><i/><i/><i/></span>}</span><strong>{chordName(chord, transpose)}</strong><span className="chord-roman">{romanNumeral(chord, track.key, track.mode)}</span><div className="chord-bottom"><span>{track.source === 'demo' ? '1 bar' : `${chord.duration.toFixed(0)}s`}</span><span className="chord-preview"><Play size={9} fill="currentColor"/></span></div></button>)}
            </div>
            <div className="timeline"><div className="timeline-top"><span>{formatTime(position)}</span><span>{track.source === 'demo' ? 'Illustrative chorus · 8 bars' : `${track.duration.toFixed(0)} seconds analyzed`}</span><span>{formatTime(track.duration)}</span></div><input type="range" min="0" max={Math.max(0.1, track.duration - 0.1)} step="0.1" value={position} aria-label="Progression playback position" style={{ '--progress': `${position / track.duration * 100}%` }} onChange={event => { const time = Number(event.target.value); setPlaying(false); setPosition(time); const index = track.chords.findIndex(c => time >= c.start && time < c.start + c.duration); if (index >= 0) setSelected(index); }}/></div>
            <div className="player-controls"><div className="synth-label"><span className="status-dot"/>{instrument === 'piano' ? 'Soft piano' : 'Acoustic synth'}<span className="synth-label-extra">· Chord preview</span></div><div className="transport"><button className={`icon-button loop-button ${loop ? 'enabled' : ''}`} aria-label={loop ? 'Disable loop' : 'Enable loop'} aria-pressed={loop} onClick={() => setLoop(!loop)}><Repeat2 size={17}/></button><button className="icon-button" aria-label="Restart progression" onClick={() => { setPlaying(false); setPosition(0); setSelected(0); }}><SkipBack size={17} fill="currentColor"/></button><button className={`play-button ${playing ? 'is-playing' : ''}`} aria-label={playing ? 'Pause progression' : 'Play progression'} onClick={() => { if (position >= track.duration - 0.2) setPosition(0); setPlaying(!playing); }}>{playing ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</button><span className="play-label">{playing ? 'Pause progression' : 'Play progression'}</span></div><div className="volume-control"><button className="icon-button" aria-label={volume ? 'Mute' : 'Unmute'} onClick={() => setVolume(volume ? 0 : 0.55)}>{volume ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button><input type="range" min="0" max="1" step="0.01" value={volume} aria-label="Volume" onChange={e => setVolume(Number(e.target.value))}/></div></div>
          </section>

          <div className="bottom-grid"><section className="scale-panel panel"><div className="panel-heading"><div><h2>A little key context</h2><p>Meet the notes that feel right at home.</p></div><span className="scale-key">{NOTES[currentKey]} {track.mode}</span></div><div className="scale-notes">{(track.mode === 'minor' ? MINOR_STEPS : MAJOR_STEPS).map((step, i) => <button key={step} onClick={() => previewNote(60 + currentKey + step)} aria-label={`Hear ${NOTES[(currentKey + step) % 12]}`}><span className={i === 0 ? 'root-note' : ''}>{NOTES[(currentKey + step) % 12]}</span><small>{i + 1}</small></button>)}</div><div className="context-tip"><span className="small-sparkle"><Sparkles size={14}/></span><p>{track.source === 'demo' ? <>That dreamy feeling? It’s the <strong>{chordName(track.chords[0], transpose)}–{chordName(track.chords[1], transpose)} loop</strong>, floating between two major chords.</> : <>Try landing on <strong>{NOTES[currentKey]}</strong> when you improvise. It’s your musical home base.</>}</p></div></section>
            <section className="explore-panel"><span className="explore-decoration">♬</span><span className="eyebrow">FROM LISTENING TO PLAYING</span><h2>Don’t just hear it.<br/>Get your hands on it.</h2><p>{instrument === 'piano' ? 'See how the chords come together on the keys.' : 'Explore the notes that make up each chord.'}</p><button onClick={() => setModal('instrument')}>Explore on {instrument === 'piano' ? 'piano' : 'guitar'}<ArrowUpRight size={17}/></button></section></div>
          <footer className="page-footer"><span><AudioLines size={14}/>Made for the way you hear music.</span><span>{track.source === 'demo' ? 'Sample results are illustrative. Upload audio for a real analysis.' : 'Estimates can vary with recordings. Trust your ears, too.'}<span className="footer-flower">✳</span></span></footer>
        </> : <section className="library-page"><div className="eyebrow"><span/>YOUR MUSICAL NOTEBOOK</div><h1>{view === 'library' ? 'Good finds. Kept close.' : 'Where your ears have been.'}</h1><p>{view === 'library' ? 'All your saved discoveries, ready for another listen.' : 'The tracks you’ve explored in this session.'}</p><div className="library-toolbar"><div><Search size={17}/><input aria-label="Search tracks" placeholder="Find a song or artist…" value={librarySearch} onChange={e => setLibrarySearch(e.target.value)}/></div><button className="primary-button" onClick={() => navigate('analyze')}><Plus size={16}/>New analysis</button></div>{(view === 'library' ? library : history).length === 0 ? <div className="empty-library"><span><Bookmark size={31}/></span><h2>{view === 'library' ? 'Your next favorite starts here.' : 'A fresh pair of ears.'}</h2><p>{view === 'library' ? 'Save a song from the analyzer and it’ll be waiting right here.' : 'Analyze a link or upload audio to start your listening history.'}</p><button className="secondary-button" onClick={() => navigate('analyze')}>Explore a song<ArrowRight size={16}/></button></div> : <div className="saved-tracks">{(view === 'library' ? library : history).filter(t => `${t.title} ${t.artist}`.toLowerCase().includes(librarySearch.toLowerCase())).map(t => <button key={t.id} onClick={() => loadTrack(t)}><AlbumArt small artwork={t.artwork}/><span><strong>{t.title}</strong><small>{t.artist}</small></span><span className="saved-key">{NOTES[t.key]} {t.mode}</span><ChevronRight size={18}/></button>)}{!(view === 'library' ? library : history).some(t => `${t.title} ${t.artist}`.toLowerCase().includes(librarySearch.toLowerCase())) && <p className="no-results">No tracks match “{librarySearch}”.</p>}</div>}</section>}
      </div>
    </main>
    {toast && <div className="toast" role="status"><CheckCircle2 size={18}/>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15}/></button></div>}
    {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><section className={`modal ${modal === 'instrument' ? 'instrument-modal' : ''}`} role="dialog" aria-modal="true" aria-label={modal === 'help' ? 'How Keynote works' : modal === 'settings' ? 'Playback settings' : 'Explore chords'} onClick={e => e.stopPropagation()}><button autoFocus className="modal-close icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={20}/></button>
      {modal === 'help' ? <><span className="modal-icon"><AudioLines size={27}/></span><div className="eyebrow">A LITTLE THEORY. A LOT OF POSSIBILITY.</div><h2>Meet your song’s other side.</h2><p>Keynote turns your musical curiosity into something you can play.</p><div className="help-steps"><div><span>01</span><div><h3>Bring a song</h3><p>Paste a YouTube or Spotify track link. When available, we find a matching 30-second audio preview. Or upload your own audio, analyzed privately in your browser.</p></div></div><div><span>02</span><div><h3>Find the musical fingerprint</h3><p>We estimate the key and chord changes from the audio’s pitch content. The first 90 seconds of uploads are analyzed. Tempo and meter are shown only in the curated demo.</p></div></div><div><span>03</span><div><h3>Make it yours</h3><p>Click chords, loop the synth progression, change instruments, or transpose to a key that suits you. Save your discoveries locally or export a chord sheet.</p></div></div></div><div className="modal-note"><Info size={17}/><p>Streaming links don’t grant full audio access. Preview matches may be different versions. Automated key and chord estimates can be imperfect, especially for complex recordings.</p></div><button className="primary-button modal-primary" onClick={() => setModal(null)}>Let’s make some music<ArrowRight size={17}/></button></>
        : modal === 'settings' ? <><span className="modal-icon"><SlidersHorizontal size={27}/></span><h2>Your sound, your setup.</h2><p>Fine-tune the chord preview. Everything stays on your device.</p><label className="settings-row">Preview volume<input type="range" aria-label="Preview volume" min="0" max="1" step=".01" value={volume} onChange={e => setVolume(Number(e.target.value))}/><span>{Math.round(volume * 100)}%</span></label><div className="settings-row">Instrument<div className="segmented-control"><button className={instrument === 'piano' ? 'active' : ''} onClick={() => setInstrument('piano')}>Piano</button><button className={instrument === 'guitar' ? 'active' : ''} onClick={() => setInstrument('guitar')}>Guitar</button></div></div><label className="settings-row">Loop progression<input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)}/></label><p className="settings-privacy">Your saved library is stored in this browser, not in an account.</p></>
          : <>
            <div className="eyebrow">GET YOUR HANDS ON IT</div>
            <h2>A closer look at <span className="coral-text">{chordName(activeChord, transpose)}</span>.</h2>
            <p>{chordIntervals(activeChord.quality).map(n => NOTES[(activeChord.root + transpose + n + 12) % 12]).join(' · ')}<span className="modal-chord-kind">{activeChord.quality} triad</span></p>
            <div className="modal-chord-picker">
              {track.chords.filter((c, i, a) => a.findIndex(v => v.root === c.root && v.quality === c.quality) === i).map(c =>
                <button key={`${c.root}-${c.quality}`} className={c.root === activeChord.root && c.quality === activeChord.quality ? 'active' : ''} onClick={() => chooseChord(track.chords.findIndex(v => v === c))}>{chordName(c, transpose)}</button>
              )}
            </div>
            {instrument === 'piano' ? <div className="piano-keyboard">
              {Array.from({ length: 24 }, (_, i) => {
                const black = [1, 3, 6, 8, 10].includes(i % 12);
                const lit = chordIntervals(activeChord.quality).map(n => (activeChord.root + transpose + n + 12) % 12).includes(i % 12);
                return <button key={i} className={`${black ? 'black-key' : 'white-key'} ${lit ? 'lit' : ''}`} aria-label={`Play ${NOTES[i % 12]} octave ${Math.floor(i / 12) + 4}`} onClick={() => previewNote(60 + i)}><span>{NOTES[i % 12]}</span></button>;
              })}
            </div> : <div className="guitar-fretboard">
              {[64, 59, 55, 50, 45, 40].map((open, string) => <div key={string} className="guitar-string">
                <span>{NOTES[open % 12]}</span>
                {Array.from({ length: 6 }, (_, fret) =>
                  <button key={fret} aria-label={`String ${string + 1} fret ${fret}: ${NOTES[(open + fret) % 12]}`} className={chordIntervals(activeChord.quality).map(n => (activeChord.root + transpose + n + 12) % 12).includes((open + fret) % 12) ? 'lit' : ''} onClick={() => previewNote(open + fret)}><span>{NOTES[(open + fret) % 12]}</span></button>
                )}
              </div>)}
            </div>}
            <button className="primary-button modal-primary" onClick={() => { setPlaying(false); setAudition({ ...activeChord }); }}><Play size={16} fill="currentColor"/>Hear {chordName(activeChord, transpose)}</button>
            <div className="modal-note"><Info size={16}/><p>{instrument === 'piano' ? 'Highlighted keys are the notes in this chord. Tap any key to explore.' : 'Highlighted notes belong to this chord. Tap to hear each note. This is a note map, not a fingering diagram.'}</p></div>
          </>}
    </section></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
