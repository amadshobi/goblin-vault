-- plugins/snacks.lua - Simple picker (minimal config)
-- For file explorer and search - keep it minimal

return {
  "folke/snacks.nvim",
  opts = {
    terminal = {
      enabled = true,
      win = {
        style = "float",
        border = "rounded",
      },
    },
    explorer = {
      trash = false,
      replace_netrw = false,
    },
    indent = { enabled = true },  -- hidupin indent guide (garis scope { })
    picker = {
      enabled = true,
      layout = {
        layout = {
          width = 0.9,
          height = 0.7,
        },
      },
      sources = {
        explorer = {
          -- sidebar file tree — lebih kecil biar gak tenggelam
          follow_file = true,
          layout = {
            cycle = true, -- wrap-around scrolling
            layout = {
              width = 0.2,
            },
          },
        },
      },
    },
    -- Icons: pake default Snacks + devicons biar konsisten
    icons = {
      enabled = true,
    },
  },
  config = function()
    -- Panggil manual biar indent guide jalan (gak ngarepin autocmd aja)
    pcall(function()
      require("snacks.indent").enable()
    end)

    vim.api.nvim_create_autocmd("ColorScheme", {
      pattern = "*",
      callback = function()
        -- Sidebar explorer pakai Ayu Dark background
        vim.api.nvim_set_hl(0, "SnacksNormal", { bg = "#1f2430", fg = "#cbccc6" })
        vim.api.nvim_set_hl(0, "SnacksBorder", { bg = "#1f2430", fg = "#73d0ff" })
        -- Indent guide (garis scope { }) — biar keliatan di background transparan
        vim.api.nvim_set_hl(0, "SnacksIndent", { fg = "#3d424f" })
        vim.api.nvim_set_hl(0, "SnacksIndentScope", { fg = "#545b6e" })
      end,
    })
  end,
}