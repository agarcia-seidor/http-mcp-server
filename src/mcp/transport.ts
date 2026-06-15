import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  type McpServer,
  WebStandardStreamableHTTPServerTransport,
} from '@modelcontextprotocol/server';

import {
  attachTenantRequestConfig,
  extractTenantRequestConfig,
} from './request-config.js';

export type McpTransportBridge = {
  handleRequest: (
    req: IncomingMessage,
    res: ServerResponse,
    origin: string,
    options?: {
      onMetadata?: (metadata: McpRequestMetadata | undefined) => void;
    },
  ) => Promise<void>;
};

export type McpRequestMetadata = {
  mcpMethod: string;
  mcpToolName?: string;
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

export function extractMcpRequestMetadata(
  body: Buffer | undefined,
): McpRequestMetadata | undefined {
  if (!body || body.length === 0) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(body.toString('utf8')) as unknown;
  } catch {
    return undefined;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }

  const { jsonrpc, method, params } = parsed as {
    jsonrpc?: unknown;
    method?: unknown;
    params?: unknown;
  };

  if (jsonrpc !== '2.0' || typeof method !== 'string') {
    return undefined;
  }

  const metadata: McpRequestMetadata = {
    mcpMethod: method,
  };

  if (
    method === 'tools/call' &&
    params &&
    typeof params === 'object' &&
    !Array.isArray(params)
  ) {
    const { name } = params as { name?: unknown };

    if (typeof name === 'string' && name.length > 0) {
      metadata.mcpToolName = name;
    }
  }

  return metadata;
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
    async handleRequest(req, res, origin, options) {
      await connected;

      if (!req.url) {
        res.statusCode = 400;
        res.end('Missing URL');
        return;
      }

      const body = await readRequestBody(req);
      const metadata = extractMcpRequestMetadata(body);
      options?.onMetadata?.(metadata);
      const request = new Request(`${origin}${req.url}`, {
        body: body && body.length > 0 ? new Uint8Array(body) : undefined,
        headers: req.headers as HeadersInit,
        method: req.method,
        duplex: 'half',
      } as RequestInit & { duplex?: 'half' });

      attachTenantRequestConfig(
        request,
        extractTenantRequestConfig(request.headers),
      );

      const response = await transport.handleRequest(request);
      await writeWebResponse(res, response);
    },
  };
}
