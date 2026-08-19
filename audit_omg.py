import pandas as pd
import json

file_path = r"C:\Users\Hibban\Downloads\20 mei - 19 agustus affiliate_orders_7675519517926049557.xlsx"

try:
    df = pd.read_excel(file_path)
    print(f"Data loaded: {len(df)} rows")
    
    # Show columns
    print("Columns:", df.columns.tolist())
    
    # We need to find the exact column names for Date, GMV, Creator, Content Type, etc.
    # Print the first row
    if not df.empty:
        print("First row:", df.iloc[0].to_dict())

except Exception as e:
    print(f"Error: {e}")
