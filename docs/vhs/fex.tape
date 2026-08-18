# ==============================================================================
# VHS Tape: FEX File Explorer Showcase
# Render GIF: vhs docs/vhs/fex.tape
# Output: docs/assets/gif/fex.gif
# ==============================================================================
Output docs/assets/gif/fex.gif

Set Shell "zsh"
Set FontSize 15
Set Width 1200
Set Height 750
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set Margin 20

Type "fex"
Enter
Sleep 1.5s

# Navigate down in Tree mode
Down 2
Sleep 800ms
Down 1
Sleep 800ms

# Switch mode to Flat Find (Instant Tab Switcher)
Tab
Sleep 1.5s
Type "main.go"
Sleep 1s

# Live Ripgrep Streaming Search
Ctrl+F
Sleep 1s
Type "func "
Sleep 1.5s
Escape
Sleep 1s

# Interactive Keybindings Help Popup
Ctrl+H
Sleep 2s
Enter
Sleep 1s

Escape
Sleep 500ms
