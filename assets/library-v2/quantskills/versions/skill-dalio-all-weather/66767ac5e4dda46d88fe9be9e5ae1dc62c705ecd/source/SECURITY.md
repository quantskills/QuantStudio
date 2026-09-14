# 安全说明

## 报告问题

安全问题请通过 GitHub Private Vulnerability Reporting 提交。不要在公开 Issue 中粘贴 PandaData 账号、令牌、请求内容、缓存行情或私人研究结果。凭证一旦泄露，请立即撤销或更换。

## 数据连接

真实数据只允许连接 PandaData 服务方提供的 HTTPS 地址。程序会拒绝 HTTP、重定向、URL 中的账号密码、查询参数和片段，并始终校验证书与主机名。

登录前运行：

```powershell
python scripts\cli.py health-check
```

健康检查会查看 Python 版本、SDK、DNS、TLS 证书和凭证配置，但不会打印凭证。

## 凭证和本地文件

凭证只从当前进程环境变量或用户目录下的 `~/.pandadata.env` 读取。运行时会关闭 SDK 对 `user.json` 的读写和自动登录，数据客户端只接收进程内令牌。令牌过期后，重新认证并启动命令。

仓库不分发 PandaData 安装包或市场数据。第三方许可和数据授权边界见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
