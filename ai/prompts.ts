import { openAI } from '@genkit-ai/compat-oai/openai';
import { ai, StrategySchema, StrategyResponse } from './genkit';
import { ZerodhaData } from '../browser/zerodha';
import { SensibullData } from '../browser/sensibull';
import * as chalk from 'chalk';

export async function generateStrategy(
  zerodha: ZerodhaData,
  sensibull: SensibullData
): Promise<StrategyResponse> {
  console.log(chalk.blue('Sending aggregated metrics and option chain data to OpenAI...'));

  const promptText = `
You are an expert options trading quantitative strategist specialized in NIFTY options trading.
Your goal is to synthesize the provided technical chart indicators (Zerodha) and options market metrics (Sensibull) to construct a high-probability option trading strategy.

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
- **Raw Options JSON Payload Snapshot:**
${JSON.stringify(sensibull.rawJson, null, 2).substring(0, 8000)} ... [Truncated for length]

---

### STRATEGY BUILDING GUIDELINES

1. **CPR Analysis:**
   - **Trend Direction:** If the close price is above TC, bias is Bullish. If below BC, bias is Bearish. Inside CPR implies rangebound.
   - **Trend Type:** A narrow CPR (TC and BC very close) indicates a high probability of a breakout/trending day. A wide CPR indicates a rangebound/sideways day.
2. **ADX & DI Analysis:**
   - ADX > 25 indicates a strong trend is underway. ADX < 20 indicates a weak, choppy market.
   - If +DI > -DI, bulls are in control. If -DI > +DI, bears are in control.
3. **PCR Analysis:**
   - PCR > 1.2 indicates a bullish sentiment (strong support, high put writing).
   - PCR < 0.7 indicates bearish sentiment (resistance, high call writing).
   - PCR between 0.8 and 1.1 is neutral/rangebound.
4. **VIX & IV Percentile (IVP) Analysis (CRITICAL for Option Selection):**
   - **High IVP (> 70%):** Options are expensive. Prefer **Net Seller** strategies (e.g. Iron Condor, Short Iron Butterfly, Bull Put Spread / Bear Call Spread via selling, or Short Straddle/Strangle if VIX is high but stable) to profit from volatility contraction and theta decay.
   - **Low IVP (< 30%):** Options are cheap. Avoid selling naked options. Prefer **Net Buyer** strategies (e.g. Bull Call Spread, Bear Put Spread, Long Call/Put) or debit spreads to limit risk and benefit from potential volatility expansion.
5. **Max Pain alignment:**
   - At expiry or close to expiry, the index price tends to drift towards the Max Pain level. Keep this in mind when selecting strike prices.

Generate a highly specific strategy containing market sentiment, a CPR analysis summary, an options analysis summary, a named strategy, a list of legs, a specific target, and stop loss conditions.
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
