/* ==========================================================================
   CARSHERWASH — Calculateur du prix de déplacement
   Le client tape son adresse, choisit la bonne dans la liste, et le site
   calcule la distance en voiture depuis Carsherwash pour donner le prix.

   Adresses et itinéraires : services gratuits de l'État (Géoplateforme IGN),
   sans compte ni clé. Si le calcul d'itinéraire ne répond pas, on estime la
   distance à vol d'oiseau × 1,4.

   POUR MODIFIER UN TARIF : tout est dans ZONES ci-dessous (distances en km
   par la route, aller simple). Pensez à changer aussi les textes des pages
   contact.html, auto.html et mobilier.html.
   ========================================================================== */
(function () {
  'use strict';

  /* Point de départ (quartier Maurepas, arrondi à environ 1 km près) */
  var DEPART = { lon: -1.66, lat: 48.13 };

  /* Code commune INSEE de Rennes : déplacement offert partout dans Rennes */
  var RENNES = '35238';

  var ZONES = [
    { max: 10, prix: 5 },
    { max: 20, prix: 10 },
    { max: 30, prix: 20, minimum: 70 }   // 70€ de prestations minimum
  ];
  var MAX_KM = 30;                        // au-delà : sur devis

  var API = 'https://data.geopf.fr';

  /* ------------------------------------------------------------ CALCUL */
  function tarif(km, citycode) {
    if (citycode === RENNES) {
      return { prix: 0, offert: true, texte: 'Offert', resume: 'Déplacement offert dans Rennes' };
    }
    for (var i = 0; i < ZONES.length; i++) {
      if (km <= ZONES[i].max) {
        var z = ZONES[i];
        return {
          prix: z.prix,
          minimum: z.minimum || 0,
          texte: '+' + z.prix + '€',
          resume: 'Déplacement : ' + z.prix + '€' +
                  (z.minimum ? ' (prestations : ' + z.minimum + '€ minimum)' : '')
        };
      }
    }
    return {
      prix: null, surDevis: true, texte: 'Sur devis',
      resume: 'Plus de ' + MAX_KM + ' km : déplacement sur devis, appelez-nous'
    };
  }

  function volOiseau(lon, lat) {
    var r = Math.PI / 180;
    var dLat = (lat - DEPART.lat) * r;
    var dLon = (lon - DEPART.lon) * r;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(DEPART.lat * r) * Math.cos(lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function distanceRoute(lon, lat) {
    var url = API + '/navigation/itineraire?resource=bdtopo-osrm&profile=car&optimization=fastest' +
              '&getSteps=false&start=' + DEPART.lon + ',' + DEPART.lat + '&end=' + lon + ',' + lat;
    return fetch(url)
      .then(function (rep) { if (!rep.ok) throw new Error(rep.status); return rep.json(); })
      .then(function (json) {
        var m = parseFloat(json.distance);
        if (!(m >= 0)) throw new Error('distance');
        return { km: m / 1000, estime: false };
      })
      .catch(function () { return { km: volOiseau(lon, lat) * 1.4, estime: true }; });
  }

  /* Résultat complet pour une adresse choisie dans la liste */
  function calculer(adresse) {
    var p = adresse.properties;
    var c = adresse.geometry.coordinates;
    var fin = function (d) {
      var t = tarif(d.km, p.citycode);
      t.km = Math.round(d.km);
      t.estime = d.estime;
      t.adresse = p.label;
      t.commune = p.city;
      t.cp = p.postcode;
      return t;
    };
    if (p.citycode === RENNES) return Promise.resolve(fin({ km: volOiseau(c[0], c[1]) * 1.4, estime: true }));
    return distanceRoute(c[0], c[1]).then(fin);
  }

  function chercher(texte) {
    var url = API + '/geocodage/search?autocomplete=1&limit=5&lat=48.11&lon=-1.68&q=' + encodeURIComponent(texte);
    return fetch(url)
      .then(function (rep) { if (!rep.ok) throw new Error(rep.status); return rep.json(); })
      .then(function (json) { return (json.features || []).filter(function (f) { return f.geometry && f.properties; }); });
  }

  /* ------------------------------------------------- CHAMP « ADRESSE »
     attacher(input, { resultat: elementTexte, change: function (r) {} })
     r vaut null tant qu'aucune adresse n'est choisie dans la liste.     */
  function attacher(input, options) {
    options = options || {};
    var sortie = options.resultat;
    var liste = document.createElement('ul');
    liste.className = 'addr-list';
    liste.hidden = true;
    liste.id = input.id + '-liste';
    liste.setAttribute('role', 'listbox');
    input.parentNode.style.position = 'relative';
    input.insertAdjacentElement('afterend', liste);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', liste.id);
    input.setAttribute('aria-expanded', 'false');

    var propositions = [];
    var actif = -1;
    var minuteur = null;
    var numero = 0;          // ignore les réponses arrivées dans le désordre
    var choisi = null;

    function message(texte, classe) {
      if (!sortie) return;
      sortie.className = 'addr-result' + (classe ? ' ' + classe : '');
      sortie.textContent = texte;
    }

    function fermer() {
      liste.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      actif = -1;
    }

    function surligner(i) {
      actif = i;
      Array.prototype.forEach.call(liste.children, function (li, j) {
        li.classList.toggle('is-on', j === i);
        li.setAttribute('aria-selected', j === i ? 'true' : 'false');
      });
    }

    function afficherListe() {
      liste.innerHTML = '';
      propositions.forEach(function (f, i) {
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.textContent = f.properties.label;
        li.addEventListener('mousedown', function (e) { e.preventDefault(); choisir(i); });
        liste.appendChild(li);
      });
      liste.hidden = !propositions.length;
      input.setAttribute('aria-expanded', propositions.length ? 'true' : 'false');
      actif = -1;
    }

    function signaler(r) {
      choisi = r;
      if (options.change) options.change(r);
    }

    function choisir(i) {
      var f = propositions[i];
      if (!f) return;
      fermer();
      input.value = f.properties.label;
      var n = ++numero;
      message('Calcul du déplacement…', 'is-wait');
      calculer(f).then(function (r) {
        if (n !== numero) return;
        var detail = r.offert ? r.resume
          : r.resume + ' — environ ' + r.km + ' km de route' + (r.estime ? ' (estimation)' : '');
        message(detail, r.surDevis ? 'is-far' : (r.offert ? 'is-free' : ''));
        signaler(r);
      });
    }

    input.addEventListener('input', function () {
      if (choisi) signaler(null);
      clearTimeout(minuteur);
      var texte = input.value.trim();
      var n = ++numero;
      if (texte.length < 3) { propositions = []; afficherListe(); message(''); return; }
      message('Choisissez votre adresse dans la liste pour voir le prix du déplacement.', 'is-wait');
      minuteur = setTimeout(function () {
        chercher(texte).then(function (res) {
          if (n !== numero) return;
          propositions = res;
          afficherListe();
          if (!res.length) message('Adresse introuvable. Vérifiez l’orthographe ou indiquez juste votre commune.', 'is-far');
        }).catch(function () {
          if (n !== numero) return;
          message('Calcul indisponible pour le moment : on vous confirmera le prix du déplacement.', 'is-wait');
        });
      }, 250);
    });

    input.addEventListener('keydown', function (e) {
      if (liste.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); surligner(Math.min(actif + 1, propositions.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); surligner(Math.max(actif - 1, 0)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();     // pas de passage à l'étape suivante
        choisir(actif === -1 ? 0 : actif);
      }
      else if (e.key === 'Escape') fermer();
    });

    input.addEventListener('blur', function () { setTimeout(fermer, 120); });

    /* Sur téléphone, le champ remonte en haut de l'écran pour que la liste
       des adresses reste visible au-dessus du clavier. */
    input.style.scrollMarginTop = '90px';
    input.addEventListener('focus', function () {
      if (window.innerWidth > 700) return;
      setTimeout(function () { input.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 250);
    });

    return { resultat: function () { return choisi; } };
  }

  window.cwDeplacement = { attacher: attacher, tarif: tarif, ZONES: ZONES, MAX_KM: MAX_KM };

  /* Calculateur autonome (page Contact) : <input data-calc-deplacement> */
  document.querySelectorAll('[data-calc-deplacement]').forEach(function (input) {
    var sortie = document.getElementById(input.getAttribute('data-calc-deplacement'));
    attacher(input, { resultat: sortie });
  });
})();
