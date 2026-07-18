-- plugins/disable.lua - Disable LazyVim plugins yang tidak perlu
-- File ini membuat Neovim minimalis seperti Micro

return {
  -- Disable dashboard/starter - mau startup langsung ke blank buffer
  { "nvimdev/dashboard-nvim", enabled = false },

  -- which-key dipindah ke plugins/which-key.lua (di-delay, bukan di-disable)

  -- Enable gitsigns - diffgutter (Micro diffplugin)
  -- { "lewis6991/gitsigns.nvim", enabled = false },

  -- Disable trouble - untuk error list, terlalu kompleks
  { "folke/trouble.nvim", enabled = false },

  -- Disable todo-comments - gak krusial untuk micro-style
  { "folke/todo-comments.nvim", enabled = false },

  -- Disable flash - fitur search highlight tambahan, terlalu banyak
  { "folke/flash.nvim", enabled = false },

  -- Disable grug-far - external tool, gak perlu built-in
  { "MagicDuck/grug-far.nvim", enabled = false },

  -- Disable catppuccin - kita cuma mau ayu
  { "catppuccin", enabled = false },

  -- Disable tokyonight - pake ayu
  { "folke/tokyonight.nvim", enabled = false },

  -- Disable lualine - pakai statusline native minimal
  { "nvim-lualine/lualine.nvim", enabled = false },

  -- Disable bufferline - pakai buffer line via snacks picker
  { "akinshine/bufferline.nvim", enabled = false },

  -- Disable persistence - gak mau restore session
  { "persistence.nvim", enabled = false },
}