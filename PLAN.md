# Automating Option Analysis App

## Preamble: Executive Summary

### Problem Statement
Traders manually synthesize technical chart indicators and options chain data to formulate strategies. Our goal is to automate this synthesis step. We are building an automated pipeline that supplies an AI agent with the precise metrics required to make an informed NIFTY options trade. The AI will continuously process and evaluate:
- **Technical Indicators (Zerodha):** Open, High, Low, Close, CPR (Pivot, BC, TC), ATR, Directional Indicators (+DI, -DI), and ADX.
- **Options Metrics (Sensibull):** Price, Call/Put Open Interest (OI) & OI Change, Put-Call Ratio (PCR), Max Pain, Future OI & Change, Implied Volatility (IV) & Percentile, Expiry, and Weight %.

### Proposed Solution
We propose an automated "AI Co-Pilot" that operates effortlessly alongside your existing trading routine. Instead of asking you to learn new, complicated software, the tool simply connects to the Sensibull and Zerodha browser tabs you already have open. Every five minutes, it acts as an invisible assistant—seamlessly gathering all the necessary chart data and options metrics. It then feeds this comprehensive snapshot into a localized AI system (powered by Google Gemini), which instantly analyzes the combined data and delivers a clear, synthesized options trading strategy. This guarantees that you get real-time, data-backed insights without ever taking your eyes off the market.

## Goal
To build a foreground script that runs continuously and, every 5 minutes, fetches data from Sensibull and Zerodha, formats it, and invokes Gemini via Genkit to generate an options trading strategy based on a combined prompt.

## Technology Stack
- **Language**: Node.js / TypeScript
- **Browser Automation**: `playwright` (to connect to an existing browser instance)
- **AI Integration**: `@google/genkit` with the Gemini model.
- **Dependencies**: `csv-parser` (if downloading CSVs), `dotenv` (for API keys).

---

## Proposed Architecture: "Shared Browser Approach"

We will utilize Playwright's standard capability to connect to a running instance of Google Chrome over the **Remote Debugging Port (CDP)**.

### Metrics to Fetch
To ensure the AI prompt has all necessary context, we expect the following explicit metrics:

**From Zerodha:**
- Datetime, Open, High, Low, Close
- CPR Pivot, CPR BC, CPR TC
- ATR, +DI, -DI, ADX

**From Sensibull:**
- EOD DATA, time, PRICE
- CALL OI, PUT OI, CALL OI CHANGE, PUT OI CHANGE
- PCR, MAX PAIN, FUTURE OI, FUTURE OI CHANGE
- OPTION IV, INDIA VIX, IV PERCENTILE, EXPIRY USED, WEIGHT %

### The Workflow:
1. **User Preparation**: You will start your local instance of Google Chrome with a special flag: `chrome --remote-debugging-port=9222`. *(Works on Windows via `chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\ChromeDevSession"`)*
2. **Manual Setup**: You use this browser window to log into Zerodha and Sensibull, open the correct tabs, and configure them as needed.
3. **App Execution**: You run the Node script.
4. **Connection**: The script attaches to the running Chrome instance (meaning you can still interact with it).
5. **Data Collection Loop (Every 5 mins `setInterval`)**:
   - The script will locate the **Sensibull tab** and trigger a passive/active reload to intercept the `compute_intraday` network response.
   - The script will locate the **Zerodha tab**, click the "Download" button on the chart, intercept the downloaded CSV directly in memory, and parse the data. 
6. **AI Processing**: Both data payloads are merged and structured cleanly. Genkit invokes Gemini.
7. **Output**: The trading strategy logic and results are printed to the console (or saved to a file).

> [!NOTE]
> Since we run in the foreground, this process keeps going until you manually interrupt the script (Ctrl+C). If a session restarts or you get logged out, you just log back into the browser tab and the script will continue gracefully.

---

## Finalized Approach Details

### 1. Remote Debugging & Site Restrictions
- **Windows Support**: Supported.
- **Site Restrictions**: While some advanced anti-bot protections can detect CDP, our approach is very low-impact. The user handles logins/captchas manually, and our script does a single click every 5 minutes—highly unlikely to trigger automated bans.

### 2. Zerodha Data Gathering: UI Scraping
We are moving forward with **Option A**. The script will find the Zerodha tab, click the "Download" button on the chart, intercept the file download stream to avoid cluttering your PC, and parse the indicator values directly.

### 3. Identifying Sensibull Data
The script will start by listening passively for the `compute_intraday` network response. If Sensibull doesn't emit it automatically within a short window, the script will gracefully trigger a page reload on the Sensibull tab to force the network call, extracting the data cleanly.

---

## Graceful Checks (Non-Technical User Experience)
Since the user is a non-technical stock trader, the script will be hardened to provide clear, actionable, and friendly error messages:
1. **Browser Connection Check**: If Chrome isn't running with the remote-debugging port, the script will stop and print exact instructions on how to start it.
2. **Tab Location Check**: If the script cannot find a tab with "Zerodha" or "Sensibull" in its title, it will tell the user: *"Please open Sensibull and Zerodha in your browser before running this tool."*
3. **Data/Column Validation Check**: When downloading the Zerodha data, the script will check if required columns like CPR, ADX, ATR exist. If not, it will warn the user: *"We couldn't find the 'CPR' column in your Zerodha Chart setup. Please ensure the chart has CPR enabled."*

---

## Proposed File Structure

```text
/
├── package.json
├── index.ts              # Main entry point and scheduler loop
├── browser/
│   ├── connection.ts     # Logic for connecting to Chrome CDP
│   ├── sensibull.ts      # Logic to extract data from the Sensibull tab
│   └── zerodha.ts        # Logic to extract data from the Zerodha tab
└── ai/
    ├── genkit.ts         # Genkit configuration and Gemini invocation
    └── prompts.ts        # Prompt template combining both data sources
```
