#!/usr/bin/env bash
# ============================================================
# fe-helper.sh — Static wrapper for fzf execute() bindings
# Letak: tools-cli/src/fe/fe-helper.sh
#
# Dipanggil dari binding fzf execute() untuk nge-source functions
# dan execute command. Path absolut — gak butuh env variable.
#
# Usage: fe-helper.sh <function_name> [args...]
# Example: fe-helper.sh fe_rename_selected '/path/to/file'
# ============================================================

FE_LIB_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
source "$FE_LIB_DIR/ui.sh"
"$@"
