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
  
  // Real-time Strike confirmation targets (from sample_windings.out)
  currentBattlefield: z.array(z.string()).describe('Immediate pivot, major ceiling, and major floor strikes (e.g. ["24150 = Immediate pivot", ...])'),
  bullishConfirmation: z.object({
    conditions: z.array(z.string()).describe('Strike specific OI behaviors wanted (e.g. ["24150 CE: OI decrease", ...])'),
    targets: z.array(z.string()).describe('OI change threshold targets (e.g. ["24150 CE: 52L -> below 50L", "Price: Holds above 24180"])'),
    projectedTarget: z.string().describe('Projected target path (e.g. "24195 → 24210 → 24235")'),
    probability: z.string().describe('Target path probability (e.g., "75%")'),
  }).describe('Strike confirmation metrics for real bullish strength'),
  
  bearishConfirmation: z.object({
    conditions: z.array(z.string()).describe('Strike specific OI behaviors wanted'),
    targets: z.array(z.string()).describe('OI change threshold targets (e.g. ["24150 PE: 55L -> below 53L"])'),
    projectedTarget: z.string().describe('Projected target path (e.g. "24130 → 24110 → 24090")'),
    probability: z.string().describe('Target path probability (e.g. "75-80%")'),
  }).describe('Strike confirmation metrics for real bearish weakness'),
  
  bullTrapScenarios: z.string().describe('OI and price triggers representing a bull trap'),
  bearTrapScenarios: z.string().describe('OI and price triggers representing a bear trap'),
  
  realTimeBullishThresholds: z.array(z.string()).describe('Real-time strike boundaries to confirm bulls gaining control (e.g., ["24150 PE > 57L", "24150 CE < 50L"])'),
  realTimeBearishThresholds: z.array(z.string()).describe('Real-time strike boundaries to confirm bears gaining control (e.g., ["24150 PE < 53L", "24150 CE > 54L"])'),
  
  goldenRule: z.string().describe('One direct behavioral/trading rule for today based on current conditions'),
});

export type StrategyOIResponse = z.infer<typeof StrategyOISchema>;
