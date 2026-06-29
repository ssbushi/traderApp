from kiteconnect import KiteConnect
import pandas as pd
from datetime import datetime, timedelta
import os
import time
import logging


logging.basicConfig(level=logging.INFO)


API_KEY = "qh02w387gvhcue9k"
API_SECRET = "hc1c728x7iwb8kscj5y27qeorwutwtu7"


# Step 1: create client
kite = KiteConnect(api_key=API_KEY)


# Step 2: first run this once and login manually
print("Login URL:", kite.login_url())


# After login, Zerodha redirects to your redirect URL like:
# https://your-redirect-url.com/?request_token=xxxxxxx&action=login&status=success
# Copy that request_token and paste below.


request_token = input("Enter request_token: ").strip()


# Step 3: exchange request_token for access_token
session_data = kite.generate_session(request_token, api_secret=API_SECRET)
access_token = session_data["access_token"]
kite.set_access_token(access_token)


print("Authenticated user:", session_data["user_name"])
print("Access token generated successfully.")

