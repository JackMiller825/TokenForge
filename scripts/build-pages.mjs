import { spawnSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';

const api = 'src/app/api';
const hidden = '.api-hidden-during-export';
if (!existsSync(api)) {
  console.error('Missing src/app/api');
  process.exit(1);
}
renameSync(api, hidden);
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
  if (existsSync(hidden)) renameSync(hidden, api);
}
process.exit(status);
