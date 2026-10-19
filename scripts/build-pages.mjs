import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

const api = 'src/app/api';
const hiddenSuffix = '.pages-hidden';

function walk(dir, visit) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, visit);
    else visit(full);
  }
}

function hideRoutes() {
  const hidden = [];
  walk(api, (file) => {
    if (!file.endsWith(`${hiddenSuffix}`) && file.endsWith('route.ts')) {
      const next = `${file}${hiddenSuffix}`;
      renameSync(file, next);
      hidden.push(next);
    }
  });
  return hidden;
}

function restoreRoutes() {
  if (!existsSync(api)) return;
  walk(api, (file) => {
    if (file.endsWith(`route.ts${hiddenSuffix}`)) renameSync(file, file.slice(0, -hiddenSuffix.length));
  });
}

if (!existsSync(api)) {
  console.error('Missing src/app/api');
  process.exit(1);
}

restoreRoutes();
hideRoutes();
let status = 1;
try {
  const result = spawnSync('npx', ['next', 'build'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      STATIC_EXPORT: '1',
      NEXT_PUBLIC_STATIC_EXPORT: '1',
      NEXT_PUBLIC_BASE_PATH: '/TokenForge',
    },
  });
  status = result.status ?? 1;
} finally {
  restoreRoutes();
}
process.exit(status);
