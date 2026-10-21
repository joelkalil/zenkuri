import { requireVerifiedLink } from '../verification';

export function psnAccountId(userId: number): string {
  // Conta de serviço (.env) consultando o accountId público vinculado.
  const link = requireVerifiedLink(userId, 'psn');
  const accountId = String(link.accountId ?? '');
  if (!accountId) throw new Error('PSN is not configured.');
  return accountId;
}
