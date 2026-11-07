# AutoCoder 2.0 — Studio Niko

Application web statique/PWA en français, fondée sur le design d'AutoCoder. Aucun framework ni compilation requis.

## Fonctions réellement implémentées

- Editeur de code multifiche, téléchargement individuel, navigation et création/suppression de fichiers (`.py`, `.html`, `.css`, `.js`, `.md`, `.json`).
- Sauvegarde automatique dans le `localStorage` du navigateur ; import et export d'un projet JSON.
- Génération **locale** de projets prédéfinis : calculatrice Python, gestionnaire de tâches, analyse de texte, traitement CSV, exemple Python et site web responsive. **Ce mode n'utilise pas d'IA** : une demande hors de ces modèles déclenche le modèle Python générique.
- Pipeline à 4 étapes visibles : planification par règles/modèle ou IA serveur, génération de fichiers, exécution, contrôle. Ce sont des étapes d'application, **pas quatre agents LLM indépendants**.
- Exécution Python dans un Web Worker via Pyodide WebAssembly **v0.25.1**. Journaux stdout/stderr, commande d'arrêt (termination du worker) et limite de temps **d'exécution** 10/20/30 secondes. Chargement initial limité à 90 secondes.
- Tests Python `unittest` pour `main.py`/`test_main.py` et affichage du vrai nombre de tests/erreurs.
- Prévisualisation HTML/CSS/JS dans deux iframes sandboxées via un hôte dédié ; la CSP de l’éditeur reste stricte (sans accès réseau, origine partagée, formulaires et popups).
- Contrôles statiques heuristiques des principaux risques (ce n'est **pas** un audit complet).
- PWA installable depuis un hébergement HTTPS. La coquille web est mise en cache ; **premier chargement Pyodide nécessite Internet**. L'exécution hors-ligne de Python n'est pas garantie.
- Option de génération IA **réelle** via API Vercel, sous authentification par jeton. La clé du fournisseur reste côté serveur. Le mode local fonctionne indépendamment de cette configuration.

## Lancer localement

Dans le répertoire du projet :

```bash
python -m http.server 4173
```

Ouvrir `http://localhost:4173` dans un navigateur moderne. Ne pas double-cliquer sur `index.html` en `file://` : les Workers, la PWA et l'API ne fonctionneront pas correctement.

La première exécution Python télécharge Pyodide depuis `cdn.jsdelivr.net`. Si Internet/CDN est indisponible, l'éditeur, les modèles et les aperçus web restent utilisables.

## Déploiement Vercel et mode IA facultatif

La route `GET /api/status` indique uniquement si les variables nécessaires sont configurées ; elle ne retourne jamais leur contenu. La fenêtre Réglages l’utilise pour afficher clairement lorsque le mode IA est indisponible. Sans clé API valide, la génération IA reste désactivée tandis que la génération locale fonctionne.

1. Déployer **le dossier complet** comme projet Vercel (pas uniquement `index.html`). Les pages statiques seront servies normalement et `api/generate.mjs` en fonction Node.
2. Dans les paramètres d'environnement Vercel, définir :
   - `OPENAI_API_KEY` : clé du fournisseur, **uniquement côté serveur**.
   - `AUTOCODER_ACCESS_TOKEN` : secret fort et aléatoire de 32 caractères ou plus (requis par l'API).
   - `OPENAI_MODEL` : facultatif, défaut `gpt-4.1-mini` ; vérifier que ce modèle est disponible sur le compte API.
3. Redéployer le projet après ajout des variables.
4. Dans l'interface, choisir « IA via API serveur protégée » et saisir **AUTOCODER_ACCESS_TOKEN**, jamais la clé OpenAI.

Le jeton d'accès est gardé uniquement en mémoire de l'onglet : il doit être ressaisi après rechargement, fermeture ou changement d'appareil.

**Attention** : un endpoint authentifié par un jeton partagé ne remplace pas une authentification utilisateur ni un quota côté serveur. Avant un déploiement public, mettre en place des comptes, quotas, suivi du budget et limitation de débit via une infrastructure adaptée (ex. Vercel Firewall / WAF, stockage persistant). Cette version ne met pas en œuvre ces services.

## Sécurité et limites

- Le code Python exécuté dans Pyodide n'a pas accès au système de fichiers de l'ordinateur, mais un Worker **n'est pas une sandbox robuste contre du code hostile** : du code Python/Pyodide peut disposer d'API réseau ou faire tomber le navigateur. **Ne jamais exécuter des scripts inconnus ou contenant des secrets.**
- Le stockage local n'est pas chiffré ; ne pas saisir de données sensibles, d'informations de santé ou de clés dans les projets.
- Les projets exportés sont des archives JSON, pas des fichiers ZIP/commits GitHub. Aucune synchronisation automatique GitHub/Vercel n'est implémentée.
- Les vérifications statiques par motifs, les tests unitaires fournis et la prévisualisation web ne prouvent pas que n'importe quel projet généré est sans erreur, ni sécurisé.
- Le navigateur ne peut pas exécuter directement des applications Python nécessitant Docker, Node.js, accès matériel ou modules natifs non compatibles Pyodide.
- La génération IA peut produire du code incorrect ; son résultat doit être relu et testé avant toute publication.

## Vérifier le projet

Un test en navigateur est disponible via `npm run test:e2e` après installation de Playwright et de Chromium. Il nécessite que le site soit accessible à l’URL donnée par `AUTOCODER_URL` (par défaut `http://127.0.0.1:4173`).

`npm test` : douze tests Node.js sans dépendance externe. Voir `TESTS_VERIFIES.md` pour la portée exacte des contrôles, les tests Python réalisés et les limites de vérification.

## Fichiers

- `index.html` — structure de l'interface, accessibilité et CSP côté document.
- `styles.css` — design et adaptations PC/mobile/tablette.
- `app.js` — gestion des projets, templates, logs, analyse, aperçu et API optionnelle.
- `py-worker.js` — runtime Python isolé du thread UI, tests et timeout orchestré par le thread principal.
- `preview.html`, `preview-host.js` — hôte et iframe de prévisualisation isolés.
- `api/status.mjs` — statut de configuration IA sans divulgation de secrets.
- `api/generate.mjs` — fonction serveur de génération IA (optionnelle).
- `manifest.webmanifest`, `sw.js`, `icons/` — ressources PWA.
- `vercel.json` — en-têtes de défense en profondeur.

### Sécurité du déploiement Vercel

La page principale interdit l'intégration en iframe (`X-Frame-Options: DENY` et `frame-ancestors 'none'`). Seul `/preview.html` peut être intégré depuis la même origine (`frame-ancestors 'self'`). Les deux iframes de prévisualisation restent sandboxées sans `allow-same-origin` et avec une CSP qui interdit les accès réseau.
