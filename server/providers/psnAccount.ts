import { requireVerifiedLink } from '../verification';

export function psnAccountId(userId: number): string {
  // Service account (.env) querying the linked public accountId.
  const link = requireVerifiedLink(userId, 'psn');
  const accountId = String(link.accountId ?? '');
  if (!accountId) throw new Error('PSN is not configured.');
  return accountId;
}
