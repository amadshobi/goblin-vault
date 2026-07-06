---
description: "Panduan lengkap bikin command opencode — kategorisasi, format file, frontmatter, $ARGUMENTS variable, inline shell, flow question, trigger di TUI, dan best practices."
---

# Create Command — Panduan Bikin Command di Opencode

Panduan lengkap buat bikin command opencode — dari nentuin kategori, nulis file, sampe trigger di TUI.

---

## 1. Apa Itu Command?

Command adalah **slash command** yang bisa di-trigger dari TUI dengan format `/nama-command`. Bedanya dengan agent:

| | Command | Agent |
|---|---|---|
| **Trigger** | `/nama-command` via TUI | Spawn via `task` tool atau otomatis di `available_agent_types` |
| **Isi** | Instruksi pendek & langsung | Prompt lengkap dengan identitas & rules |
| **Scope** | Task spesifik, sekali jalan | Role spesifik, bisa dipanggil berulang |
| **Frontmatter** | `description` + optional `model`/`subtask` | `description` + `tools` + `mode` + `color` + `model` |

Command cocok buat task yang **cepat, spesifik, dan langsung executable** seperti:
- `/translate` — translate dokumentasi
- `/commit` — git commit dengan aturan tertentu
- `/spellcheck` — cek typo di markdown
- `/issues` — cari GitHub issues

---

## 2. Lokasi File

```
~/.opencode/commands/<nama-command>.md      ← file command
```

---

## 3. Struktur File Command

Format: **Markdown + YAML frontmatter**

```yaml
---
description: "Deskripsi singkat — muncul di TUI pas pencah /"
---

Instruksi untuk model...

$ARGUMENTS
```

---

## 4. Frontmatter Fields

| Field | Wajib | Format Contoh | Fungsi |
|-------|-------|---------------|--------|
| `description` | ✅ | `"Remove AI code slop"` | Muncul di TUI pas ngetik `/`. Pakai kalimat singkat & jelas |
| `subtask` | ❌ | `true` | Jika `true`, command jalan sebagai subtask terpisah |

---

## 5. Variabel Khusus

| Variabel | Fungsi | Contoh |
|----------|--------|--------|
| `$ARGUMENTS` | Nangkep argumen user setelah `/command` | `/issues auth bug` → `$ARGUMENTS` berisi "auth bug" |
| `` !`command` `` | Inline shell execution | `` !`git diff` `` — jalanin git diff, hasilnya masuk ke context |

Contoh pakai `$ARGUMENTS`:
```markdown
Search issues matching: $ARGUMENTS

Consider:
1. Similar titles or descriptions
2. Same error messages
```

Contoh pakai `!`:
```markdown
## GIT DIFF

!`git diff`

## GIT STATUS

!`git status --short`
```

---

## Flow Bikin Command — Tanya Dulu!

Lihat panduan lengkap di [`commands/create/_reference.md`](/root/goblin/.opencode/commands/create/rules.md).

---

## 7. Trigger di TUI

Command otomatis muncul di TUI jika file `.md` ada langsung di folder `~/.opencode/commands/`.

Cara trigger:
```
/<nama-file> [argumen]
```

Contoh:
- `commands/translate.md` → `/translate English to Indonesian`
- `commands/commit.md` → `/commit`
- `commands/issues.md` → `/issues auth bug`

> File di subfolder (`commands/create/commands.md`) **tidak muncul** di TUI. Itu hanya file referensi biasa.

---

## 8. Contoh Lengkap

### Command Sederhana (`~/.opencode/commands/rmslop.md`):

```markdown
---
description: Remove AI code slop
---

Check the diff and remove all AI generated slop introduced in this branch.

This includes:
- Extra comments that a human wouldn't add
- Extra defensive checks or try/catch blocks
- Casts to any type issues
- Unnecessary emoji usage
```

### Command dengan Model & $ARGUMENTS (`~/.opencode/commands/issues.md`):

```yaml
---
description: "find issue(s) on github"
model: opencode/claude-haiku-4-5
---
```
Search through existing issues using the gh cli to find issues matching: $ARGUMENTS

Consider:
1. Similar titles or descriptions
2. Same error messages
3. Related functionality
4. Similar feature requests

List any matching issues with number, title, and explanation.

### Command dengan Subtask & Inline Shell (`~/.opencode/commands/commit.md`):

```yaml
---
description: git commit and push
model: opencode/kimi-k2.5
subtask: true
---

commit and push with conventional commit prefix (feat:, fix:, docs:, etc.)

Prefer explaining WHY from user perspective instead of WHAT.
```
## GIT DIFF

!`git diff`

## GIT STATUS --short

!`git status --short`


---

## 9. Best Practices

1. **Description jelas & searchable** — ini yang muncul di TUI pas ngetik `/`. Bikin yang mudah ditemukan
2. **Command pendek** — maksimal ~30-50 lines. Jika butuh instruksi panjang, lebih baik bikin agent
3. **Langsung ke point** — tidak perlu identitas & role kayak agent. Langsung instruksi
4. **Gunakan `$ARGUMENTS`** agar fleksibel nerima input user
5. **Gunakan `!` untuk shell inline** — agar tidak perlu bash tool secara eksplisit
6. **Model optional** — jika command simpel, tidak perlu model khusus
7. **1 command = 1 task spesifik** — jangan bikin command serba bisa
8. **Jika butuh langkah kompleks** → pakai `subtask: true` agar jalan mandiri

---

## 10. Bedanya Command vs Agent vs Skill

| | Command | Agent | Skill |
|---|---|---|---|
| **Trigger** | `/nama` di TUI | `task` tool / `available_agent_types` | Auto-load ke context |
| **File** | `commands/<name>.md` | `agents/<name>.md` | `skills/<name>/SKILL.md` |
| **Frontmatter** | `description`, optional `model`/`subtask` | `description` + `tools` + `mode` + `color` + `model` | `name` + `description` |
| **Panjang** | Pendek (10-30 lines) | Sedang (100-200 lines) | Bervariasi |
| **Use case** | Quick task, sekali jalan | Specialist role, reusable | Context knowledge |

---

## Referensi

- File command yang udah ada: `~/.opencode/commands/`
- Config spec: `~/.opencode/opencode.jsonc`
