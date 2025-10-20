import { Test } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import { createConnection } from 'mongoose';
import type { Server } from 'http';
import request from 'supertest';
import svgCaptcha from 'svg-captcha';
import { AppModule } from '../src/app.module';
import { UserService } from '../src/user/user.service';
import { setupApp } from '../src/config/setup-app';
import { saltHash } from '../src/utils/bcrypt';
import { Role } from '../src/common/interfaces/common.interface';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

describe('HTTP integration (real modules, isolated persistence)', () => {
  let app: INestApplication;
  let server: Server;
  let adminToken: string;
  let userToken: string;
  const adminId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const users = {
    findOne: jest.fn(),
    findOneByName: jest.fn(),
    create: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
    remove: jest.fn().mockResolvedValue(true),
    findAllPaginate: jest.fn().mockResolvedValue({ dataList: [], total: 0 }),
  };

  beforeAll(async () => {
    // 使用真实模块、DTO、守卫、JWT 和 session，仅替换持久化连接及用户查询。
    const connection = createConnection();
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getConnectionToken())
      .useValue(connection)
      .overrideProvider(UserService)
      .useValue(users)
      .compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    const jwt = app.get(JwtService);
    adminToken = await jwt.signAsync({ sub: adminId, role: Role.ADMIN });
    userToken = await jwt.signAsync({ sub: userId, role: Role.USER });
    users.findOneByName.mockResolvedValue({
      id: adminId,
      account: 'admin',
      role: Role.ADMIN,
      password: await saltHash('password'),
    });
    jest.spyOn(svgCaptcha, 'create').mockReturnValue({ text: 'AbCd', data: '<svg>captcha</svg>' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    users.findOne.mockImplementation(id =>
      Promise.resolve({ id: String(id), account: 'account', role: String(id) === adminId ? Role.ADMIN : Role.USER })
    );
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  it('serves an uncached captcha and sets a session cookie', async () => {
    const response = await request(server).get('/api/common/captcha').expect(200);
    expect(response.body).toEqual({ code: 200, message: 'success', data: '<svg>captcha</svg>' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie'][0]).toMatch(/zm.session=.*HttpOnly.*SameSite=Lax/);
  });

  it('requires authentication and enforces controller roles on all user routes', async () => {
    await request(server).get(`/api/user/${userId}`).expect(401);
    for (const [method, path] of [
      ['get', `/api/user/${userId}`],
      ['post', '/api/user'],
      ['post', '/api/user/create'],
      ['patch', `/api/user/${userId}`],
      ['delete', `/api/user/${userId}`],
    ] as const) {
      await request(server)[method](path).set('Authorization', `Bearer ${userToken}`).send({}).expect(403);
    }
    expect(users.update).not.toHaveBeenCalled();
    expect(users.remove).not.toHaveBeenCalled();
  });

  it.each([
    { account: { $ne: null }, password: 'password' },
    { account: 'user', password: 123 },
    { account: 'user', password: 'password', role: 'admin' },
  ])('rejects invalid creation payloads: %j', async payload => {
    await request(server)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(400);
    expect(users.create).not.toHaveBeenCalled();
  });

  it.each([{ role: 'admin' }, { password: 'plaintext' }, { isDeleted: true }, { account: null }])(
    'rejects unauthorized update fields: %j',
    async payload => {
      await request(server)
        .patch(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(400);
      expect(users.update).not.toHaveBeenCalled();
    }
  );

  it.each([
    { pageNo: 1.5, pageSize: 10 },
    { pageNo: 1, pageSize: 101 },
    { pageNo: 1, pageSize: 10, account: {} },
    { pageNo: true, pageSize: 10 },
    { pageNo: 1, pageSize: true },
    { pageNo: [1], pageSize: 10 },
  ])('rejects invalid pagination: %j', async payload => {
    await request(server).post('/api/user').set('Authorization', `Bearer ${adminToken}`).send(payload).expect(400);
    expect(users.findAllPaginate).not.toHaveBeenCalled();
  });

  it('transforms pagination and accepts validated search fields', async () => {
    await request(server)
      .post('/api/user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pageNo: '1', pageSize: '10', account: 'a.b' })
      .expect(200);
    expect(users.findAllPaginate).toHaveBeenCalledWith(
      expect.objectContaining({ pageNo: 1, pageSize: 10, account: 'a.b' })
    );
  });

  it('rejects malformed object IDs', async () => {
    await request(server).get('/api/user/not-an-id').set('Authorization', `Bearer ${adminToken}`).expect(400);
  });

  it('supports login, cookie authentication, one-time captcha and logout', async () => {
    const agent = request.agent(server);
    const captcha = await agent.get('/api/common/captcha').expect(200);
    const originalSessionCookie = (captcha.headers['set-cookie'] as unknown as string[])
      .find(cookie => cookie.startsWith('zm.session='))!
      .split(';')[0];
    const login = await agent
      .post('/api/auth/login')
      .send({ account: 'admin', password: 'password', captcha: 'abcd' })
      .expect(200);
    expect(login.body).toMatchObject({ code: 200, data: { accessToken: expect.any(String) as unknown } });
    const sessionCookie = (login.headers['set-cookie'] as unknown as string[])
      .find(cookie => cookie.startsWith('zm.session='))!
      .split(';')[0];
    expect(sessionCookie).not.toBe(originalSessionCookie);
    expect(login.headers['cache-control']).toBe('no-store');
    await request(server)
      .post('/api/auth/login')
      .set('Cookie', originalSessionCookie)
      .send({ account: 'admin', password: 'password', captcha: 'abcd' })
      .expect(400);
    await agent.get(`/api/user/${userId}`).expect(200);
    await agent.post('/api/auth/login').send({ account: 'admin', password: 'password', captcha: 'abcd' }).expect(400);
    const logout = await agent.post('/api/auth/logout').expect(200);
    expect(logout.headers['cache-control']).toBe('no-store');
    expect(String(logout.headers['set-cookie'])).toContain('Thu, 01 Jan 1970');
    await agent.get(`/api/user/${userId}`).expect(401);
  });

  it('accepts captchas whose length is configured to six characters', async () => {
    const config = app.get(ConfigService);
    const originalSize = config.get<number>('captcha.size');
    config.set('captcha.size', 6);
    jest.spyOn(svgCaptcha, 'create').mockReturnValueOnce({ text: 'AbCdEf', data: '<svg>six</svg>' });
    try {
      const agent = request.agent(server);
      await agent.get('/api/common/captcha').expect(200);
      expect(svgCaptcha.create).toHaveBeenCalledWith(expect.objectContaining({ size: 6 }));
      await agent
        .post('/api/auth/login')
        .send({ account: 'admin', password: 'password', captcha: 'abcdef' })
        .expect(200);
    } finally {
      config.set('captcha.size', originalSize);
    }
  });

  it('allows only one concurrent login attempt per captcha', async () => {
    const captcha = await request(server).get('/api/common/captcha').expect(200);
    const cookie = (captcha.headers['set-cookie'] as unknown as string[])
      .find(value => value.startsWith('zm.session='))!
      .split(';')[0];
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(server)
          .post('/api/auth/login')
          .set('Cookie', cookie)
          .send({ account: 'admin', password: 'password', captcha: 'abcd' })
      )
    );
    expect(responses.map(response => response.status).sort()).toEqual([200, 400]);
  });

  it('clears cookies when logging out with an expired token or no token', async () => {
    const expiredToken = await app.get(JwtService).signAsync({ sub: adminId }, { expiresIn: -1 });
    const logout = await request(server)
      .post('/api/auth/logout')
      .set('Cookie', `accessToken=${expiredToken}`)
      .expect(200);
    const cookies = logout.headers['set-cookie'] as unknown as string[];
    expect(cookies.some(cookie => cookie.startsWith('accessToken=;') && cookie.includes('Thu, 01 Jan 1970'))).toBe(
      true
    );
    expect(cookies.some(cookie => cookie.startsWith('zm.session=;') && cookie.includes('Thu, 01 Jan 1970'))).toBe(true);
    await request(server).post('/api/auth/logout').expect(200);
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('rejects missing captcha and invalid login types', async () => {
    await request(server)
      .post('/api/auth/login')
      .send({ account: 'admin', password: 'password', captcha: 'abcd' })
      .expect(400);
    await request(server).post('/api/auth/login').send({ account: {}, password: 123, captcha: 'abcd' }).expect(400);
    expect(users.findOneByName).not.toHaveBeenCalled();
  });

  it('rejects tokens for deleted users and immediately honors role changes', async () => {
    users.findOne.mockRejectedValueOnce(new NotFoundException());
    await request(server).get(`/api/user/${userId}`).set('Authorization', `Bearer ${adminToken}`).expect(401);
    users.findOne.mockResolvedValueOnce({ id: adminId, role: Role.USER });
    await request(server).get(`/api/user/${userId}`).set('Authorization', `Bearer ${adminToken}`).expect(403);
  });

  it('protects the internal HTTP diagnostic endpoint', async () => {
    await request(server).post('/api/auth/testAxios').expect(401);
    await request(server).post('/api/auth/testAxios').set('Authorization', `Bearer ${userToken}`).expect(403);
  });

  it('generates Swagger with inherited update DTO properties and bearer auth', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build());
    expect(document.components?.schemas?.UpdateUserDto).toMatchObject({
      properties: { account: expect.any(Object) as unknown },
    });
    expect(document.paths['/api/user/{id}'].patch?.security).toEqual([{ bearer: [] }]);
    expect(app.get(ConfigService).get('cookie.secure')).toBe(false);
  });
});
