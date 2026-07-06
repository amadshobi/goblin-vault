const color = require('picocolors');

function stripAnsi(str) {
 return str.replace(/\u001b\[\d+m/g, '');
}

function printBorderLine(content, width = 54) {
 const visibleLen = stripAnsi(content).length;
 const pad = ' '.repeat(Math.max(0, width - visibleLen));
 console.log(`│ ${content}${pad} │`);
}

function drawBox(title, lines, width = 54) {
 const lineStr = '─'.repeat(width + 2);
 console.log(color.cyan(`┌${lineStr}┐`));
 if (title) {
 printBorderLine(color.bold(title), width);
 console.log(color.cyan(`├${lineStr}┤`));
 }
 lines.forEach(l => printBorderLine(l, width));
 console.log(color.cyan(`└${lineStr}┘`));
}

module.exports = {
 stripAnsi,
 printBorderLine,
 drawBox
};
