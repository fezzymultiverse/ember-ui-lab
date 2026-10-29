// Ember: plain node static server, no python3 (Termux has no python here).
// Run: node serve.js [port]
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'www');
const port = process.argv[2] || 8080;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  let p;try{p=decodeURIComponent(req.url.split('?')[0]);}catch(_){res.writeHead(400);return res.end('Bad URL');}
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log('Ember serving on http://127.0.0.1:' + port));
