# Community packs

Curated sagas and rankings, published as versioned JSON files. This document is the field reference and a quick authoring guide. The PR step-by-step is in [`CONTRIBUTING.md`](../CONTRIBUTING.md#publishing-to-the-community). The source of truth is the validator in [`server/community/schema.ts`](../server/community/schema.ts).

## How it works

- When the server starts, the packs are read and imported into the local database, idempotently by content hash (same file, nothing changes).
- In the app, the content is read-only and shows up at `/comunidade`, with authorship shown as `@handle`.
- Deleting a file removes the publication from the database on the next startup.
- In the future, a public database and bucket will replace the repository as the transport; the format will be the same.
- A pack is authored in a single language, declared in the pack.

## Layout

```
community/
└── <space>/
    ├── space.json
    ├── sagas/<slug>.json
    └── rankings/<slug>.json
```

- The folder name is the space slug; the file name (without `.json`) is the publication slug; the subfolder defines the `kind` (`sagas` = `saga`, `rankings` = `ranking`).
- Only `.json` files up to 2 MiB; symlinks are ignored. Other items produce a warning.
- **Slug** = lowercase letters, numbers and hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`).
- **Date** = `YYYY-MM-DD`, a real date.
- All fields below are required unless noted. Unknown fields at the root level of `space.json` and of the publication are rejected.

## `space.json` (`zenkuri.space/v1`)

| Field | Type | Rule |
| --- | --- | --- |
| `schema` | string | Exactly `"zenkuri.space/v1"`. |
| `language` | string | **Required.** `"pt-BR"` or `"en"`: the language the space's text is written in. |
| `slug` | string | Slug, 1 to 40 characters, equal to the folder name. |
| `name` | string | 1 to 80 characters. |
| `description` | string | Up to 500 characters (may be empty). |

## Publication (`zenkuri.publication/v1`)

Common fields, at the root level:

| Field | Type | Rule |
| --- | --- | --- |
| `schema` | string | Exactly `"zenkuri.publication/v1"`. |
| `language` | string | **Required.** `"pt-BR"` or `"en"`: the language of the title, summary and notes. |
| `kind` | string | `"saga"` or `"ranking"`; must match the subfolder. |
| `slug` | string | Slug, 1 to 60 characters, equal to the file name. |
| `title` | string | 1 to 120 characters. |
| `summary` | string | Up to 600 characters (may be empty). |
| `author.handle` | string | 2 to 32 characters, starts with a letter or number; accepts letters, numbers, `.`, `_` and `-`. Shown as `@handle`. |
| `author.name` | string | 1 to 80 characters. |
| `version` | integer | `>= 1`. **Bump on every change.** |
| `publishedAt` | date | `YYYY-MM-DD`. |
| `payload` | object | Depends on `kind` (below). |

### `saga` payload

| Field | Type | Rule |
| --- | --- | --- |
| `priceCheckedAt` | date | When the prices were looked up on Steam. |
| `name` | string | Not empty. |
| `shortName` | string | Not empty (acronym or short name). |
| `tagline` | string | May be empty. |
| `method` | string | How the order was devised; may be empty. |
| `phases` | array | At least one phase. |
| `outOfScope` | array | Games left out; may be `[]`. |

Phase (`phases[]`):

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Not empty. |
| `title` | string | Not empty. |
| `summary` | string | May be empty. |
| `entries` | array | Games in the phase, in the suggested order. |

Game (`phases[].entries[]`):

| Field | Type | Rule |
| --- | --- | --- |
| `appid` | string | Numeric Steam appid, as a string. Cannot repeat within the saga. |
| `title` | string | Not empty. |
| `year` | integer | 1970 to 2100. |
| `achievements` | integer | `>= 0`. |
| `hours` | `[min, max]` | Two numbers `>= 0`, with `max >= min`. Hours for the full list. |
| `difficulty` | integer | 1 easy-going, 2 light, 3 medium, 4 demanding, 5 brutal. |
| `priceBRL` | number or `null` | Required. Full price in BRL on the `priceCheckedAt` date; `0` is free; `null` is not for sale. |
| `note` | string | May be empty. |
| `flags` | array (optional) | `online` (depends on online), `missable` (has missables), `legacy` (not for sale). |

Out of scope (`outOfScope[]`): `appid` (numeric string), `title` (not empty) and `reason` (string, may be empty).

### `ranking` payload

| Field | Type | Rule |
| --- | --- | --- |
| `entries` | array | List in ranking order. |

Item (`entries[]`):

| Field | Type | Rule |
| --- | --- | --- |
| `platform` | string | `steam`, `retroachievements` or `psn`. |
| `externalId` | string | Not empty. The game's id on the platform (appid on Steam). |
| `title` | string | Not empty. |
| `note` | string | May be empty. |
| `estimate` | string (optional) | Free text, for example `"25–50h"`. |

The `platform` + `externalId` pair cannot repeat within the ranking.

## Language

Every pack declares one language, `"pt-BR"` or `"en"`, on `space.json` and on each publication. A pack is written in a single language; to publish the same guide in both, add two publications with different slugs. The value is stored in the `spaces.language` and `publications.language` columns (default `pt-BR`) and returned as `language` by `GET /api/community/spaces` and `GET /api/community/publications`. A missing or unsupported value fails `npm run community:validate`. Changing `language` changes the file content, so bump `version` as with any other change.

## Quick authoring

1. Copy an existing pack of the same `kind` as a template.
2. Adjust `slug` (equal to the file name), `language`, `author`, `version` and `publishedAt`.
3. Run `npm run community:validate`. Each error cites the file and field (for example `payload.phases[0].entries[1].appid`).
4. Start the server (`npm run dev`) and check at `/comunidade`.
5. Open the PR.

## New space

Create `community/<slug>/space.json` with the fields above; without it, the folder's publications are rejected.
