import { genkit, z } from 'genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
import * as dotenv from 'dotenv';

dotenv.config();

// Ensure the Genkit client is configured with OpenAI plugin
export const ai = genkit({
  plugins: [openAI()],
});

// Zod schema for structured output to ensure clean JSON responses
export const StrategySchema = z.object({
  marketSentiment: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL', 'HIGH_VOLATILITY_NO_TRADE'])
    .describe('Synthesized market outlook for NIFTY based on technical indicators and options metrics'),
  strategyName: z.string().describe('Recommended options strategy name (e.g., Bull Call Spread, Short Iron Condor, No Trade)'),
  support: z.number().describe('Main immediate support level'),
  resistance: z.number().describe('Main immediate resistance level'),
  currentPriceStatus: z.string().describe('Short status of current price relative to range (e.g. "23934 (Middle of range - Wait)")'),
  
  // Trade 1 (Long Setup)
  longTrigger: z.string().describe('Short condition to trigger a Long trade (e.g. "Bounce from 23900 with confirmation")'),
  longEntry: z.string().describe('Long entry level (e.g. "> confirmation candle high")'),
  longStopLoss: z.string().describe('Long stop loss level (e.g. "< swing low")'),
  longTargets: z.array(z.number()).describe('List of 3 targets for long trade'),
  
  // Trade 2 (Short on Breakdown)
  breakdownTrigger: z.string().describe('Short condition to trigger a Breakdown Short trade (e.g. "Close below 23900 + failed retest")'),
  breakdownEntry: z.string().describe('Breakdown entry level'),
  breakdownStopLoss: z.string().describe('Breakdown stop loss level'),
  breakdownTargets: z.array(z.number()).describe('List of 3 targets for breakdown short'),
  
  // Trade 3 (Short at Resistance)
  resistanceTrigger: z.string().describe('Short condition to trigger a Resistance Short trade (e.g. "Bearish rejection at 23945-23955")'),
  resistanceEntry: z.string().describe('Resistance short entry level'),
  resistanceStopLoss: z.string().describe('Resistance short stop loss level'),
  resistanceTargets: z.array(z.number()).describe('List of 3 targets for resistance short'),
  
  institutionalOI: z.array(z.string()).describe('List of 3-4 bullet points summarizing what institutions are doing on key strikes (e.g., "24000: Heavy fresh call writing -> strong ceiling")'),
  goldenRule: z.string().describe('One direct trading advice rule for today based on current conditions'),
  gammaSqueeze: z.string().describe('Price level/zone where short covering/squeeze is likely to trigger (e.g. "Above 24000")'),
  maxCeiling: z.number().describe('Ultimate resistance level (highest Call OI strike)'),
  maxFloor: z.number().describe('Ultimate support level (highest Put OI strike)'),
  violentReactionZone: z.string().describe('Level/zone where price is expected to react violently (e.g. "23900 or 23980")'),
  trapWarning: z.object({
    bullTrap: z.string().describe('Bull trap scenario (e.g., "Price trades above 24000 briefly, then closes back below with fading volume - traps breakout buyers")'),
    bearTrap: z.string().describe('Bear trap scenario (e.g., "Price dips below 23940, then quickly reclaims within 1-2 candles - traps fresh shorts")'),
  }).describe('Structured trap warnings for retail traders'),
  bounceProbability: z.string().describe('Estimated probability of a bounce and key level (e.g. "70% at 23900")'),
});

export type StrategyResponse = z.infer<typeof StrategySchema>;
