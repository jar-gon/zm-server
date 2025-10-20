# AGENTS.md

## Project Shape

- Single-package NestJS 12 backend. Real entrypoints are `src/main.ts` and `src/app.module.ts`.
- Use Node.js 24.15+ on the 24.x line or Node.js 26+. Jest needs native ESM interop for Nest 12.
- All Jest scripts enable `--experimental-vm-modules` for Nest 12 ESM packages; keep it in new test scripts.
- TypeScript 7 is installed as `@typescript/native` for `yarn typecheck`; `typescript` aliases `@typescript/typescript6` for the Nest CLI, ts-jest, and ESLint compiler API.
- Use `yarn`; keep `yarn.lock` authoritative and do not use npm for installs.
- Code imports use `src/...` aliases. Jest and e2e Jest configs both map `^src/(.*)$`; update both if paths change.

## Required Services & Config

- MongoDB is configured through `database.uri` in YAML (default `mongodb://127.0.0.1:27017/zm-web`).
- `src/config/configuration.ts` loads `config/config.yaml` and deep-merges `config/config.<NODE_ENV>.yaml` over it.
- `ConfigModule.forRoot({ skipProcessEnv: true })` means business config is not read from process env. Add environment-specific overrides in `config/config.development.yaml` or `config/config.production.yaml`.
- `nest-cli.json` copies `config/*.yaml` into `dist/config`; do not move config files without updating that asset rule.
- Compiled configuration loads YAML from `dist/config`; source execution falls back to the root `config` directory.
- Production requires independent JWT/session secrets of at least 32 characters in `config.production.yaml` and stores sessions in MongoDB using the existing Mongoose connection. Never commit real secrets.
- Development and isolated tests use memory sessions. Cookie options apply to both session and access-token cookies. Configure `http.trustProxy` only for the trusted deployment proxy.

## Commands

- Install: `yarn install`
- Dev watch: `yarn start:dev` (sets `NODE_ENV=development`)
- Build: `yarn build`
- Prod start: `yarn start:prod` (sets `NODE_ENV=production`, runs `dist/main`)
- Format: `yarn format` (`src/**/*.ts`, `test/**/*.ts`, and root `*.md`)
- Lint: `yarn lint` (runs ESLint with `--fix` and type-aware rules)
- Type check: `yarn typecheck` (TypeScript 7; source and tests, no output)
- Unit tests: `yarn test` (Jest `rootDir` is `src`, matches `*.spec.ts`)
- HTTP integration tests: `yarn test:e2e` (real `AppModule` and middleware, isolated persistence; does not require MongoDB or verify real database writes)
- Database integration: `yarn test:db` uses local MongoDB (or `MONGODB_TEST_URI`) with a disposable random database and cleanup; never point test writes at an existing business database.
- Initial admin: after building, pipe the password to `yarn admin:create <account>`. It only creates new accounts and never promotes or overwrites existing users.
- Review task changes before formatting and verification. Prefer focused checks; run broader lint, type checks, tests, and builds when their scope warrants it. Remove generated `dist` after build verification.

## Runtime Wiring

- `src/main.ts` sets global prefix from `API_PREFIX` (`api` in `config/config.yaml`) and Swagger from `swagger.path` (`/api-docs`).
- `src/config/setup-app.ts` shares middleware setup between runtime and integration tests. The global validation pipe transforms DTOs, rejects undeclared fields, and stops after the first error per property.
- `HttpFilter` formats `HttpException` responses as `{ code, message, data }`.
- `Response` interceptor wraps normal controller returns as `CustomResponse { code, message, data }`; controllers should usually return raw data.
- Controllers using `@Res()` bypass the normal Nest response flow; existing auth login/logout send `CustomResponse` manually.

## Auth & Guards

- `AuthGuard` and `RolesGuard` are global `APP_GUARD`s in `AppModule`; every endpoint needs auth unless decorated with `@Public()`.
- JWT is read from `Authorization: Bearer <token>` or, when that header is absent, the `accessToken` cookie.
- `AuthGuard` loads the active user for each authenticated request and attaches the current account and role to `request.user`. Deleted users are rejected immediately.
- `RolesGuard` reads method and class metadata and compares required roles to the current user role. All user management routes require admin access.
- Captchas expire after `captcha.ttlMs` and are consumed on login attempts. Logout destroys the session and clears both cookies; copied bearer tokens remain valid until expiration or user deactivation.

## Data Conventions

- Mongoose schemas should follow `src/schemas/user.schema.ts`: `@Schema(GlobalSchema)` plus `globalTimePlugin(Schema)`.
- `GlobalSchema` enables timestamps, disables `versionKey`, removes `_id` in JSON, and keeps virtual `id`.
- `globalTimePlugin` exposes formatted `createdTime`/`updatedTime` virtuals. Raw timestamps are selected for virtuals and omitted from JSON, along with password and soft-delete fields.
- Sensitive fields use `select: false` and must be explicitly selected when needed, e.g. `.select('+password')`.
- Soft delete is implemented with `isDeleted: true`; normal queries filter `isDeleted: false` instead of deleting documents.

## Tooling Notes

- TypeScript uses `module`/`moduleResolution: nodenext`, `target: ES2023`, `strictNullChecks: true`, `strictPropertyInitialization: false`, and `noImplicitAny: false`.
- ESLint ignores `eslint.config.mjs` and `dist/**`; `no-explicit-any` is off, while `no-floating-promises` and `no-unsafe-argument` are warnings.
- Prettier uses single quotes, `printWidth: 120`, `arrowParens: avoid`, and trailing commas where valid in ES5.
- `types/express-session.d.ts` adds `session.captcha`; keep it when touching the captcha login flow.
- `AuthService.testAxios()` calls the running service on loopback using configured port/prefix, with a timeout. Its endpoint requires admin access.
