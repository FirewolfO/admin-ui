# Admin UI 开发约束

## 仓库定位

- 本仓库是内部系统统一管理入口，当前原生集成 Permission 与 Gateway 管理模块。
- 平台只通过 Permission 后端完成一次 People OAuth 登录；Gateway 模块复用同一平台令牌，不得再次触发登录。
- Permission 与 Gateway 的独立前端继续保留，本仓库不得要求它们才能构建或运行。

## 前端规范

- 使用 Vue 3、TypeScript、Vite、Vue Router、Pinia 和 Element Plus。
- 模块代码分别放在 `src/modules/permission` 与 `src/modules/gateway`，共享认证、布局和路由放在 `src/` 对应公共目录。
- Permission 与 Gateway API 必须使用独立客户端和环境变量配置，组件内不得硬编码后端地址。
- 页面权限提示只用于体验，最终鉴权由对应后端执行。
- 新增或修改功能后运行 `npm run typecheck`、`npm test` 和 `npm run build`。

## Git 工作流

- 本目录是独立 Git 仓库。验证完成后必须提交并推送当前分支，不得混入其他仓库文件。
