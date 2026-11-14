const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0); // cổng 0 = chọn cổng trống ngẫu nhiên
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => server.close());

test('GET /health trả về ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { status: 'ok' });
});

test('GET /api/info có version', async () => {
  const body = await (await fetch(`${baseUrl}/api/info`)).json();
  assert.ok(body.version);
  assert.ok(body.startedAt);
});

test('GET /api/announcements trả về danh sách', async () => {
  const body = await (await fetch(`${baseUrl}/api/announcements`)).json();
  assert.ok(Array.isArray(body));
  assert.ok(body.length > 0);
});

test('GET / trả về trang HTML', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /Cổng thông tin nội bộ/);
});
