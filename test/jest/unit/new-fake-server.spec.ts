import { NewFakeServer } from '../util/new-fake-server';
import axios from 'axios';

describe('NewFakeServer', () => {
  const fakeServer = new NewFakeServer();

  beforeAll(async () => {
    await fakeServer.start();
  });

  afterEach(async () => {
    fakeServer.reset();
  });

  afterAll(async () => {
    fakeServer.stop();
  });

  it('starts and stops and responds to trivial endpoint', async () => {
    const res = await axios.get(`http://localhost:${fakeServer.port}/test`);
    expect(res.status).toBe(200);
    expect(res.data).toBe('endpoint not defined');
  });

  it('can use dynamically added endpoint where we set a response callback', async () => {
    fakeServer
      .when({
        path: '/foo',
        method: 'get',
      })
      .respondWith(() => {
        return {
          ok: true,
          msg: 'dynamically added (with`respondWith`) endpoint: /foo',
        };
      });

    const res = await axios.get(`http://localhost:${fakeServer.port}/foo`);

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      ok: true,
      msg: 'dynamically added (with`respondWith`) endpoint: /foo',
    });
  });

  it('can use dynamically added endpoint where we set the response data', async () => {
    fakeServer
      .when({
        path: '/bar',
        method: 'get',
      })
      .respondWithData({
        ok: true,
        msg: 'dynamically added (with `respondWithData`) endpoint: /bar',
      });

    const res = await axios.get(`http://localhost:${fakeServer.port}/bar`);

    expect(res.status).toBe(200);
    expect(res.data).toEqual({
      ok: true,
      msg: 'dynamically added (with `respondWithData`) endpoint: /bar',
    });
  });
});
