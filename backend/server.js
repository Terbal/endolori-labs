// Endolori Labs — Express backend (API only).
// The frontend is now a separate static site — see ../frontend.
// Storage backend (Firestore or local JSON) is handled transparently by db.js.

const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const nodemailer = require("nodemailer");
const db = require("./db");
const auth = require("./auth");

const app = express();
const PORT = process.env.PORT || 3000;

// FRONTEND_ORIGIN can be one URL or a comma-separated list (e.g. your live
// site + a localhost dev URL). If unset, all origins are allowed — fine to
// start with, but set this once you know your frontend's real URL.
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  }),
);
app.use(cookieParser());

const NOTIFY_EMAIL = "joelmoyo249@gmail.com";

// ---- Automation-need scoring engine ----
// Every factor contributes to a 0-100 score. Weights are calibrated so the
// result reflects a genuine mix of low/medium/high scores rather than
// pushing everyone toward "urgent" (which would feel like a marketing trick).
// This score stays internal (visible in /fortuna_major) — visitors only ever
// see the softer "Prochaine étape" messaging, never the raw number.
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

  let bracket;
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

// ---- Auth API ----
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const result = auth.checkCredentials(username, password);
  if (result.ok) {
    const token = auth.createSessionToken();
    // Render serves HTTPS, so in production this is secure+none (required
    // for the cross-origin frontend → backend login request). Locally,
    // req.secure is false (plain http://localhost) — browsers refuse
    // "Secure" cookies over http, so we relax to non-secure+lax there.
    // This means the flow works out of the box both in production and
    // when testing locally, no manual toggling needed.
    const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.cookie(auth.COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      maxAge: auth.SESSION_MAX_AGE_MS,
    });
    return res.json({ ok: true });
  }
  if (result.reason === "not_configured") {
    return res
      .status(500)
      .json({
        error:
          "Admin credentials are not configured on the server (ADMIN_USERNAME / ADMIN_PASSWORD).",
      });
  }
  res.status(401).json({ error: "Invalid username or password." });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(auth.COOKIE_NAME);
  res.json({ ok: true });
});

// ---- Stats API ----
app.get("/api/stats", auth.requireAuth, async (req, res) => {
  res.json(await db.getStats());
});

app.post("/api/stats/bump", async (req, res) => {
  const { path: dotPath, amount } = req.body || {};
  if (typeof dotPath !== "string" || !dotPath.length) {
    return res.status(400).json({ error: 'Missing "path" field.' });
  }
  const amt = typeof amount === "number" && isFinite(amount) ? amount : 1;
  const stats = await db.bumpStats(dotPath, amt);
  res.json(stats);
});

app.post("/api/stats/reset", auth.requireAuth, async (req, res) => {
  res.json(await db.resetStats());
});

// ---- Leads API ----

// Configure via environment variables on Render (never hardcode credentials):
//   GMAIL_USER          → the Gmail address sending the notification
//   GMAIL_APP_PASSWORD  → a 16-character Gmail "App Password" (not your normal password)
// If these are not set, the lead is still saved to the database — it just
// won't be emailed automatically until you configure them.
let mailTransporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  mailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendLeadEmail(lead) {
  if (!mailTransporter)
    return {
      sent: false,
      reason: "Email not configured (missing GMAIL_USER / GMAIL_APP_PASSWORD).",
    };
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
    await mailTransporter.sendMail({
      from: `"Endolori Labs — Site" <${process.env.GMAIL_USER}>`,
      to: NOTIFY_EMAIL,
      replyTo: lead.contactEmail,
      subject: `[Endolori Labs] Nouvelle demande — ${lead.companyName} (${lead.score}%)`,
      text: lines.join("\n"),
    });
    return { sent: true };
  } catch (err) {
    console.error("Failed to send lead email:", err.message);
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
    status: "nouveau",
    archived: false,
    createdAt: Date.now(),
  };

  await db.addLead(lead);

  const emailResult = await sendLeadEmail(lead);

  res.json({
    score,
    bracket,
    factors,
    topFactors,
    emailSent: emailResult.sent,
  });
});

app.get("/api/leads", auth.requireAuth, async (req, res) => {
  res.json(await db.getLeads());
});

// Valid pipeline statuses a lead can be moved through.
const LEAD_STATUSES = [
  "nouveau",
  "a_contacter",
  "contacte",
  "en_discussion",
  "proposition_envoyee",
  "gagne",
  "perdu",
];

app.patch("/api/leads/:id", auth.requireAuth, async (req, res) => {
  const { status, archived } = req.body || {};
  const updates = {};
  if (typeof status === "string") {
    if (!LEAD_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({
          error: `Invalid status. Must be one of: ${LEAD_STATUSES.join(", ")}`,
        });
    }
    updates.status = status;
  }
  if (typeof archived === "boolean") updates.archived = archived;
  if (!Object.keys(updates).length) {
    return res
      .status(400)
      .json({ error: 'Nothing to update — send "status" and/or "archived".' });
  }
  const updated = await db.updateLead(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: "Lead not found." });
  res.json(updated);
});

app.delete("/api/leads/:id", auth.requireAuth, async (req, res) => {
  await db.deleteLead(req.params.id);
  res.json({ ok: true });
});

// ---- Root & admin dashboard ----
// The public marketing site is a separate static deployment (see ../frontend).
// This backend only serves the API and the protected admin dashboard.
app.get("/", (req, res) => {
  res
    .type("text/plain")
    .send(
      "Endolori Labs API is running. The public site is hosted separately.",
    );
});

app.get("/fortuna_major", (req, res) => {
  const token = req.cookies && req.cookies[auth.COOKIE_NAME];
  if (!auth.verifySessionToken(token)) {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "views", "fortuna_major.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Endolori Labs backend running on port ${PORT} (storage: ${db.useFirestore ? "Firestore" : "local JSON"})`,
  );
});
