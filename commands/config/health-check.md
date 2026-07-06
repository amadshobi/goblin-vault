---
description: "cek config global / per-project apakah sudah sesuai SOP, cek path reference apakah sudah sesuai struktur home direktory ( diklik langsung kebuka )"
---

## Phase 1

- cek config global        => `~/.opencode/opencode.jsonc`
- cek config agents global => `~/.opencode/opencode.jsonc`

> Optional jika disuruh boss

- cek config per-project   => `~/goblin/projects/<input>/opencode.jsonc

**GOAL:**
1. JSON parser valid
2. Isi semua field sesuai
    example: 
    ```json
    {
        "references": {
            "<judul-reference>": {
                "path": "",          => cek disini apakah path sudah sesuai?
                "description": "",   => deskripsi sudah understanding?  
            }
        }
    }
    ```
3. Konsistensi pattern, hierarchy rapi dan terstruktur, mudah dibaca
4. Anti-Patterns to Detect
    - **Swiss-army agent**: Agent with 15+ tools trying to do everything
    - **Vague description**: "A helpful agent" or "Assists with tasks"
    - **Name mismatch**: File named `code-reviewer.md` but `name: code-review` in frontmatter
    - **Circular agents**: Agent A handoff to Agent B, Agent B handoff to Agent A
    - **Over-permissive hook**: Hook command downloads and executes remote scripts
    - **Broken applyTo**: Instructions with `applyTo: "**/*.js"` but content is Python-specific
    - **Tab indentation**: YAML frontmatter using tabs instead of spaces
    - **Unquoted special chars**: `description: Fixes: bugs and issues` (colon not quoted)
    - **Model not in free list**: Agent declares `model:` ID that does not exist in `~/.opencode/reference/models-free.md` or did not have explicit `:free` label in `<provider> models <free> atau yg disebut didalam file` output

## Phase 2

- cek struktur home direktory `~/goblin`
    1. ada perubahan? ( berbeda dengan config, prompt agent, commands, hooks dll )
    2. report

## Phase Final

- confirm
- cek and ricek

## Output Format

Always structure output as:

```markdown
## Validation Report

### Summary
- Files scanned: X
- Passed: Y
- Warnings: Z
- Critical: W

### Findings

| File | Check | Status | Severity | Message | Suggestion |
|------|-------|--------|----------|---------|------------|
| ... | ... | ... | ... | ... | ... |

### Recommendations
1. [Highest priority fix]
2. [Next priority]
```