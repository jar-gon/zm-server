# zm-server

`zm-server` 是一个基于 NestJS 11 的后端服务，当前包含验证码、登录登出、用户管理、统一响应包装和 Swagger 接口文档。

## 技术栈

- NestJS 11 + TypeScript 6
- MongoDB + Mongoose 9
- JWT、express-session、cookie-parser
- Swagger UI (`@nestjs/swagger`)
- Jest 30、Supertest
- ESLint 10、Prettier 3

## 环境要求

- Node.js
- Yarn
- 本地 MongoDB：`mongodb://localhost:27017/zm-web`

MongoDB 地址硬编码在 `src/app.module.ts`，开发、生产和 e2e 测试都会连接这个地址。

## 快速开始

```bash
yarn install
yarn start:dev
```

开发服务默认监听 `3000` 端口，接口前缀为 `/api`，Swagger 地址为 `http://localhost:3000/api-docs`。

生产构建和启动：

```bash
yarn build
yarn start:prod
```

## 可用脚本

| 命令               | 说明                                                          |
| ------------------ | ------------------------------------------------------------- |
| `yarn start`       | 普通 Nest 启动                                                |
| `yarn start:dev`   | 开发 watch 启动，设置 `NODE_ENV=development`                  |
| `yarn start:debug` | debug watch 启动                                              |
| `yarn build`       | 构建到 `dist/`，并复制 `config/*.yaml`                        |
| `yarn start:prod`  | 设置 `NODE_ENV=production`，运行 `dist/main`                  |
| `yarn format`      | Prettier 格式化 `src/**/*.ts`、`test/**/*.ts` 和根目录 `*.md` |
| `yarn lint`        | ESLint 类型感知检查并自动修复                                 |
| `yarn test`        | 单元测试，匹配 `src/**/*.spec.ts`                             |
| `yarn test:watch`  | 单元测试 watch 模式                                           |
| `yarn test:cov`    | 单元测试覆盖率                                                |
| `yarn test:e2e`    | e2e 测试，需要本地 MongoDB                                    |

推荐验证顺序：`yarn lint` -> `yarn test`。只有在本地 MongoDB 可用且改动需要集成验证时运行 `yarn test:e2e`。

## 项目结构

```text
src/
  main.ts                 应用入口：全局前缀、session、cookie、管道、过滤器、拦截器、Swagger
  app.module.ts           根模块：配置、MongoDB、全局守卫、业务模块
  app.controller.ts       通用接口，目前提供验证码
  app.service.ts          验证码生成服务
  auth/                   登录、登出、JWT、内部 axios 测试接口
  user/                   用户创建、查询、更新、软删除
  schemas/                Mongoose Schema
  common/                 守卫、装饰器、拦截器、中间件、公共接口
  config/                 配置加载、Schema 公共配置、统一响应对象
  utils/                  bcrypt、日期、lodash 等工具
types/                    TypeScript 类型扩展，例如 express-session captcha
config/                   YAML 配置文件
test/                     e2e 测试
```

## 配置

- 公共配置：`config/config.yaml`
- 开发覆盖：`config/config.development.yaml`
- 生产覆盖：`config/config.production.yaml`
- 加载入口：`src/config/configuration.ts`

配置加载会将 `config/config.<NODE_ENV>.yaml` 深合并到 `config/config.yaml`。`ConfigModule` 设置了 `skipProcessEnv: true`，业务配置不会从系统环境变量注入。

关键默认值：

- API 前缀：`/api`
- Swagger 路径：`/api-docs`
- JWT 有效期：`1h`
- Session 名称：`zm.session`
- Cookie 域名：`.zmlearn.com`

## 接口概览

| 方法     | 路径                  | 说明                           | 认证                               |
| -------- | --------------------- | ------------------------------ | ---------------------------------- |
| `GET`    | `/api/common/captcha` | 获取验证码                     | 公开                               |
| `POST`   | `/api/auth/login`     | 登录                           | 公开                               |
| `POST`   | `/api/auth/logout`    | 登出                           | 需要 JWT                           |
| `POST`   | `/api/auth/testAxios` | 调用本服务验证码接口的测试接口 | 公开，要求服务已在 `3000` 端口运行 |
| `POST`   | `/api/user/create`    | 创建用户                       | 需要 JWT                           |
| `POST`   | `/api/user`           | 分页查询用户                   | `@Roles(['admin'])`                |
| `GET`    | `/api/user/:id`       | 用户详情                       | 需要 JWT                           |
| `PATCH`  | `/api/user/:id`       | 更新用户                       | 需要 JWT                           |
| `DELETE` | `/api/user/:id`       | 软删除用户                     | 需要 JWT                           |

## 运行约定

- `AuthGuard` 和 `RolesGuard` 通过 `APP_GUARD` 全局启用，公开接口必须加 `@Public()`。
- JWT 只从 `Authorization: Bearer <token>` 读取；登录接口同时写入 `accessToken` cookie，但守卫不读取 cookie。
- 普通 Controller 返回值会被 `Response` 拦截器包装为 `{ code, message, data }`。
- 使用 `@Res()` 的 Controller 会绕过普通返回流程，当前登录和登出接口手动发送 `CustomResponse`。
- Mongoose Schema 建议使用 `@Schema(GlobalSchema)` 并调用 `globalTimePlugin`，保持时间虚拟字段和 JSON 输出一致。
- 软删除通过 `isDeleted: true` 实现，常规查询需要过滤 `isDeleted: false`。
