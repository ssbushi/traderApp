import { openAI } from '@genkit-ai/compat-oai/openai';
import { ai, StrategyOISchema, StrategyOIResponse } from './genkit-oi';
import { ZerodhaData } from '../browser/zerodha';
import { SensibullOIData } from '../browser/sensibull-oi';
import chalk from 'chalk';
import { logDebug } from '../utils/logger';

export async function generateOIStrategy(
  zerodha: ZerodhaData,
  sensibullOI: SensibullOIData,
  previousEntry?: {
    zerodhaMetrics: any;
    sensibullMetrics: any;
    strategy: StrategyOIResponse;
  }
): Promise<StrategyOIResponse> {
  logDebug(chalk.blue('Sending aggregated technicals and Open Interest strike data to OpenAI...'));

  // Format per strike data into text representation
  const strikesText = Object.keys(sensibullOI.perStrikeData)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(strike => {
      const d = sensibullOI.perStrikeData[strike];
      const callChg = d.callOi - d.prevCallOi;
      const putChg = d.putOi - d.prevPutOi;
      return `Strike ${strike} -> Call OI: ${d.callOi} (Chg: ${callChg >= 0 ? '+' : ''}${callChg}), Put OI: ${d.putOi} (Chg: ${putChg >= 0 ? '+' : ''}${putChg})`;
    })
    .join('\n');

  let previousContext = '';
  if (previousEntry) {
    const prevStrat = previousEntry.strategy;
    previousContext = `
#### 3. Previous Strategy Analysis (From 5 Minutes Ago)
- **Previous Outlook:** ${prevStrat.marketSentiment}
- **Previous Strategy Name:** ${prevStrat.strategyName}
- **Previous Range:** Support: ${prevStrat.support} | Resistance: ${prevStrat.resistance}
- **Previous Recommendation:** ${prevStrat.tradeRecommendation}
- **Previous Golden Rule:** ${prevStrat.goldenRule}
`;
  }

  const promptText = `
You are an expert options trading quantitative strategist specialized in NIFTY options trading.
Your goal is to synthesize the provided technical chart indicators (Zerodha) and Open Interest (OI) per-strike metrics (Sensibull) to construct a high-probability, systematic options trading plan.

---

### INPUT DATA

#### 1. Technical Indicators (Zerodha - Spot Chart)
- **DateTime of snapshot:** ${zerodha.datetime}
- **OHLC Close Price:** ${zerodha.close} (Open: ${zerodha.open}, High: ${zerodha.high}, Low: ${zerodha.low})
- **CPR (Central Pivot Range):**
  - TC (Top Central): ${zerodha.cprTC ?? 'N/A'}
  - Pivot: ${zerodha.cprPivot ?? 'N/A'}
  - BC (Bottom Central): ${zerodha.cprBC ?? 'N/A'}
- **ATR (Average True Range):** ${zerodha.atr ?? 'N/A'}
- **Directional Movement Index (DMI / ADX):**
  - ADX (Trend Strength): ${zerodha.adx ?? 'N/A'}
  - +DI (Bullish pressure): ${zerodha.plusDI ?? 'N/A'}
  - -DI (Bearish pressure): ${zerodha.minusDI ?? 'N/A'}

#### 2. Open Interest per Strike (Sensibull - Latest snapshot)
- **Underlying Spot Price (LTP):** ${sensibullOI.currentLtp ?? 'N/A'}
- **ATM Strike:** ${sensibullOI.atmStrike ?? 'N/A'}
- **Overall Put-Call Ratio (PCR):** ${sensibullOI.pcr ?? 'N/A'}
- **Per Strike OI & Intraday Change (Latest 5 mins interval):**
${strikesText}
${previousContext}

---

### STRATEGY BUILDING GUIDELINES
- Incorporate the strike-specific Call and Put OI walls (large absolute OI values) and shifts (large positive/negative change values) to identify where support/resistance is strengthening or breaking.
- Wide CPR and low ADX (<20) indicate range-bound day; target short strangle/straddle or range bounds. Narrow CPR and high ADX (>25) suggest momentum/breakouts.
- Keep output strategy recommendation and highlights concise, direct, and actionable.

---

### OUTPUT INSTRUCTIONS
Generate a JSON object matching the StrategyOISchema. Be extremely concise, direct, and actionable. Avoid conversational filler or general analysis paragraphs.

You MUST return all required fields. Ensure your output JSON contains the following exact keys:
- "marketSentiment"
- "strategyName"
- "support"
- "resistance"
- "currentPriceStatus"
- "tradeRecommendation"
- "oiHighlights"
- "goldenRule"

Details for the fields:
1. **marketSentiment:** Define the overall trend (BULLISH, BEARISH, NEUTRAL, or HIGH_VOLATILITY_NO_TRADE).
2. **strategyName:** Recommend a strategy name (e.g. Bull Call Spread, Bear Put Spread, Short Strangle, No Trade).
3. **support & resistance:** Main immediate boundary levels (numeric values only) from the CPR or heavy OI strikes.
4. **currentPriceStatus:** Status of current price relative to boundaries (e.g., "24187 (Middle of range - Wait)").
5. **tradeRecommendation:** A step-by-step option setup with specific entry rules, stop-losses, and target guidelines.
6. **oiHighlights:** A list of 3-4 bullet points highlighting strike OI additions or coverage actions.
7. **goldenRule:** Formulate one direct behavioral/trading rule based on today's technical and options structure (e.g., "Avoid buying calls when call writers are aggressively defending the 24200 strike"). Do not leave this field out.
`;

  const response = await ai.generate({
    model: openAI.model('gpt-4o-mini'),
    prompt: promptText,
    output: {
      schema: StrategyOISchema,
    },
  });

  if (!response.output) {
    throw new Error('OpenAI failed to generate a structured strategy output for the OI script.');
  }

  return response.output;
}
