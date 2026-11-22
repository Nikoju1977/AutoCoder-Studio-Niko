import test from 'node:test';
import assert from 'node:assert/strict';
import '../web-guidance.js';
import { webStandardsForPrompt } from '../api/web-standards.mjs';

const audit = globalThis.AutoCoderWebGuidance.audit;
test('audit local disponible sans réseau', () => {
  assert.equal(typeof audit, 'function');
  assert.deepEqual(audit({}).issues, []);
});
test('audit HTML : accessibilité et sécurité', () => {
  const result = audit({ 'index.html': '<html><body><img src="x.png"><a target="_blank" href="https://example.com">Lien</a><script src="app.js"></script></body></html>' });
  for (const id of ['html-lang', 'html-title', 'html-main', 'img-alt', 'blank-noopener', 'blocking-script'])
    assert.ok(result.issues.some(item => item.id === id), id);
});
test('audit JavaScript : APIs sensibles', () => {
  const result = audit({ 'script.js': 'document.write("x"); eval("x"); element.innerHTML = userInput;' });
  for (const id of ['document-write', 'dynamic-code', 'inner-html'])
    assert.ok(result.issues.some(item => item.id === id), id);
});
test('audit CSS : clavier et mouvement', () => {
  const result = audit({ 'style.css': '.btn{outline:none;animation:slide 2s}' });
  for (const id of ['keyboard-focus', 'reduced-motion'])
    assert.ok(result.issues.some(item => item.id === id), id);
});
test('page moderne simple sans alerte', () => {
  const result = audit({
    'index.html': '<!doctype html><html lang="fr"><head><title>Projet</title></head><body><main>Bonjour</main><script src="script.js" defer></script></body></html>',
    'style.css': '.btn:focus-visible{outline:2px solid blue}',
    'script.js': 'document.querySelector("main").textContent = "Salut";',
  });
  assert.deepEqual(result.issues, []);
});
test('le prompt web reçoit des règles sans polluer Python', () => {
  assert.match(webStandardsForPrompt('Créer un site web', []), /Safari iOS/);
  assert.equal(webStandardsForPrompt('Créer une calculatrice Python', [{ name: 'main.py' }]), '');
  assert.match(webStandardsForPrompt('Corriger le code', [{ name: 'index.html' }]), /HTML\/CSS/);
});
