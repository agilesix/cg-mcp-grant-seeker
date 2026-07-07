/**
 * Example self-host config. Copy this to `commongrants-mcp.config.ts` in your
 * working directory (or point CG_MCP_CONFIG at it) to override the built-in
 * sources — add your own CommonGrants-compliant APIs, or supply your own
 * federal API key.
 *
 * In your own project, import from the package:
 *   import { defineConfig } from '@common-grants/mcp-grant-seeker/config';
 */
import { defineConfig } from '../src/config/index.js';

export default defineConfig({
  sources: [
    {
      name: 'federal',
      label: 'Federal (Simpler.Grants.gov)',
      baseUrl: 'https://api.simpler.grants.gov',
      auth: { type: 'apiKey', key: process.env.FEDERAL_API_TOKEN },
      isDefault: true,
    },
    {
      name: 'pa',
      label: 'Pennsylvania',
      baseUrl: 'https://pa.api.cg.a6lab.ai',
    },
    {
      name: 'ca',
      label: 'California',
      baseUrl: 'https://ca.api.cg.a6lab.ai',
    },
    // Add any other CommonGrants-compliant source:
    // {
    //   name: 'my-foundation',
    //   label: 'My Foundation',
    //   baseUrl: 'https://grants.example.org',
    //   auth: { type: 'bearer', token: process.env.MY_FOUNDATION_TOKEN },
    // },
  ],
});
