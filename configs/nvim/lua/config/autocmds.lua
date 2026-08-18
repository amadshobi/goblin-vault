-- autocmds.lua — Micro-style autocmds (simplified)
-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
-- Add any additional autocmds here

-- Micro-style: Startup langsung ke blank buffer (tanpa dashboard)
vim.api.nvim_create_autocmd("UIEnter", {
  callback = function()
    if vim.fn.argc() == 0 then
      vim.cmd("enew")
    end
  end,
})

-- Micro-style: Return to last cursor position when opening file
vim.api.nvim_create_autocmd("BufReadPost", {
  pattern = "*",
  callback = function()
    local line = vim.fn.line("'\"")
    if line > 1 and line <= vim.fn.line("$") then
      vim.cmd('normal g`"zv')
    end
  end,
})

-- Auto-reload file when changed from outside (mirip Micro behavior)
vim.api.nvim_create_autocmd({ "FocusGained", "BufEnter" }, {
  pattern = "*",
  command = "checktime",
})

-- Highlight yanked text (feedback visual seperti Micro)
vim.api.nvim_create_autocmd("TextYankPost", {
  pattern = "*",
  callback = function()
    vim.highlight.on_yank({ higroup = "IncSearch", timeout = 200 })
  end,
})

-- Auto-create parent directory when saving file
vim.api.nvim_create_autocmd("BufWritePre", {
  pattern = "*",
  callback = function()
    local dir = vim.fn.expand("%:p:h")
    if vim.fn.isdirectory(dir) == 0 then
      vim.fn.mkdir(dir, "p")
    end
  end,
})

-- Disable swap/backup (mirip Micro yang minimalisir file)
vim.api.nvim_create_autocmd({ "BufNewFile", "BufRead" }, {
  pattern = "*",
  callback = function()
    vim.opt_local.swapfile = false
    vim.opt_local.backup = false
    vim.opt_local.writebackup = false
  end,
})

-- Auto-close terminal buffer on exit
vim.api.nvim_create_autocmd("TermClose", {
  pattern = "*",
  callback = function()
    vim.cmd("normal! i")
  end,
})

-- Auto-save on leaving insert mode (lebih ringan dari CursorHoldI)
vim.api.nvim_create_autocmd("InsertLeave", {
  pattern = "*",
  callback = function()
    local buf = vim.api.nvim_get_current_buf()
    local bt = vim.bo[buf].buftype
    if bt == "" and vim.bo[buf].modified then
      vim.cmd("silent! write")
    end
  end,
})

-- ============ MICRO-STYLE: matiin read-only + auto insert ============
-- Bersihin flag readonly biar file bisa diedit (gak ke-lock read-only)
vim.api.nvim_create_autocmd("BufReadPost", {
  pattern = "*",
  callback = function()
    vim.opt_local.readonly = false
  end,
})

-- Auto masuk insert mode tiap buka buffer (kayak Micro)
-- Hanya di BufReadPost (file baru dibuka), bukan BufEnter (switch window)
vim.api.nvim_create_autocmd("BufReadPost", {
  callback = function()
    local ft = vim.bo.filetype
    -- Skip buffer khusus biar gak ngaco
    if ft == "" or ft == "help" or ft == "qf"
      or ft:match("snacks") or ft:match("Telescope") then
      return
    end
    -- Cuma insert kalau buffer bisa ditulis & kita di normal mode
    if not vim.bo.modifiable or vim.bo.readonly then
      return
    end
    if vim.fn.mode() == "n" then
      vim.cmd("startinsert")
    end
  end,
})

-- ============ STATUSLINE MINIMAL (Micro-style) ============
-- Simple statusline: filename, modified, filetype, position
vim.o.statusline = "%f%( %m%) %=%y %l:%c"

-- ============ CUSTOM DICTIONARY AUTOCOMPLETE ============
local dict_file = vim.fn.expand("~/.config/nvim/dict/fronmatter-yml.md")
vim.api.nvim_create_autocmd("FileType", {
  pattern = { "markdown", "yaml", "yml" },
  callback = function()
    if vim.fn.filereadable(dict_file) == 1 then
      vim.opt_local.dictionary:append(dict_file)
    end
  end,
})
