const p = require('@clack/prompts');
const color = require('picocolors');
const { execSync } = require('child_process');
const path = require('path');
const storage = require('./storage');

async function createNote() {
  p.intro(color.cyan('Buat Catatan Baru'));

  const datePrefix = storage.getDatePrefix();
  const defaultName = `${datePrefix}_`;

  const filename = await p.text({
    message: 'Nama file:',
    placeholder: `${defaultName}(judul-singkat)`,
    defaultValue: defaultName.replace(/_$/, ''),
    validate: (val) => {
      if (!val || val.trim() === '') return 'Nama file tidak boleh kosong';
      // Hilangkan tanggal dari validasi kalo mereka masukin sendiri
      const clean = val.replace(/^\d{2}-\d{2}-\d{2}_?/, '');
      if (!clean) return 'Tambahkan judul setelah tanggal';
      return;
    },
  });

  if (p.isCancel(filename)) {
    p.cancel('Dibatalkan');
    return;
  }

  // Construct final filename
  let finalName = filename.trim();
  // Remove .md if they typed it
  finalName = finalName.replace(/\.md$/i, '');
  // Add date prefix if not already present
  if (!/^\d{2}-\d{2}-\d{2}/.test(finalName)) {
    finalName = `${datePrefix}_${finalName}`;
  }
  finalName = `${finalName}.md`;

  // Check if file already exists
  const fullPath = storage.getNotePath(finalName);
  if (require('fs').existsSync(fullPath)) {
    const overwrite = await p.confirm({
      message: `File ${finalName} sudah ada. Timpa?`,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel('Dibatalkan');
      return;
    }
  }

  // Get content via editor
  const useEditor = await p.confirm({
    message: 'Buka editor untuk nulis konten?',
    initial: true,
  });

  if (p.isCancel(useEditor)) {
    p.cancel('Dibatalkan');
    return;
  }

  let content = '';

  if (useEditor) {
    // Open $EDITOR (micro/nano/vim)
    const editor = process.env.EDITOR || 'micro';
    try {
      // Write a temporary file with the header, open editor
      const tmpFile = `/tmp/goblin-note-${Date.now()}.md`;
      const header = `# ${finalName.replace(/\.md$/, '')}\n\n`;
      require('fs').writeFileSync(tmpFile, header, 'utf8');
      execSync(`${editor} "${tmpFile}"`, { stdio: 'inherit' });
      content = require('fs').readFileSync(tmpFile, 'utf8');
      require('fs').unlinkSync(tmpFile);
    } catch (err) {
      p.cancel(`Gagal buka editor: ${err.message}`);
      return;
    }
  } else {
    // Simple single-line text input fallback
    content = await p.text({
      message: 'Isi catatan (1 baris):',
      placeholder: 'Tulis catatan di sini...',
    });
    if (p.isCancel(content)) {
      p.cancel('Dibatalkan');
      return;
    }
    content = `# ${finalName.replace(/\.md$/, '')}\n\n${content}\n`;
  }

  // Save
  try {
    storage.saveNote(finalName, content);
    p.outro(color.green(`Catatan tersimpan: ${finalName}`));
  } catch (err) {
    p.cancel(`Gagal menyimpan: ${err.message}`);
  }
}

module.exports = { createNote };
