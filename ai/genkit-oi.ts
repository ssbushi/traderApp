import { genkit, z } from 'genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
import * as dotenv from 'dotenv';

dotenv.config();

export const ai = genkit({
  plugins: [openAI()],
});

// Zod schema for structured output of the new Open Interest-augmented strategy report
export const StrategyOISchema = z.object({
  statusUpdate: z.string().describe('Title of the update (e.g., "10:18 AM UPDATE — BREAKOUT CONFIRMED")'),
  priceComparison: z.string().describe('Price change comparison since the last interval check (e.g., "24190 → 24213")'),
  
  // Option Interest shifts
  oiComparisonTable: z.string().describe('Text table or list showing Strike, Earlier, Now, and Change for Call/Put OI on key strikes'),
  oiChangeInterpretation: z.string().describe('Text explaining what the OI changes indicate (e.g., "Put writers are defending...")'),
  
  // Technical Analysis
  chartReading: z.string().describe('Brief chart observations (candle absorption, breakouts, supply zones)'),
  adxStructure: z.string().describe('Detailed ADX/DMI metrics and trend type (e.g., "DI+ ≈ 38, DI− ≈ 15, ADX ≈ 36. Trending market.")'),
  
  // Floor and Ceiling targets
  ceilings: z.array(z.object({
    level: z.number(),
    role: z.string().describe('Immediate, Next, or Expansion Target'),
    probability: z.string().describe('Percentage touch probability (e.g. "75%")')
  })).describe('Three ceiling levels and touch probabilities'),
  
  floors: z.array(z.object({
    level: z.number(),
    role: z.string().describe('Ultra Strong, Strong Support, or Base Support'),
    probability: z.string().describe('Percentage hold probability (e.g. "80%")')
  })).describe('Three floor levels and hold probabilities'),
  
  // Expected paths
  scenarios: z.array(z.object({
    name: z.string().describe('Scenario name (e.g., "Scenario 1 (Most Likely – 55%)")'),
    path: z.string().describe('Path price projection path (e.g. "24215 → 24200 retest → Hold → 24235 → 24250")')
  })).describe('Three price movement projection paths'),
  
  // Options battlefield
  battlefieldStrikes: z.array(z.object({
    strike: z.number(),
    meaning: z.string().describe('Meaning/role of strike (e.g. "Strong Floor", "Bull Floor", "New Pivot", "Next Resistance"')
  })).describe('Battlefield strikes meanings'),
  
  // Direct bias
  tradingBias: z.string().describe('Trading bias statement (e.g., "Above 24200 = Buy-on-dips")'),
  biasCommentary: z.string().describe('30-60 mins path of least resistance and key levels details'),
  goldenRule: z.string().describe('One direct behavioral/trading rule for today based on current conditions'),
});

export type StrategyOIResponse = z.infer<typeof StrategyOISchema>;
