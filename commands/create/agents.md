---
description: "Panduan lengkap bikin agent opencode — struktur prompt file, frontmatter fields, registrasi config, tool list, call patterns, best practices, dan flow question."
---

# Create Agent — Panduan Bikin Agent di Opencode

Panduan lengkap buat bikin agent opencode — dari nulis prompt file, registrasi config, sampe best practices.

---

## 1. Apa Itu Agent?

Agent adalah **AI specialist dengan instruksi khusus** yang bisa dipanggil buat ngerjain task spesifik. Beda jenisnya:

| Jenis | Mode | Bisa Dipanggil Oleh |
|-------|------|-------------------|
| **Agent** | `agent` / `primary` | User langsung — muncul di `available_agent_types` |
| **Subagent** | `subagent` | Agent lain aja, via `task` tool |
| **Skill** | — | Auto-load ke context, bukan agent. Bedanya: agent dipanggil, skill nempel terus |

---

## 2. Lokasi File

```
~/.opencode/agents/<nama-agent>.md      ← prompt file
~/.opencode/opencode.jsonc        ← registrasi agent
```

---

## 3. Struktur File Agent

Format: **Markdown + YAML frontmatter**

```yaml
---
name: ....
description: "Gunakan ketika [situasi spesifik]"
color: 
tools:
  "*": false
  "read": true
  "grep": true
---
```
# Nama Agent — Role

## IDENTITY
...siapa agent ini, apa perannya...

## MISSION
...apa yang harus dilakukan...

## RULES
...batasan-batasan...

## OUTPUT FORMAT
...format hasil yang diharapkan...

---

## 4. Frontmatter Fields

| Field | Wajib | Format Contoh | Fungsi |
|-------|-------|---------------|--------|
| `description` | Ya | `"Breakdown task jadi milestones & sub-tasks"` | Muncul di tool list / available_agent_types. Pakai frasa trigger agar agent tau kapan harus manggil |
| `tools` | Tidak | `{"read": false, "read": true}` | Permission per-tool. Pattern `"*": "ask / allow / deny"` + allowlist agar strict |
| `mode` | Tidak | `primary` / `subagent` / `agent` | Tentukan level akses agent |
| `model` | Tidak | `provider/model-id` | Model AI yang dipakai |
| `color` | wajib | `"#f59e0b"` | Warna di UI |
| `hidden` | Tidak | `true` / `false` | Kalo `true`, tidak muncul di UI — cocok buat internal agent |

---

## 5. Registrasi di opencode.jsonc

Setelah prompt file siap, register agent di `opencode.jsonc`:

```jsonc
"agent": {
  "<nama-agent>": {
    "mode": "subagent",
    "model": {"openrouter/..."},
    "permission": {
      "bash": {
        "*": "deny",
        "ls": "allow", 
        "cat": "allow"
      },
      "read": "deny"
    }
  }
}
```

### Penjelasan Field:

| Field | Fungsi |
|-------|--------|
| `mode` | `subagent` = hanya bisa dipanggil agent lain. `agent` / `primary` = bisa dipanggil user langsung |
| `model.provider` | Provider AI (contoh: `openrouter`, `anthropic`, `opencode`) |
| `model.model` | Model ID lengkap. Contoh: `openrouter/openai/gpt-4o` |
| `permission.allow` | Daftar tools yang diizinin |
| `permission.deny` | Daftar tools yang dilarang |

> **Catatan penting:** Format permission di config (`allow`/`deny`) beda dengan frontmatter (`"read": false` + true/false per tool). Keduanya valid — frontmatter buat file prompt, `allow`/`deny` buat config. Kalo keduanya ada, frontmatter memiliki prioritas lebih tinggi.

---

## 6. Tools yang Tersedia

Tools standar opencode:

| Tool | Fungsi | Risiko |
|------|--------|--------|
| `read` | Baca file | Rendah |
| `edit` | Edit file | Tinggi |
| `write` | Tulis file baru | Tinggi |
| `bash` | Jalanin command | Tinggi |
| `grep` | Search konten | Rendah |
| `glob` | Cari file | Rendah |
| `task` | Spawn subagent | Sedang |
| `websearch` | Cari di web | Sedang |
| `webfetch` | Fetch URL | Sedang |
| `question` | Tanya user | Rendah |
| `skill` | Load skill | Rendah |
| `todowrite` | Tracking progress | Rendah |

> **Tip:** Pakai `"*": false` di frontmatter, lalu allow hanya tools yang benar-benar diperlukan. Jangan memberi akses `write`/`edit`/`bash` jika agent hanya perlu membaca saja.

---

## 7. Cara Panggil Agent

**Dari agent lain** — via `task` tool:
```
Gunakan task tool dengan parameter subagent_type: "<nama-agent>".
Subagent akan otomatis terpanggil dengan instruksi yang dikirim.
```

**Dari user langsung** — muncul otomatis di daftar agent jika mode `agent` / `primary`.

**Dari parent ke subagent (delegation pattern):**
```
1. Parent nentuin task yang perlu dibreakdown
2. Parent spawn subagent via task tool → subagent_type
3. Parent ngirim konteks + instruksi
4. Subagent ngerjain, return hasil
5. Parent review & lanjut eksekusi
```

---

## 8. Best Practices (dari opencode sendiri)

### 8.1. 1 Agent = 1 Responsibility

Jangan bikin agent serba bisa. Misal:
- ❌ Agent "super-dev" yang bisa code + review + deploy
- ✅ Pisah: `code-agent`, `reviewer-agent`, `deploy-agent`

### 8.4. Boundary Jelas

Sebutin apa yang BOLEH dan apa yang DILARANG:
```
## RULES
1. BACA FILE saja — tidak boleh edit
2. JANGAN spawn agent lain
3. Output harus structured
4. JANGAN execute task
```

### 8.5. Prompt File Gak Perlu Panjang

~100-200 lines cukup. Detail berat bisa di file referensi terpisah.

### 8.6. Hidden Agents

Jika agent hanya internal (dipanggil agent lain saja), pakai `hidden: true` agar tidak muncul di daftar agent pengguna.

---

## Flow Bikin — Tanya Dulu!

Lihat panduan lengkap di [`commands/create/_reference.md`](/root/goblin/.opencode/commands/create/rules.md).

---

## Referensi

- File agent custom opencode: `~/.opencode/agents/`
- File agent opencode resmi (referensi frontmatter): `library/opencode/docs/.opencode/agent/`
- Config spec opencode: `library/opencode/docs/specs/v2/config.md`
