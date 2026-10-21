import 'dotenv/config';
import { fillStoreMeta, type StoreMetaPlatform } from '../storeMeta';

/*
  Store meta backfill
  ───────────────────
  Preenche game_store_meta (dev/pub/franquias) para jogos Steam e RetroAchievements
  que ainda não têm linha, e refaz as com erro há mais de 24h. Idempotente.
  PSN não tem fonte de metadados. Usage: npm run meta:backfill
*/

const PLATFORMS: StoreMetaPlatform[] = ['steam', 'retroachievements'];

async function main() {
  let failed = false;
  for (const platform of PLATFORMS) {
    console.log(`\n${platform}:`);
    try {
      const result = await fillStoreMeta(platform, (message) => console.log(`  ${message}`));
      console.log(`  ${result.attempted} tentado(s), ${result.stored} gravado(s), ${result.recordedErrors} com erro registrado, ${result.transientFailures} falha(s) transitória(s)`);
      if (result.transientFailures > 0) failed = true;
    } catch (error) {
      failed = true;
      console.log(`  pulado: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('Store meta backfill failed:', error);
  process.exit(1);
});
