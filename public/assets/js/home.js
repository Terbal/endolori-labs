/* ===== HERO SPHERE (wireframe, mouse-reactive, theme-aware) ===== */
(function(){
  const canvas = document.getElementById('sphere');
  const ctx = canvas.getContext('2d');
  let w,h,dpr;
  function resize(){
    dpr = Math.min(window.devicePixelRatio||1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w*dpr; canvas.height = h*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener('resize', resize); resize();
  window.addEventListener('load', resize);
  if(window.ResizeObserver){ new ResizeObserver(resize).observe(canvas); }

  const RINGS = 9, PTS = 34, R = () => Math.min(w,h)*0.42;
  let rotY = 0, rotX = 0.15;
  let targetTiltX = 0, targetTiltY = 0, tiltX = 0, tiltY = 0;

  window.addEventListener('mousemove', (e)=>{
    const nx = (e.clientX/window.innerWidth - .5);
    const ny = (e.clientY/window.innerHeight - .5);
    targetTiltY = nx*0.5; targetTiltX = ny*0.35;
  });

  function project(x,y,z, cx, cy, radius, ry, rx){
    let cosY=Math.cos(ry), sinY=Math.sin(ry);
    let x1 = x*cosY - z*sinY;
    let z1 = x*sinY + z*cosY;
    let cosX=Math.cos(rx), sinX=Math.sin(rx);
    let y1 = y*cosX - z1*sinX;
    let z2 = y*sinX + z1*cosX;
    const scale = radius / (radius + z2*0.6);
    return {x: cx + x1*scale, y: cy + y1*scale, s: scale, z:z2};
  }

  function isDark(){ return document.documentElement.getAttribute('data-theme') === 'dark'; }

  function draw(){
    if(!w || !h || w<=0 || h<=0){ resize(); requestAnimationFrame(draw); return; }
    ctx.clearRect(0,0,w,h);
    const cx=w/2, cy=h/2, radius=R();
    if(!radius || radius<=0){ requestAnimationFrame(draw); return; }
    rotY += 0.0032;
    tiltX += (targetTiltX-tiltX)*0.04;
    tiltY += (targetTiltY-tiltY)*0.04;
    const ry = rotY + tiltY;
    const rx = rotX + tiltX;
    const dark = isDark();
    const inkRGB = dark ? '238,241,251' : '11,31,58';
    const accentRGB = dark ? '110,140,255' : '37,99,235';

    const grad = ctx.createRadialGradient(cx,cy,radius*0.1,cx,cy,radius*1.05);
    grad.addColorStop(0,`rgba(${accentRGB},${dark?0.14:0.07})`);
    grad.addColorStop(1,`rgba(${accentRGB},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx,cy,radius*1.05,0,Math.PI*2); ctx.fill();

    for(let i=0;i<RINGS;i++){
      const lat = (Math.PI*(i+1))/(RINGS+1) - Math.PI/2;
      const rr = Math.cos(lat)*radius;
      const yy = Math.sin(lat)*radius;
      let pts = [];
      for(let j=0;j<=PTS;j++){
        const lon = (Math.PI*2*j)/PTS;
        const x = Math.cos(lon)*rr;
        const z = Math.sin(lon)*rr;
        pts.push(project(x,yy,z,cx,cy,radius,ry,rx));
      }
      ctx.beginPath();
      pts.forEach((p,idx)=>{ idx===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y); });
      const avgZ = pts.reduce((a,p)=>a+p.z,0)/pts.length;
      const op = Math.max(0.06, Math.min(dark?0.6:0.5, (dark?0.34:0.28) - avgZ/(radius*3)));
      ctx.strokeStyle = `rgba(${inkRGB},${op})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for(let i=0;i<RINGS+3;i++){
      const lon0 = (Math.PI*2*i)/(RINGS+3);
      let pts=[];
      for(let j=0;j<=PTS;j++){
        const lat = (Math.PI*j)/PTS - Math.PI/2;
        const rr = Math.cos(lat)*radius;
        const x = Math.cos(lon0)*rr;
        const z = Math.sin(lon0)*rr;
        const y = Math.sin(lat)*radius;
        pts.push(project(x,y,z,cx,cy,radius,ry,rx));
      }
      ctx.beginPath();
      pts.forEach((p,idx)=>{ idx===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y); });
      const avgZ = pts.reduce((a,p)=>a+p.z,0)/pts.length;
      const op = Math.max(0.05, Math.min(dark?0.5:0.4, (dark?0.28:0.22) - avgZ/(radius*3)));
      ctx.strokeStyle = `rgba(${accentRGB},${op})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const core = project(0,0,0,cx,cy,radius,ry,rx);
    const cg = ctx.createRadialGradient(core.x,core.y,0,core.x,core.y,radius*0.16);
    cg.addColorStop(0,`rgba(${inkRGB},${dark?0.7:0.55})`);
    cg.addColorStop(1,`rgba(${inkRGB},0)`);
    ctx.fillStyle=cg;
    ctx.beginPath(); ctx.arc(core.x,core.y,radius*0.16,0,Math.PI*2); ctx.fill();

    requestAnimationFrame(draw);
  }
  draw();
})();

/* ===== PROBLEM STORY SEQUENCE + BACKGROUND ILLUSTRATIONS ===== */
(function(){
  const inner = document.getElementById('storyInner');
  const lines = document.querySelectorAll('.story-line');
  const bgs = document.querySelectorAll('.story-bg');
  const dotsWrap = document.getElementById('storyProgress');
  lines.forEach(()=>{ const d=document.createElement('span'); dotsWrap.appendChild(d); });
  const dots = dotsWrap.querySelectorAll('span');
  function update(){
    const rect = inner.getBoundingClientRect();
    const total = inner.offsetHeight - window.innerHeight;
    const scrolled = Math.min(Math.max(-rect.top,0), total);
    const progress = scrolled/total;
    const idx = Math.min(lines.length-1, Math.floor(progress*lines.length));
    lines.forEach((l,i)=> l.classList.toggle('active', i===idx));
    dots.forEach((d,i)=> d.classList.toggle('active', i===idx));
    bgs.forEach(b=> b.classList.toggle('active', parseInt(b.dataset.bg)===idx));
  }
  window.addEventListener('scroll', update, {passive:true});
  window.addEventListener('resize', update);
  update();
})();

/* ===== OPERATIONS CANVAS ===== */
(function(){
  const canvas = document.getElementById('opsCanvas');
  const svg = document.getElementById('opsLines');
  const frame = document.getElementById('opsFrame');
  const flowBar = document.getElementById('flowBar');
  svg.setAttribute('viewBox','0 0 1600 960');

  const nodes = {
    email:        {x:480, y:460},
    workspace:    {x:720, y:220},
    documents:    {x:760, y:640},
    crm:          {x:1020,y:420},
    notifications:{x:960, y:640},
    reports:      {x:1240,y:280},
    database:     {x:1260,y:540},
  };
  const edges = [
    ['email','workspace'],['email','documents'],['email','crm'],['email','notifications'],
    ['documents','database'],['crm','database'],['reports','database'],['crm','reports'],
    ['notifications','crm'],['workspace','documents'],
  ];

  Object.keys(nodes).forEach(key=>{
    const n = nodes[key];
    const el = document.createElement('div');
    el.className='node'; el.dataset.key=key;
    el.style.left=n.x+'px'; el.style.top=n.y+'px';
    el.innerHTML = `<span class="dot"></span><span class="label-text" data-i18n="node.${key}">${translations.en['node.'+key]}</span>`;
    canvas.appendChild(el);
  });

  function pathFor(a,b){ const midx=(a.x+b.x)/2, midy=(a.y+b.y)/2 - 28; return `M${a.x},${a.y} Q${midx},${midy} ${b.x},${b.y}`; }
  edges.forEach(([a,b])=>{
    const p = document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d', pathFor(nodes[a],nodes[b]));
    p.dataset.a=a; p.dataset.b=b;
    svg.appendChild(p);
  });

  const nodeEls = canvas.querySelectorAll('.node');
  const pathEls = svg.querySelectorAll('path');
  const flowPills = flowBar.querySelectorAll('.flow-pill');

  function highlight(key, on){
    pathEls.forEach(p=>{ if(p.dataset.a===key || p.dataset.b===key) p.classList.toggle('lit', on); });
    nodeEls.forEach(n=>{
      if(edges.some(([a,b])=> (a===key&&b===n.dataset.key)||(b===key&&a===n.dataset.key))) n.classList.toggle('lit', on);
    });
  }
  function playFlow(){
    flowPills.forEach(p=>p.classList.remove('lit'));
    flowPills.forEach((p,i)=> setTimeout(()=>p.classList.add('lit'), i*350));
  }
  nodeEls.forEach(n=>{
    n.addEventListener('mouseenter', ()=> highlight(n.dataset.key, true));
    n.addEventListener('mouseleave', ()=> highlight(n.dataset.key, false));
    n.addEventListener('click', ()=>{
      pathEls.forEach(p=>{
        if(p.dataset.a===n.dataset.key || p.dataset.b===n.dataset.key){
          p.classList.add('flow');
          setTimeout(()=>p.classList.remove('flow'), 1200);
        }
      });
      playFlow();
    });
  });

  let isDown=false, startX,startY, curX=-800, curY=-480;
  function setTransform(){ canvas.style.transform = `translate(${curX}px,${curY}px)`; }
  setTransform();
  frame.addEventListener('pointerdown', e=>{ isDown=true; frame.classList.add('dragging'); startX=e.clientX-curX; startY=e.clientY-curY; });
  window.addEventListener('pointermove', e=>{
    if(!isDown) return;
    curX = e.clientX-startX; curY = e.clientY-startY;
    curX = Math.max(-1150, Math.min(150, curX));
    curY = Math.max(-600, Math.min(50, curY));
    setTransform();
  });
  window.addEventListener('pointerup', ()=>{ isDown=false; frame.classList.remove('dragging'); });
})();

/* ===== PRODUCT FLOW REVEAL ===== */
(function(){
  const steps = document.querySelectorAll('.flow-step2');
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        const i = parseInt(e.target.dataset.step);
        setTimeout(()=> e.target.classList.add('in'), i*110);
      }
    });
  }, {threshold:.4});
  steps.forEach(s=>obs.observe(s));
  let active=0;
  setInterval(()=>{
    steps.forEach(s=>s.classList.remove('lit'));
    steps[active].classList.add('lit');
    active = (active+1)%steps.length;
  }, 1400);
})();


/* ===== DEMO MORPH + WATCH TRACKING ===== */
(function(){
  const btn = document.getElementById('playBtn');
  const ill = document.getElementById('demoIllustration');
  const vid = document.getElementById('demoVideo');
  const videoEl = document.getElementById('demoVideoEl');
  let watchStart = null;
  function flushWatch(useBeacon){
    if(watchStart){
      const delta = (Date.now() - watchStart) / 1000;
      if(delta > 0 && delta < 6000) EndoloriStats.bump('totalWatchSeconds', delta, {beacon: !!useBeacon});
      watchStart = null;
    }
  }
  btn.addEventListener('click', ()=>{
    ill.classList.add('hide'); btn.classList.add('hide'); vid.classList.add('show');
    EndoloriStats.bump('videoPlays', 1);
    videoEl.play().catch(()=>{});
  });
  videoEl.addEventListener('play', ()=>{ watchStart = Date.now(); });
  videoEl.addEventListener('pause', ()=>flushWatch(false));
  videoEl.addEventListener('ended', ()=>flushWatch(false));
  window.addEventListener('beforeunload', ()=>flushWatch(true));
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) flushWatch(true); });
})();

/* ===== BEFORE/AFTER SWEEP ===== */
(function(){
  const frame = document.getElementById('baFrame');
  const obs = new IntersectionObserver((entries)=>{ entries.forEach(e=>{ if(e.isIntersecting) frame.classList.add('in'); }); }, {threshold:.4});
  obs.observe(frame);
})();

/* ===== ECOSYSTEM + WORK STEPS REVEAL ===== */
(function(){
  const items = document.querySelectorAll('.eco-card, .work-step');
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        const arr = Array.from(e.target.parentElement.children);
        const i = arr.indexOf(e.target);
        setTimeout(()=>e.target.classList.add('in'), i*110);
      }
    });
  }, {threshold:.25});
  items.forEach(i=>obs.observe(i));
})();

