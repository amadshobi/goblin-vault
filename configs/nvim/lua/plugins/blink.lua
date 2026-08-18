-- plugins/blink.lua — VS Code-style snippets loader for blink.cmp
return {
  {
    "saghen/blink.cmp",
    opts = {
      keymap = {
        preset = "enter",
        ["<CR>"] = { "accept", "fallback" },
        ["<Tab>"] = { "select_next", "snippet_forward", "fallback" },
        ["<S-Tab>"] = { "select_prev", "snippet_backward", "fallback" },
      },
      snippets = {
        preset = "default",
        expand = function(snippet)
          vim.snippet.expand(snippet)
        end,
      },
      sources = {
        default = { "lsp", "path", "snippets", "buffer" },
      },
    },
  },
}

