// V25 read-only supervisor. Snapshot evidence is historical, not authenticated at render time.
import {createHash} from 'node:crypto';
import {validateLedger,nextIssues,summary,moveIssue} from './maintenance-ledger.mjs';
const repoPattern=/^Nikoju1977\/[A-Za-z0-9_.-]{1,100}$/;
const sha=/^[a-f0-9]{40}$/;
const positive=n=>Number.isSafeInteger(n)&&n>0;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function validateReleases(s){
 if(s?.version!==1||typeof s.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!Array.isArray(s.rows)||s.rows.length>100)throw Error('Invalid publication snapshot');
 const seen=new Set();
 return {version:1,date:s.date,rows:s.rows.map(r=>{
  if(!repoPattern.test(r.repo)||!sha.test(r.commit)||!positive(r.pr)||!positive(r.ci)||!(r.pages===null||positive(r.pages))||!(r.incident===null||positive(r.incident))||seen.has(r.repo.toLowerCase()))throw Error('Invalid publication evidence');
  seen.add(r.repo.toLowerCase());
  return {repo:r.repo,commit:r.commit,pr:r.pr,ci:r.ci,pages:r.pages,incident:r.incident};
 })};
}
export function planBatch(l,limit=3){
 validateLedger(l);
 const items=nextIssues(l,limit).map(({id,repo,path,commit,code,priority,confirmation})=>({id,repo,path,commit,code,priority,confirmation}));
 const plan={revision:l.revision,items,execution:'operator_required',automaticWrites:false};
 return {...plan,digest:digest(plan)};
}
// Explicit operator claim: mark only the exact planned queue entries, never execute or publish.
export function claimBatch(l,expectedDigest,limit=3){
 const plan=planBatch(l,limit);
 if(!plan.items.length||expectedDigest!==plan.digest)throw Error('Plan changed or empty');
 return plan.items.reduce((current,t)=>moveIssue(current,t.id,'running'),l);
}
export function supervise(l,releaseSnapshot){
 validateLedger(l);
 const releases=validateReleases(releaseSnapshot);
 const stats=summary(l);
 const groups=new Map();
 for(const t of l.issues){
  const group=groups.get(t.repo)||{repo:t.repo,queued:0,running:0,blocked:0,review_required:0,evidence_recorded:0,cancelled:0,total:0};
  group[t.state]++;group.total++;groups.set(t.repo,group);
 }
 return {version:25,ledgerRevision:l.revision,counts:stats.states,total:stats.total,groups:[...groups.values()].sort((a,b)=>a.repo.localeCompare(b.repo)),next:planBatch(l),releases,productionVerified:false,liveVerification:false,scope:'Local maintenance metadata and historical publication evidence only'};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export function renderSupervisor(l,snapshot){
 const r=supervise(l,snapshot),link=(repo,suffix,label)=>'<a href="https://github.com/'+esc(repo)+suffix+'">'+esc(label)+'</a>';
 const rows=r.groups.map(g=>'<tr><th scope="row">'+esc(g.repo)+'</th>'+['queued','running','blocked','review_required','evidence_recorded','cancelled'].map(k=>'<td>'+g[k]+'</td>').join('')+'</tr>').join('');
 const missions=r.next.items.map(t=>'<li><strong>'+esc(t.code)+'</strong> · '+esc(t.repo)+'<br><code>'+esc(t.path)+'</code> · '+esc(t.commit.slice(0,8))+' · '+esc(t.confirmation)+'</li>').join('');
 const publications=r.releases.rows.map(t=>'<tr><th scope="row">'+esc(t.repo)+'</th><td>'+link(t.repo,'/commit/'+t.commit,t.commit.slice(0,8))+'</td><td>'+link(t.repo,'/actions/runs/'+t.ci,'CI historique réussie')+'</td><td>'+(t.pages?link(t.repo,'/actions/runs/'+t.pages,'Pages historique réussie'):'Non confirmée')+(t.incident?' · '+link(t.repo,'/actions/runs/'+t.incident,'Incident conservé'):'')+'</td></tr>').join('');
 return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; style-src &apos;unsafe-inline&apos;; base-uri &apos;none&apos;; form-action &apos;none&apos;"><title>Code Mode Pro · Superviseur V25</title><style>body{font:16px system-ui,sans-serif;background:#101823;color:#eef4fa;margin:0}main{max-width:1100px;margin:auto;padding:24px}a{color:#86dfd0}h1{font-size:clamp(1.7rem,4vw,2.8rem)}section{margin:24px 0;padding:18px;background:#192533;border:1px solid #354458;border-radius:12px}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;padding:12px;border-bottom:1px solid #354458}code{overflow-wrap:anywhere}small{color:#b4c4d5}li{margin:12px 0}</style></head><body><main><small>STUDIO NIKO DESIGN / CODE MODE PRO V25</small><h1>Superviseur de maintenance</h1><p>Révision '+r.ledgerRevision+' · '+r.total+' incidents enregistrés. Rapport local, lecture seule. Aucun test ou déploiement exécuté par ce rapport.</p><section><h2>Par dépôt</h2><div class="scroll" role="region" aria-label="Incidents par dépôt" tabindex="0"><table><thead><tr><th>Dépôt</th><th>En attente</th><th>En cours</th><th>Bloqué</th><th>À revoir</th><th>Preuve enregistrée</th><th>Annulé</th></tr></thead><tbody>'+rows+'</tbody></table></div></section><section><h2>Prochain lot (3 maximum)</h2><ol>'+missions+'</ol><p>Une réservation explicite ne constitue pas une exécution. Empreinte du plan : <code>'+esc(r.next.digest)+'</code></p></section><section><h2>Publications historiques</h2><p>Instantané du '+esc(r.releases.date)+' ; liens de preuves, pas une vérification en direct. Publication ne signifie pas validation fonctionnelle en production.</p><div class="scroll" role="region" aria-label="Preuves historiques" tabindex="0"><table><thead><tr><th>Dépôt</th><th>Commit</th><th>CI</th><th>Publication</th></tr></thead><tbody>'+publications+'</tbody></table></div></section><p>Les données de maintenance locales peuvent contenir des chemins internes. Ne pas publier ce rapport sans revue.</p></main></body></html>';
}
