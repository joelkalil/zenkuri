import 'dotenv/config';
import { fillStoreMeta, type StoreMetaPlatform } from '../storeMeta';

/*
  Store meta backfill
  ───────────────────
  Fills game_store_meta (dev/pub/franchises) for Steam and RetroAchievements games
  that have no row yet, and redoes rows with an error older than 24h. Idempotent.
  PSN has no metadata source. Usage: npm run meta:backfill
*/

const PLATFORMS: StoreMetaPlatform[] = ['steam', 'retroachievements'];

async function main() {
  let failed = false;
  for (const platform of PLATFORMS) {
    console.log(`\n${platform}:`);
    try {
      const result = await fillStoreMeta(platform, (message) => console.log(`  ${message}`));
      console.log(`  ${result.attempted} attempted, ${result.stored} stored, ${result.recordedErrors} recorded as errors, ${result.transientFailures} transient failure(s)`);
      if (result.transientFailures > 0) failed = true;
    } catch (error) {
      failed = true;
      console.log(`  skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('Store meta backfill failed:', error);
  process.exit(1);
});
