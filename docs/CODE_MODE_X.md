# Code Mode X — V1.0
Studio Niko Design. Extension indépendante d'AutoCoder; aucune modification de l'interface ou de l'API existantes.

## Utilisation
`node scripts/code-mode-x.mjs projet.json` : audit en lecture seule d'un export contenant un tableau files (name/content). Code retour 0 : contrôles statiques sans erreur; 1 : erreurs ou blocage; 2 : entrée invalide.
`npm test` : inclut les tests de l'orchestrateur.

## Moteur
Importer runCodeMode depuis code-mode-x.mjs. Passer prompt, files et éventuellement un adaptateur generate({prompt,files,feedback,signal}) renvoyant {files}. Sans adaptateur, seul l'audit local fonctionne. Avec adaptateur, deux tentatives par défaut (maximum trois), fusion non destructive, audit et proposition à approuver. Aucun fichier n'est écrit, exécuté ni publié. Les erreurs ne divulguent pas le contenu des fichiers. L'appelant doit appliquer son propre délai à l'adaptateur et respecter le signal d'annulation.

Les contrôles JSON, noms de fichiers et motifs de secrets ou d'exécution dynamique sont partiels, non une preuve de sécurité ni une validation de syntaxe JS/Python. Une proposition review_required nécessite une revue et des tests réels. L'interface, les tests en environnement isolé, GitHub et Vercel automatiques restent à intégrer. Les droits d'auteur et conditions de LICENSE.md restent inchangés.

## V2 — équipe agentique
Le module code-mode-x-team.mjs orchestre les rôles architecte, développeur et critique, en appels séquentiels à la même API protégée. Le critique est une opinion de modèle, non une preuve d'indépendance, de sécurité ou de réussite des tests. Les modifications restent des propositions. Les limites du serveur sont respectées sans tronquer silencieusement le contexte : 12 fichiers, 12 000 caractères par fichier, 80 000 octets de requête, 4 000 caractères de prompt. Au maximum sept appels par exécution, deux tentatives par défaut, délai HTTP de 65 secondes par appel.
L'export AutoCoder natif (files objet) et le tableau name/content sont acceptés.
Audit gratuit hors ligne : node scripts/code-mode-x.mjs projet.json
Équipe IA : définir AUTOCODER_ACCESS_TOKEN dans l'environnement, puis node scripts/code-mode-x.mjs projet.json --team "Améliorer la gestion des erreurs".
Le mode --team transmet explicitement le contexte au serveur et à son fournisseur IA ; le jeton reste hors des fichiers. Ne pas y envoyer de secrets. Les appels peuvent être facturés par le fournisseur, l'accès API et ses quotas ne sont pas garantis. Aucun accès réseau n'est requis pour les tests avec transport simulé. Aucun déploiement ni exécution du code généré. Interface graphique à intégrer.
