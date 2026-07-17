const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'app.js');
const logicPath = path.join(__dirname, 'logic.js');

let appContent = fs.readFileSync(appPath, 'utf8');
let logicContent = fs.readFileSync(logicPath, 'utf8');

// Fix ID equality checks in app.js
appContent = appContent.replace(/s => s\.id === id/g, 's => String(s.id) === String(id)');
appContent = appContent.replace(/e => e\.id === id/g, 'e => String(e.id) === String(id)');
appContent = appContent.replace(/f => f\.id === id/g, 'f => String(f.id) === String(id)');

// Fix timeToMins in logic.js
logicContent = logicContent.replace(
    /function timeToMins\(timeStr\) \{[\s\S]*?return parseInt\(parts\[0\]\) \* 60 \+ parseInt\(parts\[1\]\);\s*\}/,
    `function timeToMins(timeStr) {
    if (!timeStr) return 0;
    timeStr = String(timeStr).split('-')[0].trim();
    const parts = timeStr.split(':');
    return parseInt(parts[0] || 0) * 60 + parseInt(parts[1] || 0);
}`
);

// Add getSafeDate to logic.js if not exists
if (!logicContent.includes('function getSafeDate')) {
    logicContent = `function getSafeDate(dateStr, timeStr) {
    if (!dateStr) return new Date();
    if (!timeStr) return new Date(dateStr + 'T09:00:00');
    let t = String(timeStr).split('-')[0].trim();
    if (t.length === 4) t = '0' + t;
    if (t.length === 5) t = t + ':00';
    const d = new Date(dateStr + 'T' + t);
    return isNaN(d.getTime()) ? new Date() : d;
}\n\n` + logicContent;
}

// Replace new Date(....T....) with getSafeDate(...., ....) in both files
const dateRegex = /new Date\(\`\$\{(.*?)\}T\$\{(.*?)\}\`\)/g;

appContent = appContent.replace(dateRegex, 'getSafeDate($1, $2)');
logicContent = logicContent.replace(dateRegex, 'getSafeDate($1, $2)');

fs.writeFileSync(appPath, appContent, 'utf8');
fs.writeFileSync(logicPath, logicContent, 'utf8');

console.log("Bug fixes applied successfully!");
