# ==============================================================================
# VHS Tape: GN Hero Power Sequence (All-in-One Showcase)
# Render GIF: vhs docs/vhs/gn.tape
# Output: docs/assets/gif/gn-demo.gif
# ==============================================================================
Output docs/assets/gif/gn-demo.gif

Set Shell "zsh"
Set FontSize 14
Set Width 1200
Set Height 800
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set Margin 20

# 1. Main banner & command overview
Type "gn"
Enter
Sleep 2.5s

# 2. Speed leaderboard benchmark
Type "gn bench --top 3"
Enter
Sleep 3.5s

# 3. Live quota progress bar
Type "gn u"
Enter
Sleep 2.5s

# 4. Token tree breakdown
Type "gn u -t"
Enter
Sleep 3s

# 5. Tree health doctor
Type "gn doctor"
Enter
Sleep 3s
