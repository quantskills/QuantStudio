# QS Skill、Agent 与 Team 基准

所有功能与实验现在统一在开源 QS。`skillContextMode` 默认 `full`；`progressive` 是显式开启的实验，不承诺节省 Token。实验关闭时不添加实验路由、固定工作流或 Team 提示。

在独立测试 Profile 的 `quantskills-session` 配置中设置 `skillContextMode: progressive` 可尝试按需读取；设为 `full` 恢复完整加载。只修改这个字段，保留其他配置，不覆盖用户整个 Profile。单 Skill 或无法安全提供读取工具时回退完整内容；多 Skill/Agent/Team 仍必须遵守完整指令、固定执行顺序和调用限制。基准不会自动修改应用默认值或日常配置。

## 已有结果

最新 [2026-10-22 验收](../docs/dsh-upgrade/unification-20261022.md)：加入计算复核和准确委派约束后，真实 Team 六组、十个阶段全部通过，旧轮次为 4/6。新一轮 81 次请求、总 Token 1,139,139，比上一轮增加约 9.95%，不能宣称省 Token。新增费用上界 ¥8.3157147，累计 ¥92.7404848，未超过用户追加的 ¥15；旧账本和全部失败保留。[逐案例结果及预算变更](results/2026-10-22-team-verification/publication-manifest.json)。

四版本对照新题仍是此前实际运行的 31 组，20 组通过、11 组失败，另外 1 组预算拦截、16 组未执行。追加额度仅用于 Team 修复复测，没有补齐四版本对照；没有全面领先结论，默认保持 `full`。

2026-10-21 的原生 Host 基准共 144 次：12 种工作流、3 个账本变体、4 个版本。它们不是 36 个独立领域任务，也不能证明小时级任务或广泛质量提升。

| 版本 | 严格通过 / 36 | 输入 Token | 输出 Token | 模型调用 | 每个成功任务的 Token（含失败） |
| --- | ---: | ---: | ---: | ---: | ---: |
| 旧 QS | 30 | 1,895,457 | 25,090 | 113 | 64,018.23 |
| 当时的公开升级版 | 28 | 2,391,244 | 35,276 | 130 | 86,661.43 |
| 官方 DSH rc.2 | 33 | 1,385,247 | 20,852 | 136 | 42,609.06 |
| 当时的实验候选 | 29 | 1,995,700 | 27,131 | 150 | 69,752.79 |

**实验没有达到全面领先的门槛。** 单次输入缩短不代表整个任务节省；已有多 Skill 样本增加了一轮读取，总 Token 反而增加约 4.5%。实验候选也出现数值和结构输出错误。公开版一次 Team 续聊达到 32 次调用保护上限；尚不能据此认定死循环。

[逐案例结果与汇总](history/2026-10-21/summary.json)、[公开转换清单](history/2026-10-21/publication-manifest.json)、[原协议和测量源码](history/2026-10-21/source/benchmark/protocol.json) 保留冻结版本、失败和最终账本。历史 arm ID `qs-commercial` 只是原始实验标签，现在不代表另一个产品。

## 运行

先安装仓库固定依赖，再执行不调用模型的检查：

```sh
node --test benchmark/tests/*.test.mjs
node benchmark/run-suite.mjs
node benchmark/verify-history.mjs
node benchmark/verify-results.mjs
```

构建后还可执行 `node scripts/ci-team-verification.mjs`。它在独立原生 Host 中检查 Team 的准确成员指令读取、确定性计算、非法值处理和重启恢复；只使用本地模拟网关，并断言模型请求数为零。它验证工具接入，不证明真实模型会正确选择输入、遵守输出约束或减少 Token。

将 `config.example.json` 复制到仓库外，填写已安装的基线位置及全新空工作目录，通过 `QS_BENCH_CONFIG` 指向它。已有非空目录必须包含基准生成的所有权标记；不能使用用户原有 Home。旧 QS 固定到 `8312624`，官方 DSH 使用未应用 QS 补丁的 `0.2.1-rc.2`；两个新 QS 对照使用同一源码和构建，仅配置开关不同。

```sh
node benchmark/run-suite.mjs --mock --suite v2 --families single-skill --repetition 0 --arms qs-public --out transport-check
node benchmark/run-suite.mjs --run --suite team --home /path/to/existing/model-home --out team-acceptance
node benchmark/run-suite.mjs --run --suite v2 --home /path/to/existing/model-home --out comparison-v2
```

Mock 固定返回空 JSON，只验证 Host 传输，业务判定失败是预期，不能作为模型质量通过证据。真实模型入口会在内存读取现有 PandaAI `kimi-k3` 配置；不会以该 Home 启动 Host，也不会输出密钥。

已有测试必须保留账本中的历史累计费用和请求，不能重新从零记账。原阶段为累计 ¥100、额外最多 ¥25；随后用户明确授权 Team 复测追加最多 ¥15，累计上限调至 ¥120、保留 90% 安全线。追加从当时 ¥84.4247701 起算，实际更严格的上限为 ¥99.4247701，原 257 次请求全部保留。价格按公开费率上界估算，不是实际账单。未知用量保留预留并停止；取消后的迟到用量在网关关闭后重新核算。

官方 DSH 的测量 Profile 显式启用官方 `skill-filesystem` 与 `tool-skill`，并将构造 Skill 写入隔离工作区 `.dsh/skills`；二进制按冻结来源摘要核验，未修改官方源码。

预算触及上限后持久停止，后续较小请求也不会绕过停止状态；未执行项单列，不当成失败或通过。

追加真实模型费用需要另行获得明确授权。`amend-budget.mjs` 必须提供授权标识、当前账本 SHA-256、追加金额、累计上限和授权记录；它只接受全部已结算且未因未知用量停止的账本，在同一排他锁内保存原账本备份和追加历史。追加额度从授权时的累计费用计算，不释放旧阶段未花额度；修改配置本身不能解除停止。执行后按工具返回的完整策略更新本地配置，旧配置会被拒绝。公开导出保留金额、请求数量、前后策略及校验值，不导出自由文本授权记录。

输出及原生日志只写入指定工作目录，不自动上传。公开前使用字段白名单、路径脱敏、凭据检查和哈希核验；原始推理和用户会话不得进入报告。普通 CI 只执行离线测试，不配置模型密钥。

新题和验收流程见 [v2 协议](protocol-v2.json)。所有失败、超时和重试计入完整生命周期成本；未满足门槛或样本不足时维持 `full`，不会自动修改用户配置。

结果判定沿用冻结规则：允许一个 JSON 代码块，解析后的字段和值必须精确匹配；额外说明文字、缺失或额外字段均失败。不会从混合正文中提取正确片段来替换原始结果。

## 发布与分析

```sh
node benchmark/export-run.mjs --source /path/to/evidence --out /new/public-directory --reports team-run.json,comparison-run.json
node benchmark/analyze-run.mjs /new/public-directory/comparison-run.json /new/public-directory/summary.json
```

发布目录必须不存在。导出只保留合成题结果、用量与哈希，保留失败；原始 Home、推理日志和凭据不导出。每个成功任务的 Token 分子包含失败、重试、所有成员及收尾调用。配对分析只对共同执行的题目计算，缺失对照不构成优势；两个输入簇无法证明广泛质量不劣。
