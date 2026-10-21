/*
  Validates every pack in community/ without touching any database.
  Exits with code 1 on any error (used in CI). Usage: npm run community:validate
*/

import { loadPacks, resolveCommunityRoot } from '../community/packs';

const root = resolveCommunityRoot();
const load = loadPacks(root);

if (!load.rootExists) {
  console.error(`Packs folder not found: ${root}`);
  process.exit(1);
}

for (const message of load.warnings) console.warn(`warning: ${message}`);
for (const message of load.errors) console.error(`error: ${message}`);

console.log(
  `${load.spaces.length} space(s), ${load.publications.length} valid publication(s), `
  + `${load.errors.length} error(s), ${load.warnings.length} warning(s).`,
);
process.exit(load.errors.length === 0 ? 0 : 1);
