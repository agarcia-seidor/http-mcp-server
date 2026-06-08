import type http from 'node:http';

import { expect, test } from 'vitest';

import { createApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';
import { createMcpServer } from '../src/mcp/create-server.js';

async function startServer(
  app: http.Server,
  env: AppEnv,
): Promise<{ baseUrl: string; server: http.Server }> {
  await new Promise<void>((resolve, reject) => {
    app.once('error', reject);
    app.listen(0, '127.0.0.1', () => resolve());
  });

  const address = app.address();

  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine the listening address.');
  }

  env.port = address.port;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server: app,
  };
}

async function stopServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

test('serves health checks over HTTP', async () => {
  const env: AppEnv = {
    port: 0,
    mcpName: 'demo-server',
  };

  const mcpServer = createMcpServer({
    name: env.mcpName,
  });
  const app = createApp({ env, mcpServer });
  const { baseUrl, server } = await startServer(app, env);

  try {
    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as {
      name: string;
      ok: boolean;
      uptime: number;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toMatchObject({
      name: 'demo-server',
      ok: true,
    });
    expect(body.uptime).toEqual(expect.any(Number));
    expect(body.uptime).toBeGreaterThan(0);
  } finally {
    await stopServer(server);
  }
});
