import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  type McpServer,
  WebStandardStreamableHTTPServerTransport,
} from '@modelcontextprotocol/server';

export type McpTransportBridge = {
  handleRequest: (
    req: IncomingMessage,
    res: ServerResponse,
    origin: string,
  ) => Promise<void>;
};

function readRequestBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return Promise.resolve(undefined);
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function writeWebResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status;
  for (const [key, value] of response.headers.entries()) {
    res.setHeader(key, value);
  }

  if (response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
    return;
  }

  res.end();
}

export function createMcpTransportBridge(
  server: McpServer,
): McpTransportBridge {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const connected = server.connect(transport);

  return {
    async handleRequest(req, res, origin) {
      await connected;

      if (!req.url) {
        res.statusCode = 400;
        res.end('Missing URL');
        return;
      }

      const body = await readRequestBody(req);
      const request = new Request(`${origin}${req.url}`, {
        body: body && body.length > 0 ? new Uint8Array(body) : undefined,
        headers: req.headers as HeadersInit,
        method: req.method,
        duplex: 'half',
      } as RequestInit & { duplex?: 'half' });

      const response = await transport.handleRequest(request);
      await writeWebResponse(res, response);
    },
  };
}
