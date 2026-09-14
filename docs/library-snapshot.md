# 能力库快照 / Portable library

发布快照位于 assets/library-v2，包含 15 个技能、44 个专家定义和 14 个专家团。它是显式可选导入，不会由应用更新自动恢复。

先校验：

~~~sh
node scripts/library-snapshot.mjs verify assets/library-v2
~~~

关闭目标应用后，将 EMPTY_DSH_HOME 替换为目标 DSH Home 的绝对路径：

~~~sh
node scripts/library-snapshot.mjs restore assets/library-v2 EMPTY_DSH_HOME
~~~

目标能力库必须为空；已有技能、专家或团队时命令拒绝覆盖。保留已有能力的用户可以在应用内单独选择、创建或安装需要的能力。不要删除个人能力库来绕过此检查。

The snapshot is optional. Verify it, stop the target app, and restore only into an empty capability library. The command refuses to overwrite an existing library. No session history, credentials or database cache is included.
