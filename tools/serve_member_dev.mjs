import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { createMemberApi } from '../supabase/functions/member-api/service.mjs';
import { createDemoMembers, createDemoRepository } from '../js/member/demo-repository.mjs';

const root = new URL('../', import.meta.url);
const port = Number(process.argv[2] || 4174);
const origin = `http://127.0.0.1:${port}`;
const apiPath = '/__dev/member-api';
const domainPath = 'supabase/functions/_shared/member-domain.mjs';
const readFixture = async name => JSON.parse(await readFile(new URL(`tests/fixtures/member-v1/${name}.json`, root), 'utf8'));
const fixture = await readFixture('member-active');
const completed = await readFixture('replaced-action-completed');
const { repository } = createDemoRepository({
  members: createDemoMembers(fixture),
  sessions: [completed],
});
const memberApi = createMemberApi({ auth: { verify: () => ({ ok: true }) }, repository });
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.gif': 'image/gif', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(request.url, origin);
    if (request.headers.host !== url.host || url.origin !== origin) {
      response.writeHead(403).end();
      return;
    }
    if (url.pathname === apiPath) {
      if ((request.headers.origin && request.headers.origin !== origin) || request.headers['sec-fetch-site'] === 'cross-site') {
        response.writeHead(403).end();
        return;
      }
      const options = { method: request.method, headers: request.headers };
      if (request.method === 'POST') Object.assign(options, { body: Readable.toWeb(request), duplex: 'half' });
      const result = await memberApi(new Request(url, options));
      response.writeHead(result.status, { 'Content-Type': result.headers.get('Content-Type') }).end(await result.text());
      return;
    }
    const path = decodeURIComponent(url.pathname);
    const index = path === '/' || path === '/index.html';
    const file = index ? 'index.html' : path === '/js/member/member-domain.mjs' ? domainPath : path.slice(1);
    const asset = /^(assets|data|js)\//.test(file);
    if ((!index && !asset && file !== domainPath) || file.split('/').includes('..') || file.includes('\\')) {
      response.writeHead(404).end();
      return;
    }
    const content = await readFile(new URL(file.split('/').map(encodeURIComponent).join('/'), root));
    const body = index
      ? content.toString('utf8').replace('</head>', `<script>window.V14_MEMBER_API_BASE = location.origin + '${apiPath}';</script></head>`)
      : content;
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 400).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`7Fit member development preview · ${origin}/#/coach/members`));
