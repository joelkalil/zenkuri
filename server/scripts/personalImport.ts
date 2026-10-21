/*
  Imports the plan and personal notes from a JSON file (outside git) into the
  given user's database.

  Usage: npm run personal:import -- --user joel [--file data/personal/joel.json] [--replace | --notes-only]

  The database is the one at ZENKURI_DB_PATH (or data/zenkuri.sqlite). Refuses if
  the user already has a plan unless --replace is passed; `--replace` swaps only
  the plan (the file's notes overwrite the ones for the same game, the rest stay).
  `--notes-only` skips the plan entirely and upserts only the notes; use it after
  syncing games that were skipped with a warning on the first run.
*/

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getUserByUsername } from '../db';
import { validatePersonalFile } from '../personal/file';
import { PersonalImportError, importPersonal } from '../personal/import';

interface Args {
  user: string;
  file: string;
  replace: boolean;
  notesOnly: boolean;
}

function parseArgs(argv: string[]): Args | string {
  let user = '';
  let file = '';
  let replace = false;
  let notesOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--replace') replace = true;
    else if (arg === '--notes-only') notesOnly = true;
    else if (arg === '--user' || arg === '--file') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) return `${arg} needs a value`;
      if (arg === '--user') user = value;
      else file = value;
      index += 1;
    } else {
      return `unknown argument: ${arg}`;
    }
  }
  if (user === '') return 'provide --user <username>';
  if (replace && notesOnly) return '--replace and --notes-only cannot be combined';
  return { user, file: resolve(process.cwd(), file === '' ? `data/personal/${user}.json` : file), replace, notesOnly };
}

function fail(message: string): never {
  console.error(`personal:import: ${message}`);
  console.error('Usage: npm run personal:import -- --user <username> [--file <path>] [--replace | --notes-only]');
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (typeof args === 'string') fail(args);

const user = getUserByUsername(args.user);
if (!user) fail(`user "${args.user}" does not exist in this database.`);

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(args.file, 'utf8'));
} catch (error) {
  fail(`could not read ${args.file}: ${error instanceof Error ? error.message : String(error)}`);
}

const checked = validatePersonalFile(args.file, raw);
if (!checked.ok) {
  for (const message of checked.errors) console.error(`error: ${message}`);
  fail(`${checked.errors.length} validation error(s).`);
}

try {
  const result = importPersonal(user.id, checked.value, { replace: args.replace, notesOnly: args.notesOnly });
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  console.log(
    `Imported into "${user.username}": plan ${result.planImported ? 'yes' : 'no'} `
    + `(${result.phases} phases, ${result.entries} entries, ${result.milestones} milestones, ${result.vacations} vacations, ${result.risks} risks), `
    + `${result.notesImported} game note(s), ${result.warnings.length} skipped.`,
  );
} catch (error) {
  if (error instanceof PersonalImportError) fail(error.message);
  throw error;
}
