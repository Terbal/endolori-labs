// Endolori Labs — minimal Express server
// Serves the static site and persists visit/video statistics to a JSON file
// acting as a lightweight database (data/stats.json).

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

function defaultStats() {
  return {
    pageViews: 0,
    videoPlays: 0,
    totalWatchSeconds: 0,
    langCounts: { en: 0, fr: 0 },
    themeCounts: { light: 0, dark: 0 },
    deviceCounts: { mobile: 0, desktop: 0 },
    firstVisit: null,
    lastVisit: null
  };
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATS_FILE)) {
    fs.writeFileSync(STATS_FILE, JSON.stringify(defaultStats(), null, 2));
  }
}
ensureDataFile();

function readStats() {
  try {
    const raw = fs.readFileSync(STATS_FILE, 'utf-8');
    return { ...defaultStats(), ...JSON.parse(raw) };
  } catch (e) {
    return defaultStats();
  }
}

// naive write queue to avoid concurrent write corruption under light traffic
let writeQueue = Promise.resolve();
function writeStats(stats) {
  writeQueue = writeQueue.then(() => {
    return fs.promises.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
  });
  return writeQueue;
}

function bumpPath(obj, dotPath, amount) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] || {};
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  cur[last] = (cur[last] || 0) + amount;
}

app.use(express.json());

// ---- API ----
app.get('/api/stats', (req, res) => {
  res.json(readStats());
});

app.post('/api/stats/bump', async (req, res) => {
  const { path: dotPath, amount } = req.body || {};
  if (typeof dotPath !== 'string' || !dotPath.length) {
    return res.status(400).json({ error: 'Missing "path" field.' });
  }
  const amt = typeof amount === 'number' && isFinite(amount) ? amount : 1;
  const stats = readStats();
  bumpPath(stats, dotPath, amt);
  const now = Date.now();
  if (!stats.firstVisit) stats.firstVisit = now;
  stats.lastVisit = now;
  await writeStats(stats);
  res.json(stats);
});

app.post('/api/stats/reset', async (req, res) => {
  const stats = defaultStats();
  await writeStats(stats);
  res.json(stats);
});

// ---- Static site ----
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/fortuna_major', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fortuna_major.html'));
});

app.listen(PORT, () => {
  console.log(`Endolori Labs server running on port ${PORT}`);
});
