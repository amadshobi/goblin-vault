# ==============================================================================
# VHS Tape: GN Subsystem 1 — Benchmarking & Connectivity Probe
# Render GIF: vhs docs/vhs/gn-bench.tape
# Output: docs/assets/gif/gn-bench.gif
# ==============================================================================
Output docs/assets/gif/gn-bench.gif

Set Shell "zsh"
Set FontSize 14
Set Width 1200
Set Height 700
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set Margin 20

# Run speed leaderboard
Type "gn bench --top 5"
Enter
Sleep 4s

# Run probe ping
Type "gn ping"
Enter
Sleep 3s
