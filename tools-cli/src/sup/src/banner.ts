/**
 * sup — Smart Universal Package Updater
 * Modul banner ASCII art "SUP" sesuai Standard Banner ASCII Header.
 *
 * Menggunakan Unicode Solid Block Font dengan Pure White (`\033[1;37m`)
 * sesuai policy di docs/rules/coding-style.md (Section 9).
 */

import pkg from "../package.json";

const WHITE = "\x1b[1;37m";
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

export const VERSION = pkg.version;

/**
 * Render banner ASCII "SUP" + label versi dinamis dari package.json.
 *
 * @param subtitle - Subtitle opsional, default ke tag "Smart Universal Package Updater".
 * @returns String multi-line siap cetak (sudah termasuk trailing newline).
 */
export function renderBanner(subtitle: string = "Smart Universal Package Updater"): string {
  const lines = [
    "",
    `${WHITE} ██████╗██╗   ██╗██████╗ ${RESET}`,
    `${WHITE}██╔════╝██║   ██║██╔══██╗${RESET}`,
    `${WHITE}╚█████╗ ██║   ██║██████╔╝${RESET}`,
    `${WHITE} ╚═══██╗██║   ██║██╔═══╝ ${RESET}`,
    `${WHITE}██████╔╝╚██████╔╝██║     ${RESET}`,
    `${WHITE}╚═════╝  ╚═════╝ ╚═╝     ${RESET}`,
    `   ${WHITE}sup${RESET} ${DIM}v${VERSION} — ${subtitle}${RESET}`,
    "",
  ];
  return lines.join("\n");
}
