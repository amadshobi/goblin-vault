#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Goblin Nexus Agent Model Switcher
# Ganti model agent di opencode.jsonc via TUI
# ─────────────────────────────────────────────────────────────

CONFIG_FILE="$HOME/.config/opencode/opencode.jsonc"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file tidak ditemukan: $CONFIG_FILE"
    exit 1
fi

# ── Helper: strip JSONC comments ──
strip_comments() {
    bun -e '
const fs=require("fs");
const raw=fs.readFileSync("'"$CONFIG_FILE"'","utf8")
  .replace(/^\s*\/\/.*$/gm,"")
  .replace(/\/\*[\s\S]*?\*\//g,"");
const j=JSON.parse(raw);
console.log(JSON.stringify(j));
'
}

CONFIG_JSON=$(strip_comments)

# ── Get agents list ──
AGENTS=$(echo "$CONFIG_JSON" | bun -e '
const j=JSON.parse(require("fs").readFileSync("/dev/stdin","utf8"));
console.log(Object.keys(j.agent||{}).join("\n"));
')

if [ -z "$AGENTS" ]; then
    echo "❌ Tidak ada agent ditemukan di config."
    exit 1
fi

# ── Agent selection ──
if [ -n "${1:-}" ]; then
    FOUND=$(echo "$AGENTS" | grep -xF "$1" 2>/dev/null)
    if [ -z "$FOUND" ]; then
        echo "❌ Agent '$1' tidak ditemukan."
        echo "   Available: $(echo "$AGENTS" | tr '\n' ', ' | sed 's/, $//')"
        exit 1
    fi
    SELECTED_AGENT="$1"
else
    echo ""
    mapfile -t AGENT_OPTIONS <<< "$AGENTS"
    SELECTED_AGENT=$(gum choose \
        --header "🤖 Pilih Agent yang ingin diganti modelnya:" \
        --cursor "▸ " \
        "${AGENT_OPTIONS[@]}")
    [ -z "$SELECTED_AGENT" ] && echo "⚠️  Batal." && exit 0
fi

# ── Show current model ──
CURRENT_MODEL=$(echo "$CONFIG_JSON" | GN_AGENT="$SELECTED_AGENT" bun -e '
const j=JSON.parse(require("fs").readFileSync("/dev/stdin","utf8"));
console.log(j.agent?.[process.env.GN_AGENT]?.model||"(not set)");
')

echo ""
echo "🤖 Agent: $SELECTED_AGENT"
echo "📦 Current model: $CURRENT_MODEL"
echo ""

# ── Get models list from goblin-nexus ──
MODELS_LIST=$(echo "$CONFIG_JSON" | bun -e '
const j=JSON.parse(require("fs").readFileSync("/dev/stdin","utf8"));
const m=j.provider?.["goblin-nexus"]?.models||{};
Object.entries(m).forEach(([k,v])=>console.log(k+" | "+(v.name||v.id)));
')

if [ -z "$MODELS_LIST" ]; then
    echo "⚠️  Tidak ada model di provider goblin-nexus."
    echo "   Jalankan 'gn ping --select' dulu untuk menambah model."
fi

ALL_OPTIONS=$(printf "%s\n%s" "✏️  CUSTOM (manual input)" "$MODELS_LIST")

# ── Model selection ──
mapfile -t MODEL_OPTIONS <<< "$ALL_OPTIONS"
SELECTED_MODEL=$(gum choose \
    --header "📦 Pilih Model untuk Agent '$SELECTED_AGENT':" \
    --cursor "▸ " \
    "${MODEL_OPTIONS[@]}")

[ -z "$SELECTED_MODEL" ] && echo "⚠️  Batal." && exit 0

# ── Resolve model key ──
MODEL_KEY=""

if [ "$SELECTED_MODEL" = "✏️  CUSTOM (manual input)" ]; then
    CUSTOM_ID=$(gum input \
        --placeholder "google-antigravity/gemini-3.6-flash" \
        --header "🔑 Masukkan Full Model ID:")
    [ -z "$CUSTOM_ID" ] && echo "⚠️  Batal." && exit 0
    MODEL_KEY=$(echo "$CUSTOM_ID" | sed 's|.*/||')

    # Check if this model already exists in config
    EXISTS=$(echo "$CONFIG_JSON" | GN_CUSTOM_ID="$CUSTOM_ID" bun -e '
const j=JSON.parse(require("fs").readFileSync("/dev/stdin","utf8"));
const m=j.provider?.["goblin-nexus"]?.models||{};
for(const[k,v]of Object.entries(m)){
  if(v.id===process.env.GN_CUSTOM_ID){console.log(k);process.exit(0);}
}
console.log("");
')
    if [ -n "$EXISTS" ]; then
        MODEL_KEY="$EXISTS"
    else
        CUSTOM_NAME=$(gum input \
            --placeholder "Gemini 3.6 Flash (Custom)" \
            --header "🏷️  Masukkan Display Name:")
        [ -z "$CUSTOM_NAME" ] && CUSTOM_NAME="$MODEL_KEY"

        GN_MODEL_KEY="$MODEL_KEY" GN_CUSTOM_ID="$CUSTOM_ID" GN_CUSTOM_NAME="$CUSTOM_NAME" bun "$GN_DIR/config.ts" upsert-model "$CONFIG_FILE"
    fi
else
    MODEL_KEY=$(echo "$SELECTED_MODEL" | cut -d'|' -f1 | tr -d ' ')
fi

# ── Update agent model ──
GN_SELECTED_AGENT="$SELECTED_AGENT" GN_MODEL_KEY="$MODEL_KEY" bun "$GN_DIR/config.ts" set-agent-model "$CONFIG_FILE"

echo "💡 Reload opencode untuk mengaktifkan agent $SELECTED_AGENT dengan model $MODEL_KEY."
