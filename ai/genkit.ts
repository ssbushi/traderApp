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
  markdownReport: z.string().describe('Full markdown report formatted EXACTLY like the sample-out.txt template, customized with current NIFTY indicators, trade setups, decision matrix, and consistency rules.'),
});

export type StrategyResponse = z.infer<typeof StrategySchema>;
