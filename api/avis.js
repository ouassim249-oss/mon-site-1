/* ==========================================================================
   AVIS GOOGLE AUTOMATIQUES — adresse : carsherwash.com/api/avis
   --------------------------------------------------------------------------
   Va chercher la note, le nombre d'avis et le texte des avis de la fiche
   Google de Carsherwash, puis les renvoie au site.

   1. Source principale : Featurable (gratuit). Ouassim y a relié sa fiche
      Google avec son compte : c'est la seule façon d'avoir le TEXTE des
      avis, car Google ne le donne pas aux fiches sans adresse affichée.
      Featurable se met à jour une fois par jour ; le site garde le
      résultat 3 h.
   2. Secours : l'API Google Places (note et nombre d'avis seulement),
      gardée 12 h pour rester dans la partie gratuite de Google.

   Réglages dans Vercel (Settings > Environment Variables) :
     FEATURABLE_ID      l'identifiant du widget Featurable (facultatif : par
                        défaut, celui ci-dessous, WIDGET)
     GOOGLE_PLACES_KEY  la clé Google (pour le secours)
     GOOGLE_PLACE_ID    l'identifiant de la fiche (facultatif : par défaut,
                        celui de Carsherwash ci-dessous, FICHE)
   Si rien ne répond, le site garde simplement les avis écrits dans index.html.
   ========================================================================== */

/* Fiche Google de Carsherwash (même fiche que g.page/r/CbnB4ZW-7lo3ECE). */
var FICHE = 'ChIJK4chB00NZwYRucHhlb7uWjc';
/* Widget Featurable relié à la fiche Google de Carsherwash. */
var WIDGET = '579bb1e0-4444-41e9-8638-7343e9bf7590';
var GOOGLE = 'https://places.googleapis.com/v1/';

async function google(chemin, cle, champs, options) {
  options = options || {};
  var reponse = await fetch(GOOGLE + chemin, {
    method: options.body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': cle,
      'X-Goog-FieldMask': champs
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  var donnees = await reponse.json().catch(function () { return {}; });
  if (!reponse.ok) {
    throw new Error('Google ' + reponse.status + ' : ' + ((donnees.error && donnees.error.message) || 'erreur'));
  }
  return donnees;
}

/* « Jean Dupont » devient « Jean D. », comme sur le site. */
function nomCourt(nom) {
  var mots = String(nom || 'Client').trim().split(/\s+/);
  if (mots.length < 2) return mots[0];
  return mots[0] + ' ' + mots[mots.length - 1].charAt(0).toUpperCase() + '.';
}

/* Featurable donne parfois l'avis suivi de sa traduction par Google
   (« … (Traduit par Google) … ») : on ne garde que le texte du client. */
function texteOriginal(texte) {
  texte = String(texte || '');
  var original = texte.split(/\(Original\)/i);
  if (original.length > 1) return original[original.length - 1].trim();
  return texte.split(/\s*\((?:Traduit par Google|Translated by Google)\)/i)[0].trim();
}

/* Featurable : renvoie null si pas de widget ou si ça ne répond pas.
   Les nouveaux widgets répondent sur /v2, les anciens sur /v1. */
async function depuisFeaturable() {
  var widget = (process.env.FEATURABLE_ID || WIDGET).trim();
  if (!widget) return null;
  var etoiles = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  try {
    var d = null;
    var reponse = await fetch('https://api.featurable.com/v2/widgets/' + encodeURIComponent(widget));
    var v2 = await reponse.json().catch(function () { return null; });
    if (reponse.ok && v2 && v2.success && v2.widget) {
      var resume = v2.widget.gbpLocationSummary || {};
      d = {
        note: resume.rating,
        nombre: resume.reviewsCount,
        lien: resume.writeAReviewUri,
        avis: (v2.widget.reviews || []).map(function (a) {
          return {
            nom: a.author && a.author.name,
            note: a.rating && a.rating.value,
            texte: a.text,
            date: a.createdAt
          };
        })
      };
    } else {
      reponse = await fetch('https://api.featurable.com/v1/widgets/' + encodeURIComponent(widget));
      var v1 = await reponse.json();
      if (!reponse.ok || !v1 || !v1.success) throw new Error('réponse ' + reponse.status);
      d = {
        note: v1.averageRating,
        nombre: v1.totalReviewCount,
        lien: v1.profileUrl,
        avis: (v1.reviews || []).map(function (a) {
          return {
            nom: a.reviewer && a.reviewer.displayName,
            note: a.starRating,
            texte: a.comment,
            date: a.createTime
          };
        })
      };
    }
    var avis = d.avis
      .map(function (a) {
        var note = typeof a.note === 'number' ? a.note : etoiles[a.note] || 5;
        return { auteur: nomCourt(a.nom), note: note, texte: texteOriginal(a.texte), date: a.date || '' };
      })
      .filter(function (a) { return a.texte; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return {
      ok: true,
      source: 'featurable',
      note: Number(d.note) || null,
      nombre: Number(d.nombre) || 0,
      lienFiche: d.lien || '',
      avis: avis
    };
  } catch (e) {
    console.error('[avis] Featurable :', e.message);
    return null;
  }
}

module.exports = async function (req, res) {
  var featurable = await depuisFeaturable();
  if (featurable) {
    res.setHeader('Cache-Control', 's-maxage=10800, stale-while-revalidate=86400');
    return res.status(200).json(featurable);
  }

  var cle = process.env.GOOGLE_PLACES_KEY;
  if (!cle) {
    res.setHeader('Cache-Control', 's-maxage=3600');
    return res.status(200).json({ ok: false, raison: 'cle-absente' });
  }

  try {
    var id = (process.env.GOOGLE_PLACE_ID || FICHE).trim();
    var fiche = await google(
      'places/' + encodeURIComponent(id) + '?languageCode=fr',
      cle,
      'id,displayName,rating,userRatingCount,reviews,googleMapsUri'
    );

    var avis = (fiche.reviews || [])
      .map(function (a) {
        var texte = (a.originalText && a.originalText.text) || (a.text && a.text.text) || '';
        return {
          auteur: nomCourt(a.authorAttribution && a.authorAttribution.displayName),
          lienAuteur: (a.authorAttribution && a.authorAttribution.uri) || '',
          note: a.rating || 5,
          texte: texte.trim(),
          date: a.publishTime || ''
        };
      })
      .filter(function (a) { return a.texte; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=86400');
    return res.status(200).json({
      ok: true,
      source: 'google',
      placeId: fiche.id,
      nom: fiche.displayName && fiche.displayName.text,
      note: fiche.rating || null,
      nombre: fiche.userRatingCount || 0,
      lienFiche: fiche.googleMapsUri || '',
      avis: avis
    });
  } catch (e) {
    console.error('[avis]', e.message);
    res.setHeader('Cache-Control', 's-maxage=600');
    return res.status(200).json({ ok: false, raison: 'erreur-google' });
  }
};
