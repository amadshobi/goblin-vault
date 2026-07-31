-- plugins/lsp.lua - Minimal LSP config (autocomplete tetap jalan)
-- Hanya pakai LSP dasar, gak banyak hiasan

return {
  -- LSP Config tetap diperlukan untuk autocomplete
  {
    "neovim/nvim-lspconfig",
    opts = {
      -- Daftar LSP servers yang sudah terinstall (pylsp, gopls, ts_ls, marksman)
      servers = {
        -- Konfigurasi global untuk semua LSP server
        ["*"] = {
          capabilities = {
            textDocument = {
              foldingRange = false,
            },
          },
        },
        pylsp = {},
        gopls = {},
        ts_ls = {},
        marksman = { enabled = false },
      },
    },
  },
}