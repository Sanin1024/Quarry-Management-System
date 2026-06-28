from datetime import datetime, date
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from models import db, WorkingPeriod
from routes.periods import serialize_period

analytics_bp = Blueprint('analytics', __name__)

def calc_pct_change(curr_val, prev_val):
    curr_val = float(curr_val or 0.0)
    prev_val = float(prev_val or 0.0)
    if prev_val == 0.0:
        if curr_val == 0.0:
            return 0.0
        return 100.0
    return round(((curr_val - prev_val) / prev_val) * 100.0, 2)

# GET /api/analytics/dashboard
@analytics_bp.route('/dashboard', methods=['GET'])
def get_dashboard_analytics():
    # 1. Overall lifetime KPIs
    overall = db.session.query(
        func.sum(WorkingPeriod.total_revenue).label('revenue'),
        func.sum(WorkingPeriod.total_expense).label('expense'),
        func.sum(WorkingPeriod.net_value).label('net_value'),
        func.sum(WorkingPeriod.received_amount).label('received'),
        func.sum(WorkingPeriod.working_days).label('working_days')
    ).first()

    # 2. MoM comparison based on latest period in database
    latest_record = WorkingPeriod.query.order_by(WorkingPeriod.day_from.desc()).first()
    if latest_record:
        latest_year = latest_record.day_from.year
        latest_month = latest_record.day_from.month
    else:
        latest_year = datetime.utcnow().year
        latest_month = datetime.utcnow().month

    curr_month_str = f"{latest_year:04d}-{latest_month:02d}"
    
    if latest_month == 1:
        prev_year = latest_year - 1
        prev_month = 12
    else:
        prev_year = latest_year
        prev_month = latest_month - 1
    prev_month_str = f"{prev_year:04d}-{prev_month:02d}"

    curr_summary = db.session.query(
        func.sum(WorkingPeriod.total_revenue).label('revenue'),
        func.sum(WorkingPeriod.total_expense).label('expense'),
        func.sum(WorkingPeriod.net_value).label('net_value'),
        func.sum(WorkingPeriod.received_amount).label('received'),
        func.sum(WorkingPeriod.working_days).label('working_days')
    ).filter(func.strftime('%Y-%m', WorkingPeriod.day_from) == curr_month_str).first()

    prev_summary = db.session.query(
        func.sum(WorkingPeriod.total_revenue).label('revenue'),
        func.sum(WorkingPeriod.total_expense).label('expense'),
        func.sum(WorkingPeriod.net_value).label('net_value'),
        func.sum(WorkingPeriod.received_amount).label('received'),
        func.sum(WorkingPeriod.working_days).label('working_days')
    ).filter(func.strftime('%Y-%m', WorkingPeriod.day_from) == prev_month_str).first()

    kpis = {
        'total_revenue': {
            'value': float(overall.revenue or 0.0) if overall else 0.0,
            'pct_change': calc_pct_change(curr_summary.revenue, prev_summary.revenue) if curr_summary and prev_summary else 0.0
        },
        'total_expense': {
            'value': float(overall.expense or 0.0) if overall else 0.0,
            'pct_change': calc_pct_change(curr_summary.expense, prev_summary.expense) if curr_summary and prev_summary else 0.0
        },
        'net_value': {
            'value': float(overall.net_value or 0.0) if overall else 0.0,
            'pct_change': calc_pct_change(curr_summary.net_value, prev_summary.net_value) if curr_summary and prev_summary else 0.0
        },
        'total_received': {
            'value': float(overall.received or 0.0) if overall else 0.0,
            'pct_change': calc_pct_change(curr_summary.received, prev_summary.received) if curr_summary and prev_summary else 0.0
        },
        'total_working_days': {
            'value': int(overall.working_days or 0) if overall else 0,
            'pct_change': calc_pct_change(curr_summary.working_days, prev_summary.working_days) if curr_summary and prev_summary else 0.0
        }
    }

    # 3. Production totals split by quarry
    prod_q1 = db.session.query(
        func.sum(WorkingPeriod.first_quality_bricks).label('first'),
        func.sum(WorkingPeriod.second_quality_bricks).label('second'),
        func.sum(WorkingPeriod.broken_bricks_loads).label('broken')
    ).filter_by(quarry='Quarry 1').first()

    prod_q2 = db.session.query(
        func.sum(WorkingPeriod.first_quality_bricks).label('first'),
        func.sum(WorkingPeriod.second_quality_bricks).label('second'),
        func.sum(WorkingPeriod.broken_bricks_loads).label('broken')
    ).filter_by(quarry='Quarry 2').first()

    production = {
        'Quarry 1': {
            'first_quality_bricks': int(prod_q1.first or 0) if prod_q1 else 0,
            'second_quality_bricks': int(prod_q1.second or 0) if prod_q1 else 0,
            'broken_bricks_loads': int(prod_q1.broken or 0) if prod_q1 else 0
        },
        'Quarry 2': {
            'first_quality_bricks': int(prod_q2.first or 0) if prod_q2 else 0,
            'second_quality_bricks': int(prod_q2.second or 0) if prod_q2 else 0,
            'broken_bricks_loads': int(prod_q2.broken or 0) if prod_q2 else 0
        }
    }

    # 4. Recent activity (5 most recent records)
    recent_records = WorkingPeriod.query.order_by(WorkingPeriod.day_from.desc()).limit(5).all()
    recent = [serialize_period(p) for p in recent_records]

    return jsonify({
        'kpis': kpis,
        'production': production,
        'recent_activity': recent,
        'mom_base_month': curr_month_str,
        'mom_comparison_month': prev_month_str
    })

# GET /api/analytics/revenue-expense-by-month
@analytics_bp.route('/revenue-expense-by-month', methods=['GET'])
def get_revenue_expense_by_month():
    quarry = request.args.get('quarry')
    
    # 1. Distinct months sorted chronologically
    months_query = db.session.query(
        func.strftime('%Y-%m', WorkingPeriod.day_from).label('month')
    )
    if quarry:
        months_query = months_query.filter(WorkingPeriod.quarry == quarry)
    months = [m.month for m in months_query.distinct().order_by('month').all()]

    # 2. Build dataset grouped by quarry
    datasets = []
    quarries_to_process = [quarry] if quarry else ["Quarry 1", "Quarry 2"]
    
    for q in quarries_to_process:
        q_monthly = db.session.query(
            func.strftime('%Y-%m', WorkingPeriod.day_from).label('month'),
            func.sum(WorkingPeriod.total_revenue).label('revenue'),
            func.sum(WorkingPeriod.total_expense).label('expense')
        ).filter(WorkingPeriod.quarry == q).group_by('month').all()
        
        monthly_map = {m.month: (float(m.revenue or 0.0), float(m.expense or 0.0)) for m in q_monthly}
        
        revenue_data = []
        expense_data = []
        for m in months:
            rev, exp = monthly_map.get(m, (0.0, 0.0))
            revenue_data.append(rev)
            expense_data.append(exp)
            
        datasets.append({
            'quarry': q,
            'revenue': revenue_data,
            'expense': expense_data
        })

    return jsonify({
        'labels': months,
        'datasets': datasets
    })

# GET /api/analytics/net-value-trend
@analytics_bp.route('/net-value-trend', methods=['GET'])
def get_net_value_trend():
    months = [m.month for m in db.session.query(
        func.strftime('%Y-%m', WorkingPeriod.day_from).label('month')
    ).distinct().order_by('month').all()]

    datasets = []
    for q in ["Quarry 1", "Quarry 2"]:
        q_monthly = db.session.query(
            func.strftime('%Y-%m', WorkingPeriod.day_from).label('month'),
            func.sum(WorkingPeriod.net_value).label('net_value')
        ).filter(WorkingPeriod.quarry == q).group_by('month').all()
        
        monthly_map = {m.month: float(m.net_value or 0.0) for m in q_monthly}
        
        net_value_data = []
        for m in months:
            net_value_data.append(monthly_map.get(m, 0.0))
            
        datasets.append({
            'quarry': q,
            'net_value': net_value_data
        })

    return jsonify({
        'labels': months,
        'datasets': datasets
    })

# GET /api/analytics/compare
@analytics_bp.route('/compare', methods=['GET'])
def get_comparison_analytics():
    # Filter
    query = WorkingPeriod.query
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

    def get_site_summary(q_name, query_base):
        # We must filter by the matching IDs of query_base to respect date filters
        matching_ids = [p.id for p in query_base.all()]
        if not matching_ids:
            return {
                'working_days': 0, 'labourers': 0, 'expense': 0.0, 'revenue': 0.0,
                'net_value': 0.0, 'received': 0.0, 'outstanding': 0.0,
                'breakdown': {
                    'labour_pay': 0.0, 'diesel_expense': 0.0, 'spare_parts': 0.0,
                    'fitting_charge': 0.0, 'jcb_charge': 0.0, 'cutting_wheel': 0.0,
                    'mess_expense': 0.0, 'other_expense': 0.0
                }
            }
            
        res = db.session.query(
            func.sum(WorkingPeriod.working_days).label('working_days'),
            func.sum(WorkingPeriod.num_labourers).label('labourers'),
            func.sum(WorkingPeriod.total_expense).label('expense'),
            func.sum(WorkingPeriod.total_revenue).label('revenue'),
            func.sum(WorkingPeriod.net_value).label('net_value'),
            func.sum(WorkingPeriod.received_amount).label('received'),
            func.sum(WorkingPeriod.balance_outstanding).label('outstanding'),
            func.sum(WorkingPeriod.labour_pay).label('labour_pay'),
            func.sum(WorkingPeriod.diesel_expense).label('diesel_expense'),
            func.sum(WorkingPeriod.spare_parts).label('spare_parts'),
            func.sum(WorkingPeriod.fitting_charge).label('fitting_charge'),
            func.sum(WorkingPeriod.jcb_charge).label('jcb_charge'),
            func.sum(WorkingPeriod.cutting_wheel).label('cutting_wheel'),
            func.sum(WorkingPeriod.mess_expense).label('mess_expense'),
            func.sum(WorkingPeriod.other_expense).label('other_expense')
        ).filter(WorkingPeriod.quarry == q_name).filter(WorkingPeriod.id.in_(matching_ids)).first()
        
        if not res or res.working_days is None:
            return {
                'working_days': 0, 'labourers': 0, 'expense': 0.0, 'revenue': 0.0,
                'net_value': 0.0, 'received': 0.0, 'outstanding': 0.0,
                'breakdown': {
                    'labour_pay': 0.0, 'diesel_expense': 0.0, 'spare_parts': 0.0,
                    'fitting_charge': 0.0, 'jcb_charge': 0.0, 'cutting_wheel': 0.0,
                    'mess_expense': 0.0, 'other_expense': 0.0
                }
            }
            
        return {
            'working_days': int(res.working_days or 0),
            'labourers': int(res.labourers or 0),
            'expense': float(res.expense or 0.0),
            'revenue': float(res.revenue or 0.0),
            'net_value': float(res.net_value or 0.0),
            'received': float(res.received or 0.0),
            'outstanding': float(res.outstanding or 0.0),
            'breakdown': {
                'labour_pay': float(res.labour_pay or 0.0),
                'diesel_expense': float(res.diesel_expense or 0.0),
                'spare_parts': float(res.spare_parts or 0.0),
                'fitting_charge': float(res.fitting_charge or 0.0),
                'jcb_charge': float(res.jcb_charge or 0.0),
                'cutting_wheel': float(res.cutting_wheel or 0.0),
                'mess_expense': float(res.mess_expense or 0.0),
                'other_expense': float(res.other_expense or 0.0)
            }
        }

    q1_summary = get_site_summary('Quarry 1', query)
    q2_summary = get_site_summary('Quarry 2', query)

    # Months query for filtered grouped bar chart
    matching_ids = [p.id for p in query.all()]
    months_labels = []
    bar_chart_datasets = []
    
    if matching_ids:
        months_query = db.session.query(
            func.strftime('%Y-%m', WorkingPeriod.day_from).label('month')
        ).filter(WorkingPeriod.id.in_(matching_ids)).distinct().order_by('month')
        months_labels = [m.month for m in months_query.all()]
        
        for q in ["Quarry 1", "Quarry 2"]:
            q_monthly = db.session.query(
                func.strftime('%Y-%m', WorkingPeriod.day_from).label('month'),
                func.sum(WorkingPeriod.net_value).label('net_value')
            ).filter(WorkingPeriod.quarry == q).filter(WorkingPeriod.id.in_(matching_ids)).group_by('month').all()
            
            monthly_map = {m.month: float(m.net_value or 0.0) for m in q_monthly}
            
            net_value_data = []
            for m in months_labels:
                net_value_data.append(monthly_map.get(m, 0.0))
                
            bar_chart_datasets.append({
                'quarry': q,
                'net_value': net_value_data
            })

    return jsonify({
        'kpis': {
            'Quarry 1': {
                'total_working_days': q1_summary['working_days'],
                'total_labourers': q1_summary['labourers'],
                'total_expense': q1_summary['expense'],
                'total_revenue': q1_summary['revenue'],
                'net_value': q1_summary['net_value'],
                'received_amount': q1_summary['received'],
                'balance_outstanding': q1_summary['outstanding']
            },
            'Quarry 2': {
                'total_working_days': q2_summary['working_days'],
                'total_labourers': q2_summary['labourers'],
                'total_expense': q2_summary['expense'],
                'total_revenue': q2_summary['revenue'],
                'net_value': q2_summary['net_value'],
                'received_amount': q2_summary['received'],
                'balance_outstanding': q2_summary['outstanding']
            }
        },
        'expenses_breakdown': {
            'Quarry 1': q1_summary['breakdown'],
            'Quarry 2': q2_summary['breakdown']
        },
        'monthly_grouped_bar': {
            'labels': months_labels,
            'datasets': bar_chart_datasets
        }
    })
