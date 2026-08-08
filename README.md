# Endolori Labs — site + API de statistiques

## Structure du projet

```
project/
├── server.js               → serveur Express (site + API stats + API leads)
├── package.json
├── data/
│   ├── stats.json           → statistiques de visite (permanent)
│   └── leads.json           → demandes reçues via le formulaire (permanent)
└── public/
    ├── index.html           → page d'accueil
    ├── smart-inbox.html      → page produit dédiée à Smart Inbox (SEO)
    ├── contact.html          → formulaire "Démarrer une conversation" + diagnostic automatisation
    ├── fortuna_major.html    → tableau de bord secret (statistiques + demandes reçues)
    ├── thumbnail.jpg         → miniature de la vidéo explicative
    ├── video.mp4             → À AJOUTER TOI-MÊME (ta vraie vidéo explicative)
    ├── robots.txt
    ├── sitemap.xml
    └── assets/
        ├── css/
        │   └── style.css     → tout le CSS du site (partagé entre les pages)
        └── js/
            ├── common.js     → thème, menu mobile, curseur, scroll nav, logo, mot de passe secret, tracking
            ├── i18n.js       → dictionnaire FR/EN + logique de traduction (partagé)
            ├── home.js       → scripts propres à la page d'accueil (sphère, canvas, storytelling...)
            ├── product.js    → scripts propres à la page Smart Inbox (FAQ, features, démo)
            └── contact.js    → logique du formulaire multi-étapes + calcul et affichage du score
```

## Pourquoi une page produit dédiée ?

`smart-inbox.html` est une vraie page séparée (pas une simple ancre `#products`
sur l'accueil), avec son propre `<title>`, sa propre meta description, son
propre JSON-LD (`Product` + `FAQPage` + `BreadcrumbList`), et son URL propre :
`/smart-inbox.html`. C'est ce qui permet à Google de l'indexer et de la faire
apparaître spécifiquement sur des recherches type "Smart Inbox" ou
"automatisation email entreprise", en plus de la page d'accueil. Les deux
pages se renvoient l'une à l'autre (liens internes), ce qui aide aussi le
référencement.

## ⚠️ Important : ajoute ta vidéo

Le fichier `video.mp4` n'est pas inclus. Dépose ta vraie vidéo explicative
dans `public/video.mp4` (exactement ce nom) avant de déployer, sinon le
lecteur vidéo (présent sur les deux pages) n'aura rien à lire.

## Formulaire "Démarrer une conversation" + diagnostic automatisation

Le bouton "Démarrer une conversation" et les CTA "Contact" renvoient
maintenant vers `/contact.html` : un formulaire en 3 étapes qui calcule un
score de besoin en automatisation (0-100%) affiché instantanément au
visiteur, avec une explication des facteurs qui ont le plus pesé dans le
score.

À chaque soumission :
1. La demande est **sauvegardée en permanence** dans `data/leads.json`
   (visible dans le tableau de bord `/fortuna_major`).
2. Un **e-mail est envoyé automatiquement à `joelmoyo249@gmail.com`** avec
   toutes les réponses du formulaire et le score, si l'envoi d'e-mail est
   configuré (voir ci-dessous). Répondre à cet e-mail répond directement au
   prospect (`replyTo` est réglé sur son adresse).

### Configurer l'envoi d'e-mail (Gmail, gratuit, sans service tiers)

Sans configuration, les demandes sont quand même sauvegardées dans
`data/leads.json` — tu peux les consulter sur `/fortuna_major` même sans
avoir configuré l'e-mail. Mais pour recevoir une notification automatique :

1. Va dans les paramètres de sécurité de ton compte Gmail (`myaccount.google.com/security`).
2. Active la **validation en deux étapes** si ce n'est pas déjà fait (obligatoire pour l'étape suivante).
3. Cherche "**Mots de passe des applications**" (App Passwords) et crée-en un nouveau (nomme-le par ex. "Endolori Labs Site").
4. Google te donne un code à 16 caractères — copie-le.
5. Sur Render, va dans **Environment** (variables d'environnement) de ton service et ajoute :
   - `GMAIL_USER` = ton adresse Gmail complète (ex. `joelmoyo249@gmail.com`)
   - `GMAIL_APP_PASSWORD` = le code à 16 caractères généré à l'étape 4 (sans espaces)
6. Redéploie le service. Les e-mails partiront automatiquement à chaque nouvelle demande.

Ceci n'utilise **aucun service tiers commercial** (pas de Formspree, Typeform,
SendGrid...) — uniquement ton propre compte Gmail via la librairie
open-source Nodemailer.

### Comment le score est calculé

Cinq facteurs, chacun pondéré, pour un total sur 100 :
volume d'e-mails reçus, nombre de personnes qui les traitent manuellement,
présence d'un suivi manuel (tableurs), absence/présence d'automatisation
existante, temps hebdomadaire perdu. Le calcul est fait **côté serveur**
(dans `server.js`, fonction `computeScore`) pour que le résultat affiché au
visiteur soit fiable et cohérent avec ce que tu vois toi-même dans
`/fortuna_major`. Les seuils (répartition en "faible / modéré / élevé /
critique") sont ajustables directement dans cette fonction si tu veux
recalibrer.


## Déploiement sur Render

1. Pousse ce dossier `project/` dans un dépôt Git (GitHub/GitLab).
2. Sur Render : **New +** → **Web Service** → connecte le dépôt.
3. Render détecte Node.js automatiquement. Configure :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
4. Render assigne automatiquement `PORT` — le serveur l'utilise déjà (`process.env.PORT`).
5. Une fois déployé, ton site sera sur `https://endolori-labs.onrender.com/`
   (ou le nom que Render t'attribue si différent).

## ⚠️ Important : le disque de Render est éphémère par défaut

Sur le plan **gratuit** de Render, le système de fichiers est réinitialisé
à chaque redéploiement / redémarrage du service (mise en veille après
inactivité incluse). Cela veut dire que `data/stats.json` **peut revenir à
zéro** de temps en temps sur le plan gratuit.

Pour une vraie persistance permanente (jamais réinitialisée), deux options :
- Ajouter un **Persistent Disk** Render (disponible sur les plans payants) et y
  pointer `DATA_DIR` dans `server.js`.
- Ou remplacer le fichier JSON par une vraie base de données hébergée
  (Postgres sur Render, MongoDB Atlas, Supabase, etc.) — dis-moi si tu veux
  que je fasse cette migration, c'est directement compatible avec la même
  API (`/api/stats`, `/api/stats/bump`).

## Comment fonctionne la page secrète

- Elle n'est reliée nulle part dans le site (aucun lien, aucun menu).
- Sur la page d'accueil, si quelqu'un tape au clavier les caractères
  `fortuna_major` (n'importe où sur la page, sans champ de saisie), le
  navigateur est redirigé vers `/fortuna_major`.
- Cette redirection pose un indicateur temporaire (`sessionStorage`) qui
  autorise l'accès à la page ; sans être passé par ce mot de passe tapé au
  clavier, toute tentative d'aller directement sur `/fortuna_major` renvoie
  automatiquement vers l'accueil.
- ⚠️ Ce n'est **pas une sécurité forte** (pas de compte, pas de mot de passe
  serveur) : un visiteur techniquement averti pourrait forcer l'accès via la
  console du navigateur. C'est une protection "à l'obscurité", suffisante
  pour un usage interne discret, pas pour protéger des données sensibles.

## API disponible

- `GET /api/stats` → renvoie le contenu actuel de `data/stats.json`
- `POST /api/stats/bump` avec `{ "path": "videoPlays", "amount": 1 }` →
  incrémente une valeur (utilisé automatiquement par le site)
- `POST /api/stats/reset` → remet toutes les statistiques à zéro
