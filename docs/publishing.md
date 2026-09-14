# 发布与镜像

正式应用仓库：

- https://github.com/quantskills/QuantStudio
- https://github.com/songshuquant/QuantStudio
- https://gitee.com/quantskills/QuantStudio

main、v2 和当前 vX.Y.Z 正式标签应指向相同提交。package.json 与 RELEASE.json 的版本必须一致，RELEASE.json 的 changes 用于首页更新说明。

发布前运行 check、test、test:update 和 ci:smoke。发布后执行 verify:update-mirrors 及两个来源的 verify:update-live。不得移动已发布的正式标签。

Gitee 可通过导入仓库提供的“同步”操作拉取。GitHub Actions 镜像是可选方式：在主仓库配置 GITEE_USERNAME、GITEE_TOKEN Secret，并设置仓库变量 GITEE_MIRROR_ENABLED=true 后启用。未配置时跳过自动镜像，不代表自动同步已开启。令牌仅放在平台 Secret 中。

历史仓库 quantskills-dsh-plugin 保留其原有提交；本项目不导入旧分支、旧标签或旧提交历史。兼容性包名与第三方许可继续保留。
