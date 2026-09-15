import pandas as pd
import json

file_paths = [
    r"C:\Users\Hibban\Downloads\ALL CAMPAIGN TNT affiliate_orders 2026\JANUARI_affiliate_orders_7658679013448451860.xlsx",
    r"C:\Users\Hibban\Downloads\ALL CAMPAIGN TNT affiliate_orders 2026\JUNI_affiliate_orders_7658605194671605524_01-06-2026-06-07-2026.xlsx"
]

def check_excel(path):
    print(f"--- Analyzing {path} ---")
    try:
        # Some TikTok files might have skiprows if there are headers on top
        df = pd.read_excel(path)
        print("Columns:", list(df.columns))
        print("Content Types (unique):", df.get("Content Type", pd.Series([])).unique().tolist())
        print("Sample Products (first 5 unique):", df.get("Product Name", pd.Series([])).unique().tolist()[:5])
        
        # Check if any PWS products exist
        # We don't know the PWS product name, but we can look for 'PWS' in product name
        if "Product Name" in df.columns:
            pws_mask = df["Product Name"].str.contains("PWS", case=False, na=False)
            print(f"PWS in Product Name count: {pws_mask.sum()}")
    except Exception as e:
        print(f"Error reading {path}: {e}")

for p in file_paths:
    check_excel(p)
