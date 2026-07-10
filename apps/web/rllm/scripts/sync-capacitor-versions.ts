import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');

async function syncVersion() {
  try {
    const packageJsonPath = resolve(projectRoot, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    const version = packageJson.version;
    console.log(`Found version ${version} in package.json`);

    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error('Version in package.json is not in semver format (e.g., 1.2.3)');
    }

    const [major, minor, patch] = version.split('.').map(Number);
    const versionCode = major * 10000000 + minor * 100000 + patch * 1000 + 999;
    console.log(`Calculated Android versionCode: ${versionCode}`);

    const gradlePath = resolve(projectRoot, 'android/app/build.gradle');
    let gradleContent = await readFile(gradlePath, 'utf-8');

    const versionNameRegex = /versionName "[\d.]+"/;
    const versionCodeRegex = /versionCode \d+/;

    if (!versionNameRegex.test(gradleContent) || !versionCodeRegex.test(gradleContent)) {
      throw new Error('Could not find versionName or versionCode in android/app/build.gradle');
    }

    gradleContent = gradleContent.replace(versionNameRegex, `versionName "${version}"`);
    gradleContent = gradleContent.replace(versionCodeRegex, `versionCode ${versionCode}`);

    await writeFile(gradlePath, gradleContent);
    console.log('Successfully updated android/app/build.gradle');

    console.log('Version synchronization complete!');
  } catch (error) {
    console.error('Error during version synchronization:', error);
    process.exit(1);
  }
}

syncVersion();
