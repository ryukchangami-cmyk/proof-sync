import fs from 'fs';
import path from 'path';

/**
 * Post-build script that generates an index.html for static hosting
 * compatible with Vercel and other static hosting platforms.
 */

const distClientPath = path.resolve('dist/client');
const assetsPath = path.join(distClientPath, 'assets');

function findFile(prefix, ext) {
  if (!fs.existsSync(assetsPath)) return null;
  const files = fs.readdirSync(assetsPath);
  return files.find(f => f.startsWith(prefix) && f.endsWith(ext)) || null;
}

const jsFile = findFile('index', '.js');
const cssFile = findFile('styles', '.css');

if (!jsFile || !cssFile) {
  console.warn('⚠️  Could not find built assets. Make sure the build completed successfully.');
  process.exit(0);
}

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Verificador de Comprobantes</title>
  <meta name="description" content="Verifica comprobantes de pago de forma rápida y segura con análisis de IA.">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="stylesheet" href="/assets/${cssFile}">
  <style>
    html, body { margin: 0; padding: 0; background: #000; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/${jsFile}"></script>
</body>
</html>`;

fs.writeFileSync(path.join(distClientPath, 'index.html'), html);
console.log('✅  Generated index.html for static hosting');
