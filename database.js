const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

function initDB() {
    db.serialize(() => {
        // Personel Tablosu
        db.run(`CREATE TABLE IF NOT EXISTS staff (
            id INTEGER PRIMARY KEY,
            name TEXT,
            email TEXT,
            totalScore REAL,
            taskCount INTEGER
        )`);

        // Sınavlar Tablosu (proctors JSON olarak saklanır)
        db.run(`CREATE TABLE IF NOT EXISTS exams (
            id REAL PRIMARY KEY,
            name TEXT,
            type TEXT,
            location TEXT,
            date TEXT,
            time TEXT,
            duration INTEGER,
            score REAL,
            katsayi REAL,
            proctors TEXT
        )`);

        // Talepler Tablosu
        db.run(`CREATE TABLE IF NOT EXISTS requests (
            id REAL PRIMARY KEY,
            examId REAL,
            initiatorId INTEGER,
            initiatorName TEXT,
            receiverId INTEGER,
            receiverName TEXT,
            status TEXT,
            createdAt TEXT,
            resolvedAt TEXT,
            examName TEXT,
            examDate TEXT,
            examTime TEXT
        )`);

        // Ayarlar ve Diğer Veriler (constraints, templates, announcement vb.)
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`);

        console.log("Veritabanı tabloları hazır.");
    });
}

/**
 * Tüm veriyi bir kerede çekmek için (Frontend DB nesnesi oluşturmak üzere)
 */
async function getFullDB() {
    return new Promise((resolve, reject) => {
        const fullDB = {
            staff: [],
            exams: [],
            requests: [],
            constraints: {},
            announcement: "",
            templates: {},
            version: 36
        };

        db.all("SELECT * FROM staff", [], (err, rows) => {
            if (err) return reject(err);
            fullDB.staff = rows;

            db.all("SELECT * FROM exams", [], (err, rows) => {
                if (err) return reject(err);
                fullDB.exams = rows.map(r => ({ ...r, proctors: JSON.parse(r.proctors || '[]') }));

                db.all("SELECT * FROM requests", [], (err, rows) => {
                    if (err) return reject(err);
                    fullDB.requests = rows;

                    db.all("SELECT * FROM settings", [], (err, rows) => {
                        if (err) return reject(err);
                        rows.forEach(r => {
                            if (r.key === 'constraints' || r.key === 'templates') {
                                fullDB[r.key] = JSON.parse(r.value);
                            } else {
                                fullDB[r.key] = r.value;
                            }
                        });
                        resolve(fullDB);
                    });
                });
            });
        });
    });
}

/**
 * Frontend'den gelen toplu DB nesnesini SQLite'a kaydetmek için (Migration için)
 */
async function saveFullDB(incoming) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            // Personel temizle ve ekle
            db.run("DELETE FROM staff");
            const staffStmt = db.prepare("INSERT INTO staff (id, name, email, totalScore, taskCount) VALUES (?, ?, ?, ?, ?)");
            incoming.staff.forEach(s => staffStmt.run(s.id, s.name, s.email, s.totalScore, s.taskCount));
            staffStmt.finalize();

            // Sınavlar temizle ve ekle
            db.run("DELETE FROM exams");
            const examStmt = db.prepare("INSERT INTO exams (id, name, type, location, date, time, duration, score, katsayi, proctors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            incoming.exams.forEach(e => examStmt.run(e.id, e.name, e.type, e.location, e.date, e.time, e.duration, e.score, e.katsayi, JSON.stringify(e.proctors)));
            examStmt.finalize();

            // Talepler temizle ve ekle
            db.run("DELETE FROM requests");
            const reqStmt = db.prepare("INSERT INTO requests (id, examId, initiatorId, initiatorName, receiverId, receiverName, status, createdAt, resolvedAt, examName, examDate, examTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            (incoming.requests || []).forEach(r => reqStmt.run(r.id, r.examId, r.initiatorId, r.initiatorName, r.receiverId, r.receiverName, r.status, r.createdAt, r.resolvedAt, r.examName, r.examDate, r.examTime));
            reqStmt.finalize();

            // Ayarlar temizle ve ekle
            db.run("DELETE FROM settings");
            const setStmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
            setStmt.run('constraints', JSON.stringify(incoming.constraints || {}));
            setStmt.run('templates', JSON.stringify(incoming.templates || {}));
            setStmt.run('announcement', incoming.announcement || "");
            setStmt.run('version', String(incoming.version || 36));
            setStmt.finalize();

            db.run("COMMIT", (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

module.exports = { initDB, getFullDB, saveFullDB, db };
