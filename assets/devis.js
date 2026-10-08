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
        nom: 'Formule Premium (coffre inclus)',
        prix: 60,                       // valeur de repli si aucune catégorie n'est cochée
        parCategorie: {                 // le tarif Premium dépend du gabarit
          'Citadine / Berline': 60,
          'SUV / 4×4': 70,
          'Van / Monospace': 80
        }
      }
    },
    extras: {
      salissures:  { nom: 'Poils / sable / moisissure', prix: 10, parVehicule: true }
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
        tailles: { '1 place': 35, '2 places': 50 }
      },
      chaise: {
        nom: 'Chaises / tabourets',
        tailles: { '1 chaise': 10, '2 chaises': 20, '3 chaises': 30, '4 chaises': 40, '6 chaises': 60 }
      },
      tapis: { nom: 'Tapis / moquette', surDevis: true }
    }
  };

  /* ----------------------------------------------------------------- ÉTAT */
  var etat = {
    type: null,        // 'Voiture' | 'Mobilier' | 'Les deux'
    nb: null,          // nombre total de véhicules (texte), null si aucun
    categories: [],    // types ayant au moins un véhicule
    compte: {},        // { 'SUV / 4×4': 1, 'Van / Monospace': 1, ... }
    formules: [],      // formules choisies (au moins un véhicule)
    extras: [],
    choix: {},         // { 'SUV / 4×4': { sieges: 0, premium: 1, salissures: 0 }, ... }
    meubles: [],
    tailles: {},       // { droit: '3 places', ... }
    depl: null         // prix du déplacement calculé depuis l'adresse (assets/deplacement.js)
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

  /* Adresse d'intervention : le prix du déplacement est calculé dès que
     le client choisit son adresse dans la liste. */
  var champAdresse = document.getElementById('q-adresse');
  if (champAdresse && window.cwDeplacement) {
    window.cwDeplacement.attacher(champAdresse, {
      resultat: form.querySelector('[data-addr-result]'),
      change: function (r) { etat.depl = r; majBoutons(); if (etape === TOTAL_ETAPES) majRecap(); }
    });
  }

  function auto() { return etat.type === 'Voiture' || etat.type === 'Les deux'; }
  function mob()  { return etat.type === 'Mobilier' || etat.type === 'Les deux'; }
  function nbVehicules() { return parseInt(etat.nb || '0', 10); }

  /* « 1 SUV / 4×4, 1 Van / Monospace » */
  function detailVehicules() {
    return etat.categories.map(function (c) { return etat.compte[c] + ' ' + c; }).join(', ');
  }

  /* -------------------------------------------------------------- CALCUL */

  /* Prix d'une formule pour un véhicule d'un type donné (Premium : 60, 70
     ou 80€ selon le gabarit). */
  function prixFormule(f, cat) {
    return f.parCategorie && f.parCategorie[cat] != null ? f.parCategorie[cat] : f.prix;
  }

  function choixDe(cat) {
    if (!etat.choix[cat]) etat.choix[cat] = { sieges: 0, premium: 0, salissures: 0 };
    return etat.choix[cat];
  }

  /* Recalcule les listes de formules / extras choisies (mail, validation) */
  function majListesAuto() {
    etat.formules = Object.keys(TARIFS.formules).filter(function (id) {
      return etat.categories.some(function (c) { return choixDe(c)[id] > 0; });
    });
    etat.extras = Object.keys(TARIFS.extras).filter(function (id) {
      return etat.categories.some(function (c) { return choixDe(c)[id] > 0; });
    });
  }

  /* « SUV / 4×4 : 1 Premium | Van / Monospace : 1 Sièges + poils » */
  function detailFormules() {
    return etat.categories.map(function (c) {
      var ch = choixDe(c);
      var parts = Object.keys(TARIFS.formules).filter(function (id) { return ch[id]; })
        .map(function (id) { return ch[id] + ' ' + TARIFS.formules[id].nom; });
      Object.keys(TARIFS.extras).forEach(function (id) {
        if (ch[id]) parts.push(ch[id] + ' avec ' + TARIFS.extras[id].nom.toLowerCase());
      });
      return c + ' : ' + (parts.join(', ') || '—');
    }).join(' | ');
  }

  function calcul() {
    var lignes = [], total = 0;
    var n = nbVehicules();

    if (auto() && etat.nb) {
      lignes.push({
        label: n + (n === 1 ? ' véhicule' : ' véhicules') + ' — ' + detailVehicules(),
        info: true
      });

      /* Une ligne par formule et par type de véhicule */
      etat.categories.forEach(function (c) {
        var ch = choixDe(c);
        Object.keys(TARIFS.formules).forEach(function (id) {
          var k = ch[id];
          if (!k) return;
          var f = TARIFS.formules[id];
          var sous = prixFormule(f, c) * k;
          lignes.push({ label: f.nom + ' — ' + c + (k > 1 ? ' × ' + k : ''), prix: sous });
          total += sous;
        });
      });

      Object.keys(TARIFS.extras).forEach(function (id) {
        var k = etat.categories.reduce(function (s, c) { return s + (choixDe(c)[id] || 0); }, 0);
        if (!k) return;
        var e = TARIFS.extras[id];
        var sous = e.prix * k;
        lignes.push({ label: e.nom + (k > 1 ? ' × ' + k : ''), prix: sous });
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
        lignes.push({ label: m.nom + ' — ' + taille, prix: p });
        total += p;
      });
    }

    /* Déplacement (voiture et mobilier) */
    if (lignes.length) {
      var d = etat.depl ||
        (window.cwDeplacement && champAdresse ? window.cwDeplacement.deviner(champAdresse.value) : null);
      if (!d) {
        lignes.push({ label: 'Déplacement', texte: 'À confirmer' });
      } else if (d.surDevis) {
        lignes.push({ label: 'Déplacement — ' + d.commune, devis: true });
      } else if (d.offert) {
        lignes.push({ label: 'Déplacement — ' + d.commune, texte: 'Offert' });
      } else {
        lignes.push({ label: 'Déplacement — ' + d.commune, prix: d.prix });
        total += d.prix;
      }
    }

    return { lignes: lignes, total: total };
  }

  function texteTotal(r) {
    var payantes = r.lignes.filter(function (l) { return typeof l.prix === 'number'; });
    if (!payantes.length) return 'Sur devis';
    return r.total + '€';
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
        d.textContent = l.texte || (l.devis ? 'Sur devis' : (l.info ? '' : l.prix + '€'));
        ligne.appendChild(g);
        ligne.appendChild(d);
        boite.appendChild(ligne);
      });
    }

    if (total) total.textContent = texteTotal(r);
  }

  /* --------------------------------------- FORMULES PAR VÉHICULE (ét. 3)
     Pour chaque type de véhicule choisi à l'étape 2 : combien en Sièges,
     combien en Premium, combien avec poils / sable / moisissure. */
  var formulePack = null;    // formule pré-choisie depuis un bouton « Réserver »

  function compteur(nom, sousTitre, prix, valeur, peutAjouter, change) {
    var ligne = document.createElement('div');
    ligne.className = 'wz-opt wz-count' + (valeur ? ' is-on' : '');

    var n = document.createElement('span');
    n.className = 'wz-opt-name';
    n.textContent = nom;
    if (sousTitre) {
      var small = document.createElement('small');
      small.textContent = sousTitre;
      n.appendChild(small);
    }
    var p = document.createElement('span');
    p.className = 'wz-opt-price';
    p.textContent = prix;

    var ctl = document.createElement('div');
    ctl.className = 'wz-count-ctl';
    var moins = document.createElement('button');
    moins.type = 'button'; moins.className = 'wz-count-btn'; moins.setAttribute('data-moins', '');
    moins.textContent = '−'; moins.setAttribute('aria-label', 'Retirer — ' + nom);
    moins.disabled = !valeur;
    var val = document.createElement('output');
    val.className = 'wz-count-val';
    val.textContent = valeur;
    var plus = document.createElement('button');
    plus.type = 'button'; plus.className = 'wz-count-btn'; plus.setAttribute('data-plus', '');
    plus.textContent = '+'; plus.setAttribute('aria-label', 'Ajouter — ' + nom);
    plus.disabled = !peutAjouter;
    moins.addEventListener('click', function () { change(-1); });
    plus.addEventListener('click', function () { change(1); });
    ctl.appendChild(moins); ctl.appendChild(val); ctl.appendChild(plus);

    ligne.appendChild(n);
    ligne.appendChild(p);
    ligne.appendChild(ctl);
    return ligne;
  }

  function construireFormules() {
    var boite = form.querySelector('[data-formules-auto]');
    if (!boite) return;
    boite.innerHTML = '';

    etat.categories.forEach(function (c) {
      var nb = etat.compte[c];
      var ch = choixDe(c);
      /* Le nombre de véhicules a pu baisser à l'étape 2 */
      ['premium', 'sieges', 'salissures'].forEach(function (id) {
        var autres = id === 'salissures' ? 0 : (id === 'premium' ? ch.sieges : ch.premium);
        ch[id] = Math.max(0, Math.min(ch[id], nb - autres));
      });
      if (formulePack && !ch.sieges && !ch.premium) ch[formulePack] = nb;
      var places = nb - ch.sieges - ch.premium;

      var titre = document.createElement('p');
      titre.className = 'wz-sub';
      titre.textContent = nb + ' ' + c;
      boite.appendChild(titre);

      var reste = document.createElement('p');
      reste.className = 'wz-hint wz-count-reste' + (places ? '' : ' is-ok');
      reste.textContent = places
        ? 'Choisissez une formule pour ' + (places === nb ? (nb > 1 ? 'chaque véhicule' : 'ce véhicule') : 'encore ' + places + ' véhicule' + (places > 1 ? 's' : '')) + '.'
        : (nb > 1 ? 'Chaque véhicule a sa formule.' : 'Formule choisie.');

      var groupe = document.createElement('div');
      groupe.className = 'wz-opts';
      Object.keys(TARIFS.formules).forEach(function (id) {
        var f = TARIFS.formules[id];
        groupe.appendChild(compteur(
          id === 'premium' ? 'Formule Premium' : f.nom,
          id === 'premium' ? 'coffre inclus' : '',
          prixFormule(f, c) + '€',
          ch[id], places > 0,
          function (d) { ch[id] = Math.max(0, ch[id] + d); apresChoix(); }
        ));
      });
      Object.keys(TARIFS.extras).forEach(function (id) {
        var e = TARIFS.extras[id];
        groupe.appendChild(compteur(
          e.nom, 'en option', '+' + e.prix + '€',
          ch[id], ch[id] < nb,
          function (d) { ch[id] = Math.max(0, ch[id] + d); apresChoix(); }
        ));
      });
      boite.appendChild(groupe);
      boite.appendChild(reste);
    });
    majListesAuto();
  }

  function apresChoix() {
    formulePack = null;
    construireFormules();
    majBoutons();
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
      if (auto() && !nbVehicules()) return false;
      if (mob() && !etat.meubles.length) return false;
      return true;
    }

    if (n === 3) {
      if (auto()) {
        var incomplet = !etat.categories.length || etat.categories.some(function (c) {
          var ch = choixDe(c);
          return ch.sieges + ch.premium !== etat.compte[c];
        });
        if (incomplet) return false;
      }
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
          champ('q-adresse').value.trim().length < 3) return false;
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

    if (n === 3) { construireTailles(); construireFormules(); }
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

  /* ------------------------------------------- VÉHICULES PAR TYPE (ét. 2) */
  var MAX_PAR_TYPE = 10;
  var compteurs = form.querySelectorAll('[data-compteurs] [data-cat]');

  function majCompteurs() {
    var total = 0;
    etat.categories = [];
    compteurs.forEach(function (ligne) {
      var cat = ligne.getAttribute('data-cat');
      var n = etat.compte[cat] || 0;
      total += n;
      if (n) etat.categories.push(cat);
      ligne.querySelector('.wz-count-val').textContent = n;
      ligne.querySelector('[data-moins]').disabled = n === 0;
      ligne.querySelector('[data-plus]').disabled = n >= MAX_PAR_TYPE;
      ligne.classList.toggle('is-on', n > 0);
    });
    etat.nb = total ? String(total) : null;
    majBoutons();
  }

  compteurs.forEach(function (ligne) {
    var cat = ligne.getAttribute('data-cat');
    ligne.querySelector('[data-plus]').addEventListener('click', function () {
      etat.compte[cat] = Math.min((etat.compte[cat] || 0) + 1, MAX_PAR_TYPE);
      majCompteurs();
    });
    ligne.querySelector('[data-moins]').addEventListener('click', function () {
      etat.compte[cat] = Math.max((etat.compte[cat] || 0) - 1, 0);
      majCompteurs();
    });
  });
  if (compteurs.length) majCompteurs();

  /* ------------------------------------------------------- CASES À COCHER */
  var groupes = { meuble: 'meubles' };

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
      'Formule Sièges (40€)':     { type: 'Voiture', formule: 'sieges' },
      'Formule Premium (60€)':    { type: 'Voiture', formule: 'premium' },
      'Canapé droit':             { type: 'Mobilier', groupe: 'meuble', valeur: 'droit' },
      "Canapé d'angle":           { type: 'Mobilier', groupe: 'meuble', valeur: 'angle' },
      'Autres textiles (matelas, chaises, tapis)': { type: 'Mobilier' },
      'Nettoyage mobilier':       { type: 'Mobilier' }
    };
    var m = correspondances[pack];
    if (m) {
      var bouton = form.querySelector('[data-choice="type"] [data-value="' + m.type + '"]');
      if (bouton) bouton.click();
      if (m.formule) formulePack = m.formule;
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
      ? (detailVehicules() || '—')
      : '—');
    champCache('Formules voiture', auto() ? (detailFormules() || '—') : '—');
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
      return l.label + (l.texte ? ' : ' + l.texte.toLowerCase() : (l.devis ? ' : sur devis' : (l.info ? '' : ' : ' + l.prix + '€')));
    }).join(' | '));
    champCache('Total estimé', texteTotal(r));
    /* Gardent les noms de colonne du Google Sheet (« Commune » reçoit l'adresse complète) */
    var d = etat.depl || (window.cwDeplacement ? window.cwDeplacement.deviner(champ('q-adresse').value) : null);
    champCache('Commune', champ('q-adresse').value.trim());
    champCache('Code postal', d ? d.cp : '—');
    champCache('Déplacement', !d ? 'adresse non choisie dans la liste : à calculer'
      : (d.surDevis ? 'hors zone, sur devis' : d.offert ? 'offert' : d.prix + '€') +
        (d.km != null ? ' — environ ' + d.km + ' km de route' : ' — Rennes') + (d.estime ? ' (estimation)' : ''));
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
