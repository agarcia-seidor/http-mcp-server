import { expect, test, vi } from 'vitest';

import { SERVER_VERSION } from '../../src/version.js';

const { McpServerMock, registerEchoTool, registerTimeTool } = vi.hoisted(() => {
  const registerEchoTool = vi.fn();
  const registerTimeTool = vi.fn();

  class McpServerMock {
    constructor(
      public readonly config: {
        name: string;
        version: string;
      },
    ) {}
  }

  return { McpServerMock, registerEchoTool, registerTimeTool };
});

vi.mock('@modelcontextprotocol/server', () => ({
  McpServer: McpServerMock,
}));

vi.mock('../../src/mcp/tools/echo.js', () => ({
  registerEchoTool,
}));

vi.mock('../../src/mcp/tools/time.js', () => ({
  registerTimeTool,
}));

test('creates an MCP server and registers the built-in tools', async () => {
  const { createMcpServer } = await import('../../src/mcp/create-server.js');

  const server = createMcpServer({
    name: 'demo-server',
  }) as unknown as {
    config: {
      name: string;
      version: string;
    };
  };

  expect(server.config).toEqual({
    name: 'demo-server',
    version: SERVER_VERSION,
  });
  expect(registerEchoTool).toHaveBeenCalledTimes(1);
  expect(registerEchoTool).toHaveBeenCalledWith(server);
  expect(registerTimeTool).toHaveBeenCalledTimes(1);
  expect(registerTimeTool).toHaveBeenCalledWith(server);
});
