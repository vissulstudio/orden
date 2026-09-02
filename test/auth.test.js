const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const server = require('../server');

let baseUrl;

before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
});

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${baseUrl}${path}`, options, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body
      }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

test('redirects unauthenticated requests to the login page', async () => {
  const response = await request('/index.html');

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, '/login.html');
});

test('rejects invalid credentials without setting an auth cookie', async () => {
  const response = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=admin&password=wrong'
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.headers['set-cookie'], undefined);
  assert.match(response.body, /Credenciales inválidas/);
});

test('logs in with valid credentials and accepts the issued cookie', async () => {
  const login = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'username=admin&password=password'
  });

  assert.equal(login.statusCode, 302);
  assert.equal(login.headers.location, '/index.html');
  assert.match(login.headers['set-cookie'][0], /^auth=true;/);
  assert.match(login.headers['set-cookie'][0], /Path=\//);
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  assert.match(login.headers['set-cookie'][0], /SameSite=Lax/);

  const cookie = login.headers['set-cookie'][0].split(';', 1)[0];
  const authenticated = await request('/missing-protected-file', {
    headers: { Cookie: cookie }
  });

  assert.equal(authenticated.statusCode, 404);
  assert.equal(authenticated.headers.location, undefined);
});

test('does not authenticate arbitrary auth cookie values', async () => {
  const response = await request('/index.html', {
    headers: { Cookie: 'auth=false' }
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, '/login.html');
});

test('logout expires the auth cookie and returns to login', async () => {
  const response = await request('/logout', {
    headers: { Cookie: 'auth=true' }
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, '/login.html');
  assert.match(response.headers['set-cookie'][0], /^auth=;/);
  assert.match(response.headers['set-cookie'][0], /Path=\//);
  assert.match(response.headers['set-cookie'][0], /Max-Age=0/);
});