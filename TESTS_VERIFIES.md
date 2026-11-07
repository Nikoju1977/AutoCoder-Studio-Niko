# Vérifications effectuées — AutoCoder 2.0

Date : 7 novembre 2026

## Vérifié dans cette livraison

- Syntaxe JavaScript : `node --check app.js`, `node --check py-worker.js`, `node --check api/generate.mjs` — OK.
- Neuf contrôles automatisés Node.js (`npm test`) : 9/9 validés (ressources, contrôles de l'interface, CSP de base, Worker déclaré, rejets HTTP et réponse structurée simulée de l'API).
- Interface contrôlée dans Chromium par Playwright avec injection locale des trois ressources HTML/CSS/JS : chargement sans erreur JavaScript, génération de calculatrice, création d'un projet web, interaction bouton de l'aperçu iframe — OK.
- Version mobile inspectée à 390 px : pas de défilement horizontal au niveau du `body`, capture d'écran enregistrée — OK.
- Modèles Python générés via l'interface puis testés avec l'interpréteur CPython local : **16 tests unitaires réussis sur 16** (calculatrice 5 ; tâches 3 ; texte 3 ; CSV 2 ; base 3).
- Endpoint de génération testé uniquement par requêtes et réponses **simulées**, sans appel payant réel : contrôle du jeton, validation des entrées, refus des mauvaises méthodes — OK.

## Non vérifié / nécessite un environnement de déploiement

- La navigation HTTP locale complète de Chromium a été bloquée par les règles de cet environnement de test. Les essais UI ci-dessus ont donc chargé le HTML/CSS/JS directement dans une page de test ; cela ne remplace pas un test de déploiement.
- Le téléchargement et l'initialisation réels de **Pyodide** dans un Worker, puis les exécutions Python in-browser, n'ont pas été vérifiés de bout en bout. Pyodide nécessite l'accès au CDN pour le premier lancement. Les tests CPython des modèles n'équivalent pas à ce contrôle.
- L'appel fournisseur OpenAI n'a pas été réalisé : aucune clé serveur n'était configurée. L'endpoint est optionnel, son intégration doit être testée en déploiement Vercel avec la configuration réelle.
- L'installation de la PWA sous HTTPS et son fonctionnement hors ligne n'ont pas été vérifiés sur appareil physique.
- Aucune publication GitHub ni Vercel n'a été effectuée.

## Reproduction

```bash
npm test
python -m http.server 4173
```

Dans un navigateur, ouvrir `http://localhost:4173`, puis vérifier l'exécution de `main.py`, les tests `test_main.py`, l'aperçu web, l'import/export et l'installation PWA sous HTTPS.
