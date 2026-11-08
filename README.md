# Quarry-Management-System (Quarry Weekly Report Manager)

A complete, secure, offline-first web application for managing weekly production, expenses, and revenue for brick-making mining quarries. Built with Node.js, Express, and SQLite (`better-sqlite3`), it features exact integer-paise math, multi-quarry analytics with Chart.js, Excel/CSV exports, automated backups, recycle bin recovery, and WCAG accessibility compliance.

## Requirements
- Windows 10 / 11 (or Linux / macOS)
- [Node.js 20 LTS](https://nodejs.org/) or Node.js 22
- Modern Browser (Chrome or Edge)

## First-Time Installation
1. Ensure Node.js is installed. Verify by running `node -v`.
2. Double-click `install.bat` OR open PowerShell/terminal in this folder and run:
   ```bash
   npm install
   ```

## Starting the Application
1. Double-click `start.bat` OR run:
   ```bash
   npm start
   ```
2. Your browser will automatically open to `http://localhost:3000`.
3. To stop the server, press `Ctrl+C` in the terminal.

## Core Features
- **Multi-Quarry Analytics:** Toggle seamlessly between individual quarries and aggregated combined performance.
- **Dynamic Dashboard:** Live Chart.js visualizations for revenue vs. expenses, net margins, brick production, and historical rate trends.
- **Weekly Reports CRUD:** Full lifecycle management of weekly reports with live client-side calculations and server-side validation.
- **Daily Logs:** Log daily production counts and expenses that aggregate into weekly reports.
- **Rate Management:** Temporal rate tracking with snapshotting to preserve historical integrity.
- **Recycle Bin:** 30-day soft-delete protection with one-click restoration.
- **Excel & CSV Export:** Clean formatted financial exports with automated sum formulas.
- **Automated Backups:** Hot database snapshots via `node server/scripts/backup.js` or `backup.bat`.
- **Accessibility & UX:** Full keyboard navigation, screen reader ARIA labels, and responsive layout for mobile and desktop viewports.

## Testing
Run the native Node.js test suite:
```bash
npm test
```
