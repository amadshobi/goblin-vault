---
description: "Panduan lengkap bikin hooks opencode — JSON hooks vs TypeScript plugin, event types, format file, flow question, dan best practices untuk automation event-driven."
---

# Create Hooks — Panduan Bikin Hooks di Opencode

Panduan lengkap buat bikin hooks opencode — automation event-driven yang jalan otomatis di background.

---

## 1. Apa Itu Hooks?

Hooks adalah **event-driven automation** — mirip cron job, tapi berdasarkan **event** bukan waktu. Hook jalan otomatis ketika suatu lifecycle event terjadi.

| | Cron Job | Hooks |
|---|---|---|
| **Trigger** | Waktu (setiap jam 2) | Event (tool selesai, session mulai) |
| **Reaktivitas** | Terjadwal | Langsung pas event terjadi |
| **Use case** | Backup harian | Validasi sebelum write, auto-format setelah edit |

### Contoh Hook:
- **PreToolUse** → "Cek dulu sebelum file ditulis" (security scan)
- **PostToolUse** → "Auto-format prettier setelah edit" (quality)
- **session.created** → "Load CIVIL doctrine & memory" (context)
- **session.idle** → "Audit console.log yang ketinggalan" (cleanup)

---

## 2. Bedanya Hooks vs Commands vs Skills vs Agents

| | **Hooks** | **Commands** | **Skills** | **Agents** |
|---|---|---|---|---|
| **Trigger** | Lifecycle event | User `/nama` | Auto-load ke context | `task` tool / list agent |
| **Format file** | `hooks.json` / plugin `.ts` | `commands/*.md` | `skills/*/SKILL.md` | `agents/*.md` |
| **Tujuan** | Automasi background | Eksekusi task | Knowledge context | Specialist role |
| **User initiate?** | Tidak langsung | User ngetik `/` | Tidak | Dipanggil agent lain |
| **Scriptable?** | Bisa panggil script eksternal | Cuma instruksi | Cuma instruksi | Cuma instruksi |

Hooks cocok buat:
- **Security** — validasi sebelum tool jalan
- **Quality** — auto-format & lint setelah edit
- **Productivity** — tracking progress, notifikasi
- **Custom logic** — integrasi dengan sistem lain

---

## 3. Lokasi File

Ada 2 jenis hooks di opencode, beda lokasi & format:

### JSON Hooks (sederhana)
```
~/.opencode/hooks/hooks.json       ← deklarasi hooks
~/.opencode/hooks/scripts/*.{py,js,sh}   ← script yang dipanggil
```

### TypeScript Plugin Hooks (advanced)
```
~/.opencode/plugins/<nama-hooks>.ts       ← plugin hooks
```

---

## 4. Format JSON Hooks

### 4.1. Struktur File

File `~/.opencode/hooks/hooks.json`:

```json
{
  "hooks": [
    {
      "type": "PreToolUse",
      "matcher": "Write|Edit",
      "description": "Scan file for secrets before writing",
      "command": "python3 hooks/scripts/secret-scanner.py \"$TOOL_INPUT_file_path\""
    },
    {
      "type": "PostToolUse",
      "matcher": "Write|Edit",
      "description": "Auto-format & lint after editing",
      "command": "node hooks/scripts/post-edit-check.js \"$TOOL_INPUT_file_path\""
    },
    {
      "type": "PreToolUse",
      "matcher": "Bash",
      "description": "Validate command before execution",
      "command": "python3 hooks/scripts/smart-approve.py \"$TOOL_INPUT_command\""
    },
    {
      "type": "Stop",
      "matcher": ".*",
      "description": "Log session summary",
      "command": "echo 'Session completed'"
    }
  ]
}
```

### 4.2. Field JSON

| Field | Wajib | Fungsi |
|-------|-------|--------|
| `type` | Ya | Event type: `PreToolUse` (sebelum tool), `PostToolUse` (setelah tool), `Stop` (session selesai) |
| `matcher` | Ya | Regex buat milih tool mana yang di-hook. Contoh: `"Write"`, `"Write\|Edit"`, `"Bash"`, `".*"` (semua tool) |
| `description` | Ya | Penjelasan apa yang hook ini lakukan |
| `command` | Ya | Script/command yang di-execute. Bisa panggil file `.py`, `.js`, `.sh`, atau shell command langsung |

### 4.3. Variable yang Tersedia

| Variable | Dari Event | Deskripsi |
|----------|-----------|-----------|
| `$TOOL_INPUT_file_path` | Write/Edit | Path file yang bakal ditulis/diedit |
| `$TOOL_INPUT_command` | Bash | Command bash yang bakal dijalanin |
| `$TOOL_INPUT_content` | Write | Konten yang bakal ditulis |
| `$TOOL_OUTPUT_exit_code` | PostToolUse | Exit code dari tool |
| `$TOOL_OUTPUT_stdout` | PostToolUse | Output stdout dari tool |

### 4.4. Event Types (JSON Hooks)

| Event | Timing | Use Case |
|-------|--------|----------|
| `PreToolUse` | **Sebelum** tool dieksekusi | Validasi, security check, block command berbahaya |
| `PostToolUse` | **Setelah** tool selesai | Auto-format, type check, lint, logging |
| `Stop` | Session selesai / idle | Cleanup, summary, notifikasi |

---

## 5. Format TypeScript Plugin Hooks

### 5.1. Struktur File

File `~/.opencode/plugins/<nama>.ts`:

```typescript
import type { PluginInput } from "@opencode-ai/plugin"

export const NamaHook = async ({ client, $, directory, worktree }: PluginInput) => {
  return {
    // Event hooks di sini
  }
}

export default NamaHook
```

### 5.2. Event Hooks (Opencode Native — 20+ Events)

| Event | Trigger | Contoh Use Case |
|-------|---------|-----------------|
| `tool.execute.before` | Sebelum tool jalan | Security check, rate limiter |
| `tool.execute.after` | Setelah tool selesai | Auto-format, type check, audit |
| `file.edited` | File selesai di-edit | Tracker, auto-format prettier |
| `file.watcher.updated` | File system berubah | Sync state |
| `session.created` | Session baru mulai | Load context, welcome |
| `session.idle` | Session tidak aktif | Audit console.log, cleanup |
| `session.deleted` | Session berakhir | Final cleanup |
| `permission.asked` | Izin tool diminta | Audit trail |
| `todo.updated` | Todo list berubah | Progress tracking |

> **Catatan:** Opencode punya **20+ event hooks** — lebih banyak dari Claude Code yang hanya 3. Daftar di atas adalah yang paling umum dipakai.

### 5.3. Contoh Lengkap Plugin Hooks

```typescript
import type { PluginInput } from "@opencode-ai/plugin"

export const CIVILHooks = async ({
  client,
  $,
  directory,
  worktree,
}: PluginInput) => {
  const log = (level: string, message: string) =>
    client.app.log({ body: { service: "civil", level, message } })

  return {
    // Auto-format setelah file TS/JS di-edit
    "file.edited": async (event: { path: string }) => {
      if (event.path.match(/\.(ts|tsx|js|jsx)$/)) {
        await $`prettier --write ${event.path} 2>/dev/null`
      }
    },

    // Security check sebelum write
    "tool.execute.before": async (input: { tool: string; args?: any }) => {
      if (input.tool === "write" && input.args?.filePath) {
        log("info", `[CIVIL] Writing to: ${input.args.filePath}`)
      }
    },

    // Type check setelah edit TypeScript
    "tool.execute.after": async (input: { tool: string; args?: any }) => {
      if (input.tool === "edit" && input.args?.filePath?.match(/\.tsx?$/)) {
        await $`npx tsc --noEmit 2>&1`
      }
    },

    // Load context saat session mulai
    "session.created": async () => {
      log("info", "[CIVIL] Session started")
    },

    // Audit saat session idle
    "session.idle": async () => {
      log("info", "[CIVIL] Session idle - cleaning up")
    },
  }
}

export default CIVILHooks
```

---

## 6. Flow Bikin Hooks — Tanya Dulu!

Lihat panduan lengkap di [`commands/create/_reference.md`](../_reference.md).

---

## 7. Contoh Skenario Hooks untuk CIVIL

### Skenario 1: Security — Scan Secret Sebelum Write

```json
{
  "hooks": [
    {
      "type": "PreToolUse",
      "matcher": "Write|Edit",
      "description": "Cek apakah ada API key / token bocor sebelum file ditulis",
      "command": "python3 hooks/scripts/secret-scanner.py \"$TOOL_INPUT_file_path\" \"$TOOL_INPUT_content\""
    }
  ]
}
```

### Skenario 2: Quality — Auto-Format & Lint Setelah Edit

```typescript
"file.edited": async (event: { path: string }) => {
  if (event.path.match(/\.(ts|tsx|js|jsx)$/)) {
    await $`prettier --write ${event.path} 2>/dev/null`
    await $`npx eslint --fix ${event.path} 2>/dev/null`
  }
}
```

### Skenario 3: Context — Load CIVIL Memory Saat Session Mulai

```typescript
"session.created": async () => {
  const { stdout } = await $`cat ${worktree}/.opencode/reference/civil-doctor.md`
  // Memory otomatis ter-load
}
```

### Skenario 4: Tracking — Log Semua Tool Execution

```typescript
"tool.execute.after": async (input, output) => {
  log("info", `[TRACK] Tool: ${input.tool} | Status: completed`)
}
```

---

## 8. Best Practices

1. **JSON hooks untuk yang simpel** — jika hanya perlu validasi sederhana, gunakan JSON saja
2. **TS hooks untuk yang kompleks** — jika butuh logic, state, atau multiple events, pakai TypeScript
3. **Jangan blocking terlalu lama** — hooks nambah latency, tidak perlu user menunggu
4. **Error handling wajib** — hooks gagal tidak boleh merusak session utama. Wrap pakai try/catch
5. **Logging** — selalu log activity agar mudah debugging
6. **Gunakan `$` untuk shell** — di TS hooks, pakai `$` (tagged template literal) buat shell commands
7. **Jangan overload hooks** — terlalu banyak hooks bisa membuat lambat. Prioritaskan yang penting

---

## 9. Testing Hooks

Cara test hooks:
1. Trigger event yang sesuai (misal: write file buat test PreToolUse/PostToolUse)
2. Cek apakah hook kepanggil (liat output / log)
3. Cek apakah hook nge-block / nge-allow dengan bener
4. Cek error handling — jika script error, apakah session tetap jalan?

---

## Referensi

- Contoh JSON hooks: Lihat contoh hooks di folder ini
- Contoh TS plugin hooks: `library/repos/AGENTS-COLLECTION/SKILLS/EVERYTHING-CC/OPENCODE/PLUGINS/ecc-hooks.ts`
- Folder hooks (kosong): `~/.opencode/hooks/`
- Opencode plugin docs: `library/docs/.opencode/`
- Plugin hook spec: `PluginV2.HookSpec` di opencode core
