# zm-server

基于 NestJS 的后台服务，提供验证码、JWT 登录、管理员用户管理、统一响应和 Swagger 文档。

## 技术栈与环境

- Node.js 24.15+（24.x）或 26+，Yarn 1.22.22。
- NestJS 12、Mongoose 9、MongoDB、JWT、express-session、connect-mongo。
- TypeScript 7 用于类型检查；Nest CLI、ts-jest、ESLint 使用 TypeScript 6 的编译器 API 兼容包。
- Jest 30、Supertest、ESLint 10、Prettier 3。
- 测试脚本启用 `--experimental-vm-modules`，用于加载 NestJS 12 的 ESM 包；Node 的实验性提示属于预期行为。

TypeScript 的双版本别名配置遵循[官方兼容方案](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)，不要直接把 `typescript` 别名替换成 7.x，否则构建、测试和 lint 会失效。NestJS 12 的运行与测试要求见[迁移文档](https://docs.nestjs.com/migration-guide)。

`resolutions` 仅将 Jest 覆盖率配置加载器的 `js-yaml` 定向到 4.3.x，保留其使用的 `load()` API，并移除旧版 `argparse` 引入且尚无修复版本的 `sprintf-js`。业务配置仍使用直接依赖的 js-yaml 5。更新锁文件后可运行 `yarn audit` 检查生产和开发依赖。

## 安装与运行

```bash
yarn install --frozen-lockfile
yarn start:dev
```

先启动 MongoDB，默认地址为 `mongodb://127.0.0.1:27017/zm-web`。服务默认监听 3000，接口前缀为 `/api`，文档地址为 `http://localhost:3000/api-docs`。

```bash
yarn build
yarn start:prod
```

生产运行前，需要在部署环境的 `config/config.production.yaml` 中配置两个独立的随机密钥：`jwt.secret` 和 `session.secret`，每个至少 32 位。构建会将 YAML 复制到 `dist/config`；只部署 `dist` 时需连同生产依赖一起部署，并修改该目录内的配置。缺少密钥时启动会明确报错，真实密钥不要提交到仓库。

生产 session 存入 MongoDB，复用已有数据库连接；开发和测试使用内存 session。生产 cookie 默认 `secure: true`、`httpOnly: true`、`sameSite: lax`，需使用 HTTPS。若由代理终止 TLS，按实际可信代理配置 `http.trustProxy`，例如仅同机代理使用 `loopback`。

## 首个管理员

用户管理接口均要求管理员权限，初始数据库需要通过本地命令创建首个管理员：

1. 配置并启动目标 MongoDB，执行 `yarn build`。
2. 通过标准输入向 `yarn admin:create <账号>` 传入密码，避免密码出现在命令参数中。
3. 生产初始化需同时设置 `NODE_ENV=production`。

PowerShell 7 示例（交互输入隐藏密码）：

```powershell
$adminCredential = Get-Credential -UserName admin -Message '创建管理员'
$adminCredential.GetNetworkCredential().Password | yarn admin:create $adminCredential.UserName
Remove-Variable adminCredential
```

此命令写入 bcrypt 密码，仅创建新账号；账号已存在时返回错误，不覆盖或提升已有用户。密码最长 72 个 UTF-8 字节。

## 脚本

| 命令                                | 说明                                                        |
| ----------------------------------- | ----------------------------------------------------------- |
| `yarn start`                        | 普通启动，默认加载开发配置                                  |
| `yarn start:dev`                    | 开发 watch 模式                                             |
| `yarn start:debug`                  | 调试 watch 模式                                             |
| `yarn build`                        | 构建代码及 YAML 到 `dist`                                   |
| `yarn start:prod`                   | 使用生产配置运行构建产物                                    |
| `yarn admin:create <账号>`          | 从标准输入读取密码，创建管理员，需先构建                    |
| `yarn format`                       | 格式化源码、测试和根目录 Markdown                           |
| `yarn lint`                         | 类型感知 ESLint 检查并自动修复                              |
| `yarn typecheck`                    | TypeScript 7 检查源码和测试，不生成文件                     |
| `yarn test`                         | 单元测试                                                    |
| `yarn test:watch` / `yarn test:cov` | 监听测试 / 单元测试覆盖率                                   |
| `yarn test:debug`                   | 使用 Node inspector 调试 Jest                               |
| `yarn test:e2e`                     | HTTP 集成测试，真实模块与中间件，替换持久化层，无需 MongoDB |

`yarn test:db` 连接本机 MongoDB，创建随机命名的独立测试库，验证真实用户读写、软删除、bcrypt 登录和 MongoDB session，结束后删除该测试库。可用 `MONGODB_TEST_URI` 指定测试服务器；始终使用随机测试库，不使用 URI 中的业务库名。

`yarn test:e2e` 同时验证 NYC 的 YAML 覆盖率配置加载与继承，检查定向依赖更新后的兼容性，并拒绝 YAML 中的 JavaScript 可执行标签。

先 review 变更并修复问题，再格式化和验证。按改动范围选择检查；运行构建验证后删除 `dist`。`yarn test:e2e` 不连接数据库，数据库集成验证单独使用 `yarn test:db`。

## 目录结构

```text
src/
  main.ts                 启动与 Swagger
  app.module.ts           配置、MongoDB、全局守卫及业务模块
  cli/create-admin.ts     本地管理员初始化命令
  auth/                   登录、登出、内部 HTTP 诊断
  user/                   管理员用户管理与 DTO
  schemas/                Mongoose Schema
  common/                 守卫、装饰器、管道、过滤器和拦截器
  config/                 YAML 加载、共享应用配置、响应与序列化
  utils/                  bcrypt、日期、正则等工具
config/                   公共、开发、测试和生产 YAML
types/                    express-session 类型扩展
test/                     HTTP 集成测试
```

## 配置与接口约定

`config/config.yaml` 与 `config/config.<NODE_ENV>.yaml` 深合并，未设置 `NODE_ENV` 时使用开发配置。`ConfigService` 不从环境变量读取业务配置；端口、数据库、Cookie、JWT 等统一在 YAML 配置。`NODE_ENV` 只用于选择文件。

| 方法                 | 路径                  | 权限与功能                                           |
| -------------------- | --------------------- | ---------------------------------------------------- |
| GET                  | `/api/common/captcha` | 公开；返回 SVG，写入 session，默认 5 分钟有效        |
| POST                 | `/api/auth/login`     | 公开；校验账号、密码与验证码，返回 JWT 并写 cookie   |
| POST                 | `/api/auth/logout`    | 公开；销毁 session 并清除 Cookie，令牌过期后仍可登出 |
| POST                 | `/api/auth/testAxios` | 管理员；调用当前服务的验证码接口，5 秒超时           |
| POST                 | `/api/user/create`    | 管理员；创建普通用户                                 |
| POST                 | `/api/user`           | 管理员；分页查询，页码为正整数，每页最多 100 条      |
| GET / PATCH / DELETE | `/api/user/:id`       | 管理员；详情、修改账号、软删除                       |

- 鉴权优先读取 `Authorization: Bearer <token>`，无此请求头时读取 `accessToken` cookie；无效请求头不会回退到 cookie。
- 每次鉴权读取当前用户状态和角色，删除用户或变更角色立即生效。登出不撤销已复制的 Bearer token，客户端应丢弃令牌；令牌默认 1 小时过期。
- 验证码在登录尝试时消费，失败后需重新获取；浏览器需携带获取验证码时的 session cookie。
- 验证码消费按独立随机 ID 去重，并发登录只能消费一次。MongoDB session 模式使用 `captcha_uses` 集合的唯一键与 TTL 索引，支持多个服务实例；开发内存模式定期清理已过期记录。升级后原有验证码需重新获取。
- 验证码长度遵循 `captcha.size`（1～128），有效期 `captcha.ttlMs` 使用正整数毫秒。登录成功会更换 session ID；登录和登出响应禁止缓存。
- 启动时校验数据库地址、密钥、session 存储及常用 Cookie 配置。生产环境强制使用 MongoDB session，JWT 与 session 密钥不能相同。
- `jwt.expiresIn` 必须是有效时长且至少 1 秒：数字表示秒，字符串建议使用带单位的值（如 `1h`）。无效或缺失的有效期在启动时拒绝。
- `cookie.sameSite: none` 必须同时设置 `secure: true`；`cookie.path` 必须覆盖验证码、登录和登出接口（默认 `/`，也可使用 `/api/`）。`cookie.domain` 只填写域名，不包含协议或端口；不启用 `cookie.signed`，JWT 自带签名校验。
- `session.name` 不能与 `accessToken` 重名；`http.trustProxy` 支持布尔值、非负整数、代理地址字符串或地址数组，应按实际可信代理配置。
- DTO 拒绝未声明字段，更新仅允许 `account`，拒绝 `role`、`password`、`isDeleted` 等字段。
- 正常返回和 HTTP 异常统一为 `{ code, message, data }`。重复账号返回 409；无权限返回 403。
- 返回用户时隐藏原始 `_id`、密码、软删除标识和原始时间；保留 `id`、`createdTime`、`updatedTime`。
- 软删除账号仍占用唯一账号名，不可重复注册。
