# @deepseek-ai/dsh-panda-mcp

[中文说明](README.zh.md)

Host client for the public PandaData MCP at `https://pandadatamcp.pandaaiquant.com/mcp`. QuantSkills does not implement catalog search or the Java gateway; it opens the remote OAuth login page, stores only MCP access/refresh tokens under `$DSH_HOME/quantskills/panda-mcp/`, and registers the remote tools on `ctx.tools` as `mcp__pandadata__*`.

Unauthenticated Sessions still work. `auth_status` never opens a browser. Other PandaData tools trigger OAuth on first use (`ON_INVOKE`) or from QuantSkills Settings → PandaData.
