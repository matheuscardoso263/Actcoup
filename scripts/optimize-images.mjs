/**
 * Gera as versões servidas das imagens a partir dos originais em `cards/`.
 *
 * Os PNGs originais têm ~1400px de altura e 2 MB cada — 11.6 MB só de cartas,
 * baixados antes da mesa aparecer e embutidos DUAS vezes no .exe (o pkg
 * empacota `public/**` e `dist/**`). Nenhuma carta é exibida acima de 22rem
 * (352 px), então mesmo em tela 2x sobra resolução com 900px de altura.
 *
 *   npm run images
 *
 * Os originais não são tocados: ficam em `cards/` como arquivo-mestre.
 */
import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SOURCE = 'cards';
const OUT = 'public/cards';
const MAX_HEIGHT = 900;
const QUALITY = 82;

const kb = bytes => `${(bytes / 1024).toFixed(0)} kB`;

async function main() {
  await mkdir(OUT, { recursive: true });

  const files = (await readdir(SOURCE)).filter(f => f.endsWith('.png'));
  if (files.length === 0) throw new Error(`nenhum PNG em ${SOURCE}/`);

  let before = 0;
  let after = 0;

  for (const file of files) {
    const from = path.join(SOURCE, file);
    const to = path.join(OUT, file.replace(/\.png$/, '.webp'));

    const info = await sharp(from)
      .resize({ height: MAX_HEIGHT, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(to);

    const original = (await stat(from)).size;
    before += original;
    after += info.size;

    console.log(
      `${file.padEnd(18)} ${kb(original).padStart(9)} -> ${kb(info.size).padStart(8)}` +
      `  (${info.width}x${info.height})`
    );
  }

  // Favicon: o index.html apontava para a carta do Duque em tamanho cheio,
  // ou seja, 2.5 MB baixados só para desenhar o ícone da aba.
  const favicon = await sharp(path.join(SOURCE, 'duke.png'))
    .resize(64, 64, { fit: 'cover', position: 'top' })
    .png({ compressionLevel: 9 })
    .toFile('public/favicon.png');
  console.log(`${'favicon.png'.padEnd(18)} ${''.padStart(9)}    ${kb(favicon.size).padStart(8)}`);

  console.log(`\ntotal: ${kb(before)} -> ${kb(after)} (${(100 - (after / before) * 100).toFixed(1)}% menor)`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
