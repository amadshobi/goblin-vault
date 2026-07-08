-- init.lua — Goblin micro config
-- Enhanced: buffer tracking, smart tab management
--
-- Keybinds (defined in bindings.json):
--   Ctrl+r = closeRightmost  |  Ctrl+l = closeLeftmost

local micro = import("micro")

-- Close rightmost tab
function closeRightmost(bp)
    bp:LastTab()
    bp:Quit()
    return true
end

-- Close leftmost tab
function closeLeftmost(bp)
    bp:FirstTab()
    bp:Quit()
    return true
end

-- Track buffer opens (for logging / future use)
function onBufferOpen(buf)
    if buf and buf.Path then
        -- Buffer opened — micro handles autosave via settings
    end
end
