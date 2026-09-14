# 服务器上的 PandaData 授权

Windows、macOS 和 Linux 桌面继续通过本机浏览器授权。无桌面的服务器使用访问者的浏览器，无需安装 `xdg-open` 或桌面环境。

在运行应用的服务环境中设置 `QUANTSKILLS_PUBLIC_URL=https://你的域名`。仅允许不带路径、查询串和凭据的 HTTPS 来源。

应用临时监听 `127.0.0.1:3197` 接收授权回调。站点反向代理增加以下精确路由，将访问控制保持为与工作台一致：

```nginx
location = /api/quantskills/panda-oauth/callback {
    # 此处沿用站点本身的登录验证。
    proxy_pass http://127.0.0.1:3197/callback;
    proxy_set_header Host 127.0.0.1;
    access_log off;
}
```

3197 端口仅供本机反向代理访问，不对公网开放。需要修改端口时，通过 `panda-mcp` 配置的 `callbackPort` 字段调整，并同步代理上游端口。

用户点击“连接 PandaData”后，工作台跳到 PandaData 的官方授权页，完成后返回工作台。授权使用 PKCE 和一次性 state 验证；成功后仅服务器持有令牌。超时或失败不会退出应用，可重新授权。由模型发起连接时，用户可在 PandaData 控件中点击“继续 PandaData 授权”。

团队共享部署共用同一个 PandaData 连接、数据权限与额度。
