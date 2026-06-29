import { genkit, z } from 'genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
import * as dotenv from 'dotenv';

dotenv.config();

// Ensure the Genkit client is configured with OpenAI plugin
export const ai = genkit({
  plugins: [openAI()],
});

// Zod schema for structured output to ensure clean JSON responses
export const OptionLegSchema = z.object({
  action: z.enum(['BUY', 'SELL']).describe('Whether to Buy or Sell the option'),
  strikePrice: z.number().describe('The strike price of the option contract'),
  optionType: z.enum(['CE', 'PE']).describe('CE (Call Option) or PE (Put Option)'),
  expiry: z.string().describe('Expiry date of the contract (e.g. "02-JUL-2026")'),
  approxPremium: z.number().optional().describe('Expected entry premium price (approximate)'),
});

export const StrategySchema = z.object({
  marketSentiment: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL', 'HIGH_VOLATILITY_NO_TRADE'])
    .describe('Synthesized market outlook for NIFTY based on technical indicators and options metrics'),
  cprAnalysis: z.string().describe('Short commentary on CPR Pivot, BC, TC relative to current close price'),
  optionsAnalysis: z.string().describe('Short commentary on PCR, OI changes, and VIX levels'),
  strategyName: z.string().describe('Recommended options strategy name (e.g., Bull Call Spread, Short Iron Condor, No Trade)'),
  legs: z.array(OptionLegSchema).describe('Option contracts to trade. Leave empty if sentiment is HIGH_VOLATILITY_NO_TRADE'),
  stopLoss: z.string().describe('Conditions or target spot price levels to trigger stop loss'),
  target: z.string().describe('Suggested target spot levels or target premium levels to exit'),
  rationale: z.array(z.string()).describe('Point-by-point data-backed logical arguments for this strategy'),
});

export type StrategyResponse = z.infer<typeof StrategySchema>;
