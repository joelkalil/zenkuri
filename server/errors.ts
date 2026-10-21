import type { Response } from 'express';
import type { ApiErrorBody, ApiErrorCode, ApiErrorDetail } from './errorCodes';

export type { ApiErrorBody, ApiErrorCode, ApiErrorDetail } from './errorCodes';

const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  'auth.unauthenticated': 'Not authenticated.',
  'auth.invalid_credentials': 'Invalid username or password.',
  'auth.invalid_username': 'The username must be 3 to 24 characters (letters, numbers, dot, hyphen or underscore).',
  'auth.username_taken': 'This username is already taken.',
  'auth.password_too_short': 'The password must be at least 6 characters.',
  'auth.current_password_incorrect': 'The current password is incorrect.',
  'auth.display_name_required': 'The display name is required.',
  'sync.unsupported_platform': 'Unsupported platform.',
  'sync.not_configured': 'This platform is not linked to the account.',
  'sync.link_not_verified': 'The platform link has not been verified yet.',
  'sync.identifier_required': 'Enter your profile identifier.',
  'sync.steam_id_required': 'Enter your SteamID64 or Steam profile URL.',
  'sync.steam_profile_not_found': 'Steam profile not found. Enter your SteamID64 or profile URL.',
  'sync.steam_profile_unreadable': 'Could not read the Steam profile. Is it public?',
  'sync.steam_profile_private': 'The Steam profile is private: the level is not visible.',
  'sync.steam_key_rejected': 'The Steam API key is invalid or expired (common after changing the Steam password). '
    + 'Generate a new one at steamcommunity.com/dev/apikey and update ZENKURI_STEAM_API_KEY on the server.',
  'sync.psn_profile_not_found': 'PSN profile not found. Check the online ID.',
  'sync.ra_user_not_found': 'RetroAchievements user not found.',
  'sync.verification_not_linked': 'Link the account before verifying.',
  'sync.verification_no_pending_code': 'No pending verification code. Link the account again.',
  'sync.verification_code_not_found': 'Code not found on the profile. Make sure you saved the change and try again in a few moments.',
  'sync.steam_service_not_configured': 'ZENKURI_STEAM_API_KEY is not configured on the server.',
  'sync.ra_service_not_configured': 'ZENKURI_RA_USERNAME / ZENKURI_RA_API_KEY are not configured on the server.',
  'sync.psn_service_not_configured': 'ZENKURI_PSN_NPSSO is not configured on the server.',
  'sync.psn_credential_expired': 'The PSN service credential has expired. Update ZENKURI_PSN_NPSSO in .env and restart the server.',
  'game.not_found': 'Game not found.',
  'collections.name_required': 'The collection name is required.',
  'plan.not_found': 'Plan not found.',
  'plan.item_not_found': 'Item not found.',
  'plan.already_exists': 'You already have a plan.',
  'plan.slug_taken': 'This slug already exists in the plan.',
  'plan.invalid_date_range': 'The end date cannot be before the start date.',
  'plan.entry_requires_hours_and_kind': 'Entries in this section require hours and kind.',
  'plan.phase_id_required': 'phaseId is required in the "phase" section.',
  'plan.phase_id_not_allowed': 'phaseId is only allowed in the "phase" section.',
  'plan.entry_cannot_change_phase': 'Only entries in the "phase" section can change phase, and the phase cannot be null.',
  'community.publication_not_found': 'Publication not found.',
  'validation.invalid': 'Validation failed.',
  'request.invalid_body': 'The request body is invalid.',
  'request.too_large': 'The request body is too large.',
  'server.internal': 'Unexpected server error.',
};

export function defaultErrorMessage(code: ApiErrorCode): string {
  return DEFAULT_MESSAGES[code];
}

export interface ApiErrorOptions {
  details?: ApiErrorDetail[];
  /** Overrides the default English message (e.g. to name the offending value). */
  message?: string;
}

/** Typed error thrown from deep code; the global error handler maps it to a response. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: ApiErrorDetail[];

  constructor(code: ApiErrorCode, status: number, options: ApiErrorOptions = {}) {
    super(options.message ?? DEFAULT_MESSAGES[code]);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = options.details;
  }
}

/** Responds `{ error: <english message>, code, details? }`. */
export function sendError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  details?: ApiErrorDetail[],
  message?: string,
): void {
  const body: ApiErrorBody = { error: message ?? DEFAULT_MESSAGES[code], code };
  if (details && details.length > 0) body.details = details;
  res.status(status).json(body);
}

export interface ErrorResponse {
  status: number;
  code: ApiErrorCode;
  message?: string;
  details?: ApiErrorDetail[];
}

function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const record = error as { status?: unknown; statusCode?: unknown };
  for (const value of [record.status, record.statusCode]) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 499) return value;
  }
  return undefined;
}

/**
 * Maps any thrown value to a safe response. Raw messages of unknown errors are
 * never exposed; 4xx errors from Express middleware (e.g. body-parser) become
 * generic request errors.
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof ApiError) {
    return { status: error.status, code: error.code, message: error.message, details: error.details };
  }
  const status = clientErrorStatus(error);
  if (status !== undefined) {
    return { status, code: status === 413 ? 'request.too_large' : 'request.invalid_body' };
  }
  return { status: 500, code: 'server.internal' };
}

export function sendApiError(res: Response, error: ApiError): void {
  sendError(res, error.status, error.code, error.details, error.message);
}
