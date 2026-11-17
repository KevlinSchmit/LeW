import { copyFile } from 'node:fs/promises';
await copyFile(new URL('../dist/index.html',import.meta.url),new URL('../preview.html',import.meta.url));
console.log('Standalone HTML saved as preview.html');
