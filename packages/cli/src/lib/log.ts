import pc from 'picocolors';

const PREFIX = pc.cyan('dokai');

export const log = {
  info(message: string): void {
    console.log(`${PREFIX} ${message}`);
  },
  success(message: string): void {
    console.log(`${PREFIX} ${pc.green('✓')} ${message}`);
  },
  warn(message: string): void {
    console.warn(`${PREFIX} ${pc.yellow('!')} ${message}`);
  },
  error(message: string): void {
    console.error(`${PREFIX} ${pc.red('✗')} ${message}`);
  },
  step(title: string): void {
    console.log(`${PREFIX} ${pc.bold(title)}`);
  },
  detail(message: string): void {
    console.log(`${PREFIX}   ${pc.dim(message)}`);
  },
};
