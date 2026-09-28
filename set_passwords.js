const https = require('https');

const API_URL = "https://gtumath-db-default-rtdb.europe-west1.firebasedatabase.app/gizli_yol_gtu_admin_data.json";

function fetchDB() {
    return new Promise((resolve, reject) => {
        https.get(API_URL, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        }).on('error', reject);
    });
}

function updateDB(data) {
    return new Promise((resolve, reject) => {
        const req = https.request(API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve());
        });
        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
    });
}

// Türkçe karakterleri çevirme fonksiyonu
function normalizeString(str) {
    const map = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'i': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'C', 'Ğ': 'G', 'İ': 'I', 'I': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'
    };
    return str.replace(/[çğıiöşüÇĞİIÖŞÜ]/g, m => map[m]).toLowerCase();
}

async function run() {
    try {
        const db = await fetchDB();
        if (!db || !db.staff) {
            console.log("DB veya staff tablosu bulunamadı.");
            return;
        }

        const passwords = [];
        db.staff.forEach(s => {
            // İsimden ilk kelimeyi alıp İngilizce karakterlere çeviriyoruz ve sonuna 123 ekliyoruz.
            // Örn: "Prof. Dr. Ahmet Yılmaz" -> "ahmet123"
            let firstName = s.name.split(' ').find(w => !w.includes('.') && w.length > 2) || s.name.split(' ')[0];
            firstName = normalizeString(firstName).replace(/[^a-z]/g, '');
            
            // Eğer isminden bir kelime çıkaramadıysa Gtu + ID kullanalım
            if (!firstName) firstName = 'gtu';

            const generatedPassword = firstName + "123";
            s.staffPassword = generatedPassword;
            passwords.push(`${s.name} : ${generatedPassword}`);
        });

        await updateDB(db);
        console.log("Şifreler başarıyla Firebase veritabanına kaydedildi.");
        console.log("Oluşturulan Şifreler:\n" + passwords.join('\n'));

    } catch (e) {
        console.error("Hata:", e);
    }
}

run();
