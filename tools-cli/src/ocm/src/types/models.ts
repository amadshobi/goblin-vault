/**
 * OpenCode Configurator (OCM) — Type Definitions: Models.
 *
 * Berisi interface untuk merepresentasikan item referensi model AI yang
 * dibaca dari file markdown `reference/models-free.md`. Setiap baris dari
 * file referensi di-parsed menjadi salah satu tipe: heading (section),
 * model (entry checklist), atau teks biasa.
 *
 * Digunakan oleh command `models.ts`, `reference.ts`, dan utility
 * `parseModelsFile` / `insertModel` di `utils/utils.ts`.
 */

/**
 * Satu item hasil parsing file referensi model (`models-free.md`).
 * - `heading`: baris `#`, `##`, atau `###` (provider / status section).
 * - `model`: baris checklist `- [x] \`modelId\` # alias`.
 * - `text`:  baris lain yang tidak dikenali sebagai heading atau model.
 */
export interface ModelReferenceItem {
  type: 'heading' | 'model' | 'text';
  text: string;
  provider?: string;
  status?: string;
  modelId?: string;
  alias?: string;
}

/**
 * Hasil lengkap parsing file referensi model.
 * Berisi array item yang sudah diurutkan sesuai urutan baris asli,
 * serta daftar unik nama provider yang ditemukan.
 */
export interface ParsedModelsResult {
  lines: ModelReferenceItem[];
  providers: string[];
}
