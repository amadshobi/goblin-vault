import { existsSync, statSync } from 'fs';
import path from 'path';

/**
 * pathExists — cek apakah path ada di filesystem.
 */
export function pathExists(p) {
  return existsSync(p);
}

/**
 * isDirectory — cek apakah path adalah directory.
 * Return false kalo path ga ada (gak throw).
 */
export function isDirectory(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * isFile — cek apakah path adalah file.
 * Return false kalo path ga ada.
 */
export function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * resolvePath — expand ~ ke HOME dan resolve relative path ke absolute.
 * Berguna buat user input yang mungkin pake ~/ atau path relatif.
 */
export function resolvePath(input) {
  if (input.startsWith('~')) {
    return path.join(process.env.HOME || '/root', input.slice(1));
  }
  return path.resolve(input);
}
