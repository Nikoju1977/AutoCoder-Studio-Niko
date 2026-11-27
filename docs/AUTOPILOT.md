# Autopilot V1 — Studio Niko Design

- Ouvrir `/autopilot.html` depuis Code Mode Pro. Le jeton Vercel existant sert à ouvrir une session signée de sept jours, Secure/HttpOnly/SameSite Strict. Aucun jeton dans le stockage JavaScript. La rotation du jeton révoque toutes les sessions. Logout supprime le cookie local, sans révocation serveur individuelle.
- Les POST authentifiés par cookie exigent une origine HTTPS identique et JSON. Les requêtes Bearer historiques restent compatibles. Les appels session imposent Agnes et plafonnent les tokens de sortie à 4096.
- Catalogue : dépôts publics non archivés de Nikoju1977. Lots de trois dépôts, trois fichiers de 8 Ko max par dépôt, 12 appels max par lot. Les projets sensibles sont signalés pour revue manuelle. Les filtres de secrets sont heuristiques ; n'envoyer aucune donnée privée. Le budget par lot ne constitue pas un quota global serveur. GitHub public peut limiter les lectures.
- Reprise par curseur local ; propositions en mémoire, à exporter avant fermeture. Pas de service permanent, de cron ou d'exécution de code produit. Les dépôts privés ne sont pas accessibles.
- Aucun push, aucune fusion ni promotion par le pilote. Comparer les changements, approuver explicitement l'export, puis soumettre les tests applicatifs et la revue GitHub. Les avis IA et contrôles statiques ne constituent pas une preuve de correction.
- Aucun abonnement ajouté ; consommation éventuelle selon les quotas Agnes. Les tests de session et d'orchestration dans npm test utilisent des fixtures, jamais une clé réelle. Un test Agnes authentifié par le propriétaire reste nécessaire.

## V2 — Revue privée

La [passerelle GitHub privée](REVIEW-BRIDGE.md) permet la transmission d'une proposition approuvée sans export manuel. L'export JSON reste disponible. Aucun push ni fusion automatique.

## UI Engine Pro V1
Dans Autopilot, choisir un profil graphique, autoriser les appels Agnes et démarrer. Les six profils partagent les quatre agents existants et le budget maximum de 12 appels par lot. Chaque profil possède son propre curseur. Seuls les petits fichiers HTML/CSS déjà admissibles sont sélectionnés (trois maximum); pas de JavaScript, framework ajouté, dépôts privés ou sensibles. Les grands fichiers et applications sans fichiers admissibles nécessitent un traitement manuel. Un contrôle lexical conservateur bloque certains changements de contrats HTML et de ressources CSS; il ne garantit ni sécurité ni accessibilité. Toute proposition reste soumise à revue humaine, tests navigateur et validation avant fusion. Les quotas Agnes restent applicables. Aucun rendu visuel ni test réel n'est exécuté par les agents eux-mêmes.
