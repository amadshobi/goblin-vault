#!/usr/bin/env bash
# ═══════════════════════════════════════════════════
# GOBLIN VAULT MODULAR RELEASE ENGINE
# ═══════════════════════════════════════════════════
set -euo pipefail

VAULT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

show_help() {
    echo "🧙‍♂️ Goblin Vault Modular Release Engine"
    echo ""
    echo "Usage: ./scripts/release.sh [target] <patch|minor|major|x.y.z>"
    echo ""
    echo "Targets:"
    echo "  vault, all      🚀 Global Vault release (update VERSION, CHANGELOG, and create Git Tag)"
    echo "  fex             📂 Release version for fex (Go file explorer)"
    echo "  gn              🧙‍♂️ Release version for Goblin Nexus CLI"
    echo "  zf              ⚡ Release version for ZF Navigation Engine"
    echo "  ocm             ⚙️ Release version for OpenCode Configurator"
    echo "  gh-blin         🐙 Release version for GitHub Assistant TUI"
    echo ""
    echo "Examples:"
    echo "  ./scripts/release.sh vault minor   (0.3.0 -> 0.4.0 + Git Tag v0.4.0)"
    echo "  ./scripts/release.sh fex patch     (0.2.0 -> 0.2.1)"
    echo "  ./scripts/release.sh zf patch      (1.2.0 -> 1.2.1)"
    echo "  ./scripts/release.sh gn minor      (2.0.0 -> 2.1.0)"
    exit 1
}

if [ $# -lt 1 ]; then
    show_help
fi

TARGET="vault"
BUMP_TYPE=""

if [ $# -eq 1 ]; then
    BUMP_TYPE="$1"
else
    TARGET="$1"
    BUMP_TYPE="$2"
fi

# 1. Health Audit (Blocking)
echo "🔍 Running pre-release health audit..."
bash "$VAULT_DIR/scripts/check_syntax.sh"
bash "$VAULT_DIR/scripts/doctor.sh"

echo "────────────────────────────────────────"

calculate_next_version() {
    local current="$1"
    local bump="$2"
    node -e '
        const current = "'"$current"'".replace(/^v/, "");
        const parts = current.split(".").map(n => parseInt(n, 10) || 0);
        while (parts.length < 3) parts.push(0);
        let bump = "'"$bump"'";
        let next = "";
        if (bump === "patch") {
            parts[2] += 1;
            next = parts.join(".");
        } else if (bump === "minor") {
            parts[1] += 1;
            parts[2] = 0;
            next = parts.join(".");
        } else if (bump === "major") {
            parts[0] += 1;
            parts[1] = 0;
            parts[2] = 0;
            next = parts.join(".");
        } else if (/^\d+\.\d+\.\d+$/.test(bump)) {
            next = bump;
        } else {
            console.error("INVALID_BUMP");
            process.exit(1);
        }
        console.log(next);
    '
}

case "$TARGET" in
    vault|all)
        VERSION_FILE="$VAULT_DIR/VERSION"
        CURRENT_VER=$(cat "$VERSION_FILE" 2>/dev/null || echo "0.3.0")
        NEW_VER=$(calculate_next_version "$CURRENT_VER" "$BUMP_TYPE")
        echo "$NEW_VER" > "$VERSION_FILE"
        echo "📦 Bumping Global Vault version: v$CURRENT_VER -> v$NEW_VER"
        
        cd "$VAULT_DIR"
        git add VERSION
        if [ -f CHANGELOG.md ]; then
            git add CHANGELOG.md
        fi
        git commit -m "chore(release): bump vault to v$NEW_VER" || true
        TAG_NAME="v$NEW_VER"
        git tag -a "$TAG_NAME" -m "Vault Release $TAG_NAME" --force
        echo "🎉 GLOBAL VAULT RELEASE SUCCESS! Tag: $TAG_NAME"
        ;;

    fex)
        FEX_ROOT_FILE="$VAULT_DIR/tools-cli/src/fex/cmd/root.go"
        CURRENT_VER=$(grep -E 'Version\s*=\s*"' "$FEX_ROOT_FILE" | sed -E 's/.*"([^"]+)".*/\1/')
        NEW_VER=$(calculate_next_version "$CURRENT_VER" "$BUMP_TYPE")
        sed -i -E 's/(Version\s*=\s*")[^"]+(")/\1'"$NEW_VER"'\2/' "$FEX_ROOT_FILE"
        echo "📂 Bumping fex version: v$CURRENT_VER -> v$NEW_VER"
        
        # Rebuild fex binary
        echo "🔨 Rebuilding fex Go binary..."
        (cd "$VAULT_DIR/tools-cli/src/fex" && go build -o "$HOME/.local/bin/fex" ./cmd/fex/)
        
        cd "$VAULT_DIR"
        git add "$FEX_ROOT_FILE"
        git commit -m "chore(release): bump fex to v$NEW_VER" || true
        echo "🎉 FEX RELEASE SUCCESS! Version: v$NEW_VER"
        ;;

    gn)
        GN_SH="$VAULT_DIR/tools-cli/src/gn/gn.sh"
        CURRENT_VER=$(grep -E 'Goblin Nexus Proxy CLI v' "$GN_SH" | sed -E 's/.*v([0-9\.]+).*/\1/' | head -1 || echo "2.0.0")
        NEW_VER=$(calculate_next_version "$CURRENT_VER" "$BUMP_TYPE")
        sed -i -E 's/(Goblin Nexus Proxy CLI v)[0-9\.]+/\1'"$NEW_VER"'/' "$GN_SH"
        echo "🧙‍♂️ Bumping Goblin Nexus CLI version: v$CURRENT_VER -> v$NEW_VER"
        
        cd "$VAULT_DIR"
        git add "$GN_SH"
        git commit -m "chore(release): bump gn to v$NEW_VER" || true
        echo "🎉 GOBLIN NEXUS RELEASE SUCCESS! Version: v$NEW_VER"
        ;;

    zf)
        ZF_SH="$VAULT_DIR/tools-cli/src/zf/zf.sh"
        CURRENT_VER=$(grep -E 'v[0-9\.]+' "$ZF_SH" | head -1 | sed -E 's/.*v([0-9\.]+).*/\1/' || echo "1.2.0")
        NEW_VER=$(calculate_next_version "$CURRENT_VER" "$BUMP_TYPE")
        sed -i -E 's/v'"$CURRENT_VER"'/v'"$NEW_VER"'/g' "$ZF_SH"
        echo "⚡ Bumping ZF Navigation Engine version: v$CURRENT_VER -> v$NEW_VER"
        
        cd "$VAULT_DIR"
        git add "$ZF_SH"
        git commit -m "chore(release): bump zf to v$NEW_VER" || true
        echo "🎉 ZF RELEASE SUCCESS! Version: v$NEW_VER"
        ;;

    ocm)
        OCM_PKG="$VAULT_DIR/tools-cli/src/ocm/package.json"
        CURRENT_VER=$(node -e 'console.log(require("'"$OCM_PKG"'").version || "1.0.0")')
        NEW_VER=$(calculate_next_version "$CURRENT_VER" "$BUMP_TYPE")
        node -e '
            const fs = require("fs");
            const p = "'"$OCM_PKG"'";
            const json = JSON.parse(fs.readFileSync(p, "utf8"));
            json.version = "'"$NEW_VER"'";
            fs.writeFileSync(p, JSON.stringify(json, null, 2) + "\n");
        '
        echo "⚙️ Bumping OCM version: v$CURRENT_VER -> v$NEW_VER"
        
        cd "$VAULT_DIR"
        git add "$OCM_PKG"
        git commit -m "chore(release): bump ocm to v$NEW_VER" || true
        echo "🎉 OCM RELEASE SUCCESS! Version: v$NEW_VER"
        ;;

    *)
        echo "❌ Target '$TARGET' tidak dikenal."
        show_help
        ;;
esac