/* ==========================================================================
   AVIS GOOGLE AUTOMATIQUES — adresse : carsherwash.com/api/avis
   --------------------------------------------------------------------------
   Va chercher la note, le nombre d'avis et les derniers avis (5 au maximum,
   limite fixée par Google) de la fiche Google de Carsherwash, puis les
   renvoie au site. Le résultat est gardé en mémoire 12 h par Vercel : Google
   n'est donc interrogé que quelques fois par jour, ce qui reste dans la
   partie gratuite de Google.

   Réglages dans Vercel (Settings > Environment Variables) :
     GOOGLE_PLACES_KEY  la clé Google (obligatoire)
     GOOGLE_PLACE_ID    l'identifiant de la fiche (facultatif : par défaut,
                        celui de Carsherwash ci-dessous, FICHE)
   Sans clé, le site garde simplement les avis écrits dans index.html.
   ========================================================================== */

/* Fiche Google de Carsherwash (même fiche que g.page/r/CbnB4ZW-7lo3ECE). */
var FICHE = 'ChIJK4chB00NZwYRucHhlb7uWjc';
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

/* « Sami Saïdi » devient « Sami S. », comme sur le site. */
function nomCourt(nom) {
  var mots = String(nom || 'Client').trim().split(/\s+/);
  if (mots.length < 2) return mots[0];
  return mots[0] + ' ' + mots[mots.length - 1].charAt(0).toUpperCase() + '.';
}

module.exports = async function (req, res) {
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
