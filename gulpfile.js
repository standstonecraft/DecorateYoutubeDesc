const gulp = require('gulp');
const fs = require('fs');

const oneFile = cb => {
  const header = fs.readFileSync('./src/header.js').toString();
  const css = fs.readFileSync('./src/styleLocal.css').toString();
  const js = fs.readFileSync('./src/indexLocal.js').toString();
  const content = header + js.replace("GM_getResourceText('style.css')", `\`\n${css}\``);
  fs.writeFile('./dest/index.js', content, cb);
};
exports.oneFile = oneFile;
