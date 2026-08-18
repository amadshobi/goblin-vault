-- plugins/formatting.lua — Auto format on save & Auto rename/close HTML/JSX tags

return {
  -- 1) Conform.nvim: Auto-format on Save
  {
    "stevearc/conform.nvim",
    event = { "BufWritePre" },
    cmd = { "ConformInfo" },
    opts = {
      formatters_by_ft = {
        lua = { "stylua" },
        python = { "isort", "black" },
        javascript = { "prettier", "prettierd", stop_after_first = true },
        typescript = { "prettier", "prettierd", stop_after_first = true },
        javascriptreact = { "prettier", "prettierd", stop_after_first = true },
        typescriptreact = { "prettier", "prettierd", stop_after_first = true },
        json = { "prettier", "prettierd", stop_after_first = true },
        html = { "prettier", "prettierd", stop_after_first = true },
        css = { "prettier", "prettierd", stop_after_first = true },
        go = { "gofmt", "goimports" },
      },
      format_on_save = {
        timeout_ms = 500,
        lsp_fallback = true,
      },
    },
  },

  -- 2) Auto rename & auto close tag di HTML / JSX / TSX
  {
    "windwp/nvim-ts-autotag",
    event = "InsertEnter",
    opts = {},
  },

  -- 3) Multi-cursor support (VS Code Ctrl+D / Ctrl+N style)
  {
    "mg979/vim-visual-multi",
    event = "VeryLazy",
    init = function()
      vim.g.VM_maps = {
        ["Find Under"] = "<C-d>", -- Ctrl+D buat select word berikutnya mirip VS Code
        ["Find Subword Under"] = "<C-d>",
      }
    end,
  },
}
