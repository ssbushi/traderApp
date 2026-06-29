# NIFTY Options Analysis AI Co-Pilot

An automated command-line assistant designed to help NIFTY options traders make informed decisions. It connects to your active **Zerodha Kite** and **Sensibull** browser tabs, extracts live technical chart indicators and options metrics, and passes them to **Google Gemini (via Genkit)** to synthesize a structured trading strategy.

---

## 🚀 How It Works

1. **Shared Browser (CDP):** The script attaches to a running session of Google Chrome via the Chrome DevTools Protocol (CDP) on port `9222`. This bypasses complex 2FA logins and CAPTCHAs, running the script safely alongside your active trading routine.
2. **Sensibull Scraping:** The script intercepts the intraday option chain responses (`/compute_intraday`) to gather Put-Call Ratio (PCR), Open Interest (OI) changes, Max Pain, and Implied Volatility (IV).
3. **Zerodha Chart Scraping:** The script accesses the chart window, triggers the "Export/Download CSV" button, parses the data in memory, and reads key indicators like CPR (Pivot, BC, TC), ATR, and ADX/DMI (+DI, -DI).
4. **AI Generation:** The script merges these datasets and feeds them to Gemini, generating a structured options strategy with targets, stop-losses, and data-backed logical arguments.
5. **Continuous Loop:** By default, it updates and prints a fresh strategy card in your terminal every 5 minutes.

---

## 🛠️ Prerequisites

*   **Node.js** (v18 or higher)
*   **Google Chrome**
*   **Gemini API Key** (Get one from [Google AI Studio](https://aistudio.google.com/))

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
   GEMINI_API_KEY=your_gemini_api_key_here
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
1. Log into **Zerodha Kite** and open the NIFTY spot chart. Make sure **TradingView** charts are enabled, and your indicators (**CPR**, **ADX**, and **ATR**) are loaded onto the chart layout.
2. Log into **Sensibull** and open the Options Chain page.

### Step 3: Run the Script

In your project terminal, run:
```bash
npm start
```

---

## ⚙️ Configuration Properties (`.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | *Required* | API key for Gemini access. |
| `CDP_HOST` | `127.0.0.1` | The host running Chrome DevTools Protocol. |
| `CDP_PORT` | `9222` | The debugging port Chrome is listening on. |
| `INTERVAL_MINUTES` | `5` | Time interval (in minutes) between analysis updates. |
| `ZERODHA_DOWNLOAD_SELECTOR` | *Dynamic* | Optional. Overrides default selectors used to click the Zerodha CSV export button. |

---

## 📁 File Structure

```text
├── package.json          # Project dependencies & launch scripts
├── tsconfig.json         # TypeScript compiler configurations
├── index.ts              # Entrypoint and recurring loop execution
├── browser/
│   ├── connection.ts     # CDP session connection & browser OS instructions
│   ├── sensibull.ts      # Intraday options metrics network interception
│   └── zerodha.ts        # Chart iframe download trigger and CSV parser
└── ai/
    ├── genkit.ts         # Genkit configuration & Zod output schemas
    └── prompts.ts        # Model prompt construction & strategy generation
```
