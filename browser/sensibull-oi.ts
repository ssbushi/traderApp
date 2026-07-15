import { Page } from 'playwright';
import chalk from 'chalk';
import * as fs from 'fs';
import { logDebug, logInfo } from '../utils/logger';

export interface SensibullOIData {
  pcr?: number;
  currentLtp?: number;
  atmStrike?: number;
  perStrikeData: Record<string, {
    callOi: number;
    putOi: number;
    prevCallOi: number;
    prevPutOi: number;
  }>;
  rawJson?: any;
}

export async function fetchSensibullOIData(page: Page): Promise<SensibullOIData> {
  logDebug(chalk.blue('Waiting for Sensibull Open Interest (oi_chart) API response...'));

  // Setup response intercept promise
  const responsePromise = page.waitForResponse(
    (response) => {
      const url = response.url();
      return url.includes('oi_chart') && response.status() === 200;
    },
    { timeout: 20000 }
  ).catch(() => null);

  // Navigate to Open Interest page if not already there, otherwise reload
  await page.bringToFront();
  const currentUrl = page.url();
  if (!currentUrl.includes('open-interest')) {
    logDebug(chalk.blue('Navigating Sensibull to Open Interest page...'));
    await page.goto('https://web.sensibull.com/open-interest/oi-vs-strike?tradingsymbol=NIFTY', { waitUntil: 'domcontentloaded' }).catch(() => {});
  } else {
    logDebug(chalk.blue('Reloading Sensibull Open Interest page to capture fresh data...'));
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  }

  // Click the "5" preset under "Strikes above and below ATM" to trigger/ensure the 5 strikes request
  logDebug(chalk.blue('Waiting for page elements to render and looking for "5" preset button...'));
  await page.waitForTimeout(2000); // Allow UI elements to load
  
  const clickFivePreset = async (): Promise<boolean> => {
    const locators = [
      page.locator('button:text-is("5")'),
      page.locator('div:text-is("5")'),
      page.locator('span:text-is("5")'),
      page.locator('button:has-text("5")')
    ];
    for (const loc of locators) {
      try {
        if (await loc.first().isVisible()) {
          await loc.first().click();
          return true;
        }
      } catch {}
    }
    return false;
  };

  const clicked = await clickFivePreset();
  if (clicked) {
    logDebug(chalk.green('Successfully clicked the "5" preset button to set strike range.'));
  } else {
    logDebug(chalk.yellow('Could not find the "5" preset button. Relying on default loaded range.'));
  }

  const response = await responsePromise;
  if (!response) {
    throw new Error('Failed to intercept Sensibull oi_chart API response within 20 seconds.');
  }

  logDebug(chalk.green('Successfully intercepted Sensibull oi_chart API response!'));
  const rawJson = await response.json();

  // Save the raw JSON payload to a workspace file for easy inspection
  try {
    fs.writeFileSync('./sensibull_oi_dump.json', JSON.stringify(rawJson, null, 2), 'utf8');
    logDebug(chalk.green('[Diagnostic Check] Full Sensibull OI JSON written to: ./sensibull_oi_dump.json'));
  } catch (err: any) {
    logDebug(chalk.yellow(`Could not save OI JSON diagnostics: ${err.message}`));
  }

  const payload = rawJson.payload || {};
  const pcr = payload.pcr;
  const currentLtp = payload.current_ltp;
  const atmStrike = payload.atm_strike;
  const perStrikeDataRaw = payload.per_strike_data || {};

  const perStrikeData: Record<string, any> = {};
  for (const strike of Object.keys(perStrikeDataRaw)) {
    const data = perStrikeDataRaw[strike];
    perStrikeData[strike] = {
      callOi: data.call_oi || 0,
      putOi: data.put_oi || 0,
      prevCallOi: data.prev_call_oi || 0,
      prevPutOi: data.prev_put_oi || 0
    };
  }

  return {
    pcr,
    currentLtp,
    atmStrike,
    perStrikeData,
    rawJson
  };
}
