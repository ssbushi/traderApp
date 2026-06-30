import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { connectToChrome } from './browser/connection';
import { fetchSensibullData } from './browser/sensibull';
import { fetchZerodhaData } from './browser/zerodha';
import { generateStrategy } from './ai/prompts';
import { StrategyResponse } from './ai/genkit';
import { isDebug, logDebug, logInfo } from './utils/logger';

dotenv.config();

const intervalMinutes = parseInt(process.env.INTERVAL_MINUTES || '5', 10);
const intervalMs = intervalMinutes * 60 * 1000;

function renderMarkdownInTerminal(markdown: string) {
  const lines = markdown.split('\n');
  for (const line of lines) {
    let formatted = line;

    // Headings
    if (formatted.startsWith('# ')) {
      console.log('\n' + chalk.bold.yellow(formatted.substring(2).toUpperCase()) + '\n');
      continue;
    }
    if (formatted.startsWith('## ')) {
      console.log('\n' + chalk.bold.cyan(formatted.substring(3)) + '\n');
      continue;
    }
    if (formatted.startsWith('### ')) {
      console.log('\n' + chalk.bold.underline.blue(formatted.substring(4)) + '\n');
      continue;
    }

    // Horizontal rules
    if (formatted.trim() === '---') {
      console.log(chalk.gray('—'.repeat(60)));
      continue;
    }

    // Colorize inline content
    // Replace **bold** with chalk bold colors
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, (_, p1) => {
      const lower = p1.toLowerCase();
      if (lower.includes('buy') || lower.includes('long') || lower.includes('support') || lower.includes('bullish') || lower.includes('✅')) {
        return chalk.green.bold(p1);
      }
      if (lower.includes('sell') || lower.includes('short') || lower.includes('resistance') || lower.includes('bearish') || lower.includes('stop-loss') || lower.includes('stop loss')) {
        return chalk.red.bold(p1);
      }
      return chalk.yellow.bold(p1);
    });

    // Replace ✅ with green ✅
    formatted = formatted.replace(/✅/g, chalk.green('✅'));

    // Highlight key trading terms in non-bold text
    formatted = formatted.replace(/\b(BUY|LONG|BULLISH|SUPPORT)\b/g, chalk.green('$1'));
    formatted = formatted.replace(/\b(SELL|SHORT|BEARISH|RESISTANCE|STOP-LOSS|STOP LOSS)\b/g, chalk.red('$1'));

    // Tables
    if (formatted.trim().startsWith('|')) {
      if (formatted.includes('---')) {
        console.log(chalk.gray(formatted));
      } else {
        // Color table rows
        console.log(chalk.blue(formatted));
      }
      continue;
    }

    // Bullet points
    if (formatted.trim().startsWith('*') || formatted.trim().startsWith('-')) {
      console.log('  ' + chalk.white(formatted.trim().substring(1).trim()));
    } else {
      console.log(formatted);
    }
  }
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

    console.log(chalk.gray('='.repeat(60)));
    renderMarkdownInTerminal(strategy.markdownReport);
    console.log(chalk.gray('='.repeat(60)));

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
