/*
  Community read routes. Read-only: publishing means editing a pack in
  community/ and opening a PR. The content is global, so every logged-in user reads everything.
*/

import { Router } from 'express';
import { PUBLICATION_KINDS, type PublicationKind } from '../../src/types/community';
import { sendError } from '../errors';
import { getPublication, listPublications, listSpaces } from '../community/store';

function asKind(value: unknown): PublicationKind | null {
  return PUBLICATION_KINDS.find((kind) => kind === value) ?? null;
}

export const communityRouter = Router();

communityRouter.get('/spaces', (_req, res) => {
  res.json({ spaces: listSpaces() });
});

communityRouter.get('/publications', (req, res) => {
  if (req.query.kind === undefined) return void res.json({ publications: listPublications() });
  const kind = asKind(req.query.kind);
  if (!kind) return void sendError(res, 400, 'validation.invalid', [{ field: 'kind', code: 'invalid_value' }], `invalid kind (expected one of: ${PUBLICATION_KINDS.join(', ')}).`);
  res.json({ publications: listPublications(kind) });
});

communityRouter.get('/publications/:space/:kind/:slug', (req, res) => {
  const kind = asKind(req.params.kind);
  const publication = kind ? getPublication(req.params.space, kind, req.params.slug) : null;
  if (!publication) return void sendError(res, 404, 'community.publication_not_found');
  res.json(publication);
});
