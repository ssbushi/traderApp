from kiteconnect import KiteConnect
import pandas as pd
from datetime import datetime, timedelta
import os
import time
import traceback


API_KEY = "qh02w387gvhcue9k"
API_SECRET = "hc1c728x7iwb8kscj5y27qeorwutwtu7"


symbols = [
    "ADANIPORTS", "ASIANPAINT", "AXISBANK", "BAJAJ-AUTO", "BAJFINANCE",
    "BAJAJFINSV", "BEL", "BHARTIARTL", "CIPLA", "COALINDIA",
    "DRREDDY", "EICHERMOT", "ETERNAL", "GRASIM", "HCLTECH",
    "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDUNILVR",
    "ICICIBANK", "INDUSINDBK", "INFY", "ITC", "JIOFIN",
    "JSWSTEEL", "KOTAKBANK", "LT", "M&M", "MARUTI",
    "NESTLEIND", "NTPC", "ONGC", "POWERGRID", "RELIANCE",
    "SBILIFE", "SHRIRAMFIN", "SBIN", "SUNPHARMA", "TATACONSUM",
    "TATAMOTORS", "TATASTEEL", "TCS", "TECHM", "TITAN",
    "TRENT", "ULTRACEMCO", "WIPRO",
    "NIFTY", "NIFTYBANK", "SENSEX"
]


to_date = datetime.now()
from_date = to_date - timedelta(days=182)


output_dir = "historical_data_6months"
os.makedirs(output_dir, exist_ok=True)


def remove_timezone(df):
    for col in df.columns:
        try:
            if pd.api.types.is_datetime64tz_dtype(df[col]):
                df[col] = df[col].dt.tz_localize(None)
        except Exception:
            pass
    return df


def find_instrument_token(symbol, nse_df, bse_df):
    # 1) NSE cash equity exact match
    eq_match = nse_df[
        (nse_df["tradingsymbol"] == symbol) &
        (nse_df["instrument_type"] == "EQ")
    ]
    if not eq_match.empty:
        row = eq_match.iloc[0]
        return int(row["instrument_token"]), row["exchange"], row["tradingsymbol"], row.get("name", "")


    # 2) BSE cash equity exact match
    eq_match_bse = bse_df[
        (bse_df["tradingsymbol"] == symbol) &
        (bse_df["instrument_type"] == "EQ")
    ]
    if not eq_match_bse.empty:
        row = eq_match_bse.iloc[0]
        return int(row["instrument_token"]), row["exchange"], row["tradingsymbol"], row.get("name", "")


    # 3) Index handling
    # Try exact tradingsymbol match first
    idx_nse = nse_df[nse_df["tradingsymbol"] == symbol]
    if not idx_nse.empty:
        row = idx_nse.iloc[0]
        return int(row["instrument_token"]), row["exchange"], row["tradingsymbol"], row.get("name", "")


    idx_bse = bse_df[bse_df["tradingsymbol"] == symbol]
    if not idx_bse.empty:
        row = idx_bse.iloc[0]
        return int(row["instrument_token"]), row["exchange"], row["tradingsymbol"], row.get("name", "")


    # 4) Fallback name-based search for known indices
    if symbol == "NIFTY":
        candidates = nse_df[
            nse_df["name"].astype(str).str.contains("NIFTY 50|NIFTY", case=False, na=False)
        ]
        if not candidates.empty:
            row = candidates.iloc[0]
            return int(row["instrument_token"]), row["exchange"], row["tradingsymbol"], row.get("name", "")


    if symbol == "NIFTYBANK":
        candidates = nse_df[
            nse_df["name"].astype(str).str.contains("NIFTY BANK|BANK NIFTY", case=False, na=False)
        ]
        if not candidates.empty:
            row = candidates.iloc[0]
            return int(row["instrument_token"]), row["exchange"], row["tradingsymbol"], row.get("name", "")


    if symbol == "SENSEX":
        candidates = bse_df[
            bse_df["name"].astype(str).str.contains("SENSEX", case=False, na=False) |
            bse_df["tradingsymbol"].astype(str).str.contains("SENSEX", case=False, na=False)
        ]
        if not candidates.empty:
            row = candidates.iloc[0]
            return int(row["instrument_token"]), row["exchange"], row["tradingsymbol"], row.get("name", "")


    return None, None, None, None




try:
    kite = KiteConnect(api_key=API_KEY)


    print("Login URL:")
    print(kite.login_url())
    request_token = input("Enter request_token: ").strip()


    session_data = kite.generate_session(request_token, api_secret=API_SECRET)
    kite.set_access_token(session_data["access_token"])


    print("Login successful")
    print("User:", session_data.get("user_name"))


    print("Profile:", kite.profile().get("user_name"))


    print("Fetching NSE and BSE instrument dumps...")
    nse_df = pd.DataFrame(kite.instruments("NSE"))
    bse_df = pd.DataFrame(kite.instruments("BSE"))


    nse_df.to_csv(os.path.join(output_dir, "nse_instruments.csv"), index=False)
    bse_df.to_csv(os.path.join(output_dir, "bse_instruments.csv"), index=False)


    all_data = []
    summary = []


    for symbol in symbols:
        try:
            token, exchange, found_symbol, found_name = find_instrument_token(symbol, nse_df, bse_df)


            if token is None:
                print(f"Skipping {symbol}: token not found")
                summary.append({
                    "requested_symbol": symbol,
                    "status": "skipped",
                    "reason": "token not found",
                    "exchange": "",
                    "found_symbol": "",
                    "found_name": ""
                })
                continue


            print(f"Downloading {symbol} from {exchange} using {found_symbol} ({token}) ...")


            data = kite.historical_data(
                instrument_token=token,
                from_date=from_date,
                to_date=to_date,
                interval="day"
            )


            if not data:
                print(f"No data returned for {symbol}")
                summary.append({
                    "requested_symbol": symbol,
                    "status": "failed",
                    "reason": "no data returned",
                    "exchange": exchange,
                    "found_symbol": found_symbol,
                    "found_name": found_name
                })
                continue


            df = pd.DataFrame(data)
            df["requested_symbol"] = symbol
            df["resolved_symbol"] = found_symbol
            df["exchange"] = exchange
            df["instrument_token"] = token


            if "date" in df.columns:
                df["date"] = pd.to_datetime(df["date"], errors="coerce")
                try:
                    df["date"] = df["date"].dt.tz_localize(None)
                except Exception:
                    pass


            df = remove_timezone(df)


            df.to_csv(os.path.join(output_dir, f"{symbol}_6months_daily.csv"), index=False)
            all_data.append(df)


            summary.append({
                "requested_symbol": symbol,
                "status": "downloaded",
                "reason": "",
                "exchange": exchange,
                "found_symbol": found_symbol,
                "found_name": found_name
            })


            time.sleep(0.3)


        except Exception as e:
            print(f"Error downloading {symbol}: {e}")
            summary.append({
                "requested_symbol": symbol,
                "status": "failed",
                "reason": str(e),
                "exchange": "",
                "found_symbol": "",
                "found_name": ""
            })


    summary_df = pd.DataFrame(summary)
    summary_df.to_csv(os.path.join(output_dir, "download_summary.csv"), index=False)


    if all_data:
        combined_df = pd.concat(all_data, ignore_index=True)
        combined_df = remove_timezone(combined_df)
        combined_df.to_csv(os.path.join(output_dir, "combined_6months_daily.csv"), index=False)
        print("Saved combined file successfully.")
    else:
        print("No data downloaded.")


except Exception as e:
    print("Fatal error occurred:")
    print(str(e))
    print("\nFull traceback:")
    traceback.print_exc()

