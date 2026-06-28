from datetime import datetime, date

def calculate_period(data: dict) -> dict:
    """
    Takes raw input dictionary containing:
    - day_from (date, string, or datetime)
    - day_to (date, string, or datetime)
    - num_labourers (int)
    - the 8 expense fields (float)
    - first_quality_bricks (int)
    - second_quality_bricks (int)
    - broken_bricks_loads (int)
    - received_amount (float)
    - quarry (str: "Quarry 1" or "Quarry 2")

    Returns a dict with all derived fields calculated using exact business rules.
    """
    quarry = data.get('quarry', 'Quarry 1')
    
    day_from = data.get('day_from')
    day_to = data.get('day_to')
    
    # Parse dates if strings or datetimes
    if isinstance(day_from, str):
        day_from = datetime.strptime(day_from, '%Y-%m-%d').date()
    elif isinstance(day_from, datetime):
        day_from = day_from.date()
        
    if isinstance(day_to, str):
        day_to = datetime.strptime(day_to, '%Y-%m-%d').date()
    elif isinstance(day_to, datetime):
        day_to = day_to.date()
        
    working_days = 0
    if day_from and day_to:
        working_days = (day_to - day_from).days + 1
        
    num_labourers = int(data.get('num_labourers') or 0)
    
    # Expenses
    labour_pay = float(data.get('labour_pay') or 0.0)
    diesel_expense = float(data.get('diesel_expense') or 0.0)
    spare_parts = float(data.get('spare_parts') or 0.0)
    fitting_charge = float(data.get('fitting_charge') or 0.0)
    jcb_charge = float(data.get('jcb_charge') or 0.0)
    cutting_wheel = float(data.get('cutting_wheel') or 0.0)
    mess_expense = float(data.get('mess_expense') or 0.0)
    other_expense = float(data.get('other_expense') or 0.0)
    
    total_expense = (
        labour_pay + diesel_expense + spare_parts + fitting_charge +
        jcb_charge + cutting_wheel + mess_expense + other_expense
    )
    
    # Production
    first_quality_bricks = int(data.get('first_quality_bricks') or 0)
    second_quality_bricks = int(data.get('second_quality_bricks') or 0)
    broken_bricks_loads = int(data.get('broken_bricks_loads') or 0)
    
    # Revenue
    if quarry == "Quarry 2":
        total_revenue = (
            (first_quality_bricks * 40.0) +
            (second_quality_bricks * 30.0) +
            (broken_bricks_loads * 1000.0)
        )
    else:  # Quarry 1
        total_revenue = (
            (first_quality_bricks * 38.0) +
            (second_quality_bricks * 28.0) +
            (broken_bricks_loads * 850.0)
        )
        
    # Land Lease
    land_lease_value = (
        (first_quality_bricks * 20.0) +
        (second_quality_bricks * 20.0) +
        (broken_bricks_loads * 400.0)
    )
    
    # Net Value & Outstanding
    net_value = total_revenue - total_expense
    received_amount = float(data.get('received_amount') or 0.0)
    balance_outstanding = net_value - received_amount
    
    return {
        'day_from': day_from,
        'day_to': day_to,
        'working_days': working_days,
        'num_labourers': num_labourers,
        'labour_pay': labour_pay,
        'diesel_expense': diesel_expense,
        'spare_parts': spare_parts,
        'fitting_charge': fitting_charge,
        'jcb_charge': jcb_charge,
        'cutting_wheel': cutting_wheel,
        'mess_expense': mess_expense,
        'other_expense': other_expense,
        'total_expense': total_expense,
        'first_quality_bricks': first_quality_bricks,
        'second_quality_bricks': second_quality_bricks,
        'broken_bricks_loads': broken_bricks_loads,
        'total_revenue': total_revenue,
        'land_lease_value': land_lease_value,
        'net_value': net_value,
        'received_amount': received_amount,
        'balance_outstanding': balance_outstanding
    }
