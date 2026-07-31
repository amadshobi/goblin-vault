-- keymaps.lua — Micro-style keybindings (simplified)
-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

local map = vim.keymap.set
local opts = { noremap = true, silent = true }

-- ============ INSERT MODE (mirip Micro) ============

-- Ctrl-S: Save (dari mode INSERT dan NORMAL)
-- Micro: Ctrl-S to save
map("i", "<C-s>", "<Esc>:w<CR>", opts)
map("n", "<C-s>", ":w<CR>", opts)
map("v", "<C-s>", "<Esc>:w<CR>", opts)

-- Ctrl-Q: Quit
-- Micro: Ctrl-Q to quit
map("n", "<C-q>", ":q<CR>", opts)
map("i", "<C-q>", "<Esc>:q<CR>", opts)

-- Ctrl-Z: Undo
-- Micro: Ctrl-Z to undo (khusus insert mode)
map("i", "<C-z>", "<Esc>ui", opts)
map("n", "<C-z>", "u", opts)

-- Ctrl-Y: Redo
-- Micro: Ctrl-Y to redo
map("i", "<C-y>", "<Esc><C-r>i", opts)
map("n", "<C-y>", "<C-r>", opts)

-- Ctrl-A: Select all
-- Micro: Ctrl-A to select all
map("n", "<C-a>", "ggVG", opts)
map("i", "<C-a>", "<Esc>ggVG", opts)

-- Ctrl-D: Duplicate line
-- Micro: Ctrl-D duplicate line
map("n", "<C-d>", "yyp", opts)
map("i", "<C-d>", "<Esc>yypi", opts)

-- Ctrl-K: Delete line
-- Micro: Ctrl-K delete line
map("n", "<C-k>", "dd", opts)
map("i", "<C-k>", "<Esc>ddi", opts)

-- Ctrl-N: New file / buffer
-- Micro: Ctrl-N new tab
map("n", "<C-n>", ":enew<CR>", opts)

-- Ctrl-W: Close buffer
-- Micro: Ctrl-W close tab
map("n", "<C-w>", ":bd<CR>", opts)

-- Ctrl-F: Search / find
-- Micro: Ctrl-F for find
map("n", "<C-f>", function()
  local ok, snacks = pcall(require, "snacks")
  if ok then
    snacks.picker.grep()
  else
    vim.cmd("/")
  end
end, opts)
map("i", "<C-f>", "<Esc><C-f>", opts)

-- Ctrl-H: Replace (grep string under cursor)
-- Micro: Ctrl-H replace
map("n", "<C-h>", function()
  local ok, snacks = pcall(require, "snacks")
  if ok then
    snacks.picker.grep_word()
  else
    vim.cmd("Telescope grep_string")
  end
end, opts)

-- Ctrl-V: Paste
-- Micro: Ctrl-V paste (override visual-block di insert mode saja)
map("i", "<C-v>", "<C-r>+", opts)
map("v", "<C-v>", "p", opts)
map("n", "<C-v>", "p", opts)

-- Ctrl-C: Copy (visual mode only)
map("v", "<C-c>", '"+y', opts)

-- Ctrl-X: Cut (visual mode)
map("v", "<C-x>", '"+d', opts)

-- Alt-Up / Alt-Down: Move line
-- Micro: Alt-Up/Down move line
map("n", "<A-Up>", ":m .-2<CR>===", opts)
map("n", "<A-Down>", ":m .+1<CR>===", opts)
map("i", "<A-Up>", "<Esc>:m .-2<CR>==i", opts)
map("i", "<A-Down>", "<Esc>:m .+1<CR>==i", opts)
map("v", "<A-Up>", ":m '<-2<CR>gv=gv", opts)
map("v", "<A-Down>", ":m '>+1<CR>gv=gv", opts)

-- Alt-Shift-Up / Alt-Shift-Down: Duplicate line (VS Code style)
map("n", "<A-S-Up>", "yyP", opts)
map("n", "<A-S-Down>", "yyp", opts)
map("i", "<A-S-Up>", "<Esc>yyPi", opts)
map("i", "<A-S-Down>", "<Esc>yypi", opts)
map("v", "<A-S-Up>", "y`>Pgv", opts)
map("v", "<A-S-Down>", "y`>pgv", opts)

-- Alt-/: Toggle comment
map("n", "<A-/>", "gcc", opts)
map("i", "<A-/>", "<Esc>gcc", opts)
map("v", "<A-/>", "gc", opts)

-- Tab / Shift-Tab: Indent dedent
map("v", "<Tab>", ">gv", opts)
map("v", "<S-Tab>", "<gv", opts)
map("n", "<Tab>", ">>", opts)
map("n", "<S-Tab>", "<<", opts)

-- Home/End: line start/end
map("i", "<Home>", "<Esc>^i", opts)
map("i", "<End>", "<Esc>$a", opts)
map("n", "<Home>", "^", opts)
map("n", "<End>", "$", opts)

-- ============ NORMAL MODE (Essential Only) ============

-- Ctrl-E: Command bar (Micro style) - OVERRIDE Neovim default scroll down
-- Ini penting: Ctrl-E di Micro = command mode
map("n", "<C-e>", ":", { noremap = true })
map("i", "<C-e>", "<Esc>:", { noremap = true })

-- Ctrl-Left / Ctrl-Right: word navigation
map("i", "<C-Left>", "<Esc>bi", opts)
map("i", "<C-Right>", "<Esc>wi", opts)
map("n", "<C-Left>", "b", opts)
map("n", "<C-Right>", "w", opts)

-- Ctrl-Backspace: delete word before cursor
map("i", "<C-Backspace>", "<C-w>", opts)
map("n", "<C-Backspace>", "db", opts)

-- Ctrl-Delete: delete word after cursor
map("i", "<C-Delete>", "<Esc>dw", opts)
map("n", "<C-Delete>", "dw", opts)

-- Del: delete character under cursor (Neovim gak map <Del> di Normal by default)
map("n", "<Del>", "x", opts)
map("x", "<Del>", "d", opts)  -- "x" = semua visual mode (v, V, Ctrl-V)
map("i", "<Del>", "<C-o>x", opts)

-- Backspace: delete selection di visual mode (VS Code style)
map("x", "<BS>", "d", opts)

-- ============ MODE TOGGLE: EDIT <-> READ/COMMAND (Micro-style) ============
-- Default buka file = insert (edit). Ctrl+R = mode read-only/command
-- (normal) buat :command & /search. Ctrl+R lagi = balik insert.
map("i", "<C-r>", function()
  vim.opt_local.readonly = true
  vim.cmd("stopinsert")
end, opts)

map("n", "<C-r>", function()
  vim.opt_local.readonly = false
  vim.cmd("startinsert")
end, opts)

-- Alt-, dan Alt-. untuk navigasi buffer (mirip Micro tab switching)
map("n", "<A-,>", ":bprevious<CR>", opts)
map("n", "<A-.>", ":bnext<CR>", opts)

-- ============ FILE EXPLORER (Simple) ============
-- Micro punya FileManager, di LazyVim pakai Snacks picker explorer
map("n", "<C-o>", function()
  local ok, snacks = pcall(require, "snacks")
  if ok then
    -- Buka file tree di folder file yang aktif (bukan cwd terminal)
    local buf_dir = vim.fn.expand("%:p:h")
    local explorer_opts = {}
    if buf_dir ~= "" then
      explorer_opts.cwd = buf_dir
    end
    snacks.picker.explorer(explorer_opts)
  else
    vim.cmd("Neotree toggle reveal")
  end
end, opts)