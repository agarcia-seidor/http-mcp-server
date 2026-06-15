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

function createMockLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

function createAppUnderTest(logger = createMockLogger()) {
  const env: AppEnv = {
    mcpName: 'demo-server',
    port: 0,
  };

  const mcpServer = createMcpServer({
    name: env.mcpName,
  });

  const app = createApp({ env, logger, mcpServer });
  const requestHandler = app.listeners('request')[0] as http.RequestListener;

  return { app, env, logger, requestHandler };
}

test('returns 400 when the request URL is missing', async () => {
  const { logger, requestHandler } = createAppUnderTest();
  const res = createMockResponse();

  await requestHandler(
    { headers: {}, method: 'GET', url: undefined } as http.IncomingMessage,
    res,
  );

  expect(res.statusCode).toBe(400);
  expect(res.bodyText).toBe('Missing URL');
  expect(logger.info).toHaveBeenCalledWith('Request started', {
    method: 'GET',
    url: '<missing>',
  });
  expect(logger.info).toHaveBeenCalledWith('Request completed', {
    method: 'GET',
    url: '<missing>',
    statusCode: 400,
    durationMs: expect.any(Number),
  });
});

test('returns 404 for unknown routes', async () => {
  const { logger, requestHandler } = createAppUnderTest();
  const res = createMockResponse();

  await requestHandler(
    { headers: {}, method: 'GET', url: '/unknown' } as http.IncomingMessage,
    res,
  );

  expect(res.statusCode).toBe(404);
  expect(res.bodyText).toBe('Not found');
  expect(logger.info).toHaveBeenNthCalledWith(1, 'Request started', {
    method: 'GET',
    url: '/unknown',
  });
  expect(logger.info).toHaveBeenNthCalledWith(2, 'Request completed', {
    method: 'GET',
    url: '/unknown',
    statusCode: 404,
    durationMs: expect.any(Number),
  });
});

test('includes MCP metadata in request logs when available', async () => {
  const env: AppEnv = {
    mcpName: 'demo-server',
    port: 0,
  };

  const mcpServer = createMcpServer({
    name: env.mcpName,
  });
  const logger = createMockLogger();
  const transportBridge = {
    handleRequest: vi.fn(async (_req, _res, _origin, options) => {
      options?.onMetadata?.({
        mcpMethod: 'tools/call',
        mcpToolName: 'echo',
      });
    }),
  };

  const app = createApp({ env, logger, mcpServer, transportBridge });
  const requestHandler = app.listeners('request')[0] as http.RequestListener;
  const res = createMockResponse();

  await requestHandler(
    { headers: {}, method: 'POST', url: '/mcp' } as http.IncomingMessage,
    res,
  );

  expect(res.statusCode).toBe(200);
  expect(logger.info).toHaveBeenNthCalledWith(1, 'Request started', {
    method: 'POST',
    url: '/mcp',
  });
  expect(logger.info).toHaveBeenNthCalledWith(2, 'Request completed', {
    method: 'POST',
    mcpMethod: 'tools/call',
    mcpToolName: 'echo',
    url: '/mcp',
    statusCode: 200,
    durationMs: expect.any(Number),
  });
});

test('returns 500 and logs when request handling fails unexpectedly', async () => {
  const env: AppEnv = {
    mcpName: 'demo-server',
    port: 0,
  };

  const mcpServer = createMcpServer({
    name: env.mcpName,
  });
  const logger = createMockLogger();
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
  expect(logger.info).toHaveBeenCalledWith('Request started', {
    method: 'POST',
    url: '/mcp',
  });
  expect(logger.info).toHaveBeenCalledTimes(1);
});
