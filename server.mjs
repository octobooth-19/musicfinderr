import express from 'express';
import { parseMusicLink, searchTerm } from './src/links.mjs';

const app = express();
const port = Number(process.env.PORT || 3000);
app.use(express.json({ limit: '8kb' }));

async function fetchJSON(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Music provider returned ${response.status}.`);
  return response.json();
}

app.post('/api/resolve', async (req, res) => {
  const link = parseMusicLink(req.body?.url);
  if (!link) return res.status(400).json({ error: 'Paste a valid YouTube video or Spotify track link.' });
  try {
    const endpoint = link.provider === 'youtube'
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(link.url)}&format=json`
      : `https://open.spotify.com/oembed?url=${encodeURIComponent(link.url)}`;
    const data = await fetchJSON(endpoint);
    let preview = null;
    try {
      const results = await fetchJSON(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm(data.title))}&entity=song&limit=5`);
      const terms = searchTerm(data.title).toLowerCase().split(/\s+/).filter(t => t.length > 2);
      preview = results.results?.find(song => {
        const name = `${song.trackName} ${song.artistName}`.toLowerCase();
        return song.previewUrl && terms.length > 0 && terms.filter(term => name.includes(term)).length / terms.length >= 0.65;
      }) || null;
    } catch (error) {
      console.warn('Preview lookup unavailable:', error.message);
    }
    return res.json({
      title: data.title,
      artist: preview?.artistName || data.author_name || 'Spotify track',
      artwork: preview?.artworkUrl100?.replace('100x100bb', '600x600bb') || data.thumbnail_url,
      source: link.provider,
      sourceUrl: link.url,
      preview: preview ? { url: `/api/preview?url=${encodeURIComponent(preview.previewUrl)}`, title: preview.trackName, artist: preview.artistName } : null,
    });
  } catch (error) {
    console.error('Link resolution failed:', error.message);
    res.status(502).json({ error: 'This track could not be reached. Check the link, try again, or upload an audio file instead.' });
  }
});

app.get('/api/preview', async (req, res) => {
  let url;
  try { url = new URL(req.query.url); } catch { return res.status(400).json({ error: 'Invalid preview URL.' }); }
  if (url.protocol !== 'https:' || !/^[a-z0-9.-]+\.itunes\.apple\.com$/.test(url.hostname) || url.port) {
    return res.status(400).json({ error: 'Only Apple Music preview audio is supported.' });
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw new Error(`Preview returned ${response.status}.`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 12 * 1024 * 1024) throw new Error('Preview is too large.');
    res.set('Content-Type', response.headers.get('content-type') || 'audio/mp4').send(buffer);
  } catch (error) {
    console.error('Preview download failed:', error.message);
    res.status(502).json({ error: 'The audio preview is unavailable. Upload an audio file to analyze this track.' });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('/{*path}', (_req, res) => res.sendFile(`${process.cwd()}/dist/index.html`));
}
app.listen(port, '0.0.0.0', () => console.log(`Keynote ${process.env.NODE_ENV === 'production' ? 'app' : 'API'} is ready at http://localhost:${port}`));
