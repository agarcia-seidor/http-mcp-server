import type { ServerResponse } from 'node:http';

export function handleHealthRequest(res: ServerResponse, name: string): void {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true, name, uptime: process.uptime() }));
}
