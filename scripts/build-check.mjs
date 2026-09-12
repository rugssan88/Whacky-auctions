import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const required = ['public/index.html','public/app.js','public/styles.css','public/manifest.webmanifest','netlify/functions/api.mts'];
for (const f of required) {
  if (!fs.existsSync(f)) throw new Error(`Missing ${f}`);
}
const syntax = spawnSync(process.execPath,['--check','public/app.js'],{stdio:'inherit'});
if (syntax.status !== 0) process.exit(syntax.status ?? 1);
console.log('Whacky Auctions build check passed.');
