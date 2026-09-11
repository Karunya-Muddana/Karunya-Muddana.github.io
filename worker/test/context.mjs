// Prints exactly what the chat model is told about the site, from the
// local HTML files. Run it after editing a page to see what changed.
//   node test/context.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { htmlToText } from '../src/extract.js';

const SITE_DIR = fileURLToPath(new URL('../../', import.meta.url));
let total = 0;
for (const page of ['index.html', 'about.html', 'resume.html']) {
  const text = htmlToText(readFileSync(SITE_DIR + page, 'utf8'), page);
  total += text.length;
  console.log(`=== ${page} ===\n${text}\n`);
}
console.error(`${total} chars, roughly ${Math.round(total / 4)} tokens`);
