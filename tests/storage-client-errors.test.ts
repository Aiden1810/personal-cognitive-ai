import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const clients = [
  { path: "chat/client", hook: "useChatData", action: 'client.createConversation()' },
  { path: "profile/client", hook: "useProfileData", action: 'client.skipQuestionnaire()' },
  { path: "goals/client", hook: "useGoalData", action: 'client.upsert("planning", "先列出任务")' },
  { path: "outcomes/client", hook: "useOutcomeData", action: 'client.resetOutcomes()' },
  { path: "preferences/client", hook: "useResponsePreferences", action: 'client.save({ length: "brief", explanation: "plain", structure: "natural" })' },
  { path: "profile/assessment-client", hook: "useAssessmentData", action: 'client.resetAssessment()' },
  { path: "profile/auto-client", hook: "useAutoProfileData", action: 'client.setEnabled(true, [])' },
  { path: "data/client", hook: "useDemoData", action: 'client.reset()' },
];

for (const entry of clients) {
  test(`${entry.path}: failed writes keep the displayed state and expose a recoverable error code`, () => {
    const url = pathToFileURL(resolve(`src/lib/${entry.path}.ts`)).href;
    const script = `
      import assert from "node:assert/strict";
      import { registerHooks } from "node:module";
      const hookURL = "data:text/javascript," + encodeURIComponent('export function useSyncExternalStore(subscribe, getSnapshot) { globalThis.lastHook = { subscribe, getSnapshot }; return getSnapshot(); }');
      registerHooks({ resolve(specifier, context, next) {
        if (specifier === "react") return { url: hookURL, shortCircuit: true };
        if (specifier.startsWith(".") && !/\\.\\w+$/.test(specifier)) return next(specifier + ".ts", context);
        return next(specifier, context);
      } });
      const values = new Map(); let failWrites = false;
      const storage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { if (failWrites) throw new DOMException("full", "QuotaExceededError"); values.set(key, value); },
        removeItem: key => values.delete(key),
      };
      globalThis.window = { localStorage: storage, addEventListener() {}, removeEventListener() {} };
      const { ${entry.hook}: useData } = await import(${JSON.stringify(url)});
      let client = useData();
      ${entry.action};
      const hook = globalThis.lastHook;
      const previousState = structuredClone(hook.getSnapshot().state);
      const previousData = new Map(values);
      failWrites = true;
      client = useData();
      const result = ${entry.action};
      assert.ok(result === null || result === false, "failed saves must not report success");
      assert.equal(hook.getSnapshot().errorCode, "STORAGE_FULL");
      assert.deepEqual(hook.getSnapshot().state, previousState);
      assert.deepEqual(values, previousData);
      failWrites = false;
      ${entry.action};
      assert.equal(hook.getSnapshot().errorCode, null, "successful retries clear the prior error");
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
      ${entry.action};
      assert.equal(hook.getSnapshot().errorCode, "STORAGE_ACCESS_DENIED", "property access failures must also be classified");
      assert.match(hook.getSnapshot().error, /浏览器.*存储/);
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  });
}
