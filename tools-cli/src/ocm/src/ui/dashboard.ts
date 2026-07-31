import color from 'picocolors';

export function getDashboardLines(): string[] {
  const lines: string[] = [];

  // ASCII ART OCM BANNER (MINIMALIS & ELEGAN)
  lines.push(color.cyan(color.bold('   ██████╗  ██████╗███╗   ███╗')));
  lines.push(color.cyan(color.bold('  ██╔═══██╗██╔════╝████╗ ████║')));
  lines.push(color.cyan(color.bold('  ██║   ██║██║     ██╔████╔██║')));
  lines.push(color.cyan(color.bold('  ██║   ██║██║     ██║╚██╔╝██║')));
  lines.push(color.cyan(color.bold('  ╚██████╔╝╚██████╗██║ ╚═╝ ██║')));
  lines.push(color.cyan(color.bold('   ╚═════╝  ╚═════╝╚═╝     ╚═╝')));
  lines.push(color.dim('    OpenCode Manager v1.2.0\n    Goblin Vault Control Center'));

  return lines;
}
