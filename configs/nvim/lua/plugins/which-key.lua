-- plugins/which-key.lua — WhichKey dengan delay panjang biar gak popup tiap spasi
-- LazyVim butuh which-key buat register keybinding <leader>, jadi jangan di-disable
-- Tapi kita kasih delay 5 detik biar gak annoying

return {
  "folke/which-key.nvim",
  opts = {
    -- Delay 5 detik di normal mode — efektif non-aktif buat daily use
    -- Tapi which-key tetap registered, jadi LazyVim gak error
    delay = function(ctx)
      if ctx.mode == "n" then
        return 5000
      end
      return 300
    end,
    icons = {
      -- Gak perlu tampilin icon keymap di popup
      mappings = false,
    },
    -- Jangan tampilin keymap hints di cmdline juga
    show_help = false,
  },
}
