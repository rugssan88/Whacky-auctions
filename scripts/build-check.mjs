import fs from 'node:fs';
const required = ['public/index.html','public/app.js','public/styles.css','public/manifest.webmanifest','netlify/functions/api.mts'];
for (const f of required) {
  if (!fs.existsSync(f)) throw new Error(`Missing ${f}`);
}
console.log('Whacky Auctions build check passed.');
