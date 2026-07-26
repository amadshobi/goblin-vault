#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Goblin Nexus Model Picker
# Multi-select models via gum, update opencode.jsonc
# ─────────────────────────────────────────────────────────────

AVAILABLE_FILE="${1:-/tmp/gn-last-available.json}"
CONFIG_FILE="$HOME/.config/opencode/opencode.jsonc"

if [ ! -f "$AVAILABLE_FILE" ]; then
    echo "❌ File available models tidak ditemukan: $AVAILABLE_FILE"
    exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file tidak ditemukan: $CONFIG_FILE"
    exit 1
fi

# Get model count safely
MODEL_COUNT=$(bun -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    process.stdout.write(String(Array.isArray(d) ? d.length : 0));
" "$AVAILABLE_FILE")

if ! [[ "$MODEL_COUNT" =~ ^[0-9]+$ ]]; then
    echo "❌ Format available models invalid: count='$MODEL_COUNT'"
    exit 1
fi

if [ "$MODEL_COUNT" -eq 0 ]; then
    echo "⚠️  Tidak ada model available untuk dipilih."
    exit 0
fi

# Build gum options: "id | name"
OPTIONS=$(bun -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    for (const m of d) {
      console.log(m.id + ' | ' + (m.name || m.id.split('/').pop()));
    }
" "$AVAILABLE_FILE")

mapfile -t OPTION_LINES <<< "$OPTIONS"

if [ "${#OPTION_LINES[@]}" -eq 0 ]; then
    echo "⚠️  Tidak ada opsi model untuk ditampilkan ke picker."
    exit 0
fi

# ── TUI: gum multi-select ──
echo ""
echo "🎯 Model yang Available (200 OK) — pilih untuk diaktifkan:"
SELECTED=$(gum choose --no-limit \
    --header "🔧 SPACE: toggle  |  ENTER: confirm  |  CTRL+C: cancel" \
    --height 20 \
    --cursor "▸ " \
    --selected-prefix "✓ " \
    --unselected-prefix "  " \
    "${OPTION_LINES[@]}")

if [ -z "$SELECTED" ]; then
    echo "⚠️  Tidak ada model dipilih. Config tidak diubah."
    exit 0
fi

# Resolve GN_DIR dynamically
GN_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Merge selected models ke catalog yang sudah ada (UPSERT, bukan replace) ──
GN_SELECTED_LINES="$SELECTED" bun "$GN_DIR/config.ts" upsert-models "$CONFIG_FILE"

echo "💡 Reload opencode untuk mengaktifkan perubahan."
