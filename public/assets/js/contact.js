(function(){
  const steps = document.querySelectorAll('.form-step');
  const progressEls = document.querySelectorAll('.form-progress span');
  const form = document.getElementById('leadForm');
  const errorEl = document.getElementById('formError');
  let current = 0;

  const answers = {
    emailVolume: null,
    peopleInvolved: null,
    manualTracking: null,
    existingAutomation: null,
    timeLost: null
  };

  function showStep(i){
    steps.forEach((s, idx)=> s.classList.toggle('active', idx === i));
    progressEls.forEach((p, idx)=> p.classList.toggle('done', idx <= i));
    current = i;
    errorEl.classList.remove('show');
  }

  function validateStep(i){
    if(i === 0){
      const companyName = document.getElementById('companyName').value.trim();
      const contactName = document.getElementById('contactName').value.trim();
      const contactEmail = document.getElementById('contactEmail').value.trim();
      const emailOk = /\S+@\S+\.\S+/.test(contactEmail);
      if(!companyName || !contactName || !emailOk){
        errorEl.textContent = 'Merci de renseigner le nom de votre entreprise, votre nom et un e-mail valide.';
        errorEl.classList.add('show');
        return false;
      }
    }
    if(i === 1){
      const missing = Object.keys(answers).filter(k => !answers[k]);
      if(missing.length){
        errorEl.textContent = 'Merci de répondre à toutes les questions pour obtenir votre score.';
        errorEl.classList.add('show');
        return false;
      }
    }
    return true;
  }

  document.querySelectorAll('[data-next]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(!validateStep(current)) return;
      if(current < steps.length - 1) showStep(current + 1);
    });
  });
  document.querySelectorAll('[data-prev]').forEach(btn=>{
    btn.addEventListener('click', ()=> showStep(Math.max(0, current - 1)));
  });

  // option cards (single-select per group)
  document.querySelectorAll('.option-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      const group = card.dataset.group;
      document.querySelectorAll(`.option-card[data-group="${group}"]`).forEach(c=> c.classList.remove('selected'));
      card.classList.add('selected');
      answers[group] = card.dataset.value;
    });
  });

  const FACTOR_LABELS_FR = {
    emailVolume: "un volume d'e-mails élevé",
    peopleInvolved: "plusieurs personnes mobilisées manuellement",
    manualTracking: "un suivi manuel via fichiers/tableurs",
    existingAutomation: "l'absence de système d'automatisation",
    timeLost: "un temps hebdomadaire perdu important"
  };
  const FACTOR_LABELS_EN = {
    emailVolume: "a high email volume",
    peopleInvolved: "several people handling this manually",
    manualTracking: "manual tracking via spreadsheets",
    existingAutomation: "no automation system in place",
    timeLost: "significant weekly time lost"
  };

  const BRACKET_TEXT = {
    fr: {
      low: "Votre volume et vos processus actuels semblent encore gérables sans automatisation lourde. Une optimisation ciblée pourrait toutefois déjà faire gagner un peu de temps.",
      moderate: "Une automatisation ciblée sur certains points précis pourrait déjà vous faire gagner un temps notable chaque semaine.",
      high: "Votre situation présente plusieurs signaux clairs d'inefficacité opérationnelle qu'un système d'automatisation résoudrait directement.",
      critical: "Le volume, le temps perdu et l'absence de système structuré indiquent un besoin urgent d'automatisation."
    },
    en: {
      low: "Your current volume and processes still seem manageable without heavy automation. A targeted optimization could still save some time.",
      moderate: "A targeted automation on a few specific points could already save you meaningful time every week.",
      high: "Your situation shows several clear signs of operational inefficiency that an automation system would directly solve.",
      critical: "Volume, time lost, and the absence of a structured system point to an urgent need for automation."
    }
  };
  const BRACKET_LABEL = {
    fr: { low:'Besoin faible', moderate:'Besoin modéré', high:'Besoin élevé', critical:'Besoin critique' },
    en: { low:'Low need', moderate:'Moderate need', high:'High need', critical:'Critical need' }
  };

  function currentLang(){
    return document.documentElement.lang === 'en' ? 'en' : 'fr';
  }

  function animateScore(score){
    const circle = document.getElementById('scoreRingFill');
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference;
    requestAnimationFrame(()=>{
      const offset = circumference - (score / 100) * circumference;
      circle.style.strokeDashoffset = offset;
    });
    let n = 0;
    const numEl = document.getElementById('scoreNum');
    const dur = 1200, stepTime = 16;
    const steps = Math.max(1, Math.round(dur / stepTime));
    const inc = score / steps;
    const timer = setInterval(()=>{
      n += inc;
      if(n >= score){ n = score; clearInterval(timer); }
      numEl.textContent = Math.round(n);
    }, stepTime);
  }

  function renderResult(data){
    const lang = currentLang();
    const labels = lang === 'en' ? FACTOR_LABELS_EN : FACTOR_LABELS_FR;
    document.getElementById('resultBracket').textContent = BRACKET_LABEL[lang][data.bracket];
    document.getElementById('resultBracket').className = 'result-bracket ' + data.bracket;
    document.getElementById('resultExplain').textContent = BRACKET_TEXT[lang][data.bracket];

    const factorsWrap = document.getElementById('resultFactors');
    factorsWrap.innerHTML = '';
    (data.topFactors || []).forEach(key=>{
      const row = document.createElement('div');
      row.className = 'result-factor-row';
      const label = document.createElement('span');
      label.textContent = lang === 'en' ? 'Key factor' : 'Facteur déterminant';
      const val = document.createElement('span');
      val.textContent = labels[key] || key;
      row.appendChild(label); row.appendChild(val);
      factorsWrap.appendChild(row);
    });

    animateScore(data.score);
    document.querySelector('.form-step.active').classList.remove('active');
    document.getElementById('resultView').classList.add('show');
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    if(!validateStep(1)) return;

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = currentLang() === 'en' ? 'Sending…' : 'Envoi en cours…';

    const payload = {
      companyName: document.getElementById('companyName').value.trim(),
      sector: document.getElementById('sector').value.trim(),
      teamSize: document.getElementById('teamSize').value,
      contactName: document.getElementById('contactName').value.trim(),
      contactEmail: document.getElementById('contactEmail').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      message: document.getElementById('message').value.trim(),
      website: document.getElementById('honeypot').value, // spam trap, must stay empty
      emailVolume: answers.emailVolume,
      peopleInvolved: answers.peopleInvolved,
      manualTracking: answers.manualTracking,
      existingAutomation: answers.existingAutomation,
      timeLost: answers.timeLost
    };

    try{
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if(!res.ok) throw new Error('Request failed');
      const data = await res.json();
      renderResult(data);
    }catch(err){
      errorEl.textContent = currentLang() === 'en'
        ? "Something went wrong sending your form. Please try again or email us directly."
        : "Une erreur est survenue lors de l'envoi. Réessayez ou écrivez-nous directement par e-mail.";
      errorEl.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = currentLang() === 'en' ? 'Get my score' : 'Obtenir mon score';
    }
  });

  showStep(0);
})();
