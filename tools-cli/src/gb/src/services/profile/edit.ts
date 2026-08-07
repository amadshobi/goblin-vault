/**
 * profile/edit.ts — edit GitHub profile (TS)
 *
 * Port dari `commands/profile.js` (bagian edit). Flow:
 *   fetchProfile -> editProfileInteractive (Clack) -> build PATCH body ->
 *   patchProfile -> displayProfile.
 */
import { cancel, confirm, note, select, spinner, text, isCancel } from "@clack/prompts";
import color from "picocolors";
import { ghApi } from "../gh";
import type { GHUser } from "../../types";
import { clearLastLines, truncateVisual } from "../../utils/format";
import { displayProfile, fetchProfile } from "./view";

/** Patch user profile via GitHub REST API. */
async function patchProfile(updates: Record<string, string>): Promise<GHUser | null> {
  const s = spinner();
  s.start("Menyimpan ke GitHub...");
  try {
    const result = ghApi<GHUser>("/user", { method: "PATCH", body: updates });
    s.stop("Profil berhasil diupdate!");
    return result;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(`Gagal update profil: ${err instanceof Error ? err.message : String(err)}`));
    clearLastLines(2);
    return null;
  }
}

/** Format updates untuk ditampilkan. */
function formatUpdates(updates: Record<string, string>): string {
  return Object.entries(updates)
    .map(([k, v]) => `  ${color.cyan(k)}: ${v || color.dim("(clear)")}`)
    .join("\n");
}

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
}

/** Interactive edit mode — pilih field lalu input nilai baru. */
async function editProfileInteractive(originalProfile: GHUser): Promise<GHUser | null> {
  const profile = { ...originalProfile };
  const FIELD_DEFS: FieldDef[] = [
    { key: "name", label: "📝 Display Name", placeholder: profile.name || "Masukkan nama baru" },
    { key: "bio", label: "📝 Bio", placeholder: profile.bio || "Masukkan bio baru" },
    { key: "company", label: "🏢 Company", placeholder: profile.company || "Masukkan perusahaan" },
    { key: "location", label: "📍 Location", placeholder: profile.location || "Masukkan lokasi" },
    { key: "blog", label: "🌐 Blog / Website URL", placeholder: profile.blog || "https://..." },
    { key: "twitter_username", label: "💬 Twitter/X Handle", placeholder: profile.twitter_username || "@handle" },
  ];

  const options = FIELD_DEFS.map((f) => ({
    value: f.key as string,
    label: `${f.label}  ${color.dim(`(${truncateVisual(String(profile[f.key as keyof GHUser] || "(not set)"), 30)})`)}`,
  }));

  options.push({ value: "_done", label: color.green("💾 Simpan & Keluar") });
  options.push({ value: "_cancel", label: color.red("❌ Batal") });

  while (true) {
    const choice = await select<{ value: string; label: string }[], string>({
      message: "Pilih field yang mau diubah:",
      options,
      maxItems: options.length,
    });

    if (isCancel(choice) || choice === "_cancel") {
      clearLastLines(2);
      note(color.yellow("Edit dibatalkan."), "Cancelled");
      return null;
    }
    if (choice === "_done") break;

    const fieldDef = FIELD_DEFS.find((f) => f.key === choice);
    if (!fieldDef) continue;

    const newVal = await text({
      message: `${fieldDef.label}:`,
      placeholder: fieldDef.placeholder,
      initialValue: String(profile[fieldDef.key as keyof GHUser] || ""),
    });
    if (isCancel(newVal)) {
      clearLastLines(2);
      continue;
    }

    (profile as unknown as Record<string, string>)[fieldDef.key] = newVal.trim();

    const optIdx = options.findIndex((o) => o.value === choice);
    if (optIdx !== -1) {
      options[optIdx] = {
        ...options[optIdx],
        label: `${fieldDef.label}  ${color.cyan(`(${truncateVisual(newVal.trim() || "(empty)", 30)})`)}`,
      };
    }
  }

  const confirmed = await confirm({
    message: "Simpan perubahan ke GitHub?",
    initialValue: true,
  });
  if (isCancel(confirmed) || !confirmed) {
    clearLastLines(2);
    note(color.yellow("Tidak ada perubahan yang disimpan."), "Cancelled");
    return null;
  }

  return profile;
}

/** CLI flags handler — langsung PATCH dengan flags. */
export async function profileCliFlags(flags: { name?: string; bio?: string; company?: string; location?: string; blog?: string }): Promise<number> {
  const updates: Record<string, string> = {};
  if (flags.name !== undefined) updates.name = flags.name;
  if (flags.bio !== undefined) updates.bio = flags.bio;
  if (flags.company !== undefined) updates.company = flags.company;
  if (flags.location !== undefined) updates.location = flags.location;
  if (flags.blog !== undefined) updates.blog = flags.blog;

  if (Object.keys(updates).length === 0) {
    console.error(
      color.red("Tidak ada flag yang diberikan. Gunakan --name, --bio, --company, --location, atau --blog.")
    );
    return 1;
  }

  console.log(color.dim("Update yang akan dikirim:"));
  console.log(formatUpdates(updates));
  console.log("");

  const result = await patchProfile(updates);
  if (!result) return 1;

  console.log(color.green("✅ Profil berhasil diupdate!"));
  displayProfile(result);
  return 0;
}

/** Interactive edit mode — fetch lalu edit. */
export async function editProfile(): Promise<number> {
  const profile = await fetchProfile();
  if (!profile) return 1;

  displayProfile(profile);
  console.log("");

  const updated = await editProfileInteractive({ ...profile });
  if (!updated) return 0;

  const updates: Record<string, string> = {};
  for (const key of ["name", "bio", "company", "location", "blog", "twitter_username"]) {
    if ((updated as unknown as Record<string, string>)[key] !== (profile as unknown as Record<string, string>)[key]) {
      updates[key] = (updated as unknown as Record<string, string>)[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    note(color.yellow("Tidak ada perubahan."), "No Changes");
    return 0;
  }

  console.log(color.dim("Perubahan yang akan disimpan:"));
  console.log(formatUpdates(updates));
  console.log("");

  const result = await patchProfile(updates);
  if (!result) return 1;

  console.log(color.green("✅ Profil berhasil diupdate!"));
  displayProfile(result);
  return 0;
}