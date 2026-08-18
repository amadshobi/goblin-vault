# ==============================================================================
# VHS Tape: Goblin Vault All-in-One Installer Showcase
# Render GIF: vhs docs/vhs/installer.tape
# Output: docs/assets/gif/installer-demo.gif
# ==============================================================================
Output docs/assets/gif/installer-demo.gif

Set Shell "zsh"
Set FontSize 15
Set Width 1200
Set Height 750
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set Margin 20

Type "./scripts/install.sh --yes"
Enter
Sleep 6s
