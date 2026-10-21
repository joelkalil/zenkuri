import type { ApiErrorCode, ApiErrorDetail } from '../../server/errorCodes';

/** Codes raised by the client itself (the server never sends them). */
export const CLIENT_ERROR_CODES = ['network.unreachable', 'response.invalid'] as const;

export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];

export type AnyErrorCode = ApiErrorCode | ClientErrorCode;

/** Error thrown by `apiFetch`. `message` is the English default; render `code` through i18n instead. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: AnyErrorCode;
  readonly details?: ApiErrorDetail[];

  constructor(message: string, status: number, code?: AnyErrorCode, details?: ApiErrorDetail[], options?: ErrorOptions) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
