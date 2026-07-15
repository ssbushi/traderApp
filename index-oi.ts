import * as dotenv from 'dotenv';
import chalk from 'chalk';
import boxen from 'boxen';
import * as fs from 'fs';
import * as path from 'path';
import { connectToChromeOI } from './browser/connection';
import { fetchSensibullOIData, SensibullOIData } from './browser/sensibull-oi';
import { fetchZerodhaData, ZerodhaData } from './browser/zerodha';
import { generateOIStrategy } from './ai/prompts-oi';
import { StrategyOIResponse } from './ai/genkit-oi';
import { isDebug, logDebug, logInfo } from './utils/logger';

dotenv.config();

const intervalMinutes = parseInt(process.env.INTERVAL_MINUTES || '5', 10);
const intervalMs = intervalMinutes * 60 * 1000;
const historyFilePath = path.join(process.cwd(), 'analysis_history_oi.json');

function cleanOldHistory() {
  try {
    if (fs.existsSync(historyFilePath)) {
      const fileData = fs.readFileSync(historyFilePath, 'utf8');
      if (fileData.trim()) {
        const history = JSON.parse(fileData);
        if (history.length > 0) {
          const lastEntry = history[history.length - 1];
          const lastDate = new Date(lastEntry.timestamp).toDateString();
          const todayDate = new Date().toDateString();
          
          if (lastDate !== todayDate) {
            logDebug(`[New Day Detected] Wiping old history from ${lastDate}.`);
            fs.writeFileSync(historyFilePath, '[]', 'utf8');
          }
        }
      }
    }
  } catch (e) {}
}

interface HistoryOIEntry {
  timestamp: string;
  zerodhaMetrics: any;
  sensibullMetrics: any;
  strategy: StrategyOIResponse;
}

function getPreviousHistoryEntry(): HistoryOIEntry | undefined {
  try {
    if (fs.existsSync(historyFilePath)) {
      const fileData = fs.readFileSync(historyFilePath, 'utf8');
      if (fileData.trim()) {
        const history = JSON.parse(fileData);
        if (history.length > 0) {
          return history[history.length - 1];
        }
      }
    }
  } catch (e) {}
  return undefined;
}

function saveAnalysisToHistory(
  strategy: StrategyOIResponse,
  zerodha: ZerodhaData,
  sensibullOI: SensibullOIData
) {
  try {
    let history: any[] = [];
    if (fs.existsSync(historyFilePath)) {
      const fileData = fs.readFileSync(historyFilePath, 'utf8');
      if (fileData.trim()) {
        history = JSON.parse(fileData);
      }
    }
    
    const entry: HistoryOIEntry = {
      timestamp: new Date().toISOString(),
      zerodhaMetrics: {
        datetime: zerodha.datetime,
        open: zerodha.open,
        high: zerodha.high,
        low: zerodha.low,
        close: zerodha.close,
        cprPivot: zerodha.cprPivot,
        cprBC: zerodha.cprBC,
        cprTC: zerodha.cprTC,
        atr: zerodha.atr,
        plusDI: zerodha.plusDI,
        minusDI: zerodha.minusDI,
        adx: zerodha.adx
      },
      sensibullMetrics: {
        pcr: sensibullOI.pcr,
        currentLtp: sensibullOI.currentLtp,
        atmStrike: sensibullOI.atmStrike,
        perStrikeData: sensibullOI.perStrikeData
      },
      strategy: strategy
    };
    
    history.push(entry);
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), 'utf8');
    logDebug(`Saved OI analysis and metrics to history at ${historyFilePath}`);
  } catch (err: any) {
    logDebug(`Warning: Could not save strategy history: ${err.message}`);
  }
}

function printStrategyCard(strategy: StrategyOIResponse) {
  const cardContent = [
    `${chalk.yellow.bold(strategy.statusUpdate)}`,
    `${chalk.cyan.bold('Price Action:')} ${chalk.white(strategy.priceComparison)}`,
    `${chalk.gray('—'.repeat(60))}`,
    `${chalk.bold.underline('OI CHANGES COMPARISON')}`,
    strategy.oiComparisonTable,
    ``,
    `${chalk.bold.underline('OI INTERPRETATION')}`,
    strategy.oiChangeInterpretation,
    `${chalk.gray('—'.repeat(60))}`,
    `${chalk.bold.underline('CHART ANALYSIS & TREND')}`,
    `• ${chalk.bold('Observations:')} ${strategy.chartReading}`,
    `• ${chalk.bold('ADX/DMI Structure:')} ${strategy.adxStructure}`,
    `${chalk.gray('—'.repeat(60))}`,
    `${chalk.bold.underline('EXPECTED PATH SCENARIOS')}`,
    strategy.scenarios.map(s => `• ${chalk.yellow.bold(s.name)}:\n  ${s.path}`).join('\n\n'),
    `${chalk.gray('—'.repeat(60))}`,
    `${chalk.bold.underline('INTRADAY CEILING & FLOOR PROBABILITIES')}`,
    `🟢 ${chalk.green.bold('SUPPORT FLOORS:')}`,
    strategy.floors.map(f => `  - ${chalk.green(f.level)} (${f.role}) Hold Probability: ${chalk.green.bold(f.probability)}`).join('\n'),
    ``,
    `🔴 ${chalk.red.bold('RESISTANCE CEILINGS:')}`,
    strategy.ceilings.map(c => `  - ${chalk.red(c.level)} (${c.role}) Touch Probability: ${chalk.red.bold(c.probability)}`).join('\n'),
    `${chalk.gray('—'.repeat(60))}`,
    `${chalk.bold.underline('OPTION BATTLEFIELD')}`,
    strategy.battlefieldStrikes.map(b => `  - Strike ${chalk.yellow(b.strike)}: ${b.meaning}`).join('\n'),
    `${chalk.gray('—'.repeat(60))}`,
    `🎯 ${chalk.cyan.bold('TRADING BIAS NOW')}`,
    `  ${chalk.green.bold(strategy.tradingBias)}`,
    `  ${strategy.biasCommentary}`,
    `${chalk.gray('—'.repeat(60))}`,
    `💡 ${chalk.yellow.bold('GOLDEN RULE FOR TODAY')}`,
    `  ${chalk.italic.yellow(strategy.goldenRule)}`
  ].join('\n');

  let borderColor = 'yellow';
  const biasUpper = strategy.tradingBias.toUpperCase();
  if (biasUpper.includes('BUY') || biasUpper.includes('BULL') || biasUpper.includes('LONG') || biasUpper.includes('UPWARD')) {
    borderColor = 'green';
  } else if (biasUpper.includes('SELL') || biasUpper.includes('BEAR') || biasUpper.includes('SHORT') || biasUpper.includes('DOWNWARD')) {
    borderColor = 'red';
  }

  const boxed = boxen(cardContent, {
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: borderColor as any,
    title: chalk.bold.white(' 📊 NIFTY OPEN INTEREST AGGREGATE CO-PILOT '),
    titleAlignment: 'center'
  });

  console.log(boxed);
}

async function runPipeline() {
  try {
    logDebug('Connecting to Chrome remote debugging session (OI mode)...');
    const { zerodhaPage, sensibullOIPage } = await connectToChromeOI();
    logInfo('Connected to Chrome debugging session successfully.');

    logDebug('Interacting with Zerodha Kite chart and exporting indicators...');
    const zerodhaData = await fetchZerodhaData(zerodhaPage);
    logInfo('Successfully fetched Zerodha indicators.');

    logDebug('Interacting with Sensibull and intercepting Open Interest API...');
    const sensibullOIData = await fetchSensibullOIData(sensibullOIPage);
    logInfo('Successfully fetched Sensibull Open Interest data.');

    logDebug('Synthesizing data and invoking OpenAI model...');
    const previousEntry = getPreviousHistoryEntry();
    const strategy = await generateOIStrategy(zerodhaData, sensibullOIData, previousEntry);
    logInfo('Synthesized strategy analysis successfully.\n');

    printStrategyCard(strategy);
    saveAnalysisToHistory(strategy, zerodhaData, sensibullOIData);

    console.log(chalk.gray(`\nNext analysis cycle in ${intervalMinutes} minutes at ${new Date(Date.now() + intervalMs).toLocaleTimeString()}...\n`));

  } catch (error: any) {
    console.log(chalk.red(`\n[Pipeline Error] Execution failed: ${error.message || error}`));
    console.log(chalk.yellow(`Retrying in ${intervalMinutes} minutes...\n`));
  }
}

async function main() {
  console.clear();
  cleanOldHistory();
  if (isDebug) {
    console.log(chalk.yellow.bold('=============================================='));
    console.log(chalk.yellow.bold('   NIFTY Open Interest Analysis AI CLI       '));
    console.log(chalk.yellow.bold('==============================================\n'));
  }

  // Run the first pipeline execution immediately
  await runPipeline();

  // Run subsequent executions in interval loops
  setInterval(async () => {
    logDebug('Running scheduled options analysis cycle (OI)...');
    await runPipeline();
  }, intervalMs);
}

main().catch(err => {
  console.error(chalk.red('Fatal Main Error:'), err);
});
