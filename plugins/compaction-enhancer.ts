import type { Plugin } from "@opencode-ai/plugin";

/**
 * Summary-Frame Compaction
 *
 * Kustomisasi compaction prompt biar preserve hal-hal penting:
 * 1. Key decisions — kenapa milih A bukan B
 * 2. In-progress state — fitur/fix yang lagi dikerjain
 * 3. File changes — track file yang udah diubah
 * 4. Error yang belum selesai — biar ga lupa
 * 5. Recent context — keep last N turns verbatim
 *
 * Override `experimental.session.compacting` dengan prompt compaction
 * yang lebih cerdas dari bawaan opencode.
 */

// Track session context untuk di-preserve waktu compaction
const sessionContext = new Map<
  string,
  {
    decisions: string[];
    inProgress: string[];
    fileChanges: string[];
    errors: string[];
    lastActivity: number;
  }
>();

function getContext(sessionId: string) {
  if (!sessionContext.has(sessionId)) {
    sessionContext.set(sessionId, {
      decisions: [],
      inProgress: [],
      fileChanges: [],
      errors: [],
      lastActivity: Date.now(),
    });
  }
  return sessionContext.get(sessionId)!;
}

export default (async () => {
  return {
    /**
     * Track tool calls untuk ngumpulin konteks
     */
    "tool.execute.after": async (input, output) => {
      const sessionId = input.sessionID || "default";
      const ctx = getContext(sessionId);
      const toolId = input.toolID;
      const result = output.result;

      ctx.lastActivity = Date.now();

      // Track edit operations — file changes
      if (["edit", "write", "patch", "multi_patch"].includes(toolId)) {
        const args = input.args || {};
        const filePath = args.filePath || args.file || args.path || "unknown";
        if (filePath && !ctx.fileChanges.includes(filePath)) {
          ctx.fileChanges.push(filePath);
          // Keep only last 20 files
          if (ctx.fileChanges.length > 20) {
            ctx.fileChanges = ctx.fileChanges.slice(-20);
          }
        }
      }

      // Track errors
      if (result && typeof result === "object" && result.error) {
        const errMsg =
          typeof result.error === "string"
            ? result.error.slice(0, 200)
            : "Unknown error";
        if (!ctx.errors.includes(errMsg)) {
          ctx.errors.push(errMsg);
          if (ctx.errors.length > 10) {
            ctx.errors = ctx.errors.slice(-10);
          }
        }
      }

      // Track in-progress from bash/command output
      if (toolId === "bash" || toolId === "shell") {
        const cmd = (input.args?.[0] || input.args?.command || "").slice(0, 100);
        if (
          cmd.match(/npm (run|start|test|build|dev)/) ||
          cmd.match(/bun (run|start|test|build|dev)/) ||
          cmd.match(/npx/) ||
          cmd.match(/make/) ||
          cmd.match(/cargo/) ||
          cmd.match(/go (run|build|test)/)
        ) {
          const progressNote = `Running: ${cmd}`;
          if (!ctx.inProgress.includes(progressNote)) {
            ctx.inProgress.push(progressNote);
            if (ctx.inProgress.length > 10) {
              ctx.inProgress = ctx.inProgress.slice(-10);
            }
          }
        }
      }
    },

    /**
     * Kustomisasi compaction prompt
     * Hook ini dipanggil SEBELUM compaction terjadi
     * Kita bisa nambahin context yang mau di-preserve
     */
    "experimental.session.compacting": async (_input, output) => {
      const sessionId = _input.sessionID || "default";
      const ctx = getContext(sessionId);

      const contextParts: string[] = [
        "=== SUMMARY-FRAME COMPACTION ===",
        "",
      ];

      // Key Decisions
      if (ctx.decisions.length > 0) {
        contextParts.push("📌 KEY DECISIONS:");
        for (const d of ctx.decisions) {
          contextParts.push(`  • ${d}`);
        }
        contextParts.push("");
      }

      // In Progress
      if (ctx.inProgress.length > 0) {
        contextParts.push("🔄 IN PROGRESS:");
        for (const p of ctx.inProgress) {
          contextParts.push(`  • ${p}`);
        }
        contextParts.push("");
      }

      // File Changes
      if (ctx.fileChanges.length > 0) {
        contextParts.push("📁 FILES CHANGED:");
        for (const f of ctx.fileChanges) {
          contextParts.push(`  • ${f}`);
        }
        contextParts.push("");
      }

      // Errors
      if (ctx.errors.length > 0) {
        contextParts.push("❌ UNRESOLVED ERRORS:");
        for (const e of ctx.errors) {
          contextParts.push(`  • ${e}`);
        }
        contextParts.push("");
      }

      if (contextParts.length <= 1) {
        contextParts.push("(no tracked context — compaction as usual)");
        contextParts.push("");
      }

      // Add instructions for compaction
      contextParts.push("=== COMPACTION INSTRUCTIONS ===");
      contextParts.push("");
      contextParts.push("When compacting this conversation, PRESERVE:");
      contextParts.push("1. Key architectural decisions and why they were made");
      contextParts.push("2. Current in-progress work and its status");
      contextParts.push("3. Files that have been modified and what changed");
      contextParts.push("4. Unresolved errors or bugs still being investigated");
      contextParts.push("5. The last 2 user turns verbatim");
      contextParts.push("");
      contextParts.push("You MAY discard:");
      contextParts.push("- Successful tool outputs that are no longer relevant");
      contextParts.push("- Failed attempts that have been superseded");
      contextParts.push("- Chat history that doesn't affect current direction");
      contextParts.push("");

      // Set the context — this will be appended to the compaction prompt
      output.context = [...(output.context || []), contextParts.join("\n")];
    },
  };
}) satisfies Plugin;
