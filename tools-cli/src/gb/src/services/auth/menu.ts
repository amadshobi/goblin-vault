/**
 * auth/menu.ts — GitHub Authentication TUI menu (TS)
 *
 * Interaktif menu untuk cek status / login / logout via `gh auth`.
 * Domain ini standalone — tidak depend ke service lain di luar `services/gh`
 * dan `utils/format`.
 */
import { cancel, confirm, isCancel, note, select, spinner } from "@clack/prompts";
import color from "picocolors";
import { ghRaw } from "../gh";
import { clearLastLines } from "../../utils/format";
import { continuePrompt } from "../issue/view";

/** Cek status auth via `gh auth status`. */
export async function authStatus(): Promise<void> {
  const s = spinner();
  s.start("Checking auth status...");
  try {
    const status = ghRaw(["auth", "status"], { silent: true });
    s.stop(status ? "Logged in" : "Not logged in");
    if (status) {
      note(status, "Auth Status");
    } else {
      note("Not authenticated with GitHub CLI", "Auth");
    }
  } catch (err) {
    s.stop("Not logged in");
    const msg = (err instanceof Error ? err.message : String(err)).replace(/^gh error:\s*/, "");
    note(msg || "Not authenticated", "Auth Status");
  }
}

/** Login via `gh auth login --web`. */
export async function authLogin(): Promise<boolean> {
  const s = spinner();
  s.start("Opening browser for login...");
  try {
    const out = ghRaw(["auth", "login", "--web", "-h", "github.com"]);
    s.stop("Login process complete");
    note(out || "OK", "Login Result");
    return true;
  } catch (err) {
    s.stop("Login failed");
    const msg = (err instanceof Error ? err.message : String(err)).replace(/^gh error:\s*/, "");
    cancel(color.red(`Login failed: ${msg}`));
    clearLastLines(2);
    return false;
  }
}

/** Logout via `gh auth logout -h github.com` (with confirmation). */
export async function authLogout(): Promise<boolean> {
  const confirmed = await confirm({
    message: "Logout dari GitHub?",
  });
  if (isCancel(confirmed) || !confirmed) {
    clearLastLines(2);
    return false;
  }

  const s = spinner();
  s.start("Logging out...");
  try {
    const out = ghRaw(["auth", "logout", "-h", "github.com"]);
    s.stop("Logged out");
    note(out || "OK", "Logout");
    return true;
  } catch (err) {
    s.stop("Logout failed");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return false;
  }
}

/** TUI menu utama untuk domain auth. */
export async function authMenu(): Promise<void> {
  while (true) {
    const action = await select<{ value: string; label: string }[], string>({
      message: "Auth",
      options: [
        { value: "status", label: "(i) Auth Status" },
        { value: "login", label: "Login to GitHub" },
        { value: "logout", label: "Logout" },
        { value: "back", label: "Back" },
      ],
    });
    if (isCancel(action) || action === "back") {
      clearLastLines(2);
      break;
    }

    switch (action) {
      case "status":
        await authStatus();
        break;
      case "login":
        await authLogin();
        break;
      case "logout":
        await authLogout();
        break;
    }
    await continuePrompt();
  }
}