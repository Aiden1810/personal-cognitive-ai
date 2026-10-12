"use client";

import { createLocalSnapshot, restoreLocalSnapshot } from "../cloud/snapshot";
import { getBrowserStorage } from "../storage/browser.ts";

export function readBrowserSnapshot() {
  return createLocalSnapshot(getBrowserStorage());
}

export function restoreBrowserSnapshot(value: unknown): void {
  restoreLocalSnapshot(value, getBrowserStorage());
}
