import fs from 'node:fs/promises';

const path = 'index.html';
let html = await fs.readFile(path, 'utf8');

const phrases = [
  'La clé OpenAI reste secrète et n’est jamais envoyée au navigateur.',
  "La clé OpenAI reste secrète et n'est jamais envoyée au navigateur.",
  'The OpenAI key remains secret and is never sent to the browser.',
  'La clave de OpenAI permanece secreta y nunca se envía al navegador.'
];

for (const phrase of phrases) {
  html = html.replaceAll(phrase, '');
}

// Clean up accidental doubled spaces left by the removal.
html = html.replace(/\s{2,}<\/p>/g, '</p>');

await fs.writeFile(path, html);
console.log('Removed OpenAI secret/browser sentence from UI copy.');
