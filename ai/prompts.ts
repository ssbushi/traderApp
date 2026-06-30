import { openAI } from '@genkit-ai/compat-oai/openai';
import { ai, StrategySchema, StrategyResponse } from './genkit';
import { ZerodhaData } from '../browser/zerodha';
import { SensibullData } from '../browser/sensibull';
import chalk from 'chalk';
import { logDebug } from '../utils/logger';

export async function generateStrategy(
  zerodha: ZerodhaData,
  sensibull: SensibullData
): Promise<StrategyResponse> {
  logDebug(chalk.blue('Sending aggregated metrics and option chain data to OpenAI...'));

  const promptText = `
You are an expert options trading quantitative strategist specialized in NIFTY options trading.
Your goal is to synthesize the provided technical chart indicators (Zerodha) and options market metrics (Sensibull) to construct a high-probability, systematic options trading plan.

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

#### 2. Option Chain & Market Metrics (Sensibull)
- **Underlying Spot Price:** ${sensibull.price ?? 'N/A'}
- **Put-Call Ratio (PCR):** ${sensibull.pcr ?? 'N/A'}
- **Max Pain Level:** ${sensibull.maxPain ?? 'N/A'}
- **India VIX:** ${sensibull.indiaVix ?? 'N/A'}
- **IV Percentile (IVP):** ${sensibull.ivPercentile ?? 'N/A'}
- **Selected Expiry:** ${sensibull.expiryUsed ?? 'N/A'}
- **Call OI:** ${sensibull.callOi ?? 'N/A'} (Change: ${sensibull.callOiChange ?? 'N/A'})
- **Put OI:** ${sensibull.putOi ?? 'N/A'} (Change: ${sensibull.putOiChange ?? 'N/A'})
- **Future OI:** ${sensibull.futureOi ?? 'N/A'} (Change: ${sensibull.futureOiChange ?? 'N/A'})

---

### STRATEGY BUILDING GUIDELINES

1. **CPR Analysis:**
   - **Trend Direction:** Close price > TC implies Bullish. Close price < BC implies Bearish. Inside CPR implies rangebound.
   - **Trend Type:** Narrow CPR implies high trending/breakout probability. Wide CPR indicates rangebound/sideways day.
2. **ADX & DI Analysis:**
   - ADX > 25 indicates strong trend. ADX < 20 indicates choppy/sideways market.
   - +DI > -DI = bulls in control; -DI > +DI = bears in control.
3. **PCR Analysis:**
   - PCR > 1.2 is bullish. PCR < 0.7 is bearish. 0.8-1.1 is neutral/rangebound.
4. **VIX & IV Percentile (IVP):**
   - High IVP (> 70%) favors Net Seller strategies (Short Straddle, Credit Spreads, Iron Condors).
   - Low IVP (< 30%) favors Net Buyer strategies (Long Spreads, Debit Spreads).

---

### OUTPUT INSTRUCTIONS
Generate a JSON object matching the StrategySchema. Be extremely concise, direct, and actionable. Avoid conversational filler or general analysis paragraphs. 

Compute specific strike prices, boundaries, target numbers, and stop-loss levels based on the inputs:
1. **support & resistance:** Find immediate levels using CPR Pivot, BC, TC, or heavy open interest strikes.
2. **currentPriceStatus:** Compare close price to support/resistance (e.g. "Near support", "Middle of range - WAIT", "Breaking resistance").
3. **longTrigger, longEntry, longStopLoss, longTargets:** Construct a strict bounce/support confirmation trade.
4. **breakdownTrigger, breakdownEntry, breakdownStopLoss, breakdownTargets:** Construct a breakdown short trade if support level fails.
5. **resistanceTrigger, resistanceEntry, resistanceStopLoss, resistanceTargets:** Construct a resistance rejection short trade.
6. **institutionalOI:** Generate 3-4 direct strikes highlights (e.g., "[Strike]: [OI behavior] -> [Resistance/Support strength]").
7. **goldenRule:** Formulate one strict behavioral rule for today (e.g. "Never trade in the middle of the range when CPR is wide").
8. **maxCeiling & maxFloor:** Identify the highest open interest Call strike (Ceiling) and Put strike (Floor) from the options metrics.
9. **gammaSqueeze:** Pinpoint the price level where short covering is likely to trigger a rapid rally or drop (usually above/below the heavy writing strikes).
10. **violentReactionZone:** Specify a key level (e.g. Pivot, heavy OI zone) where the order book is dense and price is expected to react sharply.
11. **trapWarning:** Formulate a warning indicating where retail buyers or sellers are likely to get trapped on false breakouts or pullbacks.
12. **bounceProbability:** Estimate the mathematical probability of support/resistance holding (e.g., "70% at 23900") based on PCR and DI indicators.
`;

  const response = await ai.generate({
    model: openAI.model('gpt-4o-mini'),
    prompt: promptText,
    output: {
      schema: StrategySchema,
    },
  });

  if (!response.output) {
    throw new Error('OpenAI failed to generate a structured strategy output.');
  }

  return response.output;
}
