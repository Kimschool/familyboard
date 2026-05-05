// 타로 이미지 압축 스크립트
// sharp 로 PNG → WebP (quality 82) + 최대 800px 리사이즈
import { createRequire } from 'module';
import { readdir, stat, rename } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let sharp;
try {
  sharp = require('sharp');
} catch {
  // 임시 node_modules에서 로드
  sharp = require(join(__dir, 'node_modules', 'sharp'));
}

const SRC_DIR  = join(__dir, '..', 'public', 'assets', 'tarot');
const MAX_SIZE = 800;   // 긴 쪽 최대 px
const QUALITY  = 82;    // WebP 품질

const files = (await readdir(SRC_DIR)).filter(f => f.endsWith('.png'));
let totalBefore = 0, totalAfter = 0;

for (const file of files) {
  const src  = join(SRC_DIR, file);
  const dest = src.replace(/\.png$/, '.webp');
  const tmp  = src + '.tmp';

  const before = (await stat(src)).size;
  totalBefore += before;

  await sharp(src)
    .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(dest);

  const after = (await stat(dest)).size;
  totalAfter += after;
  console.log(`${file}  ${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB  (-${Math.round((1-after/before)*100)}%)`);
}

console.log(`\n합계: ${(totalBefore/1024/1024).toFixed(1)}MB → ${(totalAfter/1024/1024).toFixed(1)}MB  (-${Math.round((1-totalAfter/totalBefore)*100)}%)`);
