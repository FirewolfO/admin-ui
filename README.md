# Admin UI

内部系统统一管理入口。当前将 Permission 与 Gateway 作为原生业务模块集成到同一个 Vue 应用中，并通过 Permission 后端只完成一次 People OAuth 登录。

## 启动

先启动 People、Gateway、Permission 的后端服务，然后执行：

```bash
npm install
./start.sh
```

默认地址为 `http://10.251.237.216:5178`，People 登录地址为 `http://10.251.237.216:5177`。Permission API 代理到 `http://127.0.0.1:8081`，Gateway Admin API 代理到 `http://127.0.0.1:8083`。

所有启动配置都可以通过环境变量覆盖：

```bash
PEOPLE_LOGIN_ORIGIN=http://people.example.com:5177 \
ADMIN_UI_OAUTH_REDIRECT_URI=http://admin.example.com:5178/oauth/callback \
./start.sh
```

统一平台只通过 Permission OAuth 发起一次 People 登录。Gateway 模块使用同一枚平台访问令牌，不会再次跳转登录；独立的 Permission UI 和 Gateway UI 仍保留各自登录入口。

登录完成后首先进入“所有系统”卡片页。进入系统后左侧只展示当前系统的菜单，可通过侧栏的“所有系统”打开系统抽屉并切换到其他系统。

顶栏文档按钮通过 `VITE_DOCUMENT_BASE_URL` 加载文档中心的 `/inner?embedded=1`，集中展示所有系统的 Inner 内部接口；旧的 `/permission/docs` 地址会跳转到新的全局 `/docs` 页面。

## 验证

```bash
npm run typecheck
npm test
npm run build
```
