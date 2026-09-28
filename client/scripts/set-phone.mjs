/**
 * Move the shop's number, everywhere, in one pass.
 *
 * DIRECTION: this run goes 9781444655 -> 9814391854, putting the client's own
 * number back on the site. The rules below are the only thing that decides
 * which way it goes, so they are the first thing to read before running it.
 * To send it the other way, swap the two sides of each rule.
 *
 * Node reads and writes UTF-8 itself, so nothing is re-encoded on the way
 * through - no BOM appears and the em dashes and ellipses in the comments stay
 * as they are. A shell redirect is what corrupted two source files before.
 *
 *   node scripts/set-phone.mjs          report only
 *   node scripts/set-phone.mjs --write  do it
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');

// Old -> new, longest and most specific first so a short rule cannot eat part of
// a longer one. Read the direction at the top of this file before running.
const RULES = [
  ['+91 97814 44655', '+91 98143 91854'],
  ['e.g. 97814 44655', 'e.g. 98143 91854'],
  ['97814 44655', '98143 91854'],
  ['919781444655', '919814391854'],
];

const SKIP = new Set(['node_modules', '.git', 'dist', '.wrangler', 'generated']);
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.md', '.mjs']);

/*
 * The rules below are the only place the old number is written out on purpose,
 * in two ways: this file, and the "TO GO LIVE" line in site.js that tells the
 * next person which number to put back. Both have to survive a run untouched, or
 * the instruction becomes a copy of whatever the run just did.
 */
const SCRIPT = 'set-phone.mjs';
const INSTRUCTION = /TO GO LIVE/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name === SCRIPT) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

/** Rules applied to one line, skipping the ones that are instructions. */
function convert(line) {
  if (INSTRUCTION.test(line)) return line;
  let out = line;
  for (const [from, to] of RULES) out = out.split(from).join(to);
  return out;
}

let files = 0;
let hits = 0;
const report = [];

for (const file of walk(ROOT)) {
  const before = readFileSync(file, 'utf8');
  const lines = before.split('\n');
  let changedLines = 0;

  const after = lines
    .map((line) => {
      const next = convert(line);
      if (next !== line) changedLines += 1;
      return next;
    })
    .join('\n');

  if (after === before) continue;
  files += 1;
  hits += changedLines;
  report.push(`  ${relative(ROOT, file).padEnd(40)} ${changedLines} line(s)`);

  if (WRITE) {
    // A file that already had a BOM keeps it; one that had none does not gain
    // one. A stray BOM in a source file is a bug of its own.
    const hadBom = before.charCodeAt(0) === 0xfeff;
    const body = hadBom ? after.slice(after.indexOf('\n') + 1) : after;
    writeFileSync(file, (hadBom ? '﻿' : '') + body, 'utf8');
  }
}

console.log(WRITE ? 'CHANGED:' : 'WOULD CHANGE:');
for (const line of report) console.log(line);
console.log(`\n${files} file(s), ${hits} rule(s)${WRITE ? ' written' : ' - run with --write to apply'}`);
