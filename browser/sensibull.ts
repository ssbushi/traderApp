import { Page } from 'playwright';
import chalk from 'chalk';
import * as fs from 'fs';
import { logDebug } from '../utils/logger';

export interface SensibullData {
  price?: number;
  pcr?: number;
  maxPain?: number;
  indiaVix?: number;
  ivPercentile?: number;
  expiryUsed?: string;
  callOi?: number;
  putOi?: number;
  callOiChange?: number;
  putOiChange?: number;
  futureOi?: number;
  futureOiChange?: number;
  rawJson: any; // Resilient fallback for Gemini to parse
}

export async function fetchSensibullData(page: Page): Promise<SensibullData> {
  logDebug(chalk.blue('Waiting for Sensibull data interception...'));

  // Setup interception promise
  const responsePromise = page.waitForResponse(
    (response) => {
      const url = response.url();
      return (
        (url.includes('compute_intraday') || url.includes('intraday') || url.includes('option_chain')) &&
        response.status() === 200
      );
    },
    { timeout: 20000 }
  ).catch(() => null);

  // Bring to front and trigger a reload to force the API call
  await page.bringToFront();
  logDebug(chalk.blue('Reloading Sensibull page to capture API payload...'));
  await page.reload({ waitUntil: 'domcontentloaded' });

  const response = await responsePromise;
  if (!response) {
    throw new Error('Failed to intercept Sensibull compute_intraday API response within 20 seconds.');
  }

  logDebug(chalk.green('Successfully intercepted Sensibull API response!'));
  logDebug(chalk.blue(`Intercepted URL: ${response.url()}`));
  
  const rawJson = await response.json();

  // Save the raw JSON payload to a workspace file for easy inspection
  try {
    fs.writeFileSync('./sensibull_dump.json', JSON.stringify(rawJson, null, 2), 'utf8');
    logDebug(chalk.green('[Diagnostic Check] Full Sensibull JSON has been written to: ./sensibull_dump.json'));
    logDebug(chalk.blue(`JSON Root Keys: ${Object.keys(rawJson).join(', ')}`));
    if (rawJson.data) {
      logDebug(chalk.blue(`JSON "data" sub-keys: ${Object.keys(rawJson.data).join(', ')}`));
    }
  } catch (err: any) {
    logDebug(chalk.yellow(`Could not save JSON diagnostics: ${err.message}`));
  }

  // Resiliently attempt to parse key high-level indicators if they exist in common structures
  let price: number | undefined;
  let pcr: number | undefined;
  let maxPain: number | undefined;
  let indiaVix: number | undefined;
  let ivPercentile: number | undefined;
  let expiryUsed: string | undefined;
  let callOi: number | undefined;
  let putOi: number | undefined;
  let callOiChange: number | undefined;
  let putOiChange: number | undefined;
  let futureOi: number | undefined;
  let futureOiChange: number | undefined;

  try {
    const payload = rawJson.payload || rawJson;
    const chartData = payload.chart_data;

    if (chartData) {
      // Find the latest timestamp key (keys are sorted by ISO datetime strings)
      const timestamps = Object.keys(chartData).sort();
      const latestTimestamp = timestamps[timestamps.length - 1];
      console.log(chalk.blue(`Latest intraday data timestamp: ${latestTimestamp}`));

      const latestData = chartData[latestTimestamp];
      if (latestData) {
        price = latestData.spot || latestData.nifty;
        
        if (latestData.pcr_data) {
          pcr = latestData.pcr_data.pcr;
        }
        
        if (latestData.max_pain_data) {
          maxPain = latestData.max_pain_data.max_pain;
        }
        
        if (latestData.indiavix) {
          indiaVix = latestData.indiavix.indiavix_price;
        }
        
        if (latestData.ivp) {
          ivPercentile = latestData.ivp.ivp;
          expiryUsed = latestData.ivp.expiry;
        }
        
        if (latestData.iv && !expiryUsed) {
          expiryUsed = latestData.iv.atm_iv_expiry;
        }

        if (latestData.oi_options) {
          callOi = latestData.oi_options.call_oi;
          putOi = latestData.oi_options.put_oi;
        }

        if (latestData.oi_change_options) {
          callOiChange = latestData.oi_change_options.call_oi_change;
          putOiChange = latestData.oi_change_options.put_oi_change;
        }

        if (latestData.oi_futures) {
          futureOi = latestData.oi_futures.futures_oi;
        }

        if (latestData.oi_change_futures) {
          futureOiChange = latestData.oi_change_futures.future_oi_change;
        }
      }
    }
  } catch (err: any) {
    logDebug(chalk.yellow(`Warning: Error parsing standard fields from Sensibull JSON: ${err.message}`));
  }

  logDebug(chalk.blue('\n--- Extracted Sensibull Metrics ---'));
  logDebug(`  Price: ${price ?? 'N/A'}`);
  logDebug(`  PCR: ${pcr ?? 'N/A'}`);
  logDebug(`  Max Pain: ${maxPain ?? 'N/A'}`);
  logDebug(`  India VIX: ${indiaVix ?? 'N/A'}`);
  logDebug(`  IV Percentile: ${ivPercentile ?? 'N/A'}`);
  logDebug(`  Expiry Used: ${expiryUsed ?? 'N/A'}`);
  logDebug(`  Call OI: ${callOi ?? 'N/A'} (Change: ${callOiChange ?? 'N/A'})`);
  logDebug(`  Put OI: ${putOi ?? 'N/A'} (Change: ${putOiChange ?? 'N/A'})`);
  logDebug(`  Future OI: ${futureOi ?? 'N/A'} (Change: ${futureOiChange ?? 'N/A'})`);
  logDebug('-----------------------------------\n');

  return {
    price,
    pcr,
    maxPain,
    indiaVix,
    ivPercentile,
    expiryUsed,
    callOi,
    putOi,
    callOiChange,
    putOiChange,
    futureOi,
    futureOiChange,
    rawJson
  };
}
