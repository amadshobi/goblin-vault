/**
 * OpenCode Configurator (OCM) — Type Definitions: Config.
 *
 * Berisi interface TypeScript untuk membaca dan memanipulasi file konfigurasi
 * OpenCode (`opencode.jsonc`). Setiap interface merepresentasikan satu blok
 * atau sub-blok dari struktur JSONC config, termasuk agent, MCP server,
 * compaction, dan top-level config.
 *
 * Modul ini digunakan oleh command-command di `commands/` dan utility di
 * `utils/` untuk parsing dan update config secara tipe-safe.
 */

/**
 * Izin akses granular untuk sebuah agent.
 * Setiap field opsional; bila tidak diset, OpenCode menggunakan default.
 * Field index signature `[key: string]` mengakomodasi izin kustom tambahan.
 */
export interface AgentPermission {
  question?: string;
  bash?: string | Record<string, string>;
  edit?: string;
  read?: string;
  [key: string]: unknown;
}

/**
 * Konfigurasi untuk satu entri agent di blok `agent` / `agents`.
 * Digunakan oleh command `agent.ts` dan dibaca oleh `utils.updateAgentField`.
 */
export interface AgentConfigItem {
  model?: string;
  mode?: string;
  prompt?: string;
  steps?: number;
  variant?: string;
  disable?: boolean;
  disabled?: boolean;
  permission?: AgentPermission;
}

/**
 * Konfigurasi untuk satu MCP (Model Context Protocol) server.
 * Digunakan oleh command `mcp.ts` untuk toggle enable/disable, add, dan list.
 */
export interface MCPServerConfig {
  type?: string;
  command?: string;
  args?: string[];
  enabled?: boolean;
  disabled?: boolean;
  environment?: Record<string, string>;
  headers?: Record<string, string>;
}

/**
 * Konfigurasi kompaksi session OpenCode.
 * Mengontrol perilaku auto-trigger, pruning, serta fraksi keep dan buffer.
 */
export interface CompactionConfig {
  auto?: boolean;
  prune?: boolean;
  keep?: number;
  buffer?: number;
}

/**
 * Representasi top-level file `opencode.jsonc`.
 * Field opsional mencerminkan semua properti yang dikenal di konfigurasi
 * OpenCode. Index signature `[key: string]` menampung properti tidak dikenal
 * agar parsing tidak gagal pada field baru.
 */
export interface OpenCodeConfig {
  $schema?: string;
  default_agent?: string;
  agent?: Record<string, AgentConfigItem>;
  agents?: Record<string, AgentConfigItem>;
  mcp?: Record<string, MCPServerConfig>;
  compaction?: CompactionConfig;
  plugin?: string[];
  instructions?: string[];
  autoupdate?: string;
  share?: string;
  username?: string;
  model?: string;
  tool_output?: { max_lines?: number; max_bytes?: number };
  [key: string]: unknown;
}