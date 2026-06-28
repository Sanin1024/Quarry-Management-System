import os
from flask import Flask, render_template, send_from_directory
from models import db

def create_app(test_config=None):
    """Factory to create and configure the Flask app."""
    app = Flask(__name__, instance_relative_config=True)

    # Absolute paths
    base_dir = os.path.abspath(os.path.dirname(__file__))
    db_path = os.path.join(base_dir, 'database.db')
    uploads_dir = os.path.join(base_dir, 'uploads')
    backups_dir = os.path.join(base_dir, 'backups')
    for d in (uploads_dir, backups_dir):
        os.makedirs(d, exist_ok=True)

    app.config.from_mapping(
        SECRET_KEY='quarry-tracker-local-dev-secret',
        SQLALCHEMY_DATABASE_URI=f'sqlite:///{db_path}',
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    if test_config is not None:
        app.config.from_mapping(test_config)

    # Initialise DB
    db.init_app(app)
    with app.app_context():
        db.create_all()

    # Register API blueprints (unchanged)
    from routes.periods import periods_bp
    from routes.import_routes import import_bp
    from routes.analytics import analytics_bp
    from routes.reports import reports_bp
    from routes.admin import admin_bp
    app.register_blueprint(periods_bp, url_prefix='/api/periods')
    app.register_blueprint(import_bp, url_prefix='/api/import')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    # Health check
    @app.route('/status')
    def status():
        return {
            'status': 'online',
            'app': 'Quarry Tracker',
            'database': 'SQLite'
        }

    # Clean page routes using templates
    @app.route('/')
    def dashboard():
        return render_template('dashboard.html')

    @app.route('/quarry1')
    def quarry1():
        return render_template('quarry1.html')

    @app.route('/quarry2')
    def quarry2():
        return render_template('quarry2.html')

    @app.route('/add-entry')
    def add_entry():
        return render_template('add_entry.html')

    @app.route('/period/<int:id>')
    def period_detail(id):
        # id is currently unused; template shows details based on query string
        return render_template('detail1.html')

    @app.route('/import')
    def import_page():
        return render_template('import.html')

    @app.route('/compare')
    def compare():
        return render_template('comparison.html')

    @app.route('/reports')
    def reports():
        return render_template('reports.html')

    # Serve static assets – Flask's default static folder (quarry_app/static) handles CSS/JS/images.
    # No generic catch‑all route – unknown files will result in 404.

    return app

if __name__ == '__main__':
    app = create_app()
    print("Starting Quarry Tracker web app at http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
