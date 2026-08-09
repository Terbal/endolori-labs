// Endolori Labs — minimal Express server
// Serves the static site and persists visit/video statistics AND lead
// submissions to JSON files acting as a lightweight database.

const express = require("express");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const STATS_FILE = path.join(DATA_DIR, "stats.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

const NOTIFY_EMAIL = "joelmoyo249@gmail.com";

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

function ensureDataFile(file, defaultContent) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultContent, null, 2));
  }
}
ensureDataFile(STATS_FILE, defaultStats());
ensureDataFile(LEADS_FILE, []);

function readStats() {
  try {
    const raw = fs.readFileSync(STATS_FILE, "utf-8");
    return { ...defaultStats(), ...JSON.parse(raw) };
  } catch (e) {
    return defaultStats();
  }
}

function readLeads() {
  try {
    const raw = fs.readFileSync(LEADS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// naive write queues to avoid concurrent write corruption under light traffic
let statsWriteQueue = Promise.resolve();
function writeStats(stats) {
  statsWriteQueue = statsWriteQueue.then(() => {
    return fs.promises.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
  });
  return statsWriteQueue;
}

let leadsWriteQueue = Promise.resolve();
function writeLeads(leads) {
  leadsWriteQueue = leadsWriteQueue.then(() => {
    return fs.promises.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
  });
  return leadsWriteQueue;
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
}

// ---- Automation-need scoring engine ----
// Every factor contributes to a 0-100 score. Weights are calibrated so the
// result reflects a genuine mix of low/medium/high scores rather than
// pushing everyone toward "urgent" (which would feel like a marketing trick).
function computeScore(answers) {
  const factors = [];
  let score = 0;

  const emailVolumeMap = { low: 5, medium: 12, high: 20, veryhigh: 25 };
  const v1 = emailVolumeMap[answers.emailVolume] ?? 5;
  score += v1;
  factors.push({ key: "emailVolume", points: v1, max: 25 });

  const peopleMap = { one: 5, few: 10, many: 15 };
  const v2 = peopleMap[answers.peopleInvolved] ?? 5;
  score += v2;
  factors.push({ key: "peopleInvolved", points: v2, max: 15 });

  const trackingMap = { yes: 15, no: 8 };
  const v3 = trackingMap[answers.manualTracking] ?? 8;
  score += v3;
  factors.push({ key: "manualTracking", points: v3, max: 15 });

  const automationMap = { none: 20, partial: 10, full: 0 };
  const v4 = automationMap[answers.existingAutomation] ?? 20;
  score += v4;
  factors.push({ key: "existingAutomation", points: v4, max: 20 });

  const timeMap = { low: 5, medium: 12, high: 20, veryhigh: 25 };
  const v5 = timeMap[answers.timeLost] ?? 5;
  score += v5;
  factors.push({ key: "timeLost", points: v5, max: 25 });

  score = Math.max(0, Math.min(100, Math.round(score)));

  let bracket, messageKey;
  if (score <= 25) {
    bracket = "low";
  } else if (score <= 50) {
    bracket = "moderate";
  } else if (score <= 75) {
    bracket = "high";
  } else {
    bracket = "critical";
  }

  // sort factors by contribution to surface the top drivers of the score
  const topFactors = [...factors]
    .sort((a, b) => b.points / b.max - a.points / a.max)
    .slice(0, 2)
    .map((f) => f.key);

  return { score, bracket, factors, topFactors };
}

app.use(express.json());

// ---- Stats API ----
app.get("/api/stats", (req, res) => {
  res.json(readStats());
});

app.post("/api/stats/bump", async (req, res) => {
  const { path: dotPath, amount } = req.body || {};
  if (typeof dotPath !== "string" || !dotPath.length) {
    return res.status(400).json({ error: 'Missing "path" field.' });
  }
  const amt = typeof amount === "number" && isFinite(amount) ? amount : 1;
  const stats = readStats();
  bumpPath(stats, dotPath, amt);
  const now = Date.now();
  if (!stats.firstVisit) stats.firstVisit = now;
  stats.lastVisit = now;
  await writeStats(stats);
  res.json(stats);
});

app.post("/api/stats/reset", async (req, res) => {
  const stats = defaultStats();
  await writeStats(stats);
  res.json(stats);
});

// ---- Leads API ----

// Configure via environment variables on Render (never hardcode credentials):
//   GMAIL_USER          → the Gmail address sending the notification
//   GMAIL_APP_PASSWORD  → a 16-character Gmail "App Password" (not your normal password)
// If these are not set, the lead is still saved to data/leads.json — it just
// won't be emailed automatically until you configure them.
function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn(
      "⚠️ Nodemailer: Variables GMAIL_USER ou GMAIL_APP_PASSWORD manquantes.",
    );
    return null;
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendLeadEmail(lead) {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, reason: "Variables d'environnement non définies." };
  }

  const lines = [
    `Nouvelle demande de discussion — Score d'automatisation : ${lead.score}% (${lead.bracket})`,
    "",
    `Entreprise : ${lead.companyName}`,
    `Secteur : ${lead.sector || "—"}`,
    `Taille de l'équipe : ${lead.teamSize || "—"}`,
    `Contact : ${lead.contactName} <${lead.contactEmail}>`,
    `Téléphone : ${lead.phone || "—"}`,
    "",
    "--- Réponses au diagnostic ---",
    `Volume d'e-mails reçus : ${lead.answers.emailVolume}`,
    `Personnes traitant ces e-mails manuellement : ${lead.answers.peopleInvolved}`,
    `Suivi manuel via Sheets/Drive : ${lead.answers.manualTracking}`,
    `Automatisation déjà en place : ${lead.answers.existingAutomation}`,
    `Temps perdu par semaine (estimation) : ${lead.answers.timeLost}`,
    "",
    "--- Message libre ---",
    lead.message || "(aucun message)",
    "",
    `Reçu le : ${new Date(lead.createdAt).toLocaleString("fr-FR")}`,
  ];

  try {
    const info = await transporter.sendMail({
      from: `"Endolori Labs — Site" <${process.env.GMAIL_USER}>`,
      to: NOTIFY_EMAIL,
      replyTo: lead.contactEmail,
      subject: `[Endolori Labs] Nouvelle demande — ${lead.companyName} (${lead.score}%)`,
      text: lines.join("\n"),
    });
    console.log("✅ Email envoyé avec succès :", info.response);
    return { sent: true };
  } catch (err) {
    console.error("❌ Échec de l'envoi de l'email :", err);
    return { sent: false, reason: err.message };
  }
}

app.post("/api/leads", async (req, res) => {
  const body = req.body || {};

  // honeypot spam trap: real users never fill this hidden field
  if (body.website) {
    return res.json({
      score: 0,
      bracket: "low",
      factors: [],
      topFactors: [],
      emailSent: false,
    });
  }

  const required = ["companyName", "contactName", "contactEmail"];
  for (const field of required) {
    if (
      !body[field] ||
      typeof body[field] !== "string" ||
      !body[field].trim()
    ) {
      return res
        .status(400)
        .json({ error: `Missing required field: ${field}` });
    }
  }

  const answers = {
    emailVolume: body.emailVolume || "low",
    peopleInvolved: body.peopleInvolved || "one",
    manualTracking: body.manualTracking || "no",
    existingAutomation: body.existingAutomation || "none",
    timeLost: body.timeLost || "low",
  };

  const { score, bracket, factors, topFactors } = computeScore(answers);

  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    companyName: body.companyName.trim(),
    sector: (body.sector || "").trim(),
    teamSize: (body.teamSize || "").trim(),
    contactName: body.contactName.trim(),
    contactEmail: body.contactEmail.trim(),
    phone: (body.phone || "").trim(),
    answers,
    message: (body.message || "").trim(),
    score,
    bracket,
    topFactors,
    createdAt: Date.now(),
  };

  const leads = readLeads();
  leads.push(lead);
  await writeLeads(leads);

  const emailResult = await sendLeadEmail(lead);

  res.json({
    score,
    bracket,
    factors,
    topFactors,
    emailSent: emailResult.sent,
  });
});

app.get("/api/leads", (req, res) => {
  res.json(readLeads());
});

// ---- Static site ----
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/fortuna_major", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "fortuna_major.html"));
});

app.listen(PORT, () => {
  console.log(`Endolori Labs server running on port ${PORT}`);
});
