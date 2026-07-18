-- options.lua — VS Code-style options
-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

-- Enable Nerd Font icons (LazyVim icons detection)
vim.g.icons_enabled = true

-- Set LazyVim default colorscheme ke ayu-dark (biar gak nyari tokyonight)
vim.g.lazyvim_colorscheme = "ayu-dark"

local opt = vim.opt

-- ============ PERFORMANCE ============
-- UpTime: 300ms = CursorHold delay (default 4000ms terlalu lambat)
opt.updatetime = 300
opt.timeoutlen = 300 -- key sequence timeout

-- ============ INDENT (enable biar ngetik kode nyaman) ============
opt.autoindent = true  -- lanjut indent baris sebelumnya
opt.smartindent = true -- cerdas untuk { }
opt.cindent = true     -- C-style fallback

-- Tab: VS Code default tabsize 4, spaces
opt.tabstop = 2
opt.shiftwidth = 2
opt.softtabstop = 2
opt.expandtab = true

-- UI
opt.number = true -- line numbers
opt.relativenumber = false
opt.cursorline = true -- highlight baris aktif
opt.wrap = true -- softwrap
opt.linebreak = true -- wrap by word
opt.showbreak = "↳ " -- visual break indicator
opt.scrolloff = 0
opt.sidescrolloff = 0
opt.mouse = "a"          -- mouse support
opt.termguicolors = true -- true color
opt.background = "dark"

-- Font (GUI/Neovide) — VS Code: JetBrains Mono 15, lineHeight 24
vim.opt.guifont = "JetBrainsMono Nerd Font:h15"
vim.opt.linespace = 2 -- tambahan spacing biar mirip lineHeight 24

-- Cursor — show mode via shape (block=normal, line=insert)
vim.opt.guicursor = "n-v-c:block,i-ci-ve:ver25,r-cr:hor20,o:hor50"

-- Clipboard — system clipboard
opt.clipboard = "unnamedplus"

-- Undo file — persistent undo history
opt.undofile = true

-- Search
opt.hlsearch = true
opt.incsearch = true
opt.ignorecase = true
opt.smartcase = true

-- Tabs & buffers
opt.hidden = true
opt.splitright = true
opt.splitbelow = true

-- Indent guides
opt.list = true
opt.listchars = { tab = "» ", trail = "·", nbsp = "␣" }

-- Status line - minimal mode
opt.showmode = false -- mode ditampilin sama plugin statusline
opt.laststatus = 3   -- global statusline
opt.cmdheight = 1    -- cukup 1 baris untuk command line

-- Backup/Swap - minimalisir file di disk
opt.backup = false
opt.writebackup = false
opt.swapfile = false

