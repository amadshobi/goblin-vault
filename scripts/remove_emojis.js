const fs = require('fs');
const path = require('path');

function removeEmojis(str) {
  // Regex to match emojis
  return str.replace(/[\u{1F600}-\u{1F64F}]/gu, '')
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
            .replace(/[\u{1F700}-\u{1F77F}]/gu, '')
            .replace(/[\u{1F780}-\u{1F7FF}]/gu, '')
            .replace(/[\u{1F800}-\u{1F8FF}]/gu, '')
            .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
            .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
            .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
            .replace(/[\u{2600}-\u{26FF}]/gu, '')
            .replace(/[\u{2700}-\u{27BF}]/gu, '')
            .replace(/[\u{2300}-\u{23FF}]/gu, '')
            .replace(/[\u{2B50}]/gu, '') // star
            .replace(/[\u{2139}]/gu, '') // info
            .replace(/[\u{200D}]/gu, '') // ZWJ
            .replace(/[\u{FE0F}]/gu, '') // VS16
            // Clean up double spaces left behind
            .replace(/  +/g, ' ');
}

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const newContent = removeEmojis(content);
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Cleaned ${fullPath}`);
      }
    }
  }
}

processDir(path.join(__dirname, 'tui_src'));
