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
- **Previous Update Title:** ${prevStrat.statusUpdate}
- **Previous Price Action:** ${prevStrat.priceComparison}
- **Previous Trading Bias:** ${prevStrat.tradingBias}
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
- "statusUpdate"
- "priceComparison"
- "oiComparisonTable"
- "oiChangeInterpretation"
- "chartReading"
- "adxStructure"
- "ceilings"
- "floors"
- "scenarios"
- "battlefieldStrikes"
- "tradingBias"
- "biasCommentary"
- "currentBattlefield"
- "bullishConfirmation"
- "bearishConfirmation"
- "bullTrapScenarios"
- "bearTrapScenarios"
- "realTimeBullishThresholds"
- "realTimeBearishThresholds"
- "goldenRule"

Details for the fields:
1. **statusUpdate:** Title of the update (e.g. "10:18 AM UPDATE — BREAKOUT CONFIRMED" or "2:30 PM UPDATE — RANGE BOUND DAY").
2. **priceComparison:** Shows previous close vs current close (e.g. "24190 → 24213").
3. **oiComparisonTable:** A markdown table comparing key strikes' Call/Put OI "Earlier" vs "Now" and "Change" (use the previous data and current data).
4. **oiChangeInterpretation:** High-impact bullet points detailing what the OI shifts mean (e.g. who is rolling or defending).
5. **chartReading:** Key chart signals observed (absorption zones, supply zones).
6. **adxStructure:** Trend strength using DMI/ADX values (e.g. "DI+ ≈ 38, DI− ≈ 15, ADX ≈ 36. Trending market.").
7. **ceilings:** A list of 3 ceiling targets (role: Immediate, Next, Expansion Target) and their touched probability.
8. **floors:** A list of 3 floor supports (role: Ultra Strong, Strong Support, Base Support) and their held probability.
9. **scenarios:** 3 distinct projected price paths (Scenario 1 [Most Likely], Scenario 2, Scenario 3) using down/up arrows.
10. **battlefieldStrikes:** Meaning of key strikes (e.g. 24100 -> "Strong Floor", 24200 -> "New Pivot").
11. **tradingBias:** Direct bias declaration (e.g., "Above 24200 = Buy-on-dips").
12. **biasCommentary:** Commentary about the path of least resistance and key levels.
13. **currentBattlefield:** Immediate pivot, major ceiling, and major floor strikes (e.g. ["24150 = Immediate pivot", ...]).
14. **bullishConfirmation:** Object defining bullish setup:
    - **conditions:** Expected strike OI behavior shifts (e.g. ["24150 CE: OI decrease (short covering)", "24150 PE: OI increase"]).
    - **targets:** Specific numeric strike target changes based on current values (e.g. if current Call OI is 52L and you want decrease, write "24150 CE: 52L -> below 50L"). Express values in Lakhs (L) or Crores (Cr).
    - **projectedTarget:** Projected targets (e.g., "24195 → 24210 → 24235").
    - **probability:** Target path probability (e.g. "75%").
15. **bearishConfirmation:** Object defining bearish setup:
    - **conditions:** Expected strike OI behavior shifts.
    - **targets:** Specific numeric strike target changes based on current values (e.g., "24150 PE: 55L -> below 53L").
    - **projectedTarget:** Projected targets (e.g., "24130 → 24110 → 24090").
    - **probability:** Target path probability (e.g. "75-80%").
16. **bullTrapScenarios:** Avoid long trade warning signals combining price and strike changes (e.g., "Price rises to 24180-24190 but 24150 CE and 24200 CE are rising while 24150 PE stalls. Expect dump to 24160 -> 24140").
17. **bearTrapScenarios:** Avoid short trade warning signals combining price and strike changes (e.g., "Price breaks 24145 but 24150 PE is rising and 24100 PE is stable. Expect squeeze to 24175 -> 24200").
18. **realTimeBullishThresholds:** A list of direct threshold rules for bulls gaining control (e.g., ["24150 PE > 57L", "24150 CE < 50L", "Price > 24180"]).
19. **realTimeBearishThresholds:** A list of direct threshold rules for bears gaining control (e.g., ["24150 PE < 53L", "24150 CE > 54L", "Price < 24148"]).
20. **goldenRule:** Formulate one direct behavioral rule for today (e.g., "Avoid buying breakouts when ADX is below 20"). Do not leave this field out.
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
