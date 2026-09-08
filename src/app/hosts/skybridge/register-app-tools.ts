import type { McpServer as SkybridgeMcpServer } from 'skybridge/server';
import type { z } from 'zod3';
import type { ICommonGrantsClient } from '../../../core/types.js';
import { createGrantService } from '../../../core/service/grants.js';
import {
  PRESENT_SHORTLIST_TOOL_NAME,
  presentShortlistDefinition,
  presentShortlistOutputSchema,
} from '../../tools/present-shortlist.js';

export function registerSkybridgeAppTools(
  server: SkybridgeMcpServer,
  clients: ICommonGrantsClient[],
): void {
  const service = createGrantService(clients);
  const inputSchema = service.schemas.shortlist.shape;
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
      const structuredContent = await service.assembleShortlist(input);
      return {
        content: [],
        structuredContent,
        isError: structuredContent.items.every(({ status }) => status === 'error'),
      };
    },
  );
}
