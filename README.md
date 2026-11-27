# Admin UI

内部系统统一管理入口。当前将 Permission、Gateway、Blog、AI Workbench 与 AI 视频创作作为原生业务模块集成到同一个 Vue 应用中，并通过 Permission 后端只完成一次 People OAuth 登录。

## 启动

先启动 People、Gateway、Permission 的后端服务，然后执行：

```bash
npm install
./start.sh
```

默认地址为 `http://10.251.237.216:5178`，People 登录地址为 `http://10.251.237.216:5177`。Permission API 代理到 `http://127.0.0.1:8081`，Gateway Admin API 代理到 `http://127.0.0.1:8083`，AI Workbench API 代理到 `http://127.0.0.1:8087`。

AI 视频创作入口为 `/ai-video/create`，任务集为 `/ai-video/task-sets`（原作品库链接会转到任务集），视频收藏为 `/ai-video/favorites`，图片素材库为 `/ai-video/assets`。在「预置虚拟人像」菜单（`/ai-video/portraits`）选中人像即可带入当前创作。请先按同级 `ai-video/README.md` 启动视频服务，默认代理目标为 `http://127.0.0.1:8091`，可通过 `VITE_AI_VIDEO_PROXY_TARGET` 覆盖。

所有启动配置都可以通过环境变量覆盖：

```bash
PEOPLE_LOGIN_ORIGIN=http://people.example.com:5177 \
ADMIN_UI_OAUTH_REDIRECT_URI=http://admin.example.com:5178/oauth/callback \
./start.sh
```

需要退出终端后继续运行时，安装用户级常驻服务：

```bash
./install-user-service.sh
```

常驻服务启动时使用该服务的 VITE_* 配置构建前端，提供压缩静态资源并代理 API。开发时仍可通过 ./start.sh 启用热更新。安装后 Admin UI 会随用户服务管理器自动启动，异常退出时自动重启。可使用 `systemctl --user status admin-ui` 和 `journalctl --user -u admin-ui` 查看状态与日志。

统一平台只通过 Permission OAuth 发起一次 People 登录。Gateway 与 AI Workbench 模块使用同一枚平台访问令牌，不会再次跳转登录；AI Workbench 独立工作台仍通过 People OAuth 登录，并与统一入口共享个人数据。

登录完成后首先进入“所有系统”卡片页。进入系统后左侧只展示当前系统的菜单，可通过侧栏的“所有系统”打开系统抽屉并切换到其他系统。

顶栏文档按钮通过 `VITE_DOCUMENT_BASE_URL` 加载文档中心的 `/inner?embedded=1`，集中展示所有系统的 Inner 内部接口；旧的 `/permission/docs` 地址会跳转到新的全局 `/docs` 页面。

## 验证

```bash
npm run typecheck
npm test
npm run build
```
