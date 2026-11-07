/* AutoCoder 2.0 — Studio Niko. Frontend sans framework ni secrets. */
(() => {
  'use strict';
  const STORAGE_KEY = 'studio-niko-autocoder-v2';
  const ACCEPTED = /^(?!\.)(?!.*\.\.)([a-zA-Z0-9][a-zA-Z0-9_.-]{0,63})\.(py|html|css|js|md|json)$/;
  const MAX_FILES = 30;
  const MAX_FILE_SIZE = 120_000;
  const PYTHON_CODE_MAX = 90_000;
  const byId = id => document.getElementById(id);
  const now = () => new Date().toLocaleTimeString('fr-FR', { hour12: false });
  const fileExt = name => (name.split('.').pop() || '').toLowerCase();
  const langFor = name => ({ py:'Python', html:'HTML', css:'CSS', js:'JavaScript', md:'Markdown', json:'JSON' }[fileExt(name)] || 'Texte');
  const clone = v => JSON.parse(JSON.stringify(v));
  const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const pythonDefault = `"""Exemple Python fourni par AutoCoder Studio Niko."""\n\ndef saluer(nom: str) -> str:\n    """Retourne un message de bienvenue."""\n    if not nom.strip():\n        raise ValueError("Le nom ne peut pas être vide")\n    return f"Bonjour, {nom.strip()} !"\n\n\nif __name__ == "__main__":\n    print(saluer("Studio Niko"))\n`;
  const testDefault = `"""Tests du module main (unittest, bibliothèque standard)."""\nimport unittest\nfrom main import saluer\n\n\nclass TestSaluer(unittest.TestCase):\n    def test_nom(self):\n        self.assertEqual(saluer("Niko"), "Bonjour, Niko !")\n\n    def test_espaces(self):\n        self.assertEqual(saluer("  Niko "), "Bonjour, Niko !")\n\n    def test_vide(self):\n        with self.assertRaises(ValueError):\n            saluer("  ")\n`;
  const defaultState = () => ({projectName:'mon-projet', files:{'main.py':pythonDefault,'test_main.py':testDefault},activeFile:'main.py',opened:['main.py','test_main.py'],prompt:'',mode:'local',timeout:20,logs:[]});
  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!value || typeof value !== 'object' || !value.files || Array.isArray(value.files)) return defaultState();
      const files = {};
      for (const [name, contents] of Object.entries(value.files).slice(0,MAX_FILES)) {
        if (ACCEPTED.test(name) && typeof contents === 'string' && contents.length <= MAX_FILE_SIZE) files[name] = contents;
      }
      if (!Object.keys(files).length) return defaultState();
      const validNames = Object.keys(files);
      return {
        projectName: typeof value.projectName === 'string' ? value.projectName.slice(0,50) : 'mon-projet',
        files, activeFile: files[value.activeFile] !== undefined ? value.activeFile : validNames[0],
        opened: Array.isArray(value.opened) ? value.opened.filter(name => files[name] !== undefined).slice(0,30) : [validNames[0]],
        prompt: typeof value.prompt === 'string' ? value.prompt.slice(0,4000) : '',
        mode: value.mode === 'server' ? 'server' : 'local', timeout: [10,20,30].includes(value.timeout) ? value.timeout : 20,
        logs: Array.isArray(value.logs) ? value.logs.filter(l => l && typeof l.message === 'string').slice(-40).map(l => ({time:String(l.time||''),type:String(l.type||'info'),source:String(l.source||'SYSTÈME'),message:l.message.slice(0,1800)})) : []
      };
    } catch {return defaultState();}
  }
  let state = readState();
  let authToken = ''; // Jamais enregistré sur disque ou dans localStorage.
  let worker = null;
  let workerReady = false;
  let busy = false;
  let activeRequest = null;
  let executionTimeout = null;
  let loadingTimeout = null;
  let saveTimer = null;
  let toastTimer = null;
  let previewShown = false;
  let logView = 'logs';
  const agents = ['architect','coder','executor','critic'];

  function persist() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); byId('save-indicator').textContent = '● Enregistré'; }
    catch {byId('save-indicator').textContent = '● Stockage indisponible'; toast('Stockage du navigateur saturé ou interdit : exporte le projet.',true);}
  }
  function scheduleSave() {byId('save-indicator').textContent='◌ Enregistrement…';clearTimeout(saveTimer);saveTimer=setTimeout(persist,350);}
  function toast(message,isError=false){
    const el=byId('toast');el.textContent=message;el.style.borderColor=isError?'#bb6676':'#6582ab';el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),3500);
  }
  function log(message,type='info',source='SYSTÈME') {
    const entry={time:now(),type,source,message:String(message).slice(0,4000)};
    state.logs.push(entry);if(state.logs.length>160)state.logs.splice(0,state.logs.length-160);
    if (logView==='logs') renderLogs();
    scheduleSave();
  }
  function renderLogs() {
    const view=byId('log-list');view.replaceChildren();
    if(!state.logs.length){const p=document.createElement('p');p.className='muted-help';p.textContent='Aucune activité. Écris une demande ou lance du code.';view.append(p);return;}
    for (const entry of state.logs){
      const line=document.createElement('div');line.className='log-entry '+(['success','error','warning','agent','output'].includes(entry.type)?entry.type:'info');
      const meta=document.createElement('div');meta.className='log-meta';
      const src=document.createElement('span');src.textContent=entry.source;
      const time=document.createElement('span');time.textContent=entry.time;meta.append(src,time);
      const text=document.createElement('div');text.className='log-message';text.textContent=entry.message;
      line.append(meta,text);view.append(line);
    }
    const scroller=byId('logs-view');scroller.scrollTop=scroller.scrollHeight;
  }
  function agentStatus(name,status,label) {
    const node=document.querySelector(`[data-agent="${name}"]`);
    node.classList.remove('running','done','error');
    if(['running','done','error'].includes(status))node.classList.add(status);
    byId('status-'+name).textContent=label;
    byId('indicator-'+name).textContent=status==='running'?'◉':status==='done'?'✓':status==='error'?'!':'○';
  }
  function resetAgents(){agents.forEach(n=>agentStatus(n,'idle','En attente'));}
  function updateMode(){
    const on=state.mode==='server';
    byId('mode-label').textContent=on?'MODE IA SERVEUR':'AUTOMATISATION LOCALE';
    byId('notice-mode').textContent=on?'IA : serveur et jeton requis':'Modèles locaux : sans IA ni clé API';
    byId('footer-mode').textContent=on?'IA SERVEUR':'LOCAL';byId('pipeline-mode').textContent=on?'IA':'LOCAL';
    byId('settings-mode').value=state.mode;byId('settings-timeout').value=String(state.timeout);byId('server-fields').classList.toggle('hidden',!on);
  }
  function updateSummary(){
    const files=Object.keys(state.files);byId('file-count').textContent=String(files.length);byId('project-name').textContent=state.projectName;
    byId('footer-files').textContent=`${files.length} FICHIER${files.length>1?'S':''}`;
    byId('current-file-label').textContent=state.activeFile||'Aucun fichier';
    byId('editor-language').textContent=langFor(state.activeFile||'txt');
    byId('btn-preview').disabled=!('index.html' in state.files);
  }
  function renderFiles(){
    const root=byId('file-list');root.replaceChildren();
    Object.keys(state.files).sort((a,b)=>a.localeCompare(b)).forEach(name=>{
      const el=document.createElement('button');el.type='button';el.className='file-item'+(state.activeFile===name?' active':'');el.dataset.ext=fileExt(name);el.title='Ouvrir '+name;el.setAttribute('aria-label','Ouvrir '+name);
      const ico=document.createElement('span');ico.className='file-symbol';ico.textContent=({py:'Py',html:'<>',css:'{}',js:'JS',md:'Md',json:'{}'})[fileExt(name)]||'•';
      const label=document.createElement('span');label.className='file-name';label.textContent=name;
      const del=document.createElement('span');del.className='delete-file';del.textContent='×';del.title='Supprimer '+name;del.setAttribute('aria-label','Supprimer '+name);
      del.addEventListener('click',ev=>{ev.stopPropagation();deleteFile(name);});
      el.append(ico,label,del);el.addEventListener('click',()=>openFile(name));root.append(el);
    });updateSummary();
  }
  function renderTabs(){
    const root=byId('tabs');root.replaceChildren();
    for(const name of state.opened){
      if(!(name in state.files))continue;
      const btn=document.createElement('button');btn.type='button';btn.className='tab-btn'+(name===state.activeFile?' active':'');btn.textContent=name;btn.setAttribute('role','tab');btn.setAttribute('aria-selected',String(name===state.activeFile));btn.addEventListener('click',()=>openFile(name));root.append(btn);
    }
  }
  function openFile(name){
    if(!(name in state.files))return;
    state.activeFile=name;if(!state.opened.includes(name))state.opened.push(name);
    previewShown=false;byId('preview-area').classList.add('hidden');byId('editor-area').classList.remove('hidden');
    byId('code-editor').value=state.files[name];byId('empty-editor').classList.add('hidden');
    renderFiles();renderTabs();updateLineNumbers();updateCursor();scheduleSave();
  }
  function updateLineNumbers(){
    const count=byId('code-editor').value.split('\n').length;
    byId('line-numbers').textContent=Array.from({length:Math.min(count,7000)},(_,i)=>String(i+1)).join('\n');
    byId('line-numbers').scrollTop=byId('code-editor').scrollTop;
  }
  function updateCursor(){
    const el=byId('code-editor');const before=el.value.slice(0,el.selectionStart);const lines=before.split('\n');
    byId('editor-position').textContent=`Ligne ${lines.length}, colonne ${lines.at(-1).length+1}`;
  }
  function changeFile(content){
    if(!state.activeFile)return;
    if(content.length>MAX_FILE_SIZE){toast('Limite : 120 000 caractères par fichier.',true);return;}
    state.files[state.activeFile]=content;updateLineNumbers();updateCursor();scheduleSave();
  }
  function newFile(){
    if(Object.keys(state.files).length>=MAX_FILES){toast('30 fichiers maximum.',true);return;}
    const name=window.prompt('Nom du fichier (ex. utilitaires.py, index.html) :','nouveau.py');
    if(name===null)return;
    if(!ACCEPTED.test(name)){toast('Nom invalide. Extensions : py, html, css, js, md, json.',true);return;}
    if(name in state.files){toast('Un fichier porte déjà ce nom.',true);return;}
    state.files[name]='';openFile(name);log('Fichier créé : '+name,'success');
  }
  function deleteFile(name){
    if(Object.keys(state.files).length<=1){toast('Conserve au moins un fichier.',true);return;}
    if(!window.confirm(`Supprimer définitivement « ${name} » du projet local ?`))return;
    delete state.files[name];state.opened=state.opened.filter(n=>n!==name);
    if(state.activeFile===name){const next=Object.keys(state.files)[0];openFile(next);}
    else{renderFiles();renderTabs();scheduleSave();}
    log('Fichier supprimé : '+name,'warning');
  }
  function download(filename,content,mime){
    const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function exportProject(){
    persist();const payload={format:'autocoder-studio-niko-v2',exportedAt:new Date().toISOString(),projectName:state.projectName,files:state.files};
    download((state.projectName.replace(/[^a-z0-9_-]/gi,'-')||'autocoder')+'.json',JSON.stringify(payload,null,2),'application/json');
    log('Projet exporté en JSON ('+Object.keys(state.files).length+' fichiers).','success');
  }
  async function importProject(file){
    if(!file)return;
    if(file.size>2_000_000){toast('Import limité à 2 Mo.',true);return;}
    try{
      const payload=JSON.parse(await file.text());if(!payload||!payload.files||typeof payload.files!=='object'||Array.isArray(payload.files))throw Error('JSON de projet invalide.');
      const entries=Object.entries(payload.files);
      if(entries.length<1||entries.length>MAX_FILES)throw Error('Le projet doit contenir de 1 à 30 fichiers.');
      const files={};
      for(const [name,content] of entries){if(!ACCEPTED.test(name)||typeof content!=='string'||content.length>MAX_FILE_SIZE)throw Error('Fichier invalide : '+name);files[name]=content;}
      if(!window.confirm('Importer ce projet et remplacer les fichiers présents ? Exporte d’abord les fichiers actuels si nécessaire.'))return;
      state.files=files;state.projectName=String(payload.projectName||'projet-importe').slice(0,50);
      state.opened=Object.keys(files).slice(0,8);openFile(state.opened[0]);resetAgents();
      log('Projet importé : '+entries.length+' fichier(s).','success');toast('Projet importé.');
    }catch(err){log('Import refusé : '+err.message,'error');toast('Import impossible : '+err.message,true);}
  }

  const pythonTemplates={
    calculator:{
      name:'calculatrice-python',
      plan:['Définir les opérations et les erreurs attendues.','Créer le module Python et ses tests unitaires.','Lancer les tests pour vérifier les comportements.'],
      files:{
        'main.py':`"""Calculatrice Python — Studio Niko."""\n\ndef calculer(a: float, b: float, operation: str) -> float:\n    operations = {\n        "+": lambda x, y: x + y,\n        "-": lambda x, y: x - y,\n        "*": lambda x, y: x * y,\n        "/": lambda x, y: x / y,\n    }\n    if operation not in operations:\n        raise ValueError("Opération inconnue")\n    if operation == "/" and b == 0:\n        raise ZeroDivisionError("Division par zéro")\n    return operations[operation](a, b)\n\n\nif __name__ == "__main__":\n    print("12 + 8 =", calculer(12, 8, "+"))\n    print("12 / 4 =", calculer(12, 4, "/"))\n`,
        'test_main.py':`import unittest\nfrom main import calculer\n\n\nclass TestCalculatrice(unittest.TestCase):\n    def test_addition(self):\n        self.assertEqual(calculer(3, 2, "+"), 5)\n\n    def test_multiplication(self):\n        self.assertEqual(calculer(3, 2, "*"), 6)\n\n    def test_division(self):\n        self.assertEqual(calculer(9, 3, "/"), 3)\n\n    def test_division_zero(self):\n        with self.assertRaises(ZeroDivisionError):\n            calculer(3, 0, "/")\n\n    def test_operation_inconnue(self):\n        with self.assertRaises(ValueError):\n            calculer(3, 0, "?")\n`
      }
    },
    todo:{name:'gestion-taches-python',plan:['Modéliser les tâches et leur état.','Implémenter une classe de gestion.','Vérifier la création et la validation de tâches.'],files:{
      'main.py':`"""Gestionnaire de tâches en mémoire."""\n\nclass GestionnaireTaches:\n    def __init__(self):\n        self._taches = []\n\n    def ajouter(self, titre: str) -> int:\n        if not titre.strip():\n            raise ValueError("Titre obligatoire")\n        self._taches.append({"titre": titre.strip(), "terminee": False})\n        return len(self._taches) - 1\n\n    def terminer(self, identifiant: int) -> None:\n        self._taches[identifiant]["terminee"] = True\n\n    def en_cours(self) -> list[str]:\n        return [t["titre"] for t in self._taches if not t["terminee"]]\n\n\nif __name__ == "__main__":\n    g = GestionnaireTaches()\n    g.ajouter("Créer AutoCoder")\n    g.ajouter("Tester le code")\n    print("Tâches :", g.en_cours())\n`,
      'test_main.py':`import unittest\nfrom main import GestionnaireTaches\n\n\nclass TestGestionnaire(unittest.TestCase):\n    def test_ajouter(self):\n        g = GestionnaireTaches()\n        self.assertEqual(g.ajouter("Tester"), 0)\n        self.assertEqual(g.en_cours(), ["Tester"])\n\n    def test_terminer(self):\n        g = GestionnaireTaches()\n        i = g.ajouter("Terminer")\n        g.terminer(i)\n        self.assertEqual(g.en_cours(), [])\n\n    def test_titre_obligatoire(self):\n        with self.assertRaises(ValueError):\n            GestionnaireTaches().ajouter(" ")\n`
    }},
    text:{name:'analyse-texte-python',plan:['Séparer les mots sans dépendance externe.','Compter les occurrences.','Écrire des tests sur les cas simples et vides.'],files:{
      'main.py':`"""Comptage de mots en Python."""\nfrom collections import Counter\nimport re\n\n\ndef analyser(texte: str) -> dict[str, int]:\n    mots = re.findall(r"[\\wÀ-ÿ]+", texte.lower(), flags=re.UNICODE)\n    return dict(Counter(mots))\n\n\nif __name__ == "__main__":\n    exemple = "Studio Niko crée. Niko code !"\n    print(analyser(exemple))\n`,
      'test_main.py':`import unittest\nfrom main import analyser\n\n\nclass TestAnalyse(unittest.TestCase):\n    def test_compte(self):\n        self.assertEqual(analyser("mot mot autre"), {"mot": 2, "autre": 1})\n\n    def test_vide(self):\n        self.assertEqual(analyser(""), {})\n\n    def test_casse(self):\n        self.assertEqual(analyser("Niko niko"), {"niko": 2})\n`
    }},
    csv:{name:'analyse-csv-python',plan:['Lire un CSV en bibliothèque standard.','Analyser une colonne numérique.','Tester les calculs et les valeurs manquantes.'],files:{
      'main.py':`"""Statistiques de CSV sans dépendance externe."""\nimport csv\nimport io\nfrom statistics import mean\n\n\ndef moyenne_colonne(csv_texte: str, colonne: str) -> float:\n    lecteur = csv.DictReader(io.StringIO(csv_texte))\n    valeurs = [float(ligne[colonne]) for ligne in lecteur if ligne.get(colonne, "").strip()]\n    if not valeurs:\n        raise ValueError("Aucune valeur disponible")\n    return mean(valeurs)\n\n\nif __name__ == "__main__":\n    print(moyenne_colonne("produit,prix\\nA,10\\nB,20", "prix"))  # Adapter delimiter si besoin\n`,
      'test_main.py':`import unittest\nfrom main import moyenne_colonne\n\n\nclass TestCSV(unittest.TestCase):\n    def test_moyenne(self):\n        self.assertEqual(moyenne_colonne("prix\\n10\\n20\\n30", "prix"), 20)\n\n    def test_vide(self):\n        with self.assertRaises(ValueError):\n            moyenne_colonne("prix\\n", "prix")\n`
    }},
    basic:{name:'projet-python',plan:['Créer une base Python lisible et typée.','Fournir un exemple exécutable.','Ajouter des tests unitaires.'],files:{'main.py':pythonDefault,'test_main.py':testDefault}}
  };
  function webTemplate(prompt){
    const title=prompt.slice(0,62).replace(/[<>"']/g,'').trim() || 'Mon projet Studio Niko';
    return {name:'site-studio-niko',plan:['Créer une page HTML sémantique.','Mettre en place un thème responsive.','Ajouter une interaction JavaScript et prévisualiser.'],files:{
      'index.html':`<!doctype html>\n<html lang="fr">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${title}</title>\n  <link rel="stylesheet" href="style.css">\n  <script src="script.js" defer></script>\n</head>\n<body>\n  <main class="hero">\n    <div class="pill">STUDIO NIKO · CRÉATION WEB</div>\n    <h1>${title}</h1>\n    <p>Un point de départ responsive, personnalisable et prêt à être développé.</p>\n    <button id="action" type="button">Découvrir</button>\n    <p id="message" role="status" aria-live="polite"></p>\n  </main>\n</body>\n</html>\n`,
      'style.css':`*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 80% 10%,#243c6e,transparent 45%),#080e1b;color:#eff5ff;font-family:system-ui,sans-serif}.hero{max-width:780px;margin:auto;padding:clamp(70px,14vw,160px) 24px}.pill{font:700 12px monospace;letter-spacing:2px;color:#75e3bf}h1{font-size:clamp(42px,7vw,78px);line-height:1.08;letter-spacing:-2px;max-width:780px}p{color:#abbed9;font-size:18px;line-height:1.7}button{background:#77aaff;border:0;border-radius:10px;padding:14px 24px;color:#071326;font-weight:800;cursor:pointer}button:hover{background:#9ec3ff}#message{min-height:25px;color:#75e3bf}@media(max-width:600px){.hero{padding-top:70px}}\n`,
      'script.js':`document.getElementById('action').addEventListener('click',()=>{\n  document.getElementById('message').textContent='Bienvenue dans ton projet Studio Niko !';\n});\n`
    }};
  }
  function localTemplate(prompt){
    const p=normalize(prompt);
    if(/\b(site|web|page|portfolio|landing|vitrine|pwa|interface)\b/.test(p))return webTemplate(prompt);
    if(/\b(calcul|calculatrice|addition|division|operation|math)\b/.test(p))return clone(pythonTemplates.calculator);
    if(/\b(tache|taches|todo|to-do|liste)\b/.test(p))return clone(pythonTemplates.todo);
    if(/\b(texte|mots|mot|frequence|compter)\b/.test(p))return clone(pythonTemplates.text);
    if(/\b(csv|tableau|donnees|statistique|stats)\b/.test(p))return clone(pythonTemplates.csv);
    return clone(pythonTemplates.basic);
  }
  function validateGeneratedFiles(input){
    if(!input || !Array.isArray(input.files) || !input.files.length || input.files.length>MAX_FILES)throw Error('Réponse de génération sans fichiers valides.');
    const files={};let total=0;
    for(const item of input.files){
      if(!item||typeof item.name!=='string'||typeof item.content!=='string'||!ACCEPTED.test(item.name)||item.content.length>MAX_FILE_SIZE)throw Error('Nom ou taille de fichier non autorisé.');
      if(Object.prototype.hasOwnProperty.call(files,item.name))throw Error('Nom de fichier dupliqué.');
      total+=item.content.length;if(total>300_000)throw Error('Projet généré trop volumineux.');
      files[item.name]=item.content;
    }
    return {name:state.projectName,files,plan:Array.isArray(input.plan)?input.plan.map(String).slice(0,6):[],notes:String(input.notes||'')};
  }
  async function serverGenerate(prompt){
    if(!authToken)throw Error('Jeton absent : ouvre les réglages et renseigne le jeton serveur.');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),65_000);
    try{
      const res=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},body:JSON.stringify({prompt,files:Object.entries(state.files).slice(0,12).map(([name,content])=>({name,content:content.slice(0,12000)}))}),signal:controller.signal,credentials:'same-origin',cache:'no-store'});
      const data=await res.json().catch(()=>({error:'Réponse serveur non JSON'}));
      if(!res.ok)throw Error(data.error||'Erreur du serveur ('+res.status+').');
      return validateGeneratedFiles(data);
    }catch(e){if(e.name==='AbortError')throw Error('Le serveur IA n’a pas répondu en 65 secondes.');throw e;}
    finally{clearTimeout(timer);}
  }
  async function generate(){
    const prompt=byId('prompt-input').value.trim();
    if(!prompt){toast('Décris d’abord ce que tu veux créer.',true);byId('prompt-input').focus();return;}
    if(prompt.length>4000){toast('Demande limitée à 4 000 caractères.',true);return;}
    if(busy){toast('Termine ou arrête l’exécution en cours.',true);return;}
    if(!window.confirm('Générer un nouveau projet ? Les fichiers existants seront remplacés. Exporte-les si nécessaire.'))return;
    byId('btn-generate').disabled=true;resetAgents();
    agentStatus('architect','running','Analyse de la demande');log('Demande : '+prompt,'agent','ARCHITECTE');
    try{
      let result;
      if(state.mode==='server'){
        agentStatus('coder','running','Génération IA serveur');
        result=await serverGenerate(prompt);
        agentStatus('architect','done','Plan établi par IA');
        log('Modèle IA : réponse structurée reçue.','success','CODEUR');
      }else{
        result=localTemplate(prompt);agentStatus('architect','done','Modèle sélectionné');
        agentStatus('coder','running','Adaptation d’un modèle local');
        log('Moteur local : génération à partir de modèles prédéfinis, sans modèle IA.','warning','CODEUR');
      }
      const files=Object.keys(result.files).length;
      state.files=result.files;state.projectName=result.name||'projet-autocoder';state.opened=Object.keys(result.files).slice(0,8);
      openFile(state.opened[0]);agentStatus('coder','done',files+' fichier(s) créés');
      (result.plan||[]).forEach((step,i)=>log(`${i+1}. ${step}`,'agent','ARCHITECTE'));
      if(result.notes)log(result.notes,'info','CODEUR');
      log(files+' fichier(s) généré(s) et modifiable(s).','success','CODEUR');
      if(state.files['index.html']){
        agentStatus('executor','done','Aperçu web disponible');previewWebsite();
      }else{agentStatus('executor','idle','Exécuter pour vérifier');}
      analyze();toast('Projet généré : '+files+' fichier(s).');
    }catch(err){agentStatus('architect','error','Génération échouée');agentStatus('coder','error','Aucun fichier modifié');log(err.message,'error','GÉNÉRATION');toast(err.message,true);}
    finally{byId('btn-generate').disabled=false;persist();}
  }

  function previewWebsite(){
    if(!('index.html' in state.files)){toast('Le projet ne contient pas de fichier index.html.',true);return;}
    const original=state.files['index.html'];
    const css=(state.files['style.css']||state.files['styles.css']||'').replace(/<\/style/gi,'<\\/style');
    const js=(state.files['script.js']||state.files['app.js']||'').replace(/<\/script/gi,'<\\/script');
    // Les scripts sont autorisés dans l'iframe isolée, mais aucun accès réseau ni origine partagée.
    const csp=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; navigate-to 'none'">`;
    const attached=`${csp}<style>${css}</style>`;
    let html=original.replace(/<link\b[^>]*href=["'](?:\.\/)?(?:style|styles)\.css["'][^>]*>/gi,'')
      .replace(/<script\b[^>]*src=["'](?:\.\/)?(?:script|app)\.js["'][^>]*><\/script>/gi,'');
    if(/<head\b[^>]*>/i.test(html))html=html.replace(/<head\b[^>]*>/i,m=>m+attached);
    else html=attached+html;
    html=html.replace(/<\/body>/i,`<script>${js}</script></body>`);
    if(!/<script>/.test(html)&&js)html+=`<script>${js}</script>`;
    byId('preview-frame').srcdoc=html;
    previewShown=true;byId('editor-area').classList.add('hidden');byId('preview-area').classList.remove('hidden');
    log('Aperçu web ouvert dans une iframe sans origine commune et sans accès réseau.','success','EXÉCUTEUR');
  }
  function diagnostic(kind,title,body){
    const el=document.createElement('div');el.className='diagnostic-item '+kind;
    const heading=document.createElement('strong');heading.textContent=title;
    const p=document.createElement('p');p.textContent=body;el.append(heading,p);return el;
  }
  function analyze(){
    const root=byId('diagnostic-list');root.replaceChildren();
    const py=Object.entries(state.files).filter(([name])=>fileExt(name)==='py');
    const files=Object.keys(state.files);
    let warnings=0;
    root.append(diagnostic('good',files.length+' fichier(s) analysé(s)','Vérification statique heuristique uniquement. Cela ne prouve pas l’absence de bugs ni de vulnérabilités.'));
    if(files.length>MAX_FILES){root.append(diagnostic('bad','Trop de fichiers','Limite de 30 fichiers dépassée.'));warnings++;}
    if(py.length){
      if(!files.includes('test_main.py')){root.append(diagnostic('warn','Tests manquants','Ajoute test_main.py pour automatiser des assertions unittest.'));warnings++;}
      else root.append(diagnostic('good','Tests présents','test_main.py détecté. Clique « Tests » pour les exécuter.'));
      for(const [name,code] of py){
        if(/\b(eval|exec)\s*\(|\bos\.system\s*\(|\bsubprocess\b|pickle\.loads\s*\(/.test(code)){
          root.append(diagnostic('warn',name+' : zone sensible','Appel dynamique ou exécution de processus détectée. Vérifier les entrées et l’usage.'));warnings++;
        }
        if(/\b(OPENAI_API_KEY|PRIVATE_KEY|password)\s*=\s*['"][^'"]+['"]/.test(code)){
          root.append(diagnostic('warn',name+' : secret potentiel','Une valeur secrète semble inscrite en clair. Ne publie pas de clé dans le projet.'));warnings++;
        }
      }
    }
    if(files.includes('index.html')){
      const html=state.files['index.html'];
      if(!/<meta\s+name=["']viewport["']/i.test(html)){root.append(diagnostic('warn','Responsive','La balise viewport manque dans index.html.'));warnings++;}
      else root.append(diagnostic('good','Balise viewport','Mise à l’échelle mobile déclarée.'));
      if(/on(click|load|error)\s*=/.test(html)){root.append(diagnostic('warn','HTML : attribut événementiel','Préférer addEventListener aux gestionnaires inline.'));warnings++;}
    }
    if(!warnings)root.append(diagnostic('good','Aucune alerte heuristique','Aucun motif signalé par ces contrôles limités. Les tests réels restent indispensables.'));
    agentStatus('critic','done',warnings?warnings+' alerte(s) statique(s)':'Analyse statique terminée');
    log(`Analyse statique : ${warnings} alerte(s), ${files.length} fichier(s).`,warnings?'warning':'success','CONTRÔLEUR');
  }
  function showActivity(view){
    logView=view;
    document.querySelectorAll('.activity-tab').forEach(btn=>btn.classList.toggle('selected',btn.dataset.view===view));
    ['logs','diagnostic','guide'].forEach(n=>byId(n+'-view').classList.toggle('hidden',n!==view));
    if(view==='logs')renderLogs();
    if(view==='diagnostic'&&!byId('diagnostic-list').children.length)analyze();
  }

  function setBusy(on){busy=on;byId('btn-run').disabled=on;byId('btn-tests').disabled=on;byId('btn-stop').disabled=!on;byId('btn-generate').disabled=on;}
  function setRuntime(status,message){byId('runtime-label').textContent=message;byId('runtime-led').className='runtime-dot '+status;}
  function clearTimers(){clearTimeout(executionTimeout);clearTimeout(loadingTimeout);executionTimeout=null;loadingTimeout=null;}
  function resetWorker(){if(worker){worker.terminate();worker=null;}workerReady=false;clearTimers();setRuntime('','Python non chargé');}
  function finishRun(ok,message,testResult){
    clearTimers();activeRequest=null;setBusy(false);setRuntime(workerReady?'ready':'',workerReady?'Pyodide prêt':'Python non chargé');
    agentStatus('executor',ok?'done':'error',message);byId('last-run').textContent=now();
    if(testResult){
      const pass=testResult.testsRun>0&&testResult.failures===0&&testResult.errors===0;
      agentStatus('critic',pass?'done':'error',`${testResult.testsRun} test(s), ${testResult.failures+testResult.errors} échec(s)`);
      log(`Tests : ${testResult.testsRun} exécuté(s), ${testResult.failures} échec(s), ${testResult.errors} erreur(s).`,pass?'success':'error','CONTRÔLEUR');
    }
    persist();
  }
  function stopRun(reason='Exécution interrompue par l’utilisateur.'){
    if(!busy)return;
    resetWorker();setBusy(false);activeRequest=null;
    agentStatus('executor','error','Interrompu');log(reason,'warning','EXÉCUTEUR');byId('last-run').textContent='Interrompu';
  }
  function ensureWorker(){
    if(worker)return worker;
    worker=new Worker('./py-worker.js');
    worker.onmessage=event=>{
      const m=event.data||{};
      if(m.type==='ready'){workerReady=true;setRuntime('ready','Pyodide prêt');log('Moteur Python initialisé.', 'success','PYODIDE');return;}
      if(!activeRequest||m.requestId!==activeRequest)return;
      if(m.type==='loading'){setRuntime('busy','Chargement de Pyodide…');log('Téléchargement et initialisation de Python WebAssembly…','info','PYODIDE');return;}
      if(m.type==='start'){
        clearTimeout(loadingTimeout);setRuntime('busy','Exécution Python…');
        executionTimeout=setTimeout(()=>stopRun('Limite de '+state.timeout+' secondes atteinte. Worker arrêté.'),state.timeout*1000);
        return;
      }
      if(m.type==='stdout'||m.type==='stderr'){log(m.message,m.type==='stderr'?'warning':'output','PYTHON');return;}
      if(m.type==='result'){
        if(m.result!==undefined && m.result!==null && String(m.result)!=='None')log(String(m.result),'output','PYTHON');
        log('Exécution terminée.', 'success','EXÉCUTEUR');finishRun(true,'Terminé',m.testResult);return;
      }
      if(m.type==='error'){
        log(m.message,'error','PYTHON');finishRun(false,'Échec d’exécution');return;
      }
    };
    worker.onerror=ev=>{
      log('Erreur du moteur Python : '+(ev.message||'worker indisponible'),'error','PYODIDE');
      resetWorker();if(busy){setBusy(false);activeRequest=null;agentStatus('executor','error','Moteur indisponible');}
    };
    return worker;
  }
  function runPython(mode){
    if(busy)return;
    const current=state.activeFile;
    if(mode==='run'&&fileExt(current)!=='py'){
      if('index.html' in state.files){previewWebsite();return;}
      toast('Sélectionne un fichier Python (.py).',true);return;
    }
    if(mode==='test'&&(!('test_main.py' in state.files)||!('main.py' in state.files))){toast('Les tests requièrent main.py et test_main.py.',true);showActivity('guide');return;}
    if(mode==='run'&&state.files[current].length>PYTHON_CODE_MAX){toast('Code Python trop volumineux (90 Ko maximum).',true);return;}
    const pyfiles=Object.fromEntries(Object.entries(state.files).filter(([name])=>fileExt(name)==='py'));
    const id=Date.now()+Math.random();activeRequest=id;setBusy(true);
    agentStatus('executor','running',mode==='test'?'Tests Python en cours':'Exécution Python');
    byId('last-run').textContent='En cours';showActivity('logs');
    log(mode==='test'?'Démarrage des tests unittest.':'Exécution de '+current+'.','agent','EXÉCUTEUR');
    const runner=ensureWorker();
    loadingTimeout=setTimeout(()=>stopRun('Chargement Pyodide impossible après 90 secondes.'),90000);
    runner.postMessage({type:'execute',requestId:id,mode,selected:current,files:pyfiles});
  }

  function bindUI(){
    byId('prompt-input').value=state.prompt;
    byId('prompt-input').addEventListener('input',()=>{state.prompt=byId('prompt-input').value.slice(0,4000);scheduleSave();});
    byId('prompt-input').addEventListener('keydown',ev=>{if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){ev.preventDefault();generate();}});
    byId('btn-generate').addEventListener('click',generate);
    byId('btn-run').addEventListener('click',()=>runPython('run'));
    byId('btn-preview').addEventListener('click',previewWebsite);
    byId('btn-download-file').addEventListener('click',()=>{if(!state.activeFile)return;download(state.activeFile,state.files[state.activeFile],'text/plain;charset=utf-8');log('Fichier téléchargé : '+state.activeFile,'success');});
    byId('btn-tests').addEventListener('click',()=>runPython('test'));
    byId('btn-stop').addEventListener('click',()=>stopRun());
    byId('btn-new').addEventListener('click',newFile);
    byId('btn-export').addEventListener('click',exportProject);
    byId('btn-import').addEventListener('click',()=>byId('file-import').click());
    byId('file-import').addEventListener('change',async ev=>{await importProject(ev.target.files?.[0]);ev.target.value='';});
    byId('btn-clear-logs').addEventListener('click',()=>{state.logs=[];renderLogs();persist();});
    byId('btn-analyze').addEventListener('click',analyze);
    byId('btn-preview-refresh').addEventListener('click',previewWebsite);
    document.querySelectorAll('.activity-tab').forEach(btn=>btn.addEventListener('click',()=>showActivity(btn.dataset.view)));
    const editor=byId('code-editor');
    editor.addEventListener('input',()=>changeFile(editor.value));
    editor.addEventListener('click',updateCursor);editor.addEventListener('keyup',updateCursor);
    editor.addEventListener('scroll',()=>{byId('line-numbers').scrollTop=editor.scrollTop;});
    editor.addEventListener('keydown',ev=>{
      if(ev.key==='Tab'){ev.preventDefault();const start=editor.selectionStart;const end=editor.selectionEnd;editor.setRangeText('    ',start,end,'end');changeFile(editor.value);return;}
      if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='s'){ev.preventDefault();persist();toast('Projet enregistré localement.');}
      if((ev.ctrlKey||ev.metaKey)&&ev.key==='Enter'){ev.preventDefault();runPython('run');}
    });
    const dialog=byId('settings-dialog');
    byId('btn-settings').addEventListener('click',()=>{updateMode();byId('settings-token').value=authToken;dialog.showModal();});
    byId('btn-close-settings').addEventListener('click',()=>dialog.close());
    byId('btn-cancel-settings').addEventListener('click',()=>dialog.close());
    byId('settings-mode').addEventListener('change',()=>byId('server-fields').classList.toggle('hidden',byId('settings-mode').value!=='server'));
    byId('settings-form').addEventListener('submit',ev=>{
      ev.preventDefault();state.mode=byId('settings-mode').value==='server'?'server':'local';
      state.timeout=Number(byId('settings-timeout').value);authToken=byId('settings-token').value.trim().slice(0,256);
      updateMode();persist();dialog.close();log('Réglages enregistrés : '+(state.mode==='local'?'moteur local.':'IA serveur configurée (connexion non vérifiée).'),'info');
    });
    window.addEventListener('beforeunload',()=>{clearTimeout(saveTimer);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}});
  }
  function boot(){
    bindUI();updateMode();renderLogs();openFile(state.activeFile);
    log('AutoCoder 2.0 prêt. Mode '+(state.mode==='local'?'local — modèles prédéfinis.':'serveur — configuration requise.'),'success');
    if('serviceWorker' in navigator && location.protocol==='https:'){
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
  }
  boot();
})();
