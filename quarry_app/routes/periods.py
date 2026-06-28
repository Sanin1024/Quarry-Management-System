from datetime import datetime
from flask import Blueprint, request, jsonify
from sqlalchemy import func, or_
from models import db, WorkingPeriod, ActivityLog
from calculations import calculate_period

periods_bp = Blueprint('periods', __name__)

def serialize_period(p):
    return {
        'id': p.id,
        'quarry': p.quarry,
        'day_from': p.day_from.isoformat() if p.day_from else None,
        'day_to': p.day_to.isoformat() if p.day_to else None,
        'working_days': p.working_days,
        'num_labourers': p.num_labourers,
        'labour_pay': p.labour_pay,
        'diesel_expense': p.diesel_expense,
        'spare_parts': p.spare_parts,
        'fitting_charge': p.fitting_charge,
        'jcb_charge': p.jcb_charge,
        'cutting_wheel': p.cutting_wheel,
        'mess_expense': p.mess_expense,
        'other_expense': p.other_expense,
        'total_expense': p.total_expense,
        'first_quality_bricks': p.first_quality_bricks,
        'second_quality_bricks': p.second_quality_bricks,
        'broken_bricks_loads': p.broken_bricks_loads,
        'total_revenue': p.total_revenue,
        'land_lease_value': p.land_lease_value,
        'net_value': p.net_value,
        'received_amount': p.received_amount,
        'balance_outstanding': p.balance_outstanding,
        'source_file': p.source_file,
        'created_at': p.created_at.isoformat() if p.created_at else None,
        'updated_at': p.updated_at.isoformat() if p.updated_at else None
    }

def validate_input(data):
    errors = []
    
    quarry = data.get('quarry')
    if quarry not in ["Quarry 1", "Quarry 2"]:
        errors.append("quarry must be 'Quarry 1' or 'Quarry 2'")
        
    day_from_str = data.get('day_from')
    day_to_str = data.get('day_to')
    
    day_from = None
    day_to = None
    
    if not day_from_str:
        errors.append("day_from is required")
    else:
        try:
            if isinstance(day_from_str, str):
                day_from = datetime.strptime(day_from_str, '%Y-%m-%d').date()
            else:
                day_from = day_from_str
        except (ValueError, TypeError):
            errors.append("day_from must be in YYYY-MM-DD format")
            
    if not day_to_str:
        errors.append("day_to is required")
    else:
        try:
            if isinstance(day_to_str, str):
                day_to = datetime.strptime(day_to_str, '%Y-%m-%d').date()
            else:
                day_to = day_to_str
        except (ValueError, TypeError):
            errors.append("day_to must be in YYYY-MM-DD format")
            
    if day_from and day_to and day_from > day_to:
        errors.append("day_from must be less than or equal to day_to")
        
    num_labourers = data.get('num_labourers')
    if num_labourers is not None:
        try:
            val = int(num_labourers)
            if val < 0:
                errors.append("num_labourers must be >= 0")
        except (ValueError, TypeError):
            errors.append("num_labourers must be an integer")
            
    expense_fields = [
        'labour_pay', 'diesel_expense', 'spare_parts', 'fitting_charge',
        'jcb_charge', 'cutting_wheel', 'mess_expense', 'other_expense'
    ]
    for field in expense_fields:
        val = data.get(field)
        if val is not None:
            try:
                f_val = float(val)
                if f_val < 0:
                    errors.append(f"{field} must be >= 0")
            except (ValueError, TypeError):
                errors.append(f"{field} must be a number")
                
    production_fields = [
        'first_quality_bricks', 'second_quality_bricks', 'broken_bricks_loads'
    ]
    for field in production_fields:
        val = data.get(field)
        if val is not None:
            try:
                i_val = int(val)
                if i_val < 0:
                    errors.append(f"{field} must be >= 0")
            except (ValueError, TypeError):
                errors.append(f"{field} must be an integer")
                
    received = data.get('received_amount')
    if received is not None:
        try:
            f_val = float(received)
            if f_val < 0:
                errors.append("received_amount must be >= 0")
        except (ValueError, TypeError):
            errors.append("received_amount must be a number")
            
    return errors, day_from, day_to

# GET /api/periods - List periods with search, sort, filter, and pagination
@periods_bp.route('', methods=['GET'])
def list_periods():
    query = WorkingPeriod.query
    
    # Filtering by Quarry
    quarry = request.args.get('quarry')
    if quarry:
        query = query.filter(WorkingPeriod.quarry == quarry)
        
    # Filtering by Date Range
    date_from_str = request.args.get('date_from')
    if date_from_str:
        try:
            d_from = datetime.strptime(date_from_str, '%Y-%m-%d').date()
            query = query.filter(WorkingPeriod.day_from >= d_from)
        except ValueError:
            return jsonify({'errors': ['date_from must be in YYYY-MM-DD format']}), 400
            
    date_to_str = request.args.get('date_to')
    if date_to_str:
        try:
            d_to = datetime.strptime(date_to_str, '%Y-%m-%d').date()
            query = query.filter(WorkingPeriod.day_to <= d_to)
        except ValueError:
            return jsonify({'errors': ['date_to must be in YYYY-MM-DD format']}), 400

    # Search (matches against quarry or source_file)
    search = request.args.get('search')
    if search:
        query = query.filter(or_(
            WorkingPeriod.quarry.ilike(f'%{search}%'),
            WorkingPeriod.source_file.ilike(f'%{search}%')
        ))
        
    # Sorting
    sort_by = request.args.get('sort_by', 'day_from')
    sort_dir = request.args.get('sort_dir', 'desc')
    
    valid_cols = {
        'id': WorkingPeriod.id,
        'quarry': WorkingPeriod.quarry,
        'day_from': WorkingPeriod.day_from,
        'day_to': WorkingPeriod.day_to,
        'working_days': WorkingPeriod.working_days,
        'total_expense': WorkingPeriod.total_expense,
        'total_revenue': WorkingPeriod.total_revenue,
        'net_value': WorkingPeriod.net_value,
        'received_amount': WorkingPeriod.received_amount,
        'balance_outstanding': WorkingPeriod.balance_outstanding
    }
    
    sort_col = valid_cols.get(sort_by, WorkingPeriod.day_from)
    if sort_dir.lower() == 'asc':
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())
        
    # Pagination
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 10))
        if page < 1 or page_size < 1:
            raise ValueError()
    except ValueError:
        return jsonify({'errors': ['page and page_size must be positive integers']}), 400
        
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    
    return jsonify({
        'items': [serialize_period(p) for p in items],
        'total': total
    })

# GET /api/periods/summary - Aggregated totals
@periods_bp.route('/summary', methods=['GET'])
def summary_periods():
    query = WorkingPeriod.query
    
    # Filter
    quarry = request.args.get('quarry')
    if quarry:
        query = query.filter(WorkingPeriod.quarry == quarry)
        
    date_from_str = request.args.get('date_from')
    if date_from_str:
        try:
            d_from = datetime.strptime(date_from_str, '%Y-%m-%d').date()
            query = query.filter(WorkingPeriod.day_from >= d_from)
        except ValueError:
            return jsonify({'errors': ['date_from must be in YYYY-MM-DD format']}), 400
            
    date_to_str = request.args.get('date_to')
    if date_to_str:
        try:
            d_to = datetime.strptime(date_to_str, '%Y-%m-%d').date()
            query = query.filter(WorkingPeriod.day_to <= d_to)
        except ValueError:
            return jsonify({'errors': ['date_to must be in YYYY-MM-DD format']}), 400

    # Aggregate
    summary = db.session.query(
        func.sum(WorkingPeriod.working_days).label('total_working_days'),
        func.sum(WorkingPeriod.num_labourers).label('total_labourers'),
        func.sum(WorkingPeriod.total_expense).label('total_expense'),
        func.sum(WorkingPeriod.total_revenue).label('total_revenue'),
        func.sum(WorkingPeriod.net_value).label('total_net_value'),
        func.sum(WorkingPeriod.received_amount).label('total_received'),
        func.sum(WorkingPeriod.balance_outstanding).label('total_outstanding')
    ).filter(WorkingPeriod.id.in_([p.id for p in query.all()]) if query.all() else False).first()

    return jsonify({
        'total_working_days': int(summary.total_working_days or 0) if summary else 0,
        'total_labourers': int(summary.total_labourers or 0) if summary else 0,
        'total_expense': float(summary.total_expense or 0.0) if summary else 0.0,
        'total_revenue': float(summary.total_revenue or 0.0) if summary else 0.0,
        'total_net_value': float(summary.total_net_value or 0.0) if summary else 0.0,
        'total_received': float(summary.total_received or 0.0) if summary else 0.0,
        'total_outstanding': float(summary.total_outstanding or 0.0) if summary else 0.0
    })

# GET /api/periods/<id> - Single period detail
@periods_bp.route('/<int:id>', methods=['GET'])
def get_period(id):
    p = WorkingPeriod.query.get(id)
    if not p:
        return jsonify({'errors': ['Working period not found']}), 404
    return jsonify(serialize_period(p))

# POST /api/periods - Create new period
@periods_bp.route('', methods=['POST'])
def create_period():
    data = request.get_json() or {}
    
    errors, day_from, day_to = validate_input(data)
    if errors:
        return jsonify({'errors': errors}), 400

    # Run calculations
    derived = calculate_period(data)
    
    # Create model object
    p = WorkingPeriod(
        quarry=data['quarry'],
        day_from=day_from,
        day_to=day_to,
        working_days=derived['working_days'],
        num_labourers=derived['num_labourers'],
        labour_pay=derived['labour_pay'],
        diesel_expense=derived['diesel_expense'],
        spare_parts=derived['spare_parts'],
        fitting_charge=derived['fitting_charge'],
        jcb_charge=derived['jcb_charge'],
        cutting_wheel=derived['cutting_wheel'],
        mess_expense=derived['mess_expense'],
        other_expense=derived['other_expense'],
        total_expense=derived['total_expense'],
        first_quality_bricks=derived['first_quality_bricks'],
        second_quality_bricks=derived['second_quality_bricks'],
        broken_bricks_loads=derived['broken_bricks_loads'],
        total_revenue=derived['total_revenue'],
        land_lease_value=derived['land_lease_value'],
        net_value=derived['net_value'],
        received_amount=derived['received_amount'],
        balance_outstanding=derived['balance_outstanding'],
        source_file=data.get('source_file')
    )
    
    db.session.add(p)
    
    # Log activity
    log = ActivityLog(
        action="CREATE",
        details=f"Created working period for {p.quarry} from {p.day_from.isoformat()} to {p.day_to.isoformat()} (Net Value: INR {p.net_value:,.2f})"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify(serialize_period(p)), 201

# PUT /api/periods/<id> - Update existing period
@periods_bp.route('/<int:id>', methods=['PUT'])
def update_period(id):
    p = WorkingPeriod.query.get(id)
    if not p:
        return jsonify({'errors': ['Working period not found']}), 404
        
    data = request.get_json() or {}
    
    errors, day_from, day_to = validate_input(data)
    if errors:
        return jsonify({'errors': errors}), 400

    # Run calculations
    derived = calculate_period(data)
    
    # Update properties
    p.quarry = data['quarry']
    p.day_from = day_from
    p.day_to = day_to
    p.working_days = derived['working_days']
    p.num_labourers = derived['num_labourers']
    p.labour_pay = derived['labour_pay']
    p.diesel_expense = derived['diesel_expense']
    p.spare_parts = derived['spare_parts']
    p.fitting_charge = derived['fitting_charge']
    p.jcb_charge = derived['jcb_charge']
    p.cutting_wheel = derived['cutting_wheel']
    p.mess_expense = derived['mess_expense']
    p.other_expense = derived['other_expense']
    p.total_expense = derived['total_expense']
    p.first_quality_bricks = derived['first_quality_bricks']
    p.second_quality_bricks = derived['second_quality_bricks']
    p.broken_bricks_loads = derived['broken_bricks_loads']
    p.total_revenue = derived['total_revenue']
    p.land_lease_value = derived['land_lease_value']
    p.net_value = derived['net_value']
    p.received_amount = derived['received_amount']
    p.balance_outstanding = derived['balance_outstanding']
    p.source_file = data.get('source_file', p.source_file)
    p.updated_at = datetime.utcnow()
    
    # Log activity
    log = ActivityLog(
        action="UPDATE",
        details=f"Updated working period ID {p.id} for {p.quarry} from {p.day_from.isoformat()} to {p.day_to.isoformat()}"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify(serialize_period(p))

# DELETE /api/periods/<id> - Delete period
@periods_bp.route('/<int:id>', methods=['DELETE'])
def delete_period(id):
    p = WorkingPeriod.query.get(id)
    if not p:
        return jsonify({'errors': ['Working period not found']}), 404
        
    # Log activity
    log = ActivityLog(
        action="DELETE",
        details=f"Deleted working period ID {p.id} for {p.quarry} from {p.day_from.isoformat()} to {p.day_to.isoformat()}"
    )
    db.session.add(log)
    
    db.session.delete(p)
    db.session.commit()
    
    return jsonify({'status': 'deleted', 'id': id})
