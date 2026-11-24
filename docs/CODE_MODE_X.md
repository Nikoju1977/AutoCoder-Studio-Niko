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

## V3 — fournisseurs supplémentaires
OpenAI est conservé. Deux clés serveur facultatives : MISTRAL_API_KEY et AGNES_API_KEY. Modèles modifiables via MISTRAL_MODEL (mistral-small-latest) et AGNES_MODEL (agnes-2.5-flash).
Dans Vercel > projet > Settings > Environment Variables, saisir les clés comme variables sensibles et conserver AUTOCODER_ACCESS_TOKEN (32 caractères minimum). Redéployer la branche après configuration. Aucune clé dans le dépôt ni dans le navigateur.
AUTOCODER_DEFAULT_PROVIDER permet de choisir openai, mistral ou agnes. Sans choix, le premier configuré est utilisé dans cet ordre. Le client peut spécifier provider et role dans POST /api/generate. Les variables AUTOCODER_ARCHITECT_PROVIDER, AUTOCODER_DEVELOPER_PROVIDER et AUTOCODER_CRITIC_PROVIDER permettent une répartition indépendante. Pas de basculement automatique vers un tiers en cas d'erreur : éviter des coûts et transferts de code inattendus. Aucun appel réel sans clés configurées.
Sources : https://docs.mistral.ai/api/endpoint/chat ; https://github.com/AgnesAI-Labs/AgnesAI-Models/blob/main/MODEL_CATALOG.md .

## V4 — Software Factory (Git local)
Cloner un dépôt avec Git puis lancer depuis AutoCoder : node scripts/factory.mjs chemin-du-clone .
Le moteur lit le commit HEAD via ls-tree et cat-file, sans lancer ni modifier le code du dépôt. Les fichiers non suivis et changements non commités sont ignorés. L'inventaire distingue fichiers inspectés, exclus, non réguliers et limites de budget. Les motifs détectés sont heuristiques.
Mémoire locale explicite : node scripts/factory.mjs chemin-du-clone --remember identifiant journal.jsonl . Choisir un journal privé hors dépôt. Il contient les chemins, constats et commit, pas le code source. L'empreinte SHA-256 n'est pas une signature.
API Node : readSnapshot, prepareContext (sélection manuelle de 1 à 12 fichiers, alias compatibles avec le moteur V2), prepareChanges (proposition associée au SHA du blob d'origine). Les alias doivent être expliqués au modèle si nécessaire; aucun patch appliqué automatiquement et aucun test du projet cible exécuté. Pas encore de synchronisation GitHub automatisée, ni d'interface, ni d'apprentissage automatique. Les secrets peuvent échapper à la détection; ne transmettre que des fichiers explicitement autorisés.

## V5 — Interface de pilotage
Ouvrir code-mode-x.html depuis AutoCoder. Importer un export JSON ou charger le projet local existant, auditer sans réseau, choisir les fournisseurs et lancer une mission après consentement. Comparaison côte à côte et export JSON compatible AutoCoder, aucun écrasement automatique. Le jeton AutoCoder n'est pas persisté, les clés fournisseur restent dans Vercel. Les limites de contexte V2 restent en vigueur. La page ne donne pas accès au terminal Git local de V4 : ce module reste en CLI Node. La disponibilité affichée est une configuration déclarée par le serveur, pas une vérification de clé. Le cache PWA inclut la nouvelle page après installation du service worker AutoCoder.

## V6 — GitHub public en lecture seule
Depuis Code Mode X, saisir propriétaire/dépôt, lister puis sélectionner 1 à 12 fichiers. Les appels sont directs à api.github.com, sans authentification, et soumis aux quotas publics. Le commit de la branche par défaut et les SHA des blobs sont conservés. L'inventaire peut être partiel; seuls les fichiers texte admissibles de 12 Ko maximum sont proposés. Les fichiers mjs/cjs sont aliasés en js pour l'API existante. Le JSON de proposition GitHub est distinct de l'export AutoCoder; il contient le commit, les chemins et SHA attendus, sans écriture ni PR automatique. Revue et tests nécessaires. Les fichiers privés, les secrets potentiels et les chemins exclus ne sont pas chargés. La détection des secrets est partielle. Les tests réseau simulés ne prouvent pas la disponibilité GitHub en production.
