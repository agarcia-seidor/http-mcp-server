import type http from 'node:http';

import { DEFAULT_NEGOTIATED_PROTOCOL_VERSION } from '@modelcontextprotocol/server';
import { expect, test } from 'vitest';

import { createApp } from '../../src/app.js';
import type { AppEnv } from '../../src/config/env.js';
import { createMcpServer } from '../../src/mcp/create-server.js';
import { SERVER_VERSION } from '../../src/version.js';

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

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, {
    body: JSON.stringify(body),
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...headers,
    },
    method: 'POST',
  });
}

async function initializeMcp(baseUrl: string): Promise<void> {
  await postJson(`${baseUrl}/mcp`, {
    id: 1,
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      capabilities: {},
      clientInfo: {
        name: 'mock-api-ping-test',
        version: SERVER_VERSION,
      },
      protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
    },
  });

  await postJson(`${baseUrl}/mcp`, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  });
}

test('exposes tenant request config to the mock api ping tool when headers are valid', async () => {
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
    await initializeMcp(baseUrl);

    const response = await postJson(
      `${baseUrl}/mcp`,
      {
        id: 2,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          arguments: {},
          name: 'mock-api-ping',
        },
      },
      {
        authorization: 'Bearer secret-token-123',
        'x-api-url': 'https://api.example.com/v1',
      },
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      result: {
        content: Array<{
          text: string;
          type: 'text';
        }>;
      };
    };

    expect(body.result.content[0]?.text).toBe(
      JSON.stringify({
        apiUrl: 'https://api.example.com/v1',
        bearerTokenPresent: true,
        simulatedRequest: {
          method: 'GET',
          path: '/ping',
        },
        status: 'ready',
        summary: 'No external API request was made.',
      }),
    );
  } finally {
    await stopServer(server);
  }
});

test('returns an error when tenant headers are missing', async () => {
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
    await initializeMcp(baseUrl);

    const response = await postJson(`${baseUrl}/mcp`, {
      id: 2,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        arguments: {},
        name: 'mock-api-ping',
      },
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      result: {
        content: Array<{
          text: string;
          type: 'text';
        }>;
        isError: true;
      };
    };

    expect(body.result.isError).toBe(true);
    expect(body.result.content[0]?.text).toContain(
      'Send X-Api-Url and Authorization: Bearer <PAT>.',
    );
  } finally {
    await stopServer(server);
  }
});

test('returns an error when tenant headers are invalid', async () => {
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
    await initializeMcp(baseUrl);

    const response = await postJson(
      `${baseUrl}/mcp`,
      {
        id: 2,
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          arguments: {},
          name: 'mock-api-ping',
        },
      },
      {
        authorization: 'Token not-bearer',
        'x-api-url': 'not-a-url',
      },
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      result: {
        content: Array<{
          text: string;
          type: 'text';
        }>;
        isError: true;
      };
    };

    expect(body.result.isError).toBe(true);
    expect(body.result.content[0]?.text).toContain(
      'Invalid X-Api-Url header. Use an absolute http or https URL.',
    );
  } finally {
    await stopServer(server);
  }
});
