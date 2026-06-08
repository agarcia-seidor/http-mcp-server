import type http from 'node:http';

import { expect, test } from 'vitest';

import { createMcpServer } from '../../src/mcp/create-server.js';
import { createMcpTransportBridge } from '../../src/mcp/transport.js';

function createMockResponse() {
  let body = '';
  let ended = false;
  const headers = new Map<string, string | number | readonly string[]>();

  return {
    end(chunk?: Buffer | string | Uint8Array) {
      ended = true;

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
    get bodyText() {
      return body;
    },
    get ended() {
      return ended;
    },
    setHeader(key: string, value: string | number | readonly string[]) {
      headers.set(key, value);
    },
    statusCode: 200,
  } as unknown as http.ServerResponse & {
    bodyText: string;
    ended: boolean;
    headers: Map<string, string | number | readonly string[]>;
  };
}

function createBridge() {
  const mcpServer = createMcpServer({
    name: 'demo-server',
  });

  return createMcpTransportBridge(mcpServer);
}

test('returns 400 when the transport request URL is missing', async () => {
  const bridge = createBridge();
  const res = createMockResponse();

  await bridge.handleRequest(
    {
      headers: {},
      method: 'POST',
      on: () => {
        throw new Error('body listeners should not be attached');
      },
      url: undefined,
    } as unknown as http.IncomingMessage,
    res,
    'http://localhost:1234',
  );

  expect(res.statusCode).toBe(400);
  expect(res.bodyText).toBe('Missing URL');
  expect(res.ended).toBe(true);
});

test('skips body reading for HEAD transport requests', async () => {
  const bridge = createBridge();
  const res = createMockResponse();
  let onCalls = 0;

  await bridge.handleRequest(
    {
      headers: {},
      method: 'HEAD',
      on: () => {
        onCalls += 1;
        throw new Error('HEAD requests should not read a body');
      },
      url: '/mcp',
    } as unknown as http.IncomingMessage,
    res,
    'http://localhost:1234',
  );

  expect(onCalls).toBe(0);
  expect(res.ended).toBe(true);
  expect(res.statusCode).not.toBe(0);
});

test('accepts string body chunks while reading transport requests', async () => {
  const bridge = createBridge();
  const res = createMockResponse();

  const request = {
    headers: {},
    method: 'POST',
    on(event: 'data' | 'end' | 'error', handler: (...args: unknown[]) => void) {
      handlers[event] = handler;

      if (!scheduled && handlers.data && handlers.end && handlers.error) {
        scheduled = true;
        queueMicrotask(() => {
          handlers.data?.('{"jsonrpc":"2.0","id":1,"method":"bogus/method"}');
          handlers.end?.();
        });
      }

      return request;
    },
    url: '/mcp',
  } as unknown as http.IncomingMessage;

  const handlers: Partial<
    Record<'data' | 'end' | 'error', (...args: unknown[]) => void>
  > = {};
  let scheduled = false;

  await bridge.handleRequest(request, res, 'http://localhost:1234');

  expect(res.ended).toBe(true);
  expect(res.statusCode).not.toBe(0);
});
