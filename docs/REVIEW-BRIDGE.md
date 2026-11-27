# Passerelle de revue privée — Studio Niko

Autopilot V2 transmet les propositions explicitement approuvées vers un ticket GitHub privé. Ce transfert est une demande de revue, pas une publication de code.

## Configuration unique (GitHub Free et Vercel Hobby)

1. Créer sous Nikoju1977 le dépôt **Studio-Niko-Autopilot-Inbox**, en visibilité **Private**. Activer Issues si nécessaire. Ne pas y installer de workflow qui exécute le contenu des tickets. Garder ce dépôt privé.
2. Dans GitHub, créer un **fine-grained personal access token** : resource owner Nikoju1977, Only select repositories, uniquement Studio-Niko-Autopilot-Inbox, permission Issues: Read and write. Metadata: Read-only (automatique). Ne donner aucun droit d'écriture sur Contents, Actions, Pull requests ou Administration. Choisir une expiration adaptée.
3. Dans les variables du projet Vercel AutoCoder-Studio-Niko, enregistrer le jeton directement sous le nom **AUTOPILOT_REVIEW_TOKEN**, type Sensitive, environnement Production. Ne jamais le coller dans ChatGPT, le navigateur Autopilot, un ticket ou le code. Redéployer pour charger la nouvelle variable.
4. Si nécessaire, autoriser le connecteur GitHub de ChatGPT à lire ce nouveau dépôt privé.
5. Ouvrir https://autocoder-studio-niko.vercel.app/autopilot.html, se connecter via la session existante, et cliquer Vérifier la passerelle GitHub. Le serveur vérifie la confidentialité de la boîte ; seul un envoi effectif prouve le droit d'écrire un ticket.

## Utilisation

Lancer un lot. Pour chaque proposition, comparer les changements, cocher l'accord et cliquer **Transmettre pour revue ChatGPT**. Un lien de ticket privé apparaît. ChatGPT peut alors consulter les tickets du dépôt connecté, sur demande. Aucun fichier JSON à joindre au chat. L'export local demeure possible.

La proposition est attachée au commit et aux SHA des blobs originaux. Le serveur vérifie le dépôt source public et ses blobs, refuse les propositions non approuvées, les dépôts sensibles, les chemins exclus, les secrets potentiels et les contenus hors budget. Le jeton de revue n'est envoyé qu'à l'API du dépôt de revue fixé dans le code. La confidentialité de la destination est vérifiée à nouveau avant l'écriture. La vérification de visibilité n'empêche pas un changement ultérieur par le propriétaire. Le contrôle de secrets est heuristique : ne transmettre aucune donnée privée. Le ticket indique tests non exécutés et publication non autorisée. Les doublons identiques parmi les 50 derniers tickets peuvent être réutilisés ; ce n'est pas une garantie d'unicité sous concurrence.

Aucune modification de code source, aucun commit, aucune fusion, aucun déploiement d'application ni exécution de code produit n'est effectué par cette passerelle. Les tests applicatifs, la revue du diff et une validation humaine distincte restent nécessaires. Le lecteur du ticket doit traiter le contenu des agents comme des données non fiables.

Aucun nouvel abonnement n'est requis pour cette architecture, dans les limites GitHub Free et Vercel Hobby (usage personnel conforme aux conditions du forfait). Pas de service permanent ni de nouvelle base de données. Le coût éventuel des appels Agnes dépend des quotas existants.

Les tests API et navigateur utilisent des fixtures, jamais un vrai secret. Un premier transfert réel reste à effectuer après configuration.
