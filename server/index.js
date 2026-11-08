'use strict';
// const Sentry = require('@sentry/node'); // Uncomment after running: npm install @sentry/node @sentry/profiling-node
// const { nodeProfilingIntegration } = require('@sentry/profiling-node');
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Sentry before any routes or middleware
/* // Uncomment to enable Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 1.0, profilesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'production'
  });
}
*/

for (const dir of ['data', 'logs', 'backups', 'exports']) {
  const p = path.join(__dirname, '..', dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/reports', require('./routes/reports'));
app.use('/api/rates', require('./routes/rates'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/export', require('./routes/export'));
app.use('/api/daily', require('./routes/daily'));
app.use('/api/settings', require('./routes/settings'));

// Sentry Error Handler must be before any other error middleware
/* // Uncomment to enable Sentry
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}
*/

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // if (process.env.SENTRY_DSN) Sentry.captureException(reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // if (process.env.SENTRY_DSN) Sentry.captureException(err);
  // process.exit(1);
});

const database = db.init();
app.locals.db = database;

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\nQuarry Report Manager is running.`);
  console.log(`Open your browser at: http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop the server.`);
});