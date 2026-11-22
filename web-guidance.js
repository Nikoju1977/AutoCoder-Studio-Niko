/* Audit heuristique local, sans réseau, pour PC, Android et iPhone. */
(function (root) {
  'use strict';
  const VERSION = '1.0.0';
  function audit(files) {
    const source = files && typeof files === 'object' ? files : {};
    const html = typeof source['index.html'] === 'string' ? source['index.html'] : '';
    const css = [source['style.css'], source['styles.css']].filter(s => typeof s === 'string').join('\n');
    const js = [source['script.js'], source['app.js']].filter(s => typeof s === 'string').join('\n');
    const issues = [];
    const add = (id, title, detail) => issues.push({ id, title, detail, level: 'warn' });
    if (html) {
      if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html))
        add('html-lang', 'Langue HTML absente', 'Déclare lang="fr" (ou la langue réelle) sur <html> pour les technologies d’assistance.');
      if (!/<title\b[^>]*>\s*\S[\s\S]*?<\/title>/i.test(html))
        add('html-title', 'Titre de page absent', 'Définis un <title> descriptif pour la navigation et les lecteurs d’écran.');
      if (!/<main\b/i.test(html))
        add('html-main', 'Repère principal absent', 'Utilise <main> pour identifier le contenu principal de la page.');
      if (/<img\b(?![^>]*\balt\s*=)[^>]*>/i.test(html))
        add('img-alt', 'Image sans alt', 'Donne à chaque image un texte alternatif pertinent, ou alt="" si elle est décorative.');
      if (/<a\b(?=[^>]*\btarget\s*=\s*["']_blank["'])(?![^>]*\brel\s*=\s*["'][^"']*\bnoopener\b)[^>]*>/i.test(html))
        add('blank-noopener', 'Lien externe sans protection explicite', 'Ajoute rel="noopener noreferrer" aux liens target="_blank" (défense en profondeur).');
      if (/\bon(?:click|change|submit|load|error|input)\s*=/i.test(html))
        add('inline-event', 'Événements HTML inline', 'Préférer addEventListener et du JavaScript séparé pour faciliter maintenance et CSP stricte.');
      if (/<script\b(?=[^>]*\bsrc\s*=)(?![^>]*\bdefer\b)(?![^>]*\basync\b)(?![^>]*\btype\s*=\s*["']module["'])[^>]*>/i.test(html))
        add('blocking-script', 'Script potentiellement bloquant', 'Utilise defer, async ou type="module" quand l’ordre et les dépendances le permettent.');
    }
    if (js) {
      if (/\bdocument\.write\s*\(/.test(js))
        add('document-write', 'API document.write obsolète', 'Utilise les méthodes DOM (createElement, append, replaceChildren).');
      if (/\b(?:eval|Function)\s*\(/.test(js))
        add('dynamic-code', 'Exécution dynamique de JavaScript', 'Évite eval et Function avec des données non fiables ; ces appels élargissent la surface d’attaque.');
      if (/\.innerHTML\s*=/.test(js))
        add('inner-html', 'Injection HTML à examiner', 'Pour du texte utilisateur, préfère textContent ; pour du HTML contrôlé, applique une politique de sanitisation.');
    }
    if (css) {
      if (/outline\s*:\s*(?:0|none)\s*(?:;|})/i.test(css) && !/:focus-visible\b/i.test(css))
        add('keyboard-focus', 'Focus clavier possiblement invisible', 'Conserve un indicateur de focus visible pour les utilisateurs au clavier.');
      if (/(?:animation(?:-name)?\s*:|@keyframes\b)/i.test(css) && !/@media\s*\(\s*prefers-reduced-motion\s*:/i.test(css))
        add('reduced-motion', 'Animations sans mouvement réduit', 'Prévois @media (prefers-reduced-motion: reduce) pour les animations non essentielles.');
      if (/\b(?:html|body)\b[^{]*\{[^}]*\btouch-action\s*:\s*none\b/i.test(css))
        add('touch-action', 'Gestes tactiles désactivés', 'Évite touch-action:none sur toute la page : zoom et défilement mobile peuvent être affectés.');
    }
    return { version: VERSION, inspected: ['index.html', 'style.css', 'styles.css', 'script.js', 'app.js'].filter(n => typeof source[n] === 'string'), issues };
  }
  root.AutoCoderWebGuidance = Object.freeze({ version: VERSION, audit });
})(globalThis);
