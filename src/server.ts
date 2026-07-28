import { createServer } from './core/index.js';
import { defaultSources } from './config/defaults.js';
import type { NextFunction, Request, Response } from 'express';

const server = createServer(defaultSources(process.env.FEDERAL_API_TOKEN));

server.express.get('/health', (_request: Request, response: Response) => {
  response.type('text/plain').send('CommonGrants MCP server is running. Connect to /mcp.');
});

server.express.options('/mcp', (_request: Request, response: Response) => {
  response
    .set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
      'Access-Control-Max-Age': '86400',
    })
    .status(204)
    .send();
});

server.express.use('/mcp', (_request: Request, response: Response, next: NextFunction) => {
  response.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  });
  next();
});

export default await server.run();
