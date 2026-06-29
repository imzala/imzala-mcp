import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { makeClient } from '../client.js';
import { formatWhoami, formatError } from '../format.js';

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
      try {
        const me = await client!.getMe();
        return { content: [{ type: 'text' as const, text: formatWhoami(me) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: formatError(e) }], isError: true };
      }
    },
  );
}
