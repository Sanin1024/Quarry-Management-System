import os
from datetime import datetime, date
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from models import db, WorkingPeriod, ImportLog, ActivityLog
from excel_import import preview_excel

import_bp = Blueprint('import', __name__)

def serialize_log(log):
    return {
        'id': log.id,
        'filename': log.filename,
        'quarry': log.quarry,
        'rows_imported': log.rows_imported,
        'rows_skipped': log.rows_skipped,
        'imported_at': log.imported_at.isoformat() if log.imported_at else None,
        'notes': log.notes
    }

# POST /api/import/preview
@import_bp.route('/preview', methods=['POST'])
def import_preview():
    if 'file' not in request.files:
        return jsonify({'errors': ['No file part in the request.']}), 400
        
    file = request.files['file']
    quarry = request.form.get('quarry')
    
    if not quarry or quarry not in ["Quarry 1", "Quarry 2"]:
        return jsonify({'errors': ["quarry is required and must be 'Quarry 1' or 'Quarry 2'"]}), 400

    if file.filename == '':
        return jsonify({'errors': ['No selected file.']}), 400

    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        return jsonify({'errors': ['Invalid file format. Only Excel files (.xlsx, .xls) are supported.']}), 400

    # Ensure upload directory exists
    upload_dir = os.path.join(current_app.root_path, 'uploads')
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)

    # Save file
    filename = secure_filename(f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename}")
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    # Run preview
    try:
        report = preview_excel(filepath, quarry)
        report['filename'] = filename  # Include filename for confirm step
        return jsonify(report)
    except Exception as e:
        # Clean up file on error
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'errors': [f"Excel parsing failed: {str(e)}"]}), 500

# POST /api/import/confirm
@import_bp.route('/confirm', methods=['POST'])
def import_confirm():
    data = request.get_json() or {}
    filename = data.get('filename')
    quarry = data.get('quarry')
    row_indices = data.get('row_indices')  # List of indices to import, if None default to all valid
    
    if not filename:
        return jsonify({'errors': ['filename is required']}), 400
    if not quarry or quarry not in ["Quarry 1", "Quarry 2"]:
        return jsonify({'errors': ["quarry is required and must be 'Quarry 1' or 'Quarry 2'"]}), 400

    upload_dir = os.path.join(current_app.root_path, 'uploads')
    filepath = os.path.join(upload_dir, filename)
    
    if not os.path.exists(filepath):
        return jsonify({'errors': ['The uploaded file was not found. Please upload it again.']}), 404

    # Reparse file
    try:
        report = preview_excel(filepath, quarry)
    except Exception as e:
        return jsonify({'errors': [f"Excel re-parsing failed: {str(e)}"]}), 500

    rows = report['rows']
    
    # Filter rows based on indices or validity
    import_rows = []
    skipped_count = 0
    
    for row in rows:
        idx = row['index']
        is_valid = row['_valid']
        
        should_import = False
        if row_indices is not None:
            if idx in row_indices:
                should_import = True
            else:
                skipped_count += 1
        else:
            if is_valid:
                should_import = True
            else:
                skipped_count += 1
                
        if should_import:
            import_rows.append(row)

    # Insert WorkingPeriod records
    imported_count = 0
    
    for r in import_rows:
        day_from = date.fromisoformat(r['day_from']) if r.get('day_from') else None
        day_to = date.fromisoformat(r['day_to']) if r.get('day_to') else None
        
        p = WorkingPeriod(
            quarry=quarry,
            day_from=day_from,
            day_to=day_to,
            working_days=r['working_days'],
            num_labourers=r['num_labourers'],
            labour_pay=r['labour_pay'],
            diesel_expense=r['diesel_expense'],
            spare_parts=r['spare_parts'],
            fitting_charge=r['fitting_charge'],
            jcb_charge=r['jcb_charge'],
            cutting_wheel=r['cutting_wheel'],
            mess_expense=r['mess_expense'],
            other_expense=r['other_expense'],
            total_expense=r['total_expense'],
            first_quality_bricks=r['first_quality_bricks'],
            second_quality_bricks=r['second_quality_bricks'],
            broken_bricks_loads=r['broken_bricks_loads'],
            total_revenue=r['total_revenue'],
            land_lease_value=r['land_lease_value'],
            net_value=r['net_value'],
            received_amount=r['received_amount'],
            balance_outstanding=r['balance_outstanding'],
            source_file=filename
        )
        db.session.add(p)
        imported_count += 1

    # Create ImportLog entry
    notes = f"Imported {imported_count} rows, skipped {skipped_count} rows from workbook."
    log = ImportLog(
        filename=filename,
        quarry=quarry,
        rows_imported=imported_count,
        rows_skipped=skipped_count,
        notes=notes
    )
    db.session.add(log)
    
    # Log activity
    act_log = ActivityLog(
        action="IMPORT",
        details=f"Imported {imported_count} records to {quarry} from Excel file {filename}"
    )
    db.session.add(act_log)
    db.session.commit()

    # Clean up temporary file
    try:
        os.remove(filepath)
    except Exception:
        pass

    return jsonify({
        'status': 'success',
        'imported_count': imported_count,
        'skipped_count': skipped_count,
        'log': serialize_log(log)
    })

# GET /api/import/history
@import_bp.route('/history', methods=['GET'])
def import_history():
    logs = ImportLog.query.order_by(ImportLog.imported_at.desc()).all()
    return jsonify([serialize_log(l) for l in logs])
