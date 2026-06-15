import pandas as pd
import json

def get_excel_info(file_path):
    try:
        df = pd.read_excel(file_path)
        print(f"--- File: {file_path} ---")
        print("Headers:")
        print(df.columns.tolist())
        print("First row data:")
        if not df.empty:
            print(df.iloc[0].to_dict())
        else:
            print("Empty dataframe")
        print("\n")
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

get_excel_info(r"D:\Project-Tracking-System\ORGANIC TNT 12 JUNI\AWARENESS\PWS 07-05-2026 - 11-06-2026.xlsx")
get_excel_info(r"D:\Project-Tracking-System\ORGANIC TNT 12 JUNI\SALES\WARDAH 01_06_2026 - 12_060_2026.xlsx")
