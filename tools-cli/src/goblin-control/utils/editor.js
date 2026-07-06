import { execCommand } from './exec.js';

/**
 * openInMicro — buka file pake micro editor.
 */
export async function openInMicro(filePath) {
  return execCommand(`micro "${filePath}"`);
}

/**
 * openInMicroAtLine — buka file di line tertentu pake micro.
 * Micro support "file:line" syntax.
 */
export async function openInMicroAtLine(filePath, line) {
  return execCommand(`micro "${filePath}:${line}"`);
}
