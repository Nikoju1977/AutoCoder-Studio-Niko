// Exact-version Nexus 17.5 repair; no network or publication in this module.
import {createHash} from 'node:crypto';
export const originalHash='b352fd87b471e2cae4b3aeb30576673d1f6453bf';
export function patchRecording(source){
 if(createHash('sha1').update(source).digest('hex')!==originalHash)throw Error('Nexus source changed');
 const edit=(a,b)=>{if(source.split(a).length!==2)throw Error('Patch context changed');source=source.replace(a,b);};
 edit('discard=false,monitor=null','discard=false,recordLimit=null,monitor=null');
 edit("discard=remove;if(recorder.state!=='inactive')recorder.stop()","discard=discard||remove;if(recorder.state!=='inactive')recorder.stop()");
 edit('recorded=null;discard=false;recordStart=performance.now();','recorded=null;discard=false;recordLimit=null;recordStart=performance.now();');
 edit("if(bytes+e.data.size>150*1024**2){stopRecord(true);status('Limite mémoire atteinte : prise effacée');return}chunks.push(e.data);bytes+=e.data.size","if(bytes+e.data.size>150*1024**2){recordLimit='hard';stopRecord();status('Limite mémoire : conservation des données déjà reçues');return}if(recordLimit==='hard')return;chunks.push(e.data);bytes+=e.data.size;if(bytes>=120*1024**2&&recordLimit===null){recordLimit='soft';stopRecord();status('Limite préventive : finalisation de la prise')}");
 edit("status('Vidéo locale exportée, sans audio.')","status(recordLimit==='hard'?'Export partiel : vérifier la lecture du fichier.':recordLimit==='soft'?'Prise préservée et exportée à la limite mémoire, sans audio.':'Vidéo locale exportée, sans audio.')");
 edit("r.onerror=()=>{discard=true;stopRecord(true);status('Erreur encodeur local')}","r.onerror=()=>{recordLimit='hard';stopRecord();status('Erreur encodeur : tentative de récupération de la prise')}");
 return source;
}
