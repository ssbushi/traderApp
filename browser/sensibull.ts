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

  try {
    // Attempting common path lookups
    const data = rawJson.data || rawJson;
    
    // Spot / underlying price
    price = data.underlying_price || data.underlyingPrice || data.spot_price || data.spotPrice || data.last_price;
    if (typeof price === 'string') price = parseFloat(price);

    // PCR
    pcr = data.pcr || data.put_call_ratio || data.putCallRatio;
    if (typeof pcr === 'string') pcr = parseFloat(pcr);

    // Max Pain
    maxPain = data.max_pain || data.maxPain;
    if (typeof maxPain === 'string') maxPain = parseFloat(maxPain);

    // India Vix
    indiaVix = data.vix || data.india_vix || data.indiaVix || data.vix_price;
    if (typeof indiaVix === 'string') indiaVix = parseFloat(indiaVix);

    // IV Percentile
    ivPercentile = data.ivp || data.iv_percentile || data.ivPercentile;
    if (typeof ivPercentile === 'string') ivPercentile = parseFloat(ivPercentile);

    // Expiry
    expiryUsed = data.expiry || data.expiry_used || data.expiryUsed || data.nearest_expiry;
  } catch (err) {
    console.log(chalk.yellow('Warning: Error parsing standard fields from Sensibull JSON. Fallback to raw JSON will be used.'));
  }

  console.log(chalk.blue('\n--- Extracted Sensibull Metrics ---'));
  console.log(`  Price: ${price ?? 'N/A'}`);
  console.log(`  PCR: ${pcr ?? 'N/A'}`);
  console.log(`  Max Pain: ${maxPain ?? 'N/A'}`);
  console.log(`  India VIX: ${indiaVix ?? 'N/A'}`);
  console.log(`  IV Percentile: ${ivPercentile ?? 'N/A'}`);
  console.log(`  Expiry Used: ${expiryUsed ?? 'N/A'}`);
  console.log('-----------------------------------\n');

  return {
    price,
    pcr,
    maxPain,
    indiaVix,
    ivPercentile,
    expiryUsed,
    rawJson
  };
}
