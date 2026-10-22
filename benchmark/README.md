# QS Skill、Agent 与 Team 基准

所有功能与实验现在统一在开源 QS。`skillContextMode` 默认 `full`；`progressive` 是显式开启的实验，不承诺节省 Token。实验关闭时不添加实验路由、固定工作流或 Team 提示。

## 已有结果

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
```

将 `config.example.json` 复制到仓库外，填写已安装的基线位置及全新空工作目录，通过 `QS_BENCH_CONFIG` 指向它。已有非空目录必须包含基准生成的所有权标记；不能使用用户原有 Home。旧 QS 固定到 `8312624`，官方 DSH 使用未应用 QS 补丁的 `0.2.1-rc.2`；两个新 QS 对照使用同一源码和构建，仅配置开关不同。

```sh
node benchmark/run-suite.mjs --mock --suite v2 --families single-skill --repetition 0 --arms qs-public --out transport-check
node benchmark/run-suite.mjs --run --suite team --home /path/to/existing/model-home --out team-acceptance
node benchmark/run-suite.mjs --run --suite v2 --home /path/to/existing/model-home --out comparison-v2
```

Mock 固定返回空 JSON，只验证 Host 传输，业务判定失败是预期，不能作为模型质量通过证据。真实模型入口会在内存读取现有 PandaAI `kimi-k3` 配置；不会以该 Home 启动 Host，也不会输出密钥。

已有测试必须将历史累计费用写入 `budget.priorCny`，不能重新从零记账。本轮授权累计 ¥100，额外最多 ¥25，同时受 90% 安全线约束。价格按公开费率上界估算，不是实际账单。未知用量保留预留并停止；取消后的迟到用量在网关关闭后重新核算。

输出及原生日志只写入指定工作目录，不自动上传。公开前使用字段白名单、路径脱敏、凭据检查和哈希核验；原始推理和用户会话不得进入报告。普通 CI 只执行离线测试，不配置模型密钥。

新题和验收流程见 [v2 协议](protocol-v2.json)。所有失败、超时和重试计入完整生命周期成本；未满足门槛或样本不足时维持 `full`，不会自动修改用户配置。
