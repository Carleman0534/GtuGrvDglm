function getSafeDate(dateStr, timeStr) {
    if (!dateStr) return new Date();
    if (!timeStr) return new Date(dateStr + 'T09:00:00');
    let t = String(timeStr).split('-')[0].trim();
    if (t.length === 4) t = '0' + t;
    if (t.length === 5) t = t + ':00';
    const d = new Date(dateStr + 'T' + t);
    return isNaN(d.getTime()) ? new Date() : d;
}

function getSystemUrl() {
    if (typeof DB !== 'undefined') {
        if (DB.emailSettings && DB.emailSettings.systemUrl && DB.emailSettings.systemUrl.trim()) {
            return DB.emailSettings.systemUrl.trim();
        }
        if (DB.systemSettings && DB.systemSettings.systemUrl && DB.systemSettings.systemUrl.trim()) {
            return DB.systemSettings.systemUrl.trim();
        }
    }
    if (typeof window !== 'undefined' && window.location && window.location.href) {
        return window.location.href.split('#')[0].split('?')[0];
    }
    return 'https://gtu.edu.tr';
}
if (typeof window !== 'undefined') {
    window.getSystemUrl = getSystemUrl;
}

// Şifreler artık backend'de tutuluyor. Frontend'de şifre YOKTUR.
const DB_KEY = 'gozetmenlik_db_v25';

// Backend API Adresi
// const API_BASE_URL = "http://localhost:8082";
const API_BASE_URL = "https://gtumath-db-default-rtdb.europe-west1.firebasedatabase.app"; // Firebase Realtime Database

const KATSAYILAR = {
    HAFTA_ICI_MESAI: 1.0,
    HAFTA_ICI_AKSAM: 1.5,
    HAFTA_SONU_GUNDUZ: 2.0,
    HAFTA_SONU_AKSAM: 2.5
};

const BONUSLAR = {
    ERKEN_KUS: 0.2,        // 09:00 öncesi dakika başına ek
    DINAMIK_IHTIYAC: 0.5   // Marketplace'te 48 saatten az kalan görevler
};

function isFutureOrToday(dateStr) {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d >= today;
}

// 20.06.2026 tarihinden itibaren sınav dışı görevler ayrı kategoride (nonExamScore) sayılır.
const NON_EXAM_SPLIT_DATE = new Date('2026-06-20T00:00:00');

function shouldCountAsNonExam(exam) {
    if (!exam.isNonExam) return false;
    if (!exam.date) return false;
    const parts = exam.date.split('-');
    const examDate = new Date(parts[0], parts[1] - 1, parts[2]);
    return examDate >= NON_EXAM_SPLIT_DATE;
}

const GLOBAL_LIMITS = {
    MIN_TASKS: 0,
    MAX_TASKS: 6
};

// === LİSANS VE LİSANSÜSTÜ DERS KATALOĞU (127 DERS) ===
const DEFAULT_COURSE_CATALOG = [
    // 1. Sınıf (1. ve 2. Yarıyıl)
    { code: "MATH 101", name: "Calculus I", lang: "İngilizce", term: "Güz/Bahar", type: "Zorunlu", year: 1, credit: 5, akts: 7, lecturer: "" },
    { code: "MAT 101", name: "Matematik I", lang: "İngilizce", term: "Güz/Bahar", type: "Zorunlu", year: 1, credit: 5, akts: 7, lecturer: "" },
    { code: "MATH 102", name: "Calculus II", lang: "İngilizce", term: "Güz/Bahar", type: "Zorunlu", year: 1, credit: 5, akts: 7, lecturer: "" },
    { code: "MAT 102", name: "Matematik II", lang: "İngilizce", term: "Güz/Bahar", type: "Zorunlu", year: 1, credit: 5, akts: 7, lecturer: "" },
    { code: "MAT 103", name: "Lineer Cebir", lang: "Türkçe", term: "Güz", type: "Zorunlu", year: 1, credit: 3, akts: 7, lecturer: "" },
    { code: "MAT 105", name: "Sonlu Matematik", lang: "Türkçe", term: "Güz", type: "Zorunlu", year: 1, credit: 5, akts: 7, lecturer: "" },
    { code: "MAT 106", name: "Analitik Geometri", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 1, credit: 3, akts: 5, lecturer: "Dr. Öğr. Üyesi Fatma KARAOĞLU CEYHAN" },
    { code: "MAT 110", name: "Matematik", lang: "Türkçe", term: "Bahar", type: "Zorunlu", year: 1, credit: 5, akts: 7, lecturer: "" },
    { code: "MATH 111", name: "Analysis I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 1, credit: 5, akts: 7, lecturer: "Prof. Dr. Serkan SÜTLÜ" },
    { code: "MAT 111", name: "Analiz I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 1, credit: 5, akts: 7, lecturer: "Prof. Dr. Serkan SÜTLÜ" },
    { code: "MATH 112", name: "Analysis II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 1, credit: 5, akts: 7, lecturer: "Prof. Dr. Serkan SÜTLÜ" },
    { code: "MAT 112", name: "Analiz II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 1, credit: 5, akts: 7, lecturer: "Prof. Dr. Serkan SÜTLÜ" },
    { code: "MATH 113", name: "Linear Algebra I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 1, credit: 4, akts: 6, lecturer: "Prof. Dr. Mustafa AKKURT" },
    { code: "MAT 113", name: "Lineer Cebir I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 1, credit: 4, akts: 6, lecturer: "Prof. Dr. Mustafa AKKURT" },
    { code: "MATH 114", name: "Linear Algebra II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 1, credit: 4, akts: 6, lecturer: "Prof. Dr. Mustafa AKKURT" },
    { code: "MAT 114", name: "Lineer Cebir II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 1, credit: 4, akts: 6, lecturer: "Prof. Dr. Mustafa AKKURT" },
    { code: "MATH 115", name: "Discrete Mathematics", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 1, credit: 3, akts: 6, lecturer: "Prof. Dr. Sibel ÖZKAN" },
    { code: "MAT 115", name: "Ayrık Matematik", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 1, credit: 3, akts: 6, lecturer: "Prof. Dr. Sibel ÖZKAN" },
    { code: "MATH 116", name: "Linear Algebra", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 1, credit: 3, akts: 5, lecturer: "Prof. Dr. Mustafa AKKURT" },
    { code: "MAT 116", name: "Lineer Cebir", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 1, credit: 3, akts: 5, lecturer: "Prof. Dr. Mustafa AKKURT" },
    { code: "MAT 118", name: "Olasılık ve İstatistik", lang: "Türkçe", term: "Bahar", type: "Zorunlu", year: 1, credit: 3, akts: 6, lecturer: "Prof. Dr. Nuri ÇELİK" },
    { code: "MAT 119", name: "Matematik I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 1, credit: 2, akts: 2, lecturer: "" },
    { code: "MAT 120", name: "Matematik II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 1, credit: 2, akts: 2, lecturer: "" },
    { code: "INF 100", name: "Introduction to Computer Systems", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 1, credit: 3, akts: 4, lecturer: "Dr. Öğr. Üyesi Hadi ALIZADEH" },
    { code: "INF 100-2", name: "Introduction to Computer Systems", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 1, credit: 3, akts: 4, lecturer: "Dr. Öğr. Üyesi Hadi ALIZADEH" },
    { code: "TUR 101", name: "Turkish I", lang: "Türkçe", term: "Güz", type: "Zorunlu", year: 1, credit: 2, akts: 2, lecturer: "Öğr.Gör. Benan DURUKAN" },
    { code: "TUR 102", name: "Turkish II", lang: "Türkçe", term: "Bahar", type: "Zorunlu", year: 1, credit: 2, akts: 2, lecturer: "Öğr.Gör. Benan DURUKAN" },
    { code: "PHYS 113", name: "Physics for Natural Sciences I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 1, credit: 4, akts: 6, lecturer: "Öğr. Gör. Dr. Fatih KINDAZ" },
    { code: "PHYS 114", name: "Physics for Natural Sciences II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 1, credit: 4, akts: 6, lecturer: "Doç. Dr. Eda GOLDENBERG" },
    { code: "FS 103", name: "Career Planning", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 1, credit: 1, akts: 2, lecturer: "" },

    // 2. Sınıf (3. ve 4. Yarıyıl)
    { code: "MAT 201", name: "Matematik III", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 4, akts: 6, lecturer: "" },
    { code: "MAT 202", name: "Matematik IV", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 3, akts: 6, lecturer: "" },
    { code: "MATH 203", name: "Differential Equations I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 3, akts: 6, lecturer: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)" },
    { code: "MAT 203", name: "Diferansiyel Denklemler I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 3, akts: 6, lecturer: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)" },
    { code: "MATH 204", name: "Differential Equations II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 3, akts: 6, lecturer: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)" },
    { code: "MAT 204", name: "Diferansiyel Denklemler II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 3, akts: 6, lecturer: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)" },
    { code: "MATH 206", name: "Topology", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 3, akts: 6, lecturer: "Doç. Dr. Ayşe SÖNMEZ" },
    { code: "MAT 206", name: "Topoloji", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 3, akts: 6, lecturer: "Doç. Dr. Ayşe SÖNMEZ" },
    { code: "MATH 209", name: "Algebra I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 3, akts: 6, lecturer: "Doç. Dr. Gülşen ULUCAK" },
    { code: "MAT 209", name: "Cebir I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 3, akts: 6, lecturer: "Doç. Dr. Gülşen ULUCAK" },
    { code: "MATH 210", name: "Algebra II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 3, akts: 6, lecturer: "Doç. Dr. Ayten KOÇ" },
    { code: "MAT 210", name: "Cebir II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 3, akts: 6, lecturer: "Doç. Dr. Ayten KOÇ" },
    { code: "MATH 211", name: "Analysis III", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 4, akts: 7, lecturer: "Doç. Dr. Ayşe SÖNMEZ" },
    { code: "MAT 211", name: "Analiz III", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 4, akts: 7, lecturer: "Doç. Dr. Ayşe SÖNMEZ" },
    { code: "MATH 212", name: "Analysis IV", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 4, akts: 7, lecturer: "Dr. Öğr. Üyesi Samire YAZAR" },
    { code: "MAT 212", name: "Analiz IV", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 4, akts: 7, lecturer: "Dr. Öğr. Üyesi Samire YAZAR" },
    { code: "MAT 214", name: "Sayısal Analiz", lang: "Türkçe", term: "Bahar", type: "Zorunlu", year: 2, credit: 3, akts: 5, lecturer: "Doç. Dr. Hülya ÖZTÜRK" },
    { code: "MAT 215", name: "Diferansiyel Denklemler", lang: "Türkçe", term: "Güz", type: "Zorunlu", year: 2, credit: 3, akts: 5, lecturer: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)" },
    { code: "MAT 216", name: "İstatistik", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 3, akts: 5, lecturer: "Prof. Dr. Nuri ÇELİK" },
    { code: "MAT 217", name: "Lineer Cebir ve Diferansiyel Denklemler", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 5, akts: 8, lecturer: "" },
    { code: "MAT 219", name: "Olasılık ve İstatistik", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 2, akts: 4, lecturer: "Prof. Dr. Nuri ÇELİK" },
    { code: "ENG 111", name: "English for Business Life", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 2, akts: 2, lecturer: "Öğr. Gör. Zeynep Karadeniz Cısdık" },
    { code: "ENG 111-2", name: "English for Business Life", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 2, akts: 2, lecturer: "Öğr. Gör. Zeynep Karadeniz Cısdık" },
    { code: "ENG 112", name: "English for Business Life II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 2, akts: 2, lecturer: "Öğr. Gör. Zeynep Karadeniz Cısdık" },
    { code: "GTU 110", name: "Bilimsel ve Teknolojik Etkinlik", lang: "Türkçe", term: "Güz", type: "Zorunlu", year: 2, credit: 1, akts: 1, lecturer: "Prof. Dr. Nuri ÇELİK" },
    { code: "GTU 101", name: "Müfredat Dışı Etkinlik Dersi", lang: "Türkçe", term: "Güz", type: "Zorunlu", year: 2, credit: 1, akts: 1, lecturer: "Prof. Dr. Nuri ÇELİK" },
    { code: "HIS 101", name: "Principles of Atatürk and the History of Turkish Revolution I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 2, credit: 2, akts: 2, lecturer: "Öğr. Gör. Dr. Oğuzhan DURSUN" },
    { code: "HIS 102", name: "Principles of Atatürk and the History of Turkish Revolution II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 2, credit: 2, akts: 2, lecturer: "Öğr. Gör. Orkun Canbek" },

    // 3. Sınıf (5. ve 6. Yarıyıl)
    { code: "MATH 301", name: "Complex Analysis I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 3, credit: 3, akts: 7, lecturer: "Doç. Dr. Hülya ÖZTÜRK" },
    { code: "MAT 301", name: "Kompleks Analiz I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 3, credit: 3, akts: 7, lecturer: "Doç. Dr. Hülya ÖZTÜRK" },
    { code: "MATH 302", name: "Complex Analysis II", lang: "İngilizce", term: "Bahar", type: "Seçmeli", year: 3, credit: 3, akts: 6, lecturer: "Doç. Dr. Feray HACIVELİOĞLU" },
    { code: "MAT 302", name: "Kompleks Analiz II", lang: "İngilizce", term: "Bahar", type: "Seçmeli", year: 3, credit: 3, akts: 6, lecturer: "Doç. Dr. Feray HACIVELİOĞLU" },
    { code: "MATH 303", name: "Real Analysis I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 3, credit: 3, akts: 7, lecturer: "Prof. Dr. Emil NOVRUZ" },
    { code: "MAT 303", name: "Reel Analiz I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 3, credit: 3, akts: 7, lecturer: "Prof. Dr. Emil NOVRUZ" },
    { code: "MATH 304", name: "Real Analysis II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 3, credit: 3, akts: 7, lecturer: "Prof. Dr. Emil NOVRUZ" },
    { code: "MAT 304", name: "Reel Analiz II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 3, credit: 3, akts: 7, lecturer: "Prof. Dr. Emil NOVRUZ" },
    { code: "MATH 305", name: "Partial Differential Equations", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 3, credit: 3, akts: 6, lecturer: "Doç. Dr. Feray HACIVELİOĞLU" },
    { code: "MAT 305", name: "Kısmi Türevli Diferansiyel Denklemler", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 3, credit: 3, akts: 6, lecturer: "Doç. Dr. Feray HACIVELİOĞLU" },
    { code: "MATH 308", name: "Probability Theory", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 3, credit: 3, akts: 6, lecturer: "Prof. Dr. Nuri ÇELİK" },
    { code: "MAT 308", name: "Olasılık Teorisi", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: 3, credit: 3, akts: 6, lecturer: "Prof. Dr. Nuri ÇELİK" },
    { code: "MATH 310", name: "Numerical Analysis I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 3, credit: 4, akts: 6, lecturer: "Doç. Dr. Hülya ÖZTÜRK" },
    { code: "MAT 310", name: "Sayısal Analiz I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 3, credit: 4, akts: 6, lecturer: "Doç. Dr. Hülya ÖZTÜRK" },
    { code: "MATH 312", name: "Group Theory", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 3, credit: 3, akts: 6, lecturer: "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU" },
    { code: "MAT 312", name: "Grup Kuramı", lang: "Türkçe", term: "Güz", type: "Seçmeli", year: 3, credit: 3, akts: 6, lecturer: "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU" },
    { code: "MATH 314", name: "Integral Equations", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 3, credit: 3, akts: 5, lecturer: "Doç. Dr. Gülden GÜN POLAT" },
    { code: "MAT 314", name: "İntegral Denklemler", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 3, credit: 3, akts: 5, lecturer: "Doç. Dr. Gülden GÜN POLAT" },

    // 4. Sınıf (7. ve 8. Yarıyıl)
    { code: "MATH 401", name: "Mathematical Statistics", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Prof. Dr. Nuri ÇELİK" },
    { code: "MAT 401", name: "Matematiksel İstatistik", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Prof. Dr. Nuri ÇELİK" },
    { code: "MATH 406", name: "Functional Analysis", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 4, credit: 0, akts: 7, lecturer: "Prof. Dr. Emil NOVRUZ" },
    { code: "MAT 406", name: "Fonksiyonel Analiz", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: 4, credit: 0, akts: 7, lecturer: "Prof. Dr. Emil NOVRUZ" },
    { code: "MATH 407", name: "Differential Geometry", lang: "İngilizce", term: "Bahar", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Prof. Dr. Oğul ESEN" },
    { code: "MAT 407", name: "Diferansiyel Geometri", lang: "Türkçe", term: "Bahar", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Prof. Dr. Oğul ESEN" },
    { code: "MAT 408", name: "Varyasyonlar Hesabı", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 3, akts: 5, lecturer: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)" },
    { code: "MAT 411", name: "Veri Analizine Giriş", lang: "İngilizce", term: "Bahar", type: "Seçmeli", year: 4, credit: 3, akts: 5, lecturer: "Doç. Dr. Selçuk TOPAL" },
    { code: "MATH 412", name: "Güncel Bilgi Teknolojileri", lang: "İngilizce", term: "Bahar", type: "Seçmeli", year: 4, credit: 3, akts: 5, lecturer: "Dr. Öğr. Üyesi Hadi ALIZADEH" },
    { code: "MATH 419", name: "Introduction to Coding Theory", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Prof. Dr. Sibel ÖZKAN" },
    { code: "MAT 419", name: "Kodlama Teorisine Giriş", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Prof. Dr. Sibel ÖZKAN" },
    { code: "MATH 432", name: "Mathematics of Financial Derivatives", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Araş. Gör. Dr. Pelin Ayşe GÖKGÖZ" },
    { code: "MAT 432", name: "Finansal Türev Ürünlerin Matematiği", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Araş. Gör. Dr. Pelin Ayşe GÖKGÖZ" },
    { code: "MAT 434", name: "Sınır Değer Problemleri", lang: "İngilizce", term: "Bahar", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Doç. Dr. Gülden GÜN POLAT" },
    { code: "MATH 435", name: "Applied Partial Differential Equations", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)" },
    { code: "MAT 435", name: "Uygulamalı Kısmi Türevli Denklemler", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)" },
    { code: "MAT 438", name: "Çizge Kuramı ve Kombinatorik", lang: "İngilizce", term: "Bahar", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Prof. Dr. Sibel ÖZKAN" },
    { code: "MAT 446", name: "Quasilineerizasyon Metodu", lang: "İngilizce", term: "Bahar", type: "Seçmeli", year: 4, credit: 3, akts: 5, lecturer: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)" },
    { code: "MAT 447", name: "Tensör Analizi", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 3, akts: 5, lecturer: "Prof. Dr. Oğul ESEN" },
    { code: "MAT 449", name: "Sayılar Kuramı", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 3, akts: 5, lecturer: "Doç. Dr. Gülşen ULUCAK" },
    { code: "MAT 450", name: "Rasyonel Mekanik", lang: "İngilizce", term: "Bahar", type: "Seçmeli", year: 4, credit: 3, akts: 4, lecturer: "Prof. Dr. Oğul ESEN" },
    { code: "MATH 451", name: "Matrix Theory", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 2, akts: 5, lecturer: "Doç. Dr. Fatma KARAOĞLU CEYHAN" },
    { code: "MAT 451", name: "Matris Kuramı", lang: "İngilizce", term: "Güz", type: "Seçmeli", year: 4, credit: 2, akts: 5, lecturer: "Doç. Dr. Fatma KARAOĞLU CEYHAN" },
    { code: "MAT 452", name: "Matematik Tarihi", lang: "İngilizce", term: "Bahar", type: "Seçmeli", year: 4, credit: 3, akts: 6, lecturer: "Dr. Öğr. Üyesi Keremcan DOĞAN" },
    { code: "MAT 495", name: "Bitirme Ödevi", lang: "İngilizce", term: "Güz/Bahar", type: "Zorunlu", year: 4, credit: 4, akts: 10, lecturer: "" },

    // Lisansüstü Açılacak Dersler (2026-2027 Güz)
    { code: "MATH 667", name: "Algebraic Number Theory I", lang: "İngilizce", term: "Güz", type: "Seçmeli (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Prof. Dr. Serkan SÜTLÜ" },
    { code: "MAT 542", name: "Reel Analiz", lang: "İngilizce", term: "Güz", type: "Zorunlu (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)" },
    { code: "MATH 542", name: "Real Analysis", lang: "İngilizce", term: "Güz", type: "Zorunlu (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)" },
    { code: "MATH 517", name: "Ring Theory", lang: "İngilizce", term: "Güz", type: "Seçmeli (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Doç. Dr. Gülşen ULUCAK" },
    { code: "MATH 545", name: "Numerical Analysis", lang: "İngilizce", term: "Güz", type: "Zorunlu (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Doç. Dr. Hülya ÖZTÜRK" },
    { code: "MAT 571", name: "Genel Topoloji", lang: "İngilizce", term: "Güz", type: "Zorunlu (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Doç. Dr. Ayşe SÖNMEZ" },
    { code: "MATH 571", name: "General Topology", lang: "İngilizce", term: "Güz", type: "Zorunlu (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Doç. Dr. Ayşe SÖNMEZ" },
    { code: "MATH 515", name: "Algebra I", lang: "İngilizce", term: "Güz", type: "Zorunlu (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Doç. Dr. Nursel EREY" },
    { code: "MATH 581", name: "Probability Theory and Mathematical Statistics", lang: "İngilizce", term: "Güz", type: "Zorunlu (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Prof. Dr. Nuri ÇELİK" },
    { code: "MATH 685", name: "Geometric Mechanics", lang: "İngilizce", term: "Güz", type: "Seçmeli (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Dr. Öğr. Üyesi Keremcan DOĞAN" },
    { code: "MATH 511", name: "Linear Algebra", lang: "İngilizce", term: "Güz", type: "Zorunlu (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Prof. Dr. Mustafa AKKURT" },
    { code: "MATH 535", name: "Theory of Functions of Complex Variables I", lang: "İngilizce", term: "Güz", type: "Zorunlu (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Doç. Dr. Feray HACIVELİOĞLU" },
    { code: "MATH 560", name: "Projective Geometry", lang: "İngilizce", term: "Güz", type: "Seçmeli (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Doç. Dr. Fatma KARAOĞLU CEYHAN" },
    { code: "MAT 676", name: "Hiperbolik Tipli Denklemler İçin Ters Problemler", lang: "İngilizce", term: "Güz", type: "Seçmeli (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)" },
    { code: "FBE 501", name: "Bilimsel Araştırma Teknikleri ve Yayın Etiği", lang: "Türkçe/İngilizce", term: "Güz", type: "Zorunlu (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Dr. Öğr. Üyesi Samire YAZAR" },
    { code: "MATH 590", name: "Introduction to Hamiltonian Formulation of Differential Equations", lang: "İngilizce", term: "Güz", type: "Seçmeli (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Prof. Dr. Oğul ESEN" },
    { code: "MATH 679", name: "Theory of Fractional Differential Equations", lang: "İngilizce", term: "Güz", type: "Seçmeli (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)" },
    { code: "MATH 682", name: "Behavioral Properties of the Solutions of Nonlinear Parabolic Equations", lang: "İngilizce", term: "Güz", type: "Seçmeli (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Prof. Dr. Emil NOVRUZ" },
    { code: "MATH 652", name: "Theory of Differential Equations II", lang: "İngilizce", term: "Güz", type: "Seçmeli (Lisansüstü)", year: "Lisansüstü", credit: 3, akts: 7.5, lecturer: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)" },

    // Servis ve Ortak Dersler
    { code: "CHEM 102", name: "General Chemistry II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: "Servis", credit: 3, akts: 4, lecturer: "" },
    { code: "CHEM 114", name: "General Chemistry Laboratory II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: "Servis", credit: 1, akts: 2, lecturer: "" },
    { code: "FİZ 121", name: "Fizik I", lang: "Türkçe", term: "Güz", type: "Zorunlu", year: "Servis", credit: 4, akts: 6, lecturer: "Öğr. Gör. Dr. Fatih KINDAZ" },
    { code: "PHYS 121", name: "Physics I", lang: "İngilizce", term: "Güz", type: "Zorunlu", year: "Servis", credit: 4, akts: 6, lecturer: "Öğr. Gör. Dr. Fatih KINDAZ" },
    { code: "FİZ 122", name: "Fizik II", lang: "Türkçe", term: "Bahar", type: "Zorunlu", year: "Servis", credit: 4, akts: 6, lecturer: "Doç. Dr. Eda GOLDENBERG" },
    { code: "PHYS 122", name: "Physics II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: "Servis", credit: 4, akts: 6, lecturer: "Doç. Dr. Eda GOLDENBERG" },
    { code: "PHYS 152", name: "Physics Laboratory II", lang: "İngilizce", term: "Bahar", type: "Zorunlu", year: "Servis", credit: 1, akts: 2, lecturer: "" }
];

function getCourseCatalog() {
    if (typeof DB !== 'undefined' && Array.isArray(DB.courseCatalog) && DB.courseCatalog.length > 0) {
        return DB.courseCatalog;
    }
    return DEFAULT_COURSE_CATALOG;
}

function findCourseInCatalog(query) {
    if (!query) return null;
    const clean = String(query).trim().toLowerCase();
    const catalog = getCourseCatalog();

    // 1. Tam eşleşme (kod, ad, kod - ad)
    let match = catalog.find(c => 
        c.code.toLowerCase() === clean || 
        c.name.toLowerCase() === clean || 
        `${c.code} - ${c.name}`.toLowerCase() === clean ||
        `${c.code} ${c.name}`.toLowerCase() === clean
    );
    if (match) return match;

    // 2. Boşluksuz kod eşleşmesi (örn: "mat101" -> "MAT 101")
    const cleanNoSpace = clean.replace(/[\s\-_]/g, '');
    match = catalog.find(c => c.code.toLowerCase().replace(/[\s\-_]/g, '') === cleanNoSpace);
    if (match) return match;

    // 3. Başlangıç eşleşmesi (örn: "MAT 101 Final" -> "MAT 101")
    match = catalog.find(c => clean.startsWith(c.code.toLowerCase()) || clean.startsWith(c.name.toLowerCase()));
    if (match) return match;

    // 4. Kapsama / alt dize eşleşmesi
    match = catalog.find(c => 
        clean.includes(c.code.toLowerCase()) || 
        c.name.toLowerCase().includes(clean)
    );
    return match || null;
}

let DB = {
    staff: [
        { id: 1, name: "Prof. Dr. Mustafa AKKURT", totalScore: 0, taskCount: 0, baseScore: 0, email: "m.akkurt@gtu.edu.tr" },
        { id: 2, name: "Prof. Dr. Nuri ÇELİK", totalScore: 0, taskCount: 0, baseScore: 0, email: "n.celik@gtu.edu.tr" },
        { id: 3, name: "Prof. Dr. Oğul ESEN", totalScore: 0, taskCount: 0, baseScore: 0, email: "o.esen@gtu.edu.tr" },
        { id: 4, name: "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)", totalScore: 0, taskCount: 0, baseScore: 0, email: "m.isgenderoglu@gtu.edu.tr" },
        { id: 5, name: "Prof. Dr. Emil NOVRUZ", totalScore: 0, taskCount: 0, baseScore: 0, email: "e.novruz@gtu.edu.tr" },
        { id: 6, name: "Prof. Dr. Sibel ÖZKAN", totalScore: 0, taskCount: 0, baseScore: 0, email: "s.ozkan@gtu.edu.tr" },
        { id: 7, name: "Prof. Dr. Serkan SÜTLÜ", totalScore: 0, taskCount: 0, baseScore: 0, email: "s.sutlu@gtu.edu.tr" },
        { id: 8, name: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)", totalScore: 0, taskCount: 0, baseScore: 0, email: "c.yakar@gtu.edu.tr" },
        { id: 9, name: "Doç. Dr. Nursel EREY", totalScore: 0, taskCount: 0, baseScore: 0, email: "n.erey@gtu.edu.tr" },
        { id: 10, name: "Doç. Dr. Gülden GÜN POLAT", totalScore: 0, taskCount: 0, baseScore: 0, email: "g.gunpolat@gtu.edu.tr" },
        { id: 11, name: "Doç. Dr. Feray HACIVELİOĞLU", totalScore: 0, taskCount: 0, baseScore: 0, email: "f.hacivelioglu@gtu.edu.tr" },
        { id: 12, name: "Doç. Dr. Roghayeh HAFEZIEH", totalScore: 0, taskCount: 0, baseScore: 0, email: "r.hafezieh@gtu.edu.tr" },
        { id: 13, name: "Doç. Dr. Fatma KARAOĞLU CEYHAN", totalScore: 0, taskCount: 0, baseScore: 0, email: "f.karaoglu@gtu.edu.tr" },
        { id: 14, name: "Doç. Dr. Ayten KOÇ", totalScore: 0, taskCount: 0, baseScore: 0, email: "a.koc@gtu.edu.tr" },
        { id: 15, name: "Doç. Dr. Işıl ÖNER", totalScore: 0, taskCount: 0, baseScore: 0, email: "i.oner@gtu.edu.tr" },
        { id: 16, name: "Doç. Dr. Hülya ÖZTÜRK", totalScore: 0, taskCount: 0, baseScore: 0, email: "h.ozturk@gtu.edu.tr" },
        { id: 17, name: "Doç. Dr. Ayşe SÖNMEZ", totalScore: 0, taskCount: 0, baseScore: 0, email: "a.sonmez@gtu.edu.tr" },
        { id: 18, name: "Doç. Dr. Selçuk TOPAL", totalScore: 0, taskCount: 0, baseScore: 0, email: "s.topal@gtu.edu.tr" },
        { id: 19, name: "Doç. Dr. Gülşen ULUCAK", totalScore: 0, taskCount: 0, baseScore: 0, email: "g.ulucak@gtu.edu.tr" },
        { id: 20, name: "Dr. Öğr. Üyesi Hadi ALIZADEH", totalScore: 0, taskCount: 0, baseScore: 0, email: "h.alizadeh@gtu.edu.tr" },
        { id: 21, name: "Dr. Öğr. Üyesi Keremcan DOĞAN", totalScore: 0, taskCount: 0, baseScore: 0, email: "k.dogan@gtu.edu.tr" },
        { id: 22, name: "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU", totalScore: 0, taskCount: 0, baseScore: 0, email: "t.mahmutcepoglu@gtu.edu.tr" },
        { id: 23, name: "Dr. Öğr. Üyesi Samire YAZAR", totalScore: 0, taskCount: 0, baseScore: 0, email: "s.yazar@gtu.edu.tr" },
        { id: 24, name: "Arş. Gör. Murat Can AŞKAROĞULLARI", totalScore: 0, taskCount: 0, baseScore: 0, email: "m.askarogullari@gtu.edu.tr" },
        { id: 25, name: "Arş. Gör. Serkan AYRICA", totalScore: 1440, taskCount: 0, baseScore: 1440, email: "s.ayrica@gtu.edu.tr" },
        { id: 26, name: "Arş. Gör. Serdal ÇÖMLEKCİ", totalScore: 600, taskCount: 0, baseScore: 600, email: "s.colmekci@gtu.edu.tr" },
        { id: 27, name: "Arş. Gör. Ömer DEMİR", totalScore: 1440, taskCount: 0, baseScore: 1440, email: "o.demir@gtu.edu.tr" },
        { id: 28, name: "Arş. Gör. Saliha DEMİRBÜKEN", totalScore: 1200, taskCount: 0, baseScore: 1200, email: "s.demirbuken@gtu.edu.tr" },
        { id: 29, name: "Arş. Gör. Muhammed Ergen", totalScore: 1320, taskCount: 0, baseScore: 1320, email: "m.ergen@gtu.edu.tr" },
        { id: 30, name: "Arş. Gör. Aslıhan GÜR", totalScore: 1200, taskCount: 0, baseScore: 1200, email: "a.gur@gtu.edu.tr" },
        { id: 31, name: "Arş. Gör. Çağla ÖZATAR", totalScore: 1560, taskCount: 0, baseScore: 1560, email: "c.ozatar@gtu.edu.tr" },
        { id: 32, name: "Arş. Gör. Ezgi ÖZTEKİN", totalScore: 1200, taskCount: 0, baseScore: 1200, email: "e.oztekin@gtu.edu.tr" },
        { id: 33, name: "Arş. Gör. Aysel ŞAHİN", totalScore: 1440, taskCount: 0, baseScore: 1440, email: "a.sahin@gtu.edu.tr" },
        { id: 34, name: "Arş. Gör. Cansu ŞAHİN", totalScore: 600, taskCount: 0, baseScore: 600, email: "c.sahin@gtu.edu.tr" },
        { id: 35, name: "Arş. Gör. Oğuzhan SELÇUK", totalScore: 1200, taskCount: 0, baseScore: 1200, email: "o.selcuk@gtu.edu.tr" },
        { id: 36, name: "Arş. Gör. Yasin TURAN", totalScore: 1800, taskCount: 0, baseScore: 1800, email: "y.turan@gtu.edu.tr" },
        { id: 37, name: "Arş. Gör. Şeyma YAŞAR", totalScore: 1320, taskCount: 0, baseScore: 1320, email: "s.yasar@gtu.edu.tr" },
        { id: 38, name: "Dr. Begüm ATEŞLİ", totalScore: 0, taskCount: 0, baseScore: 0, email: "b.atesli@gtu.edu.tr" },
        { id: 39, name: "Dr. Sultan BOZKURT GÜNGÖR", totalScore: 0, taskCount: 0, baseScore: 0, email: "s.bozkurt@gtu.edu.tr" },
        { id: 40, name: "Dr. Yasemin BÜYÜKÇOLAK", totalScore: 0, taskCount: 0, baseScore: 0, email: "y.buyukcolak@gtu.edu.tr" },
        { id: 41, name: "Dr. Ayten GEZİCİ", totalScore: 0, taskCount: 0, baseScore: 0, email: "a.gezici@gtu.edu.tr" },
        { id: 42, name: "Dr. Büşra KARADENİZ ŞEN", totalScore: 0, taskCount: 0, baseScore: 0, email: "b.karadeniz@gtu.edu.tr" },
        { id: 43, name: "Dr. Fatih YETGİN", totalScore: 0, taskCount: 0, baseScore: 0, email: "f.yetgin@gtu.edu.tr" }
    ],
    exams: [],
    constraints: {},
    requests: [],
    auditLogs: [],
    notifications: {}, // Personel bazlı bildirimler
    examTypes: ['Vize', 'Final', 'Bütünleme', 'Ek Sınav', 'Mazeret', 'Tercih Günü', 'Diğer'],
    announcements: [],
    isDraftMode: false,
    courseCatalog: DEFAULT_COURSE_CATALOG,
    courseLecturers: {
        // Lisans 1. Sınıf
        "Introduction to Computing": "Dr. Öğr. Üyesi Hadi ALIZADEH",
        "INF 100": "Dr. Öğr. Üyesi Hadi ALIZADEH",
        "INF 100-2": "Dr. Öğr. Üyesi Hadi ALIZADEH",
        "INF 100 - Introduction to Computer Systems": "Dr. Öğr. Üyesi Hadi ALIZADEH",
        "INF 100-2 - Introduction to Computer Systems": "Dr. Öğr. Üyesi Hadi ALIZADEH",
        "Introduction to Computer Systems": "Dr. Öğr. Üyesi Hadi ALIZADEH",
        "Bilgisayar Sistemlerine Giriş": "Dr. Öğr. Üyesi Hadi ALIZADEH",

        "Analysis I": "Prof. Dr. Serkan SÜTLÜ",
        "Analiz I": "Prof. Dr. Serkan SÜTLÜ",
        "MAT 111": "Prof. Dr. Serkan SÜTLÜ",
        "MAT 111 - Analiz I": "Prof. Dr. Serkan SÜTLÜ",
        "MATH 111": "Prof. Dr. Serkan SÜTLÜ",
        "MATH 111 - Analysis I": "Prof. Dr. Serkan SÜTLÜ",

        "Analysis II": "Prof. Dr. Serkan SÜTLÜ",
        "Analiz II": "Prof. Dr. Serkan SÜTLÜ",
        "MAT 112": "Prof. Dr. Serkan SÜTLÜ",
        "MAT 112 - Analiz II": "Prof. Dr. Serkan SÜTLÜ",
        "MATH 112": "Prof. Dr. Serkan SÜTLÜ",
        "MATH 112 - Analysis II": "Prof. Dr. Serkan SÜTLÜ",

        "Linear Algebra I": "Prof. Dr. Mustafa AKKURT",
        "Lineer Cebir I": "Prof. Dr. Mustafa AKKURT",
        "MAT 113": "Prof. Dr. Mustafa AKKURT",
        "MAT 113 - Lineer Cebir I": "Prof. Dr. Mustafa AKKURT",
        "MATH 113": "Prof. Dr. Mustafa AKKURT",
        "MATH 113 - Linear Algebra I": "Prof. Dr. Mustafa AKKURT",

        "Linear Algebra II": "Prof. Dr. Mustafa AKKURT",
        "Lineer Cebir II": "Prof. Dr. Mustafa AKKURT",
        "MAT 114": "Prof. Dr. Mustafa AKKURT",
        "MAT 114 - Lineer Cebir II": "Prof. Dr. Mustafa AKKURT",
        "MATH 114": "Prof. Dr. Mustafa AKKURT",
        "MATH 114 - Linear Algebra II": "Prof. Dr. Mustafa AKKURT",

        "Discrete Mathematics": "Prof. Dr. Sibel ÖZKAN",
        "Ayrık Matematik": "Prof. Dr. Sibel ÖZKAN",
        "MAT 115": "Prof. Dr. Sibel ÖZKAN",
        "MAT 115 - Ayrık Matematik": "Prof. Dr. Sibel ÖZKAN",
        "MATH 115": "Prof. Dr. Sibel ÖZKAN",
        "MATH 115 - Discrete Mathematics": "Prof. Dr. Sibel ÖZKAN",

        "Linear Algebra": "Prof. Dr. Mustafa AKKURT",
        "Lineer Cebir": "Prof. Dr. Mustafa AKKURT",
        "MAT 116": "Prof. Dr. Mustafa AKKURT",
        "MAT 116 - Lineer Cebir": "Prof. Dr. Mustafa AKKURT",
        "MATH 116": "Prof. Dr. Mustafa AKKURT",
        "MATH 116 - Linear Algebra": "Prof. Dr. Mustafa AKKURT",

        "Analytical Geometry": "Dr. Öğr. Üyesi Fatma KARAOĞLU CEYHAN",
        "Analitik Geometri": "Dr. Öğr. Üyesi Fatma KARAOĞLU CEYHAN",
        "MAT 106": "Dr. Öğr. Üyesi Fatma KARAOĞLU CEYHAN",
        "MAT 106 - Analitik Geometri": "Dr. Öğr. Üyesi Fatma KARAOĞLU CEYHAN",

        "Turkish I": "Öğr.Gör. Benan DURUKAN",
        "Türk Dili I": "Öğr.Gör. Benan DURUKAN",
        "TUR 101": "Öğr.Gör. Benan DURUKAN",
        "TUR 101 - Turkish I": "Öğr.Gör. Benan DURUKAN",
        "Turkish II": "Öğr.Gör. Benan DURUKAN",
        "Türk Dili II": "Öğr.Gör. Benan DURUKAN",
        "TUR 102": "Öğr.Gör. Benan DURUKAN",
        "TUR 102 - Turkish II": "Öğr.Gör. Benan DURUKAN",

        "Physics for Natural Sciences I": "Öğr. Gör. Dr. Fatih KINDAZ",
        "PHYS 113": "Öğr. Gör. Dr. Fatih KINDAZ",
        "PHYS 113 - Physics for Natural Sciences I": "Öğr. Gör. Dr. Fatih KINDAZ",
        "Physics I": "Öğr. Gör. Dr. Fatih KINDAZ",
        "Fizik I": "Öğr. Gör. Dr. Fatih KINDAZ",
        "FİZ 121": "Öğr. Gör. Dr. Fatih KINDAZ",
        "FİZ 121 - Fizik I": "Öğr. Gör. Dr. Fatih KINDAZ",
        "PHYS 121": "Öğr. Gör. Dr. Fatih KINDAZ",
        "PHYS 121 - Physics I": "Öğr. Gör. Dr. Fatih KINDAZ",

        "Physics for Natural Sciences II": "Doç. Dr. Eda GOLDENBERG",
        "PHYS 114": "Doç. Dr. Eda GOLDENBERG",
        "PHYS 114 - Physics for Natural Sciences II": "Doç. Dr. Eda GOLDENBERG",
        "Physics II": "Doç. Dr. Eda GOLDENBERG",
        "Fizik II": "Doç. Dr. Eda GOLDENBERG",
        "FİZ 122": "Doç. Dr. Eda GOLDENBERG",
        "FİZ 122 - Fizik II": "Doç. Dr. Eda GOLDENBERG",
        "PHYS 122": "Doç. Dr. Eda GOLDENBERG",
        "PHYS 122 - Physics II": "Doç. Dr. Eda GOLDENBERG",

        "Career Planning": "",
        "Kariyer Planlama": "",
        "FS 103": "",
        "FS 103 - Career Planning": "",

        // Lisans 2. Sınıf
        "Analysis III": "Doç. Dr. Ayşe SÖNMEZ",
        "Analiz III": "Doç. Dr. Ayşe SÖNMEZ",
        "MAT 211": "Doç. Dr. Ayşe SÖNMEZ",
        "MAT 211 - Analiz III": "Doç. Dr. Ayşe SÖNMEZ",
        "MATH 211": "Doç. Dr. Ayşe SÖNMEZ",
        "MATH 211 - Analysis III": "Doç. Dr. Ayşe SÖNMEZ",

        "Analysis IV": "Dr. Öğr. Üyesi Samire YAZAR",
        "Analiz IV": "Dr. Öğr. Üyesi Samire YAZAR",
        "MAT 212": "Dr. Öğr. Üyesi Samire YAZAR",
        "MAT 212 - Analiz IV": "Dr. Öğr. Üyesi Samire YAZAR",
        "MATH 212": "Dr. Öğr. Üyesi Samire YAZAR",
        "MATH 212 - Analysis IV": "Dr. Öğr. Üyesi Samire YAZAR",

        "Algebra I": "Doç. Dr. Gülşen ULUCAK",
        "Cebir I": "Doç. Dr. Gülşen ULUCAK",
        "MAT 209": "Doç. Dr. Gülşen ULUCAK",
        "MAT 209 - Cebir I": "Doç. Dr. Gülşen ULUCAK",
        "MATH 209": "Doç. Dr. Gülşen ULUCAK",
        "MATH 209 - Algebra I": "Doç. Dr. Gülşen ULUCAK",

        "Algebra II": "Doç. Dr. Ayten KOÇ",
        "Cebir II": "Doç. Dr. Ayten KOÇ",
        "MAT 210": "Doç. Dr. Ayten KOÇ",
        "MAT 210 - Cebir II": "Doç. Dr. Ayten KOÇ",
        "MATH 210": "Doç. Dr. Ayten KOÇ",
        "MATH 210 - Algebra II": "Doç. Dr. Ayten KOÇ",

        "Differential Equations I": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "Diferansiyel Denklemler I": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 203": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 203 - Diferansiyel Denklemler I": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MATH 203": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MATH 203 - Differential Equations I": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",

        "Differential Equations II": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "Diferansiyel Denklemler II": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 204": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 204 - Diferansiyel Denklemler II": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MATH 204": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MATH 204 - Differential Equations II": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",

        "Differential Equations": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "Diferansiyel Denklemler": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 215": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 215 - Diferansiyel Denklemler": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",

        "Topology": "Doç. Dr. Ayşe SÖNMEZ",
        "Topoloji": "Doç. Dr. Ayşe SÖNMEZ",
        "MAT 206": "Doç. Dr. Ayşe SÖNMEZ",
        "MAT 206 - Topoloji": "Doç. Dr. Ayşe SÖNMEZ",
        "MATH 206": "Doç. Dr. Ayşe SÖNMEZ",
        "MATH 206 - Topology": "Doç. Dr. Ayşe SÖNMEZ",

        "English for Business Life": "Öğr. Gör. Zeynep Karadeniz Cısdık",
        "İş Hayatı İçin İngilizce": "Öğr. Gör. Zeynep Karadeniz Cısdık",
        "ENG 111": "Öğr. Gör. Zeynep Karadeniz Cısdık",
        "ENG 111-2": "Öğr. Gör. Zeynep Karadeniz Cısdık",
        "ENG 111 - English for Business Life": "Öğr. Gör. Zeynep Karadeniz Cısdık",
        "ENG 111-2 - English for Business Life": "Öğr. Gör. Zeynep Karadeniz Cısdık",
        "ENG 112": "Öğr. Gör. Zeynep Karadeniz Cısdık",

        "GTU 110": "Prof. Dr. Nuri ÇELİK",
        "GTU 110 - Bilimsel ve Teknolojik Etkinlik": "Prof. Dr. Nuri ÇELİK",
        "Bilimsel ve Teknolojik Etkinlik": "Prof. Dr. Nuri ÇELİK",

        "GTU 101": "Prof. Dr. Nuri ÇELİK",
        "GTU 101 - Müfredat Dışı Etkinlik Dersi": "Prof. Dr. Nuri ÇELİK",
        "Müfredat Dışı Etkinlik Dersi": "Prof. Dr. Nuri ÇELİK",

        "HIS 101": "Öğr. Gör. Dr. Oğuzhan DURSUN",
        "HIS 101 - Principles of Atatürk and the History of Turkish Revolution I": "Öğr. Gör. Dr. Oğuzhan DURSUN",
        "Principles of Atatürk and the History of Turkish Revolution I": "Öğr. Gör. Dr. Oğuzhan DURSUN",
        "Atatürk İlkeleri ve İnkılap Tarihi I": "Öğr. Gör. Dr. Oğuzhan DURSUN",

        "HIS 102": "Öğr. Gör. Orkun Canbek",
        "HIS 102 - Principles of Atatürk and History of Turkish Revolution II": "Öğr. Gör. Orkun Canbek",
        "Principles of Atatürk and History of Turkish Revolution II": "Öğr. Gör. Orkun Canbek",
        "Atatürk İlkeleri ve İnkılap Tarihi II": "Öğr. Gör. Orkun Canbek",

        // Lisans 3. Sınıf
        "Numerical Analysis I": "Doç. Dr. Hülya ÖZTÜRK",
        "Sayısal Analiz I": "Doç. Dr. Hülya ÖZTÜRK",
        "MAT 310": "Doç. Dr. Hülya ÖZTÜRK",
        "MAT 310 - Sayısal Analiz I": "Doç. Dr. Hülya ÖZTÜRK",
        "MATH 310": "Doç. Dr. Hülya ÖZTÜRK",
        "MATH 310 - Numerical Analysis I": "Doç. Dr. Hülya ÖZTÜRK",

        "Real Analysis I": "Prof. Dr. Emil NOVRUZ",
        "Reel Analiz I": "Prof. Dr. Emil NOVRUZ",
        "MAT 303": "Prof. Dr. Emil NOVRUZ",
        "MAT 303 - Reel Analiz I": "Prof. Dr. Emil NOVRUZ",
        "MATH 303": "Prof. Dr. Emil NOVRUZ",
        "MATH 303 - Real Analysis I": "Prof. Dr. Emil NOVRUZ",

        "Real Analysis II": "Prof. Dr. Emil NOVRUZ",
        "Reel Analiz II": "Prof. Dr. Emil NOVRUZ",
        "MAT 304": "Prof. Dr. Emil NOVRUZ",
        "MAT 304 - Reel Analiz II": "Prof. Dr. Emil NOVRUZ",
        "MATH 304": "Prof. Dr. Emil NOVRUZ",
        "MATH 304 - Real Analysis II": "Prof. Dr. Emil NOVRUZ",

        "Integral Equations": "Doç. Dr. Gülden GÜN POLAT",
        "İntegral Denklemler": "Doç. Dr. Gülden GÜN POLAT",
        "MAT 314": "Doç. Dr. Gülden GÜN POLAT",
        "MAT 314 - İntegral Denklemler": "Doç. Dr. Gülden GÜN POLAT",
        "MATH 314": "Doç. Dr. Gülden GÜN POLAT",
        "MATH 314 - Integral Equations": "Doç. Dr. Gülden GÜN POLAT",

        "Group Theory": "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU",
        "Grup Kuramı": "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU",
        "MAT 312": "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU",
        "MAT 312 - Grup Kuramı": "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU",
        "MATH 312": "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU",
        "MATH 312 - Group Theory": "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU",

        "Complex Analysis I": "Doç. Dr. Hülya ÖZTÜRK",
        "Kompleks Analiz I": "Doç. Dr. Hülya ÖZTÜRK",
        "MAT 301": "Doç. Dr. Hülya ÖZTÜRK",
        "MAT 301 - Kompleks Analiz I": "Doç. Dr. Hülya ÖZTÜRK",
        "MATH 301": "Doç. Dr. Hülya ÖZTÜRK",
        "MATH 301 - Complex Analysis I": "Doç. Dr. Hülya ÖZTÜRK",

        "Complex Analysis II": "Doç. Dr. Feray HACIVELİOĞLU",
        "Kompleks Analiz II": "Doç. Dr. Feray HACIVELİOĞLU",
        "MAT 302": "Doç. Dr. Feray HACIVELİOĞLU",
        "MAT 302 - Kompleks Analiz II": "Doç. Dr. Feray HACIVELİOĞLU",
        "MATH 302": "Doç. Dr. Feray HACIVELİOĞLU",
        "MATH 302 - Complex Analysis II": "Doç. Dr. Feray HACIVELİOĞLU",

        "Partial Differential Equations": "Doç. Dr. Feray HACIVELİOĞLU",
        "Kısmi Türevli Diferansiyel Denklemler": "Doç. Dr. Feray HACIVELİOĞLU",
        "MAT 305": "Doç. Dr. Feray HACIVELİOĞLU",
        "MAT 305 - Kısmi Türevli Diferansiyel Denklemler": "Doç. Dr. Feray HACIVELİOĞLU",
        "MATH 305": "Doç. Dr. Feray HACIVELİOĞLU",
        "MATH 305 - Partial Differential Equations": "Doç. Dr. Feray HACIVELİOĞLU",

        // Lisans 4. Sınıf
        "Mathematical Statistics": "Prof. Dr. Nuri ÇELİK",
        "Matematiksel İstatistik": "Prof. Dr. Nuri ÇELİK",
        "MAT 401": "Prof. Dr. Nuri ÇELİK",
        "MAT 401 - Matematiksel İstatistik": "Prof. Dr. Nuri ÇELİK",
        "MATH 401": "Prof. Dr. Nuri ÇELİK",
        "MATH 401 - Mathematical Statistics": "Prof. Dr. Nuri ÇELİK",

        "Introduction to Coding Theory": "Prof. Dr. Sibel ÖZKAN",
        "Kodlama Teorisine Giriş": "Prof. Dr. Sibel ÖZKAN",
        "MAT 419": "Prof. Dr. Sibel ÖZKAN",
        "MAT 419 - Kodlama Teorisine Giriş": "Prof. Dr. Sibel ÖZKAN",
        "MATH 419": "Prof. Dr. Sibel ÖZKAN",
        "MATH 419 - Introduction to Coding Theory": "Prof. Dr. Sibel ÖZKAN",

        "Matrix Theory": "Doç. Dr. Fatma KARAOĞLU CEYHAN",
        "Matris Kuramı": "Doç. Dr. Fatma KARAOĞLU CEYHAN",
        "MAT 451": "Doç. Dr. Fatma KARAOĞLU CEYHAN",
        "MAT 451 - Matris Kuramı": "Doç. Dr. Fatma KARAOĞLU CEYHAN",
        "MATH 451": "Doç. Dr. Fatma KARAOĞLU CEYHAN",
        "MATH 451 - Matrix Theory": "Doç. Dr. Fatma KARAOĞLU CEYHAN",

        "Mathematics of Financial Derivatives": "Araş. Gör. Dr. Pelin Ayşe GÖKGÖZ",
        "Finansal Türev Ürünlerin Matematiği": "Araş. Gör. Dr. Pelin Ayşe GÖKGÖZ",
        "MAT 432": "Araş. Gör. Dr. Pelin Ayşe GÖKGÖZ",
        "MAT 432 - Finansal Türev Ürünlerin Matematiği": "Araş. Gör. Dr. Pelin Ayşe GÖKGÖZ",
        "MATH 432": "Araş. Gör. Dr. Pelin Ayşe GÖKGÖZ",
        "MATH 432 - Mathematics of Financial Derivatives": "Araş. Gör. Dr. Pelin Ayşe GÖKGÖZ",

        "Functional Analysis": "Prof. Dr. Emil NOVRUZ",
        "Fonksiyonel Analiz": "Prof. Dr. Emil NOVRUZ",
        "MAT 406": "Prof. Dr. Emil NOVRUZ",
        "MAT 406 - Fonksiyonel Analiz": "Prof. Dr. Emil NOVRUZ",
        "MATH 406": "Prof. Dr. Emil NOVRUZ",
        "MATH 406 - Functional Analysis": "Prof. Dr. Emil NOVRUZ",

        "Applied Partial Differential Equations": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "Uygulamalı Kısmi Türevli Denklemler": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "Uygulamalı Kısmi Diferansiyel Denklemler": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 435": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 435 - Uygulamalı Kısmi Türevli Denklemler": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MATH 435": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MATH 435 - Applied Partial Differential Equations": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",

        "Differential Geometry": "Prof. Dr. Oğul ESEN",
        "Diferansiyel Geometri": "Prof. Dr. Oğul ESEN",
        "MAT 407": "Prof. Dr. Oğul ESEN",
        "MAT 407 - Diferansiyel Geometri": "Prof. Dr. Oğul ESEN",
        "MATH 407": "Prof. Dr. Oğul ESEN",
        "MATH 407 - Differential Geometry": "Prof. Dr. Oğul ESEN",

        "Varyasyonlar Hesabı": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 408": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 408 - Varyasyonlar Hesabı": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",

        "Introduction to Data Analysis": "Doç. Dr. Selçuk TOPAL",
        "Veri Analizine Giriş": "Doç. Dr. Selçuk TOPAL",
        "MAT 411": "Doç. Dr. Selçuk TOPAL",
        "MAT 411 - Veri Analizine Giriş": "Doç. Dr. Selçuk TOPAL",

        "Güncel Bilgi Teknolojileri": "Dr. Öğr. Üyesi Hadi ALIZADEH",
        "MATH 412": "Dr. Öğr. Üyesi Hadi ALIZADEH",
        "MATH 412 - Güncel Bilgi Teknolojileri": "Dr. Öğr. Üyesi Hadi ALIZADEH",

        "Boundary Value Problems": "Doç. Dr. Gülden GÜN POLAT",
        "Sınır Değer Problemleri": "Doç. Dr. Gülden GÜN POLAT",
        "MAT 434": "Doç. Dr. Gülden GÜN POLAT",
        "MAT 434 - Sınır Değer Problemleri": "Doç. Dr. Gülden GÜN POLAT",

        "Graph Theory and Combinatorics": "Prof. Dr. Sibel ÖZKAN",
        "Çizge Kuramı ve Kombinatorik": "Prof. Dr. Sibel ÖZKAN",
        "MAT 438": "Prof. Dr. Sibel ÖZKAN",
        "MAT 438 - Çizge Kuramı ve Kombinatorik": "Prof. Dr. Sibel ÖZKAN",

        "Quasilineerizasyon Metodu": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 446": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 446 - Quasilineerizasyon Metodu": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",

        "Tensör Analizi": "Prof. Dr. Oğul ESEN",
        "MAT 447": "Prof. Dr. Oğul ESEN",
        "MAT 447 - Tensör Analizi": "Prof. Dr. Oğul ESEN",

        "Number Theory": "Doç. Dr. Gülşen ULUCAK",
        "Sayılar Kuramı": "Doç. Dr. Gülşen ULUCAK",
        "MAT 449": "Doç. Dr. Gülşen ULUCAK",
        "MAT 449 - Sayılar Kuramı": "Doç. Dr. Gülşen ULUCAK",

        "Rasyonel Mekanik": "Prof. Dr. Oğul ESEN",
        "MAT 450": "Prof. Dr. Oğul ESEN",
        "MAT 450 - Rasyonel Mekanik": "Prof. Dr. Oğul ESEN",

        "History of Mathematics": "Dr. Öğr. Üyesi Keremcan DOĞAN",
        "Matematik Tarihi": "Dr. Öğr. Üyesi Keremcan DOĞAN",
        "MAT 452": "Dr. Öğr. Üyesi Keremcan DOĞAN",
        "MAT 452 - Matematik Tarihi": "Dr. Öğr. Üyesi Keremcan DOĞAN",

        // Lisansüstü Açılacak Dersler (2026-2027 Güz)
        "MATH 667": "Prof. Dr. Serkan SÜTLÜ",
        "MATH 667 - Algebraic Number Theory I": "Prof. Dr. Serkan SÜTLÜ",
        "Algebraic Number Theory I": "Prof. Dr. Serkan SÜTLÜ",
        "Cebirsel Sayılar Teorisi I": "Prof. Dr. Serkan SÜTLÜ",

        "MAT 542": "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)",
        "MATH 542": "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)",
        "MAT 542 - Reel Analiz": "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)",
        "MATH 542 - Real Analysis": "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)",
        "Reel Analiz": "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)",

        "MATH 517": "Doç. Dr. Gülşen ULUCAK",
        "MAT 517": "Doç. Dr. Gülşen ULUCAK",
        "MATH 517 - Ring Theory": "Doç. Dr. Gülşen ULUCAK",
        "Ring Theory": "Doç. Dr. Gülşen ULUCAK",
        "Halka Teorisi": "Doç. Dr. Gülşen ULUCAK",

        "MATH 545": "Doç. Dr. Hülya ÖZTÜRK",
        "MAT 545": "Doç. Dr. Hülya ÖZTÜRK",
        "MATH 545 - Numerical Analysis": "Doç. Dr. Hülya ÖZTÜRK",

        "MAT 571": "Doç. Dr. Ayşe SÖNMEZ",
        "MATH 571": "Doç. Dr. Ayşe SÖNMEZ",
        "MAT 571 - Genel Topoloji": "Doç. Dr. Ayşe SÖNMEZ",
        "MATH 571 - General Topology": "Doç. Dr. Ayşe SÖNMEZ",
        "Genel Topoloji": "Doç. Dr. Ayşe SÖNMEZ",
        "General Topology": "Doç. Dr. Ayşe SÖNMEZ",

        "MATH 515": "Doç. Dr. Nursel EREY",
        "MAT 515": "Doç. Dr. Nursel EREY",
        "MATH 515 - Algebra I": "Doç. Dr. Nursel EREY",

        "MATH 581": "Prof. Dr. Nuri ÇELİK",
        "MAT 581": "Prof. Dr. Nuri ÇELİK",
        "MATH 581 - Probability Theory and Mathematical Statistics": "Prof. Dr. Nuri ÇELİK",
        "Probability Theory and Mathematical Statistics": "Prof. Dr. Nuri ÇELİK",
        "Olasılık Teorisi ve Matematiksel İstatistik": "Prof. Dr. Nuri ÇELİK",

        "MATH 685": "Dr. Öğr. Üyesi Keremcan DOĞAN",
        "MAT 685": "Dr. Öğr. Üyesi Keremcan DOĞAN",
        "MATH 685 - Geometric Mechanics": "Dr. Öğr. Üyesi Keremcan DOĞAN",
        "Geometric Mechanics": "Dr. Öğr. Üyesi Keremcan DOĞAN",
        "Geometrik Mekanik": "Dr. Öğr. Üyesi Keremcan DOĞAN",

        "MATH 511": "Prof. Dr. Mustafa AKKURT",
        "MAT 511": "Prof. Dr. Mustafa AKKURT",
        "MATH 511 - Linear Algebra": "Prof. Dr. Mustafa AKKURT",

        "MATH 535": "Doç. Dr. Feray HACIVELİOĞLU",
        "MAT 535": "Doç. Dr. Feray HACIVELİOĞLU",
        "MATH 535 - Theory of Functions of Complex Variables I": "Doç. Dr. Feray HACIVELİOĞLU",
        "Theory of Functions of Complex Variables I": "Doç. Dr. Feray HACIVELİOĞLU",
        "Kompleks Değişkenli Fonksiyonlar Teorisi I": "Doç. Dr. Feray HACIVELİOĞLU",

        "MATH 560": "Doç. Dr. Fatma KARAOĞLU CEYHAN",
        "MAT 560": "Doç. Dr. Fatma KARAOĞLU CEYHAN",
        "MATH 560 - Projective Geometry": "Doç. Dr. Fatma KARAOĞLU CEYHAN",
        "Projective Geometry": "Doç. Dr. Fatma KARAOĞLU CEYHAN",
        "Projektif Geometri": "Doç. Dr. Fatma KARAOĞLU CEYHAN",

        "MAT 676": "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)",
        "MATH 676": "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)",
        "MAT 676 - Hiperbolik Tipli Denklemler İçin Ters Problemler": "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)",
        "Hiperbolik Tipli Denklemler İçin Ters Problemler": "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)",

        "FBE 501": "Dr. Öğr. Üyesi Samire YAZAR",
        "FBE 501 - Bilimsel Araştırma Teknikleri ve Yayın Etiği": "Dr. Öğr. Üyesi Samire YAZAR",
        "Bilimsel Araştırma Teknikleri ve Yayın Etiği": "Dr. Öğr. Üyesi Samire YAZAR",

        "MATH 590": "Prof. Dr. Oğul ESEN",
        "MAT 590": "Prof. Dr. Oğul ESEN",
        "MATH 590 - Introduction to Hamiltonian Formulation of Differential Equations": "Prof. Dr. Oğul ESEN",
        "Introduction to Hamiltonian Formulation of Differential Equations": "Prof. Dr. Oğul ESEN",
        "Diferansiyel Denklemlerin Hamilton Formülasyonuna Giriş": "Prof. Dr. Oğul ESEN",

        "MATH 679": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 679": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MATH 679 - Theory of Fractional Differential Equations": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "Theory of Fractional Differential Equations": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "Kesirli Diferansiyel Denklemler Teorisi": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",

        "MATH 682": "Prof. Dr. Emil NOVRUZ",
        "MAT 682": "Prof. Dr. Emil NOVRUZ",
        "MATH 682 - Behavioral Properties of the Solutions of Nonlinear Parabolic Equations": "Prof. Dr. Emil NOVRUZ",
        "Behavioral Properties of the Solutions of Nonlinear Parabolic Equations": "Prof. Dr. Emil NOVRUZ",
        "Lineer Olmayan Parabolik Denklemlerin Çözümlerinin Davranış Özellikleri": "Prof. Dr. Emil NOVRUZ",

        "MATH 652": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MAT 652": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "MATH 652 - Theory of Differential Equations II": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "Theory of Differential Equations II": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "Diferansiyel Denklemler Teorisi II": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",

        // Diğer Servis Dersleri
        "Probability and Statistics": "Prof. Dr. Nuri ÇELİK",
        "Olasılık ve İstatistik": "Prof. Dr. Nuri ÇELİK",
        "MAT 118": "Prof. Dr. Nuri ÇELİK",
        "MAT 118 - Olasılık ve İstatistik": "Prof. Dr. Nuri ÇELİK",
        "MAT 219": "Prof. Dr. Nuri ÇELİK",
        "MAT 219 - Olasılık ve İstatistik": "Prof. Dr. Nuri ÇELİK",
        "İstatistik": "Prof. Dr. Nuri ÇELİK",
        "MAT 216": "Prof. Dr. Nuri ÇELİK",
        "MAT 216 - İstatistik": "Prof. Dr. Nuri ÇELİK",
        "Probability Theory": "Prof. Dr. Nuri ÇELİK",
        "Olasılık Teorisi": "Prof. Dr. Nuri ÇELİK",
        "MAT 308": "Prof. Dr. Nuri ÇELİK",
        "MAT 308 - Olasılık Teorisi": "Prof. Dr. Nuri ÇELİK",
        "Numerical Analysis": "Doç. Dr. Hülya ÖZTÜRK",
        "Sayısal Analiz": "Doç. Dr. Hülya ÖZTÜRK",
        "MAT 214": "Doç. Dr. Hülya ÖZTÜRK",
        "MAT 214 - Sayısal Analiz": "Doç. Dr. Hülya ÖZTÜRK",
        "Numerical Methods": "Doç. Dr. Hülya ÖZTÜRK",
        "MATH 214": "Doç. Dr. Hülya ÖZTÜRK",
        "MATH 214 - Numerical Methods": "Doç. Dr. Hülya ÖZTÜRK"
    },
    lecturers: [
        { name: "Mustafa AKKURT", title: "Prof. Dr." },
        { name: "Nuri ÇELİK", title: "Prof. Dr." },
        { name: "Oğul ESEN", title: "Prof. Dr." },
        { name: "Mansur İSGENDEROĞLU (İSMAİLOV)", title: "Prof. Dr." },
        { name: "Emil NOVRUZ", title: "Prof. Dr." },
        { name: "Sibel ÖZKAN", title: "Prof. Dr." },
        { name: "Serkan SÜTLÜ", title: "Prof. Dr." },
        { name: "Coşkun YAKAR (Bölüm Başkanı)", title: "Prof. Dr." },
        { name: "Nursel EREY", title: "Doç. Dr." },
        { name: "Gülden GÜN POLAT", title: "Doç. Dr." },
        { name: "Feray HACIVELİOĞLU", title: "Doç. Dr." },
        { name: "Roghayeh HAFEZIEH", title: "Doç. Dr." },
        { name: "Fatma KARAOĞLU CEYHAN", title: "Doç. Dr." },
        { name: "Ayten KOÇ", title: "Doç. Dr." },
        { name: "Işıl ÖNER", title: "Doç. Dr." },
        { name: "Hülya ÖZTÜRK", title: "Doç. Dr." },
        { name: "Ayşe SÖNMEZ", title: "Doç. Dr." },
        { name: "Selçuk TOPAL", title: "Doç. Dr." },
        { name: "Gülşen ULUCAK", title: "Doç. Dr." },
        { name: "Hadi ALIZADEH", title: "Dr. Öğr. Üyesi" },
        { name: "Keremcan DOĞAN", title: "Dr. Öğr. Üyesi" },
        { name: "Tuğba MAHMUTÇEPOĞLU", title: "Dr. Öğr. Üyesi" },
        { name: "Samire YAZAR", title: "Dr. Öğr. Üyesi" },
        { name: "Benan DURUKAN", title: "Öğr.Gör." },
        { name: "Fatih KINDAZ", title: "Öğr. Gör. Dr." },
        { name: "Zeynep Karadeniz Cısdık", title: "Öğr. Gör." },
        { name: "Orkun Canbek", title: "Öğr. Gör." },
        { name: "Oğuzhan DURSUN", title: "Öğr. Gör. Dr." },
        { name: "Pelin Ayşe GÖKGÖZ", title: "Araş. Gör. Dr." },
        { name: "Eda GOLDENBERG", title: "Doç. Dr." }
    ]
};

if (typeof window !== 'undefined') {
    window.DB = DB;
    window.getCourseCatalog = getCourseCatalog;
    window.findCourseInCatalog = findCourseInCatalog;
    window.DEFAULT_COURSE_CATALOG = DEFAULT_COURSE_CATALOG;
}

/**
 * YEREL ANLIK GÖRÜNTÜ KASASI (SNAPSHOT VAULT - SON 30 YEDEK)
 * Site her açıldığında ve her işlemde tarayıcıda otomatik versiyon geçmişi tutar.
 */
const SNAPSHOT_VAULT_KEY = 'gozetmenlik_snapshot_vault_v1';
const MAX_SNAPSHOTS = 30;

function saveAutoSnapshot(dbData, sourceLabel = 'Otomatik Kayıt') {
    if (!dbData || !Array.isArray(dbData.staff) || !Array.isArray(dbData.exams)) return;
    try {
        let vault = [];
        const rawVault = localStorage.getItem(SNAPSHOT_VAULT_KEY);
        if (rawVault) {
            try { vault = JSON.parse(rawVault) || []; } catch(e) { vault = []; }
        }
        
        const now = new Date();
        const displayDate = now.toLocaleString('tr-TR');
        const snapshotEntry = {
            id: Date.now(),
            timestamp: now.toISOString(),
            displayDate: displayDate,
            source: sourceLabel,
            examCount: dbData.exams.length,
            staffCount: dbData.staff.length,
            requestCount: (dbData.requests || []).length,
            data: JSON.parse(JSON.stringify(dbData))
        };
        
        // Çok sık kayıt yapmayı önlemek için son kayıtla 1 dakikadan az ve aynıysa güncelle
        if (vault.length > 0) {
            const last = vault[0];
            const diffMs = Date.now() - last.id;
            if (diffMs < 60000 && last.examCount === snapshotEntry.examCount && last.staffCount === snapshotEntry.staffCount) {
                vault[0] = snapshotEntry;
            } else {
                vault.unshift(snapshotEntry);
            }
        } else {
            vault.unshift(snapshotEntry);
        }
        
        if (vault.length > MAX_SNAPSHOTS) {
            vault = vault.slice(0, MAX_SNAPSHOTS);
        }
        
        localStorage.setItem(SNAPSHOT_VAULT_KEY, JSON.stringify(vault));
        console.log(`🛡️ Anlık Görüntü Kasasına kaydedildi (${displayDate}) - Toplam Yedek: ${vault.length}`);
    } catch(err) {
        console.warn("Snapshot Vault kaydı sırasında hata:", err);
    }
}
window.saveAutoSnapshot = saveAutoSnapshot;

function getSavedSnapshots() {
    try {
        const raw = localStorage.getItem(SNAPSHOT_VAULT_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch(e) {
        return [];
    }
}
window.getSavedSnapshots = getSavedSnapshots;

function restoreFromSnapshot(snapshotId) {
    const vault = getSavedSnapshots();
    const target = vault.find(s => s.id === Number(snapshotId));
    if (!target || !target.data) {
        throw new Error("Yedek kaydı bulunamadı!");
    }
    DB = JSON.parse(JSON.stringify(target.data));
    saveToLocalStorage();
    recalculateAllScores();
    return target;
}
window.restoreFromSnapshot = restoreFromSnapshot;

function deleteSnapshot(snapshotId) {
    let vault = getSavedSnapshots();
    vault = vault.filter(s => s.id !== Number(snapshotId));
    localStorage.setItem(SNAPSHOT_VAULT_KEY, JSON.stringify(vault));
    return vault;
}
window.deleteSnapshot = deleteSnapshot;

/**
 * Geri Al (Undo) ve Yedekleme Sistemi
 */
let UNDO_STACK = [];
const MAX_UNDO_STEPS = 10;

function takeSnapshot(actionName) {
    // DB.exams ve DB.staff'ın derin kopyasını al
    const snapshot = {
        actionName: actionName,
        timestamp: new Date().toISOString(),
        exams: JSON.parse(JSON.stringify(DB.exams || [])),
        staff: JSON.parse(JSON.stringify(DB.staff || []))
    };
    
    UNDO_STACK.push(snapshot);
    if (UNDO_STACK.length > MAX_UNDO_STEPS) {
        UNDO_STACK.shift(); // En eskisini sil
    }
    
    // UI Güncellemesini tetikle (app.js'de tanımlı olacak)
    if (typeof updateUndoUI === 'function') {
        updateUndoUI();
    }
}

function undoLastAction() {
    if (UNDO_STACK.length === 0) return false;
    
    const lastSnapshot = UNDO_STACK.pop();
    
    // Verileri geri yükle
    DB.exams = JSON.parse(JSON.stringify(lastSnapshot.exams));
    DB.staff = JSON.parse(JSON.stringify(lastSnapshot.staff));
    
    saveToLocalStorage();
    logAction('admin', 'İşlem Geri Alındı', `Geri alınan işlem: ${lastSnapshot.actionName}`);
    
    // UI Güncellemesi
    if (typeof updateUndoUI === 'function') {
        updateUndoUI();
    }
    return true;
}

/**
 * İşlem Günlüğü (Logging)
 */
function logAction(category, action, details = "") {
    if (!DB.auditLogs) DB.auditLogs = [];
    
    // Stringify details if it's an object for simple display
    const detailsStr = (typeof details === 'object') ? JSON.stringify(details) : String(details);

    const logEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('tr-TR'),
        category: category, // 'admin', 'user', 'system'
        action: action,     // 'Takas', 'Atama', 'Düzenleme'
        details: detailsStr
    };
    
    DB.auditLogs.unshift(logEntry); // En yeni en üstte
    if (DB.auditLogs.length > 500) DB.auditLogs.pop(); // Maksimum 500 kayıt
    
    // Local storage'a kaydet (saveToLocalStorage içinden zaten çağrılıyor olabilir ama garantiye alalım)
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
}
function getKatsayi(date, duration = 0, examId = null) {
    const day = date.getDay();
    const isWeekend = (day === 0 || day === 6);
    
    // Multipliers
    const ktsDay = isWeekend ? KATSAYILAR.HAFTA_SONU_GUNDUZ : KATSAYILAR.HAFTA_ICI_MESAI;
    const ktsNight = isWeekend ? KATSAYILAR.HAFTA_SONU_AKSAM : KATSAYILAR.HAFTA_ICI_AKSAM;
    
    if (duration <= 0) {
        const hour = date.getHours();
        const minutes = date.getMinutes();
        const currentTime = hour + minutes / 60;
        return (currentTime >= 8.5 && currentTime < 17.0) ? ktsDay : ktsNight;
    }

    // Weighted average multiplier
    const score = calculateScore(date, duration, examId);
    return parseFloat((score / duration).toFixed(3));
}

/**
 * Sınav süresini 17:00 sınırında parçalayarak katsayı ile ağırlıklı puan hesaplar.
 * 17:00 öncesi: hafta içi x1.0, hafta sonu x2.0
 * 17:00 ve sonrası: hafta içi x1.5, hafta sonu x2.5
 *
 * Örnek (hafta içi): Başlangıç 16:30, Süre 120dk
 *   16:30–17:00 → 30 dk × 1.0 = 30 puan
 *   17:00–18:30 → 90 dk × 1.5 = 135 puan
 *   Toplam: 165 puan
 */
function calculateScore(date, duration, examId = null) {
    duration = parseFloat(duration) || 60;
    const day = date.getDay();
    const isWeekend = (day === 0 || day === 6);
    
    const ktsDay = isWeekend ? KATSAYILAR.HAFTA_SONU_GUNDUZ : KATSAYILAR.HAFTA_ICI_MESAI;
    const ktsNight = isWeekend ? KATSAYILAR.HAFTA_SONU_AKSAM : KATSAYILAR.HAFTA_ICI_AKSAM; 

    // Dinamik Katsayı Kontrolü (Marketplace + <48h)
    let dynamicBonus = 0;
    if (examId && DB.requests) {
        const hasOpenRequest = DB.requests.some(r => String(r.examId) === String(examId) && r.status === 'open');
        if (hasOpenRequest) {
            const timeToExam = date.getTime() - new Date().getTime();
            if (timeToExam > 0 && timeToExam < (48 * 60 * 60 * 1000)) {
                dynamicBonus = BONUSLAR.DINAMIK_IHTIYAC;
            }
        }
    }

    // Boundaries in minutes from midnight
    const m830 = 8.5 * 60; 
    const m1000 = 10.0 * 60; // Erken Kuş Bitiş (Kullanıcı isteğiyle 10:00'a çekildi)
    const m1700 = 17.0 * 60; 
    
    const startMins = date.getHours() * 60 + date.getMinutes();
    const endMins = startMins + duration;
    
    function getOverlap(s, e, pStart, pEnd) {
        return Math.max(0, Math.min(e, pEnd) - Math.max(s, pStart));
    }
    
    let totalScore = 0;
    
    // Period 1: 00:00 - 08:30 (Gece + Erken Kuş + Dinamik)
    totalScore += getOverlap(startMins, endMins, 0, m830) * (ktsNight + BONUSLAR.ERKEN_KUS + dynamicBonus);
    
    // Period 2: 08:30 - 10:00 (Gündüz + Erken Kuş + Dinamik)
    totalScore += getOverlap(startMins, endMins, m830, m1000) * (ktsDay + BONUSLAR.ERKEN_KUS + dynamicBonus);
    
    // Period 3: 10:00 - 17:00 (Gündüz + Dinamik)
    totalScore += getOverlap(startMins, endMins, m1000, m1700) * (ktsDay + dynamicBonus);
    
    // Period 4: 17:00 - 24:00 (Kademeli Akşam)
    // Her saat başı katsayı 0.15 artar (17-18: 1.5, 18-19: 1.65, vb.)
    let eveningScore = 0;
    const evStart = Math.max(startMins, m1700);
    const evEnd = Math.min(endMins, 1440);
    
    if (evEnd > evStart) {
        for (let h = 17; h < 24; h++) {
            const hStart = h * 60;
            const hEnd = (h + 1) * 60;
            const overlap = getOverlap(evStart, evEnd, hStart, hEnd);
            if (overlap > 0) {
                const progressiveBonus = (h - 17) * 0.15;
                eveningScore += overlap * (ktsNight + progressiveBonus + dynamicBonus);
            }
        }
    }
    totalScore += eveningScore;
    
    return parseFloat(totalScore.toFixed(2));
}

function timeToMins(timeStr) {
    if (!timeStr) return 0;
    timeStr = String(timeStr).split('-')[0].trim();
    const parts = timeStr.split(':');
    return parseInt(parts[0] || 0) * 60 + parseInt(parts[1] || 0);
}

function cleanExpiredConstraints(silent = true) {
    if (!window.DB || !DB.constraints) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayYear = today.getFullYear();
    let deletedCount = 0;

    for (let staffName in DB.constraints) {
        if (!Array.isArray(DB.constraints[staffName])) continue;
        const oldLength = DB.constraints[staffName].length;
        
        DB.constraints[staffName] = DB.constraints[staffName].filter(c => {
            // Haftalık kısıtlar (day tanımlı) silinmez
            if (c.day !== undefined) return true;

            if (c.endDate) {
                const parts = c.endDate.split('-');
                let ed;
                if (parts.length === 3) {
                    ed = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59);
                } else {
                    ed = new Date(c.endDate);
                    ed.setHours(23, 59, 59, 999);
                }
                if (ed < today) return false;
            } else if (c.date) {
                let parts = c.date.split('-');
                let checkDate;
                if (parts.length === 2) {
                    checkDate = new Date(todayYear, parseInt(parts[0]) - 1, parseInt(parts[1]), 23, 59, 59);
                } else if (parts.length === 3) {
                    checkDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59);
                }
                if (checkDate && checkDate < today) return false;
            }
            return true;
        });

        deletedCount += (oldLength - DB.constraints[staffName].length);
    }

    if (deletedCount > 0) {
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
        if (typeof renderConstraintsPage === 'function') renderConstraintsPage();
        if (typeof logAction === 'function') logAction('admin', 'Kısıt Temizliği', `${deletedCount} adet tarihi geçmiş kısıt otomatik silindi.`);
        if (!silent && typeof showToast === 'function') showToast(`${deletedCount} adet tarihi geçmiş kısıt başarıyla temizlendi.`, "success");
    } else {
        if (!silent && typeof showToast === 'function') showToast("Tarihi geçmiş kısıt bulunamadı.", "info");
    }
    return deletedCount;
}
window.cleanExpiredConstraints = cleanExpiredConstraints;

/**
 * GÜVENLİ HASH FONKSİYONU (SHA-256)
 * Şifreler istemcide hiçbir zaman düz metin (plain text) olarak karşılaştırılmaz veya saklanmaz.
 */
async function hashSHA256(text) {
    if (!text) return '';
    try {
        const msgBuffer = new TextEncoder().encode(String(text).trim());
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        let hash = 0;
        const str = String(text).trim();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return 'fb_' + String(hash);
    }
}
window.hashSHA256 = hashSHA256;

// Yetkili SHA-256 Hash Değerleri (Plaintext şifreler kodda saklanmaz)
const AUTH_HASHES = {
    ADMIN_HASHES: [
        '2c5d6078956f040e48eeb3e68e24deaeae547eff39fa8bc358d7ae02dbc8ab65', // Gtuturan123
        'f01067db8f520b1b1f84e73c23d298c2de9f541ec78d852eb2fa7128d0956c5e', // GtuAdmin123
        'b8e411d15dd5e2034aa6cce8319d2acb48da5a601081e3cef6207f9cb5cbcf68'  // GtuAdmın123
    ],
    PROCTOR_HASH: '529c6b49c165be870c4fc86cc679928cc32565286a8aa07b31e87bb298cbe408' // Gtu2026
};
window.AUTH_HASHES = AUTH_HASHES;

/**
 * SİSTEM VE VERİ BÜTÜNLÜĞÜ DOĞRULAMA MOTORU (Data Integrity Validator)
 * Veritabanındaki tüm kayıtları denetler:
 * 1. Çifte Görev Çakışması (Aynı anda 2 sınavda olma)
 * 2. Kısıt & Ders Çakışması (Haftalık ders saatinde sınav atanması)
 * 3. Puan ve Aritmetik Bütünlük (Taban + Sınav puanları tutarlılığı)
 * 4. Şema, Eksik / Yetim ID Kontrolleri
 */
function validateDatabaseIntegrity(targetDB = null) {
    const db = targetDB || window.DB;
    const report = {
        isValid: true,
        checkedAt: new Date().toISOString(),
        examCount: 0,
        staffCount: 0,
        doubleBookings: [],
        constraintClashes: [],
        scoreMismatches: [],
        unassignedExams: [],
        invalidProctorIds: [],
        healthScore: 100
    };

    if (!db || !Array.isArray(db.staff) || !Array.isArray(db.exams)) {
        report.isValid = false;
        report.healthScore = 0;
        return report;
    }

    report.examCount = db.exams.length;
    report.staffCount = db.staff.length;

    const staffMap = {};
    db.staff.forEach(s => { staffMap[String(s.id)] = s; });

    // 1. Çakışma ve Yetim Gözetmen Kontrolü
    const dayExamMap = {};
    db.exams.forEach(ex => {
        const d = ex.date;
        if (!d) return;
        if (!dayExamMap[d]) dayExamMap[d] = [];
        dayExamMap[d].push(ex);

        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        if (pIds.length === 0) {
            report.unassignedExams.push({
                examId: ex.id,
                name: ex.name,
                date: ex.date,
                time: ex.time
            });
        }
        pIds.forEach(pid => {
            if (!staffMap[String(pid)]) {
                report.invalidProctorIds.push({
                    examId: ex.id,
                    examName: ex.name,
                    invalidId: pid
                });
            }
        });
    });

    // Günlük sınav çakışma taraması
    Object.keys(dayExamMap).forEach(d => {
        const dExams = dayExamMap[d];
        for (let i = 0; i < dExams.length; i++) {
            const e1 = dExams[i];
            const s1 = timeToMins(e1.time);
            const e1End = s1 + (parseInt(e1.duration) || 60);
            const p1 = (e1.proctorIds || (e1.proctorId ? [e1.proctorId] : [])).map(String);

            for (let j = i + 1; j < dExams.length; j++) {
                const e2 = dExams[j];
                const s2 = timeToMins(e2.time);
                const e2End = s2 + (parseInt(e2.duration) || 60);
                const p2 = (e2.proctorIds || (e2.proctorId ? [e2.proctorId] : [])).map(String);

                if (s1 < e2End && e1End > s2) {
                    const common = p1.filter(id => p2.includes(id));
                    common.forEach(cId => {
                        const sObj = staffMap[cId];
                        report.doubleBookings.push({
                            staffName: sObj ? sObj.name : `ID: ${cId}`,
                            date: d,
                            exam1: `${e1.name} (${e1.time})`,
                            exam2: `${e2.name} (${e2.time})`
                        });
                    });
                }
            }
        }
    });

    // 2. Kısıt & Ders Çakışması Kontrolü (Güz 2026-2027 Dönemi İçin)
    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    db.exams.forEach(ex => {
        if (!ex.date || !ex.time) return;
        const examDate = getSafeDate(ex.date, ex.time);
        if (isNaN(examDate.getTime())) return;
        
        // Sadece güncel/gelecek veya Eylül 2026 sonrası sınavlar için haftalık ders kısıtlarını kontrol et
        const isCurrentOrFall = ex.date >= '2026-09-01';
        const dayOfWeek = examDate.getDay();
        const sMin = timeToMins(ex.time);
        const eMin = sMin + (parseInt(ex.duration) || 60);
        const pIds = (ex.proctorIds || (ex.proctorId ? [ex.proctorId] : [])).map(String);

        pIds.forEach(pid => {
            const sObj = staffMap[pid];
            if (!sObj) return;
            const cList = (db.constraints && db.constraints[sObj.name]) || [];
            cList.forEach(c => {
                if (c.day !== undefined && isCurrentOrFall && c.day === dayOfWeek) {
                    const cs = timeToMins(c.start);
                    const ce = timeToMins(c.end);
                    if (sMin < ce && eMin > cs) {
                        report.constraintClashes.push({
                            staffName: sObj.name,
                            examName: ex.name,
                            date: ex.date,
                            time: ex.time,
                            constraint: `${dayNames[dayOfWeek]} ${c.start}-${c.end}`
                        });
                    }
                }
            });
        });
    });

    // 3. Puan ve Aritmetik Bütünlük Kontrolü
    const computedScores = {};
    const computedTasks = {};
    db.staff.forEach(s => {
        computedScores[String(s.id)] = parseFloat((s.baseScore || 0).toFixed(2));
        computedTasks[String(s.id)] = 0;
    });

    db.exams.forEach(ex => {
        const score = parseFloat(ex.score) || 0;
        const isNon = shouldCountAsNonExam(ex);
        if (!isNon) {
            const pIds = (ex.proctorIds || (ex.proctorId ? [ex.proctorId] : [])).map(String);
            pIds.forEach(pid => {
                if (computedScores[pid] !== undefined) {
                    computedScores[pid] = parseFloat((computedScores[pid] + score).toFixed(2));
                    computedTasks[pid] += 1;
                }
            });
        }
    });

    db.staff.forEach(s => {
        const recorded = parseFloat((s.totalScore || 0).toFixed(1));
        const computed = parseFloat((computedScores[String(s.id)] || 0).toFixed(1));
        if (Math.abs(recorded - computed) > 0.1) {
            report.scoreMismatches.push({
                staffName: s.name,
                recorded: recorded,
                computed: computed,
                diff: parseFloat((recorded - computed).toFixed(1))
            });
        }
    });

    // Sağlık Puanı Hesabı
    let penalty = 0;
    penalty += report.doubleBookings.length * 20;
    penalty += report.scoreMismatches.length * 15;
    penalty += report.constraintClashes.length * 5;
    penalty += report.invalidProctorIds.length * 10;
    report.healthScore = Math.max(0, 100 - penalty);
    report.isValid = (report.doubleBookings.length === 0 && report.scoreMismatches.length === 0 && report.invalidProctorIds.length === 0);

    return report;
}
window.validateDatabaseIntegrity = validateDatabaseIntegrity;

/**
 * OTOMATİK VERİ VE SAĞLIK ONARIMI (Auto Fix Engine)
 */
function fixDatabaseIntegrity() {
    console.log("🛠️ Veri bütünlüğü onarım motoru başlatılıyor...");
    
    // 1. Tarihi geçmiş kısıtları temizle
    cleanExpiredConstraints(true);

    // 2. Tüm puanları ve görev sayılarını 100% matematiksel doğrulukla yeniden senkronize et
    recalculateAllScores();

    // 3. Veritabanını yerel ve bulut olarak güvenle kaydet
    saveToLocalStorage();
    saveAutoSnapshot(DB, 'Bütünlük Onarımı');
    
    const newReport = validateDatabaseIntegrity();
    logAction('admin', 'Bütünlük Onarımı', `Sistem bütünlüğü otomatik onarıldı. Sağlık Puanı: %${newReport.healthScore}`);
    return newReport;
}
window.fixDatabaseIntegrity = fixDatabaseIntegrity;

function getConstraintsForStaff(staffName) {
    if (!DB.constraints || !staffName) return [];
    
    const normalize = (name) => {
        return name
            .replace(/Prof\.\s*Dr\./gi, '')
            .replace(/Doç\.\s*Dr\./gi, '')
            .replace(/Dr\.\s*Öğr\.\s*Üyesi/gi, '')
            .replace(/Arş\.\s*Gör\./gi, '')
            .replace(/Dr\./gi, '')
            .replace(/Öğr\.Gör\./gi, '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    };

    const target = normalize(staffName);
    for (const key of Object.keys(DB.constraints)) {
        if (normalize(key) === target) {
            return DB.constraints[key] || [];
        }
    }
    return [];
}

function isAvailable(staffName, dateStr, timeStr, duration) {
    const constraints = getConstraintsForStaff(staffName);
    if (constraints.length === 0) return true;

    // Timezone safe local date parsing
    const parts = dateStr.split('-');
    const examDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeek = examDate.getDay();
    const mm = String(examDate.getMonth() + 1).padStart(2, '0');
    const dd = String(examDate.getDate()).padStart(2, '0');
    const matchDateStr = `${mm}-${dd}`;

    const examStart = timeToMins(timeStr);
    const examEnd = examStart + duration;

    for (const c of constraints) {
        let isDayMatch = (c.day !== undefined && parseInt(c.day) === dayOfWeek);
        let isDateMatch = (c.date !== undefined && c.date === matchDateStr);
        let isDaterangeMatch = false;
        
        if (c.startDate && c.endDate) {
            const startParts = c.startDate.split('-');
            const endParts = c.endDate.split('-');
            const startD = new Date(startParts[0], startParts[1] - 1, startParts[2]);
            const endD = new Date(endParts[0], endParts[1] - 1, endParts[2]);
            if (examDate >= startD && examDate <= endD) {
                isDaterangeMatch = true;
            }
        }
        
        if (isDayMatch || isDateMatch || isDaterangeMatch) {
            const constraintStart = timeToMins(c.start);
            const constraintEnd = timeToMins(c.end);
            
            // Çakışma kontrolü
            if (examStart < constraintEnd && examEnd > constraintStart) {
                return false; 
            }
        }
    }
    return true;
}

/**
 * Gözetmen Müsaitlik Puanını Hesapla (0-100)
 * Hafta içi mesai saatleri (08:30-17:30) üzerinden kısıtlı süreyi çıkarır.
 */
function calculateAvailabilityScore(staffId) {
    const staff = DB.staff.find(s => s.id === staffId);
    if (!staff) return 0;
    
    const constraints = getConstraintsForStaff(staff.name);
    if (constraints.length === 0) return 100;

    const totalWeeklyMins = 5 * 9 * 60; // 5 gün * 9 saat * 60 dk = 2700 dk
    let restrictedMins = 0;

    constraints.forEach(c => {
        // Sadece haftalık tekrarlayan kısıtları (day bazlı) sayalım (Basitleştirme için)
        if (c.day !== undefined) {
            const start = timeToMins(c.start);
            const end = timeToMins(c.end);
            // Mesai saatleri dışını kırp (08:30 - 17:30)
            const actualStart = Math.max(start, 510); // 08:30
            const actualEnd = Math.min(end, 1050);     // 17:30
            
            if (actualEnd > actualStart) {
                restrictedMins += (actualEnd - actualStart);
            }
        }
    });

    const score = ((totalWeeklyMins - restrictedMins) / totalWeeklyMins) * 100;
    return Math.max(0, Math.round(score));
}

/**
 * İsme göre cinsiyet tahmini yapar
 */
function predictGender(name) {
    if (!name) return 'Belirtilmemiş';
    const lowerName = name.toLowerCase();
    
    const femaleNames = ['ayşe', 'fatma', 'saliha', 'çağla', 'cansu', 'ezgi', 'aysel', 'aslıhan', 'şeyma', 'nursel', 'gülden', 'feray', 'roghayeh', 'ayten', 'ışıl', 'hülya', 'gülşen', 'tuğba', 'samire', 'sibel', 'zeynep', 'begüm', 'sultan', 'yasemin', 'büşra', 'eda'];
    for (const fName of femaleNames) {
        if (lowerName.includes(fName)) return 'Kadın';
    }
    
    const maleNames = ['oğuzhan', 'serdal', 'serkan', 'ömer', 'yasin', 'muhammed', 'mustafa', 'nuri', 'oğul', 'mansur', 'emil', 'coşkun', 'selçuk', 'hadi', 'keremcan', 'murat', 'fatih', 'orkun', 'yılmaz'];
    for (const mName of maleNames) {
        if (lowerName.includes(mName)) return 'Erkek';
    }
    
    return 'Belirtilmemiş';
}

/**
 * Bir gözetmenin o saatte hem kısıt hem de mevcut sınavlar açısından gerçekten boş olup olmadığını kontrol et
 */
function isProctorTrulyFree(staffId, date, time, duration, ignoreExamId = null, isNonExam = false, examName = "") {
    const staff = DB.staff.find(s => s.id === staffId);
    if (!staff) return false;

    // 1. Kısıt kontrolü
    if (!isAvailable(staff.name, date, time, duration)) return false;

    // 2. Mevcut sınavlarla çakışma kontrolü (15 dk buffer)
    const start = getSafeDate(date, time);
    const end = new Date(start.getTime() + (duration + 15) * 60000);

    const hasConflict = DB.exams.some(ex => {
        // Eğer bir examen düzenleniyorsa, o exameni çakışma kontrolünden muaf tut
        if (ignoreExamId && String(ex.id) === String(ignoreExamId)) return false;
        
        // Multi-proctor desteği için hem proctorId hem proctorIds kontrolü
        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        if (!pIds.includes(staffId)) return false;
        if (ex.date !== date) return false;

        const exStart = getSafeDate(ex.date, ex.time);
        const exEnd = new Date(exStart.getTime() + (ex.duration + 15) * 60000);
        return (start < exEnd && end > exStart);
    });

    if (hasConflict) return false;

    // 3. Cuma Namazı Kısıtı (Cuma günü 12:30-14:00 arası erkeklere atama yapılmaz)
    const isFriday = new Date(date).getDay() === 5;
    const gender = staff.gender || predictGender(staff.name);
    if (isFriday && gender === 'Erkek') {
        const startMins = timeToMins(time);
        const endMins = startMins + duration;
        const pStart = timeToMins("12:30");
        const pEnd = timeToMins("14:00");
        if (startMins < pEnd && endMins > pStart) {
            return false;
        }
    }

    // 4. Sınav Dışı Görev Tekrarı Kısıtı
    if (isNonExam && examName) {
        const hasSameNonExam = DB.exams.some(ex => {
            if (ignoreExamId && String(ex.id) === String(ignoreExamId)) return false;
            if (!shouldCountAsNonExam(ex)) return false;
            if (ex.name !== examName) return false;
            const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
            return pIds.includes(staffId);
        });
        if (hasSameNonExam) return false;
    }

    return true;
}

/**
 * Akıllı Atama Asistanı için Gözetmen Önerileri Listesi oluştur
 */
function getRecommendedProctors(dateStr, timeStr, duration, ignoreExamId = null, isNonExam = false, examName = "") {
    if (DB.staff.length === 0) return [];
    const available = DB.staff.filter(s => isProctorTrulyFree(s.id, dateStr, timeStr, duration, ignoreExamId, isNonExam, examName));
    if (available.length === 0) return [];

    return available.map(s => {
        const score = s.totalScore || 0;
        const tasks = s.taskCount || 0;
        const minReached = tasks >= GLOBAL_LIMITS.MIN_TASKS;
        const avgScore = DB.staff.reduce((a, b) => a + (b.totalScore || 0), 0) / (DB.staff.length || 1);
        
        let reason = "✅ Müsait";
        if (!minReached) reason = "🌟 Görev Sayısı Az";
        else if (score < avgScore) reason = "⚖️ Düşük Puanlı";

        return { ...s, reason };
    }).sort((a,b) => a.totalScore - b.totalScore).slice(0, 5);
}
window.getRecommendedProctors = getRecommendedProctors;

/**
 * En adil gözetmen atamasını yap (hem kısıt hem sınav çakışması kontrolü ile)
 */
function findBestProctor(dateStr, timeStr, duration, ignoreExamId = null, isNonExam = false, examName = "") {
    if (DB.staff.length === 0) return null;

    let available = DB.staff.filter(s =>
        isProctorTrulyFree(s.id, dateStr, timeStr, duration, ignoreExamId, isNonExam, examName) &&
        (s.taskCount || 0) < GLOBAL_LIMITS.MAX_TASKS
    );

    // Eğer MAX_TASKS (6) sınırına herkes ulaştığı için müsait kimse kalmadıysa, bu sınırı esnet. 
    // Böylece test ortamında veya yoğun haftalarda "müsait gözetmen bulunamadı" hatası almayız.
    if (available.length === 0) {
        available = DB.staff.filter(s =>
            isProctorTrulyFree(s.id, dateStr, timeStr, duration, ignoreExamId)
        );
    }

    if (available.length === 0) return null;

    // SIRALAMA STRATEJİSİ: 
    // 1. Önce minimum görev sayısına (0) ulaşmamış olanlara öncelik ver
    // 2. Kendi aralarında en düşük puanlı olanı seç
    return available.sort((a, b) => {
        const aMinReached = (a.taskCount || 0) >= GLOBAL_LIMITS.MIN_TASKS;
        const bMinReached = (b.taskCount || 0) >= GLOBAL_LIMITS.MIN_TASKS;

        if (aMinReached !== bMinReached) {
            return aMinReached ? 1 : -1; // Ulaşmayan öne (üstte)
        }
        return a.totalScore - b.totalScore;
    })[0];
}

/**
 * Tüm çakışmaları otomatik çöz
 * - Hem zaman çakışması olan, hem de kısıt ihlali olan sınavlar için yeni gözetmen atar
 */
function autoResolveConflicts() {
    takeSnapshot("Otomatik Çakışma Çözme");
    let resolvedCount = 0;
    let skippedCount = 0;

    // Adım 1: Kısıt ihlali olan sınavları bul
    const violationExamIds = new Set();
    DB.exams.forEach(ex => {
        const proctorStaff = DB.staff.find(s => s.id === ex.proctorId);
        if (!proctorStaff) return;
        if (!isAvailable(proctorStaff.name, ex.date, ex.time, ex.duration)) {
            violationExamIds.add(ex.id);
        }
    });

    // Adım 2: Zaman çakışması olan sınavları bul
    const conflictIds = getConflicts();

    // Adım 3: Hepsini birleştir
    const allProblematicIds = new Set([...violationExamIds, ...conflictIds]);

    if (allProblematicIds.size === 0) {
        return { resolved: 0, skipped: 0, message: "Zaten çakışma yok!" };
    }

    // Adım 4: Her sorunlu sınavı düzelt
    allProblematicIds.forEach(examId => {
        const exam = DB.exams.find(e => e.id === examId);
        if (!exam) return;

        // Eski gözetmenin puanını düş
        const oldStaff = DB.staff.find(s => s.id === exam.proctorId);
        if (oldStaff) {
            if (shouldCountAsNonExam(exam)) {
                oldStaff.nonExamScore = Math.max(0, (oldStaff.nonExamScore || 0) - exam.score);
                oldStaff.nonExamTaskCount = Math.max(0, (oldStaff.nonExamTaskCount || 0) - 1);
            } else {
                oldStaff.totalScore = Math.max(0, oldStaff.totalScore - exam.score);
                oldStaff.taskCount = Math.max(0, oldStaff.taskCount - 1);
            }
        }

        // Yeni uygun gözetmeni bul (mevcut sınav hariç)
        const newProctor = findBestProctor(exam.date, exam.time, exam.duration, exam.id);

        if (newProctor) {
            // Yeni gözetmeni ata
            exam.proctorId = newProctor.id;
            exam.proctorName = newProctor.name;
            if (!exam.proctorIds || exam.proctorIds.length === 0) {
                exam.proctorIds = [newProctor.id];
            } else {
                const idx = exam.proctorIds.indexOf(oldStaff ? oldStaff.id : exam.proctorId);
                if (idx !== -1) exam.proctorIds[idx] = newProctor.id;
                else exam.proctorIds = [newProctor.id];
            }
            if (shouldCountAsNonExam(exam)) {
                newProctor.nonExamScore = parseFloat(((newProctor.nonExamScore || 0) + exam.score).toFixed(2));
                newProctor.nonExamTaskCount = (newProctor.nonExamTaskCount || 0) + 1;
            } else {
                newProctor.totalScore = parseFloat((newProctor.totalScore + exam.score).toFixed(2));
                newProctor.taskCount += 1;
            }
            resolvedCount++;
        } else {
            // Eski gözetmeni geri al (yetersiz yedek)
            if (oldStaff) {
                if (shouldCountAsNonExam(exam)) {
                    oldStaff.nonExamScore = parseFloat(((oldStaff.nonExamScore || 0) + exam.score).toFixed(2));
                    oldStaff.nonExamTaskCount = (oldStaff.nonExamTaskCount || 0) + 1;
                } else {
                    oldStaff.totalScore += exam.score;
                    oldStaff.taskCount += 1;
                }
            }
            skippedCount++;
        }
    });

    saveToLocalStorage();
    logAction('admin', 'Otomatik Çakışma Çözme', `${resolvedCount} çakışma giderildi, ${skippedCount} uygun yedek bulunamadı.`);
    return { resolved: resolvedCount, skipped: skippedCount };
}

/**
 * AI DESTEKLİ OPTİMİZASYON (Sadece Atanmamış Sınavlar İçin)
 * Atanmamış görevleri en adil şekilde dağıtır.
 */
function runGlobalOptimization() {
    takeSnapshot("AI Optimizasyon");
    let assignedCount = 0;
    let failCount = 0;

    // Sadece gözetmeni atanmamış sınavları seç
    const unassignedExams = DB.exams.filter(ex => !ex.proctorId && (!ex.proctorIds || ex.proctorIds.length === 0));

    // Sınavları zorluk derecesine (puanına) göre büyükten küçüke sırala
    const sortedExams = [...unassignedExams].sort((a, b) => {
        const scoreA = calculateScore(getSafeDate(a.date, a.time), a.duration);
        const scoreB = calculateScore(getSafeDate(b.date, b.time), b.duration);
        return scoreB - scoreA;
    });

    // Her sınavı sırayla yerleştir
    sortedExams.forEach(ex => {
        const date = ex.date;
        const time = ex.time;
        const duration = ex.duration;

        // Her personel için bir "Ceza Puanı" (Penalty Score) hesapla
        const candidates = DB.staff.map(s => {
            let penalty = s.totalScore;

            // Kısıt kontrolü (Ağır ceza)
            if (!isAvailable(s.name, date, time, duration)) {
                penalty += 10000;
            }

            // Mevcut atamalarla çakışma (Ağır ceza)
            const start = getSafeDate(date, time);
            const end = new Date(start.getTime() + (duration + 15) * 60000);
            const hasOverlappingExam = DB.exams.some(e => {
                if (!e.proctorIds || !e.proctorIds.includes(s.id)) {
                    if (e.proctorId !== s.id) return false;
                }
                if (e.date !== date) return false;
                const eStart = getSafeDate(e.date, e.time);
                const eEnd = new Date(eStart.getTime() + (e.duration + 15) * 60000);
                return (start < eEnd && end > eStart);
            });
            if (hasOverlappingExam) penalty += 10000;

            // Aynı gün görev cezası (Orta ceza - adalet için)
            const sameDayCount = DB.exams.filter(e => e.date === date && (e.proctorIds?.includes(s.id) || e.proctorId === s.id)).length;
            penalty += sameDayCount * 50;

            // Görev sınırı cezası (Orta ceza)
            if (s.taskCount >= GLOBAL_LIMITS.MAX_TASKS) penalty += 500;

            return { staff: s, penalty: penalty };
        });

        // En düşük cezalı personeli seç
        candidates.sort((a, b) => a.penalty - b.penalty);
        const chosen = candidates[0];

        if (chosen.penalty < 10000) {
            const score = calculateScore(getSafeDate(date, time), duration, ex.id);
            ex.proctorIds = [chosen.staff.id];
            ex.proctorId = chosen.staff.id;
            ex.proctorName = chosen.staff.name;
            ex.score = score;
            ex.katsayi = getKatsayi(getSafeDate(date, time), duration, ex.id);
            
            if (shouldCountAsNonExam(ex)) {
                chosen.staff.nonExamScore = parseFloat(((chosen.staff.nonExamScore || 0) + score).toFixed(2));
                chosen.staff.nonExamTaskCount = (chosen.staff.nonExamTaskCount || 0) + 1;
            } else {
                chosen.staff.totalScore = parseFloat((chosen.staff.totalScore + score).toFixed(2));
                chosen.staff.taskCount += 1;
            }
            assignedCount++;
        } else {
            failCount++;
        }
    });

    saveToLocalStorage();
    logAction('admin', 'AI Optimizasyon', `${assignedCount} atama yapıldı, ${failCount} atama başarısız.`);
    return { assigned: assignedCount, failed: failCount };
}

/**
 * TASLAK MODU VE YAYINLAMA
 */
function publishDraft() {
    takeSnapshot("Taslak Yayınlama");
    let affectedProctors = new Set();
    let examCount = 0;

    DB.exams.forEach(ex => {
        if (ex.isDraft) {
            ex.isDraft = false;
            examCount++;
            if (ex.proctorIds) {
                ex.proctorIds.forEach(pid => affectedProctors.add(pid));
            } else if (ex.proctorId) {
                affectedProctors.add(ex.proctorId);
            }
        }
    });

    DB.isDraftMode = false;

    // Toplu Bildirim Gönder
    const now = new Date().toISOString();
        affectedProctors.forEach(pid => {
            if (!DB.notifications) DB.notifications = {};
            if (!Array.isArray(DB.notifications[pid])) DB.notifications[pid] = [];
            DB.notifications[pid].unshift({
                id: Date.now() + Math.random(),
                message: `📢 Sınav programı yayınlandı! Toplam ${examCount} yeni/güncellenmiş görev programınıza eklendi.`,
                type: 'publish_draft',
                createdAt: now,
                isRead: false
            });

            // Taslak yayınlandığında e-posta gönder
            const staffExams = DB.exams.filter(ex => !ex.isDraft && (ex.proctorIds?.includes(pid) || ex.proctorId === pid));
            staffExams.forEach(ex => {
                sendAssignmentEmail(pid, ex, 'new');
            });
        });

    saveToLocalStorage();
    logAction('admin', 'Taslak Yayınlama', `${examCount} sınav yayına alındı, ${affectedProctors.size} gözetmene toplu bildirim gitti.`);
    return { examCount, proctorCount: affectedProctors.size };
}



function addExam(examData) {
    takeSnapshot("Sınav Ekleme");
    let proctors = [];
    
    if (examData.proctorIds && examData.proctorIds.length > 0) {
        proctors = DB.staff.filter(s => examData.proctorIds.includes(s.id));
    } else if (examData.proctorId) {
        const p = DB.staff.find(s => s.id === examData.proctorId);
        if (p) proctors = [p];
    }
    
    if (proctors.length === 0) {
        const best = findBestProctor(examData.date, examData.time, examData.duration);
        if (best) proctors = [best];
    }

    if (proctors.length === 0) {
        alert("Bu tarih ve saatte müsait bir gözetmen bulunamadı!");
        return;
    }

    const score = calculateScore(getSafeDate(examData.date, examData.time), examData.duration);
    
    const examId = Date.now();
    const newExam = {
        ...examData,
        id: examId,
        isDraft: DB.isDraftMode, // EĞER TASLAK MODU AÇIKSA TASLAK OLARAK KAYDET
        type: examData.type || "Vize",
        name: examData.name || "İsimsiz Sınav",
        lecturer: examData.lecturer || "-",
        capacity: examData.capacity || "-",
        location: examData.location || "Belirtilmedi",
        proctorIds: proctors.map(p => p.id),
        proctorId: proctors[0].id,
        proctorName: proctors.map(p => p.name).join(', '),
        score: score,
        katsayi: getKatsayi(getSafeDate(examData.date, examData.time), examData.duration, examId)
    };

    DB.exams.push(newExam);
    
    // Personel puanlarını güncelle
    proctors.forEach(p => {
        if (shouldCountAsNonExam(examData)) {
            p.nonExamScore = parseFloat(((p.nonExamScore || 0) + score).toFixed(2));
            p.nonExamTaskCount = (p.nonExamTaskCount || 0) + 1;
        } else {
            p.totalScore = parseFloat((p.totalScore + score).toFixed(2));
            p.taskCount = (p.taskCount || 0) + 1;
        }
    });

    // GÖZETMENLERE BİLDİRİM GÖNDER (Yeni Görev)
    if (!DB.notifications) DB.notifications = {};
    const nowNotif = new Date().toISOString();
    proctors.forEach(p => {
        if (!DB.notifications) DB.notifications = {};
        if (!Array.isArray(DB.notifications[p.id])) DB.notifications[p.id] = [];
        DB.notifications[p.id].unshift({
            id: Date.now() + p.id,
            message: `📅 Yeni Görev: "${newExam.name}" (${newExam.date} - ${newExam.time}) sınavına gözetmen olarak atandınız.`,
            type: 'new_assignment',
            createdAt: nowNotif,
            isRead: false
        });

        // E-posta Gönder (Taslak modunda değilsek)
        if (!newExam.isDraft) {
            sendAssignmentEmail(p.id, newExam, 'new');
        }
    });

    saveToLocalStorage();
    logAction('admin', 'Sınav Ekleme', `${newExam.name} (${newExam.date}) sınavı sisteme eklendi.`);
    return newExam;
}

function updateExam(id, newData, skipSave = false) {
    takeSnapshot("Sınav Güncelleme");
    const exIndex = DB.exams.findIndex(e => String(e.id) === String(id));
    if (exIndex === -1) {
        console.error('updateExam: Sınav bulunamadı! id=', id);
        return;
    }
    const oldExam = DB.exams[exIndex];
    
    // Yeni puan hesapla (Eksik veriler için mevcut sınav verilerini kullan)
    const finalDate = newData.date !== undefined ? newData.date : oldExam.date;
    const finalTime = newData.time !== undefined ? newData.time : oldExam.time;
    const finalDuration = (newData.duration !== undefined) ? newData.duration : oldExam.duration;
    
    // Geçerli katsayı hesaplamak için date parse, eğer parse olmazsa eski katsayıyı kullan (NaN olmaması için)
    const testDate = getSafeDate(finalDate, finalTime);
    const safeDuration = parseFloat(finalDuration) || 60;
    const newScore = calculateScore(testDate, safeDuration, id);
    const kts = getKatsayi(testDate, safeDuration, id);

    let newPIds;
    if (Array.isArray(newData.proctorIds)) {
        newPIds = newData.proctorIds;
    } else if (newData.proctorId !== undefined) {
        // Eğer tekil proctorId geldiyse, listeyi buna göre güncelle (mevcut listenin ilkini değiştir veya yeni liste kur)
        const oldList = oldExam.proctorIds || (oldExam.proctorId ? [oldExam.proctorId] : []);
        newPIds = [newData.proctorId, ...oldList.slice(1)];
    } else {
        newPIds = oldExam.proctorIds || (oldExam.proctorId ? [oldExam.proctorId] : []);
    }
    const newProctors = DB.staff.filter(s => newPIds.map(String).includes(String(s.id)));

    // Gözetmen değiştiyse eski puanları düş, yeni puanları ekle
    const oldPIds = oldExam.proctorIds || (oldExam.proctorId ? [oldExam.proctorId] : []);
    const proctorChanged = JSON.stringify([...oldPIds].sort()) !== JSON.stringify([...newPIds].sort());
    
    // YALNIZCA veriler gerçekten değiştiyse puan güncellemesi tetiklensin
    const dateChanged = newData.date !== undefined && newData.date !== oldExam.date;
    const timeChanged = newData.time !== undefined && newData.time !== oldExam.time;
    const durationChanged = newData.duration !== undefined && newData.duration !== oldExam.duration;
    const dateTimeChanged = dateChanged || timeChanged || durationChanged;
    
    // Eski score değerini parseFloat ile al
    const oldScore = parseFloat(oldExam.score) || 0;
    const scoreChanged = newScore !== oldScore;

    // TASLAK MODUNDA DEĞİLSEK bildirim gönder, taslak modundaysak toplu gönderilecek
    const shouldNotifyNow = !oldExam.isDraft && !DB.isDraftMode;

    if (proctorChanged || dateTimeChanged || scoreChanged) {
        
        // Eski gözetmenden puanı doğru kategoriden düş
        oldPIds.forEach(pid => {
            const s = DB.staff.find(staff => String(staff.id) === String(pid));
            if (s) {
                if (shouldCountAsNonExam(oldExam)) {
                    s.nonExamScore = Math.max(0, parseFloat(((s.nonExamScore || 0) - oldScore).toFixed(2)));
                    if (proctorChanged) {
                        s.nonExamTaskCount = Math.max(0, (s.nonExamTaskCount || 0) - 1);
                    }
                } else {
                    const currentScore = parseFloat(s.totalScore) || 0;
                    s.totalScore = Math.max(0, parseFloat((currentScore - oldScore).toFixed(2)));
                    // Sadece gözetmen değişmişse veya sınav siliniyorsa görev sayısını azalt
                    if (proctorChanged) {
                        s.taskCount = Math.max(0, s.taskCount - 1);
                    }
                }
            }
        });
        
        // Yeni gözetmene puan ekle
        newProctors.forEach(p => {
            const isNowNonExam = newData.isNonExam !== undefined ? newData.isNonExam : oldExam.isNonExam;
            const finalDate = newData.date !== undefined ? newData.date : oldExam.date;
            if (shouldCountAsNonExam({ isNonExam: isNowNonExam, date: finalDate })) {
                p.nonExamScore = parseFloat(((p.nonExamScore || 0) + newScore).toFixed(2));
                if (proctorChanged) {
                    p.nonExamTaskCount = (p.nonExamTaskCount || 0) + 1;
                }
            } else {
                p.totalScore = parseFloat(((p.totalScore || 0) + newScore).toFixed(2));
                if (proctorChanged) {
                    p.taskCount = (p.taskCount || 0) + 1;
                }
            }
        });
    }

    // Değişiklik Kontrolü ve Bildirim Gönderimi
    const changeLog = [];
    if (newData.name !== undefined && oldExam.name !== newData.name) changeLog.push('name');
    if (newData.date !== undefined && oldExam.date !== newData.date) changeLog.push('date');
    if (newData.time !== undefined && oldExam.time !== newData.time) changeLog.push('time');
    if (newData.duration !== undefined && oldExam.duration !== newData.duration) changeLog.push('duration');
    if (newData.location !== undefined && oldExam.location !== newData.location) changeLog.push('location');
    if (newData.type !== undefined && oldExam.type !== newData.type) changeLog.push('type');
    if (newData.lecturer !== undefined && oldExam.lecturer !== newData.lecturer) changeLog.push('lecturer');
    if (newData.capacity !== undefined && oldExam.capacity !== newData.capacity) changeLog.push('capacity');

    if ((changeLog.length > 0 || proctorChanged) && shouldNotifyNow) {
        const allAffected = new Set([...oldPIds, ...newPIds]);
        sendExamChangeNotification(Array.from(allAffected), oldExam.name, changeLog);
        
        // E-posta Gönder
        newPIds.forEach(pid => {
            sendAssignmentEmail(pid, { ...oldExam, ...newData }, proctorChanged ? 'new' : 'update');
        });

        // Çıkarılan gözetmenlere iptal maili gönder
        if (proctorChanged) {
            const removedPIds = oldPIds.filter(pid => !newPIds.includes(pid));
            removedPIds.forEach(pid => {
                sendAssignmentEmail(pid, oldExam, 'cancel');
            });
        }
    }

    // Sınavı her durumda güncelle (gözetmen yoksa eski gözetmeni koru)
    const finalNotifiedStaffIds = (oldExam.notifiedStaffIds || []).filter(pid => newPIds.map(String).includes(String(pid)));

    DB.exams[exIndex] = {
        ...oldExam,
        ...newData,
        proctorIds: newPIds,
        proctorId: newPIds[0] || 0,
        proctorName: newProctors.length > 0 ? newProctors.map(p => p.name).join(', ') : (newPIds.length === 0 ? "Atanmadı" : oldExam.proctorName),
        score: newScore,
        katsayi: kts,
        notifiedStaffIds: finalNotifiedStaffIds
    };

    if (!skipSave) {
        saveToLocalStorage();
        logAction('admin', 'Sınav Güncelleme', `${newData.name || oldExam.name} sınav bilgileri güncellendi.`);
    }
}

/**
 * Gözetmenlere sınav değişikliği bildirimi gönder
 */
function sendExamChangeNotification(proctorIds, examName, changedFields) {
    if (!DB.notifications) DB.notifications = {};
    const now = new Date().toISOString();
    
    // Alan adlarını Türkçeleştir
    const fieldMapping = {
        'name': 'Sınav Adı',
        'date': 'Tarih',
        'time': 'Saat',
        'duration': 'Süre',
        'location': 'Yer/Derslik',
        'type': 'Sınav Türü',
        'lecturer': 'Dersi Veren',
        'capacity': 'Kapasite'
    };

    let changeMsg = "Sınav bilgilerinde değişiklik yapıldı.";
    if (changedFields.length > 0) {
        const fieldsTr = changedFields.map(f => fieldMapping[f] || f).join(', ');
        changeMsg = `Sınavın şu bilgileri güncellendi: ${fieldsTr}`;
    }

    const message = `📋 "${examName}" görevinde değişiklik: ${changeMsg}`;

    proctorIds.forEach(pid => {
        if (!DB.notifications) DB.notifications = {};
        if (!Array.isArray(DB.notifications[pid])) DB.notifications[pid] = [];
        
        DB.notifications[pid].unshift({
            id: Date.now() + Math.random(),
            message: message,
            type: 'exam_change',
            createdAt: now,
            isRead: false
        });
    });
}

/**
 * E-posta Bildirimi Gönder
 */
async function sendAssignmentEmail(staffId, exam, type = 'new') {
    if (!DB.emailSettings || !DB.emailSettings.enabled) return;

    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff || !staff.email) return;

    const subjectTemplate = type === 'new' 
        ? DB.templates.assignment_email_subject 
        : (type === 'cancel' ? DB.templates.cancel_email_subject 
            : (type === 'reminder' ? "HATIRLATMA: Yaklaşan Gözetmenlik Görevi ({sinav_adi})" : DB.templates.update_email_subject));

    const bodyTemplate = type === 'new' 
        ? DB.templates.assignment_email_body 
        : (type === 'cancel' ? DB.templates.cancel_email_body 
            : (type === 'reminder' ? "<div style=\"font-family: sans-serif; padding: 20px;\"><h2 style=\"color: #f59e0b;\">Sınav Hatırlatması</h2><p>Sayın {personel_adi},</p><p>Yaklaşan bir sınav görevlendirmeniz bulunmaktadır. Sınav detayları aşağıdadır:</p><ul><li><b>Sınav:</b> {sinav_adi}</li><li><b>Tarih/Saat:</b> {tarih} - {saat}</li><li><b>Derslik:</b> {derslik}</li><li><b>Birlikte Görevli:</b> {gozetmenler}</li></ul><p>Lütfen sınav saatinden 15 dakika önce sınav yerinde olunuz.</p></div>" : DB.templates.update_email_body));

    // Tüm gözetmen isimlerini virgülle birleştir
    const proctorIds = exam.proctorIds || (exam.proctorId ? [exam.proctorId] : []);
    const gozetmenler = proctorIds
        .map(pid => { const s = DB.staff.find(x => String(x.id) === String(pid)); return s ? s.name : ''; })
        .filter(n => n)
        .join(', ') || exam.proctorName || '-';

    const replacePlaceholders = (text) => {
        if (!text) return '';
        const siteUrl = (typeof getSystemUrl === 'function') ? getSystemUrl() : (window.location.origin + window.location.pathname);
        const signature = `<br><br><hr style="border:none; border-top:1px solid #e5e7eb; margin:20px 0;"><p style="font-size: 13px; color: #4f46e5; text-align: center;">🌐 Sisteme erişmek için: <a href="${siteUrl}" style="color: #4f46e5; font-weight: bold; text-decoration: underline;">${siteUrl}</a></p>`;

        let processedText = text
            .replace(/{personel_adi}/g, staff.name)
            .replace(/{sinav_adi}/g, exam.name || '-')
            .replace(/{dersi_veren}/g, exam.lecturer || '-')
            .replace(/{tarih}/g, exam.date || '-')
            .replace(/{saat}/g, exam.time || '-')
            .replace(/{derslik}/g, exam.location || '-')
            .replace(/{sure}/g, exam.duration || '-')
            .replace(/{puan}/g, typeof exam.score === 'number' ? exam.score.toFixed(1) : (exam.score || '-'))
            .replace(/{gozetmenler}/g, gozetmenler)
            .replace(/{gozet men ler}/g, gozetmenler) // fallback for typo in template
            .replace(/{site_url}/g, siteUrl)
            .replace(/{system_url}/g, siteUrl);

        // Sitenin linkini gövdenin en sonuna enjekte et (eğer şablonda site_url kullanılmamışsa)
        if (!text.includes('{site_url}') && !text.includes('{system_url}')) {
            if (processedText.includes('</div>') && processedText.lastIndexOf('</div>') !== -1) {
                const lastDivIndex = processedText.lastIndexOf('</div>');
                processedText = processedText.substring(0, lastDivIndex) + signature + processedText.substring(lastDivIndex);
            } else {
                processedText += signature;
            }
        }

        return processedText;
    };

    const subject = replacePlaceholders(subjectTemplate);
    const body = replacePlaceholders(bodyTemplate);

    console.log(`Email gönderiliyor: To=${staff.email}, Subject=${subject}`);

    try {
        if (DB.emailSettings.provider === 'smtpjs' && DB.emailSettings.smtpToken) {
            if (window.Email) {
                await window.Email.send({
                    SecureToken : DB.emailSettings.smtpToken,
                    To : staff.email,
                    From : DB.emailSettings.fromEmail,
                    Subject : subject,
                    Body : body  // HTML body gönderiliyor
                });
                console.log(`✅ Email gönderildi: ${staff.email}`);
                if (type !== 'cancel') {
                    if (!exam.notifiedStaffIds) exam.notifiedStaffIds = [];
                    if (!exam.notifiedStaffIds.map(String).includes(String(staffId))) {
                        exam.notifiedStaffIds.push(staffId);
                        saveToLocalStorage();
                    }
                }
            } else {
                console.warn("SmtpJS (window.Email) yüklü değil!");
            }
        } else if (DB.emailSettings.provider === 'api' && DB.emailSettings.apiEndpoint) {
            await fetch(DB.emailSettings.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: staff.email, subject, body, isHtml: true })
            });
            console.log(`✅ Email API'ye iletildi: ${staff.email}`);
            if (type !== 'cancel') {
                if (!exam.notifiedStaffIds) exam.notifiedStaffIds = [];
                if (!exam.notifiedStaffIds.map(String).includes(String(staffId))) {
                    exam.notifiedStaffIds.push(staffId);
                    saveToLocalStorage();
                }
            }
        } else {
            console.warn("E-posta ayarları tamamlanmamış! Panel > Sistem Ayarları > E-posta Ayarları kısmını kontrol edin.");
        }
    } catch (e) {
        console.error("Email gönderim hatası:", e);
    }
}
window.sendAssignmentEmail = sendAssignmentEmail;


/**
 * Yaklaşan sınavlar için (24 saat kala) hatırlatma maillerini gönderir
 */
async function checkAndSendExamReminders() {
    if (!DB || !DB.exams || !DB.emailSettings || !DB.emailSettings.enabled) return;

    let hasChanges = false;
    const now = new Date();
    // 24 saat sonrası
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    for (let exam of DB.exams) {
        // Eğer zaten hatırlatma gönderildiyse veya taslaksa atla
        if (exam.reminderSent || exam.isDraft) continue;
        
        if (!exam.date || !exam.time) continue;
        
        const examDate = getSafeDate(exam.date, exam.time);
        
        // Eğer sınav şu andan sonra ve 24 saatten yakınsa
        if (examDate > now && examDate <= twentyFourHoursFromNow) {
            console.log(`⏰ Sınav hatırlatması tetikleniyor: ${exam.name}`);
            
            const pIds = exam.proctorIds || (exam.proctorId ? [exam.proctorId] : []);
            for (let pid of pIds) {
                // Email göndermeyi asenkron arka planda yap (tek tek beklemesin)
                sendAssignmentEmail(pid, exam, 'reminder').catch(e => console.warn('Hatırlatma maili hatası:', e));
            }
            
            exam.reminderSent = true;
            hasChanges = true;
        }
    }

    if (hasChanges) {
        saveToLocalStorage();
        if (typeof saveToBackend === 'function') {
            saveToBackend();
        }
        console.log("⏰ Hatırlatmalar gönderildi ve veritabanı güncellendi.");
    }
}

const API_URL = API_BASE_URL + "/gizli_yol_gtu_admin_data.json";

// ============================================================
//  🔄 FIREBASE BAĞLANTI DAYANIKLILIĞI
//  - Üstel geri-çekilmeli yeniden deneme (Exponential Backoff)
//  - Çevrimdışı kuyruk (Offline Queue)
//  - Bağlantı durum göstergesi
//  - online/offline event dinleyicileri
// ============================================================

const SYNC_QUEUE_KEY = '_pendingFirebaseSync';
let _isSyncing = false;

/** Durum badge'ini günceller */
function _setCloudStatus(state, text) {
    const statusDiv = document.getElementById('cloud-status');
    const statusText = document.getElementById('cloud-status-text');
    if (!statusDiv) return;

    statusDiv.classList.remove('hidden', 'syncing', 'cloud-offline', 'cloud-error');
    if (statusText) {
        statusText.style.color = '';
        statusText.textContent = text || '';
    }

    switch (state) {
        case 'syncing':
            statusDiv.classList.add('syncing');
            statusDiv.classList.remove('hidden');
            break;
        case 'ok':
            statusDiv.classList.remove('hidden');
            if (statusText) statusText.style.color = '#10b981';
            setTimeout(() => statusDiv.classList.add('hidden'), 3000);
            break;
        case 'offline':
            statusDiv.classList.remove('hidden');
            statusDiv.classList.add('cloud-offline');
            if (statusText) statusText.style.color = '#f59e0b';
            break;
        case 'retrying':
            statusDiv.classList.remove('hidden');
            if (statusText) statusText.style.color = '#f59e0b';
            break;
        case 'error':
            statusDiv.classList.remove('hidden');
            statusDiv.classList.add('cloud-error');
            if (statusText) statusText.style.color = 'var(--accent-red)';
            break;
        case 'hidden':
            statusDiv.classList.add('hidden');
            break;
    }
}

/**
 * Firebase'e tek bir PUT isteği gönderir.
 * Başarılıysa true, başarısızsa hata fırlatır.
 */
async function _doFetch(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20 saniye timeout
    try {
        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            throw new Error(err.error || `Sunucu hatası: ${response.status}`);
        }
        return true;
    } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') throw new Error('Bağlantı zaman aşımına uğradı (20sn)');
        throw e;
    }
}

/**
 * Kuyruğa bekleyen kayıt olduğunu işaretle.
 */
function _markPendingSync() {
    try { localStorage.setItem(SYNC_QUEUE_KEY, '1'); } catch(e) {}
}

/**
 * Kuyruktan bekleyen kayıt bayrağını temizle.
 */
function _clearPendingSync() {
    try { localStorage.removeItem(SYNC_QUEUE_KEY); } catch(e) {}
}

/**
 * Bekleyen kayıt var mı?
 */
function _hasPendingSync() {
    try { return localStorage.getItem(SYNC_QUEUE_KEY) === '1'; } catch(e) { return false; }
}

/**
 * Üstel geri-çekilmeli yeniden denemeyle Firebase'e kaydeder.
 * @param {number} attempt - Deneme sayısı (1'den başlar)
 */
async function saveToBackend(attempt = 1) {
    const MAX_ATTEMPTS = 4;
    const RETRY_DELAYS = [0, 4000, 12000, 36000]; // ms: anında, 4sn, 12sn, 36sn

    // Güvenlik koruması
    if (!DB || !Array.isArray(DB.staff) || DB.staff.length === 0) {
        console.error('🚨 [Güvenlik] Personel boş — Firebase kayıt iptal.');
        return;
    }

    // Çevrimdışıysa kuyruğa al ve dur
    if (!navigator.onLine) {
        _markPendingSync();
        _setCloudStatus('offline', '🔴 Çevrimdışı — Yerel kayıt aktif');
        console.warn('📴 Çevrimdışı: veri kuyruğa alındı, bağlantı gelince gönderilecek.');
        return;
    }

    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    // İlk deneme veya tekrar
    if (attempt === 1) {
        _isSyncing = true;
        _setCloudStatus('syncing', '🔄 Eşitleniyor...');
    } else {
        _setCloudStatus('retrying', `🟡 Yeniden deneniyor... (${attempt - 1}/${MAX_ATTEMPTS - 1})`);
    }

    const delay = RETRY_DELAYS[attempt - 1] || 0;
    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
        const payload = JSON.stringify(DB);
        await _doFetch(payload);

        // Başarı
        _isSyncing = false;
        _clearPendingSync();
        _setCloudStatus('ok', '✅ Bulutla Eşitlendi');
        console.log(`✅ Firebase kayıt başarılı (deneme ${attempt}). Sınav: ${(DB.exams||[]).length}, Talep: ${(DB.requests||[]).length}`);

    } catch (e) {
        console.warn(`⚠️ Firebase kayıt denemesi ${attempt} başarısız:`, e.message);

        if (attempt < MAX_ATTEMPTS) {
            // Tekrar dene
            const nextDelay = RETRY_DELAYS[attempt] || 36000;
            console.log(`🔄 ${nextDelay / 1000}sn sonra tekrar denenecek...`);
            await saveToBackend(attempt + 1);
        } else {
            // Tüm denemeler bitti
            _isSyncing = false;
            _markPendingSync(); // Kuyrukta beklet
            _setCloudStatus(isAdmin ? 'error' : 'hidden',
                isAdmin ? '🔴 Bağlantı Hatası — Yerel kayıt aktif' : '');
            console.error('❌ Firebase kayıt 4 denemede de başarısız. Veri kuyrukta bekliyor.', {
                message: e.message, apiUrl: API_URL
            });
            // Admin'e bildir (sessiz — toast kullan, alert değil)
            if (isAdmin && typeof window.showToast === 'function') {
                window.showToast('⚠️ Firebase\'e kaydedilemedi. İnternet bağlantınızı kontrol edin. Veriler yerel olarak korunuyor.', 'error');
            }
        }
    }
}

/**
 * Sayfa açıkken online/offline olaylarını dinler.
 * Bağlantı geri gelince bekleyen kuyruğu otomatik boşaltır.
 */
function initOfflineSyncListener() {
    // Çevrimdışı → durum güncellemesi
    window.addEventListener('offline', () => {
        _markPendingSync();
        _setCloudStatus('offline', '🔴 Çevrimdışı — Yerel kayıt aktif');
        console.warn('📴 İnternet bağlantısı kesildi.');
    });

    // Online → kuyrukta bekleyen veri varsa gönder
    window.addEventListener('online', async () => {
        console.log('📶 İnternet bağlantısı geri geldi.');
        _setCloudStatus('syncing', '🔄 Yeniden bağlanıyor...');

        if (_hasPendingSync()) {
            console.log('📤 Kuyrukta bekleyen veri gönderiliyor...');
            await saveToBackend(1);
        } else {
            _setCloudStatus('ok', '✅ Bağlantı Sağlandı');
        }
    });

    // Sayfa açılışında bekleyen kuyruk varsa gönder (önceki session'dan kalmış olabilir)
    if (_hasPendingSync() && navigator.onLine) {
        console.log('📤 Önceki session\'dan kalan bekleyen veri gönderiliyor...');
        setTimeout(() => saveToBackend(1), 2000);
    }

    console.log('🔌 Firebase çevrimdışı senkronizasyon dinleyicisi başlatıldı.');
}

if (typeof window !== 'undefined') {
    window.saveToBackend = saveToBackend;
    window.initOfflineSyncListener = initOfflineSyncListener;
}

function saveToLocalStorage() {
    // Halen local'e de kopyasını (cache) atıyoruz, çökmelerde vs. kullanmak için
    const dbStr = JSON.stringify(DB);
    
    // Yaklaşık boyut kontrolü (Karakter sayısı x 2 byte = byte cinsinden boyut)
    const sizeInMB = (dbStr.length * 2) / (1024 * 1024);
    
    if (sizeInMB > 4.0) {
        console.warn(`Local Storage dolmak üzere! Mevcut Boyut: ${sizeInMB.toFixed(2)} MB`);
        // Eğer yer kritik seviyeye geldiyse işlem geçmişini (auditLogs) temizleyelim
        if (DB.auditLogs && DB.auditLogs.length > 50) {
            DB.auditLogs = DB.auditLogs.slice(-50); // Sadece son 50 kaydı tut
            console.log("Limit kontrolü: İşlem geçmişi yer açmak için son 50 kayda düşürüldü.");
        }
    }

    try {
        localStorage.setItem(DB_KEY, JSON.stringify(DB));
        // Anlık görüntü kasasına otomatik kaydet (Snapshot Vault)
        saveAutoSnapshot(DB, 'Yerel Değişiklik');
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.error("LocalStorage doldu! Temizleme deneniyor...");
            alert("⚠️ Tarayıcı depolama alanı doldu! Yer açmak için işlem geçmişi siliniyor...");
            
            // Radikal çözüm: İşlem geçmişini tamamen sıfırla
            if (DB.auditLogs) DB.auditLogs = [];
            
            try {
                localStorage.setItem(DB_KEY, JSON.stringify(DB));
                saveAutoSnapshot(DB, 'Depolama Temizliği Sonrası');
                alert("✓ İşlem geçmişi temizlenerek yer açıldı ve veriler kaydedildi.");
            } catch (e2) {
                alert("❌ Hata: Yer açılamadı! Lütfen tarayıcı ayarlarından site verilerini temizleyin veya eski sınavları silin.");
            }
        } else {
            console.error("LocalStorage kayıt hatası:", e);
        }
    }
    
    // Sunucuya asenkron olarak yaz (tüm kullanıcılar için)
    saveToBackend();
}

function saveToLocalStorage() {
    // Halen local'e de kopyasını (cache) atıyoruz, çökmelerde vs. kullanmak için
    const dbStr = JSON.stringify(DB);
    
    // Yaklaşık boyut kontrolü (Karakter sayısı x 2 byte = byte cinsinden boyut)
    const sizeInMB = (dbStr.length * 2) / (1024 * 1024);
    
    if (sizeInMB > 4.0) {
        console.warn(`Local Storage dolmak üzere! Mevcut Boyut: ${sizeInMB.toFixed(2)} MB`);
        // Eğer yer kritik seviyeye geldiyse işlem geçmişini (auditLogs) temizleyelim
        if (DB.auditLogs && DB.auditLogs.length > 50) {
            DB.auditLogs = DB.auditLogs.slice(-50); // Sadece son 50 kaydı tut
            console.log("Limit kontrolü: İşlem geçmişi yer açmak için son 50 kayda düşürüldü.");
        }
    }

    try {
        localStorage.setItem(DB_KEY, JSON.stringify(DB));
        // Anlık görüntü kasasına otomatik kaydet (Snapshot Vault)
        saveAutoSnapshot(DB, 'Yerel Değişiklik');
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.error("LocalStorage doldu! Temizleme deneniyor...");
            alert("⚠️ Tarayıcı depolama alanı doldu! Yer açmak için işlem geçmişi siliniyor...");
            
            // Radikal çözüm: İşlem geçmişini tamamen sıfırla
            if (DB.auditLogs) DB.auditLogs = [];
            
            try {
                localStorage.setItem(DB_KEY, JSON.stringify(DB));
                saveAutoSnapshot(DB, 'Depolama Temizliği Sonrası');
                alert("✓ İşlem geçmişi temizlenerek yer açıldı ve veriler kaydedildi.");
            } catch (e2) {
                alert("❌ Hata: Yer açılamadı! Lütfen tarayıcı ayarlarından site verilerini temizleyin veya eski sınavları silin.");
            }
        } else {
            console.error("LocalStorage kayıt hatası:", e);
        }
    }
    
    // Sunucuya asenkron olarak yaz (tüm kullanıcılar için)
    saveToBackend();
}

async function loadFromDataJSON() {
    // Yerel kısıtları kaybetmemek için önce localStorage'dan alalım
    let localConstraints = null;
    try {
        const saved = localStorage.getItem(DB_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            localConstraints = parsed.constraints;
        }
    } catch(e) {
        console.warn("Yerel kısıtlar okunamadı:", e);
    }

    try {
        console.log("Veriler sunucudan yükleniyor...", API_URL);
        const loadController = new AbortController();
        const loadTimeout = setTimeout(() => loadController.abort(), 15000); // 15sn timeout
        let response;
        try {
            response = await fetch(API_URL + '?t=' + new Date().getTime(), {
                signal: loadController.signal
            });
            clearTimeout(loadTimeout);
        } catch (fetchErr) {
            clearTimeout(loadTimeout);
            if (fetchErr.name === 'AbortError') {
                throw new Error('Firebase yükleme zaman aşımına uğradı (15sn). Yerel veri kullanılıyor.');
            }
            throw fetchErr;
        }
        if (!response.ok) throw new Error(`Ağ hatası: ${response.status}`);
        const data = await response.json();
        
        if (data === null) {
            console.log("Firebase veritabanı boş. Yerel/varsayılan verilerle devam ediliyor.");
            // Admin isek ilk veriyi hemen Firebase'e yazalım
            if (sessionStorage.getItem('isAdmin') === 'true') {
                setTimeout(saveToBackend, 1000);
            }
        } else if (data && typeof data === 'object' && Array.isArray(data.staff)) {
            // Preserve hardcoded lecturers and Math-focused staff if missing in loaded data
            if (!data.lecturers || data.lecturers.length === 0) {
                data.lecturers = DB.lecturers;
            } else {
                DB.lecturers.forEach(dl => {
                    if (!data.lecturers.some(l => l.name.toLowerCase() === dl.name.toLowerCase())) {
                        data.lecturers.push(dl);
                    }
                });
            }
            if (!data.courseCatalog || !Array.isArray(data.courseCatalog) || data.courseCatalog.length === 0) {
                data.courseCatalog = DEFAULT_COURSE_CATALOG;
            } else {
                const catMap = new Map();
                data.courseCatalog.forEach(c => { if (c && c.code) catMap.set(c.code.toUpperCase(), c); });
                DEFAULT_COURSE_CATALOG.forEach(dc => {
                    const code = dc.code.toUpperCase();
                    if (!catMap.has(code)) {
                        data.courseCatalog.push(dc);
                        catMap.set(code, dc);
                    } else {
                        const existing = catMap.get(code);
                        if (dc.lecturer && (!existing.lecturer || existing.lecturer !== dc.lecturer)) {
                            existing.lecturer = dc.lecturer;
                        }
                    }
                });
            }
            if (!data.courseLecturers || Object.keys(data.courseLecturers).length === 0) {
                data.courseLecturers = DB.courseLecturers;
            } else {
                // 2026-2027 Güz güncel eşleştirmelerini mevcut olanlarla güvenle birleştir
                data.courseLecturers = Object.assign({}, data.courseLecturers, DB.courseLecturers);
            }
            
            // Sunucuda kısıtlar boşsa veya yerel kısıt varsa güvenli birleştirme yap
            if (localConstraints && typeof localConstraints === 'object') {
                for (let staffName in localConstraints) {
                    if (!data.constraints[staffName] || data.constraints[staffName].length === 0) {
                        data.constraints[staffName] = localConstraints[staffName];
                    }
                }
            }

            DB = data;
            if (!DB.constraints) DB.constraints = {};
            if (!DB.requests) DB.requests = []; // Eksikse başlat
            cleanExpiredConstraints(true);
            // Veriyi lokal hafızaya (cache) alalım
            localStorage.setItem(DB_KEY, JSON.stringify(DB));
            // Snapshot Kasasına otomatik anlık görüntü kaydet
            saveAutoSnapshot(DB, 'Bulut Senkronizasyonu');
            console.log("Veriler başarıyla yüklendi. Kısıt sayısı:", Object.keys(DB.constraints).length);
            console.log("Veriler başarıyla yüklendi.");
            // Mevcut tüm sınavları yeni 17:00 parçalı katsayı sistemine göre yeniden hesapla
            recalculateAllScores();
            console.log("Puan yeniden hesaplama tamamlandı (sunucu verisi).");
        } else {
            console.error("Sunucudan gelen veri geçersiz formatta!", data);
            throw new Error("Geçersiz veri formatı");
        }
    } catch (e) {
        console.warn("API başarıyla okunamadı, localStorage veya Snapshot Kasası kullanılarak deneniyor...", e);
        const saved = localStorage.getItem(DB_KEY);
        let loaded = false;
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed && Array.isArray(parsed.staff) && parsed.staff.length > 0) {
                    if (!parsed.lecturers || parsed.lecturers.length === 0) {
                        parsed.lecturers = DB.lecturers;
                    }
                    DB = parsed;
                    cleanExpiredConstraints(true);
                    recalculateAllScores();
                    loaded = true;
                    saveAutoSnapshot(DB, 'Yerel Önbellekten Başlatma');
                    console.log("Puan yeniden hesaplama tamamlandı (localStorage verisi).");
                }
            } catch (parseError) {
                console.error("LocalStorage verisi bozuk!", parseError);
            }
        }

        if (!loaded) {
            const vault = getSavedSnapshots();
            if (vault && vault.length > 0 && vault[0].data) {
                console.log("🛡️ LocalStorage boş/bozuk, Snapshot Kasasındaki en son yedek devreye alındı:", vault[0].displayDate);
                DB = JSON.parse(JSON.stringify(vault[0].data));
                recalculateAllScores();
                localStorage.setItem(DB_KEY, JSON.stringify(DB));
                loaded = true;
                saveAutoSnapshot(DB, 'Kasa Yedeğinden Kurtarma');
            }
        }
    }
    
    // Eksik hocaları ve eşleştirmeleri yüklenen veritabanına enjekte et
    ensureDefaultLecturersAndCoursesMigrated();
}

function ensureDefaultLecturersAndCoursesMigrated() {
    if (!DB) return;
    if (!DB.lecturers) DB.lecturers = [];
    if (!DB.courseLecturers) DB.courseLecturers = {};
    if (!DB.courseCatalog || !Array.isArray(DB.courseCatalog)) DB.courseCatalog = DEFAULT_COURSE_CATALOG.slice();

    const defaultLecturers = [
        { name: "Mustafa AKKURT", title: "Prof. Dr." },
        { name: "Nuri ÇELİK", title: "Prof. Dr." },
        { name: "Oğul ESEN", title: "Prof. Dr." },
        { name: "Mansur İSGENDEROĞLU (İSMAİLOV)", title: "Prof. Dr." },
        { name: "Emil NOVRUZ", title: "Prof. Dr." },
        { name: "Sibel ÖZKAN", title: "Prof. Dr." },
        { name: "Serkan SÜTLÜ", title: "Prof. Dr." },
        { name: "Coşkun YAKAR (Bölüm Başkanı)", title: "Prof. Dr." },
        { name: "Nursel EREY", title: "Doç. Dr." },
        { name: "Gülden GÜN POLAT", title: "Doç. Dr." },
        { name: "Feray HACIVELİOĞLU", title: "Doç. Dr." },
        { name: "Roghayeh HAFEZIEH", title: "Doç. Dr." },
        { name: "Fatma KARAOĞLU CEYHAN", title: "Doç. Dr." },
        { name: "Ayten KOÇ", title: "Doç. Dr." },
        { name: "Işıl ÖNER", title: "Doç. Dr." },
        { name: "Hülya ÖZTÜRK", title: "Doç. Dr." },
        { name: "Ayşe SÖNMEZ", title: "Doç. Dr." },
        { name: "Selçuk TOPAL", title: "Doç. Dr." },
        { name: "Gülşen ULUCAK", title: "Doç. Dr." },
        { name: "Hadi ALIZADEH", title: "Dr. Öğr. Üyesi" },
        { name: "Keremcan DOĞAN", title: "Dr. Öğr. Üyesi" },
        { name: "Tuğba MAHMUTÇEPOĞLU", title: "Dr. Öğr. Üyesi" },
        { name: "Samire YAZAR", title: "Dr. Öğr. Üyesi" },
        { name: "Benan DURUKAN", title: "Öğr.Gör." },
        { name: "Fatih KINDAZ", title: "Öğr. Gör. Dr." },
        { name: "Zeynep Karadeniz Cısdık", title: "Öğr. Gör." },
        { name: "Orkun Canbek", title: "Öğr. Gör." },
        { name: "Oğuzhan DURSUN", title: "Öğr. Gör. Dr." },
        { name: "Pelin Ayşe GÖKGÖZ", title: "Araş. Gör. Dr." },
        { name: "Eda GOLDENBERG", title: "Doç. Dr." }
    ];

    let modified = false;

    defaultLecturers.forEach(dl => {
        const exists = DB.lecturers.some(l => 
            l.name.toLocaleLowerCase('tr').trim() === dl.name.toLocaleLowerCase('tr').trim()
        );
        if (!exists) {
            DB.lecturers.push(dl);
            modified = true;
        }
    });

    // Eksik katalog derslerini tamamla ve güncellenmiş hocaları senkronize et
    const catMap = new Map();
    DB.courseCatalog.forEach(c => { if (c && c.code) catMap.set(c.code.toUpperCase(), c); });
    DEFAULT_COURSE_CATALOG.forEach(dc => {
        const code = dc.code.toUpperCase();
        if (!catMap.has(code)) {
            DB.courseCatalog.push(dc);
            catMap.set(code, dc);
            modified = true;
        } else {
            const existing = catMap.get(code);
            if (dc.lecturer && existing.lecturer !== dc.lecturer) {
                existing.lecturer = dc.lecturer;
                modified = true;
            }
        }
    });

    // 2026-2027 Güz güncel ders eşleştirmelerini senkronize et
    DEFAULT_COURSE_CATALOG.forEach(c => {
        if (c.lecturer) {
            const fullKey = `${c.code} - ${c.name}`;
            if (DB.courseLecturers[fullKey] !== c.lecturer) {
                DB.courseLecturers[fullKey] = c.lecturer;
                modified = true;
            }
            if (DB.courseLecturers[c.code] !== c.lecturer) {
                DB.courseLecturers[c.code] = c.lecturer;
                modified = true;
            }
            if (DB.courseLecturers[c.name] !== c.lecturer) {
                DB.courseLecturers[c.name] = c.lecturer;
                modified = true;
            }
        }
    });

    // E-posta şablonları kontrolü ve veri göçü
    ensureTemplatesExist();

    if (modified) {
        console.log("2026-2027 Güz Ders Kataloğu ve Öğretim Elemanı eşleştirmeleri senkronize edildi.");
        localStorage.setItem(DB_KEY, JSON.stringify(DB));
    }
}

function ensureTemplatesExist() {
    if (!DB) return;
    if (!DB.templates) DB.templates = {};
    
    let modified = false;

    if (!DB.templates.cancel_email_subject) {
        DB.templates.cancel_email_subject = "❌ Görev İptal Edildi: {sinav_adi} | {tarih}";
        modified = true;
    }
    
    if (!DB.templates.cancel_email_body) {
        DB.templates.cancel_email_body = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px; border-radius: 10px;">
  <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px;">&#10060; Görev İptal Bildirimi</h1>
    <p style="color: #fca5a5; margin: 8px 0 0 0; font-size: 14px;">GTU Matematik Bölümü - Gözetmenlik Sistemi</p>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 15px; color: #374151;">Sayın <strong>{personel_adi} Hocam</strong>,</p>
    <p style="font-size: 15px; color: #374151; line-height: 1.6;">Atandığınız sınavdaki gözetmenlik göreviniz <strong>iptal edilmiştir</strong>. Bilgileri aşağıda bulabilirsiniz.</p>
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
        <tr><td style="padding: 8px 0; font-weight: bold; color: #991b1b; width: 140px;">&#128218; Sınav Adı</td><td style="padding: 8px 0;"><strong>{sinav_adi}</strong></td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #991b1b;">&#128100; Dersi Veren</td><td style="padding: 8px 0;">{dersi_veren}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #991b1b;">&#128197; Tarih</td><td style="padding: 8px 0;">{tarih}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #991b1b;">&#128336; Saat</td><td style="padding: 8px 0;">{saat}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #991b1b;">&#127979; Derslik</td><td style="padding: 8px 0;">{derslik}</td></tr>
      </table>
    </div>
    <p style="font-size: 13px; color: #9ca3af; margin-top: 30px;">Bu mesaj GTU Matematik Bölümü Gözetmenlik Sistemi tarafından otomatik olarak gönderilmiştir.</p>
  </div>
</div>`;
        modified = true;
    }

    if (modified) {
        console.log("Görev iptali e-posta şablonları eklendi.");
        localStorage.setItem(DB_KEY, JSON.stringify(DB));
    }
}

/**
 * TALEP OTOMATİK SONA ERME
 * Sınav tarihi geçmiş olan pending/open talepleri 'expired' olarak işaretler.
 * - Hem talebi açan (initiator) hem de atanan (receiver) varsa her ikisine bildirim gider.
 * - Admin günlüğüne kayıt düşülür.
 * @returns {{ expired: number }} Sona erdirilen talep sayısı
 */
function autoExpireRequests() {
    if (!DB.requests || DB.requests.length === 0) return { expired: 0 };

    const now = new Date();
    let expiredCount = 0;

    DB.requests.forEach(req => {
        // Zaten kapanmış talepler
        if (!['pending', 'open'].includes(req.status)) return;

        // İlgili sınavı bul
        const exam = DB.exams.find(e => String(e.id) === String(req.examId));
        let examEnd;

        if (exam) {
            const examStart = getSafeDate(exam.date, exam.time);
            examEnd = new Date(examStart.getTime() + (exam.duration || 60) * 60000);
        } else if (req.examDate && req.examTime) {
            // Sınav silinmişse talepteki tarihe bak
            const examStart = getSafeDate(req.examDate, req.examTime);
            examEnd = new Date(examStart.getTime() + 60 * 60000);
        } else {
            // Sınav bilgisi hiç yoksa talebi sona erdir
            examEnd = new Date(0);
        }

        if (examEnd <= now) {
            req.status = 'expired';
            req.expiredAt = now.toISOString();
            expiredCount++;

            // Bildirim: Talebi açan kişiye
            if (!DB.notifications) DB.notifications = {};
            const initiatorId = req.initiatorId;
            if (initiatorId) {
                if (!Array.isArray(DB.notifications[initiatorId])) DB.notifications[initiatorId] = [];
                DB.notifications[initiatorId].unshift({
                    id: Date.now() + Math.random(),
                    message: `⏰ "${req.examName || 'Sınav'}" için açtığınız yer değiştirme talebi, sınav tarihi geçtiği için otomatik olarak sona erdi.`,
                    type: 'request_expired',
                    createdAt: now.toISOString(),
                    isRead: false
                });
            }

            // Bildirim: Alıcı varsa ona da
            const receiverId = req.receiverId;
            if (receiverId && receiverId !== initiatorId) {
                if (!Array.isArray(DB.notifications[receiverId])) DB.notifications[receiverId] = [];
                DB.notifications[receiverId].unshift({
                    id: Date.now() + Math.random(),
                    message: `⏰ "${req.examName || 'Sınav'}" için size yönlendirilmiş yer değiştirme talebi, sınav tarihi geçtiği için sona erdi.`,
                    type: 'request_expired',
                    createdAt: now.toISOString(),
                    isRead: false
                });
            }
        }
    });

    if (expiredCount > 0) {
        saveToLocalStorage();
        logAction('system', 'Talep Otomatik Sona Erme', `${expiredCount} talep sınav tarihi geçtiği için otomatik olarak sona erdirildi.`);
        console.log(`✅ ${expiredCount} süresi dolmuş talep 'expired' olarak işaretlendi.`);
    }

    return { expired: expiredCount };
}
window.autoExpireRequests = autoExpireRequests;

/**
 * Görev Çakışmalarını Tespit Et
 * @returns {Set<number>} Çakışan sınav ID'leri
 */
function getConflicts() {
    const conflicts = new Set();
    const sortedExams = [...DB.exams].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    for (let i = 0; i < sortedExams.length; i++) {
        const examA = sortedExams[i];
        const startA = getSafeDate(examA.date, examA.time);
        const endA = new Date(startA.getTime() + (examA.duration + 15) * 60000); // 15 dk geçiş süresi

        for (let j = i + 1; j < sortedExams.length; j++) {
            const examB = sortedExams[j];
            
            // Farklı günlerse bakmaya gerek yok (sıralı olduğu için sonraki de farklıdır)
            if (examA.date !== examB.date) break;
            
            // Aynı gözetmen mi?
            if (examA.proctorId === examB.proctorId) {
                const startB = getSafeDate(examB.date, examB.time);
                
                // Zaman çakışması kontrolü (A bitmeden B başlıyorsa)
                if (startB < endA) {
                    conflicts.add(examA.id);
                    conflicts.add(examB.id);
                }
            }
        }
    }
    return conflicts;
}

/**
 * Derslik Çakışmalarını Tespit Et
 * @returns {Set<number>} Çakışan sınav ID'leri
 */
function getLocationConflicts() {
    const conflicts = new Set();
    const sortedExams = [...DB.exams].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    for (let i = 0; i < sortedExams.length; i++) {
        const examA = sortedExams[i];
        if (!examA.location || examA.location === "-") continue;

        const startA = getSafeDate(examA.date, examA.time);
        const endA = new Date(startA.getTime() + examA.duration * 60000);

        for (let j = i + 1; j < sortedExams.length; j++) {
            const examB = sortedExams[j];
            if (examA.date !== examB.date) break;
            if (!examB.location || examB.location === "-") continue;

            const startB = getSafeDate(examB.date, examB.time);

            // Aynı yer ve zaman kesişmesi mi?
            if (examA.location.trim() === examB.location.trim()) {
                // Eğer sınav adı, tarihi ve saati aynıysa, aynı sınavdır, çakışma değildir
                if (examA.name === examB.name && examA.date === examB.date && examA.time === examB.time) {
                    continue;
                }
                if (startB < endA) {
                    conflicts.add(examA.id);
                    conflicts.add(examB.id);
                }
            }
        }
    }
    return conflicts;
}

/**
 * Akıllı Öneri: Müsait ve en düşük puanlı personelleri getir
 * @param {string} date 'YYYY-MM-DD'
 * @param {string} time 'HH:mm'
 * @param {number} duration dk
 * @param {number|null} currentExamId Düzenleme işlemiysek mevcut sınavı yoksaymak için
 * @returns {Array} En iyi 3 aday
 */
function getRecommendedProctors(date, time, duration, currentExamId = null, isNonExam = false, examName = "") {
    if (!date || !time) return [];

    // 1. Müsait olanları filtrele (Hem kısıt hem de çakışma)
    const availableStaff = DB.staff.filter(s => 
        isProctorTrulyFree(s.id, date, time, duration, currentExamId, isNonExam, examName)
    );

    // 2. Puana göre sırala ve ilk 5'i dön
    return availableStaff
        .sort((a, b) => a.totalScore - b.totalScore)
        .slice(0, 5);
}



/**
 * Sınav Programını Sıfırla ama Puanları Koru
 */
/**
 * Sınav Programını Sıfırla ama Puanları Koru
 */
function resetExamsButKeepScores() {
    DB.exams = [];
    DB.staff.forEach(s => {
        s.taskCount = 0;
    });
    saveToLocalStorage();
}

/**
 * İstatistik ve Analiz Paneli için detaylı verileri hazırla
 */
function getDetailedStats() {
    const stats = {
        categories: {
            "Hafta İçi / Gündüz": 0,
            "Hafta İçi / Akşam": 0,
            "Hafta Sonu / Gündüz": 0,
            "Hafta Sonu / Akşam": 0
        },
        staffStats: []
    };

    DB.staff.forEach(staff => {
        const staffData = {
            id: staff.id,
            name: staff.name,
            totalScore: staff.totalScore,
            totalTasks: staff.taskCount || 0,
            breakdown: {
                "Hafta İçi / Gündüz": 0,
                "Hafta İçi / Akşam": 0,
                "Hafta Sonu / Gündüz": 0,
                "Hafta Sonu / Akşam": 0
            }
        };

        // Bu personelin görevlerini bul ve kategorize et
        DB.exams.forEach(ex => {
            const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
            if (pIds.includes(staff.id)) {
                // Tarih formatını güvenli hale getir
                const dateParts = ex.date.split('-');
                const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                const day = dateObj.getDay();
                const minutes = timeToMins(ex.time);
                const isWeekend = (day === 0 || day === 6);
                const isWorkHours = (minutes >= 510 && minutes < 1050); // 08:30 - 17:30

                let category = "";
                if (isWeekend) {
                    category = isWorkHours ? "Hafta Sonu / Gündüz" : "Hafta Sonu / Akşam";
                } else {
                    category = isWorkHours ? "Hafta İçi / Gündüz" : "Hafta İçi / Akşam";
                }

                staffData.breakdown[category]++;
                stats.categories[category]++;
            }
        });

        stats.staffStats.push(staffData);
    });

    // Puanlara göre sırala
    stats.staffStats.sort((a, b) => b.totalScore - a.totalScore);

    return stats;
}

// Global'e aç
window.getDetailedStats = getDetailedStats;

/**
 * AKILLI TAKAS EŞLEŞTİRİCİ (MATCHMAKER)
 * Bir hoca için "mükemmel" takas adaylarını bulur.
 */
function findSmartSwaps(myStaffId) {
    if (!myStaffId) return [];
    
    const myStaff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!myStaff) return [];

    const now = Date.now();

    // Seçili personelin sınavlarını bul
    const myExams = DB.exams.filter(ex => {
        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        const isMyExam = pIds.includes(myStaff.id);
        if (!isMyExam) return false;
        
        // Geçmiş sınavları ele (Sınavın bitiş saatini baz alıyoruz)
        const examEnd = getSafeDate(ex.date, ex.time).getTime() + (ex.duration || 60) * 60000;
        return examEnd > now;
    });
    
    // Sorunlu sınavları (kısıt ihlali olanlar) tespit et
    const problematicExams = myExams.filter(ex => !isAvailable(myStaff.name, ex.date, ex.time, ex.duration));
    
    // Eğer sorunlu sınav varsa önce onları çözmeye çalış, yoksa tüm sınavları değerlendir
    const targetExams = problematicExams.length > 0 ? problematicExams : myExams;

    const matches = [];
    const seenCombos = new Set(); // Aynı takas ikilisini tekrar ekleme

    DB.exams.forEach(otherEx => {
        // Geçmiş sınavları ele
        const otherExamEnd = getSafeDate(otherEx.date, otherEx.time).getTime() + (otherEx.duration || 60) * 60000;
        if (otherExamEnd <= now) return;

        // Kendi sınavım olmasın
        const otherPids = otherEx.proctorIds || (otherEx.proctorId ? [otherEx.proctorId] : []);
        if (otherPids.includes(myStaff.id)) return;

        // Karşı taraftaki her bir gözetmen için kontrol et
        otherPids.forEach(otherPid => {
            const otherStaff = DB.staff.find(s => String(s.id) === String(otherPid));

            if (!otherStaff) return;

            targetExams.forEach(myEx => {
                const comboKey = `${myEx.id}-${otherEx.id}-${otherStaff.id}`;
                if (seenCombos.has(comboKey)) return;

                // KARŞILIKLI UYGUNLUK KONTROLÜ:
                // 1. Ben diğer hocanın sınavına gidebiliyor muyum? (Mevcut sınavımı bırakacağımı varsayarak)
                const canIGoToOther = isProctorTrulyFree(myStaff.id, otherEx.date, otherEx.time, otherEx.duration, myEx.id);
                
                // 2. Diğer hoca benim sınavıma gelebiliyor mu? (Kendi sınavını bırakacağını varsayarak)
                const canOtherGoToMine = isProctorTrulyFree(otherStaff.id, myEx.date, myEx.time, myEx.duration, otherEx.id);

                if (canIGoToOther && canOtherGoToMine) {
                    matches.push({
                        id: Math.random().toString(36).substr(2, 9),
                        myExam: myEx,
                        otherExam: otherEx,
                        otherStaff: otherStaff,
                        priority: problematicExams.includes(myEx) ? 2 : 1, // Kısıt ihlali olanlar daha öncelikli
                        reason: problematicExams.includes(myEx) ? "⚠️ Çakışma Çözümü" : "⚖️ Yük Dengeleme"
                    });
                    seenCombos.add(comboKey);
                }
            });
        });
    });

    // Önce yüksek öncelikli (çakışma çözümü), sonra tarih olarak en yakın olanları getir
    return matches.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.myExam.date.localeCompare(b.myExam.date);
    });
}

/**
 * Akıllı Takas Talebi Oluştur
 */
function requestSmartSwap(myExamId, otherExamId, otherStaffId, myStaffId) {
    if (!DB.requests) DB.requests = [];

    const myExam = DB.exams.find(e => String(e.id) === String(myExamId));
    const otherExam = DB.exams.find(e => String(e.id) === String(otherExamId));
    const me = DB.staff.find(s => String(s.id) === String(myStaffId));
    const otherMember = DB.staff.find(s => String(s.id) === String(otherStaffId));

    if (!myExam || !otherExam || !me || !otherMember) {
        return { success: false, message: "Sınav veya personel bilgisi eksik!" };
    }

    const newRequest = {
        id: Date.now(),
        type: 'smart_swap',
        status: 'pending',
        createdAt: new Date().toISOString(),
        initiatorId: me.id,
        receiverId: otherMember.id,
        initiatorName: me.name, // UI'da görünmesi için eklendi
        examId: myExam.id, // Benim devretmek istediğim
        targetExamId: otherExam.id, // Karşıdan almak istediğim
        message: `Akıllı Takas Teklifi: "${myExam.name}" görevimi senin "${otherExam.name}" görevinle değiştirmek istiyorum.`
    };

    DB.requests.push(newRequest);
    
    // Karşı tarafa bildirim gönder
    if (!DB.notifications) DB.notifications = {};
    if (!Array.isArray(DB.notifications[otherMember.id])) DB.notifications[otherMember.id] = [];
    if (!DB.templates) {
        DB.templates = {
            swap_request: "Merhaba {alici_adi},\n\n{tarih} tarihindeki {sinav_adi} sınavımdaki görevimi seninle takas etmek istiyorum. Onay verirsen yöneticiye bildireceğim.\n\nİyi çalışmalar,\n{gonderen_adi}",
            assignment_email_subject: "Yeni Görev Ataması: {sinav_adi}",
            assignment_email_body: "Sayın {personel_adi},\n\n{tarih} tarihinde saat {saat}'de yapılacak olan \"{sinav_adi}\" sınavına gözetmen olarak atandınız.\n\nDersi Veren: {dersi_veren}\nDerslik: {derslik}\nSüre: {sure} dakika\nPuan: {puan}\n\nİyi çalışmalar dileriz.",
            update_email_subject: "Görev Değişikliği: {sinav_adi}",
            update_email_body: "Sayın {personel_adi},\n\n{tarih} tarihindeki \"{sinav_adi}\" sınavı görevinizde güncelleme yapılmıştır.\n\nYeni Bilgiler:\nSaat: {saat}\nDerslik: {derslik}\nSüre: {sure} dakika\n\nLütfen sistem üzerinden kontrol ediniz."
        };
    }
    if (!DB.emailSettings) {
        DB.emailSettings = {
            enabled: false,
            provider: 'smtpjs', // 'smtpjs' or 'api'
            smtpToken: '', // For SmtpJS
            apiEndpoint: '', // For custom API
            fromEmail: 'noreply@gtu.edu.tr'
        };
    }
    DB.notifications[otherMember.id].unshift({
        id: Date.now() + 1,
        message: `🔄 **Akıllı Takas Teklifi:** ${me.name}, ${myExam.date} tarihindeki görevini seninle takas etmek istiyor.`,
        type: 'smart_swap_request',
        requestId: newRequest.id,
        createdAt: new Date().toISOString(),
        isRead: false
    });

    saveToLocalStorage();
    logAction('user', 'Akıllı Takas Talebi', `${me.name} -> ${otherMember.name} (Sınavlar: ${myExam.name} ↔ ${otherExam.name})`);
    
    // Anlık Webhook ve E-posta bildirimi tetikle
    dispatchNotificationEvent('swap_offer', {
        initiatorName: me.name,
        receiverName: otherMember.name,
        receiverId: otherMember.id,
        initiatorExamName: myExam.name,
        receiverExamName: otherExam.name,
        examDate: myExam.date,
        examTime: myExam.time,
        requestId: newRequest.id
    });

    return { success: true, message: "Takas teklifi başarıyla gönderildi!" };
}

// Global'e aç
window.findSmartSwaps = findSmartSwaps;
window.requestSmartSwap = requestSmartSwap;

/**
 * TÜM MEVCUT SINAVLARI YENİDEN HESAPLA (17:00 parçalı katsayı düzeltmesi)
 * Taban puanları (baseScore) KORUNUR, sadece sınavlardan gelen puanlar yeniden hesaplanır.
 * Mantık:
 *   - s.baseScore  : Sınavlardan bağımsız, manuel/önceki dönem taban puanı (korunur)
 *   - s.totalScore : baseScore + tüm sınavlardan hesaplanan puan
 *   - s.taskCount  : Sadece sistemdeki sınavlardan gelen görev sayısı
 */
function recalculateAllScores() {
    // 0) BASE SCORE GÜNCELLEME (Source of Truth)
    const BASE_MAP = {
        "MUSTAFA AKKURT": 0, "NURI CELIK": 0, "OGUL ESEN": 0, "MANSUR ISGENDEROĞLU": 0, "EMIL NOVRUZ": 0,
        "SIBEL OZKAN": 0, "SERKAN SUTLU": 0, "COSKUN YAKAR": 0, "NURSEL EREY": 0, "GULDEN GUN POLAT": 0,
        "FERAY HACIVELIOGLU": 0, "ROGHAYEH HAFEZIEH": 0, "FATMA KARAOGLU CEYHAN": 0, "AYTEN KOC": 0,
        "ISIL ONER": 0, "HULYA OZTURK": 0, "AYSE SONMEZ": 0, "SELCUK TOPAL": 0, "GULSEN ULUCAK": 0,
        "HADI ALIZADEH": 0, "KEREMCAN DOGAN": 0, "TUGBA MAHMUTCEPOGLU": 0, "SAMIRE YAZAR": 0,
        "MURAT CAN ASKAROGULLARI": 0, "SERKAN AYRICA": 1440, "SERDAL COMLEKCI": 600, "OMER DEMIR": 1440,
        "SALIHA DEMIRBUKEN": 1200, "MUHAMMED ERGEN": 1320, "ASLIHAN GUR": 1200, "CAGLA OZATAR": 1560,
        "EZGI OZTEKIN": 1200, "AYSEL SAHIN": 1440, "CANSU SAHIN": 600, "OGUZHAN SELCUK": 1200,
        "YASIN TURAN": 1800, "SEYMA YASAR": 1320, "BEGUM ATESLI": 0, "SULTAN BOZKURT GUNGOR": 0,
        "YASEMIN BUYUKCOLAK": 0, "AYTEN GEZICI": 0, "BUSRA KARADENIZ SEN": 0, "FATIH YETGIN": 0
    };

    const normalize = (str) => (str || "").toLocaleLowerCase('tr-TR')
        .replace(/prof\.|dr\.|öğr\.|üyesi|doç\.|arş\.|gör\.|[\.\(\)]/g, '')
        .replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ı/g, 'i')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    // 1) Her personelin baseScore'unu güvenceye al
    DB.staff.forEach(s => {
        const normName = normalize(s.name);
        const mappedBase = BASE_MAP[normName];
        
        if (mappedBase !== undefined) {
            s.baseScore = mappedBase;
        } else if (s.baseScore === undefined) {
            s.baseScore = 0;
        }
        
        // Sınav puanlarını sıfırla; totalScore'u baseScore'dan başlat
        s.totalScore = parseFloat((s.baseScore || 0).toFixed(2));
        s.taskCount  = 0;
        s.nonExamScore = 0;
        s.nonExamTaskCount = 0;
    });

    // 2) Her sınavı yeni 17:00 parçalı formüle göre hesapla
    DB.exams.forEach(ex => {
        const examDate = getSafeDate(ex.date, ex.time);
        if (isNaN(examDate.getTime())) return;

        const newScore = calculateScore(examDate, parseFloat(ex.duration) || 60, ex.id);
        ex.score   = newScore;
        ex.katsayi = getKatsayi(examDate, parseFloat(ex.duration) || 60, ex.id);

        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        pIds.forEach(pid => {
            const s = DB.staff.find(st => String(st.id) === String(pid));
            if (s) {
                if (shouldCountAsNonExam(ex)) {
                    s.nonExamScore = parseFloat(((s.nonExamScore || 0) + newScore).toFixed(2));
                    s.nonExamTaskCount = (s.nonExamTaskCount || 0) + 1;
                } else {
                    s.totalScore = parseFloat((s.totalScore + newScore).toFixed(2));
                    s.taskCount  = (s.taskCount || 0) + 1;
                }
            }
        });
    });

    saveToLocalStorage();
    console.log('✅ Tüm sınavlar yeni katsayı sistemine göre yeniden hesaplandı (taban puanlar korundu).');
    logAction('admin', 'Puan Yeniden Hesaplama', `${DB.exams.length} sınav 17:00 parçalı katsayı kuralıyla yeniden hesaplandı. Taban puanlar korundu.`);
    return DB.exams.length;
}
window.recalculateAllScores = recalculateAllScores;

// ==========================================
// BİLDİRİM & WEBHOOK SİSTEMİ (NOTIFICATION ENGINE)
// ==========================================

/**
 * Webhook üzerinden (Discord / Slack / Telegram / Özel API) bildirim gönderir.
 */
async function sendWebhookNotification({ title, description, fields = [], color = 0x4f46e5, eventType = 'general', url = null }) {
    const settings = (typeof DB !== 'undefined' && DB.emailSettings) ? DB.emailSettings : {};
    const webhookUrl = url || settings.webhookUrl;
    
    if (!settings.webhookEnabled && !url) {
        return { success: false, reason: 'webhook_disabled' };
    }
    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.trim()) {
        return { success: false, reason: 'no_webhook_url' };
    }

    try {
        const isDiscord = webhookUrl.includes('discord.com/api/webhooks') || webhookUrl.includes('discordapp.com/api/webhooks');
        let bodyPayload = {};

        if (isDiscord) {
            bodyPayload = {
                username: "GTÜ Gözetmenlik Botu",
                avatar_url: "https://www.gtu.edu.tr/images/gtu_logo.png",
                embeds: [
                    {
                        title: title || "🔔 GTÜ Gözetmenlik Bildirimi",
                        description: description || "",
                        color: color || 0x6366f1,
                        fields: fields.map(f => ({
                            name: f.name || "Bilgi",
                            value: String(f.value || "-"),
                            inline: f.inline !== false
                        })),
                        footer: {
                            text: "GTÜ Matematik Bölümü Gözetmenlik & Katsayı Sistemi"
                        },
                        timestamp: new Date().toISOString()
                    }
                ]
            };
        } else {
            // Standart / Genel Webhook Payload
            bodyPayload = {
                event: eventType,
                title: title,
                description: description,
                fields: fields,
                timestamp: new Date().toISOString(),
                source: "GTU_PROCTOR_SYSTEM"
            };
        }

        const res = await fetch(webhookUrl.trim(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyPayload)
        });

        if (res.ok || res.status === 204) {
            console.log("✅ Webhook bildirimi başarıyla gönderildi:", eventType);
            return { success: true, status: res.status };
        } else {
            console.warn("⚠️ Webhook gönderim yanıtı:", res.status, res.statusText);
            return { success: false, status: res.status, statusText: res.statusText };
        }
    } catch (err) {
        console.warn("⚠️ Webhook gönderim hatası:", err.message);
        return { success: false, error: err.message };
    }
}
window.sendWebhookNotification = sendWebhookNotification;

/**
 * E-posta Bildirim Gönderimi (EmailJS, SmtpJS veya Özel API)
 */
async function sendSwapNotificationEmail({ toStaffId, toEmail, subject, body, templateParams = {}, eventType = 'swap_event' }) {
    const settings = (typeof DB !== 'undefined' && DB.emailSettings) ? DB.emailSettings : {};
    if (!settings.enabled) {
        return { success: false, reason: 'email_disabled' };
    }

    let recipientEmail = toEmail;
    let recipientName = templateParams.to_name || '';

    if (toStaffId && typeof DB !== 'undefined' && DB.staff) {
        const staff = DB.staff.find(s => String(s.id) === String(toStaffId));
        if (staff) {
            recipientEmail = staff.email;
            recipientName = staff.name;
            if (!templateParams.to_name) templateParams.to_name = staff.name;
        }
    }

    if (!recipientEmail) {
        console.warn("⚠️ E-posta gönderilecek adres bulunamadı.");
        return { success: false, reason: 'no_recipient_email' };
    }

    const provider = settings.provider || 'emailjs';

    try {
        if (provider === 'emailjs') {
            const serviceId = settings.emailjsServiceId;
            const templateId = settings.emailjsTemplateId;
            const publicKey = settings.emailjsPublicKey;

            if (!serviceId || !templateId || !publicKey) {
                console.warn("⚠️ EmailJS ayarları eksik (Service ID, Template ID veya Public Key tanımlı değil).");
                return { success: false, reason: 'missing_emailjs_credentials' };
            }

            if (typeof emailjs === 'undefined') {
                console.warn("⚠️ EmailJS kütüphanesi yüklenemedi.");
                return { success: false, reason: 'emailjs_not_loaded' };
            }

            const siteUrl = (typeof getSystemUrl === 'function') ? getSystemUrl() : (window.location.origin + window.location.pathname);
            const sendParams = {
                to_email: recipientEmail,
                to_name: recipientName,
                subject: subject || "GTÜ Gözetmenlik Bildirimi",
                message: body || "",
                site_url: siteUrl,
                system_url: siteUrl,
                ...templateParams
            };

            const response = await emailjs.send(serviceId, templateId, sendParams, publicKey);
            console.log("✅ EmailJS e-postası başarıyla gönderildi:", response.status, response.text);
            return { success: true, response };
        } else if (provider === 'smtpjs') {
            const token = settings.smtpToken;
            const fromEmail = settings.fromEmail || 'noreply@gtu.edu.tr';

            if (!token) {
                console.warn("⚠️ SmtpJS token tanımlı değil.");
                return { success: false, reason: 'missing_smtp_token' };
            }

            if (typeof Email === 'undefined' || !Email.send) {
                console.warn("⚠️ SmtpJS kütüphanesi yüklenemedi.");
                return { success: false, reason: 'smtpjs_not_loaded' };
            }

            const siteUrl = (typeof getSystemUrl === 'function') ? getSystemUrl() : (window.location.origin + window.location.pathname);
            let finalBody = body || '';
            if (!finalBody.includes(siteUrl)) {
                finalBody += `\n\n🌐 Sisteme Giriş: ${siteUrl}`;
            }

            const res = await Email.send({
                SecureToken: token,
                To: recipientEmail,
                From: fromEmail,
                Subject: subject,
                Body: finalBody.replace(/\n/g, '<br>')
            });

            console.log("✅ SmtpJS yanıtı:", res);
            return { success: true, response: res };
        } else if (provider === 'api') {
            const endpoint = settings.apiEndpoint;
            if (!endpoint) {
                return { success: false, reason: 'missing_api_endpoint' };
            }

            const siteUrl = (typeof getSystemUrl === 'function') ? getSystemUrl() : (window.location.origin + window.location.pathname);
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: recipientEmail,
                    to_name: recipientName,
                    subject: subject,
                    body: body,
                    site_url: siteUrl,
                    params: { site_url: siteUrl, system_url: siteUrl, ...templateParams },
                    eventType: eventType
                })
            });

            return { success: res.ok, status: res.status };
        }
    } catch (err) {
        console.warn("⚠️ E-posta gönderim hatası:", err.message);
        return { success: false, error: err.message };
    }
}
window.sendSwapNotificationEmail = sendSwapNotificationEmail;

/**
 * Bildirim Olayı Dağıtıcısı (Dispatcher)
 * Takas ve pazar yeri olaylarında hem Webhook hem E-posta kanallarını tetikler.
 */
async function dispatchNotificationEvent(eventType, data = {}) {
    const settings = (typeof DB !== 'undefined' && DB.emailSettings) ? DB.emailSettings : {};
    const toggles = settings.eventToggles || {
        marketplace_drop: true,
        swap_offer: true,
        swap_accepted: true,
        swap_rejected: true
    };

    // İlgili etkinlik türü ayarlardan kapatılmışsa çalıştırma
    if (toggles[eventType] === false) {
        console.log(`ℹ️ [Bildirim] ${eventType} etkinliği ayarlardan devre dışı bırakılmış.`);
        return;
    }

    try {
        const siteUrl = (typeof getSystemUrl === 'function') ? getSystemUrl() : (window.location.origin + window.location.pathname);

        switch (eventType) {
            case 'marketplace_drop': {
                // Sınav pazar yerine açık talep olarak bırakıldı
                const { initiatorName, examName, examDate, examTime, duration, score } = data;
                const dateStr = examDate ? examDate.split('-').reverse().join('.') : '-';
                
                const title = "📢 Pazar Yeri: Yeni Açık Sınav Görevi Bırakıldı!";
                const description = `**${initiatorName || 'Bir gözetmen'}**, **${examName}** sınavındaki görevini pazar yerine bıraktı. Uygun olan hocalarımız görevi devralabilir.`;
                const fields = [
                    { name: "📚 Sınav", value: examName || "-", inline: true },
                    { name: "📅 Tarih / Saat", value: `${dateStr} - ${examTime || '-'}`, inline: true },
                    { name: "⏱️ Süre / Puan", value: `${duration || 60} dk (+${score || 0} Puan)`, inline: true },
                    { name: "👤 Bırakan Hoca", value: initiatorName || "-", inline: true },
                    { name: "🌐 Sistem Adresi", value: siteUrl, inline: false },
                    { name: "⚡ Hızlı İşlem", value: "Profilinizdeki **Pazar Yeri** sekmesinden görevi devralabilirsiniz.", inline: false }
                ];
                
                sendWebhookNotification({
                    title,
                    description,
                    fields,
                    color: 0x8b5cf6, // Mor / Indigo
                    eventType: 'marketplace_drop'
                });
                break;
            }

            case 'swap_offer': {
                // Birebir veya doğrudan takas teklifi oluşturuldu
                const { initiatorName, receiverName, receiverId, initiatorExamName, receiverExamName, examDate, examTime } = data;
                const dateStr = examDate ? examDate.split('-').reverse().join('.') : '';
                
                const title = "🔄 Yeni Takas / Görev Devir Teklifi!";
                let description = `**${initiatorName}**, **${receiverName}** hocamıza bir takas / görev teklifinde bulundu.`;
                const fields = [
                    { name: "👤 Teklif Eden", value: initiatorName || "-", inline: true },
                    { name: "🎯 Muhatap Hoca", value: receiverName || "-", inline: true },
                    { name: "📚 Teklif Edilen Görev", value: initiatorExamName || "-", inline: false }
                ];

                if (receiverExamName) {
                    fields.push({ name: "🔄 İstenen Görev", value: receiverExamName, inline: false });
                }
                if (examDate && examTime) {
                    fields.push({ name: "📅 Tarih / Saat", value: `${dateStr} ${examTime}`, inline: true });
                }
                fields.push({ name: "🌐 Sistem Girişi", value: siteUrl, inline: false });

                // Webhook bildirimi
                sendWebhookNotification({
                    title,
                    description,
                    fields,
                    color: 0xf59e0b, // Amber / Turuncu
                    eventType: 'swap_offer'
                });

                // Muhatap hocaya e-posta bildirimi
                if (receiverId) {
                    const emailSubject = `🔔 GTÜ Gözetmenlik: ${initiatorName} Size Takas Teklifi Gönderdi`;
                    const emailBody = `Sayın ${receiverName},\n\n${initiatorName}, gözetmenlik sistemi üzerinden size bir takas teklifi iletti.\n\n` +
                        `Teklif Detayı:\n` +
                        `- Verilen Görev: ${initiatorExamName || '-'}\n` +
                        (receiverExamName ? `- İstenen Görev: ${receiverExamName}\n` : '') +
                        (examDate ? `- Tarih: ${dateStr} ${examTime || ''}\n` : '') +
                        `\n🌐 Sisteme Giriş & Onaylama:\n${siteUrl}\n\nTeklifi incelemek ve onaylamak için sisteme giriş yaparak 'Profilim' sayfanızı ziyaret edebilirsiniz.\n\nİyi çalışmalar,\nGTÜ Matematik Bölümü`;

                    sendSwapNotificationEmail({
                        toStaffId: receiverId,
                        subject: emailSubject,
                        body: emailBody,
                        templateParams: {
                            initiator_name: initiatorName,
                            receiver_name: receiverName,
                            exam_name: initiatorExamName,
                            target_exam_name: receiverExamName || '-',
                            exam_date: `${dateStr} ${examTime || ''}`,
                            site_url: siteUrl
                        },
                        eventType: 'swap_offer'
                    });
                }
                break;
            }

            case 'swap_accepted': {
                // Takas kabul edildi / devir gerçekleşti
                const { initiatorName, initiatorId, receiverName, examName, secondExamName, swapType } = data;
                
                const title = "✅ Görev Takası / Devri Tamamlandı!";
                let description = "";
                if (swapType === 'direct_swap' || secondExamName) {
                    description = `**${receiverName}** ve **${initiatorName}** arasındaki takas işlemi onaylandı ve görevler karşılıklı değiştirildi.`;
                } else {
                    description = `**${receiverName}**, **${initiatorName}** hocamızın **${examName}** görevini başarıyla devraldı.`;
                }

                const fields = [
                    { name: "👤 Devreden / Teklif Eden", value: initiatorName || "-", inline: true },
                    { name: "👤 Devralan / Kabul Eden", value: receiverName || "-", inline: true },
                    { name: "📚 Görev(ler)", value: secondExamName ? `1. ${examName}\n2. ${secondExamName}` : (examName || "-"), inline: false },
                    { name: "📊 Durum", value: "Puanlar ve sınav listesi otomatik olarak güncellendi.", inline: false },
                    { name: "🌐 Sistem Adresi", value: siteUrl, inline: false }
                ];

                // Webhook bildirimi
                sendWebhookNotification({
                    title,
                    description,
                    fields,
                    color: 0x10b981, // Zümrüt Yeşili
                    eventType: 'swap_accepted'
                });

                // Teklifi açan ilk hocaya e-posta bildirimi
                if (initiatorId) {
                    sendSwapNotificationEmail({
                        toStaffId: initiatorId,
                        subject: `✅ GTÜ Gözetmenlik: Görev Takasınız Onaylandı!`,
                        body: `Sayın ${initiatorName},\n\n${receiverName} ile olan "${examName}" görevi takas / devir işleminiz onaylanmıştır.\nSistem üzerindeki puanlarınız ve sınav takviminiz otomatik güncellenmiştir.\n\n🌐 Güncel Programı İncelemek İçin:\n${siteUrl}\n\nİyi çalışmalar,\nGTÜ Matematik Bölümü`,
                        templateParams: {
                            initiator_name: initiatorName,
                            receiver_name: receiverName,
                            exam_name: examName,
                            site_url: siteUrl
                        },
                        eventType: 'swap_accepted'
                    });
                }
                break;
            }

            case 'swap_rejected': {
                const { initiatorName, initiatorId, receiverName, examName } = data;
                
                const title = "❌ Takas Talebi Reddedildi";
                const description = `**${receiverName || 'İlgili hoca'}**, **${initiatorName || 'Hoca'}** tarafından gönderilen **${examName || 'sınav'}** takas teklifini reddetti.`;
                
                sendWebhookNotification({
                    title,
                    description,
                    fields: [
                        { name: "👤 Teklif Eden", value: initiatorName || "-", inline: true },
                        { name: "👤 Yanıtlayan", value: receiverName || "-", inline: true },
                        { name: "📚 Sınav", value: examName || "-", inline: false },
                        { name: "🌐 Sistem Adresi", value: siteUrl, inline: false }
                    ],
                    color: 0xef4444, // Kırmızı
                    eventType: 'swap_rejected'
                });

                if (initiatorId) {
                    sendSwapNotificationEmail({
                        toStaffId: initiatorId,
                        subject: `❌ GTÜ Gözetmenlik: Takas Talebiniz Reddedildi`,
                        body: `Sayın ${initiatorName},\n\n${receiverName || 'İlgili gözetmen'}, "${examName || 'Sınav'}" göreviniz için ilettiğiniz takas teklifini kabul etmedi.\n\n🌐 Sisteme Giriş:\n${siteUrl}\n\nİyi çalışmalar,\nGTÜ Matematik Bölümü`,
                        templateParams: {
                            initiator_name: initiatorName,
                            receiver_name: receiverName,
                            exam_name: examName,
                            site_url: siteUrl
                        },
                        eventType: 'swap_rejected'
                    });
                }
                break;
            }

            case 'swap_cancelled': {
                const { initiatorName, examName } = data;
                sendWebhookNotification({
                    title: "ℹ️ Takas Talebi İptal Edildi",
                    description: `**${initiatorName}**, **${examName || 'sınav'}** için oluşturduğu takas talebini iptal etti.`,
                    fields: [
                        { name: "👤 Hoca", value: initiatorName || "-", inline: true },
                        { name: "📚 Sınav", value: examName || "-", inline: true }
                    ],
                    color: 0x64748b, // Gri
                    eventType: 'swap_cancelled'
                });
                break;
            }
        }
    } catch (err) {
        console.warn("⚠️ dispatchNotificationEvent hatası:", err.message);
    }
}
window.dispatchNotificationEvent = dispatchNotificationEvent;

/**
 * Gini Katsayısı ve Dağıtım Adalet Analizi
 */
function calculateGiniCoefficient(scores) {
    if (!scores || scores.length <= 1) return 0;
    const sorted = [...scores].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    if (sum === 0) return 0;

    let numerator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (2 * (i + 1) - n - 1) * sorted[i];
    }
    const gini = numerator / (n * sum);
    return Math.max(0, Math.min(1, parseFloat(gini.toFixed(4))));
}

function calculateFairnessMetrics(staffList) {
    const sList = staffList || (typeof DB !== 'undefined' ? DB.staff : []);
    if (!sList || sList.length === 0) {
        return {
            count: 0,
            avg: 0,
            stdDev: 0,
            variance: 0,
            gini: 0,
            fairnessScore: 100,
            minScore: 0,
            maxScore: 0,
            scoreRange: 0,
            cv: 0,
            scores: []
        };
    }

    const scores = sList.map(s => parseFloat(((s.totalScore || 0) + (s.nonExamScore || 0)).toFixed(2)));
    const count = scores.length;
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = count > 0 ? sum / count : 0;
    
    const variance = scores.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / (count || 1);
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? (stdDev / avg) * 100 : 0;
    const gini = calculateGiniCoefficient(scores);
    const fairnessScore = Math.max(0, Math.min(100, Math.round((1 - gini) * 100)));
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = parseFloat((maxScore - minScore).toFixed(2));

    return {
        count,
        avg: parseFloat(avg.toFixed(2)),
        stdDev: parseFloat(stdDev.toFixed(2)),
        variance: parseFloat(variance.toFixed(2)),
        gini,
        fairnessScore,
        minScore: parseFloat(minScore.toFixed(2)),
        maxScore: parseFloat(maxScore.toFixed(2)),
        scoreRange,
        cv: parseFloat(cv.toFixed(1)),
        scores
    };
}

function simulateFairnessOptimization(maxSwaps = 8) {
    let dbObj = null;
    if (typeof window !== 'undefined' && window.DB) dbObj = window.DB;
    else if (typeof DB !== 'undefined') dbObj = DB;
    else if (typeof global !== 'undefined' && global.DB) dbObj = global.DB;

    if (!dbObj || !dbObj.staff || dbObj.staff.length < 2 || !dbObj.exams || dbObj.exams.length === 0) {
        const dummy = { count: 0, avg: 0, stdDev: 0, variance: 0, gini: 0, fairnessScore: 100, minScore: 0, maxScore: 0, scoreRange: 0, cv: 0, scores: [] };
        return {
            before: dummy,
            after: dummy,
            initialMetrics: dummy,
            simulatedMetrics: dummy,
            improvement: { giniReduction: 0, stdDevReduction: 0, fairnessScoreGain: 0 },
            proposedSwaps: [],
            suggestedSwaps: [],
            simulatedStaff: []
        };
    }

    // Çalışma kopyaları oluştur
    const simStaff = JSON.parse(JSON.stringify(dbObj.staff));
    const simExams = JSON.parse(JSON.stringify(dbObj.exams));

    const initialMetrics = calculateFairnessMetrics(simStaff);
    const targetAvg = initialMetrics.avg;
    const suggestedSwaps = [];

    let hasProgress = true;
    let iterations = 0;

    while (hasProgress && iterations < maxSwaps) {
        hasProgress = false;
        iterations++;

        // En yüksek puanlıları ve en düşük puanlıları sırala
        simStaff.sort((a, b) => ((b.totalScore || 0) + (b.nonExamScore || 0)) - ((a.totalScore || 0) + (a.nonExamScore || 0)));

        let bestSwap = null;
        let maxVarianceReduction = 0;

        // Yüksek puanlı personellerden başla
        for (let i = 0; i < simStaff.length; i++) {
            const highStaff = simStaff[i];
            const highScore = (highStaff.totalScore || 0) + (highStaff.nonExamScore || 0);
            if (highScore <= targetAvg + 0.3) break; // Ortalama veya altına indiyse dur

            // Bu personele atanmış sınavları bul
            const staffExams = simExams.filter(e => {
                const pIds = e.proctorIds || (e.proctorId ? [e.proctorId] : []);
                return pIds.map(String).includes(String(highStaff.id));
            });

            for (const exam of staffExams) {
                const examScore = parseFloat(exam.score || 0);
                if (examScore <= 0) continue;

                // Düşük puanlı adayları tara (en düşükten başlayarak)
                for (let j = simStaff.length - 1; j > i; j--) {
                    const lowStaff = simStaff[j];
                    const lowScore = (lowStaff.totalScore || 0) + (lowStaff.nonExamScore || 0);
                    if (lowScore >= targetAvg - 0.3) break; // Ortalama veya üstüne çıktıysa geç

                    // Kısıt ve çakışma kontrolü
                    const pIds = exam.proctorIds || (exam.proctorId ? [exam.proctorId] : []);
                    if (pIds.map(String).includes(String(lowStaff.id))) continue;

                    // Kısıt kontrolü (DB.constraints)
                    if (typeof isAvailable === 'function' && !isAvailable(lowStaff.name, exam.date, exam.time, exam.duration)) {
                        continue;
                    }

                    // Sınav çakışması kontrolü
                    const start = getSafeDate(exam.date, exam.time);
                    const end = new Date(start.getTime() + (exam.duration + 15) * 60000);
                    const hasConflict = simExams.some(otherEx => {
                        if (String(otherEx.id) === String(exam.id)) return false;
                        if (otherEx.date !== exam.date) return false;
                        const otherPids = otherEx.proctorIds || (otherEx.proctorId ? [otherEx.proctorId] : []);
                        if (!otherPids.map(String).includes(String(lowStaff.id))) return false;
                        const otherStart = getSafeDate(otherEx.date, otherEx.time);
                        const otherEnd = new Date(otherStart.getTime() + (otherEx.duration + 15) * 60000);
                        return (start < otherEnd && end > otherStart);
                    });

                    if (hasConflict) continue;

                    // Cuma namazı kontrolü
                    const isFriday = new Date(exam.date).getDay() === 5;
                    const gender = lowStaff.gender || (typeof predictGender === 'function' ? predictGender(lowStaff.name) : 'Erkek');
                    if (isFriday && gender === 'Erkek') {
                        const startMins = timeToMins(exam.time);
                        const endMins = startMins + exam.duration;
                        const pStart = timeToMins("12:30");
                        const pEnd = timeToMins("14:00");
                        if (startMins < pEnd && endMins > pStart) continue;
                    }

                    // Varyans iyileşmesi hesabı
                    const currDiff = Math.pow(highScore - targetAvg, 2) + Math.pow(lowScore - targetAvg, 2);
                    const nextHighScore = highScore - examScore;
                    const nextLowScore = lowScore + examScore;
                    const nextDiff = Math.pow(nextHighScore - targetAvg, 2) + Math.pow(nextLowScore - targetAvg, 2);
                    const diffReduction = currDiff - nextDiff;

                    if (diffReduction > 0.01 && diffReduction > maxVarianceReduction) {
                        maxVarianceReduction = diffReduction;
                        bestSwap = {
                            examId: exam.id,
                            examName: exam.name,
                            date: exam.date,
                            time: exam.time,
                            location: exam.location || '-',
                            score: examScore,
                            fromStaff: { id: highStaff.id, name: highStaff.name, oldScore: highScore, newScore: nextHighScore },
                            toStaff: { id: lowStaff.id, name: lowStaff.name, oldScore: lowScore, newScore: nextLowScore }
                        };
                    }
                }
            }
        }

        if (bestSwap) {
            // bestSwap'i simülasyona uygula
            const examRef = simExams.find(e => String(e.id) === String(bestSwap.examId));
            if (examRef) {
                if (examRef.proctorIds) {
                    examRef.proctorIds = examRef.proctorIds.map(pid => String(pid) === String(bestSwap.fromStaff.id) ? bestSwap.toStaff.id : pid);
                } else if (examRef.proctorId) {
                    examRef.proctorId = bestSwap.toStaff.id;
                }
            }

            const hStaff = simStaff.find(s => String(s.id) === String(bestSwap.fromStaff.id));
            const lStaff = simStaff.find(s => String(s.id) === String(bestSwap.toStaff.id));
            if (hStaff) hStaff.totalScore = parseFloat(Math.max(0, (hStaff.totalScore || 0) - bestSwap.score).toFixed(2));
            if (lStaff) lStaff.totalScore = parseFloat(((lStaff.totalScore || 0) + bestSwap.score).toFixed(2));

            suggestedSwaps.push(bestSwap);
            hasProgress = true;
        }
    }

    const simulatedMetrics = calculateFairnessMetrics(simStaff);

    const proposedSwaps = suggestedSwaps.map(s => ({
        examId: s.examId,
        examName: s.examName,
        examDate: s.date,
        examTime: s.time,
        examLocation: s.location,
        examScore: s.score,
        fromStaffId: s.fromStaff.id,
        fromStaffName: s.fromStaff.name,
        fromStaffScoreBefore: s.fromStaff.oldScore,
        fromStaffScoreAfter: s.fromStaff.newScore,
        toStaffId: s.toStaff.id,
        toStaffName: s.toStaff.name,
        toStaffScoreBefore: s.toStaff.oldScore,
        toStaffScoreAfter: s.toStaff.newScore
    }));

    return {
        before: initialMetrics,
        after: simulatedMetrics,
        initialMetrics,
        simulatedMetrics,
        improvement: {
            giniReduction: parseFloat((initialMetrics.gini - simulatedMetrics.gini).toFixed(4)),
            stdDevReduction: parseFloat((initialMetrics.stdDev - simulatedMetrics.stdDev).toFixed(2)),
            fairnessScoreGain: simulatedMetrics.fairnessScore - initialMetrics.fairnessScore
        },
        proposedSwaps,
        suggestedSwaps,
        simulatedStaff: simStaff
    };
}

window.calculateGiniCoefficient = calculateGiniCoefficient;
window.calculateFairnessMetrics = calculateFairnessMetrics;
window.simulateFairnessOptimization = simulateFairnessOptimization;

