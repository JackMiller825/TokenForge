import http from 'node:http';
import net from 'node:net';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { assertPublicUrl, isBlockedIp, normalizeHost, type SecurityOptions } from './network';

export interface EgressProxy {
  url: string;
  close: () => Promise<void>;
}

async function pinAddress(hostname: string, port: number, options?: SecurityOptions): Promise<string> {
  const host = normalizeHost(hostname);
  const allow = new Set((options?.testAllowHosts ?? []).map((item) => item.toLowerCase()));
  if (allow.has(host)) {
    if (isIP(host)) return host;
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records[0]) throw new Error('The host did not resolve');
    return records[0].address;
  }
  const scheme = port === 443 ? 'https:' : 'http:';
  const literal = host.includes(':') ? `[${host}]` : host;
  await assertPublicUrl(`${scheme}//${literal}:${port}/`, options);
  if (isIP(host)) return host;
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isBlockedIp(record.address))) {
    throw new Error('Private or unroutable network address is blocked');
  }
  return records[0].address;
}

function parseAuthority(value: string, defaultPort: number): { host: string; port: number } {
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    const host = value.slice(1, end);
    const rest = value.slice(end + 1);
    const port = rest.startsWith(':') ? Number(rest.slice(1)) : defaultPort;
    return { host, port };
  }
  const index = value.lastIndexOf(':');
  if (index > 0 && value.indexOf(':') === index) {
    return { host: value.slice(0, index), port: Number(value.slice(index + 1)) };
  }
  return { host: value, port: defaultPort };
}

export function startEgressProxy(options?: SecurityOptions): Promise<EgressProxy> {
  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        if (!req.url) throw new Error('Missing URL');
        const target = new URL(req.url);
        if (target.protocol !== 'http:') throw new Error('Unsupported proxy request');
        const port = Number(target.port || 80);
        const ip = await pinAddress(target.hostname, port, options);
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          if (!value || key === 'proxy-connection' || key === 'proxy-authorization') continue;
          headers[key] = Array.isArray(value) ? value.join(', ') : value;
        }
        headers.host = target.host;
        const upstream = http.request({
          host: ip,
          port,
          method: req.method,
          path: `${target.pathname}${target.search}`,
          headers,
          timeout: 15_000,
        }, (upstreamRes) => {
          res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
          upstreamRes.pipe(res);
        });
        upstream.on('error', () => {
          if (!res.headersSent) res.writeHead(502);
          res.end('Upstream request failed');
        });
        req.pipe(upstream);
      } catch {
        if (!res.headersSent) res.writeHead(403);
        res.end('Blocked');
      }
    })();
  });

  server.on('connect', (req, clientSocket, head) => {
    void (async () => {
      try {
        const { host, port } = parseAuthority(req.url || '', 443);
        if (!host || !Number.isInteger(port)) throw new Error('Bad target');
        const ip = await pinAddress(host, port, options);
        const upstream = net.connect({ host: ip, port, timeout: 10_000 });
        const fail = () => {
          upstream.destroy();
          clientSocket.destroy();
        };
        upstream.on('timeout', fail);
        upstream.on('error', fail);
        clientSocket.on('error', fail);
        upstream.once('connect', () => {
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head?.length) upstream.write(head);
          upstream.pipe(clientSocket);
          clientSocket.pipe(upstream);
        });
      } catch {
        clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        clientSocket.destroy();
      }
    })();
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
