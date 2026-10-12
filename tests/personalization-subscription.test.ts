import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

test("returning to chat refreshes preferences and archived memories changed while unsubscribed", () => {
  // Stub only React's hook boundary; exercise the real stores and client caches in isolation.
  const preferencesURL = pathToFileURL(resolve("src/lib/preferences/client.ts")).href;
  const profileURL = pathToFileURL(resolve("src/lib/profile/client.ts")).href;
  const script = `
    import assert from "node:assert/strict";
    import { registerHooks } from "node:module";
    const hookURL = "data:text/javascript," + encodeURIComponent('export function useSyncExternalStore(subscribe, getSnapshot) { globalThis.lastHook = { subscribe, getSnapshot }; return getSnapshot(); }');
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === "react") return { url: hookURL, shortCircuit: true };
      if ((context.parentURL === ${JSON.stringify(preferencesURL)} || context.parentURL === ${JSON.stringify(profileURL)}) && specifier === "./store") return next("./store.ts", context);
      return next(specifier, context);
    } });
    const values = new Map(); const events = new Set();
    const localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    globalThis.window = { localStorage, addEventListener: (_event, fn) => events.add(fn), removeEventListener: (_event, fn) => events.delete(fn) };
    const preferenceKey = "zhiheng.response-preferences.v1";
    const prefs = { length: "brief", explanation: "plain", structure: "natural" };
    localStorage.setItem(preferenceKey, JSON.stringify({ version: 1, preferences: prefs }));
    const { useResponsePreferences } = await import(${JSON.stringify(preferencesURL)});
    useResponsePreferences(); const preferenceHook = globalThis.lastHook;
    assert.equal(preferenceHook.getSnapshot().state.preferences.length, "brief");
    let stop = preferenceHook.subscribe(() => {}); stop();
    localStorage.setItem(preferenceKey, JSON.stringify({ version: 1, preferences: { ...prefs, length: "detailed" } }));
    stop = preferenceHook.subscribe(() => {});
    assert.equal(preferenceHook.getSnapshot().state.preferences.length, "detailed", "remounted preferences must reflect current storage"); stop();
    const profileKey = "zhiheng.profile.v1";
    const old = { id: "old", dimension: "behavioral_patterns", statement: "复习时先做题", status: "confirmed", origin: "ai_inference", evidence: [{ conversationId: "c", messageId: "m", excerpt: "先做题" }] };
    localStorage.setItem(profileKey, JSON.stringify({ version: 1, insights: [old] }));
    const { useProfileData } = await import(${JSON.stringify(profileURL)});
    useProfileData(); const profileHook = globalThis.lastHook;
    stop = profileHook.subscribe(() => {}); stop();
    localStorage.setItem(profileKey, JSON.stringify({ version: 1, insights: [{ ...old, status: "archived" }] }));
    stop = profileHook.subscribe(() => {});
    assert.equal(profileHook.getSnapshot().state.insights[0].status, "archived", "remounted profile must not revive archived memory"); stop();
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
