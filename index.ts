import * as dotenv from 'dotenv';
import chalk from 'chalk';
import boxen from 'boxen';
import { connectToChrome } from './browser/connection';
import { fetchSensibullData } from './browser/sensibull';
import { fetchZerodhaData } from './browser/zerodha';
import { generateStrategy } from './ai/prompts';
import { StrategyResponse } from './ai/genkit';
import { isDebug, logDebug, logInfo } from './utils/logger';

dotenv.config();

const intervalMinutes = parseInt(process.env.INTERVAL_MINUTES || '5', 10);
const intervalMs = intervalMinutes * 60 * 1000;

function printStrategyCard(strategy: StrategyResponse) {
  let sentimentColor = chalk.white;
  if (strategy.marketSentiment === 'BULLISH') sentimentColor = chalk.green.bold;
  if (strategy.marketSentiment === 'BEARISH') sentimentColor = chalk.red.bold;
  if (strategy.marketSentiment === 'NEUTRAL') sentimentColor = chalk.yellow.bold;
  if (strategy.marketSentiment === 'HIGH_VOLATILITY_NO_TRADE') sentimentColor = chalk.magenta.bold;

  const cardContent = [
    `${chalk.cyan.bold('OUTLOOK:')} ${sentimentColor(strategy.marketSentiment)}  |  ${chalk.cyan.bold('STRATEGY:')} ${chalk.yellow.bold(strategy.strategyName)}`,
    `${chalk.gray('—'.repeat(60))}`,
    `${chalk.bold.underline('RANGE & CURRENT LOCATION')}`,
    `• ${chalk.green.bold('Support:')} ${chalk.green(strategy.support)}   • ${chalk.red.bold('Resistance:')} ${chalk.red(strategy.resistance)}`,
    `• ${chalk.bold('Current Status:')} ${chalk.cyan(strategy.currentPriceStatus)}`,
    `${chalk.gray('—'.repeat(60))}`,
    `${chalk.bold.underline('ACTIONABLE TRADE SETUPS')}`,
    ``,
    `🟢 ${chalk.green.bold('TRADE 1: LONG SETUP')}`,
    `  ${chalk.bold('Trigger:')} ${strategy.longTrigger}`,
    `  ${chalk.bold('Entry:')} ${chalk.green(strategy.longEntry)}  |  ${chalk.bold('SL:')} ${chalk.red(strategy.longStopLoss)}`,
    `  ${chalk.bold('Targets:')} ${strategy.longTargets.map(t => chalk.green(t)).join(' ➔ ')}`,
    ``,
    `🔴 ${chalk.red.bold('TRADE 2: BREAKDOWN SHORT')}`,
    `  ${chalk.bold('Trigger:')} ${strategy.breakdownTrigger}`,
    `  ${chalk.bold('Entry:')} ${chalk.red(strategy.breakdownEntry)}  |  ${chalk.bold('SL:')} ${chalk.green(strategy.breakdownStopLoss)}`,
    `  ${chalk.bold('Targets:')} ${strategy.breakdownTargets.map(t => chalk.red(t)).join(' ➔ ')}`,
    ``,
    `🔴 ${chalk.red.bold('TRADE 3: RESISTANCE SHORT')}`,
    `  ${chalk.bold('Trigger:')} ${strategy.resistanceTrigger}`,
    `  ${chalk.bold('Entry:')} ${chalk.red(strategy.resistanceEntry)}  |  ${chalk.bold('SL:')} ${chalk.green(strategy.resistanceStopLoss)}`,
    `  ${chalk.bold('Targets:')} ${strategy.resistanceTargets.map(t => chalk.red(t)).join(' ➔ ')}`,
    `${chalk.gray('—'.repeat(60))}`,
    `${chalk.bold.underline('INSTITUTIONAL POSITIONING (OI)')}`,
    strategy.institutionalOI.map(oi => `• ${oi}`).join('\n'),
    `${chalk.gray('—'.repeat(60))}`,
    `${chalk.bold.underline('💥 SYSTEM RISK METRICS & ALERTS')}`,
    `• ${chalk.yellow.bold('Max Ceiling (OI):')} ${strategy.maxCeiling}  |  ${chalk.cyan.bold('Max Floor (OI):')} ${strategy.maxFloor}`,
    `• ${chalk.red.bold('Gamma Squeeze Level:')} ${strategy.gammaSqueeze}`,
    `• ${chalk.yellow.bold('Violent Reaction Zone:')} ${strategy.violentReactionZone}`,
    `• ${chalk.green.bold('Bounce Probability:')} ${strategy.bounceProbability}`,
    `• ${chalk.red.bold('⚠️ Bull Trap:')} ${strategy.trapWarning.bullTrap}`,
    `• ${chalk.red.bold('⚠️ Bear Trap:')} ${strategy.trapWarning.bearTrap}`,
    `${chalk.gray('—'.repeat(60))}`,
    `💡 ${chalk.yellow.bold('GOLDEN RULE FOR TODAY')}`,
    `  ${chalk.italic.yellow(strategy.goldenRule)}`
  ].join('\n');

  let borderColor = 'yellow';
  if (strategy.marketSentiment === 'BULLISH') borderColor = 'green';
  if (strategy.marketSentiment === 'BEARISH') borderColor = 'red';
  if (strategy.marketSentiment === 'HIGH_VOLATILITY_NO_TRADE') borderColor = 'magenta';

  const boxed = boxen(cardContent, {
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: borderColor as any,
    title: chalk.bold.white(' 🤖 NIFTY OPTIONS SYSTEMATIC PLANS '),
    titleAlignment: 'center'
  });

  console.log(boxed);
}

async function runPipeline() {
  try {
    logDebug('Connecting to Chrome remote debugging session...');
    const { zerodhaPage, sensibullPage } = await connectToChrome();
    logInfo('Connected to Chrome debugging session successfully.');

    logDebug('Interacting with Zerodha Kite chart and exporting indicators...');
    const zerodhaData = await fetchZerodhaData(zerodhaPage);
    logInfo('Successfully fetched Zerodha indicators.');

    logDebug('Interacting with Sensibull and intercepting option chain API...');
    const sensibullData = await fetchSensibullData(sensibullPage);
    logInfo('Successfully fetched Sensibull option metrics.');

    logDebug('Synthesizing data and invoking OpenAI model...');
    const strategy = await generateStrategy(zerodhaData, sensibullData);
    logInfo('Synthesized strategy analysis successfully.\n');

    printStrategyCard(strategy);

    console.log(chalk.gray(`\nNext analysis cycle in ${intervalMinutes} minutes at ${new Date(Date.now() + intervalMs).toLocaleTimeString()}...\n`));

  } catch (error: any) {
    console.log(chalk.red(`\n[Pipeline Error] Execution failed: ${error.message || error}`));
    console.log(chalk.yellow(`Retrying in ${intervalMinutes} minutes...\n`));
  }
}

async function main() {
  console.clear();
  if (isDebug) {
    console.log(chalk.yellow.bold('=============================================='));
    console.log(chalk.yellow.bold('    NIFTY Option Analysis AI Pipeline CLI      '));
    console.log(chalk.yellow.bold('==============================================\n'));
  }

  // Run the first pipeline execution immediately
  await runPipeline();

  // Run subsequent executions in interval loops
  setInterval(async () => {
    logDebug('Running scheduled options analysis cycle...');
    await runPipeline();
  }, intervalMs);
}

main().catch(err => {
  console.error(chalk.red('Fatal Main Error:'), err);
});
