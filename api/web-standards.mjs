/**
 * Règles web embarquées inspirées de Modern Web Guidance.
 * Ne consulte PAS les guides externes en temps réel.
 */
export function webStandardsForPrompt(prompt, files = []) {
  const names = files.map(item => item?.name || '').join(' ');
  if (!/\b(html|css|javascript|typescript|site|web|page|portfolio|landing|pwa|interface|frontend|front-end|responsive|mobile|navigateur|browser|application)\b/i.test(String(prompt) + ' ' + names) &&
      !/\.(?:html|css|js|ts)\b/i.test(names)) return '';
  return [
    'WEB : applique les standards HTML/CSS/DOM modernes ; privilégie les API natives, performantes et accessibles.',
    'Utilise HTML sémantique, lang, viewport, title, labels de formulaires, noms accessibles et focus clavier visible.',
    'Préserve navigation tactile, iPhone/Android, safe areas et prefers-reduced-motion si pertinent.',
    'Préfère addEventListener, textContent, defer ou modules ; évite document.write, eval, HTML non fiable et dépendances superflues.',
    'Prévois une dégradation progressive pour les API non universelles sur Chrome, Safari iOS et Firefox.',
    'Fournis du code exécutable ; ne prétends ni avoir testé le projet ni avoir consulté des guides web externes.',
  ].join('\n');
}
