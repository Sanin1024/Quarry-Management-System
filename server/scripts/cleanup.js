'use strict';
const dbModule = require('../db');
const db = dbModule.init();
db.exec('DELETE FROM weekly_reports;');
console.log('Cleared weekly_reports table. Ready for re-import.');
db.close();