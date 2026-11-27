# Autopilot V1 — Studio Niko Design

- Ouvrir `/autopilot.html` depuis Code Mode Pro. Le jeton Vercel existant sert à ouvrir une session signée de sept jours, Secure/HttpOnly/SameSite Strict. Aucun jeton dans le stockage JavaScript. La rotation du jeton révoque toutes les sessions. Logout supprime le cookie local, sans révocation serveur individuelle.
- Les POST authentifiés par cookie exigent une origine HTTPS identique et JSON. Les requêtes Bearer historiques restent compatibles. Les appels session imposent Agnes et plafonnent les tokens de sortie à 4096.
- Catalogue : dépôts publics non archivés de Nikoju1977. Lots de trois dépôts, trois fichiers de 8 Ko max par dépôt, 12 appels max par lot. Les projets sensibles sont signalés pour revue manuelle. Les filtres de secrets sont heuristiques ; n'envoyer aucune donnée privée. Le budget par lot ne constitue pas un quota global serveur. GitHub public peut limiter les lectures.
- Reprise par curseur local ; propositions en mémoire, à exporter avant fermeture. Pas de service permanent, de cron ou d'exécution de code produit. Les dépôts privés ne sont pas accessibles.
- Aucun push, aucune fusion ni promotion par le pilote. Comparer les changements, approuver explicitement l'export, puis soumettre les tests applicatifs et la revue GitHub. Les avis IA et contrôles statiques ne constituent pas une preuve de correction.
- Aucun abonnement ajouté ; consommation éventuelle selon les quotas Agnes. Les tests de session et d'orchestration dans npm test utilisent des fixtures, jamais une clé réelle. Un test Agnes authentifié par le propriétaire reste nécessaire.

## V2 — Revue privée

La [passerelle GitHub privée](REVIEW-BRIDGE.md) permet la transmission d'une proposition approuvée sans export manuel. L'export JSON reste disponible. Aucun push ni fusion automatique.

## Mission ciblée NIKO Native V5.1
`npm run innovator:native` affiche la mission sans réseau ni IA. `npm run innovator:native -- --run` effectue une seule requête Agnes via le serveur AutoCoder existant, avec AUTOCODER_ACCESS_TOKEN déjà configuré dans l'environnement local par le propriétaire. Aucun secret à coller dans le chat. Le commit public et les trois fichiers sont fixés, la réponse utilise le parseur Innovateur existant et reste à examiner. Aucun push, aucune fusion, aucun test applicatif exécuté par l'agent. Consommation selon quota Agnes. Les tests de ce lanceur sont simulés; l'appel réel exige une authentification valide.
