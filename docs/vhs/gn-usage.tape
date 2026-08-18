# ==============================================================================
# VHS Tape: GN Subsystem 2 — Telemetry, Multi-Account Quota & Token Tree
# Render GIF: vhs docs/vhs/gn-usage.tape
# Output: docs/assets/gif/gn-usage.gif
# ==============================================================================
Output docs/assets/gif/gn-usage.gif

Set Shell "zsh"
Set FontSize 14
Set Width 1200
Set Height 750
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set Margin 20

# Live multi-account quota
Type "gn u"
Enter
Sleep 3s

# Daily token usage & subagent hierarchy
Type "gn u -t"
Enter
Sleep 3.5s

# File modification audit
Type "gn u -f"
Enter
Sleep 3s
