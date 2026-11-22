# Consignes pour agents de programmation — AutoCoder Studio Niko

## Modern Web Guidance (GoogleChrome)

Pour toute modification d'interface, de CSS, de logique DOM, d'accessibilité ou de performance web,
les agents disposant de Node.js et d'un accès réseau doivent consulter les recommandations
de https://github.com/GoogleChrome/modern-web-guidance :

1. Rechercher un cas précis : npx -y modern-web-guidance@latest search "responsive web layout"
2. Choisir un guide pertinent parmi les résultats et lire : npx -y modern-web-guidance@latest retrieve "<id>"
3. Appliquer les bonnes pratiques et les fallbacks nécessaires sur Chrome, Firefox et Safari iOS.
4. Vérifier le code avec npm test et des tests navigateur réels si disponibles.

Installation interactive officielle dans un agent compatible :
npx modern-web-guidance@latest install

Le code web peut évoluer rapidement ; renouveler la recherche pour chaque nouvelle fonctionnalité.
Ne pas inventer un identifiant de guide, ni prétendre avoir consulté une recommandation non récupérée.

## Fonctionnement réel de cette intégration

- web-guidance.js : contrôles statiques locaux exécutés dans le navigateur (sans réseau).
- api/web-standards.mjs : consignes de base ajoutées au mode IA serveur sur les projets web.
- AGENTS.md : procédure pour l'utilisation effective des guides officiels par les agents développeurs.
- Aucun appel à la CLI officielle dans le navigateur ni dans la fonction Vercel à la génération.
- Aucun diagnostic heuristique n'est une preuve de conformité WCAG ou de compatibilité inter-navigateurs.

## Confidentialité et sécurité

L'audit local n'envoie pas les fichiers à un fournisseur externe. La CLI officielle
dispose de paramètres de télémétrie documentés (DISABLE_TELEMETRY=1).
Ne pas donner de clés privées ni de données personnelles à la CLI ou aux logs.

Préserver l'architecture : PWA HTML/CSS/JS sans framework, Pyodide dans Worker, CSP,
aperçu sandboxé, génération IA serveur facultative. Aucun secret côté navigateur.
Le moteur local utilise des modèles prédéfinis et ne doit pas être présenté comme une IA.
