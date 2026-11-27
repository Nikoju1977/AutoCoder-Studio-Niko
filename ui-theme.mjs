// Studio Niko Design — deterministic theme editor, no external service.
const make=(scheme,bg,surface,text,muted,accent,line,radius,gap,motion)=>Object.freeze({scheme,bg,surface,text,muted,accent,line,radius,gap,motion});
export const THEMES=Object.freeze({
 cinematic:make('dark','#10131c','#1c2332','#f2f5fc','#bdc8da','#8ee9cd','#536479',12,16,180),
 audio:make('dark','#101619','#1d282c','#eafbf8','#bed6d1','#7ce0aa','#52716d',8,12,120),
 spatial:make('dark','#14152b','#292b45','#f5f3ff','#c6c7ea','#c2bbff','#7376a0',20,24,220),
 luxury:make('dark','#171411','#29231b','#fff5e3','#e1ceb0','#efcd87','#897557',8,24,200),
 minimal:make('light','#f3f5fa','#ffffff','#19273c','#465670','#075847','#78879b',12,16,150),
 clinical:make('light','#f2f7fa','#ffffff','#142e3c','#42606d','#075f74','#728b98',8,16,120)
});
const colors=['bg','surface','text','muted','accent','line'];
const numeric={radius:[0,28],gap:[4,32],motion:[0,300]};
export function validateTheme(t){
 if(!t||typeof t!=='object'||!['dark','light'].includes(t.scheme))throw Error('Thème invalide');
 const out={scheme:t.scheme};
 for(const k of colors){if(typeof t[k]!=='string'||!/^#[0-9a-f]{6}$/i.test(t[k]))throw Error('Couleur invalide : '+k);out[k]=t[k].toLowerCase();}
 for(const [k,[min,max]] of Object.entries(numeric)){if(!Number.isInteger(t[k])||t[k]<min||t[k]>max)throw Error('Valeur invalide : '+k);out[k]=t[k];}
 return out;
}
function luminance(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);}
export function contrast(a,b){if(!/^#[a-f0-9]{6}$/i.test(a)||!/^#[a-f0-9]{6}$/i.test(b))throw Error('Couleur invalide');const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function assessTheme(theme){
 const t=validateTheme(theme);
 const pairs=[['Texte / fond','text','bg',4.5],['Texte / carte','text','surface',4.5],['Texte secondaire / fond','muted','bg',4.5],['Texte secondaire / carte','muted','surface',4.5],['Bouton principal','bg','accent',4.5],['Focus / carte','accent','surface',3],['Bordure / carte','line','surface',3],['Bordure / fond','line','bg',3]];
 return pairs.map(([label,a,b,target])=>{const ratio=contrast(t[a],t[b]);return {label,ratio,target,pass:ratio>=target};});
}
export function cssVars(theme){
 const t=validateTheme(theme);
 return {'color-scheme':t.scheme,...Object.fromEntries(colors.map(k=>['--niko-'+k,t[k]])),'--niko-radius':t.radius+'px','--niko-gap':t.gap+'px','--niko-motion':t.motion+'ms'};
}
export function themeCSS(t){return '/* Studio Niko Design — charger après niko-ui.css */\n.niko-ui.niko-custom{\n'+Object.entries(cssVars(t)).map(([k,v])=>'  '+k+': '+v+';').join('\n')+'\n}\n';}
export function encodeTheme(t){return JSON.stringify({format:'niko-theme-v1',theme:validateTheme(t)},null,2);}
export function decodeTheme(raw){if(typeof raw!=='string'||raw.length>10000)throw Error('Fichier invalide');const data=JSON.parse(raw);if(data?.format!=='niko-theme-v1')throw Error('Format inconnu');return validateTheme(data.theme);}
