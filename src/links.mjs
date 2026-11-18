export function parseMusicLink(input) {
  try {
    const url = new URL(input.trim());
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, '');
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
      const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
      return /^[\w-]{11}$/.test(id || '') ? { provider: 'youtube', url: `https://www.youtube.com/watch?v=${id}` } : null;
    }
    if (host === 'open.spotify.com') {
      const id = url.pathname.match(/^\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]{22})\/?$/)?.[1];
      return id ? { provider: 'spotify', url: `https://open.spotify.com/track/${id}` } : null;
    }
    return null;
  } catch { return null; }
}

export function searchTerm(title) {
  return title.replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/official|music video|lyrics|audio| - topic/gi, '').replace(/\s+/g, ' ').trim();
}
