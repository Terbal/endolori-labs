# Endolori Labs — site + API de statistiques

## Structure du projet

```
project/
├── server.js          → serveur Express (sert le site + l'API de stats)
├── package.json
├── data/
│   └── stats.json     → "base de données" JSON persistante des statistiques
└── public/
    ├── index.html      → le site
    ├── fortuna_major.html → tableau de bord secret des statistiques
    ├── thumbnail.jpg   → miniature de la vidéo explicative
    ├── robots.txt
    ├── sitemap.xml
    └── video.mp4       → À AJOUTER TOI-MÊME (ta vraie vidéo explicative)
```

## ⚠️ Important : ajoute ta vidéo

Le fichier `video.mp4` n'est pas inclus. Dépose ta vraie vidéo explicative
dans `public/video.mp4` (exactement ce nom, à côté de `index.html`) avant
de déployer, sinon le lecteur vidéo n'aura rien à lire.

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
