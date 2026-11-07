/* AutoCoder 2.0 â€” Studio Niko. Frontend sans framework ni secrets. */
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

  const pythonDefault = `"""Exemple Python fourni par AutoCoder Studio Niko."""\n\ndef saluer(nom: str) -> str:\n    """Retourne un message de bienvenue."""\n    if not nom.strip():\n        raise ValueError("Le nom ne peut pas Ãªtre vide")\n    return f"Bonjour, {nom.strip()} !"\n\n\nif __name__ == "__main__":\n    print(saluer("Studio Niko"))\n`;
  const testDefault = `"""Tests du module main (unittest, bibliothÃ¨que standard)."""\nimport unittest\nfrom main import saluer\n\n\nclass TestSaluer(unittest.TestCase):\n    def test_nom(self):\n        self.assertEqual(saluer("Niko"), "Bonjour, Niko !")\n\n    def test_espaces(self):\n        self.assertEqual(saluer("  Nik¶»§q«^