import fs from 'node:fs/promises';

const file='scripts/update-predictions.mjs';
let s=await fs.readFile(file,'utf8');

if(!s.includes('async function archivePreviousPredictions')){
  s=s.replace("async function main() {\n  const outputPath = path.join(process.cwd(), 'data', 'predictions.json');\n  await fs.mkdir(path.dirname(outputPath), { recursive: true });",
`async function archivePreviousPredictions(outputPath) {
  try {
    const raw = await fs.readFile(outputPath, 'utf8');
    const previous = JSON.parse(raw);
    if (!previous?.matches?.length || !previous?.updated_at) return;
    const day = String(previous.updated_at).slice(0,10);
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(day)) return;
    const historyDir = path.join(process.cwd(), 'data', 'history');
    await fs.mkdir(historyDir, { recursive: true });
    const historyPath = path.join(historyDir, \\`predictions-\${day}.json\\`);
    await fs.writeFile(historyPath, JSON.stringify(previous, null, 2));
    console.log(\\`Archived previous predictions to \${historyPath}.\\`);
  } catch (err) {
    if (err?.code !== 'ENOENT') console.warn('Could not archive previous predictions:', err.message);
  }
}

async function main() {
  const outputPath = path.join(process.cwd(), 'data', 'predictions.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await archivePreviousPredictions(outputPath);`);
}

await fs.writeFile(file,s);
console.log('Prediction history archiving enabled.');
