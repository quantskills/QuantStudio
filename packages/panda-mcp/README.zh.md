# @deepseek-ai/dsh-panda-mcp

[English](README.md) | 中文

公网 PandaData MCP（`https://pandadatamcp.pandaaiquant.com/mcp`）的 Host 客户端。QuantSkills 不实现目录搜索或 Java 网关：打开远端 OAuth 登录页，只把 MCP access/refresh token 存到 `$DSH_HOME/quantskills/panda-mcp/`，并把远端工具以 `mcp__pandadata__*` 注册到 `ctx.tools`。

未登录时普通会话仍可用。`auth_status` 不会打开浏览器。其它 PandaData 工具在首次调用（`ON_INVOKE`）或 QuantSkills 设置 → PandaData 中触发登录。
