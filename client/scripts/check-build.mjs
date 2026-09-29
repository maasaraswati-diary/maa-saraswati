/**
 * Refuses to let the wrong build reach production.
 *
 * There are two builds of this site and they look identical from the outside.
 *
 *   - the real one, which reads the catalogue and the saved page text from
 *     Firestore, so a product the owner adds in the panel is on the shop's
 *     website within seconds
 *   - the static one, built with VITE_STATIC_ONLY=1, which has no Firebase in it
 *     at all and serves a snapshot taken at build time
 *
 * The static build is what the tests run against, and running them leaves it in
 * client/dist. Deploying whatever is sitting there then puts the shop on the
 * snapshot: every customer is told "live prices reconnecting", the panel's
 * newest products and the whole of the saved About text stop appearing, and
 * nothing in the console says anything is wrong. It looks like a slow network.
 *
 * So this is run between the build and the upload, and it looks for the one
 * thing that is genuinely absent from a static build.
 *
 *   node scripts/check-build.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '..', 'dist');
const ASSETS = join(DIST, 'assets');

/** The one string that cannot survive tree-shaking a Firebase config away. */
const FIREBASE_KEY = 'AIzaSyDnrPsWBJNpNV35VJ0yJ5phognup1QC73Y';

const fail = (why, how) => {
  console.error(`\n  NOT DEPLOYING: ${why}\n`);
  console.error(`  ${how}\n`);
  process.exit(1);
};

if (!existsSync(ASSETS)) {
  fail('there is no dist/assets, so there is nothing built to check.',
    'Run the build first:  npm run build');
}

const bundles = readdirSync(ASSETS).filter((f) => /^index-.*\.js$/.test(f));
if (!bundles.length) {
  fail('dist/assets holds no index bundle.',
    'Run the build first:  npm run build');
}

const source = bundles.map((f) => readFileSync(join(ASSETS, f), 'utf8')).join('\n');

if (!source.includes(FIREBASE_KEY)) {
  fail('this is a STATIC build - it has no Firebase in it.',
    'The tests build with VITE_STATIC_ONLY=1 and leave that build in place.\n' +
    '  Rebuild without it:  unset VITE_STATIC_ONLY and run  npm run build\n' +
    '  (npm run deploy:pages does this for you, which is why the deploy\n' +
    '  script runs this check)');
}

const html = existsSync(join(DIST, 'index.html'))
  ? readFileSync(join(DIST, 'index.html'), 'utf8')
  : '';

// The catalogue snapshot has to be there, because a build that is missing it has
// no fallback at all and the shop would simply be empty.
const snapshot = resolve(__dirname, '..', 'src', 'generated', 'catalogue.json');
if (!existsSync(snapshot)) {
  fail('the catalogue snapshot is missing.', 'It is produced by scripts/sync-catalogue.mjs during the build.');
}

if (!html.includes('assets/')) {
  fail('dist/index.html does not reference the built assets.',
    'The build may have failed part way.');
}

console.log(`  build looks like the real one (${bundles.join(', ')})`);
