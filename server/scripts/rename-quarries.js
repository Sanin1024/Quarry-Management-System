'use strict';
const dbModule = require('../db');
const db = dbModule.init();

// Rename Quarry 1
const r1 = db.prepare("UPDATE quarries SET name = 'Quarry 1' WHERE id = 1").run();
console.log(`Renamed ID 1 to 'Quarry 1' (Rows affected: ${r1.changes})`);

// Rename Quarry 2
const r2 = db.prepare("UPDATE quarries SET name = 'Quarry 2' WHERE id = 2").run();
console.log(`Renamed ID 2 to 'Quarry 2' (Rows affected: ${r2.changes})`);

db.close();