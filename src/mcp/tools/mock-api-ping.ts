import type { McpServer, ServerContext } from '@modelcontextprotocol/server';
import { z } from 'zod';

import {
  getTenantRequestConfigState,
  requireTenantRequestConfig,
} from '../request-config.js';

function buildErrorResponse(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  };
}

function formatMockApiPingResponse(
  config: ReturnType<typeof requireTenantRequestConfig>,
) {
  return {
    apiUrl: config.apiUrl,
    bearerTokenPresent: true,
    simulatedRequest: {
      method: 'GET' as const,
      path: '/ping',
    },
    status: 'ready' as const,
    summary: 'No external API request was made.',
  };
}

function handleMockApiPingTool(
  _args: Record<string, never>,
  ctx: ServerContext,
) {
  const state = getTenantRequestConfigState(ctx);

  if (!state) {
    return buildErrorResponse(
      'Tenant configuration is not attached to this request. Send X-Api-Url and Authorization: Bearer <PAT> headers.',
    );
  }

  if (state.status !== 'valid') {
    return buildErrorResponse(state.reason);
  }

  return {
    content: [
      {
        text: JSON.stringify(
          formatMockApiPingResponse(requireTenantRequestConfig(ctx)),
        ),
        type: 'text' as const,
      },
    ],
  };
}

export function registerMockApiPingTool(server: McpServer): void {
  server.registerTool(
    'mock-api-ping',
    {
      description:
        'Returns a safe summary of the request-scoped tenant API configuration without calling an external API.',
      inputSchema: z.object({}),
    },
    handleMockApiPingTool,
  );
}
