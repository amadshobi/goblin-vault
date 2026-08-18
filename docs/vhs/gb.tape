# ==============================================================================
# VHS Tape: GB GitHub Assistant Showcase
# Render GIF: vhs docs/vhs/gb.tape
# Output: docs/assets/gif/gb-demo.gif
# ==============================================================================
Output docs/assets/gif/gb-demo.gif

Set Shell "zsh"
Set FontSize 15
Set Width 1200
Set Height 750
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set Margin 20

Type "gb"
Enter
Sleep 2.5s

# Navigate options
Down 1
Sleep 800ms
Down 1
Sleep 800ms

# Cancel gracefully
Ctrl+C
Sleep 1s
