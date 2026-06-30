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

### OUTPUT FORMAT INSTRUCTIONS
Generate a JSON object matching the StrategySchema. In the 'markdownReport' field, write a comprehensive, direct, and suggestive options trading plan formatted EXACTLY like the markdown template below.

Use the actual NIFTY spot price, technical levels (cpr Pivot, BC, TC, high, low), and options metrics (PCR, Max Pain, VIX, Open Interest) to calculate specific values.

Format the 'markdownReport' EXACTLY like this template:
"""
Based on your **[CURRENT TIME OF THE SNAPSHOT, e.g. 11:47 AM]** chart, OI, Greeks, and intraday structure, this is how I would trade it systematically instead of predicting direction.

## Market Structure

* **[RESISTANCE ZONE 1, e.g. 23995–24000]:** [Describe the wall / institutional call writing based on heavy Call OI].
* **[RESISTANCE/SUPPLY ZONE 2, e.g. 23945–23955]:** [Describe intraday supply/resistance, rejection points from chart].
* **[SUPPORT/DEMAND ZONE 1, e.g. 23900]:** [Describe support/gamma battle zone based on heavy Put OI].
* **[SUPPORT ZONE 2, e.g. 23850]:** [Describe major put-defense zone].

Price is currently around **[CURRENT CLOSE PRICE]**, which is **[state location relative to support/resistance, e.g. between support and resistance, near support, near resistance, etc.]**. This is the [describe risk/reward bias, e.g. lowest edge for taking new trades because risk/reward is poor, or high-probability zone for shorts, etc.].

---

# Trade 1: Buy only if support proves itself

Do **not** buy just because price reaches [Support level].
Wait for all of these:
✅ Price tests **[Support level] ±10 points**.
✅ A bullish 5-minute candle closes (hammer, bullish engulfing, or strong rejection).
✅ The next candle trades above that bullish candle.

Then:
* Entry: above the confirmation candle.
* Stop-loss: below the swing low (about 15–20 points).
* Targets:
  * [Target 1]
  * [Target 2]
  * [Target 3]

If buyers cannot defend [Support level], skip the long.

---

# Trade 2: Sell only after confirmation

Do **not** short at [Current price]. You are selling into support.
Instead wait for:
* A 5-minute candle closes below **[Support level]**.
* Price retests [Support level].
* The retest fails.

Then:
* Entry: below the retest low.
* Stop-loss: above [Stop loss level].
* Targets:
  * [Target 1]
  * [Target 2]
  * [Target 3]

This gives a much better probability because support has already failed.

---

# Trade 3: Sell from resistance

If price bounces first:
[Resistance level range]
Watch for:
* Long upper wick
* Bearish engulfing
* Failure to close above [Resistance level]

Then:
Entry on the breakdown of that bearish candle.
Targets:
[Target 1]
↓
[Target 2]
↓
[Target 3]

This is the higher-probability short because you're selling into resistance rather than into support.

---

## What institutions are doing

From your OI and Greeks data:
* **[STRIKE 1, e.g. 24000]:** Heavy fresh call writing → strong ceiling.
* **[STRIKE 2, e.g. 23950]:** Fresh call writing → immediate resistance.
* **[STRIKE 3, e.g. 23900]:** Large put addition → active defense.
* **[STRIKE 4, e.g. 23850]:** Very strong put base.

That suggests the market is trying to stay within the **[RANGE, e.g., 23900–24000]** range unless one side clearly wins.

---

## Decision matrix

| Price location                 | Action                                               |
| ------------------------------ | ---------------------------------------------------- |
| [Resistance Zone e.g. 23945–23955] | Look for a short if rejection appears                |
| [Middle Zone e.g. 23920–23935]     | Wait, avoid chasing trades                           |
| [Support Zone e.g. 23900]          | Look for a confirmed long only if buyers defend      |
| Below [Support Zone] close     | Wait for retest, then consider a short               |
| Above [Resistance Zone] with strong volume | Avoid shorts; reassess for a move toward [Target Zone] |

## One rule that can improve your consistency

Never trade **in the middle of the range**.

Today the range is approximately:
* **Support:** [Support Level]
* **Resistance:** [Resistance Level Range]

At **[Current close price range]**, you are in the middle. Professional traders generally wait for price to reach an edge of the range and then trade the reaction or the confirmed breakout, rather than initiating positions in the middle where both buyers and sellers are active.
"""
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
