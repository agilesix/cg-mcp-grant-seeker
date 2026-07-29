import type { McpServer as SkybridgeMcpServer } from 'skybridge/server';
import type { z } from 'zod3';
import type { ICommonGrantsClient } from '../../../core/types.js';
import {
  createPresentShortlistInputSchema,
  PRESENT_SHORTLIST_TOOL_NAME,
  presentOpportunityShortlist,
  presentShortlistDefinition,
  presentShortlistOutputSchema,
} from '../../tools/present-shortlist.js';

export function registerSkybridgeAppTools(
  server: SkybridgeMcpServer,
  clients: ICommonGrantsClient[],
): void {
  const sourceNames = clients.map((client) => client.name) as [string, ...string[]];
  const inputSchema = createPresentShortlistInputSchema(sourceNames);
  type HandlerInput = z.output<z.ZodObject<typeof inputSchema>>;
  const register = server.registerTool.bind(server) as unknown as (
    definition: Record<string, unknown>,
    handler: (input: HandlerInput) => Promise<unknown>,
  ) => void;

  register(
    {
      name: PRESENT_SHORTLIST_TOOL_NAME,
      ...presentShortlistDefinition,
      inputSchema,
      outputSchema: presentShortlistOutputSchema,
      view: {
        component: 'grant-results',
        description:
          'Review one final ranked grant shortlist assembled from completed assistant research.',
        prefersBorder: false,
      },
    },
    async (input) => {
      const structuredContent = await presentOpportunityShortlist(input, clients);
      return {
        content: [],
        structuredContent,
        isError: structuredContent.items.every(({ status }) => status === 'error'),
      };
    },
  );
}
