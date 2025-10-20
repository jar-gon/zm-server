import { existsSync, readFileSync } from 'fs';
import { load } from 'js-yaml';
import { join } from 'path';
import { _merge } from 'src/utils/lodash';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';

function validateJwtExpiry(secret: string, expiresIn: unknown) {
  try {
    const service = new JwtService({ secret });
    const token = service.sign({}, { expiresIn: expiresIn as JwtSignOptions['expiresIn'] });
    const payload = service.decode<{ iat: number; exp?: number }>(token);
    if (typeof payload.exp !== 'number' || !Number.isSafeInteger(payload.exp) || payload.exp <= payload.iat) {
      throw new Error('JWT 有效期不足 1 秒');
    }
  } catch {
    throw new Error('jwt.expiresIn 必须是至少 1 秒的有效时长（正整数秒数或如 "1h" 的字符串）');
  }
}

function readConfig(path: string): Record<string, unknown> {
  const config: unknown = load(readFileSync(path, 'utf8')) ?? {};
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`配置文件必须包含 YAML 对象：${path}`);
  }
  return config as Record<string, unknown>;
}

function validateConfig(config: Record<string, unknown>, environment: string) {
  const http = config.http as { port?: unknown; trustProxy?: unknown } | undefined;
  const port = http?.port;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('http.port 必须是 1 到 65535 之间的整数');
  }
  const trustProxy = http?.trustProxy;
  const isProxyAddress = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;
  if (
    trustProxy !== undefined &&
    typeof trustProxy !== 'boolean' &&
    !(typeof trustProxy === 'number' && Number.isSafeInteger(trustProxy) && trustProxy >= 0) &&
    !isProxyAddress(trustProxy) &&
    !(Array.isArray(trustProxy) && trustProxy.every(isProxyAddress))
  ) {
    throw new Error('http.trustProxy 必须是布尔值、非负整数、代理地址字符串或地址数组');
  }
  const database = config.database as { uri?: unknown } | undefined;
  if (typeof database?.uri !== 'string' || !/^mongodb(?:\+srv)?:\/\/\S+$/.test(database.uri)) {
    throw new Error('database.uri 必须是有效的 MongoDB 连接地址');
  }
  if (typeof config.API_PREFIX !== 'string') {
    throw new Error('API_PREFIX 必须是字符串');
  }
  for (const key of ['jwt', 'session']) {
    const secret = (config[key] as { secret?: unknown } | undefined)?.secret;
    if (typeof secret !== 'string' || !secret.trim()) {
      throw new Error(`${key}.secret 必须是非空字符串`);
    }
    if (environment === 'production' && secret.trim().length < 32) {
      throw new Error(`生产环境必须在 config.production.yaml 中配置至少 32 位的 ${key}.secret`);
    }
  }
  const jwt = config.jwt as { secret: string; expiresIn?: unknown };
  validateJwtExpiry(jwt.secret, jwt.expiresIn);
  const session = config.session as {
    secret: string;
    name?: unknown;
    resave?: unknown;
    saveUninitialized?: unknown;
    rolling?: unknown;
  };
  if (environment === 'production' && jwt.secret === session.secret) {
    throw new Error('生产环境 jwt.secret 与 session.secret 必须使用独立密钥');
  }
  if (
    session.name !== undefined &&
    (typeof session.name !== 'string' ||
      !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(session.name) ||
      session.name === 'accessToken')
  ) {
    throw new Error('session.name 必须是有效的 Cookie 名称，且不能与 accessToken 重名');
  }
  if (config.sessionStore !== undefined && !['memory', 'mongo'].includes(config.sessionStore as string)) {
    throw new Error('sessionStore 仅支持 memory 或 mongo');
  }
  if (environment === 'production' && config.sessionStore !== 'mongo') {
    throw new Error('生产环境 sessionStore 必须配置为 mongo');
  }
  for (const key of ['resave', 'saveUninitialized', 'rolling'] as const) {
    if (session[key] !== undefined && typeof session[key] !== 'boolean') {
      throw new Error(`session.${key} 必须是布尔值`);
    }
  }
  const captcha = config.captcha as { ttlMs?: unknown; size?: unknown } | undefined;
  if (
    typeof captcha?.ttlMs !== 'number' ||
    !Number.isSafeInteger(captcha.ttlMs) ||
    captcha.ttlMs <= 0 ||
    Number.isNaN(new Date(Date.now() + captcha.ttlMs).getTime())
  ) {
    throw new Error('captcha.ttlMs 必须是正整数（毫秒）');
  }
  if (typeof captcha.size !== 'number' || !Number.isInteger(captcha.size) || captcha.size < 1 || captcha.size > 128) {
    throw new Error('captcha.size 必须是 1 到 128 之间的整数');
  }
  const cookie = config.cookie as Record<string, unknown> | undefined;
  if (!cookie || typeof cookie !== 'object' || Array.isArray(cookie)) {
    throw new Error('cookie 必须是配置对象');
  }
  if (cookie?.secure !== undefined && typeof cookie.secure !== 'boolean') {
    throw new Error('cookie.secure 必须是布尔值');
  }
  if (cookie?.httpOnly !== undefined && typeof cookie.httpOnly !== 'boolean') {
    throw new Error('cookie.httpOnly 必须是布尔值');
  }
  if (
    cookie?.maxAge !== undefined &&
    cookie.maxAge !== null &&
    (typeof cookie.maxAge !== 'number' ||
      !Number.isSafeInteger(cookie.maxAge) ||
      cookie.maxAge <= 0 ||
      Number.isNaN(new Date(Date.now() + cookie.maxAge).getTime()))
  ) {
    throw new Error('cookie.maxAge 必须是正整数（毫秒）或 null');
  }
  const sameSite = typeof cookie.sameSite === 'string' ? cookie.sameSite.toLowerCase() : cookie.sameSite;
  if (
    sameSite !== undefined &&
    typeof sameSite !== 'boolean' &&
    !['lax', 'strict', 'none'].includes(sameSite as string)
  ) {
    throw new Error('cookie.sameSite 必须是布尔值或 lax、strict、none');
  }
  if (sameSite === 'none' && cookie.secure !== true) {
    throw new Error('cookie.sameSite 为 none 时必须启用 cookie.secure，否则浏览器会拒绝 Cookie');
  }
  if (cookie.signed !== undefined && cookie.signed !== false) {
    throw new Error('cookie.signed 仅支持 false，accessToken 使用 JWT 签名校验');
  }
  if (
    cookie.domain !== undefined &&
    cookie.domain !== null &&
    cookie.domain !== '' &&
    (typeof cookie.domain !== 'string' ||
      !/^\.?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(cookie.domain))
  ) {
    throw new Error('cookie.domain 必须是域名、空字符串或 null，不能包含协议、端口或路径');
  }
  if (cookie.path !== undefined) {
    if (typeof cookie.path !== 'string' || !/^\/[\u0020-\u003A\u003D-\u007E]*$/.test(cookie.path)) {
      throw new Error('cookie.path 必须是以 / 开头的有效路径');
    }
    const prefix = config.API_PREFIX.replace(/^\/+|\/+$/g, '');
    const routes = ['common/captcha', 'auth/login', 'auth/logout'].map(
      route => `/${prefix ? `${prefix}/` : ''}${route}`
    );
    const path = cookie.path;
    if (!routes.every(route => route.startsWith(path) && (path.endsWith('/') || route[path.length] === '/'))) {
      throw new Error('cookie.path 必须同时覆盖验证码、登录和登出接口');
    }
  }
  const swagger = config.swagger as { title?: unknown; path?: unknown } | undefined;
  for (const key of ['title', 'path'] as const) {
    if (typeof swagger?.[key] !== 'string' || !swagger[key].trim()) {
      throw new Error(`swagger.${key} 必须是非空字符串`);
    }
  }
}

export default () => {
  // 构建产物使用 dist/config 内复制的 YAML，源码运行时使用项目根目录的 config。
  const directory = existsSync(join(__dirname, 'config.yaml')) ? __dirname : join(__dirname, '../../config');
  const environment = process.env.NODE_ENV || 'development';
  if (!/^[\w-]+$/.test(environment)) {
    throw new Error('NODE_ENV 包含无效字符');
  }
  const environmentPath = join(directory, `config.${environment}.yaml`);
  const config: Record<string, unknown> = _merge(
    {},
    readConfig(join(directory, 'config.yaml')),
    existsSync(environmentPath) ? readConfig(environmentPath) : {}
  );
  validateConfig(config, environment);
  return config;
};
