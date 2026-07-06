import { p, color } from './constants.js';
import { confirmAction } from './prompts.js';

/**
 * confirmDestructive — konfirmasi untuk action yang destructive.
 * Nampilin pesan merah tebal biar user sadar risikonya.
 *
 * @param {string} [message]
 * @returns {Promise<boolean>}
 */
export async function confirmDestructive(
  message = 'This action is destructive. Continue?'
) {
  return confirmAction(color.bold(color.red(message)));
}

/**
 * confirmDelete — konfirmasi khusus delete dengan detail target.
 *
 * @param {string} target — nama file/directory yang mau dihapus
 * @returns {Promise<boolean>}
 */
export async function confirmDelete(target) {
  return confirmAction(
    `Are you sure you want to delete ${color.red(target)}? This cannot be undone.`
  );
}
