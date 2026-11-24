# Code Mode X — V1.0
Studio Niko Design. Extension indépendante d'AutoCoder; aucune modification de l'interface ou de l'API existantes.

## Utilisation
`node scripts/code-mode-x.mjs projet.json` : audit en lecture seule d'un export contenant un tableau files (name/content). Code retour 0 : contrôles statiques sans erreur; 1 : erreurs ou blocage; 2 : entrée invalide.
`npm test` : inclut les tests de l'orchestrateur.

## Moteur
Importer runCodeMode depuis code-mode-x.mjs. Passer prompt, files et éventuellement un adaptateur generate({prompt,files,feedback,signal}) renvoyant {files}. Sans adaptateur, seul l'audit local fonctionne. Avec adaptateur, deux tentatives par défaut (maximum trois), fusion non destructive, audit et proposition à approuver. Aucun fichier n'est écrit, exécuté ni publié. Les erreurs ne divulguent pas le contenu des fichiers. L'appelant doit appliquer son propre délai à l'adaptateur et respecter le signal d'annulation.

Les contrôles JSON, noms de fichiers et motifs de secrets ou d'exécution dynamique sont partiels, non une preuve de sécurité ni une validation de syntaxe JS/Python. Une proposition review_required nécessite une revue et des tests réels. L'adaptateur IA, l'interface, les tests en environnement isolé, GitHub et Vercel automatiques restent à intégrer. Les droits d'auteur et conditions de LICENSE.md restent inchangés.
