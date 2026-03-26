import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRootDir = path.resolve(__dirname, '..');
const outputPath = path.resolve(backendRootDir, 'openapi.json');
const printToStdout = process.argv.includes('--stdout');

const { createApp } = await import(pathToFileURL(path.resolve(backendRootDir, 'dist/app.js')).href);

const response = await createApp().request('/api/openapi.json');

if (!response.ok) {
  throw new Error(`Failed to generate OpenAPI schema: ${response.status}`);
}

const openApiDocument = await response.json();
const formattedOpenApiDocument = `${JSON.stringify(openApiDocument, null, 2)}\n`;

if (printToStdout) {
  process.stdout.write(formattedOpenApiDocument);
  process.exit(0);
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, formattedOpenApiDocument, 'utf8');
process.stdout.write(`Generated ${outputPath}\n`);
