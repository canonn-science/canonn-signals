const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../readme.md');
const dest = path.resolve(__dirname, '../src/assets/readme.md');

fs.copyFileSync(src, dest);