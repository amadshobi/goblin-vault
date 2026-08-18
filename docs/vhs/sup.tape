# ==============================================================================
# VHS Tape: SUP Package Updater Showcase
# Render GIF: vhs docs/vhs/sup.tape
# Output: docs/assets/gif/sup-demo.gif
# ==============================================================================
Output docs/assets/gif/sup-demo.gif

Set Shell "zsh"
Set FontSize 15
Set Width 1200
Set Height 750
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set Margin 20

Type "sup"
Enter
Sleep 2.5s

# Down and select targets in Clack multi-select
Down 1
Sleep 800ms
Space
Sleep 600ms
Down 1
Sleep 800ms
Space
Sleep 1s

# Cancel gracefully with Escape / Ctrl+C
Ctrl+C
Sleep 1s
