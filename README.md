# Endolori Labs — site (frontend) + API (backend)

Architecture en deux services séparés, comme recommandé :

```
Endolori/
├── frontend/     → site public (HTML/CSS/JS statique) → Render Static Site
└── backend/      → API Node/Express (stats, leads, auth) → Render Web Service
```

Le frontend se charge **instantanément** (fichiers statiques, jamais de mise
en veille). Il n'appelle le backend que lorsque c'est nécessaire (envoi du
formulaire, tracking, connexion admin) — et seulement à ce moment-là le
backend doit éventuellement se "réveiller".

## 1. Déployer le backend (Render Web Service)

1. Pousse tout le dossier `Endolori/` sur GitHub.
2. Sur Render : **New +** → **Web Service** → connecte le repo.
3. **Root Directory** : `backend`
4. **Build Command** : `npm install`
5. **Start Command** : `npm start`
6. Render te donne une URL, ex. `https://endolori-labs-backend.onrender.com`
   — note-la, tu en as besoin à l'étape 2.
7. Variables d'environnement à ajouter (**Environment**) :

   | Variable | Rôle | Obligatoire ? |
   |---|---|---|
   | `FRONTEND_ORIGIN` | URL exacte de ton frontend (étape 2) | Recommandé |
   | `ADMIN_USERNAME` | identifiant pour `/fortuna_major` | Oui, pour l'admin |
   | `ADMIN_PASSWORD` | mot de passe pour `/fortuna_major` | Oui, pour l'admin |
   | `SESSION_SECRET` | chaîne aléatoire (`openssl rand -hex 32`) | Recommandé |
   | `GMAIL_USER` / `GMAIL_APP_PASSWORD` | notification par e-mail des leads | Optionnel |
   | `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | base de données permanente | Optionnel (sinon JSON local) |

   Voir plus bas pour le détail de chacune.

## 2. Déployer le frontend (Render Static Site)

1. Sur Render : **New +** → **Static Site** → même repo.
2. **Root Directory** : `frontend`
3. **Build Command** : *(laisser vide)*
4. **Publish Directory** : `.`
5. Render te donne une URL, ex. `https://endolori-labs.onrender.com`.
6. **Ouvre `frontend/assets/js/config.js`** et remplace la valeur de
   `window.ENDOLORI_API_BASE` par l'URL exacte de ton **backend** (étape 1.6).
   Repousse le commit — Render redéploie automatiquement.
7. Retourne dans les variables d'environnement du **backend** et mets à jour
   `FRONTEND_ORIGIN` avec l'URL exacte de ce frontend (étape 2.5), puis
   redéploie le backend pour que le CORS l'autorise.

C'est tout. Les deux services sont maintenant connectés :
`frontend (statique, jamais de veille) → fetch → backend (API, se réveille si besoin)`.

## ⚠️ Le fameux écran de démarrage Render

Il ne concerne plus que le **backend**, et seulement au moment d'un appel API
(envoi du formulaire, connexion admin, tracking) — jamais à l'arrivée sur le
site, qui s'affiche toujours instantanément puisqu'il est maintenant 100%
statique. C'est exactement le comportement propre que tu voulais.

Le formulaire affiche déjà un état "Envoi en cours…" pendant l'attente, pour
que ça ne ressemble jamais à un bouton cassé même si le backend met quelques
secondes à se réveiller.

Si tu veux supprimer complètement cette latence occasionnelle (pas juste
la cacher), il faut passer le backend sur un plan payant Render (~7$/mois,
plus de mise en veille) — pas possible à corriger uniquement par du code.

## Développement local

```bash
cd backend
npm install
npm start          # démarre sur http://localhost:3000
```

Dans `frontend/assets/js/config.js`, mets temporairement :
```js
window.ENDOLORI_API_BASE = "http://localhost:3000";
```
Puis ouvre les fichiers de `frontend/` directement dans le navigateur, ou
sers-les avec n'importe quel serveur statique local (`npx serve frontend`).

---

## Structure détaillée

```
Endolori/
├── frontend/
│   ├── index.html
│   ├── smart-inbox.html
│   ├── contact.html
│   ├── thumbnail.jpg
│   ├── video.mp4              → À AJOUTER TOI-MÊME
│   ├── robots.txt
│   ├── sitemap.xml
│   └── assets/
│       ├── css/style.css
│       └── js/
│           ├── config.js      → URL du backend (À MODIFIER avant déploiement)
│           ├── common.js      → thème, menu, curseur, mot de passe secret, tracking
│           ├── i18n.js        → dictionnaire FR/EN
│           ├── home.js        → scripts de la page d'accueil
│           ├── product.js     → scripts de la page Smart Inbox
│           └── contact.js     → formulaire multi-étapes
│
└── backend/
    ├── server.js               → routes + logique métier
    ├── db.js                   → stockage (Firestore ou JSON local, automatique)
    ├── auth.js                 → session admin signée
    ├── package.json
    ├── data/
    │   ├── stats.json
    │   └── leads.json
    └── views/
        └── fortuna_major.html  → tableau de bord privé (protégé par session)
```

## Pourquoi une page produit dédiée ?

`smart-inbox.html` est une vraie page séparée (pas une simple ancre `#products`
sur l'accueil), avec son propre `<title>`, sa propre meta description, son
propre JSON-LD (`Product` + `FAQPage` + `BreadcrumbList`), et son URL propre.
Ça permet à Google de l'indexer et de la faire apparaître spécifiquement sur
des recherches type "Smart Inbox" ou "automatisation email entreprise", en
plus de la page d'accueil.

## Base de données : local JSON (par défaut) ou Firebase Firestore (recommandé)

Le backend choisit automatiquement son mode de stockage :

- **Sans configuration** → `backend/data/stats.json` et `leads.json`. ⚠️ Sur
  le plan gratuit de Render, ces fichiers peuvent être réinitialisés à
  chaque redéploiement (pas à cause d'une simple mise en veille — ça, ça ne
  perd rien — mais bien à chaque nouveau déploiement de code).
- **Avec les 3 variables Firebase** → bascule automatiquement sur Firestore,
  une base de données Google gratuite et indépendante de Render. Tes
  données survivent à n'importe quel redéploiement.

### Configurer Firebase (10 minutes, gratuit)

1. [console.firebase.google.com](https://console.firebase.google.com) → nouveau projet.
2. **Build → Firestore Database** → **Créer une base de données** → mode **Production** → région proche (ex. `europe-west1`).
3. **⚙️ Paramètres du projet → Comptes de service** → **Générer une nouvelle clé privée** → un fichier `.json` se télécharge, avec `project_id`, `client_email`, `private_key`.
4. Sur Render (service **backend**), ajoute :
   - `FIREBASE_PROJECT_ID` = `project_id`
   - `FIREBASE_CLIENT_EMAIL` = `client_email`
   - `FIREBASE_PRIVATE_KEY` = `private_key` **telle quelle, avec les `\n` inclus**
5. Redéploie. Le log affichera `storage: Firestore`.

Une fois configuré, tu peux aussi consulter les demandes reçues directement
dans la Firebase Console (**Firestore Database** → collection `leads`) —
utile si jamais Render est en panne.

## Accès sécurisé au tableau de bord (`fortuna_major`)

1. Taper `fortuna_major` au clavier sur n'importe quelle page du **frontend**
   ouvre une popup de connexion (nom d'utilisateur + mot de passe).
2. Les identifiants sont vérifiés côté **backend** contre `ADMIN_USERNAME` /
   `ADMIN_PASSWORD`.
3. Si c'est correct, le backend pose un cookie de session sécurisé et
   redirige vers `<url-du-backend>/fortuna_major`.
4. Cette page n'est jamais accessible directement (elle n'est même pas dans
   le dossier statique) — sans session valide, toute tentative renvoie vers
   l'accueil du frontend, sans donnée renvoyée par l'API.

`SESSION_SECRET` (recommandé) évite que tout le monde soit déconnecté à
chaque redéploiement du backend.

## Suivi des demandes reçues (statuts, archivage, suppression)

Chaque demande reçue via `/contact.html` a un statut modifiable directement
depuis `/fortuna_major` :

| Statut | Sens |
|---|---|
| Nouveau | Vient d'arriver, pas encore traité |
| À contacter | Identifié comme à recontacter |
| Contacté | Premier contact établi |
| En discussion | Échanges en cours |
| Proposition envoyée | Une proposition a été transmise |
| Gagné | Devenu client |
| Perdu | N'a pas donné suite |

**Archiver** retire une demande de la liste principale sans la supprimer
(case "Afficher les archivées" pour les revoir). **Supprimer** l'efface
définitivement (confirmation demandée).

## Formulaire "Démarrer une conversation" + diagnostic automatisation

Le formulaire en 3 étapes calcule un score de besoin en automatisation
(0-100%) **côté serveur**, utilisé uniquement en interne pour prioriser
(visible dans `/fortuna_major`). Le visiteur ne voit jamais ce chiffre : il
reçoit un message court et honnête — on le recontactera pour lui dire si oui
ou non une automatisation ferait sens, en expliquant pourquoi, et avec une
piste de solution si c'est le cas. Pas de promesse automatique de proposition
commerciale à tout le monde.

À chaque soumission :
1. Sauvegardée en permanence (Firestore ou `leads.json`).
2. E-mail automatique à `joelmoyo249@gmail.com` avec toutes les réponses
   (si Gmail est configuré — voir ci-dessous). Répondre à cet e-mail répond
   directement au prospect (`replyTo` réglé sur son adresse).

### Configurer l'envoi d'e-mail (Gmail, gratuit, sans service tiers)

1. Active la validation en deux étapes sur ton compte Gmail.
2. Crée un "Mot de passe d'application" (`myaccount.google.com/security`).
3. Sur Render (service **backend**) : `GMAIL_USER` = ton adresse Gmail,
   `GMAIL_APP_PASSWORD` = le code à 16 caractères généré.
4. Redéploie.

Ceci n'utilise aucun service tiers commercial — uniquement ton propre compte
Gmail via la librairie open-source Nodemailer.

## API disponible (backend)

- `GET /api/stats` *(protégé)*
- `POST /api/stats/bump` `{ "path", "amount" }` (public)
- `POST /api/stats/reset` *(protégé)*
- `GET /api/leads` *(protégé)*
- `POST /api/leads` (public — utilisé par `/contact.html`)
- `PATCH /api/leads/:id` *(protégé)* `{ "status" }` et/ou `{ "archived" }`
- `DELETE /api/leads/:id` *(protégé)*
- `POST /api/auth/login` `{ "username", "password" }`
- `POST /api/auth/logout`

*(protégé)* = nécessite un cookie de session admin valide.
