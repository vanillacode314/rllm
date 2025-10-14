import fs from 'node:fs/promises';

async function main() {
	const migrations: Record<string, string> = {};
	let files = await fs.readdir('./drizzle');
	files = files.filter((file) => file !== 'meta');
	files.sort();

	for (const name of files) {
		const content = await fs.readFile(`./drizzle/${name}`, 'utf-8');
		migrations[name] = content.replaceAll('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS');
	}

	await fs.writeFile('./src/db/migrations.json', JSON.stringify(migrations));
}

main();
