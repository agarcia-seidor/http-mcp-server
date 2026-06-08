import type http from 'node:http';

import { expect, test, vi } from 'vitest';

import { createApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';
import { createMcpServer } from '../src/mcp/create-server.js';

function createMockResponse() {
  let body = '';
  const headers = new Map<string, string | number | readonly string[]>();

  return {
    get bodyText() {
      return body;
    },
    end(chunk?: Buffer | string | Uint8Array) {
      if (typeof chunk === 'string') {
        body = chunk;
        return;
      }

      if (Buffer.isBuffer(chunk)) {
        body = chunk.toString('utf8');
        return;
      }

      if (chunk instanceof Uint8Array) {
        body = Buffer.from(chunk).toString('utf8');
        return;
      }

      body = '';
    },
    setHeader(key: string, value: string | number | readonly string[]) {
      headers.set(key, value);
    },
    statusCode: 200,
  } as unknown as http.ServerResponse & {
    bodyText: string;
    headers: Map<string, string | number | readonly string[]>;
  };
}

function createAppUnderTest() {
  const env: AppEnv = {
    mcpName: 'demo-server',
    port: 0,
  };

  const mcpServer = createMcpServer({
    name: env.mcpName,
  });

  const app = createApp({ env, mcpServer });
  const requestHandler = app.listeners('request')[0] as http.RequestListener;

  return { app, env, requestHandler };
}

test('returns 400 when the request URL is missing', async () => {
  const { requestHandler } = createAppUnderTest();
  const res = createMockResponse();

  await requestHandler(
    { headers: {}, method: 'GET', url: undefined } as http.IncomingMessage,
    res,
  );

  expect(res.statusCode).toBe(400);
  expect(res.bodyText).toBe('Missing URL');
});

test('returns 404 for unknown routes', async () => {
  const { requestHandler } = createAppUnderTest();
  const res = createMockResponse();

  await requestHandler(
    { headers: {}, method: 'GET', url: '/unknown' } as http.IncomingMessage,
    res,
  );

  expect(res.statusCode).toBe(404);
  expect(res.bodyText).toBe('Not found');
});

test('returns 500 and logs when request handling fails unexpectedly', async () => {
  const env: AppEnv = {
    mcpName: 'demo-server',
    port: 0,
  };

  const mcpServer = createMcpServer({
    name: env.mcpName,
  });
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
  const transportBridge = {
    handleRequest: vi.fn(async () => {
      throw new Error('transport exploded');
    }),
  };

  const app = createApp({ env, logger, mcpServer, transportBridge });
  const requestHandler = app.listeners('request')[0] as http.RequestListener;
  const res = createMockResponse();

  await requestHandler(
    { headers: {}, method: 'POST', url: '/mcp' } as http.IncomingMessage,
    res,
  );

  expect(res.statusCode).toBe(500);
  expect(res.bodyText).toBe('Internal Server Error');
  expect(logger.error).toHaveBeenCalledTimes(1);
  expect(logger.error).toHaveBeenCalledWith(
    'Unhandled request error',
    expect.any(Error),
    {
      method: 'POST',
      url: '/mcp',
    },
  );
});
