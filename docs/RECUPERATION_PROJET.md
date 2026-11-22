# AutoCoder Studio Niko — Récupérer un projet après interruption

**Mise à jour du code : 22 novembre 2026.** Les fonctionnalités décrites ci-dessous sont committées sur GitHub. La restauration réelle et le déploiement de cette révision sur PC, Android ou iPhone ne sont pas certifiés.

## Copie locale précédente

L'application sauvegarde normalement l'état du projet dans `localStorage` (`studio-niko-autocoder-v2`). Lorsqu'un fichier de code change, elle essaie aussi de conserver une **version précédente** du nom du projet et des fichiers, avec une rotation espacée de deux minutes au maximum. Avant un **import de projet**, une **suppression de fichier** ou une **nouvelle génération**, elle tente de préserver immédiatement le code courant.

Cette copie ne contient pas le jeton d'authentification saisi dans les réglages ni les journaux d'exécution. **Elle contient en revanche le texte intégral des fichiers de code : tout mot de passe ou secret codé en dur y reste en clair.**

Dans **Réglages → Récupération de code après interruption**, deux actions sont disponibles lorsqu'une copie valide existe :

- **Restaurer la copie précédente** : demande confirmation et tente de conserver le projet courant comme nouvelle copie de secours avant d'écraser les fichiers dans l'éditeur. Si cette conservation échoue, la restauration est refusée et l'interface invite à exporter le projet.
- **Exporter le secours JSON** : génère un fichier compatible avec l'import AutoCoder `autocoder-studio-niko-v2`, que tu peux archiver ou transférer manuellement.

Le stockage peut être indisponible, saturé ou supprimé par Safari et les paramètres du navigateur. La présence de ces boutons ne garantit donc pas la récupération après tous les crashs. Un projet de 30 fichiers volumineux peut dépasser la place disponible ; la copie supplémentaire est volontairement limitée à **2,4 millions de caractères JSON**.

## Sauvegarde et téléchargement sur mobile

Le raccourci `Ctrl+S` / `Cmd+S` enregistre l'état local sans annoncer faussement un succès lorsque le navigateur refuse l'écriture. Lorsqu'une modification est en attente et que la page passe à l'arrière-plan, l'application tente de la conserver.

Les exports de projet et les téléchargements de fichiers proposent un **lien manuel** durant environ cinq minutes, pour les navigateurs qui bloquent les téléchargements déclenchés après un traitement. Le téléchargement automatique n'est pas une preuve que le fichier a réellement été enregistré : vérifie toujours ton dossier de téléchargements.

## Protection contre la perte de code

La **suppression de fichier**, l'**import remplaçant le projet** et la **génération d'un nouveau projet** exigent maintenant une copie locale de secours valide. Si le navigateur refuse cette copie (stockage plein ou désactivé, quota dépassé, projet trop volumineux), l'opération est **annulée sans remplacer ni supprimer les fichiers courants**.

Le message d'alerte invite à exporter d'abord les fichiers en JSON. L'export manuel n'ajoute pas de garantie de synchronisation cloud : son téléchargement doit être vérifié par l'utilisateur.

Un scénario de navigateur Chromium avec erreur de quota simulée et un scénario de restauration inverse sont ajoutés aux contrôles automatisés. **Ces scénarios ne remplacent pas la validation sur un appareil iPhone/Android réel ni l'audit d'un navigateur en production.**

## Ce qui ne change pas

- Le moteur Python reste un Worker séparé utilisant Pyodide 0.25.1 ; la première utilisation nécessite l'accès au CDN. Le mode hors ligne ne promet pas un runtime Python prêt.
- L'aperçu web reste sandboxé et sans accès réseau.
- Le mode IA serveur reste optionnel et requiert la configuration du backend et de l'authentification.
- Aucun compte, cloud, télémétrie ou synchronisation automatique de cette copie de secours n'est ajouté.

**À confirmer sur appareils réels :** restauration d'un projet après fermeture forcée, conservation du dernier fichier modifié, téléchargements Safari, disponibilité du stockage et chargement PWA.
