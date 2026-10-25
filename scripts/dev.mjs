import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const phpEnv = { ...process.env, RELIEF_MAIL_FROM: process.env.RELIEF_MAIL_FROM || 'janandrew1922@gmail.com' };
const php = spawn('php', [
  '-d', 'display_errors=1',
  '-d', 'log_errors=1',
  '-S',
  '127.0.0.1:8080',
  '-t',
  'php-api',
  'php-api/index.php'
], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: phpEnv
});

const vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: phpEnv
});

const stop = (signal) => {
  php.kill(signal);
  vite.kill(signal);
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

php.on('exit', (code) => {
  if (code !== 0 && code !== null) process.exitCode = code;
});

vite.on('exit', (code) => {
  if (code !== 0 && code !== null) process.exitCode = code;
});
