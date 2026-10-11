import type { ResponseAdaptation } from "../../types/cognitive.ts";

export const RESPONSE_ADAPTATION_DETAILS = {
  low: { label: "低", helpLabel: "简要提示", description: "按这条记忆调整用词或限制，直接给要点，少做额外展开。" },
  medium: { label: "中", helpLabel: "方法与例子", description: "按这条记忆选择适合的方法，补一个例子或几个可行步骤。" },
  high: { label: "高", helpLabel: "分步指导", description: "按这条记忆提供分步帮助，说明怎么开始、容易卡在哪里、如何检查结果。" },
} as const;

export function isResponseAdaptation(value: unknown): value is ResponseAdaptation {
  return typeof value === "string" && Object.hasOwn(RESPONSE_ADAPTATION_DETAILS, value);
}

export const RESPONSE_ADAPTATION_INSTRUCTIONS =
  "附加画像的 responseAdaptation 是用户设置的回答适配程度，不是人格强弱、事实置信度、能力分数或改变意愿。" +
  "按每条已选中画像的具体描述调整讲解难度、建议方法与帮助细致程度，不根据七维标签猜测性格。" +
  "low（低）：参考相关背景与限制，直接回答要点，通常用两三个要点即可；不主动展开完整教程、长清单或额外个人分析。" +
  "medium（中）：根据记录选择合适的方法，按问题需要给一个贴合情况的例子或几个可行步骤。" +
  "high（高）：围绕这条记录涉及的问题，优先选一种适合的方法并说明为什么适合；给可执行的起步步骤、一个可能的卡点和至少一项能观察的完成或检查标准，避免罗列许多方向却不落地；这些是建议，不是用户已经发生的新事实。" +
  "多条记录分别服务不同方面，不因一条 high 就把全部回答变长，也不因等级高低改变事实或检索相关性。" +
  "本次明确要求优先于已保存的回答偏好，回答偏好优先于画像适配程度；要求简短时把必要帮助压缩，要求只做润色或不参考画像时不额外展开个人分析。" +
  "当前明确状态优先于历史状态；不能因为旧记忆而否定用户本次说明。没有选中画像时正常回答，不虚构个人特点。";
