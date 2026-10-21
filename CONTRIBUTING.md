# Contributing to Zenkuri

Thanks for running Zenkuri and giving feedback. This guide covers the development environment, branch and commit conventions, tests, how to publish content to the community, and the PR checklist. For the project overview, see [`README.md`](README.md).

## Development environment

Requirements: Node.js >=22.13 and npm (`.nvmrc` pins Node 24, which CI uses).

```bash
git clone https://github.com/joelkalil/zenkuri.git
cd zenkuri
npm install
cp .env.example .env   # fill in the keys for the platforms you will use
npm run dev
```

- Web: <http://localhost:5173>. API: <http://localhost:4343>.
- On first launch, create an account (**Create account (Criar conta)** tab), connect the platforms and sync.
- The keys (Steam Web API, PSN `npsso`, RetroAchievements) and where to get them are in section 06 of the README. Never commit `.env`.
- Data is stored in `data/zenkuri.sqlite`, which is git-ignored. For a throwaway database, point `ZENKURI_DB_PATH` to another file.

**Install scripts.** `package.json` has an `allowScripts` block approving `better-sqlite3`, `esbuild` and `fsevents`. `better-sqlite3` needs its script to obtain the native binding. If the server reports a missing binding after `npm install`, run `npm rebuild better-sqlite3` (this is what CI does).

## Branches and commits

**Branches:** `<type>/<short-subject>` in lowercase with hyphens, from `main`. Examples from the history: `feat/hanko-identity`, `feat/auto-collections`. Also use `fix/`, `docs/`, `refactor/` and `chore/`.

**Commits:** Conventional Commits with an emoji after the colon:

```
<type>(<scope>): <emoji> <description in the imperative, in English>
```

Real examples from the history:

```
feat(library): ✨ Add Franquias and Empresas collection tabs
feat(meta): 🗃️ Store developer, publisher and franchise metadata
docs(readme): 📝 Rewrite README with brand identity and screenshots
build(deps): 🔧 Approve install scripts for native dependencies
```

Types and emojis used: `feat` ✨ (or another fitting one, such as 🧩 🗃️ 🎨 📊), `docs` 📝, `build` 🔧, `fix` 🐛. One subject per commit, scoped to the area changed (`library`, `community`, `plan`, `readme`...).

## Tests and checks

Tests need neither keys nor network access.

```bash
npx tsc -b                  # types
npm run lint                # ESLint
npm test                    # every test script below + community:validate
npm run test:level          # level math
npm run test:collections    # manual and automatic collections
npm run test:community      # pack validation and import
npm run test:rankings       # automatic rankings
npm run test:server         # server env and error codes
npm run test:i18n           # message key parity and localization
npm run community:validate  # validates community/ (no database)
npm run build               # tsc -b + vite build
```

Tests that need a database create temporary ones. To make sure nothing touches `data/`, export `ZENKURI_DB_PATH` pointing to a file in `/tmp` before running.

## Publishing to the community

Curated sagas and rankings live in `community/<space>/` as versioned JSON. They are imported into the local database when the server starts, are read-only in the app and show up at `/comunidade` with the `@handle` authorship. The full field reference is in [`community/README.md`](community/README.md).

Step by step:

1. Create a branch (`feat/saga-hollow-knight`, for example).
2. Create or edit the file:
   - saga: `community/zenkuri/sagas/<slug>.json`
   - ranking: `community/zenkuri/rankings/<slug>.json`
3. The JSON `slug` must equal the file name, and `kind` must match the subfolder.
4. Use your own `author.handle`. It appears as `@handle` in the app.
5. When editing, **bump `version`** (integer, starts at 1). Set `language` to `"pt-BR"` or `"en"` (required, one language per pack).
6. Run `npm run community:validate`. Errors cite the file and field.
7. Optional: start `npm run dev` and check at `/comunidade`.
8. Open the PR.

A pack is authored in a single language, declared in the pack. The examples below are in English.

In the future, a public database and bucket will replace the repository as the transport.

### Full example: saga

`community/zenkuri/sagas/hollow-knight.json`

```json
{
  "schema": "zenkuri.publication/v1",
  "language": "en",
  "kind": "saga",
  "slug": "hollow-knight",
  "title": "Hollow Knight",
  "summary": "The two games of Hallownest and Pharloom in the order that pays off best for platinum.",
  "author": {
    "handle": "your-handle",
    "name": "Your Name"
  },
  "version": 1,
  "publishedAt": "2026-10-21",
  "payload": {
    "priceCheckedAt": "2026-10-21",
    "name": "Hollow Knight",
    "shortName": "HK",
    "tagline": "From Hallownest to Pharloom.",
    "method": "Start with the original to learn the pace, then move on to the sequel.",
    "phases": [
      {
        "id": "hallownest",
        "title": "Hallownest",
        "summary": "The original game.",
        "entries": [
          {
            "appid": "367520",
            "title": "Hollow Knight",
            "year": 2017,
            "achievements": 63,
            "hours": [40, 60],
            "difficulty": 4,
            "priceBRL": 46.99,
            "note": "Requires patience with the optional bosses.",
            "flags": ["missable"]
          }
        ]
      },
      {
        "id": "pharloom",
        "title": "Pharloom",
        "summary": "The sequel.",
        "entries": [
          {
            "appid": "1030300",
            "title": "Hollow Knight: Silksong",
            "year": 2025,
            "achievements": 50,
            "hours": [25, 50],
            "difficulty": 4,
            "priceBRL": 56.99,
            "note": "Harder right from the start."
          }
        ]
      }
    ],
    "outOfScope": [
      {
        "appid": "1",
        "title": "Out-of-scope example",
        "reason": "Reason it was left out."
      }
    ]
  }
}
```

The year, achievement and price values above are illustrative: check the real ones on Steam and update `priceCheckedAt` to the day you looked them up.

### Full example: ranking

`community/zenkuri/rankings/short-essentials.json`

```json
{
  "schema": "zenkuri.publication/v1",
  "language": "en",
  "kind": "ranking",
  "slug": "short-essentials",
  "title": "Short essentials",
  "summary": "Platinums that fit in a weekend.",
  "author": {
    "handle": "your-handle",
    "name": "Your Name"
  },
  "version": 1,
  "publishedAt": "2026-10-21",
  "payload": {
    "entries": [
      {
        "platform": "steam",
        "externalId": "1145360",
        "title": "Hades",
        "note": "The loop makes the grind feel like part of the fun.",
        "estimate": "70–100h"
      },
      {
        "platform": "psn",
        "externalId": "NPWR00000_00",
        "title": "PSN game example",
        "note": "The estimate is optional."
      }
    ]
  }
}
```

### New space

A space is a folder with `space.json` (`schema`, `language`, `slug`, `name`, `description`). Without it, the folder's publications are rejected. See [`community/README.md`](community/README.md).

## Legacy personal data

The command below imports a personal JSON file (plan and game notes) into an existing account. It is meant for bringing in data exported from the old format; if you are starting from scratch, edit the plan at `/plano`.

```bash
npm run personal:import -- --user <username> [--file data/personal/<username>.json] [--replace | --notes-only]
```

- The `<username>` account must exist in the database (create it in the app first).
- Without `--file`, the default is `data/personal/<username>.json`. That folder is git-ignored: **never commit personal data**.
- If the account already has a plan, the command refuses; `--replace` replaces the plan. Notes in the file overwrite those for the same game; the rest are kept.
- Notes for games that are not synced yet are skipped with a warning. After syncing, run the command again with `--notes-only`: it skips the plan (no "already has a plan" error) and imports only the notes.
- The database used is the one from `ZENKURI_DB_PATH` (default `data/zenkuri.sqlite`).

Format (`zenkuri.personal/v1`), abridged. The full definition is in `server/personal/file.ts`:

```json
{
  "schema": "zenkuri.personal/v1",
  "plan": {
    "title": "2026 Plan",
    "principle": "Free text.",
    "weeklyHours": 10,
    "baselineAvg": null,
    "targetAvg": null,
    "createdAt": "2026-01-01",
    "phases": [
      {
        "slug": "f1",
        "title": "Phase 1",
        "start": "2026-01-01",
        "end": "2026-03-31",
        "capacity": 120,
        "summary": "",
        "floating": false,
        "entries": [
          {
            "title": "Hades",
            "ref": { "platform": "steam", "id": "1145360" },
            "hours": 20,
            "kind": "platina",
            "target": 100,
            "note": "",
            "flags": []
          }
        ]
      }
    ],
    "recurring": [],
    "afterPlan": [],
    "acceptAsIs": [],
    "ifTime": [],
    "milestones": [{ "title": "Mid-year", "date": "2026-06-30", "label": "", "note": "" }],
    "vacations": [{ "slug": "vacation", "start": "2026-07-01", "end": "2026-07-10", "days": 10, "purpose": "", "note": "" }],
    "risks": [{ "risk": "Little time", "action": "Shrink phase 2" }]
  },
  "gameNotes": [
    { "platform": "steam", "externalId": "1145360", "estimate": "70–100h", "note": "Note.", "category": [] }
  ]
}
```

- `plan` can be `null` (imports only the notes). All plan lists are required (they can be `[]`).
- Plan entry: `title` (required); `ref` (`{platform, id}`, a library game) **or** `external` (`{label, releaseDate?, storeAppid?}`), never both; `hours` (0 to 10000), `kind` (`foco`, `platina`, `limpeza` or `colher`), `target` (integer 0 to 100), `note`, `flags` (`coop`, `online`, `risco`). In `phases[].entries` and `recurring`, `hours` and `kind` are required.
- `baselineAvg` and `targetAvg` are `null` or numbers from 0 to 100; `weeklyHours` ranges from 0 to 168; dates are `YYYY-MM-DD`.
- `gameNotes[]`: `platform` (`steam`, `retroachievements` or `psn`), `externalId`, `estimate` (string or `null`), `note` and `category` (list of strings; provenance only, the database stores `estimate` and `note`).

## PR checklist

The repository has a template at `.github/pull_request_template.md` and a CI workflow that runs types, lint, tests, pack validation and the build.

- [ ] The branch follows `<type>/<subject>` and the commits follow `type(scope): emoji description`.
- [ ] `npx tsc -b`, `npm run lint` and `npm test` pass locally.
- [ ] `npm run build` passes.
- [ ] Changes in `community/`: `npm run community:validate` passes, the `slug` matches the file name and `version` was bumped.
- [ ] No secrets, `.env` or personal data (`data/`) in the diff.
- [ ] The PR describes context, changes and how it was tested (test output or screenshots).
- [ ] Documentation updated when behavior or commands change (README, `community/README.md`).
