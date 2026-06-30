import chalk from 'chalk';

export const isDebug = process.argv.includes('--debug') || process.env.DEBUG === 'true';

export function logDebug(msg: string) {
  if (isDebug) {
    console.log(msg);
  }
}

export function logInfo(msg: string) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(chalk.gray(`[${timestamp}] ${msg}`));
}
