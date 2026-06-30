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

  // Selector checks for the Download/Export button
  const customSelector = process.env.ZERODHA_DOWNLOAD_SELECTOR;
  const downloadSelectors = customSelector 
    ? [customSelector] 
    : [
        'text="Download"',
        'text="Export"',
        'button:has-text("Download")',
        'button:has-text("Export")',
        'div:has-text("Download")',
        'span:has-text("Download")',
        '[class*="btn" i]:has-text("Download")',
        '[title*="Download" i]',
        '[title*="Export" i]',
        '[aria-label*="Download" i]',
        '[aria-label*="Export" i]',
        '.download-button',
        '.export-button'
      ];

  let downloadSelector: string | null = null;

  // Helper to check if any download button is visible
  const findVisibleDownloadButton = async (): Promise<string | null> => {
    for (const sel of downloadSelectors) {
      try {
        const isVisible = await searchContext.locator(sel).first().isVisible();
        if (isVisible) return sel;
      } catch {}
    }
    return null;
  };

  // Try finding it directly
  downloadSelector = await findVisibleDownloadButton();

  // If not visible, try to toggle Table View (required for ChartIQ)
  if (!downloadSelector) {
    console.log(chalk.blue('Download button not immediately visible. Attempting to toggle Table View...'));
    const tableSelectors = [
      'cq-toggle.tableview-ui',
      'cq-toggle[cq-member="tableView"]',
      'cq-toggle:has-text("Table View")',
      '[title*="table" i]',
      '[aria-label*="table" i]',
      'button:has-text("Table")',
      '[class*="table" i]',
      '.ciq-table'
    ];

    let tableToggled = false;
    for (const sel of tableSelectors) {
      try {
        const btn = searchContext.locator(sel).first();
        if (await btn.isVisible()) {
          console.log(chalk.blue(`Found Table View toggle button: "${sel}". Clicking...`));
          await btn.click();
          tableToggled = true;
          break;
        }
      } catch {}
    }

    if (tableToggled) {
      console.log(chalk.blue('Table View toggled. Waiting for the Download button to render...'));
      await page.waitForTimeout(1000); // Allow table rendering time
      downloadSelector = await findVisibleDownloadButton();
    }
  }

  if (!downloadSelector) {
    console.log(chalk.red('\n[Error] Could not find the export or download button on the Zerodha chart.'));
    
    // Dump open frames for diagnostics
    console.log(chalk.yellow('\n--- Diagnostic Info: Open Frames ---'));
    const allFrames = page.frames();
    console.log(`Total frames found: ${allFrames.length}`);
    allFrames.forEach((f, idx) => {
      console.log(`  Frame ${idx}: Name="${f.name()}", URL="${f.url()}"`);
    });

    // Extract DOM information from the searchContext
    try {
      console.log(chalk.yellow('\n--- Diagnostic Info: Frame DOM Content ---'));
      
      const bodyText = await searchContext.evaluate(() => document.body.innerText).catch(() => 'Failed to read body text');
      console.log(`Visible text length in frame: ${bodyText.length} characters.`);
      console.log(`First 500 characters of text in frame:`);
      console.log(chalk.gray(bodyText.substring(0, 500)));

      // Find all buttons, links, and cq-toggle elements
      const elements = await searchContext.evaluate(() => {
        const results: any[] = [];
        const addEl = (el: Element, type: string) => {
          results.push({
            type,
            tag: el.tagName.toLowerCase(),
            class: el.className || '',
            id: el.id || '',
            text: (el.textContent || '').trim().substring(0, 50),
            title: el.getAttribute('title') || '',
            role: el.getAttribute('role') || '',
            cqMember: el.getAttribute('cq-member') || ''
          });
        };

        document.querySelectorAll('button, a, cq-toggle, [class*="btn" i], .download, .export').forEach(el => {
          addEl(el, 'interactive');
        });
        
        return results;
      }).catch(() => []);

      console.log(chalk.cyan(`\nFound ${elements.length} potentially interactive elements in frame:`));
      elements.slice(0, 30).forEach((el, idx) => {
        console.log(`  [${idx}] <${el.tag} id="${el.id}" class="${el.class}" title="${el.title}" cq-member="${el.cqMember}"> Text: "${el.text}"`);
      });
      if (elements.length > 30) {
        console.log(`  ... and ${elements.length - 30} more elements.`);
      }

      // Write full HTML of the iframe body to a local file for the user to inspect
      const fullHtml = await searchContext.evaluate(() => document.body.innerHTML).catch(() => 'Failed to read innerHTML');
      const dumpPath = './dom_dump.html';
      fs.writeFileSync(dumpPath, fullHtml, 'utf8');
      console.log(chalk.green(`\n[Diagnostic Check] Full HTML content of the chart frame has been written to: ${dumpPath}`));
      console.log(chalk.yellow('You can open this file in a browser to inspect the DOM structure Playwright is seeing.\n'));

    } catch (err: any) {
      console.log(chalk.red(`Failed to run DOM diagnostics: ${err.message}`));
    }

    console.log(chalk.yellow('Please make sure:'));
    console.log(chalk.white(' 1. The chart is open and visible on the Zerodha tab.'));
    console.log(chalk.white(' 2. You have enabled the "Table View" toggle on the chart toolbar (see the grid icon).'));
    console.log(chalk.white(` 3. Or specify ZERODHA_DOWNLOAD_SELECTOR in your .env file.\n`));
    throw new Error('Export/Download button not found on Zerodha page.');
  }

  console.log(chalk.blue(`Found download button matching selector: "${downloadSelector}". Clicking...`));

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
