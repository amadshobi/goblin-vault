-- plugins/gitsigns.lua — Git signs (Micro diffgutter)
return {
  "lewis6991/gitsigns.nvim",
  opts = {
    signs = {
      add = { text = "+" },
      change = { text = "~" },
      delete = { text = "_" },
      topdelete = { text = "‾" },
      changedelete = { text = "~" },
    },
    current_line_blame = false, -- biar ringan
    preview_config = { border = "none" },
  },
}