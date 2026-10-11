import { storageError } from "./storage.ts";

// Accessing the localStorage property itself can fail before a store gets its adapter.
export function getBrowserStorage(): Storage {
  try { return window.localStorage; }
  catch (cause) { throw storageError(cause, "read", undefined, "无法访问本地存储，请检查浏览器存储权限。"); }
}
