import sqlite3 from 'sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs-extra';

const isDev = !app.isPackaged;
const dbDir = isDev
  ? path.join(__dirname, '../../data')
  : path.join(app.getPath('userData'), 'database');

fs.ensureDirSync(dbDir);
const dbPath = path.join(dbDir, 'productivity.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    db.run(
      `CREATE TABLE IF NOT EXISTS imported_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL,
        row_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => {
        if (err) {
          console.error('Error creating table', err.message);
        }
      }
    );
  }
});

export interface DbImportedDataRow {
  id: number;
  batch_id: string;
  row_data: string;
  created_at: string;
  updated_at: string;
}

export interface ImportedData {
  id: number;
  batch_id: string;
  row_data: unknown;
  created_at: string;
  updated_at: string;
}

export function getImportedData(batchId?: string): Promise<ImportedData[]> {
  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM imported_data`;
    const params: any[] = [];
    if (batchId) {
      sql += ` WHERE batch_id = ?`;
      params.push(batchId);
    }
    sql += ` ORDER BY created_at DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(
          rows.map((row: unknown) => {
            const r = row as DbImportedDataRow;
            return {
              ...r,
              row_data: JSON.parse(r.row_data),
            };
          })
        );
      }
    });
  });
}

export function insertImportedData(batchId: string, rowData: any): Promise<number> {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO imported_data (batch_id, row_data) VALUES (?, ?)`;
    db.run(sql, [batchId, JSON.stringify(rowData)], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

export function updateImportedData(id: number, rowData: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE imported_data SET row_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [JSON.stringify(rowData), id], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function deleteImportedData(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM imported_data WHERE id = ?`;
    db.run(sql, [id], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function deleteBatch(batchId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM imported_data WHERE batch_id = ?`;
    db.run(sql, [batchId], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function clearAllImportedData(): Promise<void> {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM imported_data`;
    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
