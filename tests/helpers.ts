import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export function startServer(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler);
  return new Promise<{ url: string; port: number; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        port,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
