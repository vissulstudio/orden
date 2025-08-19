const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const port = 8000;

// Simple credential store
const USERNAME = 'admin';
const PASSWORD = 'password';

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

const server = http.createServer((req, res) => {
  if (req.url === '/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const { username, password } = querystring.parse(body);
      if (username === USERNAME && password === PASSWORD) {
        res.writeHead(302, {
          'Set-Cookie': 'auth=true; HttpOnly',
          Location: '/index.html'
        });
        res.end();
      } else {
        res.writeHead(401, { 'Content-Type': 'text/html' });
        res.end('<h1>Credenciales inválidas</h1>', 'utf-8');
      }
    });
    return;
  }

  if (req.url === '/logout') {
    res.writeHead(302, {
      'Set-Cookie': 'auth=; Max-Age=0',
      Location: '/login.html'
    });
    res.end();
    return;
  }

  const cookies = parseCookies(req);
  if (!cookies.auth && req.url !== '/login.html') {
    res.writeHead(302, { Location: '/login.html' });
    res.end();
    return;
  }

  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});