import { Page } from 'playwright';
import csv from 'csv-parser';
import * as fs from 'fs';
import chalk from 'chalk';

export interface ZerodhaData {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  cprPivot?: number;
  cprBC?: number;
  cprTC?: number;
  atr?: number;
  plusDI?: number;
  minusDI?: number;
  adx?: number;
  rawRow: any;
}

export async function fetchZerodhaData(page: Page): Promise<ZerodhaData> {
  console.log(chalk.blue('Locating Zerodha Chart frame...'));
  await page.bringToFront();

  // Find the TradingView iframe
  const frames = page.frames();
  let chartFrame = null;
  for (const f of frames) {
    const url = f.url();
    if (url.includes('tv.kite.trade') || url.includes('chartiq') || url.includes('chart') || url.includes('tradingview')) {
      chartFrame = f;
      break;
    }
  }

  const searchContext = chartFrame || page;
  if (chartFrame) {
    console.log(chalk.green(`Found chart iframe: ${chartFrame.url()}`));
  } else {
    console.log(chalk.yellow('Chart iframe not found. Searching on the main page.'));
  }

  // Selector checks
  const customSelector = process.env.ZERODHA_DOWNLOAD_SELECTOR;
  const selectors = customSelector 
    ? [customSelector] 
    : [
        'button:has-text("Export")',
        'button:has-text("Download")',
        '[title*="Export"]',
        '[title*="Download"]',
        '[aria-label*="Export"]',
        '[aria-label*="Download"]',
        '.export-button',
        '.download-button'
      ];

  let downloadSelector: string | null = null;
  for (const sel of selectors) {
    try {
      const isVisible = await searchContext.locator(sel).first().isVisible();
      if (isVisible) {
        downloadSelector = sel;
        break;
      }
    } catch {}
  }

  if (!downloadSelector) {
    console.log(chalk.red('\n[Error] Could not find the export or download button on the Zerodha chart.'));
    console.log(chalk.yellow('Please make sure:'));
    console.log(chalk.white(' 1. The chart is open and visible on the Zerodha tab.'));
    console.log(chalk.white(' 2. You are using TradingView charts with the Export button enabled.'));
    console.log(chalk.white(` 3. Or specify ZERODHA_DOWNLOAD_SELECTOR in your .env file.\n`));
    throw new Error('Export button not found on Zerodha page.');
  }

  console.log(chalk.blue(`Found export button matching selector: "${downloadSelector}". Clicking...`));

  // Trigger download
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await searchContext.locator(downloadSelector).first().click();
  const download = await downloadPromise;

  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error('Failed to capture downloaded CSV file path.');
  }

  console.log(chalk.green(`CSV downloaded successfully to temp file: ${downloadPath}`));

  // Parse CSV
  const rows: any[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(downloadPath)
      .pipe(csv())
      .on('data', (data: any) => rows.push(data))
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err));
  });

  // Clean up temp file
  try {
    fs.unlinkSync(downloadPath);
  } catch {}

  if (rows.length === 0) {
    throw new Error('Downloaded CSV is empty.');
  }

  // Get the most recent row (usually the last row)
  const lastRow = rows[rows.length - 1];
  console.log(chalk.blue('Parsing metrics from the latest chart row:'));
  console.log(JSON.stringify(lastRow, null, 2));

  // Match columns case-insensitively
  const findVal = (keys: string[]): number | undefined => {
    const rowKeys = Object.keys(lastRow);
    for (const key of keys) {
      const matchedKey = rowKeys.find(rk => rk.toLowerCase().includes(key.toLowerCase()));
      if (matchedKey && lastRow[matchedKey] !== undefined && lastRow[matchedKey] !== '') {
        const val = parseFloat(lastRow[matchedKey]);
        if (!isNaN(val)) return val;
      }
    }
    return undefined;
  };

  // Find datetime
  const rowKeys = Object.keys(lastRow);
  const dateKey = rowKeys.find(rk => {
    const lk = rk.toLowerCase();
    return lk.includes('date') || lk.includes('time');
  }) || rowKeys[0];
  const datetime = lastRow[dateKey] || new Date().toISOString();

  const open = findVal(['open']) || 0;
  const high = findVal(['high']) || 0;
  const low = findVal(['low']) || 0;
  const close = findVal(['close']) || 0;

  // Indicators mapping
  const cprPivot = findVal(['pivot', 'cpr pivot']);
  const cprBC = findVal(['bc', 'cpr bc']);
  const cprTC = findVal(['tc', 'cpr tc']);
  const atr = findVal(['atr', 'average true range']);
  const plusDI = findVal(['+di', 'plus di', 'plus_di']);
  const minusDI = findVal(['-di', 'minus di', 'minus_di']);
  const adx = findVal(['adx', 'average directional index']);

  // Log warnings if critical indicators are missing
  const missingIndicators: string[] = [];
  if (cprPivot === undefined) missingIndicators.push('CPR Pivot');
  if (cprBC === undefined) missingIndicators.push('CPR BC');
  if (cprTC === undefined) missingIndicators.push('CPR TC');
  if (atr === undefined) missingIndicators.push('ATR');
  if (adx === undefined) missingIndicators.push('ADX');

  if (missingIndicators.length > 0) {
    console.log(chalk.yellow(`\n[Warning] The following indicators could not be parsed from the CSV: ${missingIndicators.join(', ')}`));
    console.log(chalk.white('Please ensure you have loaded these studies/indicators onto your active Zerodha chart layout.'));
    console.log(chalk.white('Available columns in your downloaded CSV:'), rowKeys.join(', '), '\n');
  }

  return {
    datetime,
    open,
    high,
    low,
    close,
    cprPivot,
    cprBC,
    cprTC,
    atr,
    plusDI,
    minusDI,
    adx,
    rawRow: lastRow
  };
}
