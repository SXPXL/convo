import pandas as pd

# 1. Load both Excel files
large_df = pd.read_excel('UG_13_7_26.xlsx')
small_df = pd.read_excel('CONVO_MASTER_SOURCE.xlsx')

# 2. Define the column name you are comparing (e.g., 'ID', 'Email', etc.)
col_name = 'Register No' 

# 3. Filter for rows where the value in the large file is NOT in the small file
missing_data = large_df[~large_df[col_name].isin(small_df[col_name])]

# Optional: If you want ONLY that single column of values (not the whole row), uncomment the next line:
# missing_data = missing_data[[col_name]]

# 4. Export to a new Excel file
missing_data.to_excel('missing_values_only1.xlsx', index=False)

print("Extraction complete. Saved to 'missing_values_only1.xlsx'")