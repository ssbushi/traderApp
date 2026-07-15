import { genkit, z } from 'genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
import * as dotenv from 'dotenv';

dotenv.config();

export const ai = genkit({
  plugins: [openAI()],
});

// Zod schema for structured output of the new Open Interest-augmented strategy report
export const StrategyOISchema = z.object({
  marketSentiment: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL', 'HIGH_VOLATILITY_NO_TRADE'])
    .describe('Synthesized market outlook for NIFTY based on technical indicators and per-strike OI distribution'),
  strategyName: z.string().describe('Recommended options strategy name (e.g., Bull Call Spread, Short Iron Condor, No Trade)'),
  support: z.number().describe('Main immediate support level'),
  resistance: z.number().describe('Main immediate resistance level'),
  currentPriceStatus: z.string().describe('Short status of current price relative to range (e.g. "23934 (Middle of range - Wait)")'),
  
  // Custom trade setup fields
  tradeRecommendation: z.string().describe('Detailed step-by-step option trade entry, SL and target setup incorporating strike-specific OI walls'),
  oiHighlights: z.array(z.string()).describe('Highlights from the per-strike OI changes (e.g., "24200: heavy put additions, support strengthening")'),
  goldenRule: z.string().describe('One direct trading advice rule for today based on current conditions'),
});

export type StrategyOIResponse = z.infer<typeof StrategyOISchema>;
