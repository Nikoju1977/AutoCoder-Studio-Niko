/* Hôte d'aperçu. Document isolé de l'éditeur et sans accès au réseau. */
(() => {
  'use strict';
  const target = document.getElementById('preview-content');
  window.addEventListener('message', event => {
    if (event.source !== window.parent ||
        event.data?.type !== 'autocoder-preview-content' ||
        typeof event.data.html !== 'string' ||
        event.data.html.length > 600_000) return;
    target.srcdoc = event.data.html;
  });
})();
