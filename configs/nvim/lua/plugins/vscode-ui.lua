-- plugins/vscode-ui.lua — VS Code-like UI enhancements
-- Sticky scroll, rainbow brackets, winbar breadcrumbs

return {
  -- 1) Sticky scroll — scope context stuck di atas window (VS Code stickyScroll)
  {
    "nvim-treesitter/nvim-treesitter-context",
    event = "VeryLazy",
    opts = {
      enable = true,
      max_lines = 5,
      trim_scope = "outer",
      patterns = {
        default = {
          "class",
          "function",
          "method",
          "for",
          "while",
          "if",
          "switch",
          "case",
        },
      },
    },
  },

  -- 2) Rainbow bracket pairs — VS Code bracketPairColorization
  {
    "HiPhish/rainbow-delimiters.nvim",
    event = "VeryLazy",
    config = function()
      local rainbow = require("rainbow-delimiters")
      vim.g.rainbow_delimiters = {
        strategy = {
          [""] = rainbow.strategy["global"],
          vim = rainbow.strategy["local"],
        },
        query = {
          [""] = "rainbow-delimiters",
          lua = "rainbow-blocks",
        },
        highlight = {
          "RainbowDelimiterRed",
          "RainbowDelimiterYellow",
          "RainbowDelimiterBlue",
          "RainbowDelimiterOrange",
          "RainbowDelimiterGreen",
          "RainbowDelimiterViolet",
          "RainbowDelimiterCyan",
        },
      }
    end,
  },

  -- 3) Winbar breadcrumbs — LSP current symbol (VS Code breadcrumbs)
  {
    "SmiteshP/nvim-navic",
    lazy = true,
    event = "VeryLazy",
    init = function()
      --- Winbar render: file + breadcrumb
      local function update_winbar()
        local buf = vim.api.nvim_get_current_buf()

        -- Skip special buffers
        local ft = vim.bo[buf].filetype
        if ft == "" or ft == "help" or ft == "qf" or ft == "TelescopePrompt" or ft == "snacks_picker_list" then
          vim.wo.winbar = ""
          return
        end

        local fname = vim.fn.fnamemodify(vim.api.nvim_buf_get_name(buf), ":.")
        if fname == "" then
          vim.wo.winbar = ""
          return
        end

        local modified = vim.bo[buf].modified and " +" or ""

        --- Try navic breadcrumbs
        local navic_ok, navic = pcall(require, "nvim-navic")
        local breadcrumbs = ""
        if navic_ok and navic.is_available() then
          local ok, loc = pcall(navic.get_location, {})
          if ok and loc and loc ~= "" then
            breadcrumbs = "    " .. loc
          end
        end

        vim.wo.winbar = (" %s%s%s "):format(fname, modified, breadcrumbs)
      end

      -- Update winbar on relevant events (CursorMoved dihapus — terlalu berat + error-prone)
      local group = vim.api.nvim_create_augroup("vscode_winbar", { clear = true })
      vim.api.nvim_create_autocmd({ "BufEnter", "BufWinEnter", "InsertLeave", "BufWritePost" }, {
        group = group,
        callback = update_winbar,
      })

      -- Navic attachment to LSP clients
      vim.api.nvim_create_autocmd("LspAttach", {
        group = group,
        callback = function(args)
          local client = vim.lsp.get_client_by_id(args.data.client_id)
          if client and client.server_capabilities.documentSymbolProvider then
            local ok, navic = pcall(require, "nvim-navic")
            if ok and navic then
              navic.attach(client, args.buf)
            end
          end
        end,
      })
    end,
  },
}
