/* ===== THEME ===== */
(function(){
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  btn.addEventListener('click', ()=>{
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try{ localStorage.setItem('endolori_theme', next); }catch(e){}
    try{ EndoloriStats.bump('themeCounts.' + next, 1); }catch(e){}
  });
})();


/* ===== ANALYTICS (persisted server-side via the backend API — see fortuna_major) ===== */
const EndoloriStats = (function(){
  const API = window.ENDOLORI_API_BASE || '';
  function bump(path, amount, opts){
    amount = (typeof amount === 'number') ? amount : 1;
    const body = JSON.stringify({ path: path, amount: amount });
    if(opts && opts.beacon && navigator.sendBeacon){
      const blob = new Blob([body], {type:'application/json'});
      navigator.sendBeacon(API + '/api/stats/bump', blob);
      return;
    }
    fetch(API + '/api/stats/bump', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: body,
      keepalive: true
    }).catch(()=>{});
  }
  // record this page view + device type once on load
  bump('pageViews', 1);
  const isMobile = window.matchMedia('(max-width:900px)').matches;
  bump('deviceCounts.' + (isMobile ? 'mobile' : 'desktop'), 1);
  return { bump };
})();


/* ===== SECRET ACCESS: type "fortuna_major" anywhere on the page ===== */
(function(){
  const PASSWORD = 'fortuna_major';
  let buffer = '';
  window.addEventListener('keydown', function(e){
    if(e.key && e.key.length === 1){
      buffer = (buffer + e.key.toLowerCase()).slice(-PASSWORD.length);
      if(buffer === PASSWORD){
        buffer = '';
        showAdminLoginModal();
      }
    }
  });

  function lang(){ return document.documentElement.lang === 'en' ? 'en' : 'fr'; }

  const T = {
    fr: {
      title: 'Accès administrateur',
      user: "Nom d'utilisateur",
      pass: 'Mot de passe',
      submit: 'Se connecter',
      connecting: 'Connexion…',
      error: "Nom d'utilisateur ou mot de passe incorrect.",
      serverError: 'Le serveur ne semble pas configuré pour cet accès. Contactez l\'administrateur.'
    },
    en: {
      title: 'Admin access',
      user: 'Username',
      pass: 'Password',
      submit: 'Sign in',
      connecting: 'Signing in…',
      error: 'Incorrect username or password.',
      serverError: 'The server does not seem to be configured for this access. Contact the administrator.'
    }
  };

  function showAdminLoginModal(){
    if(!window.EndoloriModal) return;
    const t = T[lang()];
    window.EndoloriModal.show(`
      <h3>${t.title}</h3>
      <form id="adminLoginForm" style="text-align:left;margin-top:16px;">
        <div class="field">
          <label>${t.user}</label>
          <input type="text" id="adminUser" autocomplete="username" required>
        </div>
        <div class="field">
          <label>${t.pass}</label>
          <input type="password" id="adminPass" autocomplete="current-password" required>
        </div>
        <p id="adminLoginError" style="color:#e05252;font-size:13px;display:none;margin-bottom:6px;"></p>
        <button type="submit" class="btn-primary" style="width:100%;">${t.submit}</button>
      </form>
    `, { dismissible: true });

    const form = document.getElementById('adminLoginForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async function(ev){
      ev.preventDefault();
      const username = document.getElementById('adminUser').value;
      const password = document.getElementById('adminPass').value;
      const errEl = document.getElementById('adminLoginError');
      errEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = t.connecting;
      try{
        const API = window.ENDOLORI_API_BASE || '';
        const res = await fetch(API + '/api/auth/login', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          credentials: 'include',
          body: JSON.stringify({ username, password })
        });
        if(res.ok){
          window.location.href = API + '/fortuna_major';
          return;
        }
        const data = await res.json().catch(()=>({}));
        errEl.textContent = res.status === 500 ? t.serverError : t.error;
        errEl.style.display = 'block';
      }catch(err){
        errEl.textContent = t.error;
        errEl.style.display = 'block';
      }
      submitBtn.disabled = false;
      submitBtn.textContent = t.submit;
    });
  }
})();

/* ===== LOGO: RELOAD & BACK TO TOP ===== */
(function(){
  const logo = document.getElementById('logoHome');
  if(!logo) return;
  logo.addEventListener('click', function(e){
    e.preventDefault();
    if(window.location.hash){
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    window.location.reload();
  });
})();

/* ===== MOBILE MENU ===== */
(function(){
  const toggle = document.getElementById('mobileToggle');
  const menu = document.getElementById('mobileMenu');
  toggle.addEventListener('click', ()=>{
    const open = menu.classList.toggle('open');
    toggle.classList.toggle('open', open);
  });
  menu.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=>{
    menu.classList.remove('open'); toggle.classList.remove('open');
  }));
})();

/* ===== CUSTOM CURSOR ===== */
(function(){
  const cur = document.getElementById('cursor');
  if(window.matchMedia('(hover: none)').matches || window.innerWidth < 900) return;
  let x=0,y=0,cx=0,cy=0;
  window.addEventListener('mousemove', e=>{x=e.clientX;y=e.clientY;});
  function loop(){cx+=(x-cx)*0.65;cy+=(y-cy)*0.65;cur.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%)`;requestAnimationFrame(loop);}
  loop();
  document.querySelectorAll('a,button,.node').forEach(el=>{
    el.addEventListener('mouseenter', ()=>cur.classList.add('grow'));
    el.addEventListener('mouseleave', ()=>cur.classList.remove('grow'));
  });
})();

/* ===== NAV SCROLL STATE ===== */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 40); }, {passive:true});

/* ===== GENERIC REVEAL ON SCROLL ===== */
const revealEls = document.querySelectorAll('.reveal, .reveal-scale');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('in'); });
}, {threshold:.18});
revealEls.forEach(el => revealObserver.observe(el));

/* ===== REUSABLE MODAL / POPUP ===== */
window.EndoloriModal = (function(){
  let overlay = null;
  function ensure(){
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'eo-modal-overlay';
    overlay.innerHTML = '<div class="eo-modal-card"><button class="eo-modal-close" aria-label="Close">&times;</button><div class="eo-modal-body"></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e)=>{ if(e.target === overlay) hide(); });
    overlay.querySelector('.eo-modal-close').addEventListener('click', hide);
    document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') hide(); });
    return overlay;
  }
  function show(html, opts){
    opts = opts || {};
    const el = ensure();
    el.querySelector('.eo-modal-body').innerHTML = html;
    el.querySelector('.eo-modal-close').style.display = opts.dismissible === false ? 'none' : 'flex';
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function hide(){
    if(!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  return { show, hide };
})();
