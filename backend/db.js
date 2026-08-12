// db.js — storage abstraction layer.
//
// If the FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
// environment variables are set, this uses Google Firestore (a free, external
// database that survives Render restarts/redeploys — see README.md for setup).
//
// Otherwise, it transparently falls back to local JSON files under data/,
// exactly like before. The rest of the app (server.js) never needs to know
// which backend is active — it just calls getStats(), bumpStats(), etc.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const STATS_FILE = path.join(DATA_DIR, "stats.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

function defaultStats() {
  return {
    pageViews: 0,
    videoPlays: 0,
    totalWatchSeconds: 0,
    langCounts: { en: 0, fr: 0 },
    themeCounts: { light: 0, dark: 0 },
    deviceCounts: { mobile: 0, desktop: 0 },
    firstVisit: null,
    lastVisit: null,
  };
}

function bumpPath(obj, dotPath, amount) {
  const parts = dotPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] || {};
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  cur[last] = (cur[last] || 0) + amount;
  return obj;
}

const useFirestore = !!(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

let db = null;

if (useFirestore) {
  const admin = require("firebase-admin");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,

      // Render (and most dashboards) can't store real newlines in env vars,
      // so the private key is stored with literal "\n" and unescaped here.
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });

  db = admin.firestore();

  console.log(
    "[db] Firebase env vars detected — using Firestore for persistent storage.",
  );
} else {
  console.log(
    "[db] No Firebase env vars set — using local JSON files under data/. See README.md to switch to Firestore.",
  );

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STATS_FILE)) {
    fs.writeFileSync(STATS_FILE, JSON.stringify(defaultStats(), null, 2));
  }

  if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, "[]");
  }
}

// ---------- local JSON fallback helpers ----------

let statsWriteQueue = Promise.resolve();

function jsonReadStats() {
  try {
    return {
      ...defaultStats(),
      ...JSON.parse(fs.readFileSync(STATS_FILE, "utf-8")),
    };
  } catch (e) {
    return defaultStats();
  }
}

function jsonWriteStats(stats) {
  statsWriteQueue = statsWriteQueue.then(() =>
    fs.promises.writeFile(STATS_FILE, JSON.stringify(stats, null, 2)),
  );

  return statsWriteQueue;
}

let leadsWriteQueue = Promise.resolve();

function jsonReadLeads() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LEADS_FILE, "utf-8"));

    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function jsonWriteLeads(leads) {
  leadsWriteQueue = leadsWriteQueue.then(() =>
    fs.promises.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2)),
  );

  return leadsWriteQueue;
}

// ---------- Public API — same shape regardless of the active backend ----------

async function getStats() {
  if (useFirestore) {
    const doc = await db.collection("meta").doc("stats").get();

    return doc.exists ? { ...defaultStats(), ...doc.data() } : defaultStats();
  }

  return jsonReadStats();
}

async function bumpStats(dotPath, amount) {
  if (useFirestore) {
    const ref = db.collection("meta").doc("stats");

    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);

      const stats = doc.exists
        ? { ...defaultStats(), ...doc.data() }
        : defaultStats();

      bumpPath(stats, dotPath, amount);

      const now = Date.now();

      if (!stats.firstVisit) {
        stats.firstVisit = now;
      }

      stats.lastVisit = now;

      tx.set(ref, stats);

      return stats;
    });
  }

  const stats = jsonReadStats();

  bumpPath(stats, dotPath, amount);

  const now = Date.now();

  if (!stats.firstVisit) {
    stats.firstVisit = now;
  }

  stats.lastVisit = now;

  await jsonWriteStats(stats);

  return stats;
}

async function resetStats() {
  const stats = defaultStats();

  if (useFirestore) {
    await db.collection("meta").doc("stats").set(stats);
  } else {
    await jsonWriteStats(stats);
  }

  return stats;
}

async function getLeads() {
  if (useFirestore) {
    const snap = await db
      .collection("leads")
      .orderBy("createdAt", "desc")
      .get();

    return snap.docs.map((d) => d.data());
  }

  return jsonReadLeads();
}

async function addLead(lead) {
  if (useFirestore) {
    await db.collection("leads").doc(lead.id).set(lead);

    return lead;
  }

  const leads = jsonReadLeads();

  leads.push(lead);

  await jsonWriteLeads(leads);

  return lead;
}

async function updateLead(id, updates) {
  if (useFirestore) {
    const ref = db.collection("leads").doc(id);

    const doc = await ref.get();

    if (!doc.exists) {
      return null;
    }

    await ref.set(updates, { merge: true });

    const updatedDoc = await ref.get();

    return updatedDoc.data();
  }

  const leads = jsonReadLeads();

  const idx = leads.findIndex((l) => l.id === id);

  if (idx === -1) {
    return null;
  }

  leads[idx] = {
    ...leads[idx],
    ...updates,
  };

  await jsonWriteLeads(leads);

  return leads[idx];
}

async function deleteLead(id) {
  if (useFirestore) {
    await db.collection("leads").doc(id).delete();

    return true;
  }

  const leads = jsonReadLeads();

  const filtered = leads.filter((l) => l.id !== id);

  await jsonWriteLeads(filtered);

  return true;
}

module.exports = {
  getStats,
  bumpStats,
  resetStats,
  getLeads,
  addLead,
  updateLead,
  deleteLead,
  useFirestore,
};
