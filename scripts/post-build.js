import fs from 'fs';
import path from 'path';

/**
 * Post-build script: genera index.html para hosting estático (Vercel, etc.)
 * Con logs detallados y manejo de errores para diagnóstico rápido en CI.
 */

const SCRIPT = 'post-build.js';
const log = (msg) => console.log(`[${SCRIPT}] ${msg}`);
const warn = (msg) => console.warn(`[${SCRIPT}] WARN: ${msg}`);
const fail = (msg, err) => {
  console.error(`[${SCRIPT}] ERROR: ${msg}`);
  if (err) {
    console.error(`[${SCRIPT}] Causa: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }
  process.exit(1);
};

try {
  const distClientPath = path.resolve('dist/client');
  const assetsPath = path.join(distClientPath, 'assets');

  log(`Inicio. CWD=${process.cwd()}`);
  log(`distClientPath=${distClientPath}`);

  if (!fs.existsSync(distClientPath)) {
    fail(`No existe el directorio de salida "${distClientPath}". ¿Falló "vite build"?`);
  }
  if (!fs.existsSync(assetsPath)) {
    fail(`No existe "${assetsPath}". El build no generó assets.`);
  }

  const files = fs.readdirSync(assetsPath);
  log(`Assets encontrados (${files.length}): ${files.join(', ')}`);

  const jsFile = files.find((f) => f.startsWith('index') && f.endsWith('.js'));
  const cssFile = files.find((f) => f.startsWith('styles') && f.endsWith('.css'));

  if (!jsFile) {
    fail(
      `No se encontró el bundle JS (prefijo "index", extensión ".js") en ${assetsPath}. ` +
        `Revisa la salida de "vite build" — probablemente el entry no se generó.`
    );
  }
  if (!cssFile) {
    warn(`No se encontró CSS (prefijo "styles"). Continuando sin <link rel="stylesheet">.`);
  }

  log(`Entry JS: ${jsFile}`);
  if (cssFile) log(`Entry CSS: ${cssFile}`);

  const cssLink = cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}">` : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Verificador de Comprobantes</title>
  <meta name="description" content="Verifica comprobantes de pago de forma rápida y segura con análisis de IA.">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  ${cssLink}
  <style>
    html, body { margin: 0; padding: 0; background: #000; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/${jsFile}"></script>
</body>
</html>`;

  const outFile = path.join(distClientPath, 'index.html');
  try {
    fs.writeFileSync(outFile, html);
  } catch (err) {
    fail(`No se pudo escribir "${outFile}".`, err);
  }

  log(`OK — generado ${outFile} (${html.length} bytes)`);
} catch (err) {
  fail('Fallo inesperado durante post-build', err);
}
