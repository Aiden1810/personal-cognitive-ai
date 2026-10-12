# Designeer 前端参考调研

日期：2026 年 10 月 12 日。范围：官网首页、Components、Info、llms.txt，以及少量被收录资源的官方页面。只做参考筛选，没有修改知衡 UI、安装依赖或验收真实模型流程。

## 核实结果与限制

- [Designeer](https://www.designeer.xyz/) 是设计资源目录，包含设计案例、组件库、动效和工具；并非单一开源组件库。[说明页](https://www.designeer.xyz/info)区分普通收录与 Sponsored 位置，页尾标注 All Rights Reserved；本轮没有找到整站源码的开放许可。
- 网页工具未能读取官网，内嵌浏览器连接两次超时。随后通过公开 HTTP 页面取得官网 HTML，状态码 200，保存到忽略目录 `output/designeer-reference-2026-10-12/`。
- 本轮没有取得有效浏览器截图，也没有真实操作筛选、菜单或动画。因此这些是网页资料调研与适配建议，不是完整视觉或可访问性审查。不能据此评价网站的实际动效质量。

## 对知衡较有用的资源

| 来源 | 已核实内容 | 本项目适配建议 |
| --- | --- | --- |
| [Minimal Gallery](https://minimal.gallery/) | 提供网站案例、模板、工具和分类浏览 | 用作排版与信息层级案例入口，挑文字清楚、装饰少的产品界面；案例不是可自由复制的源码 |
| [UI Playbook：Button](https://uiplaybook.dev/play/button) | 说明原生按钮、hover、active、focus、disabled、loading 等状态 | 用作发送、保存和审核按钮的状态检查表，减少额外装饰也保留明确反馈 |
| [UI Playbook：Motion](https://uiplaybook.dev/play/motion) | 强调运动目的、进入退出联系、阅读稳定性和减少动态效果 | 面板与问卷切换要帮助定位；正文与流式回复保持稳定。具体 API 示例须对照本项目安装版本核实 |
| [Motion Primitives](https://motion-primitives.com/docs) / [源码](https://github.com/ibelick/motion-primitives) | 官方文档索引包含 Transition Panel、Morphing Dialog、Morphing Popover；仓库说明基于 Motion 和 Tailwind，采用 MIT | 可研究画像切换、目标表单和资料面板的连续变化；只按具体需求选择，不为借鉴组件整体迁移现有 CSS |
| [Base UI](https://base-ui.com/) | 官网说明为无预设样式的 React 组件、可配普通 CSS、MIT 许可 | 若未来复杂菜单、对话框或选择器需要稳健键盘交互，可作为代码候选，继续保留米白深绿和文字导航 |

## 建议取舍

优先借鉴完整操作状态、少装饰的排版和有目的的局部过渡。当前知衡继续用米白、浅绿、深绿及文字导航；不因为目录收录某组件就默认它符合安的风格选择。

Motion Primitives 的文档索引也包含 Border Trail、Text Shimmer、Spotlight、Spinning Text 等效果。对当前聊天正文和画像主界面，我倾向不采用这些装饰：持续闪动或重复运动容易争夺阅读注意力，也不符合安已明确的减少模板感要求。这是针对本项目的设计判断，不是对组件质量的实测结论。

实现优先级建议：先按 UI Playbook 核对按钮和表单状态；再按需要研究 Transition Panel 与形变面板；组件代码按独立许可与依赖成本决定是否采用。已有动画兼容限制仍需专项验证，资源目录不能替代本项目验收。
