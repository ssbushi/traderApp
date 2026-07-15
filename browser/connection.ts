import { chromium, BrowserContext, Page } from 'playwright';
import * as http from 'http';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as os from 'os';
import * as fs from 'fs';
import { logInfo } from '../utils/logger';

dotenv.config();

const host = process.env.CDP_HOST || '127.0.0.1';
const port = process.env.CDP_PORT || '9222';

export async function checkChromeCDP(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/json/version`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function isWSL(): boolean {
  if (process.platform !== 'linux') return false;
  if (os.release().toLowerCase().includes('microsoft')) return true;
  try {
    return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

export function printCDPInstructions(): void {
  const platform = process.platform;
  console.log(chalk.red.bold('\n[Error] Could not connect to Google Chrome via Remote Debugging.'));
  console.log(chalk.yellow(`Please make sure Chrome is started with --remote-debugging-port=${port}.\n`));

  if (isWSL()) {
    console.log(chalk.yellow.bold('[WSL Detected] You are running this Node script inside WSL (Linux), but Chrome is running on Windows.'));
    console.log(chalk.white('By default, 127.0.0.1 inside WSL cannot reach the Windows host loopback.\n'));
    console.log(chalk.cyan('Recommendations:'));
    console.log(chalk.white(' 1. (Recommended) Run this Node script inside a Windows CMD or PowerShell window instead.'));
    console.log(chalk.white(' 2. Or, run: ip route | grep default | awk \'{print $3}\' in WSL to find your Windows host IP,'));
    console.log(chalk.white(`    and set CDP_HOST=<host_ip> in your .env file.\n`));
    return;
  }

  console.log(chalk.cyan('How to start Google Chrome with debugging enabled:'));

  if (platform === 'darwin') {
    console.log(chalk.white('Run the following command in Terminal (macOS):'));
    console.log(chalk.green(`/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${port} --user-data-dir="/Users/ssbushi/ChromeDevSession"`));
  } else if (platform === 'win32') {
    console.log(chalk.white('Run the following command in Command Prompt (CMD):'));
    console.log(chalk.green(`"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=${port} --user-data-dir="C:\\ChromeDevSession"`));
    console.log(chalk.white('\nOr run in PowerShell:'));
    console.log(chalk.green(`& "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=${port} --user-data-dir="C:\\ChromeDevSession"`));
  } else {
    console.log(chalk.white('Run the following command in Terminal (Linux):'));
    console.log(chalk.green(`google-chrome --remote-debugging-port=${port} --user-data-dir="/tmp/ChromeDevSession"`));
  }
  console.log('');
}

export async function connectToChrome(): Promise<{ context: BrowserContext; zerodhaPage: Page; sensibullPage: Page }> {
  const isCDPRunning = await checkChromeCDP();
  if (!isCDPRunning) {
    printCDPInstructions();
    throw new Error('Chrome remote debugging is not available.');
  }

  const browser = await chromium.connectOverCDP(`http://${host}:${port}`);
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error('No browser contexts found in the remote Chrome instance.');
  }

  const context = contexts[0];
  const pages = context.pages();

  let zerodhaPage: Page | null = null;
  let sensibullPage: Page | null = null;

  for (const page of pages) {
    const url = page.url();
    const title = await page.title().catch(() => '');

    if (url.includes('kite.zerodha.com') || title.toLowerCase().includes('kite')) {
      zerodhaPage = page;
    }
    if (url.includes('sensibull.com') || title.toLowerCase().includes('sensibull')) {
      sensibullPage = page;
    }
  }

  if (!zerodhaPage || !sensibullPage) {
    const missing: string[] = [];
    if (!zerodhaPage) missing.push('Zerodha Kite');
    if (!sensibullPage) missing.push('Sensibull');
    
    console.log(chalk.yellow(`\n[Warning] Could not find the following tabs in your open browser: ${missing.join(', ')}`));
    console.log(chalk.white('Please ensure you have opened and logged into:'));
    if (!zerodhaPage) console.log(chalk.white('  - Zerodha Kite (kite.zerodha.com)'));
    if (!sensibullPage) console.log(chalk.white('  - Sensibull (sensibull.com)'));
    console.log('');
    throw new Error('Required trading tabs are not open.');
  }

  return { context, zerodhaPage, sensibullPage };
}

export async function connectToChromeOI(): Promise<{ context: BrowserContext; zerodhaPage: Page; sensibullOIPage: Page }> {
  const isCDPRunning = await checkChromeCDP();
  if (!isCDPRunning) {
    printCDPInstructions();
    throw new Error('Chrome remote debugging is not available.');
  }

  const browser = await chromium.connectOverCDP(`http://${host}:${port}`);
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error('No browser contexts found in the remote Chrome instance.');
  }

  const context = contexts[0];
  const pages = context.pages();

  let zerodhaPage: Page | null = null;
  let sensibullOIPage: Page | null = null;

  for (const page of pages) {
    const url = page.url();
    const title = await page.title().catch(() => '');

    if (url.includes('kite.zerodha.com') || title.toLowerCase().includes('kite')) {
      zerodhaPage = page;
    }
    if (url.includes('sensibull.com/open_interest') || (url.includes('sensibull.com') && title.toLowerCase().includes('open interest'))) {
      sensibullOIPage = page;
    }
  }

  if (!zerodhaPage) {
    console.log(chalk.yellow(`\n[Warning] Could not find Zerodha Kite tab in your open browser.`));
    console.log(chalk.white('Please ensure you have opened and logged into:'));
    console.log(chalk.white('  - Zerodha Kite (kite.zerodha.com)'));
    console.log('');
    throw new Error('Required Zerodha Kite tab is not open.');
  }

  if (!sensibullOIPage) {
    logInfo('Sensibull Open Interest tab not found. Opening a new tab...');
    sensibullOIPage = await context.newPage();
    await sensibullOIPage.goto('https://web.sensibull.com/open_interest', { waitUntil: 'domcontentloaded' });
  }

  return { context, zerodhaPage, sensibullOIPage };
}
