import { AppError } from "../errors.ts";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function storageError(cause: unknown, operation: "read" | "write", key: string | undefined, fallback: string): AppError {
  if (cause instanceof AppError) return cause;
  const name = typeof cause === "object" && cause !== null && "name" in cause ? cause.name : undefined;
  const options = { cause, operation, storageKey: key };
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return new AppError("STORAGE_FULL", "本地存储空间不足，保存失败，修改尚未保存。请先导出备份，再整理不需要的资料。", options);
  }
  if (name === "SecurityError" || name === "NotAllowedError") {
    return new AppError("STORAGE_ACCESS_DENIED", "浏览器拒绝访问本地存储，请检查浏览器存储权限。", options);
  }
  return new AppError(operation === "read" ? "STORAGE_READ_FAILED" : "STORAGE_WRITE_FAILED", fallback, options);
}

export function readStorageItem(storage: StorageAdapter, key: string, message: string): string | null {
  try { return storage.getItem(key); }
  catch (cause) { throw storageError(cause, "read", key, message); }
}

export function writeStoredJson(storage: StorageAdapter, key: string, value: unknown, message: string): void {
  try { storage.setItem(key, JSON.stringify(value)); }
  catch (cause) { throw storageError(cause, "write", key, message); }
}
