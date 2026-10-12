import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const clients = [
  { name: "chat", path: "chat/client.ts", hook: "useChatData", setup: `
    const { createChatStore } = await import(sourceURL("chat/store.ts"));
    const store = createChatStore(localStorage);
    const conversation = store.createConversation();
    const mutate = () => store.appendMessage(conversation.id, "user", "新标签页保存的发言");
    const select = state => state.conversations[0].messages.length;
    const write = data => data.appendMessage(conversation.id, "user", "未保存的发言");
    const before = 0; const after = 1;
  ` },
  { name: "goals", path: "goals/client.ts", hook: "useGoalData", setup: `
    const { createGoalStore } = await import(sourceURL("goals/store.ts"));
    const store = createGoalStore(localStorage);
    const goal = store.upsert("behavioral_patterns", "先完成一道练习");
    const mutate = () => store.pause(goal.id);
    const select = state => state.goals[0].status;
    const write = data => data.upsert("behavioral_patterns", "未保存的目标");
    const before = "active"; const after = "paused";
  ` },
  { name: "outcomes", path: "outcomes/client.ts", hook: "useOutcomeData", setup: `
    const { createOutcomeStore } = await import(sourceURL("outcomes/store.ts"));
    const store = createOutcomeStore(localStorage);
    const goal = { id: "goal", dimension: "behavioral_patterns", intention: "先完成一道练习", status: "active" };
    const first = store.add(goal, "完成一道练习", "已经完成", "toward");
    const mutate = () => store.delete(first.id);
    const select = state => state.entries.length;
    const write = data => data.add(goal, "未保存的行动", "未保存的结果", "unclear");
    const before = 1; const after = 0;
  ` },
  { name: "automatic memory settings", path: "profile/auto-client.ts", hook: "useAutoProfileData", setup: `
    const { createAutoProfileStore } = await import(sourceURL("profile/auto.ts"));
    const store = createAutoProfileStore(localStorage);
    store.setEnabled(true, []);
    const mutate = () => store.setEnabled(false, []);
    const select = state => state.enabled;
    const write = data => data.setEnabled(false, []);
    const before = true; const after = false;
  ` },
  { name: "assessment", path: "profile/assessment-client.ts", hook: "useAssessmentData", setup: `
    const { createAssessmentStore } = await import(sourceURL("profile/assessment.ts"));
    const store = createAssessmentStore(localStorage);
    store.setLabel("memory", "strength");
    const mutate = () => store.setLabel("memory", "growth");
    const select = state => state.labels.memory;
    const write = data => data.setLabel("memory", "growth");
    const before = "strength"; const after = "growth";
  ` },
];

function runClientScenario(client: (typeof clients)[number], scenario: string) {
  const sourceRoot = pathToFileURL(resolve("src/lib") + "/").href;
  const clientURL = new URL(client.path, sourceRoot).href;
  const script = `
    import assert from "node:assert/strict";
    import { registerHooks } from "node:module";
    const sourceURL = path => new URL(path, ${JSON.stringify(sourceRoot)}).href;
    // Isolate the module caches and stub only React's hook boundary.
    const hookURL = "data:text/javascript," + encodeURIComponent('export function useSyncExternalStore(subscribe, getSnapshot) { globalThis.lastHook = { subscribe, getSnapshot }; return getSnapshot(); }');
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === "react") return { url: hookURL, shortCircuit: true };
      if (context.parentURL?.startsWith(${JSON.stringify(sourceRoot)}) && specifier.startsWith(".") && !/\\.[a-z]+$/i.test(specifier)) return next(specifier + ".ts", context);
      return next(specifier, context);
    } });
    const values = new Map(); const events = new Set();
    let readDenied = false; let writeDenied = false;
    const localStorage = {
      getItem: key => { if (readDenied) throw new DOMException("Denied", "SecurityError"); return values.get(key) ?? null; },
      setItem: (key, value) => { if (writeDenied) throw new DOMException("Full", "QuotaExceededError"); values.set(key, value); },
      removeItem: key => values.delete(key),
    };
    globalThis.window = { localStorage, addEventListener: (_event, fn) => events.add(fn), removeEventListener: (_event, fn) => events.delete(fn) };
    ${client.setup}
    const { ${client.hook}: useData } = await import(${JSON.stringify(clientURL)});
    useData(); const hook = globalThis.lastHook;
    assert.equal(select(hook.getSnapshot().state), before);
    ${scenario}
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}

for (const client of clients) {
  test(`${client.name} reloads changes made while its page was unmounted`, () => {
    runClientScenario(client, `
      let stop = hook.subscribe(() => {}); stop();
      assert.equal(events.size, 0);
      mutate(); // A different tab writes while this client is not listening.
      stop = hook.subscribe(() => {});
      assert.equal(select(hook.getSnapshot().state), after, "remounted page must load current storage");
      stop();
    `);
  });

  test(`${client.name} retries a failed read without overwriting saved data`, () => {
    runClientScenario(client, `
      const stop = hook.subscribe(() => {});
      mutate();
      readDenied = true;
      for (const listener of events) listener({ key: null });
      assert.equal(hook.getSnapshot().errorCode, "STORAGE_ACCESS_DENIED");
      const saved = [...values.entries()];
      readDenied = false;
      useData().retryLoad();
      assert.equal(hook.getSnapshot().error, null);
      assert.equal(select(hook.getSnapshot().state), after);
      assert.deepEqual([...values.entries()], saved, "retry must only read, never reset storage");
      stop();
    `);
  });

  test(`${client.name} keeps its last saved state and error after a failed write`, () => {
    runClientScenario(client, `
      const stop = hook.subscribe(() => {});
      const saved = [...values.entries()];
      writeDenied = true;
      write(useData());
      assert.equal(hook.getSnapshot().errorCode, "STORAGE_FULL");
      assert.equal(select(useData().state), before);
      assert.equal(useData().errorCode, "STORAGE_FULL", "re-render must preserve the write error");
      const stopAdditional = hook.subscribe(() => {});
      assert.equal(hook.getSnapshot().errorCode, "STORAGE_FULL", "another mounted view must not hide the failed write");
      assert.deepEqual([...values.entries()], saved);
      stopAdditional(); stop();
    `);
  });

  test(`${client.name} preserves valid state when retrying a temporary read failure`, () => {
    runClientScenario(client, `
      const stop = hook.subscribe(() => {});
      const previous = hook.getSnapshot().state;
      const saved = [...values.entries()];
      readDenied = true;
      useData().retryLoad();
      assert.equal(hook.getSnapshot().errorCode, "STORAGE_ACCESS_DENIED");
      assert.deepEqual(hook.getSnapshot().state, previous, "failed retry must keep the last valid state available");
      useData().retryLoad();
      assert.deepEqual(hook.getSnapshot().state, previous);
      assert.deepEqual([...values.entries()], saved);
      readDenied = false;
      mutate();
      useData().retryLoad();
      assert.equal(select(hook.getSnapshot().state), after);
      assert.equal(hook.getSnapshot().error, null);
      stop();
    `);
  });

  test(`${client.name} hides stale state if reread detects corrupt saved data`, () => {
    runClientScenario(client, `
      const stop = hook.subscribe(() => {});
      for (const key of values.keys()) values.set(key, "corrupt saved data");
      const corrupt = [...values.entries()];
      useData().retryLoad();
      assert.equal(hook.getSnapshot().errorCode, "INVALID_STORED_DATA");
      assert.equal(hook.getSnapshot().state, null, "corrupt storage must not leave stale data actionable");
      assert.deepEqual([...values.entries()], corrupt);
      stop();
    `);
  });
}
