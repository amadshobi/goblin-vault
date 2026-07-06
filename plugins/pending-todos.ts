import type { Plugin } from "@opencode-ai/plugin";

/**
 * Pending-Todos Reminder
 *
 * Track todo state via tool calls.
 * Kalo session idle (tool call berhenti) + masih ada pending todos →
 * inject reminder ke system prompt.
 */

interface TodoState {
  items: TodoItem[];
  lastUpdate: number;
  lastToolCall: number;
}

interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority?: string;
}

const sessions = new Map<string, TodoState>();

const IDLE_THRESHOLD_MS = 60000; // 1 minute idle = trigger reminder
const REMINDER_COOLDOWN_MS = 120000; // 2 min between reminders

function getPendingTodos(state: TodoState): TodoItem[] {
  return state.items.filter(
    (t) => t.status === "pending" || t.status === "in_progress"
  );
}

function buildReminder(pending: TodoItem[]): string {
  const inProgress = pending.filter((t) => t.status === "in_progress");
  const pendingItems = pending.filter((t) => t.status === "pending");

  const parts: string[] = [
    "📋 [PENDING TODOS REMINDER]",
    "",
    `Lu masih punya ${pending.length} ${pending.length === 1 ? "todo yang belum kelar" : "todos yang belum kelar"}:`,
    "",
  ];

  if (inProgress.length > 0) {
    parts.push("  🔄 In Progress:");
    for (const t of inProgress) {
      parts.push(`    • ${t.content}`);
    }
    parts.push("");
  }

  if (pendingItems.length > 0) {
    parts.push("  ⏳ Pending:");
    for (const t of pendingItems) {
      parts.push(`    • ${t.content}`);
    }
    parts.push("");
  }

  parts.push("  Jangan lupa lanjutin — atau cancel kalo udah ga relevan!");
  parts.push("");

  return parts.join("\n");
}

export default (async () => {
  return {
    /**
     * Track todowrite calls to know what todos exist
     */
    "tool.execute.before": async (input, _output) => {
      const sessionId = input.sessionID || "default";
      if (input.toolID !== "todowrite" && input.toolID !== "todo_write") return;

      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
          items: [],
          lastUpdate: Date.now(),
          lastToolCall: Date.now(),
        });
      }

      const state = sessions.get(sessionId)!;
      state.lastToolCall = Date.now();

      // Extract todo info from args
      const args = _output.args;
      if (args) {
        const content = args.content || args[0] || "";
        const status = args.status || "pending";
        const priority = args.priority || "medium";

        if (content) {
          // Check if already exists
          const existing = state.items.findIndex((t) => t.content === content);
          if (existing >= 0) {
            state.items[existing].status = status;
          } else {
            state.items.push({ content, status, priority });
          }
          state.lastUpdate = Date.now();
        }
      }
    },

    /**
     * Track ALL tool calls to detect idle time
     */
    "tool.execute.after": async (input, _output) => {
      const sessionId = input.sessionID || "default";
      const state = sessions.get(sessionId);
      if (state) {
        state.lastToolCall = Date.now();
      }
    },

    /**
     * Inject pending todos reminder kalo idle terlalu lama
     */
    "experimental.chat.system.transform": async (input, output) => {
      const sessionId = input.sessionID || "default";
      const state = sessions.get(sessionId);
      if (!state) return;

      const now = Date.now();
      const idleTime = now - state.lastToolCall;
      const timeSinceLastReminder = now - state.lastUpdate;

      // Only remind if:
      // 1. Idle > threshold
      // 2. There are pending items
      // 3. Last reminder was > cooldown ago
      if (
        idleTime > IDLE_THRESHOLD_MS &&
        timeSinceLastReminder > REMINDER_COOLDOWN_MS
      ) {
        const pending = getPendingTodos(state);
        if (pending.length > 0) {
          const reminder = buildReminder(pending);
          // Prepend to system prompt
          output.system = [`${reminder}`, ...(output.system || [])];
          state.lastUpdate = now;
        }
      }
    },
  };
}) satisfies Plugin;
