import * as dotenv from 'dotenv';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { connectToChrome } from './browser/connection';
import { fetchSensibullData } from './browser/sensibull';
import { fetchZerodhaData } from './browser/zerodha';
import { generateStrategy } from './ai/prompts';
import { StrategyResponse } from './ai/genkit';

dotenv.config();

const intervalMinutes = parseInt(process.env.INTERVAL_MINUTES || '5', 10);
const intervalMs = intervalMinutes * 60 * 1000;

function printStrategyCard(strategy: StrategyResponse) {
  let sentimentColor = chalk.white;
  if (strategy.marketSentiment === 'BULLISH') sentimentColor = chalk.green.bold;
  if (strategy.marketSentiment === 'BEARISH') sentimentColor = chalk.red.bold;
  if (strategy.marketSentiment === 'NEUTRAL') sentimentColor = chalk.yellow.bold;
  if (strategy.marketSentiment === 'HIGH_VOLATILITY_NO_TRADE') sentimentColor = chalk.magenta.bold;

  let legsText = '';
  if (strategy.legs.length === 0) {
    legsText = chalk.italic('  No option legs recommended (No Trade setup).');
  } else {
    legsText = strategy.legs.map(l => {
      const actionColor = l.action === 'BUY' ? chalk.green : chalk.red;
      const typeColor = l.optionType === 'CE' ? chalk.cyan : chalk.yellow;
      return `  ${actionColor(l.action)} NIFTY ${l.strikePrice} ${typeColor(l.optionType)} [Expiry: ${l.expiry}]${l.approxPremium ? ` (Est. Premium: ₹${l.approxPremium})` : ''}`;
    }).join('\n');
  }

  const cardContent = [
    `${chalk.cyan.bold('MARKET OUTLOOK: ')} ${sentimentColor(strategy.marketSentiment)}`,
    ``,
    `${chalk.bold.underline('CPR Indicator Summary')}`,
    `${strategy.cprAnalysis}`,
    ``,
    `${chalk.bold.underline('Options Data Metrics')}`,
    `${strategy.optionsAnalysis}`,
    ``,
    `${chalk.cyan.bold('PROPOSED STRATEGY:  ')} ${chalk.greenBright.bold(strategy.strategyName)}`,
    ``,
    `${chalk.bold.underline('Recommended Options Position')}`,
    `${legsText}`,
    ``,
    `${chalk.bold('Target Exit Level: ')} ${chalk.green(strategy.target)}`,
    `${chalk.bold('Stop Loss Trigger: ')} ${chalk.red(strategy.stopLoss)}`,
    ``,
    `${chalk.bold.underline('Technical & Options Rationale')}`,
    strategy.rationale.map(r => `  • ${r}`).join('\n')
  ].join('\n');

  const boxed = boxen(cardContent, {
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: 'green',
    title: chalk.bold.yellow(' 🤖 NIFTY OPTIONS CO-PILOT '),
    titleAlignment: 'center'
  });

  console.log(boxed);
}

async function runPipeline() {
  const spinner = ora().start();
  try {
    spinner.text = 'Connecting to Chrome remote debugging session...';
    const { zerodhaPage, sensibullPage } = await connectToChrome();
    spinner.succeed('Connected to Chrome debugging session successfully!');

    spinner.start('Interacting with Zerodha Kite chart and exporting indicators...');
    const zerodhaData = await fetchZerodhaData(zerodhaPage);
    spinner.succeed('Successfully fetched Zerodha indicators!');

    spinner.start('Interacting with Sensibull and intercepting option chain API...');
    const sensibullData = await fetchSensibullData(sensibullPage);
    spinner.succeed('Successfully fetched Sensibull option metrics!');

    spinner.start('Synthesizing data and invoking Gemini model...');
    const strategy = await generateStrategy(zerodhaData, sensibullData);
    spinner.succeed('Synthesized strategy analysis successfully!\n');

    printStrategyCard(strategy);

    console.log(chalk.gray(`Next analysis cycle in ${intervalMinutes} minutes at ${new Date(Date.now() + intervalMs).toLocaleTimeString()}...\n`));

  } catch (error: any) {
    spinner.fail('Pipeline execution failed.');
    console.log(chalk.red(`Error: ${error.message || error}`));
    console.log(chalk.yellow(`Retrying in ${intervalMinutes} minutes...\n`));
  }
}

async function main() {
  console.clear();
  console.log(chalk.yellow.bold('=============================================='));
  console.log(chalk.yellow.bold('    NIFTY Option Analysis AI Pipeline CLI      '));
  console.log(chalk.yellow.bold('==============================================\n'));

  // Run the first pipeline execution immediately
  await runPipeline();

  // Run subsequent executions in interval loops
  setInterval(async () => {
    console.log(chalk.blue(`[Cycle Started] - Running scheduled options analysis...`));
    await runPipeline();
  }, intervalMs);
}

main().catch(err => {
  console.error(chalk.red('Fatal Main Error:'), err);
});
