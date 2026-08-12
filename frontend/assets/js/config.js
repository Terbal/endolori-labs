// config.js — the ONE place to point the frontend at your backend.
//
// The frontend (this static site) and the backend (Node/Express API) are now
// deployed as two separate Render services with two separate URLs. Every
// fetch() call in the other scripts uses ENDOLORI_API_BASE below to know
// where to send requests.
//
// ⚠️ REPLACE the URL below with your actual deployed backend URL once you
// know it (Render shows it after you create the Web Service, e.g.
// "https://endolori-labs-api.onrender.com"). Do NOT include a trailing slash.
window.ENDOLORI_API_BASE = "https://endolori-back.onrender.com";

// For local development, you can temporarily override this, e.g.:
// window.ENDOLORI_API_BASE = "http://localhost:3000";
