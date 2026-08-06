/**
 * profile/menu.ts — GitHub Profile TUI menu (TS)
 *
 * Wrapper interaktif untuk `viewProfile` & `editProfile`. Dipanggil dari
 * `index.ts` (TUI mode) atau via `gb profile` (CLI tanpa subcommand).
 *
 * Backed by:
 *   - viewProfile  -> services/profile/view.ts
 *   - editProfile  -> services/profile/edit.ts
 */
import { cancel, isCancel, select } from "@clack/prompts";
import color from "picocolors";
import { clearLastLines } from "../../utils/format";
import { continuePrompt } from "../issue/view";
import { editProfile } from "./edit";
import { viewProfile } from "./view";

/** Interactive profile TUI — pilih antara view / edit / back. */
export async function profileMenu(): Promise<void> {
  while (true) {
    const action = await select<{ value: string; label: string; hint?: string }[], string>({
      message: "GitHub Profile",
      options: [
        { value: "view", label: "👁  View Profile", hint: "lihat profil saat ini" },
        { value: "edit", label: "✏️  Edit Profile", hint: "edit interaktif" },
        { value: "back", label: "← Back" },
      ],
    });

    if (isCancel(action) || action === "back") {
      clearLastLines(2);
      break;
    }

    switch (action) {
      case "view":
        await viewProfile();
        await continuePrompt();
        break;
      case "edit":
        await editProfile();
        await continuePrompt();
        break;
      default:
        cancel(color.red(`Aksi profile tidak dikenal: ${action}`));
        clearLastLines(2);
        break;
    }
  }
}