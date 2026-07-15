# NIFTY Options Analysis AI Co-Pilot

An automated command-line assistant designed to help NIFTY options traders make informed decisions. It connects to your active **Zerodha Kite** and **Sensibull** browser tabs, extracts live technical chart indicators and options metrics, and passes them to **OpenAI GPT-4o-Mini (via Genkit)** to synthesize a short, systematic, and highly actionable trading dashboard card.

---

## 🚀 How It Works

1. **Shared Browser (CDP):** The script attaches to a running session of Google Chrome via the Chrome DevTools Protocol (CDP) on port `9222`. This bypasses complex 2FA logins and CAPTCHAs, running the script safely alongside your active trading routine.
2. **Sensibull Scraping:** The script intercepts the intraday option chain responses (`/compute_intraday`) to gather spot price, Put-Call Ratio (PCR), Open Interest (OI) changes, Max Pain, and Implied Volatility (IV).
3. **Zerodha Chart Scraping:** The script reloads the chart window to fetch the latest tick candle, toggles the Table View panel inside the chart iframe, downloads the indicators in memory, and reads CPR (Pivot, BC, TC), ATR, and ADX/DMI (+DI, -DI).
4. **AI Generation:** The script merges these datasets and feeds them to OpenAI, generating a highly structured options strategy specifying support/resistance levels, exact trade setups (triggers, entries, stop-losses, and targets) for three trade plans, institutional strike positioning, and daily golden rules.
5. **Continuous Loop:** By default, it updates and prints a fresh double-bordered dashboard strategy card in your terminal every 5 minutes.

---

## 🛠️ Prerequisites

*   **Node.js** (v18 or higher)
*   **Google Chrome**
*   **OpenAI API Key** (Get one from [OpenAI Platform](https://platform.openai.com/))

---

## 📦 Installation & Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/ssbushi/traderApp.git
   cd traderApp
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   CDP_HOST=127.0.0.1
   CDP_PORT=9222
   INTERVAL_MINUTES=5
   ```

---

## 🖥️ Usage Guide

### Step 1: Launch Google Chrome in Remote Debugging Mode

Before launching, close all existing Chrome windows completely.

*   **macOS:**
    Open Terminal and run:
    ```bash
    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="/Users/ssbushi/ChromeDevSession"
    ```
*   **Windows (Command Prompt / CMD):**
    ```cmd
    "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\ChromeDevSession"
    ```
*   **Windows (PowerShell):**
    ```powershell
    & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\ChromeDevSession"
    ```

### Step 2: Prepare Your Tabs

In the debugging browser window that opened:
1. Log into **Zerodha Kite** and open the NIFTY spot chart. Make sure **ChartIQ** charts are enabled, and your indicators (**CPR**, **ADX**, and **ATR**) are loaded onto the chart layout.
2. Log into **Sensibull** and open the Options Chain page.

### Step 3: Run the Script

You can start the script in two different modes:

*   **Standard (Quiet) Mode:** (Hides detailed browser interactions, printing only grey success lines and the final colorized strategy report):
    ```bash
    npm start
    ```

*   **Debug Mode:** (Outputs all intermediate reload sequences, frame queries, network intercepts, and element diagnostics in real time):
    ```bash
    npm run debug
    ```

*   **Open Interest Mode:** (Runs the per-strike Open Interest analysis script that connects to the Sensibull Open Interest view):
    ```bash
    # Standard quiet mode
    npm run start:oi

    # Debug mode
    npm run debug:oi
    ```

---

## ⚙️ Configuration Properties (`.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | *Required* | API key for OpenAI access. |
| `CDP_HOST` | `127.0.0.1` | The host running Chrome DevTools Protocol. |
| `CDP_PORT` | `9222` | The debugging port Chrome is listening on. |
| `INTERVAL_MINUTES` | `5` | Time interval (in minutes) between analysis updates. |
| `ZERODHA_DOWNLOAD_SELECTOR` | *Dynamic* | Optional. Overrides default selectors used to click the Zerodha CSV export button. |

---

## 📁 File Structure

```text
├── package.json          # Project dependencies & launch scripts
├── tsconfig.json         # TypeScript compiler configurations
├── index.ts              # Original Entrypoint (Option Chain Mode)
├── index-oi.ts           # New Entrypoint (Open Interest Mode)
├── browser/
│   ├── connection.ts     # CDP session connection (exports connectToChrome & connectToChromeOI)
│   ├── sensibull.ts      # Option Chain network interception
│   ├── sensibull-oi.ts   # Open Interest network interception & preset clicking
│   └── zerodha.ts        # Chart iframe download trigger, CSV parser, and reloads
├── utils/
│   └── logger.ts         # Logger utility for debug flag and info logging
└── ai/
    ├── genkit.ts         # Original Genkit configuration & Zod schemas
    ├── genkit-oi.ts      # OI Genkit configuration & Zod schemas
    ├── prompts.ts        # Original Model prompts compiler
    └── prompts-oi.ts     # OI Model prompts compiler (aggregates per-strike data)
```
