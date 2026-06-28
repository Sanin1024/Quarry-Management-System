import os
from datetime import datetime, date
import pandas as pd
from models import WorkingPeriod
from calculations import calculate_period

COLUMN_ALIASES = {
    'day_from': ["dayfrom", "startdate"],
    'day_to': ["dayto", "enddate"],
    'num_labourers': ["numberoflabourers", "labourers", "nooflabourers"],
    'labour_pay': ["labourpay"],
    'diesel_expense': ["dieselexpense", "diesel"],
    'spare_parts': ["spareparts"],
    'fitting_charge': ["fittingcharge"],
    'jcb_charge': ["jcbcharge"],
    'cutting_wheel': ["cuttingwheel"],
    'mess_expense': ["messexpense"],
    'other_expense': ["otherexpense"],
    'first_quality_bricks': ["firstqualitybricks", "firstquality"],
    'second_quality_bricks': ["secondqualitybricks", "secondquality"],
    'broken_bricks_loads': ["brokenbricks", "brokenbricksloads"]
}

def parse_date(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, (datetime, date)):
        if hasattr(val, 'date'):
            return val.date()
        return val
    if isinstance(val, str):
        val = val.strip()
        for fmt in ['%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d']:
            try:
                return datetime.strptime(val, fmt).date()
            except ValueError:
                continue
    return None

def parse_number(val, is_int=False):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return 0
    if isinstance(val, (int, float)):
        return int(val) if is_int else float(val)
    if isinstance(val, str):
        # strip spaces, commas, currency symbols
        clean_str = "".join(c for c in val if c.isdigit() or c in ['.', '-'])
        if not clean_str:
            return 0
        try:
            if is_int:
                return int(float(clean_str))
            return float(clean_str)
        except ValueError:
            return 0
    return 0

def map_columns(df_columns):
    mapping = {}
    found = []
    missing = []
    
    for col in df_columns:
        norm_col = "".join(c for c in str(col).lower() if c.isalnum())
        matched = False
        for field, aliases in COLUMN_ALIASES.items():
            if norm_col == "".join(c for c in field.lower() if c.isalnum()) or norm_col in aliases:
                mapping[col] = field
                found.append(str(col))
                matched = True
                break
                
    for field in COLUMN_ALIASES.keys():
        if field not in mapping.values():
            missing.append(field)
            
    return mapping, found, missing

def preview_excel(filepath, quarry):
    """
    Reads the Excel file, maps columns, parses records, flags issues and duplicates, 
    and returns a summary dictionary.
    """
    # 1. Read Excel file
    try:
        df = pd.read_excel(filepath)
    except Exception as e:
        raise ValueError(f"Could not read Excel file: {str(e)}")

    # 2. Map columns
    mapping, found_cols, missing_cols = map_columns(df.columns)

    # 3. Query existing DB records for duplicate checking
    existing_periods = WorkingPeriod.query.filter_by(quarry=quarry).all()
    existing_dates = set((p.day_from, p.day_to) for p in existing_periods)

    rows = []
    total_rows = len(df)
    valid_rows = 0
    invalid_rows = 0
    
    file_dates = set()  # Tracks (day_from, day_to) in this file to detect duplicates

    # 4. Iterate and parse rows
    for index, df_row in df.iterrows():
        issues = []
        raw_row = {}
        
        # Populate raw data
        for col_name, field in mapping.items():
            raw_row[field] = df_row[col_name]

        # Parse fields
        day_from = parse_date(raw_row.get('day_from'))
        day_to = parse_date(raw_row.get('day_to'))
        
        # Validate dates
        if not day_from:
            issues.append("Missing or invalid 'Day From' date.")
        if not day_to:
            issues.append("Missing or invalid 'Day To' date.")
        if day_from and day_to and day_from > day_to:
            issues.append("'Day From' must be less than or equal to 'Day To'.")

        # Validate workforce
        num_labourers_raw = raw_row.get('num_labourers')
        if num_labourers_raw is None or pd.isna(num_labourers_raw):
            issues.append("Missing 'Number of Labourers'.")
            num_labourers = 0
        else:
            num_labourers = parse_number(num_labourers_raw, is_int=True)
            if num_labourers < 0:
                issues.append("'Number of Labourers' cannot be negative.")

        # Parse and check numeric fields
        expense_fields = [
            'labour_pay', 'diesel_expense', 'spare_parts', 'fitting_charge',
            'jcb_charge', 'cutting_wheel', 'mess_expense', 'other_expense'
        ]
        expenses = {}
        for f in expense_fields:
            val = parse_number(raw_row.get(f), is_int=False)
            if val < 0:
                issues.append(f"Expense '{f}' cannot be negative.")
            expenses[f] = val

        production_fields = [
            'first_quality_bricks', 'second_quality_bricks', 'broken_bricks_loads'
        ]
        production = {}
        for f in production_fields:
            val = parse_number(raw_row.get(f), is_int=(f != 'broken_bricks_loads'))
            if val < 0:
                issues.append(f"Production field '{f}' cannot be negative.")
            production[f] = val

        received_amount = parse_number(raw_row.get('received_amount'), is_int=False)
        if received_amount < 0:
            issues.append("Received amount cannot be negative.")

        # Duplicate checking
        if day_from and day_to:
            date_pair = (day_from, day_to)
            # Check within file
            if date_pair in file_dates:
                issues.append(f"Possible duplicate: another row in this file has same period ({day_from} to {day_to}).")
            else:
                file_dates.add(date_pair)
                
            # Check database
            if date_pair in existing_dates:
                issues.append(f"Possible duplicate: a record for {quarry} from {day_from} to {day_to} already exists in database.")

        # Run calculations if dates are valid
        derived = {}
        if day_from and day_to:
            calc_input = {
                'quarry': quarry,
                'day_from': day_from,
                'day_to': day_to,
                'num_labourers': num_labourers,
                'received_amount': received_amount,
                **expenses,
                **production
            }
            derived = calculate_period(calc_input)

        is_valid = len(issues) == 0
        if is_valid:
            valid_rows += 1
        else:
            invalid_rows += 1

        # Build output row dict
        row_dict = {
            'index': int(index),
            'day_from': day_from.isoformat() if day_from else None,
            'day_to': day_to.isoformat() if day_to else None,
            'num_labourers': num_labourers,
            'received_amount': received_amount,
            '_valid': is_valid,
            '_issues': issues,
            **expenses,
            **production,
            **derived
        }
        
        # Clean derived objects in output row dict (calculations returns date object, which needs string serialization)
        if 'day_from' in row_dict and isinstance(row_dict['day_from'], date):
            row_dict['day_from'] = row_dict['day_from'].isoformat()
        if 'day_to' in row_dict and isinstance(row_dict['day_to'], date):
            row_dict['day_to'] = row_dict['day_to'].isoformat()
            
        rows.append(row_dict)

    return {
        'rows': rows,
        'total_rows': total_rows,
        'valid_rows': valid_rows,
        'invalid_rows': invalid_rows,
        'columns_found': found_cols,
        'columns_missing': missing_cols
    }
