# Shared grant service

`src/core/service/index.ts` is the server-side entry point for grant operations without
an MCP connection, Skybridge runtime, or React view:

```ts
import { createClients, createGrantService } from '../src/core/service/index.js';

const grants = createGrantService(createClients(configuredSources));
const sources = grants.listSources();
const results = await grants.search({ query: 'child care', source: 'md' });
const detail = await grants.getOpportunity({ source: 'md', id: opportunityId });
const shortlist = await grants.assembleShortlist({
  opportunities: [{ source: 'md', id: opportunityId }],
});
```

Each operation returns domain data. MCP adapters add `content`,
`structuredContent`, `isError`, tool descriptions, and view metadata. Search,
detail, and shortlist inputs are validated by the service; their schemas are
available through `grants.schemas` so adapters reuse the same defaults and limits.
Invalid inputs reject before any source is contacted. Upstream failures retain
the existing per-source or per-item error behavior and pagination metadata.

Shortlist assembly preserves full opportunities, selection order, deduplication,
bounded retrieval, timeout handling, and assistant-supplied research context.
The app's old shortlist module re-exports the extracted implementation for
existing consumers and retains only presentation tool metadata.

This is an internal module extraction, not a published package. Source credentials
and network clients belong on the server. A future website endpoint can call this
service; WebMCP registration and website state updates belong in its page adapter.
The website, SDK versions, and MCP tool contracts are unchanged by this extraction.
