# V2 技能、专家与专家团快照

此目录保存 2026-09-14 本机已安装和创建的资产，与应用代码一起发布到 `main` 和 `v2`。

| 内容 | 数量 |
| --- | ---: |
| 技能（14 个已安装、1 个本地创建） | 15 |
| 专家模板源文件 | 3 |
| 专家定义（含系统创作助手） | 44 |
| 专家团定义 | 14 |
| 经过 SHA-256 校验的资产文件 | 391 |

`snapshot.json` 列出完整版本、名称、来源、文件大小和校验值。`quantskills/versions` 保留安装的原始版本；`quantskills/authored` 保留本地创建的原始版本。专家和专家团的技能绑定、成员分工、修订号及权限均按保存状态保留，专家团中冻结的历史成员版本也保留。

不包含模型密钥、PandaData 登录、用户设置、会话消息、真实行情缓存、研究任务输出或运行日志。资产自带的示例和测试数据属于源文件，保留在相应资产内。源文件中的许可证、作者和来源声明保持不变；各资产仍适用各自许可证。原有模型选择如果指向特定服务，恢复后需要自行配置该服务。

## 校验

在仓库根目录运行（Node.js 22 或更高）：

Windows 上建议将仓库克隆到较短路径（如 `C:/src/qs`），或克隆时使用 `git -c core.longpaths=true clone ...`。资产内容通过 `.gitattributes` 禁用换行转换，以保持校验值一致。

```sh
node scripts/library-snapshot.mjs verify assets/library-v2
```

## 恢复到新环境

先停止目标环境的 QuantSkills，指定一个尚无资产库的 DSH_HOME：

```sh
node scripts/library-snapshot.mjs restore assets/library-v2 /absolute/path/to/new-dsh-home
```

Windows 示例：

```powershell
node scripts/library-snapshot.mjs restore assets/library-v2 C:/QuantSkills/v2-home
$env:DSH_HOME = 'C:/QuantSkills/v2-home'
pnpm run web
```

使用仓库原有安装步骤安装依赖后，以同一个 DSH_HOME 启动应用。首次启动配置模型，随后即可在技能、专家和专家团栏目看到恢复的资产。工具仅向空资产库恢复，遇到已有资产会拒绝覆盖，避免损坏原有库；不会恢复会话或凭据。

## 专家团

- 沪深300多因子选股研究团
- 每日热点新闻与聪明钱画像 Team
- 沪深300多因子月度选股专家团
- A股投研全流程专家团
- 公司深度研究团
- 每日市场研究团
- 多因子选股团
- 量化策略研发团
- A股市场数据分析专家团
- 周报月报专家团
- 汇报材料专家团
- 会议跟进专家团
- 客户提案专家团
- 项目交付专家团

查看 `snapshot.json` 获取保存名称、精确 ID 和修订号。

新闻情绪技能保留本机的两处 UTF-8 读取修复；快照已更新其内容摘要及专家技能绑定，并在 manifest 的 `snapshotLocalModification` 中记录上游摘要。未改动运行中的本地资产库。
