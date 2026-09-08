import { describe, expect, it, vi } from 'vitest';
import { createGrantService } from '../../src/core/service/index.js';
import type { ICommonGrantsClient, SearchResult } from '../../src/core/service/index.js';

function source(name: string): ICommonGrantsClient {
  return {
    name,
    label: name.toUpperCase(),
    searchOpportunities: vi.fn(
      async () =>
        ({
          items: [],
          paginationInfo: { page: 1, pageSize: 5, totalItems: 0, totalPages: 0 },
        }) as unknown as SearchResult,
    ),
    getOpportunity: vi.fn(async () => {
      throw new Error('not found');
    }),
  };
}

describe('grant service without an MCP host', () => {
  it('keeps collection defaults independent from MCP search defaults', async () => {
    const pa = source('pa');
    const service = createGrantService([pa]);
    await expect(service.searchCollection({ source: 'pa' })).resolves.toEqual({ items: [] });
    expect(pa.searchOpportunities).toHaveBeenCalledWith({
      query: undefined,
      statuses: undefined,
      pageSize: 100,
      maxItems: 1000,
    });
    await service.searchCollection({ source: 'pa', statuses: ['closed'], pageSize: 50 });
    expect(pa.searchOpportunities).toHaveBeenLastCalledWith({
      query: undefined,
      statuses: ['closed'],
      pageSize: 50,
      maxItems: 1000,
    });
  });

  it('validates collection bounds and propagates upstream failures', async () => {
    const pa = source('pa');
    const service = createGrantService([pa]);
    await expect(service.searchCollection({ source: 'pa', pageSize: 101 })).rejects.toThrow();
    await expect(service.searchCollection({ source: 'missing' })).rejects.toThrow();
    expect(pa.searchOpportunities).not.toHaveBeenCalled();
    vi.mocked(pa.searchOpportunities).mockRejectedValue(new Error('Upstream returned 401'));
    await expect(service.searchCollection({ source: 'pa' })).rejects.toThrow('401');
  });
  it('applies search defaults and preserves partial source failures', async () => {
    const pa = source('pa');
    const md = source('md');
    vi.mocked(md.searchOpportunities).mockRejectedValue(new Error('offline'));
    const service = createGrantService([pa, md]);
    expect(service.listSources().sources.map((s) => s.name)).toEqual(['pa', 'md']);
    const result = await service.search({ query: 'child care' });
    expect(pa.searchOpportunities).toHaveBeenCalledWith({
      query: 'child care',
      statuses: ['open', 'forecasted'],
      page: 1,
      pageSize: 5,
    });
    expect(result.sources.map((s) => s.status)).toEqual(['empty', 'error']);
    expect(result.sources[1]?.error).toBe('offline');
    expect(result).not.toHaveProperty('structuredContent');
  });

  it('validates every direct operation before calling an upstream', async () => {
    const pa = source('pa');
    const service = createGrantService([pa]);
    await expect(service.search({ limit: 26 })).rejects.toThrow();
    await expect(service.getOpportunity({ source: 'unknown', id: 'id' })).rejects.toThrow();
    await expect(service.assembleShortlist({ opportunities: [] })).rejects.toThrow();
    expect(pa.searchOpportunities).not.toHaveBeenCalled();
    expect(pa.getOpportunity).not.toHaveBeenCalled();
  });

  it('routes detail requests by source and returns domain errors', async () => {
    const pa = source('pa');
    const md = source('md');
    const result = await createGrantService([pa, md]).getOpportunity({ source: 'md', id: 'id' });
    expect(pa.getOpportunity).not.toHaveBeenCalled();
    expect(md.getOpportunity).toHaveBeenCalledWith('id');
    expect(result).toEqual({
      source: { name: 'md', label: 'MD' },
      status: 'error',
      opportunity: null,
      error: 'not found',
    });
  });
});
