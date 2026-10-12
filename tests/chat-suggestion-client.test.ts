import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

test("failed suggestion storage does not put an intact chat into a global error state", () => {
  const clientURL = pathToFileURL(resolve("src/lib/chat/client.ts")).href;
  const storeURL = pathToFileURL(resolve("src/lib/chat/store.ts")).href;
  const script = `
    import assert from "node:assert/strict";
    import { registerHooks } from "node:module";
    const hookURL = "data:text/javascript," + encodeURIComponent('export function useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); }');
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === "react") return { url: hookURL, shortCircuit: true };
      if (context.parentURL?.includes("/src/lib/") && /^\\.\\.?\\//.test(specifier) && !specifier.endsWith(".ts")) return next(specifier + ".ts", context);
      return next(specifier, context);
    } });
    const values = new Map(); let blocked = false;
    const storage = { getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key), setItem: (key, value) => {
      if (blocked) throw new Error("synthetic quota failure");
      values.set(key, value);
    } };
    globalThis.window = { localStorage: storage, addEventListener() {}, removeEventListener() {} };
    const { createChatStore } = await import(${JSON.stringify(storeURL)});
    const chat = createChatStore(storage);
    const conversation = chat.createConversation();
    const source = chat.appendMessage(conversation.id, "user", "合成案例：我想改掉拖延");
    const reply = chat.appendMessage(conversation.id, "assistant", "先选一个小目标。");
    const action = { id: "a1", kind: "goal", dimension: "behavioral_patterns", intention: "先做一件重要的事", reason: "用户想改变", excerpt: "我想改掉拖延", sourceMessageId: source.id, status: "pending" };
    const { useChatData } = await import(${JSON.stringify(clientURL)});
    let data = useChatData();
    blocked = true;
    try { data.setSuggestions(conversation.id, reply.id, [action]); } catch {}
    data = useChatData();
    assert.equal(data.error, null, "suggestion save failure must not disable ordinary chat");
    assert.equal(data.state.conversations[0].messages.at(-1).content, reply.content);
    blocked = false;
    data.setSuggestions(conversation.id, reply.id, [action]);
    blocked = true;
    try { useChatData().dismissSuggestion(conversation.id, reply.id, "a1"); } catch {}
    assert.equal(useChatData().error, null, "dismissal failure must also stay local to the card");
    assert.equal(useChatData().state.conversations[0].messages.at(-1).suggestions[0].status, "pending");
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
