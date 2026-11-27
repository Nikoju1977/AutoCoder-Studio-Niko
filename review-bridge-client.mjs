// Same-origin browser client; no GitHub credentials in browser storage or requests.
const DESTINATION='Nikoju1977/Studio-Niko-Autopilot-Inbox';
async function call(body,fetchImpl){
 const res=await fetchImpl('/api/review-bridge',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000),...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 let data;try{data=await res.json();}catch{throw Error('Réponse de la passerelle invalide.');}
 if(!res.ok)throw Error(typeof data?.error==='string'?data.error.slice(0,200):'Passerelle HTTP '+res.status);
 return data;
}
export async function bridgeStatus(fetchImpl=globalThis.fetch){
 const d=await call(undefined,fetchImpl);
 if(d?.destination!==DESTINATION||typeof d.configured!=='boolean'||typeof d.ready!=='boolean'||!['setup_required','private_verified','unavailable'].includes(d.state)||d.ready!==(d.state==='private_verified')||d.ready&&!d.configured)throw Error('Statut de la passerelle invalide.');
 return d;
}
export async function sendReview(proposal,approved,fetchImpl=globalThis.fetch){
 if(approved!==true||proposal?.reviewedForExport!==true||proposal?.publicationAuthorized!==false||proposal?.testsExecuted!==false||proposal?.status!=='review_required')throw Error('Validation humaine requise.');
 const d=await call({approved:true,proposal},fetchImpl);
 if(d?.ok!==true||d.publicationAuthorized!==false||!Number.isSafeInteger(d.number)||d.number<1||d.url!=='https://github.com/'+DESTINATION+'/issues/'+d.number||!/^[a-f0-9]{64}$/.test(d.fingerprint))throw Error('Confirmation de revue invalide.');
 return d;
}
