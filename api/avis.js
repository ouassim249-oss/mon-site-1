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
var WIDGET = '';
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

/* Featurable : renvoie null si pas de widget ou si ça ne répond pas. */
async function depuisFeaturable() {
  var widget = (process.env.FEATURABLE_ID || WIDGET).trim();
  if (!widget) return null;
  try {
    var reponse = await fetch('https://api.featurable.com/v1/widgets/' + encodeURIComponent(widget));
    var d = await reponse.json();
    if (!reponse.ok || !d || !d.success) throw new Error('réponse ' + reponse.status);
    var etoiles = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    var avis = (d.reviews || [])
      .map(function (a) {
        var note = typeof a.starRating === 'number' ? a.starRating : etoiles[a.starRating] || 5;
        return {
          auteur: nomCourt(a.reviewer && a.reviewer.displayName),
          note: note,
          texte: String(a.comment || '').replace(/\s*\(Translated by Google\)[\s\S]*$/, '').trim(),
          date: a.createTime || ''
        };
      })
      .filter(function (a) { return a.texte; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return {
      ok: true,
      source: 'featurable',
      note: Number(d.averageRating) || null,
      nombre: Number(d.totalReviewCount) || 0,
      lienFiche: d.profileUrl || '',
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
