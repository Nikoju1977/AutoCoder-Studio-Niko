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
- Contrôles statiques heuristiques ���q�^