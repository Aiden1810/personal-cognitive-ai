import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

function run(body: string) {
  const rootURL = pathToFileURL(resolve("src/lib/") + "/").href;
  const script = `
    import assert from "node:assert/strict";
    import { registerHooks } from "node:module";
    const react = "data:text/javascript," + encodeURIComponent('export function useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); }');
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === "react") return { url: react, shortCircuit: true };
      if (specifier.startsWith(".") && !/\\.\\w+$/.test(specifier)) return next(specifier + ".ts", context);
      return next(specifier, context);
    } });
    const values = new Map(); let blocked = false;
    const storage = {
      getItem: key => { if (blocked) throw new DOMException("blocked", "SecurityError"); return values.get(key) ?? null; },
      setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
    };
    globalThis.window = { localStorage: storage, addEventListener() {}, removeEventListener() {} };
    const base = ${JSON.stringify(rootURL)};
    ${body}
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}

test("a late extraction cannot recreate candidates after its source chat was deleted", () => run(`
  const { createChatStore } = await import(base + "chat/store.ts");
  const { useProfileData } = await import(base + "profile/client.ts");
  const chat = createChatStore(storage);
  const conversation = chat.createConversation();
  const message = chat.appendMessage(conversation.id, "user", "合成测试：我开始前会先拆分任务");
  const candidate = { id: "late", dimension: "planning", statement: "开始前先拆分任务", origin: "ai_inference", status: "candidate",
    evidence: [{ conversationId: conversation.id, messageId: message.id, excerpt: "开始前会先拆分任务" }] };
  let profile = useProfileData();
  assert.equal(profile.addCandidates([candidate]), 1);
  profile.removeByConversation(conversation.id);
  chat.deleteConversation(conversation.id);
  assert.equal(profile.addCandidates([{ ...candidate, id: "late-second" }]), null);
  profile = useProfileData();
  assert.equal(profile.errorCode, "CONFLICT");
  assert.deepEqual(profile.state.insights, []);
`));

test("a corrupt source chat must not be reported as corrupt profile data", () => run(`
  const { createChatStore, CHAT_STORAGE_KEY } = await import(base + "chat/store.ts");
  const { useProfileData } = await import(base + "profile/client.ts");
  const chat = createChatStore(storage);
  const conversation = chat.createConversation();
  const message = chat.appendMessage(conversation.id, "user", "合成测试：开始前先拆分任务");
  const item = { id: "valid", dimension: "planning", statement: "开始前先拆分任务", origin: "ai_inference", status: "candidate",
    evidence: [{ conversationId: conversation.id, messageId: message.id, excerpt: "开始前先拆分任务" }] };
  let profile = useProfileData();
  assert.equal(profile.addCandidates([item]), 1);
  const previous = structuredClone(useProfileData().state);
  values.set(CHAT_STORAGE_KEY, "broken");
  assert.equal(profile.addCandidates([{ ...item, id: "next" }]), null);
  profile = useProfileData();
  assert.equal(profile.errorCode, "CONFLICT", "a source error must not suggest clearing intact profile data");
  assert.deepEqual(profile.state, previous);
  assert.equal(values.get(CHAT_STORAGE_KEY), "broken");
`));

for (const [path, hook] of [["profile/client.ts", "useProfileData"], ["preferences/client.ts", "useResponsePreferences"]]) {
  test(`${path}: retrying a temporary read error preserves stored records`, () => run(`
    const { [${JSON.stringify(hook)}]: useData } = await import(base + ${JSON.stringify(path)});
    useData();
    const before = new Map(values);
    const previousState = structuredClone(useData().state);
    blocked = true;
    useData().retryLoad();
    assert.equal(useData().errorCode, "STORAGE_ACCESS_DENIED");
    assert.deepEqual(useData().state, previousState, "a temporary read failure must keep mounted drafts supported by the prior state");
    assert.deepEqual(values, before);
    blocked = false;
    useData().retryLoad();
    assert.equal(useData().errorCode, null);
    assert.ok(useData().state);
    assert.deepEqual(values, before);
    values.set(${JSON.stringify(path === "profile/client.ts" ? "zhiheng.profile.v1" : "zhiheng.response-preferences.v1")}, "broken");
    useData().retryLoad();
    assert.equal(useData().errorCode, "INVALID_STORED_DATA");
    assert.equal(useData().state, null, "corrupt current records must not remain actionable");
  `));
}
