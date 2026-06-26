import fs from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const files = await fs.readdir('./src/components/ui');
  const promises = files.map(async (file) => {
    const filePath = path.join('./src/components/ui', file);
    if (!filePath.endsWith('.tsx')) return;
    const content = await fs.readFile(filePath, 'utf-8');
    const newContent = content.replaceAll('~/lib/utils', 'ui/utils/tailwind');
    if (content === newContent) return;
    console.log('Processing:', filePath);
    await fs.writeFile(filePath, newContent);
  });
  await Promise.all(promises);
}

main();
