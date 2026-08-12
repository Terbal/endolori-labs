(function(){
  const steps = document.querySelectorAll('.form-step');
  const progressEls = document.querySelectorAll('.form-progress span');
  const form = document.getElementById('leadForm');
  const errorEl = document.getElementById('formError');
  const nextBtn = document.querySelector('[data-next]');
  const prevBtn = document.getElementById('prevBtn');
  const submitBtn = document.getElementById('submitBtn');
  let current = 0;

  const answers = {
    emailVolume: null,
    peopleInvolved: null,
    manualTracking: null,
    existingAutomation: null,
    timeLost: null
  };

  function syncNav(){
    const lastStep = current === steps.length - 1;
    prevBtn.style.visibility = current === 0 ? 'hidden' : 'visible';
    nextBtn.style.display = lastStep ? 'none' : 'inline-flex';
    submitBtn.style.display = lastStep ? 'inline-flex' : 'none';
  }

  function showStep(i){
    steps.forEach((s, idx)=> s.classList.toggle('active', idx === i));
    progressEls.forEach((p, idx)=> p.classList.toggle('done', idx <= i));
    current = i;
    errorEl.classList.remove('show');
    syncNav();
  }

  function validateStep(i){
    if(i === 0){
      const companyName = document.getElementById('companyName').value.trim();
      const contactName = document.getElementById('contactName').value.trim();
      const contactEmail = document.getElementById('contactEmail').value.trim();
      const emailOk = /\S+@\S+\.\S+/.test(contactEmail);
      if(!companyName || !contactName || !emailOk){
        errorEl.textContent = currentLang() === 'en'
          ? 'Please fill in your company name, your name, and a valid email.'
          : 'Merci de renseigner le nom de votre entreprise, votre nom et un e-mail valide.';
        errorEl.classList.add('show');
        return false;
      }
    }
    if(i === 1){
      const missing = Object.keys(answers).filter(k => !answers[k]);
      if(missing.length){
        errorEl.textContent = currentLang() === 'en'
          ? 'Please answer every question to continue.'
          : 'Merci de répondre à toutes les questions pour continuer.';
        errorEl.classList.add('show');
        return false;
      }
    }
    return true;
  }

  nextBtn.addEventListener('click', ()=>{
    if(!validateStep(current)) return;
    if(current < steps.length - 1) showStep(current + 1);
  });
  prevBtn.addEventListener('click', ()=> showStep(Math.max(0, current - 1)));

  // option cards (single-select per group)
  document.querySelectorAll('.option-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      const group = card.dataset.group;
      document.querySelectorAll(`.option-card[data-group="${group}"]`).forEach(c=> c.classList.remove('selected'));
      card.classList.add('selected');
      answers[group] = card.dataset.value;
      errorEl.classList.remove('show');
    });
  });

  function currentLang(){
    return document.documentElement.lang === 'en' ? 'en' : 'fr';
  }

  // The visitor-facing confirmation is intentionally short and identical
  // regardless of the internal score — it honestly says we'll follow up
  // either way, with reasoning, and a possible next step if relevant.
  // The detailed score/bracket stays internal, visible only in /fortuna_major.
  const COPY = {
    fr: {
      modalTitle: "Merci !",
      message: "Nous avons bien reçu les informations sur votre organisation. Notre équipe les analyse et revient vers vous pour vous dire si une automatisation aurait du sens dans votre cas — en vous expliquant pourquoi, et si oui, avec une première piste de solution adaptée à votre fonctionnement.",
      emailModalTitle: "Écrivez-nous directement",
      emailModalBody: "Vous pouvez nous contacter à tout moment à l'adresse suivante :",
      emailModalBtn: "Ouvrir mon client mail"
    },
    en: {
      modalTitle: "Thank you!",
      message: "We've received the information about your organization. Our team will review it and get back to you on whether automation would make sense for you — explaining why, and if so, with an initial solution path tailored to how you work.",
      emailModalTitle: "Write to us directly",
      emailModalBody: "You can reach us any time at the following address:",
      emailModalBtn: "Open my mail client"
    }
  };

  function buildResultHtml(){
    const c = COPY[currentLang()];
    return `<p style="margin-bottom:0;">${c.message}</p>`;
  }

  function lockFormAndShowConfirmation(){
    const c = COPY[currentLang()];
    form.style.display = 'none';
    document.querySelectorAll('.form-progress').forEach(p => p.style.display = 'none');

    const confirmWrap = document.createElement('div');
    confirmWrap.className = 'confirm-wrap show';
    confirmWrap.innerHTML = `
      <div class="confirm-badge"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>
      <h2>${c.modalTitle}</h2>
      ${buildResultHtml()}
    `;
    form.parentNode.insertBefore(confirmWrap, form.nextSibling);

    // prevent any accidental back-navigation from resurfacing a submittable form
    try{ history.replaceState({ submitted: true }, '', window.location.pathname); }catch(e){}
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    if(!validateStep(1)) return;

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
      const API = window.ENDOLORI_API_BASE || '';
      const res = await fetch(API + '/api/leads', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if(!res.ok) throw new Error('Request failed');
      await res.json();

      const c = COPY[currentLang()];
      window.EndoloriModal.show(`<h3>${c.modalTitle}</h3>${buildResultHtml()}`, { dismissible: true });
      lockFormAndShowConfirmation();
    }catch(err){
      errorEl.textContent = currentLang() === 'en'
        ? "Something went wrong sending your form. Please try again or email us directly."
        : "Une erreur est survenue lors de l'envoi. Réessayez ou écrivez-nous directement par e-mail.";
      errorEl.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = currentLang() === 'en' ? 'Send' : 'Envoyer';
    }
  });

  // "Prefer email" link → popup with the address instead of a silent mailto jump
  const emailLink = document.getElementById('preferEmailLink');
  if(emailLink){
    emailLink.addEventListener('click', function(e){
      e.preventDefault();
      const c = COPY[currentLang()];
      const address = 'joelmoyo249@gmail.com';
      window.EndoloriModal.show(`
        <h3>${c.emailModalTitle}</h3>
        <p>${c.emailModalBody}</p>
        <p style="font-weight:600;color:var(--ink);">${address}</p>
        <a href="mailto:${address}" class="eo-modal-email-btn">${c.emailModalBtn}</a>
      `);
    });
  }

  showStep(0);
})();
