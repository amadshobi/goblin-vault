---
description: "Referensi flow question untuk agent, command, dan hook — panduan tanya BOSS sebelum eksekusi, reusable dari agents.md, commands.md, dan hooks.md."
---

# Referensi: Flow Tanya Dulu

> ⚠️ **Guiding Principle:**
>
> **Jangan langsung eksekusi!** Tanya ke BOSS pakai `question` tool dulu sebelum bikin apapun.
>
> Kenapa? Karena preference BOSS beda-beda tiap kali dan tidak bisa ditebak.

## Flow Umum

1. Panggil `question` tool untuk menanyakan preference yang tidak bisa ditebak
2. Tunggu jawaban BOSS
3. Baru tulis file / eksekusi

## Daftar Hal yang Wajib Ditanyakan

### Agent
- Model LLM — tanya `model` field
- Color scheme — tanya `color`
- Mode — tanya `"subagent"` atau `"agent"`
- Tool permissions — tool apa aja yang perlu diakses
- description

### Command
- Category: `create` / `review` / `debug` / dll
- Filename: nama file `.md`
- Description length: pendek (1 kalimat) atau panjang (3-5 kalimat)?
- Content source: dari library atau nulis dari awal?

### Hook (JSON)
- Format: JSON atau TypeScript plugin?
- Event type: `PreToolUse` / `PostToolUse` / `Stop`?
- Tool matcher: tool apa yang di-hook? (`"Write"`, `"Edit"`, `"Bash"`, `".*"`)
- Command/script: pakai Python, Node.js, atau shell?

### Hook (TS Plugin)
- Events: event apa aja yang mau di-handle?
- Logic: apa yang harus dilakukan di tiap event?