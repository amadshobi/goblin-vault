# ==============================================================================
# VHS Tape: GN Subsystem 3 — Zero-Secret Health Doctor & Config Manager
# Render GIF: vhs docs/vhs/gn-doctor.tape
# Output: docs/assets/gif/gn-doctor.gif
# ==============================================================================
Output docs/assets/gif/gn-doctor.gif

Set Shell "zsh"
Set FontSize 14
Set Width 1200
Set Height 700
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set Margin 20

# Run tree-structured diagnostic doctor
Type "gn doctor"
Enter
Sleep 3.5s

# Run config overview
Type "gn config"
Enter
Sleep 3s
