// Studio Niko Design — V8: evidence-based improvement planning, no execution or writes.
import {audit} from './code-mode-x.mjs';
export const SELF_REPO='Nikoju1977/AutoCoder-Studio-Niko';
const definitions={
 JSON_INVALID:{priority:1,title:'Corriger le JSON invalide',checks:['Analyser le JSON avec un parseur','Exécuter les tests du module concerné'],mission:'Corriger exclusivement la syntaxe JSON invalide sans changer les données ni les paramètres de sécurité.'},
 POSSIBLE_SECRET:{priority:0,title:'Examiner un secret potentiel localement',checks:['Vérifier si le motif est réellement un secret','Si nécessaire, révoquer et remplacer le secret hors de l’application'],mission:null},
 DYNAMIC_EXECUTION:{priority:2,title:'Examiner une exécution dynamique',checks:['Vérifier les entrées non fiables','Tester les chemins légitimes et les entrées invalides'],mission:'Examiner les constructions d’exécution dynamique signalées et proposer une alternative déterministe si possible, sans élargir les permissions.'},
 REVIEW_HTML_SINK:{priority:2,title:'Examiner une injection HTML',checks:['Vérifier les entrées utilisateur','Tester le rendu et les entrées HTML non fiables'],mission:'Examiner les affectations HTML signalées et privilégier les API DOM textuelles quand elles conviennent, en préservant le rendu.'}
};
export function improvementPlan(project){
 if(!project||!Array.isArray(project.files)||!project.files.length)throw Error('Charger un projet');
 const result=audit(project.files),groups=new Map();
 for(const f of result.findings){
  if(!Object.hasOwn(definitions,f.code))continue;
  if(!groups.has(f.code))groups.set(f.code,[]);
  groups.get(f.code).push({path:project.github?.mapping.find(m=>m.name===f.file)?.path||f.file,line:f.line});
 }
 const tasks=[...groups].map(([code,locations])=>({id:code,...definitions[code],locations:locations.slice(0,10),occurrences:locations.length,origin:'static_heuristic'})).sort((a,b)=>a.priority-b.priority);
 tasks.push({id:'REGRESSION_REVIEW',priority:3,title:'Revoir la couverture des régressions',locations:[],occurrences:null,origin:'recommended_not_verified',checks:['Identifier les tests existants','Exécuter les tests pertinents sur une branche de développement','Vérifier les fonctions existantes après modification'],mission:'Examiner la couverture de régression des fichiers sélectionnés. Proposer uniquement des améliorations ciblées et indiquer les tests à exécuter; ne pas prétendre les avoir exécutés.'});
 return {project:project.name,commit:project.github?.commit??null,scope:'Fichiers sélectionnés uniquement; contrôles heuristiques',fileCount:result.fileCount,testsExecuted:false,tasks};
}
export function taskPrompt(plan,id){
 const task=plan?.tasks.find(t=>t.id===id);
 if(!task?.mission)throw Error('Cette intervention doit rester locale');
 if(plan.tasks.some(t=>t.id==='POSSIBLE_SECRET'))throw Error('Secret potentiel : résoudre localement avant une mission IA');
 return task.mission+' Préserver les autorisations, garde-fous, limites de coût et validations existants. Aucun déploiement automatique.';
}
