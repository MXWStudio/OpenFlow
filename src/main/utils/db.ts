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
    db.run(
      `CREATE TABLE IF NOT EXISTS game_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_name TEXT NOT NULL,
        image_path TEXT NOT NULL,
        aliases TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => {
        if (err) {
          console.error('Error creating game_mappings table', err.message);
        }
      }
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS excel_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        saved_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => {
        if (err) {
          console.error('Error creating excel_files table', err.message);
        }
      }
    );
  }
});

export function getImportedData(batchId?: string): Promise<any[]> {
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
          rows.map((row: any) => ({
            ...row,
            row_data: JSON.parse(row.row_data),
          }))
        );
      }
    });
  });
}

// --- Excel Files Mappings ---

export interface ExcelFileRecord {
  id?: number;
  batch_id: string;
  file_name: string;
  saved_path: string;
  created_at?: string;
}

export function getExcelFiles(): Promise<ExcelFileRecord[]> {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM excel_files ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as ExcelFileRecord[]);
      }
    });
  });
}

export function insertExcelFile(file: Omit<ExcelFileRecord, 'id' | 'created_at'>): Promise<number> {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO excel_files (batch_id, file_name, saved_path) VALUES (?, ?, ?)`;
    db.run(sql, [file.batch_id, file.file_name, file.saved_path], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

export function deleteExcelFile(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM excel_files WHERE id = ?`;
    db.run(sql, [id], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function clearAllExcelFiles(): Promise<void> {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM excel_files`;
    db.run(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// --- Game Mappings ---

export interface GameMapping {
  id?: number;
  game_name: string;
  image_path: string;
  aliases: string[];
}

export function getGameMappings(): Promise<GameMapping[]> {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM game_mappings ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(
          rows.map((row: any) => ({
            id: row.id,
            game_name: row.game_name,
            image_path: row.image_path,
            aliases: JSON.parse(row.aliases),
          }))
        );
      }
    });
  });
}

export function insertGameMapping(mapping: Omit<GameMapping, 'id'>): Promise<number> {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO game_mappings (game_name, image_path, aliases) VALUES (?, ?, ?)`;
    db.run(sql, [mapping.game_name, mapping.image_path, JSON.stringify(mapping.aliases)], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

export function updateGameMapping(id: number, mapping: Partial<GameMapping>): Promise<void> {
  return new Promise((resolve, reject) => {
    const fields: string[] = [];
    const values: any[] = [];
    if (mapping.game_name !== undefined) {
      fields.push(`game_name = ?`);
      values.push(mapping.game_name);
    }
    if (mapping.image_path !== undefined) {
      fields.push(`image_path = ?`);
      values.push(mapping.image_path);
    }
    if (mapping.aliases !== undefined) {
      fields.push(`aliases = ?`);
      values.push(JSON.stringify(mapping.aliases));
    }
    if (fields.length === 0) {
      resolve();
      return;
    }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    const sql = `UPDATE game_mappings SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    db.run(sql, values, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function deleteGameMapping(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM game_mappings WHERE id = ?`;
    db.run(sql, [id], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
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
