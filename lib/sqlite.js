import fs from 'fs';
import path from 'path';

const isBun = typeof Bun !== 'undefined';

let _Database;
if (isBun) {
  _Database = (await import('bun:sqlite')).Database;
} else {
  _Database = (await import('better-sqlite3')).default;
}

export function getDB(dbPath) {
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = isBun ? new _Database(dbPath, { create: true }) : new _Database(dbPath);

  if (isBun) {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA synchronous = NORMAL');
    db.exec('PRAGMA busy_timeout = 5000');
  } else {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
  }

  if (!isBun) {
    const origPrepare = db.prepare.bind(db);
    db.query = (sql) => {
      const stmt = origPrepare(sql);
      return {
        all: (...a) => stmt.all(...a),
        get: (...a) => stmt.get(...a),
        run: (...a) => stmt.run(...a),
      };
    };
  }

  return db;
}
