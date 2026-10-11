export const APP_ERROR_CODES = [
  "VALIDATION_ERROR", "NOT_FOUND", "CONFLICT",
  "STORAGE_FULL", "STORAGE_ACCESS_DENIED", "STORAGE_READ_FAILED", "STORAGE_WRITE_FAILED", "INVALID_STORED_DATA", "ROLLBACK_FAILED",
  "NETWORK_ERROR", "INVALID_RESPONSE", "LLM_UNAVAILABLE", "INVALID_MODEL_OUTPUT", "FORBIDDEN", "INTERNAL_ERROR",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

interface AppErrorOptions extends ErrorOptions {
  status?: number;
  operation?: string;
  storageKey?: string;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status?: number;
  readonly operation?: string;
  readonly storageKey?: string;

  constructor(code: AppErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
    this.status = options.status;
    this.operation = options.operation;
    this.storageKey = options.storageKey;
  }
}

// Keep the existing string field for UI consumers; codes remain available for recovery decisions.
export function errorState(error: unknown, fallback: string): { error: string; errorCode: AppErrorCode } {
  return {
    error: error instanceof Error ? error.message : fallback,
    errorCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
  };
}
