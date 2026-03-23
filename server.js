const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { initDB, getFullDB, saveFullDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Statik Dosyalar (Frontend)
app.use(express.static(path.join(__dirname, '.')));

// Veritabanını başlat
initDB();

// --- API Uç Noktaları ---

// Tüm veriyi çek
app.get('/api/db', async (req, res) => {
    try {
        const dbData = await getFullDB();
        res.json(dbData);
    } catch (err) {
        console.error("GET /api/db Hatası:", err);
        res.status(500).json({ error: "Veri çekilemedi" });
    }
});

// Tüm veriyi güncelle (Kaydet)
app.post('/api/save', async (req, res) => {
    try {
        const incomingData = req.body;
        if (!incomingData || !incomingData.staff) {
            return res.status(400).json({ error: "Geçersiz veri formatı" });
        }
        
        await saveFullDB(incomingData);
        res.json({ success: true, message: "Veriler SQLite'a kaydedildi." });
    } catch (err) {
        console.error("POST /api/save Hatası:", err);
        res.status(500).json({ error: "Veriler kaydedilemedi" });
    }
});

// Ana sayfa yönlendirmesi
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Sunucuyu başlat
app.listen(PORT, '0.0.0.0', () => {
    console.log(`-----------------------------------------`);
    console.log(`Gözetmenlik Sistemi Sunucusu Hazır!`);
    console.log(`Yerel Erişim: http://localhost:${PORT}`);
    console.log(`-----------------------------------------`);
});
