/**
 * /api/observations?station=torbole|malcesine|bardolino|peschiera
 *
 * Serves historical wind observation logs from the data-log git branch.
 * Data lives at: github.com/cesareprimultini/garda-wind (data-log branch)
 *   data/{station}.ndjson  — one JSON object per line (NDJSON)
 *
 * Requires the GitHub repo to be public, OR set GITHUB_TOKEN env var for
 * private repos (add as a Vercel environment variable).
 *
 * Edge-cached for 30 min (s-maxage) with 1-hour stale-while-revalidate,
 * so GitHub is hit at most ~twice per hour per Vercel edge region.
 */

const REPO  = 'cesareprimultini/garda-wind';
const BRANCH = 'data-log';

const VALID_STATIONS = new Set(['torbole', 'malcesine', 'bardolino', 'peschiera']);

// Legacy: torbole data before per-station files were introduced
const LEGACY_FILE = 'data/observations.ndjson';

function rawUrl(path) {
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;
}

async function fetchNdjson(path) {
  const headers = { 'User-Agent': 'GardaWind/1.0' };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    // Use GitHub API for private repos
    const apiUrl = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`;
    const resp = await fetch(apiUrl, {
      headers: { ...headers, Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw' },
      signal: AbortSignal.timeout(15000),
    });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`GitHub API HTTP ${resp.status}`);
    return resp.text();
  }

  // Public repo: raw.githubusercontent.com (CDN-cached, no rate limit)
  const resp = await fetch(rawUrl(path), {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`GitHub raw HTTP ${resp.status}`);
  return resp.text();
}

function parseNdjson(text) {
  if (!text) return [];
  return text
    .split('\n')
    .filter(line => line.startsWith('{'))
    .map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);
}

export default async function handler(req, res) {
  const { station } = req.query;

  if (!station || !VALID_STATIONS.has(station)) {
    return res.status(400).json({ error: `Invalid station. Use: ${[...VALID_STATIONS].join(', ')}` });
  }

  try {
    // Try per-station file first; fall back to legacy file for torbole
    const perStationPath = `data/${station}.ndjson`;
    let text = await fetchNdjson(perStationPath);

    if (!text && station === 'torbole') {
      text = await fetchNdjson(LEGACY_FILE);
    }

    const rows = parseNdjson(text);

    // Normalise: older rows may lack a station field
    const data = rows.map(r => ({
      ...r,
      station: r.station ?? station,
    }));

    // Edge cache: fresh for 30 min, stale-while-revalidate for 1 hour
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
