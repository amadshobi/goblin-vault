const p = require('@clack/prompts');
const color = require('picocolors');
const { ghApi } = require('../utils/gh');
const { clearLastLines, padVisual, truncateVisual } = require('../utils/display');
const { continuePrompt } = require('../utils/prompt');

/**
 * Fetch authenticated user profile via GitHub REST API.
 * @returns {Promise<object|null>} User profile object atau null.
 */
async function fetchProfile() {
  const s = p.spinner();
  s.start('Fetching profile...');
  try {
    const profile = ghApi('/user');
    s.stop('Profile fetched');
    return profile;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(`Gagal fetch profile: ${err.message}`));
    clearLastLines(2);
    return null;
  }
}

/**
 * Display profile dalam format ANSI box/card yang rapi.
 * @param {object} profile - User profile dari GitHub API.
 */
function displayProfile(profile) {
  const width = 56;
  const innerW = width - 2;
  const bar = color.dim('─'.repeat(width));

  const rows = [
    { label: 'Name', value: profile.name || '(not set)' },
    { label: 'Bio', value: profile.bio || '(not set)' },
    { label: 'Company', value: profile.company || '(not set)' },
    { label: 'Location', value: profile.location || '(not set)' },
    { label: 'Blog', value: profile.blog || '(not set)' },
    { label: 'Twitter', value: profile.twitter_username || '(not set)' },
    { label: 'Email', value: profile.email || '(not set)' },
    { label: 'Type', value: profile.type },
  ];

  const stats = [
    `Repos: ${profile.public_repos ?? '?'}`,
    `Followers: ${profile.followers ?? '?'}`,
    `Following: ${profile.following ?? '?'}`,
  ];

  const header = `║${color.bold(color.cyan(padVisual(truncateVisual(profile.login || profile.name || 'Profile', width), width)))}║`;
  const statsLine = `║${color.dim(padVisual(truncateVisual(stats.join('  '), width), width))}║`;

  const dataLines = rows
    .filter(r => r.value && r.value !== '(not set)')
    .map(r => {
      const label = color.bold(`${r.label}:`);
      const val = truncateVisual(String(r.value), innerW - r.label.length - 3);
      return `║  ${label} ${padVisual(val, innerW - r.label.length - 3)} ║`;
    });

  const lines = [
    `╔${bar}╗`,
    header,
    statsLine,
    `║${bar}║`,
    ...dataLines,
    `╚${bar}╝`,
  ];

  console.log(lines.join('\n'));
}

/**
 * Interactive edit mode — pilih field lalu input nilai baru.
 * @param {object} profile - Current profile data.
 */
async function editProfileInteractive(originalProfile) {
  const profile = { ...originalProfile };
  const FIELD_DEFS = [
    { key: 'name', label: '📝 Display Name', apiField: 'name', placeholder: profile.name || 'Masukkan nama baru' },
    { key: 'bio', label: '📝 Bio', apiField: 'bio', placeholder: profile.bio || 'Masukkan bio baru' },
    { key: 'company', label: '🏢 Company', apiField: 'company', placeholder: profile.company || 'Masukkan perusahaan' },
    { key: 'location', label: '📍 Location', apiField: 'location', placeholder: profile.location || 'Masukkan lokasi' },
    { key: 'blog', label: '🌐 Blog / Website URL', apiField: 'blog', placeholder: profile.blog || 'https://...' },
    { key: 'twitter_username', label: '💬 Twitter/X Handle', apiField: 'twitter_username', placeholder: profile.twitter_username || '@handle' },
  ];

  // Build options with current values
  const options = FIELD_DEFS.map(f => ({
    value: f.key,
    label: `${f.label}  ${color.dim(`(${truncateVisual(String(profile[f.key] || '(not set)'), 30)})`)}`,
  }));

  options.push({ value: '_done', label: color.green('💾 Simpan & Keluar') });
  options.push({ value: '_cancel', label: color.red('❌ Batal') });

  while (true) {
    const choice = await p.select({
      message: 'Pilih field yang mau diubah:',
      options,
      maxItems: options.length,
    });

    if (p.isCancel(choice) || choice === '_cancel') {
      clearLastLines(2);
      p.note(color.yellow('Edit dibatalkan.'), 'Cancelled');
      return null;
    }

    if (choice === '_done') break;

    const fieldDef = FIELD_DEFS.find(f => f.key === choice);
    if (!fieldDef) continue;

    const newVal = await p.text({
      message: `${fieldDef.label}:`,
      placeholder: fieldDef.placeholder,
      initialValue: String(profile[fieldDef.key] || ''),
    });

    if (p.isCancel(newVal)) {
      clearLastLines(2);
      continue;
    }

    // Update local profile copy
    profile[fieldDef.key] = newVal.trim();
    // Update display label
    const optIdx = options.findIndex(o => o.value === choice);
    if (optIdx !== -1) {
      options[optIdx] = {
        ...options[optIdx],
        label: `${fieldDef.label}  ${color.cyan(`(${truncateVisual(newVal.trim() || '(empty)', 30)})`)}`,
      };
    }
  }

  // Konfirmasi sebelum save
  const confirmed = await p.confirm({
    message: 'Simpan perubahan ke GitHub?',
    initialValue: true,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    clearLastLines(2);
    p.note(color.yellow('Tidak ada perubahan yang disimpan.'), 'Cancelled');
    return null;
  }

  return profile;
}

/**
 * Patch user profile via GitHub REST API.
 * @param {object} updates - Key-value pairs untuk di-PATCH.
 */
async function patchProfile(updates) {
  const s = p.spinner();
  s.start('Menyimpan ke GitHub...');
  try {
    const result = ghApi('/user', {
      method: 'PATCH',
      body: updates,
    });
    s.stop('Profil berhasil diupdate!');
    return result;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(`Gagal update profil: ${err.message}`));
    clearLastLines(2);
    return null;
  }
}

/**
 * Format updates untuk ditampilkan ke user.
 * @param {object} updates
 * @returns {string}
 */
function formatUpdates(updates) {
  return Object.entries(updates)
    .map(([k, v]) => `  ${color.cyan(k)}: ${v || color.dim('(clear)')}`)
    .join('\n');
}

/**
 * CLI flags handler — langsung PATCH dengan flags.
 * @param {object} flags - { name, bio, company, location, blog }
 */
async function profileCliFlags(flags) {
  const updates = {};
  if (flags.name !== undefined) updates.name = flags.name;
  if (flags.bio !== undefined) updates.bio = flags.bio;
  if (flags.company !== undefined) updates.company = flags.company;
  if (flags.location !== undefined) updates.location = flags.location;
  if (flags.blog !== undefined) updates.blog = flags.blog;

  if (Object.keys(updates).length === 0) {
    console.error(color.red('Tidak ada flag yang diberikan. Gunakan --name, --bio, --company, --location, atau --blog.'));
    return 1;
  }

  console.log(color.dim('Update yang akan dikirim:'));
  console.log(formatUpdates(updates));
  console.log('');

  const result = await patchProfile(updates);
  if (!result) return 1;

  console.log(color.green('✅ Profil berhasil diupdate!'));
  displayProfile(result);
  return 0;
}

/**
 * View profile mode.
 */
async function viewProfile() {
  const profile = await fetchProfile();
  if (!profile) return 1;
  displayProfile(profile);
  return 0;
}

/**
 * Interactive edit mode — fetch lalu edit.
 */
async function editProfile() {
  const profile = await fetchProfile();
  if (!profile) return 1;

  displayProfile(profile);
  console.log('');

  const updated = await editProfileInteractive({ ...profile });
  if (!updated) return 0;

  // Build PATCH body (hanya field yang berubah)
  const updates = {};
  for (const key of ['name', 'bio', 'company', 'location', 'blog', 'twitter_username']) {
    if (updated[key] !== profile[key]) {
      updates[key] = updated[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    p.note(color.yellow('Tidak ada perubahan.'), 'No Changes');
    return 0;
  }

  console.log(color.dim('Perubahan yang akan disimpan:'));
  console.log(formatUpdates(updates));
  console.log('');

  const result = await patchProfile(updates);
  if (!result) return 1;

  console.log(color.green('✅ Profil berhasil diupdate!'));
  displayProfile(result);
  return 0;
}

/**
 * Profile menu — dipanggil dari TUI main menu.
 */
async function profileMenu() {
  while (true) {
    const action = await p.select({
      message: 'GitHub Profile',
      options: [
        { value: 'view', label: '👁  View Profile', hint: 'lihat profil saat ini' },
        { value: 'edit', label: '✏️  Edit Profile', hint: 'edit interaktif' },
        { value: 'back', label: '← Back' },
      ],
    });

    if (p.isCancel(action) || action === 'back') {
      clearLastLines(2);
      break;
    }

    switch (action) {
      case 'view':
        await viewProfile();
        await continuePrompt();
        break;
      case 'edit':
        await editProfile();
        await continuePrompt();
        break;
    }
  }
}

module.exports = {
  profileMenu,
  viewProfile,
  editProfile,
  profileCliFlags,
};
