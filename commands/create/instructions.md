---
description: "Reference untuk struktur dan validasi instruction files di opencode"
---

# Instruction File Reference

Instruction files adalah file markdown yang mendefinisikan aturan dan panduan untuk agent.

## Lokasi

Instruction files ditempatkan di:
- `~/.opencode/instructions/` — sebagai global instructions
- `~/.opencode/agents/<agent-name>/instructions/` — sebagai agent-specific instructions

## Format Wajib

Setiap instruction file WAJIB memiliki YAML frontmatter:

```yaml
---
description: "Deskripsi untuk discovery dan identifikasi"
applyTo: "**/*.ts" # (opsional) filter file pattern yang relevan
---
```

## Field Frontmatter

| Field | Required | Description |
|-------|----------|-------------|
| `description` | ✅ Yes | Deskripsi singkat untuk discovery agent. Wajib ada agar instruction bisa ditemukan. |
| `applyTo` | ❌ No | Glob pattern untuk menentukan file mana yang relevan dengan instruction ini. Contoh: `**/*.ts`, `**/*.py` |

## Validasi

- `description` WAJIB ada (required for discovery)
- `applyTo` bersifat opsional
- File harus valid markdown
- YAML frontmatter harus valid (no tabs, proper quoting)
