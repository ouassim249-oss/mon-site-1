# Carsherwash — site web

Site statique (HTML/CSS/JS, aucune dépendance). Pour le mettre en ligne : copiez tout le
contenu de ce dossier à la racine de votre hébergement, comme votre site actuel.

## Les pages

| Fichier | Contenu |
|---|---|
| `index.html` | Accueil : hero, formules, avant/après, mobilier, étapes, zone, avis |
| `auto.html` | Formules voiture + options & extras + avant/après |
| `mobilier.html` | Tarifs canapé / fauteuil / matelas + avant/après + FAQ |
| `realisations.html` | Galerie avant/après voiture et mobilier |
| `contact.html` | Coordonnées, zone, FAQ générale |
| `devis.html` | Formulaire de demande de devis |
| `assets/style.css` | Structure et design de base (couleurs en haut du fichier) |
| `assets/theme.css` | Thème sombre + fond animé à bulles |
| `assets/app.js` | Menu mobile, bulles, comparateur avant/après, FAQ |
| `assets/devis.js` | Le parcours de devis en 5 étapes et le calcul du total |

## Ce qu'il vous reste à faire

### 1. Les photos actuellement en ligne

Les photos sont **à la racine** du site, pas dans `assets/` :

| Fichier | Utilisé par |
|---|---|
| `avant-nettoyage.jpg` / `apres-nettoyage.jpg` | comparateur voiture (accueil, Voiture, Réalisations) |
| `canape-avant.jpg` / `canape-apres.jpg` | comparateur canapé (accueil, Mobilier, Réalisations) |

Les deux premières portent le nom qu'elles ont déjà dans le dépôt GitHub : c'est
pour ça qu'il n'y a pas besoin de les réenvoyer à chaque mise en ligne.

**Conseil de prise de vue :** pour que le curseur fonctionne bien, les deux photos
doivent se superposer. Posez le téléphone, ne bougez pas entre l'avant et l'après,
gardez la même lumière, et cadrez serré sur la zone sale.

### 2. Ajouter une réalisation dans le comparateur

Chaque comparateur ne contient plus qu'une seule photo, donc les flèches ‹ › et les
points de navigation sont masqués automatiquement. **Ils réapparaissent tout seuls**
dès qu'un comparateur contient au moins deux blocs `.ba-slide`.

Pour en ajouter une : déposez vos deux photos à la racine, puis dupliquez le bloc
`<div class="ba-slide">` existant — **sans** la classe `is-active` — et changez les
`src`, le `data-title` et le `data-sub`.

```html
<div class="ba-slide" data-title="Titre" data-sub="Petit descriptif">
  <img class="ba-img" src="avant-2.jpg" alt="Avant nettoyage">
  <span class="ba-tag ba-tag--before">AVANT</span>
  <div class="ba-after-wrap">
    <img class="ba-img" src="apres-2.jpg" alt="Après nettoyage">
  </div>
  <span class="ba-tag ba-tag--after">APRÈS</span>
</div>
```

`assets/placeholder-avant.svg` et `placeholder-apres.svg` sont conservés : ils servent
de photos provisoires si vous voulez préparer un bloc avant d'avoir les vraies images.

### 3. Les avis Google

Le bouton « Laisser un avis Google » pointe déjà vers votre lien
`https://g.page/r/CbnB4ZW-7lo3ECE/review`.

La section avis n'affiche **aucun faux avis** : c'est interdit par Google et ça peut
faire supprimer votre fiche. Quand vous aurez de vrais avis, un bloc HTML tout prêt
est en commentaire dans `index.html` (cherchez « POUR AFFICHER DE VRAIS AVIS ») —
recopiez-y le texte exact de vos avis Google.

Idem pour les chiffres du hero (`7j/7`, `30 km`, `0€`) : remplacez-les par vos vrais
chiffres quand vous les aurez (ex. « +200 véhicules nettoyés », « 4,9/5 »).

### 4. Vérifier les tarifs

Les formules reprennent la structure demandée. Tout est modifiable directement dans le
HTML (`auto.html` et `mobilier.html`) :

- **Voiture** — Sièges dès 40€ · Premium 60€ (même prix quel que soit le véhicule)
- **Mobilier** — canapé droit 30 à 80€ · canapé d'angle 50 à 90€ · matelas/chaises/tapis
- **Options** — coffre +10€ · déplacement dans Rennes +5€ · poils/sable/moisissure dès +10€

Si vous changez un tarif, pensez à le changer **aussi** dans les listes déroulantes
« Formule voiture » et « Formule mobilier » de `devis.html`.

### 5. Le devis en 5 étapes

Le client avance étape par étape, et le bouton « Suivant » ne s'active que quand
l'étape est complète :

1. **Prestation** — voiture, mobilier, ou les deux
2. **Véhicules / mobilier** — nombre de véhicules + catégories, et/ou les meubles à nettoyer
3. **Prestation souhaitée** — formules et extras, ou la taille de chaque meuble
4. **Vos infos** — prénom, nom, email, téléphone, code postal, commune
5. **Estimation** — récapitulatif détaillé, total calculé, message facultatif

Le parcours s'adapte au choix de l'étape 1 : si le client ne veut que du mobilier,
les blocs voiture n'apparaissent jamais (et inversement).

> **Où changer un tarif :** tout le calcul est dans l'objet `TARIFS` en haut de
> `assets/devis.js`. Si vous modifiez un prix, changez-le **aussi** dans
> `devis.html` (les `<span class="wz-opt-price">`) et sur `auto.html` /
> `mobilier.html`.

Le total affiche « dès X€ » dès qu'une ligne est un prix de départ (formule Sièges,
matelas, chaises, 4+ véhicules), et « Sur devis » si le client n'a choisi que des
prestations sans prix fixe (tapis).

L'envoi utilise **Web3Forms** avec la clé déjà présente sur votre site actuel
(`afc35790-f49b-4881-8123-2294239f941c`) — les demandes arrivent donc sur la même
adresse email qu'aujourd'hui. Rien à configurer.

Pour changer l'adresse de réception : créez une nouvelle clé sur web3forms.com et
remplacez la valeur du champ `access_key` dans `devis.html`.

## Le thème sombre et le fond animé

Le site est en **thème sombre** (navy) avec un **fond de bulles animées** qui remontent
lentement et se décalent quand on fait défiler la page.

- Tout le thème tient dans `assets/theme.css`. Pour **revenir au thème clair d'origine**,
  supprimez la ligne `<link rel="stylesheet" href="assets/theme.css">` des 6 pages HTML.
- Les bulles sont créées par `assets/app.js` (bloc « Fond animé » tout en haut) :
  23 bulles sur 3 plans de profondeur. Pour en changer le nombre ou la taille,
  modifiez le tableau `plans`. Pour les enlever complètement, supprimez ce bloc.
- La vitesse de la parallaxe, c'est la valeur `vitesse` de chaque plan
  (0.05 au fond, 0.22 au premier plan). Plus le chiffre est grand, plus ça bouge.
- Aucune librairie, aucun canvas : uniquement du CSS animé en `transform`/`opacity`.
  Si le visiteur a activé « réduire les animations » sur son téléphone, le fond est
  désactivé automatiquement.

## Bon à savoir

- **Couleurs** : tout est centralisé en haut de `assets/style.css` (bloc `:root`).
  Changez `--blue` et toute l'identité du site suit.
- **Téléphone** : `06 27 94 53 61` (liens `tel:+33627945361`). Pour le changer,
  faites un rechercher/remplacer sur `+33627945361` et sur `06 27 94 53 61`.
- **Réseaux** : TikTok et Instagram `@carsherwash35`, dans le pied de page de
  chaque page et sur `realisations.html`.
- Le site fonctionne sans JavaScript (le contenu reste lisible), et il est adapté
  mobile / tablette / ordinateur.
