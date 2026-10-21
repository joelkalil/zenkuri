import { loadPacks, resolveCommunityRoot, type PackLoad } from './packs';
import { syncPacksToDb, type PackSyncSummary } from './store';

export interface PackImportReport {
  load: PackLoad;
  summary: PackSyncSummary;
}

/** Reads the packs from disk and syncs the database (idempotent by content_hash). */
export function importCommunityPacks(root: string = resolveCommunityRoot()): PackImportReport {
  const load = loadPacks(root);
  const summary = syncPacksToDb({
    spaces: load.spaces,
    publications: load.publications,
    seenSpaces: load.seenSpaces,
    seenPublications: load.seenPublications,
    allowRemoval: load.rootExists,
  });
  return { load, summary };
}

export function describeImport({ load, summary }: PackImportReport): string {
  return `[zenkuri] Community: ${summary.spaces} space(s), ${summary.added} added, ${summary.updated} updated, `
    + `${summary.unchanged} unchanged, ${summary.removed} removed, ${load.errors.length} invalid pack(s).`;
}

/** For server startup: never throws; problems become log warnings. */
export function importCommunityPacksOnStart(): void {
  try {
    const report = importCommunityPacks();
    if (!report.load.rootExists) {
      console.warn(`[zenkuri] Community: packs folder not found (${report.load.root}); nothing imported.`);
      return;
    }
    console.log(describeImport(report));
    for (const message of report.load.errors) console.warn(`[zenkuri] Invalid pack: ${message}`);
    for (const message of report.load.warnings) console.warn(`[zenkuri] Pack ignored: ${message}`);
  } catch (error) {
    console.warn(`[zenkuri] Failed to import the community packs: ${error instanceof Error ? error.message : String(error)}`);
  }
}
