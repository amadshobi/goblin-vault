-- plugins/colors.lua - Ayu Dark (VS Code Ayu Dark Bordered)
-- Match VS Code color theme

return {
  {
    "Shatur/neovim-ayu",
    priority = 1000,
    lazy = false,
    config = function()
      require("ayu").setup({
        mirage = false,
        terminal = true,
        overrides = {
          -- Transparan buat main editor
          Normal = { bg = "none" },
          ColorColumn = { bg = "none" },
          SignColumn = { bg = "none" },
          Folded = { bg = "none" },
          FoldColumn = { bg = "none" },
          CursorLine = { bg = "none" },
          CursorColumn = { bg = "none" },
          VertSplit = { bg = "none" },
          -- Selection highlight (VS Code style)
          Visual = { bg = "#3d4b6e" },
          -- Float/popup background
          NormalFloat = { bg = "#1f2430" },
          FloatBorder = { bg = "#1f2430", fg = "#565b66" },
          Pmenu = { bg = "#1f2430" },
          PmenuSel = { bg = "#33435c" },
          SnacksNormal = { bg = "#1f2430" },
          SnacksPicker = { bg = "#1f2430" },
          SnacksWinBar = { bg = "#1f2430" },
          WinBar = { bg = "#191e2a" },
          WinBarNC = { bg = "#191e2a" },
          NormalSB = { bg = "#191e2a" },
        },
      })
      vim.cmd.colorscheme("ayu-dark")
    end,
  },
}