// STUB — Task 4 implements the real handler
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { makeClient } from '../client.js';

export type ResolveClient = () => Promise<{
  client?: ReturnType<typeof makeClient>;
  errorText?: string;
}>;

export function registerWhoami(server: McpServer, resolveClient: ResolveClient): void {
  server.registerTool(
    'whoami',
    {
      description: 'İmzala hesabını ve kredi bakiyesini gösterir',
      inputSchema: {},
    },
    async () => {
      const { client, errorText } = await resolveClient();
      if (errorText) {
        return { content: [{ type: 'text' as const, text: errorText }], isError: true };
      }
      void client; // Task 4 will use client.getMe()
      return { content: [{ type: 'text' as const, text: 'whoami: not yet implemented' }] };
    },
  );
}
