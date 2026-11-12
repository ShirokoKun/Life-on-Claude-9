import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Dev-only helper endpoints: save bake files, and stream raw frames into ffmpeg for the film render.
function devApi() {
  const ff = {};
  const root = process.cwd();
  const body = (req) => new Promise((res, rej) => { const ch = []; req.on('data', (c) => ch.push(c)); req.on('end', () => res(Buffer.concat(ch))); req.on('error', rej); });
  return {
    name: 'room-dev-api',
    configureServer(server) {
      if (server.httpServer) { server.httpServer.keepAliveTimeout = 600000; server.httpServer.headersTimeout = 610000; }
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        const url = new URL(req.url, 'http://x');
        try {
          if (url.pathname === '/api/save') {
            const rel = url.searchParams.get('path');
            const file = path.resolve(root, rel);
            if (!file.startsWith(root)) throw new Error('path outside project');
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, await body(req));
            res.end('ok');
          } else if (url.pathname === '/api/ff/start') {
            const id = url.searchParams.get('id') || 'a';
            const args = JSON.parse((await body(req)).toString());
            if (ff[id]) { try { ff[id].kill(); } catch {} }
            const p = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
            p.errLog = '';
            p.stderr.on('data', (d) => { p.errLog = (p.errLog + d.toString()).slice(-4000); });
            p.on('exit', (code) => { p.done = true; p.code = code; });
            p.stdin.on('error', () => {});
            ff[id] = p;
            res.end('ok');
          } else if (url.pathname === '/api/ff/frame') {
            const id = url.searchParams.get('id') || 'a', p = ff[id];
            const buf = await body(req);
            if (!p || p.done) throw new Error('ffmpeg not running: ' + (p ? p.errLog : ''));
            // Each frame number is written exactly once, so the client may safely retry a failed upload.
            const seq = url.searchParams.get('seq') || String(p.auto = (p.auto || 0) + 1);
            p.writes = p.writes || new Map();
            if (!p.writes.has(seq)) {
              p.writes.set(seq, (async () => { if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r)); })());
              if (p.writes.size > 8) p.writes.delete(p.writes.keys().next().value);
            }
            await p.writes.get(seq);
            res.end('ok');
          } else if (url.pathname === '/api/ff/end') {
            const id = url.searchParams.get('id') || 'a', p = ff[id];
            if (p) { p.stdin.end(); await new Promise((r) => (p.done ? r() : p.on('exit', r))); }
            res.end(JSON.stringify({ code: p ? p.code : -1, log: p ? p.errLog.slice(-1500) : '' }));
            delete ff[id];
          } else { res.statusCode = 404; res.end('nope'); }
        } catch (e) { res.statusCode = 500; res.end(String(e && e.message)); }
      });
    },
  };
}

export default defineConfig({
  base: './',
  server: { port: 5319, strictPort: true, host: '127.0.0.1', watch: { ignored: ['**/public/bake/**', '**/shots/**', '**/out/**', '**/refs/**', '**/docs/**'] } },
  plugins: [devApi()],
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
