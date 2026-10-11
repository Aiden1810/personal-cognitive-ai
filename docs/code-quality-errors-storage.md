# 错误处理、本地存储与聊天 API 契约

日期：2026 年 10 月 11 日。

本轮在现有同步 Store 上统一失败信息，不迁移资料、不引入依赖。用户仍通过原页面聊天、审核画像、设置目标和备份。

## 行为变化

- Store 对外抛出继承 `Error` 的 `AppError`，保留中文 `message` 和原始 `cause`，并提供稳定的 `code`。存储错误还记录操作名和 storage key，不记录聊天内容或密钥。
- 空间不足为 `STORAGE_FULL`，权限拒绝为 `STORAGE_ACCESS_DENIED`，其他读取/写入失败分别为 `STORAGE_READ_FAILED` / `STORAGE_WRITE_FAILED`，已有资料损坏为 `INVALID_STORED_DATA`。
- 保留现有读取空存储时的默认值。读取失败不会变成空资料，损坏资料不会自动覆盖，写入失败不会静默切换到内存或删除旧聊天。
- 页面订阅入口保留 `error: string | null`，增加 `errorCode: AppErrorCode | null`。失败保存保留原界面状态，成功重试清除错误。
- 浏览器 `localStorage` 属性本身的权限错误也经过统一入口处理。
- 操作建议和备份恢复继续使用原有暂存、倒序回滚流程。成功回滚保留原始失败类型；回滚未完成为 `ROLLBACK_FAILED`，并保留初次失败与回滚失败两个原因，提示人工核对。
- 聊天客户端和服务端共用 `ChatRequest` / `ChatResponse`。客户端继续进行运行时验证：`ok`、回复、错误码和 HTTP 状态必须有效；错误响应不能冒充成功回复。客户端保留服务端错误码及 HTTP 状态，网络错误保留原因。
- 原 `ChatError` 名称和导入入口保留，它现在继承公共 `AppError`。旧演示接口 `src/types/api.ts` 不变。

## 文件范围

新增公共入口：

```text
src/lib/errors.ts
src/lib/storage/storage.ts
src/lib/storage/browser.ts
src/types/chat-api.ts
```

Store 和页面订阅入口：

```text
src/lib/chat/store.ts                   src/lib/chat/client.ts
src/lib/profile/store.ts                src/lib/profile/client.ts
src/lib/goals/store.ts                  src/lib/goals/client.ts
src/lib/outcomes/store.ts               src/lib/outcomes/client.ts
src/lib/preferences/store.ts            src/lib/preferences/client.ts
src/lib/profile/assessment.ts           src/lib/profile/assessment-client.ts
src/lib/profile/auto.ts                 src/lib/profile/auto-client.ts
src/lib/data/store.ts                   src/lib/data/client.ts
```

聊天、操作建议和恢复流程：

```text
src/lib/ai/chat.ts
src/lib/chat/api.ts
src/app/api/chat/route.ts
src/lib/chat/actions.ts
src/lib/cloud/snapshot.ts
src/lib/backup/client.ts
```

测试与文档：

```text
tests/storage-errors.test.ts            新增 Store 失败测试
tests/storage-client-errors.test.ts     新增页面状态与权限测试
tests/chat-api-client.test.ts           错误码、网络原因和异常响应
tests/cloud-snapshot.test.ts            回滚后的错误码与双重失败
tests/chat-suggestion-actions.test.ts   操作建议回滚后的错误码
tests/chat-suggestions-api.test.ts      对齐真实聊天成功响应样例
tests/personal-context.test.ts          对齐真实聊天成功响应样例
tests/personalization-update.test.ts    对齐真实聊天成功响应样例
tests/semantic-chat-client.test.ts      对齐真实聊天成功响应样例
README.md                              本轮入口说明
docs/code-quality-errors-storage.md     本记录
```

## 开发时如何处理错误

业务代码可以继续使用 `try...catch`。需要根据失败类型采取措施时，先判断 `error instanceof AppError`，再读取 `error.code`。不要依靠匹配中文消息判断是否保存成功，也不要在界面或 HTTP 响应里展示 `cause` 或堆栈。

所有存储版本和 key 保持不变，现有 JSON 备份和旧七维资料继续兼容。`StorageAdapter` 已集中定义，原聊天和旧 Demo Store 仍重新导出该类型以兼容已有调用方。

## 运行与验证

在项目根目录的 Windows PowerShell 中执行：

```powershell
npm.cmd run dev -- --port 3001
```

打开 `http://127.0.0.1:3001/chat`。正常保存聊天、目标和个人设置，刷新后应保持资料；真实 AI 仍需现有服务端 `LLM_API_KEY`。

本轮实际执行：`npm.cmd test` 281 项通过、0 失败；`npm.cmd run typecheck`、`npm.cmd run lint`、`npm.cmd run build` 均通过。新增 48 个测试，另增强操作建议回滚测试；此前缺少 `ok` 的合成聊天成功样例已对齐真实接口。

需要复查本轮的故障路径时：

```powershell
node --test tests/storage-errors.test.ts tests/storage-client-errors.test.ts tests/chat-api-client.test.ts tests/cloud-snapshot.test.ts tests/chat-suggestion-actions.test.ts
```

测试使用独立内存适配器和模拟浏览器入口，不向真实浏览器填充垃圾数据，也不调用付费模型。

## 保留的边界

- `localStorage` 仍是同步存储。现有 `storage` 事件负责刷新其他标签页，不提供跨标签页写入锁；本轮未实现并发冲突解决。
- 多 key 保存仍是应用层的补偿回滚，页面崩溃或进程中断时不具有数据库事务保证。
- 本轮共享的是聊天 API 契约。画像提取、综合观察、摘要和语义实验的客户端契约没有全部迁移。
- 自动测试和构建不等于真实模型、云端账户及跨设备恢复已经验收。
- 若后续实测发现容量或性能瓶颈，再单独设计异步存储接口和 IndexedDB 迁移；不要把异步方法直接塞进现有同步适配器。
