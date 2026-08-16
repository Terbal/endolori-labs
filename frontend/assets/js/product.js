/* ===== FEATURE CARDS REVEAL ===== */
(function () {
  const items = document.querySelectorAll(".feature-card");
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const arr = Array.from(e.target.parentElement.children);
          const i = arr.indexOf(e.target);
          setTimeout(() => e.target.classList.add("in"), i * 90);
        }
      });
    },
    { threshold: 0.2 },
  );
  items.forEach((i) => obs.observe(i));
})();

/* ===== WORKFLOW CARD REVEAL (was missing on this page — steps stayed invisible) ===== */
(function () {
  const steps = document.querySelectorAll(".flow-step2");
  if (!steps.length) return;
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const i = parseInt(e.target.dataset.step) || 0;
          setTimeout(() => e.target.classList.add("in"), i * 110);
        }
      });
    },
    { threshold: 0.4 },
  );
  steps.forEach((s) => obs.observe(s));
  let active = 0;
  setInterval(() => {
    steps.forEach((s) => s.classList.remove("lit"));
    steps[active].classList.add("lit");
    active = (active + 1) % steps.length;
  }, 1400);
})();

/* ===== FAQ ACCORDION ===== */
(function () {
  document.querySelectorAll(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-q");
    q.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      document
        .querySelectorAll(".faq-item")
        .forEach((i) => i.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });
})();

/* ===== DEMO MORPH + WATCH TRACKING (same component as homepage) ===== */
(function () {
  const btn = document.getElementById("playBtn");
  const ill = document.getElementById("demoIllustration");
  const vid = document.getElementById("demoVideo");
  const videoEl = document.getElementById("demoVideoEl");
  if (!btn || !videoEl) return;
  let watchStart = null;
  function flushWatch(useBeacon) {
    if (watchStart) {
      const delta = (Date.now() - watchStart) / 1000;
      if (delta > 0 && delta < 6000)
        EndoloriStats.bump("totalWatchSeconds", delta, { beacon: !!useBeacon });
      watchStart = null;
    }
  }
  btn.addEventListener("click", () => {
    ill.classList.add("hide");
    btn.classList.add("hide");
    vid.classList.add("show");
    EndoloriStats.bump("videoPlays", 1);
    videoEl.play().catch(() => {});
  });
  videoEl.addEventListener("play", () => {
    watchStart = Date.now();
  });
  videoEl.addEventListener("pause", () => flushWatch(false));
  videoEl.addEventListener("ended", () => flushWatch(false));
  window.addEventListener("beforeunload", () => flushWatch(true));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushWatch(true);
  });
})();
