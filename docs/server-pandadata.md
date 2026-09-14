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

## 授权完成后首页显示 forbidden

浏览器从 PandaData 返回首页时会携带 `Sec-Fetch-Site: cross-site` 和 `Sec-Fetch-Mode: navigate`。如果代理已经验证站点登录、请求来源，却将这个头原样传给仅接受本机请求的应用，应用会拒绝正常的页面跳转。授权连接可能已经成功，浏览器仍显示 `forbidden`。

使用站点登录网关的 Nginx 部署可在 `http` 层增加以下映射。只对 GET/HEAD 文档跳转转换内部请求头，跨站 POST 和后台请求继续拒绝：

```nginx
map "$http_sec_fetch_site:$request_method:$http_sec_fetch_mode" $qs_bad_fetch {
    default 0;
    ~^cross-site:(GET|HEAD):navigate$ 0;
    ~^cross-site: 1;
}
map "$request_method:$http_sec_fetch_site:$http_sec_fetch_mode" $qs_upstream_fetch_site {
    default $http_sec_fetch_site;
    ~^(GET|HEAD):cross-site:navigate$ same-origin;
}
```

在 HTTPS `server` 中保留已有的 Host、Origin 和登录验证，增加 `if ($qs_bad_fetch) { return 403; }`。在转发到 `127.0.0.1:3198` 的应用 `location` 内增加：

```nginx
proxy_set_header Sec-Fetch-Site $qs_upstream_fetch_site;
```

这项转换仅用于已经由代理完成访问控制的回环转发；应用仍只监听本机。OAuth 回调仍校验随机 state 和 PKCE。执行 `nginx -t` 后重新加载 Nginx 即可生效，无需重启应用或中断运行中的任务。

验证时应覆盖：站点登录、外部授权回跳、刷新后连接状态，以及跨站 POST/fetch 仍被拒绝。不要在访问日志中记录 OAuth 查询参数或令牌。
