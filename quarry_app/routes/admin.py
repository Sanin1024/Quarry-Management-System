import os
import shutil
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from models import db, ActivityLog

admin_bp = Blueprint('admin', __name__)

def get_db_path():
    uri = current_app.config['SQLALCHEMY_DATABASE_URI']
    # Handle both absolute and relative paths
    return os.path.abspath(uri.replace('sqlite:///', ''))

# POST /api/admin/backup
@admin_bp.route('/backup', methods=['POST'])
def db_backup():
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return jsonify({'errors': ['Active database file not found.']}), 404

    backup_dir = os.path.join(current_app.root_path, 'backups')
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)

    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    backup_filename = f"backup_{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_filename)

    try:
        shutil.copy2(db_path, backup_path)
        
        # Log this admin activity
        log = ActivityLog(
            action="CREATE",
            details=f"Created database backup: {backup_filename}"
        )
        db.session.add(log)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'filename': backup_filename,
            'timestamp': timestamp,
            'size_bytes': os.path.getsize(backup_path)
        })
    except Exception as e:
        return jsonify({'errors': [f"Database backup failed: {str(e)}"]}), 500

# GET /api/admin/backups
@admin_bp.route('/backups', methods=['GET'])
def list_backups():
    backup_dir = os.path.join(current_app.root_path, 'backups')
    if not os.path.exists(backup_dir):
        return jsonify([])

    backups = []
    for f in os.listdir(backup_dir):
        if f.endswith('.db') and f.startswith('backup_'):
            f_path = os.path.join(backup_dir, f)
            stat = os.stat(f_path)
            # Try parsing timestamp from filename e.g. backup_20260628143200.db
            try:
                ts_str = f.replace('backup_', '').replace('.db', '')
                dt = datetime.strptime(ts_str, '%Y%m%d%H%M%S')
                created_at = dt.isoformat()
            except Exception:
                created_at = datetime.fromtimestamp(stat.st_ctime).isoformat()
                
            backups.append({
                'filename': f,
                'size_bytes': stat.st_size,
                'created_at': created_at
            })
            
    # Sort backups, most recent first
    backups.sort(key=lambda x: x['filename'], reverse=True)
    return jsonify(backups)

# POST /api/admin/restore
@admin_bp.route('/restore', methods=['POST'])
def db_restore():
    data = request.get_json() or {}
    filename = data.get('filename')
    if not filename:
        return jsonify({'errors': ['filename is required']}), 400

    backup_dir = os.path.join(current_app.root_path, 'backups')
    backup_path = os.path.join(backup_dir, filename)

    if not os.path.exists(backup_path):
        return jsonify({'errors': [f"Backup file '{filename}' not found."]}), 404

    db_path = get_db_path()
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    safety_filename = f"safety_before_restore_{timestamp}.db"
    safety_path = os.path.join(backup_dir, safety_filename)

    try:
        # 1. Close current connections and remove session to prevent locking errors on Windows
        db.session.remove()
        db.engine.dispose()

        # 2. Copy current active database to safety backup
        if os.path.exists(db_path):
            shutil.copy2(db_path, safety_path)

        # 3. Replace current database with chosen backup
        shutil.copy2(backup_path, db_path)
        
        # 4. Log the restore activity
        log = ActivityLog(
            action="UPDATE",
            details=f"Restored database from backup file {filename}. Safety backup created: {safety_filename}"
        )
        db.session.add(log)
        db.session.commit()

        return jsonify({
            'status': 'success',
            'restored_from': filename,
            'safety_backup': safety_filename
        })
    except Exception as e:
        return jsonify({'errors': [f"Database restore failed: {str(e)}"]}), 500

# GET /api/admin/activity-log
@admin_bp.route('/activity-log', methods=['GET'])
def get_activity_log():
    try:
        limit = int(request.args.get('limit', 50))
        if limit < 1:
            raise ValueError()
    except ValueError:
        return jsonify({'errors': ['limit must be a positive integer']}), 400

    logs = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).limit(limit).all()
    
    return jsonify([{
        'id': l.id,
        'action': l.action,
        'details': l.details,
        'timestamp': l.timestamp.isoformat()
    } for l in logs])
