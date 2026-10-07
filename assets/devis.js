/* ==========================================================================
   CARSHERWASH — Devis en 5 étapes
   Estimation calculée en direct puis envoyée par Web3Forms.

   POUR MODIFIER UN TARIF : tout est dans l'objet TARIFS ci-dessous.
   Pensez à changer aussi le prix affiché dans devis.html (les <span
   class="wz-opt-price">) et sur les pages auto.html / mobilier.html.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('quoteForm');
  if (!form) return;

  /* ---------------------------------------------------------------- TARIFS */
  var TARIFS = {
    formules: {
      sieges:  { nom: 'Formule Sièges',  prix: 40, des: false },
      premium: {
        nom: 'Formule Premium',
        prix: 60,                       // valeur de repli si aucune catégorie n'est cochée
        parCategorie: {                 // le tarif Premium dépend du gabarit
          'Citadine / Berline': 60,
          'SUV / 4×4': 70,
          'Van / Monospace': 80
        }
      }
    },
    extras: {
      coffre:      { nom: 'Nettoyage coffre',           prix: 10, parVehicule: true },
      deplacement: { nom: 'Déplacement en dehors de Rennes', prix: 5,  parVehicule: false },
      salissures:  { nom: 'Poils / sable / moisissure', prix: 10, parVehicule: true, des: true }
    },
    meubles: {
      droit: {
        nom: 'Canapé droit',
        tailles: { 'Fauteuil': 30, '2 places': 40, '3 places': 50, '4 places': 60, '5 places': 70, '6 places': 80 }
      },
      angle: {
        nom: "Canapé d'angle",
        tailles: { '2 places': 50, '3 places': 60, '4 places': 70, '5 places': 80, '6 places': 90 }
      },
      matelas: {
        nom: 'Matelas',
        des: true,
        tailles: { '1 place': 35, '2 places': 50 }
      },
      chaise: {
        nom: 'Chaises / tabourets',
        des: true,
        tailles: { '1 chaise': 10, '2 chaises': 20, '3 chaises': 30, '4 chaises': 40, '6 chaises': 60 }
      },
      tapis: { nom: 'Tapis / moquette', surDevis: true }
    }
  };

  /* ----------------------------------------------------------------- ÉTAT */
  var etat = {
    type: null,        // 'Voiture' | 'Mobilier' | 'Les deux'
    nb: null,          // '1' | '2' | '3' | '4+'
    categories: [],
    formules: [],
    extras: [],
    meubles: [],
    tailles: {}        // { droit: '3 places', ... }
  };

  var etape = 1;
  var TOTAL_ETAPES = 5;
  var pret = false;   // pas de défilement avant la fin du chargement de la page

  var segments  = form.querySelectorAll('.wz-seg');
  var panneaux  = form.querySelectorAll('.wz-panel');
  var libEtape  = form.querySelector('[data-wz-step]');
  var libTitre  = form.querySelector('[data-wz-title]');
  var btnPrev   = form.querySelector('[data-prev]');
  var btnNext   = form.querySelector('[data-next]');
  var btnSend   = form.querySelector('[data-send]');
  var statut    = document.getElementById('formStatus');

  function auto() { return etat.type === 'Voiture' || etat.type === 'Les deux'; }
  function mob()  { return etat.type === 'Mobilier' || etat.type === 'Les deux'; }
  function nbVehicules() { return etat.nb === '4+' ? 4 : parseInt(etat.nb || '1', 10); }

  /* -------------------------------------------------------------- CALCUL */

  /* Tarif d'une formule pour un véhicule. Si plusieurs catégories sont cochées,
     on ne peut pas savoir laquelle va avec quel véhicule : on retient la moins
     chère et le total s'affiche alors en « dès ». */
  function prixUnitaire(f) {
    if (!f.parCategorie) return { prix: f.prix, approx: false, suffixe: '' };

    var connues = etat.categories.filter(function (c) { return f.parCategorie[c] != null; });
    if (!connues.length) return { prix: f.prix, approx: true, suffixe: '' };

    var prix = connues.map(function (c) { return f.parCategorie[c]; });
    var mini = Math.min.apply(null, prix);
    var maxi = Math.max.apply(null, prix);

    return {
      prix: mini,
      approx: mini !== maxi,
      suffixe: connues.length === 1 ? ' — ' + connues[0] : ''
    };
  }

  function calcul() {
    var lignes = [], total = 0, approx = false;
    var n = nbVehicules();
    if (etat.nb === '4+') approx = true;

    if (auto() && etat.nb) {
      lignes.push({
        label: etat.nb + (etat.nb === '1' ? ' véhicule' : ' véhicules') +
               (etat.categories.length ? ' — ' + etat.categories.join(', ') : ''),
        info: true
      });

      etat.formules.forEach(function (id) {
        var f = TARIFS.formules[id];
        var u = prixUnitaire(f);
        var sous = u.prix * n;
        if (f.des || u.approx) approx = true;
        lignes.push({ label: f.nom + u.suffixe + (n > 1 ? ' × ' + etat.nb : ''), prix: sous });
        total += sous;
      });

      etat.extras.forEach(function (id) {
        var e = TARIFS.extras[id];
        var mult = e.parVehicule ? n : 1;
        var sous = e.prix * mult;
        if (e.des) approx = true;
        lignes.push({ label: e.nom + (mult > 1 ? ' × ' + mult : ''), prix: sous });
        total += sous;
      });
    }

    if (mob()) {
      etat.meubles.forEach(function (id) {
        var m = TARIFS.meubles[id];
        if (m.surDevis) { lignes.push({ label: m.nom, devis: true }); return; }
        var taille = etat.tailles[id];
        if (!taille) return;
        var p = m.tailles[taille];
        if (m.des) approx = true;
        lignes.push({ label: m.nom + ' — ' + taille, prix: p });
        total += p;
      });
    }

    return { lignes: lignes, total: total, approx: approx };
  }

  function texteTotal(r) {
    var payantes = r.lignes.filter(function (l) { return typeof l.prix === 'number'; });
    if (!payantes.length) return 'Sur devis';
    return (r.approx ? 'dès ' : '') + r.total + '€';
  }

  /* ------------------------------------------------------- RÉCAPITULATIF */
  function majRecap() {
    var boite = form.querySelector('[data-recap]');
    var total = form.querySelector('[data-total]');
    if (!boite) return;

    var r = calcul();
    boite.innerHTML = '';

    if (!r.lignes.length) {
      var vide = document.createElement('p');
      vide.className = 'wz-empty';
      vide.textContent = 'Aucune prestation sélectionnée.';
      boite.appendChild(vide);
    } else {
      r.lignes.forEach(function (l) {
        var ligne = document.createElement('div');
        ligne.className = 'wz-line';
        var g = document.createElement('span');
        g.textContent = l.label;
        var d = document.createElement('b');
        d.textContent = l.devis ? 'Sur devis' : (l.info ? '' : l.prix + '€');
        ligne.appendChild(g);
        ligne.appendChild(d);
        boite.appendChild(ligne);
      });
    }

    if (total) total.textContent = texteTotal(r);
  }

  /* ------------------------------------------ TAILLES DE MOBILIER (ét. 3) */
  function construireTailles() {
    var boite = form.querySelector('[data-mob-sizes]');
    if (!boite) return;
    boite.innerHTML = '';

    etat.meubles.forEach(function (id) {
      var m = TARIFS.meubles[id];
      var ligne = document.createElement('div');
      ligne.className = 'wz-opt is-on';
      ligne.style.cursor = 'default';

      var nom = document.createElement('span');
      nom.className = 'wz-opt-name';
      nom.textContent = m.nom;
      ligne.appendChild(nom);

      var prix = document.createElement('span');
      prix.className = 'wz-opt-price';

      if (m.surDevis) {
        prix.textContent = 'Sur devis';
      } else {
        var select = document.createElement('select');
        select.setAttribute('data-taille', id);
        select.setAttribute('aria-label', 'Taille — ' + m.nom);

        var vide = document.createElement('option');
        vide.value = '';
        vide.textContent = 'Choisir…';
        select.appendChild(vide);

        Object.keys(m.tailles).forEach(function (t) {
          var o = document.createElement('option');
          o.value = t;
          o.textContent = t + ' — ' + m.tailles[t] + '€';
          select.appendChild(o);
        });

        if (etat.tailles[id]) select.value = etat.tailles[id];

        select.addEventListener('change', function () {
          if (select.value) {
            etat.tailles[id] = select.value;
            prix.textContent = m.tailles[select.value] + '€';
          } else {
            delete etat.tailles[id];
            prix.textContent = '—';
          }
          majBoutons();
          majRecap();
        });

        ligne.appendChild(select);
        prix.textContent = etat.tailles[id] ? m.tailles[etat.tailles[id]] + '€' : '—';
      }

      ligne.appendChild(prix);
      boite.appendChild(ligne);
    });
  }

  /* ---------------------------------------------------------- VALIDATION */
  function champ(id) { return document.getElementById(id); }
  function rempli(id) { var c = champ(id); return c && c.value.trim().length > 0; }

  function etapeValide(n) {
    if (n === 1) return !!etat.type;

    if (n === 2) {
      if (auto() && (!etat.nb || !etat.categories.length)) return false;
      if (mob() && !etat.meubles.length) return false;
      return true;
    }

    if (n === 3) {
      if (auto() && !etat.formules.length) return false;
      if (mob()) {
        var manquante = etat.meubles.some(function (id) {
          return !TARIFS.meubles[id].surDevis && !etat.tailles[id];
        });
        if (manquante) return false;
      }
      return true;
    }

    if (n === 4) {
      if (!rempli('q-prenom') || !rempli('q-nom') || !rempli('q-tel') ||
          !rempli('q-cp') || !rempli('q-ville')) return false;
      var email = champ('q-email');
      if (email && email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) return false;
      var tel = champ('q-tel').value.replace(/[^\d+]/g, '');
      return tel.length >= 9;
    }

    return true;
  }

  /* -------------------------------------------------------- AFFICHAGE UI */
  function titreEtape(n) {
    if (n === 2) {
      if (etat.type === 'Mobilier') return 'Mobilier';
      if (etat.type === 'Les deux') return 'Véhicules & mobilier';
      return 'Véhicules';
    }
    var panneau = form.querySelector('[data-panel="' + n + '"]');
    return panneau ? panneau.getAttribute('data-name') : '';
  }

  function majBoutons() {
    btnPrev.disabled = (etape === 1);
    var dernier = (etape === TOTAL_ETAPES);
    btnNext.hidden = dernier;
    btnSend.hidden = !dernier;
    btnNext.disabled = !etapeValide(etape);
  }

  function afficher(n) {
    etape = n;

    panneaux.forEach(function (p) {
      p.hidden = (parseInt(p.getAttribute('data-panel'), 10) !== n);
    });

    /* Blocs voiture / mobilier selon le type choisi */
    form.querySelectorAll('.wz-panel [data-block="auto"]').forEach(function (b) { b.hidden = !auto(); });
    form.querySelectorAll('.wz-panel [data-block="mobilier"]').forEach(function (b) { b.hidden = !mob(); });

    segments.forEach(function (s, i) { s.classList.toggle('is-done', i < n); });
    libEtape.textContent = 'ÉTAPE ' + n + ' / ' + TOTAL_ETAPES;
    libTitre.textContent = titreEtape(n);

    if (n === 3) construireTailles();
    if (n === 5) majRecap();

    /* On efface un éventuel message d'erreur dès qu'on bouge d'étape */
    if (statut && statut.classList.contains('err')) {
      statut.className = 'form-status';
      statut.textContent = '';
    }

    majBoutons();
    if (pret) centrer();
  }

  /* --------------------------------------------------- CENTRAGE À L'ÉCRAN
     À chaque étape, la carte du devis entière (barre d'étapes, question,
     choix, boutons et « Vous préférez appeler ? ») glisse en douceur dans
     la partie visible de l'écran, entre le menu du haut et la barre
     « Appelez-nous » du bas sur téléphone. Elle est centrée, avec au plus
     MARGE_HAUT pixels d'espace sous le menu sur les grands écrans. Si elle
     est plus grande que l'écran, son haut s'aligne juste sous le menu. */
  var MARGE_HAUT = 88;

  function hauteurVisible(el) {
    if (!el) return 0;
    var st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return 0;
    return el.getBoundingClientRect().height;
  }

  function centrer() {
    var haut = 0;
    for (var el = form; el; el = el.offsetParent) haut += el.offsetTop;   // ignore l'animation d'apparition
    var hauteur = form.offsetHeight;

    var menu  = hauteurVisible(document.querySelector('.site-header'));
    var barre = hauteurVisible(document.querySelector('.action-bar'));
    var dispo = window.innerHeight - menu - barre;

    var cible = (hauteur + 24 <= dispo)
      ? haut - menu - Math.min((dispo - hauteur) / 2, MARGE_HAUT)
      : haut - menu - 12;
    cible = Math.max(0, Math.round(cible));

    if (Math.abs(window.pageYOffset - cible) < 4) return;
    var doux = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    window.scrollTo({ top: cible, behavior: doux ? 'smooth' : 'auto' });
  }

  /* ------------------------------------------------------------- CHOIX 1 */
  form.querySelectorAll('[data-choice]').forEach(function (groupe) {
    var cle = groupe.getAttribute('data-choice');
    groupe.querySelectorAll('.wz-choice').forEach(function (bouton) {
      bouton.addEventListener('click', function () {
        groupe.querySelectorAll('.wz-choice').forEach(function (b) { b.classList.remove('is-on'); });
        bouton.classList.add('is-on');
        etat[cle] = bouton.getAttribute('data-value');
        majBoutons();
      });
    });
  });

  /* ------------------------------------------------------- CASES À COCHER */
  var groupes = { categorie: 'categories', formule: 'formules', extra: 'extras', meuble: 'meubles' };

  Object.keys(groupes).forEach(function (nomGroupe) {
    var cle = groupes[nomGroupe];
    form.querySelectorAll('[data-group="' + nomGroupe + '"] .wz-native').forEach(function (input) {
      input.addEventListener('change', function () {
        var valeur = input.getAttribute('data-value');
        var ligne = input.closest('.wz-opt');
        ligne.classList.toggle('is-on', input.checked);

        var i = etat[cle].indexOf(valeur);
        if (input.checked && i === -1) etat[cle].push(valeur);
        if (!input.checked && i !== -1) {
          etat[cle].splice(i, 1);
          if (cle === 'meubles') delete etat.tailles[valeur];
        }
        majBoutons();
      });
    });
  });

  /* Le bouton Suivant se réactive dès que les coordonnées sont valides */
  form.querySelectorAll('[data-panel="4"] input').forEach(function (c) {
    c.addEventListener('input', majBoutons);
  });

  /* La touche Entrée dans un champ fait passer à l'étape suivante,
     elle n'envoie jamais le formulaire au milieu du parcours. */
  form.querySelectorAll('input').forEach(function (c) {
    c.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (!btnNext.hidden && !btnNext.disabled) btnNext.click();
    });
  });

  /* ------------------------------------------------------------ NAVIGATION */
  btnNext.addEventListener('click', function () {
    if (!etapeValide(etape)) return;
    if (etape < TOTAL_ETAPES) afficher(etape + 1);
  });

  btnPrev.addEventListener('click', function () {
    if (etape > 1) afficher(etape - 1);
  });

  /* ------------------------------------------------- PRÉ-SÉLECTION ?pack= */
  var pack = new URLSearchParams(window.location.search).get('pack');
  if (pack) {
    var correspondances = {
      'Formule Sièges (40€)': { type: 'Voiture', groupe: 'formule', valeur: 'sieges' },
      'Formule Premium (60€)':    { type: 'Voiture', groupe: 'formule', valeur: 'premium' },
      'Canapé droit':             { type: 'Mobilier', groupe: 'meuble', valeur: 'droit' },
      "Canapé d'angle":           { type: 'Mobilier', groupe: 'meuble', valeur: 'angle' },
      'Autres textiles (matelas, chaises, tapis)': { type: 'Mobilier' },
      'Nettoyage mobilier':       { type: 'Mobilier' }
    };
    var m = correspondances[pack];
    if (m) {
      var bouton = form.querySelector('[data-choice="type"] [data-value="' + m.type + '"]');
      if (bouton) bouton.click();
      if (m.groupe) {
        var input = form.querySelector('[data-group="' + m.groupe + '"] [data-value="' + m.valeur + '"]');
        if (input) { input.checked = true; input.dispatchEvent(new Event('change')); }
      }
    }
  }

  /* ------------------------------------------------------------- ENVOI */
  /* Adresse du script Google (Extensions > Apps Script > Déployer). */
  var GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbw0XLHWQ9EupXNF-Z_ZokzdYeKebs_uMX_GnJDIIPLuInyD-J6exVrlWbLWSo3wTSUV/exec';

  function champCache(nom, valeur) {
    var input = form.querySelector('input[type="hidden"][name="' + nom + '"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = nom;
      form.appendChild(input);
    }
    input.value = valeur;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    /* Verrou : aucune demande ne part tant que les 5 étapes ne sont pas
       complètes. On ramène le visiteur sur la première étape incomplète. */
    for (var n = 1; n <= TOTAL_ETAPES; n++) {
      if (!etapeValide(n)) {
        afficher(n);
        if (statut) {
          statut.className = 'form-status err';
          statut.textContent = 'Complétez l’étape ' + n + ' sur ' + TOTAL_ETAPES + ' avant d’envoyer votre demande.';
        }
        return;
      }
    }

    /* Toutes les étapes sont valides mais on n'est pas au récapitulatif :
       on l'affiche pour que le visiteur vérifie avant d'envoyer. */
    if (etape !== TOTAL_ETAPES) {
      afficher(TOTAL_ETAPES);
      return;
    }

    var r = calcul();

    champCache('Prestation', etat.type || '—');
    champCache('Véhicules', auto()
      ? etat.nb + ' — ' + (etat.categories.join(', ') || 'catégorie non précisée')
      : '—');
    champCache('Formules voiture', auto()
      ? (etat.formules.map(function (id) { return TARIFS.formules[id].nom; }).join(', ') || '—')
      : '—');
    champCache('Extras', auto()
      ? (etat.extras.map(function (id) { return TARIFS.extras[id].nom; }).join(', ') || 'aucun')
      : '—');
    champCache('Mobilier', mob()
      ? (etat.meubles.map(function (id) {
          var mm = TARIFS.meubles[id];
          return mm.nom + (mm.surDevis ? ' (sur devis)' : ' — ' + (etat.tailles[id] || '?'));
        }).join(' | ') || '—')
      : '—');
    champCache('Détail du devis', r.lignes.map(function (l) {
      return l.label + (l.devis ? ' : sur devis' : (l.info ? '' : ' : ' + l.prix + '€'));
    }).join(' | '));
    champCache('Total estimé', texteTotal(r));
    champCache('Provenance', window.cwProvenance ? window.cwProvenance() : '—');

    var original = btnSend.textContent;
    btnSend.disabled = true;
    btnSend.textContent = 'Envoi en cours...';
    if (statut) { statut.className = 'form-status'; statut.textContent = ''; }

    /* Copie de la demande dans le Google Sheet de Carsherwash (en plus du mail).
       Envoyée même si le mail échoue, pour ne perdre aucun client. */
    if (GOOGLE_SHEET_URL && !form.querySelector('[name="botcheck"]:checked')) {
      var copie = new URLSearchParams();
      new FormData(form).forEach(function (v, k) {
        if (k !== 'access_key' && k !== 'botcheck') copie.append(k, v);
      });
      fetch(GOOGLE_SHEET_URL, { method: 'POST', mode: 'no-cors', body: copie }).catch(function () {});
    }

    fetch('https://api.web3forms.com/submit', { method: 'POST', body: new FormData(form) })
      .then(function (rep) { return rep.json(); })
      .then(function (json) {
        if (!json.success) throw new Error(json.message || 'Erreur');
        if (statut) {
          statut.className = 'form-status ok';
          statut.textContent = 'Merci ! Votre demande est bien envoyée, on vous recontacte rapidement.';
        }
        btnSend.hidden = true;
        if (window.cwSuivi) window.cwSuivi('Devis envoyé', { prestation: etat.type || '—' });
        btnPrev.disabled = true;
      })
      .catch(function () {
        if (statut) {
          statut.className = 'form-status err';
          statut.innerHTML = 'Envoi impossible pour le moment. Appelez-nous au <a href="tel:+33627945361">06 27 94 53 61</a>.';
        }
      })
      .finally(function () {
        btnSend.disabled = false;
        btnSend.textContent = original;
      });
  });

  afficher(1);
  pret = true;

  /* À l'arrivée sur la page (bouton « Estimer mon devis »…), la première
     question s'affiche directement au centre, sans avoir à descendre. */
  if (!window.location.hash) {
    if (document.readyState === 'complete') setTimeout(centrer, 150);
    else window.addEventListener('load', function () { setTimeout(centrer, 150); });
    /* Retour sur la page avec le bouton « Précédent » du navigateur */
    window.addEventListener('pageshow', function (e) { if (e.persisted) setTimeout(centrer, 150); });
  }
})();
