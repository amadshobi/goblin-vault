import type { Plugin } from "@opencode-ai/plugin";

/**
 * Doom-Loop Detection
 *
 * Track tool call patterns per session.
 * Kalo detect 3+ pola identik/siklik berturut-turut → inject reminder
 * ke system prompt biar agent ganti strategi.
 */

const LOOP_THRESHOLD = 3;

// Per-session tool call history
interface ToolCallRecord {
  toolId: string;
  argsSignature: string;
  timestamp: number;
}

interface SessionState {
  history: ToolCallRecord[];
  warningInjected: boolean;
}

const sessions = new Map<string, SessionState>();

/**
 * Bikin signature sederhana dari args
 * Biar kita bisa compare apakah tool call mirip atau beda
 */
function makeSignature(toolId: string, args: any): string {
  if (!args) return `${toolId}:null`;

  // Ambil key-value yang relevan, urutkan
  const relevant = Object.entries(args)
    .filter(([k]) => !k.startsWith("_")) // skip internal props
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${typeof v === "string" ? v.slice(0, 80) : JSON.stringify(v)}`)
    .join("&");

  return `${toolId}:${relevant}`;
}

/**
 * Deteksi apakah ada pola doom loop
 * Cari 3+ consecutive calls dengan signature yang sama
 */
function detectDoomLoop(history: ToolCallRecord[]): boolean {
  if (history.length < LOOP_THRESHOLD) return false;

  const recent = history.slice(-LOOP_THRESHOLD);
  const firstSig = recent[0].argsSignature;

  return recent.every((r) => r.argsSignature === firstSig);
}

/**
 * Deteksi cyclic pattern (A→B→A→B→A→B)
 */
function detectCycleLoop(history: ToolCallRecord[]): boolean {
  if (history.length < 6) return false;

  const recent = history.slice(-6);
  // Check A→B→A→B→A→B pattern
  const pattern: string[] = [];
  for (let i = 0; i < recent.length; i++) {
    pattern.push(recent[i].argsSignature);
  }

  // Check if it's alternating between 2 sigs
  const oddSigs = pattern.filter((_, i) => i % 2 === 0);
  const evenSigs = pattern.filter((_, i) => i % 2 === 1);

  if (oddSigs.length < 3) return false;
  const allOddSame = oddSigs.every((s) => s === oddSigs[0]);
  const allEvenSame = evenSigs.every((s) => s === evenSigs[0]);

  return allOddSame && allEvenSame && oddSigs[0] !== evenSigs[0];
}

function getWarningMessage(type: "doom" | "cycle"): string {
  if (type === "doom") {
    return [
      "⚠️ [DOOM-LOOP DETECTED]",
      "",
      "Lu udah ngulang tool call yang SAMA 3x berturut-turut.",
      "Ini tanda lo stuck. Coba strategi lain:",
      "  • Breakdown masalah jadi langkah lebih kecil",
      "  • Baca dokumentasi atau file terkait dulu",
      "  • Cari pendekatan alternatif",
      "  • Tanya ke BOSS kalo beneran buntu",
      "",
      `(detected: ${new Date().toLocaleTimeString()})`,
    ].join("\n");
  }

  return [
    "⚠️ [CYCLIC PATTERN DETECTED]",
    "",
    "Tool calls lu bergantian antara 2 pola doang — ini kayak infinite loop.",
    "Coba pendekatan berbeda:",
    "  • Jeda dulu, evaluasi apa yang udah dicoba",
    "  • Cari root problem, bukan symptom",
    "  • Simplify: coba solusi yang lebih sederhana",
    "",
    `(detected: ${new Date().toLocaleTimeString()})`,
  ].join("\n");
}

export default (async () => {
  return {
    /**
     * Track every tool call
     */
    "tool.execute.before": async (input, _output) => {
      const sessionId = input.sessionID || "default";
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { history: [], warningInjected: false });
      }

      const state = sessions.get(sessionId)!;
      const sig = makeSignature(input.toolID, _output.args);

      state.history.push({
        toolId: input.toolID,
        argsSignature: sig,
        timestamp: Date.now(),
      });

      // Keep only last 20 calls
      if (state.history.length > 20) {
        state.history = state.history.slice(-20);
      }
    },

    /**
     * After tool execute — check for doom loops
     * Kalo detect, inject warning via system prompt transform
     */
    "experimental.chat.system.transform": async (input, output) => {
      const sessionId = input.sessionID || "default";
      const state = sessions.get(sessionId);
      if (!state || state.warningInjected) return;

      const isDoom = detectDoomLoop(state.history);
      const isCycle = detectCycleLoop(state.history);

      if (isDoom || isCycle) {
        const warning = getWarningMessage(isDoom ? "doom" : "cycle");
        // Add warning as additional system instruction
        output.system = [...(output.system || []), `\n${warning}\n`];
        state.warningInjected = true;

        // Reset warning after 5 more calls (biar bisa detect lagi)
        setTimeout(() => {
          state.warningInjected = false;
          // Trim history to avoid immediate re-detection
          if (state.history.length > 3) {
            state.history = state.history.slice(-3);
          }
        }, 30000);
      }
    },
  };
}) satisfies Plugin;
