import type { SourceConfig } from '../core/index.js';

/**
 * Top-level server configuration. Each source may optionally carry an SDK
 * Plugin, which binds that source's parsing behavior when its client is
 * constructed.
 */
export interface ServerConfig {
  sources: SourceConfig[];
}

export type { SourceConfig } from '../core/index.js';
export type { AuthConfig } from '../core/index.js';
