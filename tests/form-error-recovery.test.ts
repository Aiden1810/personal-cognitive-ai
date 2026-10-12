import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

// Node does not execute TSX or Next's client hooks directly. Transpile the actual
// pages and expose the real browser-store snapshots to React's server renderer.

for (const page of ["profile", "outcomes"] as const) {
  test(`${page}: a failed save keeps the editor available without offering a destructive reset`, () => {
    const root = pathToFileURL(resolve(".") + "/").href;
    const script = `
      import assert from "node:assert/strict";
      import { readFileSync } from "node:fs";
      import { registerHooks } from "node:module";
      import ts from "typescript";
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      const root = ${JSON.stringify(root)};
      const realReactURL = import.meta.resolve("react");
      const reactURL = "data:text/javascript," + encodeURIComponent(
        'export * from ' + JSON.stringify(realReactURL) + '; import { Fragment } from ' + JSON.stringify(realReactURL) + ';' +
        'export const ViewTransition = Fragment; export function useSyncExternalStore(subscribe, getSnapshot) { return getSnapshot(); }'
      );
      registerHooks({
        resolve(specifier, context, next) {
          if (specifier === "react" && !context.conditions.includes("require")) return { url: reactURL, shortCircuit: true };
          if (specifier === "next/link") return next("next/link.js", context);
          if (specifier.startsWith("@/")) specifier = new URL("src/" + specifier.slice(2), root).href;
          if ((specifier.startsWith(".") || specifier.startsWith(root)) && !/\\.\\w+$/.test(specifier)) {
            for (const extension of [".ts", ".tsx"]) {
              try { return next(specifier + extension, context); } catch {}
            }
          }
          return next(specifier, context);
        },
        load(url, context, next) {
          if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true,
            source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
              compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
            }).outputText };
          return next(url, context);
        },
      });
      const values = new Map(); let failWrites = false;
      globalThis.window = {
        localStorage: {
          getItem: key => values.get(key) ?? null,
          setItem: (key, value) => { if (failWrites) throw new DOMException("full", "QuotaExceededError"); values.set(key, value); },
          removeItem: key => values.delete(key),
        }, addEventListener() {}, removeEventListener() {},
      };
      const { useGoalData } = await import(new URL("src/lib/goals/client.ts", root));
      let goals = useGoalData();
      const goal = goals.upsert("action_execution", "先做一个小步骤");
      assert.ok(goal);
      const { ${page === "profile" ? "ProfileOverview" : "OutcomeWorkspace"}: Page } = await import(new URL(${JSON.stringify(page === "profile" ? "src/features/profile/profile-overview.tsx" : "src/features/outcomes/outcome-workspace.tsx")}, root));
      ${page === "outcomes" ? 'const { useOutcomeData } = await import(new URL("src/lib/outcomes/client.ts", root)); const outcomes = useOutcomeData();' : ""}
      const before = renderToStaticMarkup(createElement(Page));
      assert.ok(before.includes(${JSON.stringify(page === "profile" ? 'id="goal-action_execution"' : 'id="outcome-action"')}), "editor must be present initially");
      failWrites = true;
      const saved = ${page === "profile" ? 'goals.upsert("action_execution", "保存失败的草稿")' : 'outcomes.add(goal, "复习了二十分钟", "完成三题", "toward")'};
      assert.ok(saved === null || saved === false);
      const after = renderToStaticMarkup(createElement(Page));
      assert.ok(after.includes(${JSON.stringify(page === "profile" ? 'id="goal-action_execution"' : 'id="outcome-action"')}), "the error-state view must still include the editor");
      assert.match(after, /role="alert"/);
      assert.match(after, /重新读取/);
      assert.doesNotMatch(after, /清空损坏/);
      failWrites = false;
      ${page === "profile" ? "goals.retryLoad();" : "outcomes.retryLoad();"}
      const recovered = renderToStaticMarkup(createElement(Page));
      assert.doesNotMatch(recovered, /role="alert"/);
      assert.ok(recovered.includes(${JSON.stringify(page === "profile" ? 'id="goal-action_execution"' : 'id="outcome-action"')}));
      const key = ${JSON.stringify(page === "profile" ? "zhiheng.goals.v1" : "zhiheng.outcomes.v1")};
      const validData = values.get(key);
      values.set(key, "{broken json");
      ${page === "profile" ? "goals.retryLoad();" : "outcomes.retryLoad();"}
      const damaged = renderToStaticMarkup(createElement(Page));
      assert.match(damaged, /清空损坏/);
      assert.ok(!damaged.includes(${JSON.stringify(page === "profile" ? 'id="goal-action_execution"' : 'id="outcome-action"')}), "invalid reads must not present empty replacement forms");
      if (validData === undefined) values.delete(key); else values.set(key, validData);
      ${page === "profile" ? "goals.retryLoad();" : "outcomes.retryLoad();"}
      const restored = renderToStaticMarkup(createElement(Page));
      assert.doesNotMatch(restored, /role="alert"/);
      assert.ok(restored.includes(${JSON.stringify(page === "profile" ? 'id="goal-action_execution"' : 'id="outcome-action"')}));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", timeout: 20000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  });
}
