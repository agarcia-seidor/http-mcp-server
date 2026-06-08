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

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    body: JSON.stringify(body),
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    },
    method: 'POST',
  });
}

async function postRaw(url: string, body: string): Promise<Response> {
  return fetch(url, {
    body,
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    },
    method: 'POST',
  });
}

test('serves the MCP flow over HTTP', async () => {
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
    const initializeResponse = await postJson(`${baseUrl}/mcp`, {
      id: 1,
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        capabilities: {},
        clientInfo: {
          name: 'smoke-test',
          version: SERVER_VERSION,
        },
        protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
      },
    });

    expect(initializeResponse.status).toBe(200);

    const initializeBody = (await initializeResponse.json()) as {
      result: {
        protocolVersion: string;
        serverInfo: {
          name: string;
          version: string;
        };
      };
    };

    expect(initializeBody.result.protocolVersion).toBe(
      DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
    );
    expect(initializeBody.result.serverInfo).toMatchObject({
      name: 'demo-server',
      version: SERVER_VERSION,
    });

    const initializedResponse = await postJson(`${baseUrl}/mcp`, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    expect(initializedResponse.status).toBe(202);

    const listResponse = await postJson(`${baseUrl}/mcp`, {
      id: 2,
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
    });

    expect(listResponse.status).toBe(200);

    const listBody = (await listResponse.json()) as {
      result: {
        tools: Array<{ name: string }>;
      };
    };

    expect(listBody.result.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['echo', 'time']),
    );

    const callResponse = await postJson(`${baseUrl}/mcp`, {
      id: 3,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        arguments: {
          message: 'hello world',
        },
        name: 'echo',
      },
    });

    expect(callResponse.status).toBe(200);

    const callBody = (await callResponse.json()) as {
      result: {
        content: Array<{
          text: string;
          type: 'text';
        }>;
      };
    };

    expect(callBody.result.content).toEqual([
      {
        text: JSON.stringify({ message: 'hello world' }),
        type: 'text',
      },
    ]);
  } finally {
    await stopServer(server);
  }
});

test('reports invalid tool arguments as an MCP error result over HTTP', async () => {
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
    await postJson(`${baseUrl}/mcp`, {
      id: 1,
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        capabilities: {},
        clientInfo: {
          name: 'smoke-test',
          version: SERVER_VERSION,
        },
        protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
      },
    });

    await postJson(`${baseUrl}/mcp`, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    const invalidCallResponse = await postJson(`${baseUrl}/mcp`, {
      id: 2,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        arguments: {
          message: 123,
        },
        name: 'echo',
      },
    });

    expect(invalidCallResponse.status).toBe(200);

    const invalidCallBody = (await invalidCallResponse.json()) as {
      id: number;
      jsonrpc: '2.0';
      result: {
        content: Array<{
          text: string;
          type: 'text';
        }>;
        isError: true;
      };
    };

    expect(invalidCallBody).toMatchObject({
      id: 2,
      jsonrpc: '2.0',
      result: {
        isError: true,
      },
    });
    expect(invalidCallBody.result.content[0]?.text).toContain(
      'Input validation error',
    );
    expect(invalidCallBody.result.content[0]?.text).toContain(
      'expected string, received number',
    );
  } finally {
    await stopServer(server);
  }
});

test('reports unknown MCP methods as JSON-RPC errors over HTTP', async () => {
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
    await postJson(`${baseUrl}/mcp`, {
      id: 1,
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        capabilities: {},
        clientInfo: {
          name: 'smoke-test',
          version: SERVER_VERSION,
        },
        protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
      },
    });

    await postJson(`${baseUrl}/mcp`, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    const invalidMethodResponse = await postJson(`${baseUrl}/mcp`, {
      id: 2,
      jsonrpc: '2.0',
      method: 'bogus/method',
    });

    expect(invalidMethodResponse.status).toBe(200);

    const invalidMethodBody = (await invalidMethodResponse.json()) as {
      error: {
        code: number;
        message: string;
      };
      id: number;
      jsonrpc: '2.0';
    };

    expect(invalidMethodBody).toMatchObject({
      error: {
        code: -32601,
      },
      id: 2,
      jsonrpc: '2.0',
    });
    expect(invalidMethodBody.error.message).toContain('Method not found');
  } finally {
    await stopServer(server);
  }
});

test('reports unknown tools as an MCP error over HTTP', async () => {
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
    await postJson(`${baseUrl}/mcp`, {
      id: 1,
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        capabilities: {},
        clientInfo: {
          name: 'smoke-test',
          version: SERVER_VERSION,
        },
        protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
      },
    });

    await postJson(`${baseUrl}/mcp`, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    const unknownToolResponse = await postJson(`${baseUrl}/mcp`, {
      id: 2,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        arguments: {},
        name: 'does-not-exist',
      },
    });

    expect(unknownToolResponse.status).toBe(200);

    const unknownToolBody = (await unknownToolResponse.json()) as {
      error: {
        code: number;
        message: string;
      };
      id: number;
      jsonrpc: '2.0';
    };

    expect(unknownToolBody).toMatchObject({
      error: {
        code: -32602,
        message: 'Tool does-not-exist not found',
      },
      id: 2,
      jsonrpc: '2.0',
    });
  } finally {
    await stopServer(server);
  }
});

test('reports malformed MCP request bodies as parse errors over HTTP', async () => {
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
    await postJson(`${baseUrl}/mcp`, {
      id: 1,
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        capabilities: {},
        clientInfo: {
          name: 'smoke-test',
          version: SERVER_VERSION,
        },
        protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
      },
    });

    await postJson(`${baseUrl}/mcp`, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    const malformedResponse = await postRaw(`${baseUrl}/mcp`, '{');

    expect(malformedResponse.status).toBe(400);

    const malformedBody = (await malformedResponse.json()) as {
      error: {
        code: number;
        data?: string;
        message: string;
      };
      id: null;
      jsonrpc: '2.0';
    };

    expect(malformedBody).toMatchObject({
      error: {
        code: -32700,
        message: 'Parse error: Invalid JSON',
      },
      id: null,
      jsonrpc: '2.0',
    });
    expect(malformedBody.error.data).toBeUndefined();
  } finally {
    await stopServer(server);
  }
});
