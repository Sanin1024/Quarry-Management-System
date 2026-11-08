'use strict';
const path = require('path');
const fs = require('fs');
const dbModule = require('../db');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');

async function runBackup() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  
  const db = dbModule.open();
  const ts = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
  const backupPath = path.join(BACKUP_DIR, `quarry_backup_${ts}.db`);
  
  await db.backup(backupPath);
  console.log(`Backup created successfully at: ${backupPath}`);
  
  // Cleanup old backups (keep latest 30)
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db')).map(f => ({
    name: f,
    path: path.join(BACKUP_DIR, f),
    time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
  })).sort((a, b) => b.time - a.time);

  if (files.length > 30) {
    for (let i = 30; i < files.length; i++) {
      fs.unlinkSync(files[i].path);
      console.log(`Deleted old backup: ${files[i].name}`);
    }
  }
  
  db.close();
}

runBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});