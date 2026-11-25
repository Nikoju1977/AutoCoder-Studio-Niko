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

export function patchEndurance(source){
 source=patchRecording(source);
 const edit=(a,b)=>{if(source.split(a).length!==2)throw Error('Endurance patch context changed: '+a.slice(0,32));source=source.replace(a,b);};
 edit('recordLimit=null,monitor=null','recordLimit=null,disk=null,openingDisk=false,economy=false,monitor=null');
 edit("function resize(){","const economyLabel=document.createElement('label');economyLabel.className='field';economyLabel.textContent='Performance ';const economyInput=document.createElement('select');economyInput.id='nexusEconomy';options(economyInput,[['normal','Normal · 30 i/s'],['eco','Économique · 15 i/s']]);economyLabel.append(economyInput);$('format').parentElement.after(economyLabel);economyInput.onchange=()=>{if(recorder||openingDisk||window.nexusVideoLiveActive){economyInput.value=economy?'eco':'normal';status('Arrêter la prise avant de changer la performance');return}economy=economyInput.value==='eco'};\nfunction resize(){");
 edit("if(recorder||window.nexusVideoLiveActive){status('Arrêter la diffusion","if(recorder||openingDisk||window.nexusVideoLiveActive){status('Arrêter la diffusion");
 edit("monitorStream=program.captureStream(24)","monitorStream=program.captureStream(economy?15:24)");
 edit("$('rec').onclick=()=>{if(recorder||window.nexusVideoLiveActive)return;","function startRecording(target=null,forcedMime=null){if(recorder||closed||window.nexusVideoLiveActive){if(target)target.abort().catch(()=>{});return;}");
 edit("stream=program.captureStream(24);const mime=","stream=program.captureStream(economy?15:24);const mime=forcedMime||");
 edit("mime?{mimeType:mime,videoBitsPerSecond:2500000}:{videoBitsPerSecond:2500000}","mime?{mimeType:mime,videoBitsPerSecond:economy?1200000:2500000}:{videoBitsPerSecond:economy?1200000:2500000}");
 edit("recorder=r;chunks=[];bytes=0;","recorder=r;disk=target?{writer:target,tail:Promise.resolve(),queued:0,failed:false,partial:false}:null;chunks=[];bytes=0;");
 edit("r.ondataavailable=e=>{if(e.data.size&&!discard){","r.ondataavailable=e=>{if(e.data.size&&!discard){if(disk){const d=disk;if(d.failed||d.partial)return;if(d.queued+e.data.size>16*1024**2){d.partial=true;stopRecord();return}d.queued+=e.data.size;d.tail=d.tail.then(async()=>{if(!d.failed&&!discard)await d.writer.write(e.data)}).catch(()=>{d.failed=true;stopRecord()}).finally(()=>{d.queued-=e.data.size});return}");
 edit("r.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(!discard&&chunks.length)","r.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const d=disk;if(d){await d.tail;try{if(discard||d.failed){await d.writer.abort();status(discard?'Prise sur disque annulée.':'Écriture disque échouée : fichier non confirmé.')}else{await d.writer.close();status(d.partial||recordLimit==='hard'?'Fichier partiel finalisé : vérifier sa lecture.':'Vidéo enregistrée sur disque, sans audio.')}}catch{status('Finalisation disque échouée : fichier non confirmé.')}disk=null;}else if(!discard&&chunks.length)");
 edit("status('Enregistrement vidéo local sans audio.')}catch(e){stream?.getTracks().forEach(t=>t.stop());recorder=null;status('Enregistrement indisponible : '+e.message)}};$('stop')","status(target?'Écriture progressive sur disque · 5 h maximum · sans audio.':'Enregistrement vidéo local sans audio.')}catch(e){stream?.getTracks().forEach(t=>t.stop());if(target)target.abort().catch(()=>{});disk=null;recorder=null;status('Enregistrement indisponible : '+e.message)}}\n$('rec').onclick=()=>{if(!openingDisk)startRecording()};const diskButton=makeButton('Enregistrer sur disque',async()=>{if(recorder||openingDisk||closed||window.nexusVideoLiveActive)return;if(!window.showSaveFilePicker||!window.MediaRecorder||!program.captureStream){status('Écriture directe indisponible : utiliser Enregistrer vidéo.');return}const mime=['video/webm;codecs=vp8','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));if(!mime){status('Encodage WebM indisponible.');return}openingDisk=true;try{const h=await window.showSaveFilePicker({suggestedName:'nexus-program.webm',types:[{description:'Vidéo WebM',accept:{'video/webm':['.webm']}}]});const w=await h.createWritable();if(closed||recorder||window.nexusVideoLiveActive){await w.abort();return}startRecording(w,mime)}catch(e){status(e.name==='AbortError'?'Choix de fichier annulé.':'Accès au fichier refusé ou indisponible.')}finally{openingDisk=false}});diskButton.id='nexusDisk';diskButton.hidden=!('showSaveFilePicker' in window);$('rec').after(diskButton);$('stop')");
 edit("if(t-last<1000/30)return;","if(t-last<1000/(economy?15:30))return;");
 edit("let last=0;function loop(t)","let last=0,lastThumb=0;function loop(t)");
 edit("thumbs.forEach((c,i)=>V.drawSource(c.getContext('2d'),els[i],0,0,c.width,c.height));","if(!economy||t-lastThumb>=200){lastThumb=t;thumbs.forEach((c,i)=>V.drawSource(c.getContext('2d'),els[i],0,0,c.width,c.height));}");
 edit("if(recorder&&t-recordStart>=600000)stopRecord();","if(recorder&&t-recordStart>=(disk?18000000:600000))stopRecord();");
 return source;
}
