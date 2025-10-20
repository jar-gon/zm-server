# AGENTS.md

## Project Shape

- Single-package NestJS 11 backend. Real entrypoints are `src/main.ts` and `src/app.module.ts`.
- Use `yarn`; keep `yarn.lock` authoritative and do not use npm for installs.
- Code imports use `src/...` aliases. Jest and e2e Jest configs both map `^src/(.*)$`; update both if paths change.

## Required Services & Config

- MongoDB is hardcoded in `src/app.module.ts` as `mongodb://localhost:27017/zm-web`; dev, prod, and e2e all need that local service.
- `src/config/configuration.ts` loads `config/config.yaml` and deep-merges `config/config.<NODE_ENV>.yaml` over it.
- `ConfigModule.forRoot({ skipProcessEnv: true })` means business config is not read from process env. Add environment-specific overrides in `config/config.development.yaml` or `config/config.production.yaml`.
- `nest-cli.json` copies `config/*.yaml` into `dist/config`; do not move config files without updating that asset rule.

## Commands

- Install: `yarn install`
- Dev watch: `yarn start:dev` (sets `NODE_ENV=development`)
- Build: `yarn build`
- Prod start: `yarn start:prod` (sets `NODE_ENV=production`, runs `dist/main`)
- Format: `yarn format` (`src/**/*.ts`, `test/**/*.ts`, and root `*.md`)
- Lint: `yarn lint` (runs ESLint with `--fix` and type-aware rules)
- Unit tests: `yarn test` (Jest `rootDir` is `src`, matches `*.spec.ts`)
- E2e tests: `yarn test:e2e` (loads real `AppModule`; needs MongoDB)
- Preferred verification order: `yarn lint` then `yarn test`; run e2e only when MongoDB is available or the change needs it.

## Runtime Wiring

- `src/main.ts` sets global prefix from `API_PREFIX` (`api` in `config/config.yaml`) and Swagger from `swagger.path` (`/api-docs`).
- Global `ValidationPipe({ transform: true, stopAtFirstError: true })` is enabled, so DTO payloads are transformed and only the first validation error is reported.
- `HttpFilter` formats `HttpException` responses as `{ code, message, data }`.
- `Response` interceptor wraps normal controller returns as `CustomResponse { code, message, data }`; controllers should usually return raw data.
- Controllers using `@Res()` bypass the normal Nest response flow; existing auth login/logout send `CustomResponse` manually.

## Auth & Guards

- `AuthGuard` and `RolesGuard` are global `APP_GUARD`s in `AppModule`; every endpoint needs auth unless decorated with `@Public()`.
- JWT is read only from `Authorization: Bearer <token>`. Login also writes an `accessToken` cookie, but `AuthGuard` does not read cookies.
- Decoded JWT payload is attached to `request.user`.
- `RolesGuard` currently checks route metadata only and allows when no roles are set or the declared roles include `'admin'`; it does not compare against `request.user.role`.

## Data Conventions

- Mongoose schemas should follow `src/schemas/user.schema.ts`: `@Schema(GlobalSchema)` plus `globalTimePlugin(Schema)`.
- `GlobalSchema` enables timestamps, disables `versionKey`, removes `_id` in JSON, and keeps virtual `id`.
- `globalTimePlugin` hides `createdAt`/`updatedAt` by default and exposes formatted `createdTime`/`updatedTime` virtuals.
- Sensitive fields use `select: false` and must be explicitly selected when needed, e.g. `.select('+password')`.
- Soft delete is implemented with `isDeleted: true`; normal queries filter `isDeleted: false` instead of deleting documents.

## Tooling Notes

- TypeScript uses `module`/`moduleResolution: nodenext`, `target: ES2023`, `strictNullChecks: true`, `strictPropertyInitialization: false`, and `noImplicitAny: false`.
- ESLint ignores `eslint.config.mjs` and `dist/**`; `no-explicit-any` is off, while `no-floating-promises` and `no-unsafe-argument` are warnings.
- Prettier uses single quotes, `printWidth: 120`, `arrowParens: avoid`, and trailing commas where valid in ES5.
- `types/express-session.d.ts` adds `session.captcha`; keep it when touching the captcha login flow.
- `AuthService.testAxios()` calls `http://localhost:3000/api/common/captcha`; it only works while the server is already running.
