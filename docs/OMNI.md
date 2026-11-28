# Code Mode Pro V21 — OMNI

Depuis Code Mode Pro, ouvrir Autopilot. Authentification existante, choisir le budget maximal, autoriser les appels Agnes et démarrer. Les lots s'enchaînent automatiquement, avec arrêt à la fin, sur erreur, annulation ou plafond. Ne pas fermer la page avant la revue : les propositions sont conservées en mémoire de la page, seul le curseur est persistant. Réinitialiser le curseur pour reprendre depuis le début. Les dépôts sensibles restent en revue manuelle. Les résultats d'IA ne constituent pas une preuve de test.

Les neuf ressources sont référencées dans un registre. Le routeur déterministe recommande des ressources en fonction du nom du dépôt ; il ne les installe ni ne les exécute. Le panneau peut lire les métadonnées publiques des ressources et préparer une mission. Les annuaires ne sont pas des moteurs. Aucun accès automatique à des secrets ni installation de code tiers. Aucun push, fusion ou déploiement de projet cible. Le transfert privé reste soumis à la revue existante.

## Moteurs locaux optionnels
Installer Ollama ou Langflow sur une machine de confiance, les maintenir sur loopback et configurer leurs modèles/flows. Exporter une mission depuis OMNI. Node >= 20 :
- node scripts/omni-local.mjs ollama NOM_MODELE mission.json --run
- LANGFLOW_API_KEY doit être défini dans l'environnement avant node scripts/omni-local.mjs langflow ID_FLOW mission.json --run

Les adaptateurs effectuent des appels HTTP locaux avec délai et taille bornés. Ils ne sont pas exécutés par Vercel : localhost désignerait le serveur distant, pas le poste utilisateur. Un workflow Langflow peut lui-même utiliser des services distants ; vérifier sa configuration. OpenHands et Scrapling nécessitent une installation distincte. Aucune promesse de gratuité des API tierces. Vérifier les licences de chaque ressource avant réutilisation.

## Validation
npm test ; npm run test:e2e. Les tests OMNI utilisent un transport simulé et ne prouvent pas le fonctionnement de fournisseurs réels. Vérifier les campagnes, les contrôles de budget et la revue avant publication.
