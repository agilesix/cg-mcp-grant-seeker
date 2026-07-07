import type { SourceConfig } from '../core/index.js';

/**
 * Top-level server configuration. Today it's just the source registry; a
 * future `plugins` field will accept Plugin objects from the SDK's
 * definePlugin() for source-specific custom fields and filters.
 */
export interface ServerConfig {
  sources: SourceConfig[];
  // plugins?: McpPluginConfig[];  // Phase 4 — see docs/adr/002.
}

export type { SourceConfig } from '../core/index.js';
export type { AuthConfig } from '../core/index.js';
