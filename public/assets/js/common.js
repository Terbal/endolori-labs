/* ===== THEME ===== */
(function () {
  const root = document.documentElement;
  const btn = document.getElementById("themeToggle");
  btn.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      EndoloriStats.bump("themeCounts." + next, 1);
    } catch (e) {}
  });
})();

/* ===== ANALYTICS (persisted server-side in data/stats.json — see fortuna_major.html) ===== */
const EndoloriStats = (function () {
  function bump(path, amount, opts) {
    amount = typeof amount === "number" ? amount : 1;
    const body = JSON.stringify({ path: path, amount: amount });
    if (opts && opts.beacon && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/stats/bump", blob);
      return;
    }
    fetch("/api/stats/bump", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
    }).catch(() => {});
  }
  // record this page view + device type once on load
  bump("pageViews", 1);
  const isMobile = window.matchMedia("(max-width:900px)").matches;
  bump("deviceCounts." + (isMobile ? "mobile" : "desktop"), 1);
  return { bump };
})();

/* ===== SECRET ACCESS: type "fortuna_major" anywhere on the page ===== */
(function () {
  const PASSWORD = "fortuna_major";
  let buffer = "";
  window.addEventListener("keydown", function (e) {
    if (e.key && e.key.length === 1) {
      buffer = (buffer + e.key.toLowerCase()).slice(-PASSWORD.length);
      if (buffer === PASSWORD) {
        buffer = "";
        try {
          sessionStorage.setItem("fortuna_access", "1");
        } catch (err) {}
        window.location.href = "/fortuna_major";
      }
    }
  });
})();

/* ===== LOGO: RELOAD & BACK TO TOP ===== */
(function () {
  const logo = document.getElementById("logoHome");
  if (logo) {
    logo.addEventListener("click", function (e) {
      e.preventDefault();
      if (window.location.hash) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
      window.location.reload();
    });
  }
})();

/* ===== THEME ===== */
(function () {
  const root = document.documentElement;
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const next =
        root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        EndoloriStats.bump("themeCounts." + next, 1);
      } catch (e) {}
    });
  }
})();

/* ===== MOBILE MENU ===== */
(function () {
  const toggle = document.getElementById("mobileToggle");
  const menu = document.getElementById("mobileMenu");
  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      toggle.classList.toggle("open", open);
    });
    menu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        menu.classList.remove("open");
        toggle.classList.remove("open");
      }),
    );
  }
})();

/* ===== CUSTOM CURSOR ===== */
(function () {
  const cur = document.getElementById("cursor");
  if (window.matchMedia("(hover: none)").matches || window.innerWidth < 900)
    return;
  let x = 0,
    y = 0,
    cx = 0,
    cy = 0;
  window.addEventListener("mousemove", (e) => {
    x = e.clientX;
    y = e.clientY;
  });
  function loop() {
    cx += (x - cx) * 0.25;
    cy += (y - cy) * 0.25;
    cur.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  }
  loop();
  document.querySelectorAll("a,button,.node").forEach((el) => {
    el.addEventListener("mouseenter", () => cur.classList.add("grow"));
    el.addEventListener("mouseleave", () => cur.classList.remove("grow"));
  });
})();

/* ===== NAV SCROLL STATE ===== */
const nav = document.getElementById("nav");
window.addEventListener(
  "scroll",
  () => {
    nav.classList.toggle("scrolled", window.scrollY > 40);
  },
  { passive: true },
);

/* ===== GENERIC REVEAL ON SCROLL ===== */
const revealEls = document.querySelectorAll(".reveal, .reveal-scale");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add("in");
    });
  },
  { threshold: 0.18 },
);
revealEls.forEach((el) => revealObserver.observe(el));
