---
description: "Reference untuk struktur dan validasi prompt files di opencode"
---

# Prompt File Reference

Prompt files adalah file markdown yang digunakan sebagai system prompt atau user prompt untuk agent.

## Lokasi

Prompt files bisa ditempatkan di:
- `~/.opencode/commands/` — sebagai command prompt
- `~/.opencode/prompts/` — sebagai reusable prompt templates

## Format

Prompt file menggunakan format markdown dengan YAML frontmatter opsional:

```yaml
---
description: "Deskripsi singkat tentang prompt ini"
---
```

## Struktur yang Direkomendasikan

1. **Deskripsi jelas** — apa yang prompt ini lakukan
2. **Context** — informasi konteks yang relevan
3. **Instructions** — instruksi spesifik untuk agent
4. **Output format** — format output yang diharapkan (opsional)

## Validasi

- Frontmatter `description` bersifat opsional tapi direkomendasikan
- File harus valid markdown
- Jika ada frontmatter, harus valid YAML
- Tidak boleh ada duplikasi `---` markers
