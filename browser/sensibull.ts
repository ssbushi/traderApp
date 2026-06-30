import { Page } from 'playwright';
import chalk from 'chalk';
import * as fs from 'fs';

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
  console.log(chalk.blue('Waiting for Sensibull data interception...'));

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
  console.log(chalk.blue('Reloading Sensibull page to capture API payload...'));
  await page.reload({ waitUntil: 'domcontentloaded' });

  const response = await responsePromise;
  if (!response) {
    throw new Error('Failed to intercept Sensibull compute_intraday API response within 20 seconds.');
  }

  console.log(chalk.green('Successfully intercepted Sensibull API response!'));
  console.log(chalk.blue(`Intercepted URL: ${response.url()}`));
  
  const rawJson = await response.json();

  // Save the raw JSON payload to a workspace file for easy inspection
  try {
    fs.writeFileSync('./sensibull_dump.json', JSON.stringify(rawJson, null, 2), 'utf8');
    console.log(chalk.green('[Diagnostic Check] Full Sensibull JSON has been written to: ./sensibull_dump.json'));
    console.log(chalk.blue(`JSON Root Keys: ${Object.keys(rawJson).join(', ')}`));
    if (rawJson.data) {
      console.log(chalk.blue(`JSON "data" sub-keys: ${Object.keys(rawJson.data).join(', ')}`));
    }
  } catch (err: any) {
    console.log(chalk.yellow(`Could not save JSON diagnostics: ${err.message}`));
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
    console.log(chalk.yellow(`Warning: Error parsing standard fields from Sensibull JSON: ${err.message}`));
  }

  console.log(chalk.blue('\n--- Extracted Sensibull Metrics ---'));
  console.log(`  Price: ${price ?? 'N/A'}`);
  console.log(`  PCR: ${pcr ?? 'N/A'}`);
  console.log(`  Max Pain: ${maxPain ?? 'N/A'}`);
  console.log(`  India VIX: ${indiaVix ?? 'N/A'}`);
  console.log(`  IV Percentile: ${ivPercentile ?? 'N/A'}`);
  console.log(`  Expiry Used: ${expiryUsed ?? 'N/A'}`);
  console.log(`  Call OI: ${callOi ?? 'N/A'} (Change: ${callOiChange ?? 'N/A'})`);
  console.log(`  Put OI: ${putOi ?? 'N/A'} (Change: ${putOiChange ?? 'N/A'})`);
  console.log(`  Future OI: ${futureOi ?? 'N/A'} (Change: ${futureOiChange ?? 'N/A'})`);
  console.log('-----------------------------------\n');

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
