import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection, ConnectionStates, createConnection, Model } from 'mongoose';
import request from 'supertest';
import svgCaptcha from 'svg-captcha';
import { AppModule } from '../src/app.module';
import configuration from '../src/config/configuration';
import { setupApp } from '../src/config/setup-app';
import { User } from '../src/schemas/user.schema';
import { Role } from '../src/common/interfaces/common.interface';
import { saltHash } from '../src/utils/bcrypt';
import { CaptchaUseService } from '../src/auth/captcha-use.service';

const databaseDescribe = process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

databaseDescribe('MongoDB integration (disposable database)', () => {
  const databaseName = `zm_server_test_${randomUUID().replaceAll('-', '')}`;
  let app: INestApplication;
  let connection: Connection;
  let server: Server;
  let model: Model<User>;
  let adminToken: string;

  beforeAll(async () => {
    connection = createConnection(process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017', {
      dbName: databaseName,
      serverSelectionTimeoutMS: 3000,
    });
    await connection.asPromise();
    const config = new ConfigService({ ...configuration(), sessionStore: 'mongo' });
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getConnectionToken())
      .useValue(connection)
      .overrideProvider(ConfigService)
      .useValue(config)
      .compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    model = app.get<Model<User>>(getModelToken(User.name));
    await model.init();
    const admin = await model.create({ account: 'admin', password: await saltHash('password'), role: Role.ADMIN });
    adminToken = await app.get(JwtService).signAsync({ sub: admin.id, role: Role.ADMIN });
    jest.spyOn(svgCaptcha, 'create').mockReturnValue({ text: 'AbCd', data: '<svg>captcha</svg>' });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    try {
      // 仅清理由本测试生成且显式选择的随机数据库。
      if (
        connection?.readyState === ConnectionStates.connected &&
        connection.name === databaseName &&
        databaseName.startsWith('zm_server_test_')
      ) {
        await connection.dropDatabase();
      }
    } finally {
      if (app) await app.close();
      else await connection?.close();
    }
  });

  it('creates, queries, updates and soft deletes users without exposing secrets', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    await request(server)
      .post('/api/user/create')
      .set(auth)
      .send({ account: 'member', password: 'password' })
      .expect(200);
    await request(server)
      .post('/api/user/create')
      .set(auth)
      .send({ account: 'member', password: 'password' })
      .expect(409);
    const list = await request(server)
      .post('/api/user')
      .set(auth)
      .send({ pageNo: 1, pageSize: 10, account: 'member' })
      .expect(200);
    const body = list.body as { data: { total: number; dataList: Record<string, unknown>[] } };
    expect(body.data.total).toBe(1);
    const user = body.data.dataList[0];
    for (const field of ['id', 'createdTime', 'updatedTime']) expect(user[field]).toEqual(expect.any(String));
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('isDeleted');
    const id = String(user.id);
    const stored = await model.findById(id).select('+password').orFail();
    expect(stored.password).not.toBe('password');
    await request(server).patch(`/api/user/${id}`).set(auth).send({ account: 'admin' }).expect(409);
    await request(server).patch(`/api/user/${id}`).set(auth).send({ account: 'renamed' }).expect(200);
    await request(server).patch(`/api/user/${id}`).set(auth).send({}).expect(400);
    const memberToken = await app.get(JwtService).signAsync({ sub: id, role: Role.USER });
    await request(server).delete(`/api/user/${id}`).set(auth).expect(200);
    await request(server).get(`/api/user/${id}`).set(auth).expect(404);
    await request(server).post('/api/user').set('Authorization', `Bearer ${memberToken}`).expect(401);
    expect(await model.findById(id).select('+isDeleted').orFail()).toMatchObject({ isDeleted: true });
    const filtered = await request(server)
      .post('/api/user')
      .set(auth)
      .send({ pageNo: 1, pageSize: 10, account: 'renamed' })
      .expect(200);
    expect(filtered.body).toMatchObject({ data: { total: 0, dataList: [] } });
  });

  it('persists captcha sessions in MongoDB and supports login/logout with real bcrypt', async () => {
    const agent = request.agent(server);
    const captcha = await agent.get('/api/common/captcha').expect(200);
    const sessions = connection.collection('sessions');
    expect(await sessions.countDocuments()).toBe(1);
    await agent.post('/api/auth/login').send({ account: 'admin', password: 'wrong', captcha: 'abcd' }).expect(401);
    await agent.post('/api/auth/login').send({ account: 'admin', password: 'password', captcha: 'abcd' }).expect(400);
    await agent.get('/api/common/captcha').expect(200);
    const login = await agent
      .post('/api/auth/login')
      .send({ account: 'admin', password: 'password', captcha: 'abcd' })
      .expect(200);
    const sessionCookie = (response: { headers: Record<string, unknown> }) =>
      (response.headers['set-cookie'] as string[]).find(cookie => cookie.startsWith('zm.session='))?.split(';')[0];
    expect(sessionCookie(login)).toBeDefined();
    expect(sessionCookie(login)).not.toBe(sessionCookie(captcha));
    expect(await sessions.countDocuments()).toBe(1);
    await agent.post('/api/user').send({ pageNo: 1, pageSize: 10 }).expect(200);
    await agent.post('/api/auth/logout').expect(200);
    expect(await sessions.countDocuments()).toBe(0);
    await agent.post('/api/user').send({ pageNo: 1, pageSize: 10 }).expect(401);
  });

  it('consumes captchas atomically across independent service instances and concurrent HTTP requests', async () => {
    const other = new CaptchaUseService(app.get(ConfigService), connection);
    await other.onModuleInit();
    const id = randomUUID();
    const expiry = Date.now() + 10000;
    const results = await Promise.all([app.get(CaptchaUseService).consume(id, expiry), other.consume(id, expiry)]);
    expect(results.sort()).toEqual([false, true]);
    const uses = connection.getClient().db(connection.name).collection<{ _id: string; expires: Date }>('captcha_uses');
    expect(await uses.countDocuments({ _id: id })).toBe(1);
    const indexes = await uses.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: { expires: 1 }, expireAfterSeconds: 0 })])
    );

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
});
