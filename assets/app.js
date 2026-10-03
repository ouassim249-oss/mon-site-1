/* ==========================================================================
   Carsherwash — scripts communs
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Fond animé : bulles + parallaxe au défilement ----------
     23 bulles réparties sur 3 plans de profondeur. Chaque plan se décale
     à sa propre vitesse quand on fait défiler la page : les grosses bulles
     (au premier plan) bougent plus que les petites (au fond), ce qui donne
     la sensation de relief. Le tout est construit ici pour qu'aucune page
     HTML n'ait à porter ce balisage. */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduceMotion && !document.querySelector('.fx')) {
    /* Volontairement discret : peu de bulles, petites et lentes. Un fond
       trop animé attire l'œil au détriment des tarifs et du devis. */
    var plans = [
      { nombre: 7, taille: [5, 12],  duree: [38, 54], vitesse: 0.04 }, // arrière-plan
      { nombre: 5, taille: [10, 20], duree: [30, 44], vitesse: 0.09 }, // plan médian
      { nombre: 3, taille: [18, 30], duree: [24, 36], vitesse: 0.16 }  // premier plan
    ];

    function entre(min, max) { return min + Math.random() * (max - min); }

    var fx = document.createElement('div');
    fx.className = 'fx';
    fx.setAttribute('aria-hidden', 'true');

    var couches = plans.map(function (plan) {
      var couche = document.createElement('div');
      couche.className = 'fx-depth';
      couche.dataset.vitesse = plan.vitesse;

      for (var i = 0; i < plan.nombre; i++) {
        var bulle = document.createElement('span');
        bulle.style.setProperty('--size', entre(plan.taille[0], plan.taille[1]).toFixed(0) + 'px');
        bulle.style.setProperty('--left', entre(0, 98).toFixed(1) + '%');
        bulle.style.setProperty('--dur', entre(plan.duree[0], plan.duree[1]).toFixed(1) + 's');
        bulle.style.setProperty('--delay', (-entre(0, 30)).toFixed(1) + 's');
        bulle.style.setProperty('--drift', entre(-9, 9).toFixed(1) + 'vw');
        couche.appendChild(bulle);
      }

      fx.appendChild(couche);
      return couche;
    });

    document.body.appendChild(fx);

    /* On n'écrit que des transform (aucune lecture de mise en page),
       donc le calcul direct dans l'écouteur de défilement ne coûte rien. */
    function deplacerCouches() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      couches.forEach(function (couche) {
        couche.style.transform =
          'translate3d(0,' + (-y * parseFloat(couche.dataset.vitesse)).toFixed(1) + 'px,0)';
      });
    }
    window.addEventListener('scroll', deplacerCouches, { passive: true });
    window.addEventListener('resize', deplacerCouches, { passive: true });
    deplacerCouches();
  }

  /* ---------- Carrousels au doigt : barre de progression ----------
     Sur téléphone, les cartes .swipe défilent de côté. La petite barre
     située juste après indique où l'on en est. Sur ordinateur, les cartes
     sont en grille et la barre reste cachée par le CSS. */
  document.querySelectorAll('.swipe').forEach(function (piste) {
    var barre = piste.nextElementSibling;
    if (!barre || !barre.classList.contains('swipe-bar')) return;
    var curseur = barre.querySelector('span');

    function majBarre() {
      var total = piste.scrollWidth;
      var visible = piste.clientWidth;
      if (total <= visible + 2) { barre.style.visibility = 'hidden'; return; }
      barre.style.visibility = '';
      var part = visible / total;
      curseur.style.width = (part * 100) + '%';
      curseur.style.left = ((piste.scrollLeft / (total - visible)) * (1 - part) * 100) + '%';
    }

    piste.addEventListener('scroll', majBarre, { passive: true });
    window.addEventListener('resize', majBarre, { passive: true });
    majBarre();
  });

  /* ---------- Menu mobile ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', links.classList.contains('open'));
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') links.classList.remove('open');
    });
  }

  /* ---------- Apparition au scroll ----------
     Le masquage n'est appliqué que si le JS tourne (classe sur <html>),
     pour que le contenu reste visible sans JavaScript. */
  document.documentElement.classList.add('js');

  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  function revealVisible() {
    var bottom = window.innerHeight || document.documentElement.clientHeight;
    reveals = reveals.filter(function (el) {
      if (el.classList.contains('visible')) return false;
      if (el.getBoundingClientRect().top < bottom - 40) {
        el.classList.add('visible');
        return false;
      }
      return true;
    });
  }

  if (reveals.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          /* visible si l'élément entre dans l'écran, ou s'il est déjà passé
             au-dessus (saut d'ancre, scroll instantané, retour arrière) */
          if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      reveals.forEach(function (el) { io.observe(el); });
    }

    /* Filet de sécurité : si l'observateur ne se déclenche pas
       (onglet en arrière-plan, navigateur ancien), le scroll prend le relais. */
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      setTimeout(function () { revealVisible(); ticking = false; }, 80);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('pageshow', revealVisible);
    setTimeout(revealVisible, 1200);
    revealVisible();
  }

  /* ---------- Comparateur avant / après ---------- */
  document.querySelectorAll('[data-ba]').forEach(function (root) {
    var frame = root.querySelector('.ba-frame');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.ba-slide'));
    var handle = root.querySelector('.ba-handle');
    var capTitle = root.querySelector('[data-ba-title]');
    var capSub = root.querySelector('[data-ba-sub]');
    var prev = root.querySelector('[data-ba-prev]');
    var next = root.querySelector('[data-ba-next]');
    var dotsBox = root.querySelector('[data-ba-dots]');
    var index = 0;
    var dragging = false;

    if (!frame || !slides.length) return;

    /* Une seule photo : pas de flèches ni de points à afficher.
       Ils réapparaissent tout seuls dès qu'on ajoute une deuxième .ba-slide. */
    var nav = root.querySelector('.ba-nav');
    if (nav) nav.hidden = (slides.length < 2);

    /* Points de navigation */
    var dots = [];
    if (dotsBox && slides.length > 1) {
      slides.forEach(function (_, i) {
        var d = document.createElement('button');
        d.className = 'ba-dot' + (i === 0 ? ' is-active' : '');
        d.type = 'button';
        d.setAttribute('aria-label', 'Photo ' + (i + 1));
        d.addEventListener('click', function () { show(i); });
        dotsBox.appendChild(d);
        dots.push(d);
      });
    }

    function setPosition(pct) {
      pct = Math.max(0, Math.min(100, pct));
      slides.forEach(function (s) {
        var wrap = s.querySelector('.ba-after-wrap');
        if (wrap) wrap.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      });
      if (handle) handle.style.left = pct + '%';
    }

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.classList.toggle('is-active', n === index); });
      dots.forEach(function (d, n) { d.classList.toggle('is-active', n === index); });
      var active = slides[index];
      if (capTitle) capTitle.textContent = active.getAttribute('data-title') || '';
      if (capSub) capSub.textContent = active.getAttribute('data-sub') || '';
      setPosition(50);
    }

    function pointerPct(clientX) {
      var r = frame.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * 100;
    }

    function onMove(e) {
      if (!dragging) return;
      var x = e.touches ? e.touches[0].clientX : e.clientX;
      setPosition(pointerPct(x));
      if (e.cancelable && e.touches) e.preventDefault();
    }

    function startDrag(e) {
      /* Sans ce preventDefault, le navigateur démarre son propre
         glisser-déposer de l'image et le curseur se fige en plein mouvement. */
      if (e.cancelable && !e.touches) e.preventDefault();
      dragging = true;
      var x = e.touches ? e.touches[0].clientX : e.clientX;
      setPosition(pointerPct(x));
    }

    function endDrag() { dragging = false; }

    /* Ceinture et bretelles : les photos ne sont plus déplaçables du tout */
    frame.querySelectorAll('img').forEach(function (img) {
      img.draggable = false;
    });
    frame.addEventListener('dragstart', function (e) { e.preventDefault(); });

    frame.addEventListener('mousedown', startDrag);
    frame.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);
    window.addEventListener('touchcancel', endDrag);
    /* Si on relâche hors de la fenêtre, ou qu'on change d'onglet en plein
       glissement, le curseur ne doit pas rester « collé » à la souris. */
    window.addEventListener('blur', endDrag);
    document.addEventListener('mouseleave', endDrag);

    /* Pas de suivi au survol : le curseur ne bouge que si on le fait glisser
       (clic maintenu à la souris, ou doigt sur mobile). */

    if (prev) prev.addEventListener('click', function () { show(index - 1); });
    if (next) next.addEventListener('click', function () { show(index + 1); });

    /* Flèches clavier */
    frame.setAttribute('tabindex', '0');
    frame.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { show(index - 1); }
      if (e.key === 'ArrowRight') { show(index + 1); }
    });

    show(0);
  });

  /* ---------- FAQ ---------- */
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var answer = item.querySelector('.faq-a');
      var isOpen = item.classList.contains('open');
      item.classList.toggle('open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
      answer.style.maxHeight = isOpen ? null : answer.scrollHeight + 'px';
    });
  });

  /* Le formulaire de devis en 5 étapes est géré par assets/devis.js */

  /* ---------- Statistiques (Vercel Web Analytics) ----------
     Les pages vues et les sites d'origine sont comptés automatiquement par
     le script Vercel chargé dans chaque page. Ici on ajoute :
     - la provenance du visiteur, retenue dès sa première page (Google,
       Facebook, lien ?utm_source=... d'une pub ou d'un flyer, ou "direct")
       pour la joindre aux demandes de devis ;
     - un événement à chaque clic sur Appeler ou SMS. */
  function provenance() {
    var cle = 'cw-provenance';
    try {
      var connue = sessionStorage.getItem(cle);
      if (connue) return connue;
    } catch (e) { /* stockage bloqué : on recalcule à chaque page */ }

    var params = new URLSearchParams(location.search);
    var source = params.get('utm_source');
    var valeur;
    if (source) {
      valeur = source + (params.get('utm_medium') ? ' / ' + params.get('utm_medium') : '')
        + (params.get('utm_campaign') ? ' / ' + params.get('utm_campaign') : '');
    } else if (document.referrer && new URL(document.referrer).host !== location.host) {
      valeur = new URL(document.referrer).host.replace(/^www\./, '');
    } else {
      valeur = 'direct';
    }
    valeur += ' (arrivée sur ' + (location.pathname.replace(/^\//, '') || 'accueil') + ')';
    try { sessionStorage.setItem(cle, valeur); } catch (e) {}
    return valeur;
  }

  window.cwProvenance = provenance;
  window.cwSuivi = function (nom, donnees) {
    if (typeof window.va !== 'function') return;
    var data = { page: location.pathname || '/', provenance: provenance().slice(0, 250) };
    for (var k in donnees) data[k] = donnees[k];
    window.va('event', { name: nom, data: data });
  };

  provenance();

  document.addEventListener('click', function (e) {
    var lien = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]');
    if (!lien) return;
    window.cwSuivi(lien.getAttribute('href').indexOf('tel:') === 0 ? 'Appel' : 'SMS');
  });

  /* ---------- Année automatique dans le pied de page ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
