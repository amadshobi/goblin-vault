#!/usr/bin/env bash
# ============================================================
# worktree.sh — Git Worktree Manager
# Letak: scripts/worktree.sh
# ============================================================
# 
# Fitur:
#   - worktree add <branch> [folder]   — bikin worktree baru
#   - worktree list                     — list semua worktree + info
#   - worktree remove <folder|branch>   — hapus worktree aman
#   - worktree prune                    — cleanup metadata stale
#
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ──────────────────────────────────────────────
# HELP
# ──────────────────────────────────────────────
show_help() {
    cat <<EOF
worktree.sh -- Git Worktree Manager

Usage:
  worktree add <branch> [folder]         Buat worktree baru
  worktree list                           List semua worktree + status
  worktree remove <folder|branch>         Hapus worktree dengan aman
  worktree prune                          Bersihkan metadata stale
  worktree -h, --help                     Tampilkan ini

Examples:
  worktree add feat/scripts
  worktree add feat/scripts goblin-vault-scripts
  worktree add fix/bug-123 ../bugfix
  worktree list
  worktree remove goblin-vault-scripts
EOF
    exit 0
}

# ──────────────────────────────────────────────
# LIST — tampilin semua worktree + status git
# ──────────────────────────────────────────────
cmd_list() {
    echo "Git Worktree List"
    echo "──────────────────────────────────────────────────────"

    local wt_list=()
    while IFS= read -r line; do
        wt_list+=("$line")
    done < <(git worktree list 2>/dev/null || true)

    local count=0
    for wt_entry in "${wt_list[@]}"; do
        [[ -z "$wt_entry" ]] && continue

        # Parse: /path hash [branch]
        local wt_path wt_hash wt_branch
        read -r wt_path wt_hash wt_branch <<< "$wt_entry"
        [[ -z "$wt_path" ]] && continue

        count=$((count + 1))
        local branch_display="${wt_branch#[}"  # hilangkan [
        branch_display="${branch_display%]}"   # hilangkan ]

        # Cek status git di worktree
        local status_output=""
        local status_icon="[OK]"
        if [[ -d "$wt_path" ]]; then
            status_output="$(cd "$wt_path" && git status --short 2>/dev/null || true)"
            if [[ -n "$status_output" ]]; then
                status_icon="[!!]"
            fi
        else
            status_icon="[MISSING]"
        fi

        # Abbreviate path
        local short_path="${wt_path/#$HOME/~}"

        printf "  %-8s %-30s %-20s %-12s\n" \
            "$status_icon" "$short_path" "$branch_display" "${wt_hash:0:8}"

        # Tampilin modified files kalo ada
        if [[ -n "$status_output" ]]; then
            local line_count
            line_count=$(echo "$status_output" | wc -l)
            echo "$status_output" | head -5 | while IFS= read -r line; do
                echo "      $line"
            done
            if [[ "$line_count" -gt 5 ]]; then
                echo "      ... dan $((line_count - 5)) file lainnya"
            fi
        fi
    done

    if [[ $count -eq 0 ]]; then
        echo "  (tidak ada worktree)"
    fi

    echo "──────────────────────────────────────────────────────"
    echo "  Total: $count worktree(s)"
}

# ──────────────────────────────────────────────
# ADD — bikin worktree baru
# ──────────────────────────────────────────────
cmd_add() {
    local branch="$1"
    local folder="${2:-}"

    if [[ -z "$branch" ]]; then
        echo "Error: Nama branch wajib diisi."
        echo "  Usage: worktree add <branch> [folder]"
        exit 1
    fi

    # Auto-generate folder name dari branch name kalo nggak dikasih
    if [[ -z "$folder" ]]; then
        folder="$(basename "$branch")"
        folder="../goblin-vault-${folder}"
    else
        # Kalo folder path relatif, relative ke parent repo
        if [[ ! "$folder" =~ ^/ && ! "$folder" =~ ^\.\. ]]; then
            folder="../${folder}"
        fi
    fi

    # Cek apakah branch udah ada (lokal atau remote)
    local branch_exists=false
    local branch_remote=false

    if git show-ref --verify --quiet "refs/heads/$branch" 2>/dev/null; then
        branch_exists=true
    elif git show-ref --verify --quiet "refs/remotes/origin/$branch" 2>/dev/null; then
        branch_exists=true
        branch_remote=true
    fi

    # Cek apakah folder udah ada
    if [[ -e "$folder" ]]; then
        echo "Error: Folder '$folder' sudah ada."
        exit 1
    fi

    echo "Membuat worktree..."
    echo "  Branch:   $branch"
    echo "  Folder:   $folder"

    if [[ "$branch_exists" == true ]]; then
        # Branch udah ada -> checkout
        if [[ "$branch_remote" == true ]]; then
            echo "  Branch '$branch' hanya di remote. Fetching & creating local..."
            git fetch origin "$branch" 2>/dev/null
            git worktree add "$folder" "origin/$branch" 2>&1 | while IFS= read -r line; do
                echo "  -> $line"
            done
        else
            git worktree add "$folder" "$branch" 2>&1 | while IFS= read -r line; do
                echo "  -> $line"
            done
        fi
    else
        # Branch belum ada -- bikin baru dari branch base
        local base_branch=""
        # Deteksi default branch
        for b in main master dev develop; do
            if git show-ref --verify --quiet "refs/heads/$b" 2>/dev/null; then
                base_branch="$b"
                break
            fi
        done
        if [[ -z "$base_branch" ]]; then
            # Fallback ke current HEAD
            base_branch="HEAD"
        fi

        echo "  Branch '$branch' belum ada."
        echo "  Akan dibuat dari '$base_branch'."

        git worktree add -b "$branch" "$folder" "$base_branch" 2>&1 | while IFS= read -r line; do
            echo "  -> $line"
        done
    fi

    echo ""
    echo "Worktree berhasil dibuat!"
    echo "  Path:   $(cd "$folder" && pwd)"
    echo "  Branch: $(cd "$folder" && git branch --show-current)"
}

# ──────────────────────────────────────────────
# REMOVE — hapus worktree dengan aman
# ──────────────────────────────────────────────
cmd_remove() {
    local target="$1"

    if [[ -z "$target" ]]; then
        echo "Error: Nama folder atau branch wajib diisi."
        echo "  Usage: worktree remove <folder|branch>"
        echo "  Tips:  Jalankan 'worktree list' dulu buat liat nama."
        exit 1
    fi

    # Cari worktree yang match dengan folder atau branch
    local match_path=""
    local match_branch=""

    while IFS=' ' read -r wt_path wt_hash wt_branch; do
        [[ -z "$wt_path" ]] && continue
        local branch_display="${wt_branch#[}"
        branch_display="${branch_display%]}"
        local folder_name
        folder_name="$(basename "$wt_path")"

        if [[ "$folder_name" == "$target" || "$branch_display" == "$target" ]]; then
            match_path="$wt_path"
            match_branch="$branch_display"
            break
        fi
    done < <(git worktree list 2>/dev/null || true)

    if [[ -z "$match_path" ]]; then
        echo "Worktree '$target' tidak ditemukan."
        echo "  Coba 'worktree list' dulu."
        exit 1
    fi

    echo "Akan menghapus worktree:"
    echo "  Path:   $match_path"
    echo "  Branch: $match_branch"

    # Lock check -- kalo ada perubahan belum di-commit, peringatan
    if [[ -d "$match_path" ]]; then
        local dirty_count
        dirty_count="$(cd "$match_path" && git status --short 2>/dev/null | wc -l || echo 0)"
        if [[ "$dirty_count" -gt 0 ]]; then
            echo "  Ada $dirty_count file belum di-commit!"
            echo "  Commit atau stash dulu ya BOSS biar aman."
            echo "  Atau lanjutin aja? (y/N) \c"
            read -r confirm
            if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
                echo "  Dibatalkan."
                exit 0
            fi
        fi
    fi

    git worktree remove "$match_path" 2>&1 | while IFS= read -r line; do
        echo "  -> $line"
    done

    echo "Worktree '$target' berhasil dihapus."
}

# ──────────────────────────────────────────────
# PRUNE — cleanup stale metadata
# ──────────────────────────────────────────────
cmd_prune() {
    echo "Pruning stale worktree metadata..."

    local output
    output="$(git worktree prune --verbose 2>&1 || true)"

    if [[ -z "$output" ]]; then
        echo "  Tidak ada metadata stale. Bersih!"
    else
        echo "$output" | while IFS= read -r line; do
            echo "  -> $line"
        done
        echo "Prune selesai."
    fi
}

# ──────────────────────────────────────────────
# MAIN — dispatch command
# ──────────────────────────────────────────────
main() {
    local cmd="${1:-help}"
    shift 2>/dev/null || true

    case "$cmd" in
        add|a)
            cmd_add "${1:-}" "${2:-}"
            ;;
        list|ls|l)
            cmd_list
            ;;
        remove|rm|delete|del)
            cmd_remove "${1:-}"
            ;;
        prune|p)
            cmd_prune
            ;;
        -h|--help|help)
            show_help
            ;;
        *)
            echo "Perintah '$cmd' nggak dikenal."
            echo "  Usage: worktree {add|list|remove|prune|help}"
            exit 1
            ;;
    esac
}

main "$@"
