from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class WorkingPeriod(db.Model):
    __tablename__ = 'working_periods'

    id = db.Column(db.Integer, primary_key=True)
    quarry = db.Column(db.String(50), nullable=False)  # "Quarry 1" or "Quarry 2"
    day_from = db.Column(db.Date, nullable=False)
    day_to = db.Column(db.Date, nullable=False)
    working_days = db.Column(db.Integer, nullable=False)
    num_labourers = db.Column(db.Integer, nullable=False, default=0)

    # Expenses
    labour_pay = db.Column(db.Float, nullable=False, default=0.0)
    diesel_expense = db.Column(db.Float, nullable=False, default=0.0)
    spare_parts = db.Column(db.Float, nullable=False, default=0.0)
    fitting_charge = db.Column(db.Float, nullable=False, default=0.0)
    jcb_charge = db.Column(db.Float, nullable=False, default=0.0)
    cutting_wheel = db.Column(db.Float, nullable=False, default=0.0)
    mess_expense = db.Column(db.Float, nullable=False, default=0.0)
    other_expense = db.Column(db.Float, nullable=False, default=0.0)
    total_expense = db.Column(db.Float, nullable=False, default=0.0)

    # Production
    first_quality_bricks = db.Column(db.Integer, nullable=False, default=0)
    second_quality_bricks = db.Column(db.Integer, nullable=False, default=0)
    broken_bricks_loads = db.Column(db.Integer, nullable=False, default=0)

    # Financial derived
    total_revenue = db.Column(db.Float, nullable=False, default=0.0)
    land_lease_value = db.Column(db.Float, nullable=False, default=0.0)
    net_value = db.Column(db.Float, nullable=False, default=0.0)
    received_amount = db.Column(db.Float, nullable=False, default=0.0)
    balance_outstanding = db.Column(db.Float, nullable=False, default=0.0)

    # Metadata
    source_file = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<WorkingPeriod {self.id} | {self.quarry} ({self.day_from} to {self.day_to})>"


class ImportLog(db.Model):
    __tablename__ = 'import_logs'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    quarry = db.Column(db.String(50), nullable=False)
    rows_imported = db.Column(db.Integer, nullable=False, default=0)
    rows_skipped = db.Column(db.Integer, nullable=False, default=0)
    imported_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    notes = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f"<ImportLog {self.id} | {self.filename} ({self.imported_at})>"


class ActivityLog(db.Model):
    __tablename__ = 'activity_logs'

    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(50), nullable=False)  # CREATE, UPDATE, DELETE, IMPORT
    details = db.Column(db.String(500), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<ActivityLog {self.id} | {self.action} ({self.timestamp})>"

