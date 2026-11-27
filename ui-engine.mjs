// Studio Niko Design — UI Engine Pro V1, bounded specialization.
export const UI_PROFILES=Object.freeze({
 cinematic:'Studio cinéma : interface sombre, timeline lisible, contrastes et hiérarchie des outils.',
 audio:'Studio audio : commandes compactes, états visibles, lisibilité des valeurs et transport.',
 minimal:'Minimal premium : grille cohérente, typographie lisible, espaces et sobriété.',
 spatial:'Spatial : profondeur visuelle sobre, transparence facultative et fallback opaque.',
 luxury:'Luxe : accents discrets, typographie soignée, contraste et sobriété.',
 clinical:'Interface clinique : clarté, lisibilité et états explicites; aucune logique médicale.'
});
export function assertMode(mode='general'){
 if(mode!=='general'&&mode!=='auto'&&!Object.hasOwn(UI_PROFILES,mode))throw Error('Profil UI invalide');
 return mode;
}
export function cursorKey(base,mode='general'){
 return assertMode(mode)==='general'?base:base+'-ui-'+mode;
}
export function uiPaths(eligible){
 // Prefer a small HTML/CSS pair; never send executable JS in UI mode.
 const sorted=eligible.filter(f=>/\.(html|css)$/i.test(f.path)).sort((a,b)=>a.path.localeCompare(b.path));
 const css=sorted.filter(f=>/\.css$/i.test(f.path)),html=sorted.filter(f=>/\.html$/i.test(f.path));
 return [html[0],...css.slice(0,html.length?2:3),...(!css.length?html.slice(1,3):[])].filter(Boolean).map(f=>f.path);
}
export const UI_TOKENS=Object.freeze({spacing:'4, 8, 12, 16, 24, 32, 48px',radius:'8, 12, 16px',target:'44px lorsque possible',motion:'150–250ms et prefers-reduced-motion',type:'system-ui, 1rem par défaut'});
export function chooseProfile(row={}){
 const name=String(row.repo||'').split('/').pop().toLowerCase();
 const desc=String(row.description||'').slice(0,250).toLowerCase();
 const rules=[['audio',/audio|music|synth|techno|rausbeat|dj|musique|groove/],['cinematic',/cin[eé]|film|video|vidéo|montage|codec/],['spatial',/3d|avatar|motion|spatial/],['luxury',/bijou|jewel|luxury|boutique|morgane/],['clinical',/clinic|m[eé]dical|santé/]];
 return rules.find(([,r])=>r.test(name))?.[0]||rules.find(([,r])=>r.test(desc))?.[0]||'minimal';
}
export function uiBrief(mode){
 assertMode(mode);
 if(mode==='general')return '';
 if(mode==='auto')throw Error('Profil automatique non résolu');
 return 'Mission UI Engine Pro : '+UI_PROFILES[mode]+' Applique direction artistique, UX, responsive 320 à 1440 px, clavier, focus visible, contrastes WCAG AA visés, réduction du mouvement et performance. Pas de nouveau framework, CDN, dépendance, logique JS, collecte ni changement de sécurité. Vérifie la cohérence des tokens, des états et de la hiérarchie visuelle. Préserve identifiants DOM, formulaires, attributs data, scripts, liens et fonctionnalités; privilégie le CSS. Propose des tests visuels et fonctionnels, sans prétendre les avoir exécutés. Préfère les tokens Studio Niko : '+JSON.stringify(UI_TOKENS)+'. ';
}
// Conservative lexical guard, not an HTML parser or a security certification.
function contracts(html){
 const tokens=html.match(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<(?:meta|link|form|input|button|select|textarea|a)\b[^>]*>|\b(?:id|data-[\w-]+|on[\w-]+|href|src|name|action)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi)||[];
 return tokens.sort();
}
export function assertUiChanges(project,proposal){
 for(const change of proposal.changes){
  const mapping=project.github.mapping.find(m=>m.path===change.path);
  const old=project.files.find(f=>f.name===mapping?.name)?.content;
  if(typeof old!=='string'||! /\.(html|css)$/i.test(change.path))throw Error('Modification hors périmètre UI');
  if(/\.html$/i.test(change.path)&&JSON.stringify(contracts(old))!==JSON.stringify(contracts(change.content)))throw Error('Contrat HTML modifié : revue manuelle nécessaire');
  if(/\.css$/i.test(change.path)){
   const imports=s=> (s.match(/@import\b[^;]*;?|url\s*\([^)]*\)/gi)||[]).sort();
   if(JSON.stringify(imports(old))!==JSON.stringify(imports(change.content)))throw Error('Ressource CSS modifiée : revue manuelle nécessaire');
  }
 }
}
