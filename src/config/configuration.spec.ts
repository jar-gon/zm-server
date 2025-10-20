import { existsSync, readFileSync } from 'fs';
import configuration from './configuration';
import { join } from 'path';

jest.mock('fs', () => ({ existsSync: jest.fn(), readFileSync: jest.fn() }));

describe('YAML configuration', () => {
  const environment = process.env.NODE_ENV;
  const baseConfig = `
http:
  port: 3000
database:
  uri: 'mongodb://127.0.0.1:27017/zm-web'
API_PREFIX: api
session:
  secret: development-only-session-secret-change-in-production
jwt:
  secret: development-only-jwt-secret-change-in-production
  expiresIn: 1h
cookie:
  secure: true
  maxAge: 1000
captcha:
  ttlMs: 300000
  size: 4
swagger:
  title: test API
  path: /api-docs
`;

  const setOverride = (yaml: string) =>
    jest.mocked(readFileSync).mockImplementation(path => (String(path).endsWith('config.yaml') ? baseConfig : yaml));

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    jest.mocked(existsSync).mockReturnValue(true);
    setOverride('cookie:\n  secure: false\n');
  });

  afterEach(() => {
    if (environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = environment;
  });

  it('merges nested overrides and loads YAML next to the compiled configuration', () => {
    expect(configuration()).toMatchObject({ http: { port: 3000 }, cookie: { secure: false, maxAge: 1000 } });
    expect(jest.mocked(readFileSync).mock.calls[0][0]).toBe(join(__dirname, 'config.yaml'));
  });

  it('does not retain mutations from a previous load', () => {
    const config = configuration();
    (config.cookie as { maxAge: number }).maxAge = 20;
    expect(configuration()).toMatchObject({ cookie: { maxAge: 1000 } });
  });

  it('fails early on invalid HTTP ports', () => {
    jest.mocked(readFileSync).mockReturnValue('http:\n  port: -1\n');
    expect(configuration).toThrow('http.port');
  });

  it('rejects non-object YAML', () => {
    jest.mocked(readFileSync).mockReturnValue('- invalid');
    expect(configuration).toThrow('YAML 对象');
  });

  it('requires explicit production secrets', () => {
    process.env.NODE_ENV = 'production';
    setOverride('jwt:\n  secret: null\n');
    expect(configuration).toThrow('jwt.secret');
  });

  it.each([
    ['database:\n  uri: null', 'database.uri'],
    ['API_PREFIX: 123', 'API_PREFIX'],
    ['session:\n  secret: ""', 'session.secret'],
    ['captcha:\n  ttlMs: "300000"', 'captcha.ttlMs'],
    ['captcha:\n  ttlMs: 0', 'captcha.ttlMs'],
    ['captcha:\n  ttlMs: 9007199254740991', 'captcha.ttlMs'],
    ['captcha:\n  size: 0', 'captcha.size'],
    ['captcha:\n  size: 129', 'captcha.size'],
    ['cookie: null', 'cookie'],
    ['cookie: false', 'cookie'],
    ['cookie:\n  maxAge: "1000"', 'cookie.maxAge'],
    ['cookie:\n  secure: "false"', 'cookie.secure'],
    ['cookie:\n  secure: auto', 'cookie.secure'],
    ['cookie:\n  httpOnly: "true"', 'cookie.httpOnly'],
    ['session:\n  resave: "false"', 'session.resave'],
    ['sessionStore: mongodb', 'sessionStore'],
    ['jwt:\n  expiresIn: null', 'jwt.expiresIn'],
    ['jwt:\n  expiresIn: invalid', 'jwt.expiresIn'],
    ['jwt:\n  expiresIn: -1', 'jwt.expiresIn'],
    ['jwt:\n  expiresIn: 0', 'jwt.expiresIn'],
    ['jwt:\n  expiresIn: 1.5', 'jwt.expiresIn'],
    ['jwt:\n  expiresIn: "100ms"', 'jwt.expiresIn'],
    ['jwt:\n  expiresIn: true', 'jwt.expiresIn'],
    ['cookie:\n  sameSite: invalid', 'cookie.sameSite'],
    ['cookie:\n  sameSite: null', 'cookie.sameSite'],
    ['cookie:\n  sameSite: none\n  secure: false', 'cookie.secure'],
    ['cookie:\n  signed: true', 'cookie.signed'],
    ['cookie:\n  domain: "http://localhost:3000"', 'cookie.domain'],
    ['cookie:\n  domain: true', 'cookie.domain'],
    ['cookie:\n  path: 123', 'cookie.path'],
    ['cookie:\n  path: "api"', 'cookie.path'],
    ['cookie:\n  path: "/api;"', 'cookie.path'],
    ['cookie:\n  path: "/api/auth"', 'cookie.path'],
    ['cookie:\n  path: "/a"', 'cookie.path'],
    ['cookie:\n  maxAge: 9007199254740991', 'cookie.maxAge'],
    ['session:\n  name: accessToken', 'session.name'],
    ['session:\n  name: ""', 'session.name'],
    ['session:\n  name: "session;"', 'session.name'],
    ['session:\n  name: 123', 'session.name'],
    ['http:\n  trustProxy: -1', 'http.trustProxy'],
    ['http:\n  trustProxy: 0.5', 'http.trustProxy'],
    ['http:\n  trustProxy: {}', 'http.trustProxy'],
    ['http:\n  trustProxy: [true]', 'http.trustProxy'],
    ['swagger:\n  path: null', 'swagger.path'],
    ['swagger:\n  title: ""', 'swagger.title'],
  ])('rejects invalid configuration: %s', (yaml, field) => {
    setOverride(yaml);
    expect(configuration).toThrow(field);
  });

  it.each(['3600', '"1h"', '"2 days"'])('accepts supported JWT lifetimes: %s', expiresIn => {
    setOverride(`jwt:\n  expiresIn: ${expiresIn}`);
    expect(configuration()).toHaveProperty('jwt.expiresIn');
  });

  it.each([
    'cookie:\n  path: /api/\n  domain: .example.com\n  sameSite: none\n  secure: true',
    'cookie:\n  path: /\n  domain: null\n  sameSite: false\n  maxAge: null',
    'http:\n  trustProxy: [loopback, "10.0.0.0/8"]',
    'http:\n  trustProxy: 0',
    'http:\n  trustProxy: []',
  ])('preserves valid Cookie and proxy configuration: %s', yaml => {
    setOverride(yaml);
    expect(configuration).not.toThrow();
  });

  it('requires JWT expiration even when the base configuration omits it', () => {
    jest.mocked(readFileSync).mockReturnValue(baseConfig.replace('  expiresIn: 1h\n', ''));
    expect(configuration).toThrow('jwt.expiresIn');
  });

  it('rejects production secrets padded with whitespace', () => {
    process.env.NODE_ENV = 'production';
    setOverride('jwt:\n  secret: "                               x"');
    expect(configuration).toThrow('jwt.secret');
  });

  it('requires independent production secrets and persistent sessions', () => {
    process.env.NODE_ENV = 'production';
    const secrets =
      'jwt:\n  secret: "abcdefghijklmnopqrstuvwxyz0123456789"\nsession:\n  secret: "abcdefghijklmnopqrstuvwxyz0123456789"';
    setOverride(`${secrets}\nsessionStore: mongo`);
    expect(configuration).toThrow('独立密钥');
    setOverride('sessionStore: memory');
    expect(configuration).toThrow('sessionStore');
    setOverride('sessionStore: mongo');
    expect(configuration()).toMatchObject({ sessionStore: 'mongo' });
  });

  it('falls back to root YAML for source execution', () => {
    jest.mocked(existsSync).mockImplementation(path => !String(path).endsWith(join('src', 'config', 'config.yaml')));
    configuration();
    expect(jest.mocked(readFileSync).mock.calls[0][0]).toBe(join(__dirname, '../../config/config.yaml'));
  });

  it('rejects invalid environment paths', () => {
    process.env.NODE_ENV = '../production';
    expect(configuration).toThrow('NODE_ENV');
  });
});
