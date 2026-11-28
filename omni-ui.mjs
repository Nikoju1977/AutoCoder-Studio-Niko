import {searchTools,makeMission} from './omni-tools.mjs';
import {readConnector} from './code-mode-x-connectors.mjs';
const $=id=>document.getElementById(id);
let selected=null,controller=null;
function render(){
 const tools=searchTools($('omni-search').value),previous=$('omni-select').value;
 $('omni-select').replaceChildren(...tools.map(t=>new Option(t.name+' — '+t.category,t.id)));
 if(tools.some(t=>t.id===previous))$('omni-select').value=previous;
 select();
}
function select(){
 controller?.abort();controller=null;
 selected=searchTools().find(t=>t.id===$('omni-select').value);
 $('omni-meta').textContent=selected?selected.description:'Aucun outil trouvé.';
 $('omni-source').hidden=!selected;
 if(selected)$('omni-source').href='https://github.com/'+selected.repo;
 $('omni-check').disabled=!selected;$('omni-export').disabled=!selected;$('omni-handoff').disabled=!selected;
}
function mission(){return makeMission({repo:$('omni-repo').value.trim(),goal:$('omni-goal').value,tool:selected?.id});}
$('omni-search').addEventListener('input',render);
$('omni-select').addEventListener('change',select);
$('omni-check').addEventListener('click',async()=>{
 if(!selected||controller)return;
 const c=new AbortController();controller=c;$('omni-check').disabled=true;$('omni-meta').textContent='Lecture publique GitHub…';
 try{const data=await readConnector('github.repository',{repo:selected.repo},{signal:c.signal});if(controller===c)$('omni-meta').textContent=JSON.stringify(data,null,2);}
 catch(e){if(controller===c)$('omni-meta').textContent='Non vérifié : '+e.message;}
 finally{if(controller===c){controller=null;$('omni-check').disabled=!selected;}}
});
$('omni-export').addEventListener('click',()=>{
 try{const m=mission(),url=URL.createObjectURL(new Blob([JSON.stringify(m,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='niko-omni-mission.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('omni-status').textContent='Mission exportée. Aucun agent lancé.';}
 catch(e){$('omni-status').textContent=e.message;}
});
$('omni-handoff').addEventListener('click',()=>{
 try{const m=mission(),p=$('prompt');const text='Projet : '+m.repository+'\nOutil proposé : '+m.tool+'\n'+m.goal+'\n'+m.instruction;if(text.length>Number(p.maxLength))throw Error('Mission trop longue pour Code Mode Pro');if(p.disabled)throw Error('Une mission est déjà en cours');if(p.value.trim()&&!window.confirm('Remplacer la mission actuelle ?'))return;p.value=text;p.dispatchEvent(new Event('input',{bubbles:true}));p.focus();$('omni-status').textContent='Mission préparée. Charge le dépôt correspondant, sélectionne les fichiers et confirme la transmission avant de lancer les agents.';}
 catch(e){$('omni-status').textContent=e.message;}
});
render();
