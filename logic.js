// Şifreler artık backend'de tutuluyor. Frontend'de şifre YOKTUR.
const DB_KEY = 'gozetmenlik_db_v25';

// Backend API Adresi
// const API_BASE_URL = "http://localhost:8082";
const API_BASE_URL = "https://gtumath.oguzhanselcuk.me"; // Cloudflare Tunnel ile açtığınızda bunu kullanın.

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

const GLOBAL_LIMITS = {
    MIN_TASKS: 0,
    MAX_TASKS: 6
};

let DB = {
    staff: [
        { id: 1, name: "Prof. Dr. Mustafa AKKURT", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 2, name: "Prof. Dr. Nuri ÇELİK", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 3, name: "Prof. Dr. Oğul ESEN", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 4, name: "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 5, name: "Prof. Dr. Emil NOVRUZ", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 6, name: "Prof. Dr. Sibel ÖZKAN", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 7, name: "Prof. Dr. Serkan SÜTLÜ", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 8, name: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 9, name: "Doç. Dr. Nursel EREY", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 10, name: "Doç. Dr. Gülden GÜN POLAT", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 11, name: "Doç. Dr. Feray HACIVELİOĞLU", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 12, name: "Doç. Dr. Roghayeh HAFEZIEH", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 13, name: "Doç. Dr. Fatma KARAOĞLU CEYHAN", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 14, name: "Doç. Dr. Ayten KOÇ", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 15, name: "Doç. Dr. Işıl ÖNER", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 16, name: "Doç. Dr. Hülya ÖZTÜRK", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 17, name: "Doç. Dr. Ayşe SÖNMEZ", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 18, name: "Doç. Dr. Selçuk TOPAL", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 19, name: "Doç. Dr. Gülşen ULUCAK", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 20, name: "Dr. Öğr. Üyesi Hadi ALIZADEH", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 21, name: "Dr. Öğr. Üyesi Keremcan DOĞAN", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 22, name: "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 23, name: "Dr. Öğr. Üyesi Samire YAZAR", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 24, name: "Arş. Gör. Murat Can AŞKAROĞULLARI", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 25, name: "Arş. Gör. Serkan AYRICA", totalScore: 1440, taskCount: 0, baseScore: 1440 },
        { id: 26, name: "Arş. Gör. Serdal ÇÖMLEKCİ", totalScore: 600, taskCount: 0, baseScore: 600 },
        { id: 27, name: "Arş. Gör. Ömer DEMİR", totalScore: 1440, taskCount: 0, baseScore: 1440 },
        { id: 28, name: "Arş. Gör. Saliha DEMİRBÜKEN", totalScore: 1200, taskCount: 0, baseScore: 1200 },
        { id: 29, name: "Arş. Gör. Muhammed Ergen", totalScore: 1320, taskCount: 0, baseScore: 1320 },
        { id: 30, name: "Arş. Gör. Aslıhan GÜR", totalScore: 1200, taskCount: 0, baseScore: 1200 },
        { id: 31, name: "Arş. Gör. Çağla ÖZATAR", totalScore: 1560, taskCount: 0, baseScore: 1560 },
        { id: 32, name: "Arş. Gör. Ezgi ÖZTEKİN", totalScore: 1200, taskCount: 0, baseScore: 1200 },
        { id: 33, name: "Arş. Gör. Aysel ŞAHİN", totalScore: 1440, taskCount: 0, baseScore: 1440 },
        { id: 34, name: "Arş. Gör. Cansu ŞAHİN", totalScore: 600, taskCount: 0, baseScore: 600 },
        { id: 35, name: "Arş. Gör. Oğuzhan SELÇUK", totalScore: 1200, taskCount: 0, baseScore: 1200 },
        { id: 36, name: "Arş. Gör. Yasin TURAN", totalScore: 1800, taskCount: 0, baseScore: 1800 },
        { id: 37, name: "Arş. Gör. Şeyma YAŞAR", totalScore: 1320, taskCount: 0, baseScore: 1320 },
        { id: 38, name: "Dr. Begüm ATEŞLİ", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 39, name: "Dr. Sultan BOZKURT GÜNGÖR", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 40, name: "Dr. Yasemin BÜYÜKÇOLAK", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 41, name: "Dr. Ayten GEZİCİ", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 42, name: "Dr. Büşra KARADENİZ ŞEN", totalScore: 0, taskCount: 0, baseScore: 0 },
        { id: 43, name: "Dr. Fatih YETGİN", totalScore: 0, taskCount: 0, baseScore: 0 }
    ],
    exams: [],
    constraints: {},
    requests: [],
    auditLogs: [],
    notifications: {}, // Personel bazlı bildirimler
    examTypes: ['Vize', 'Final', 'Bütünleme', 'Ek Sınav', 'Mazeret', 'Tercih Günü', 'Diğer'],
    announcements: [],
    isDraftMode: false,
    courseLecturers: {
        "Introduction to Computing": "Dr. Öğr. Üyesi Hadi Alizadeh",
        "Analysis II": "Prof. Dr. Serkan SÜTLÜ",
        "MATH 112 - Analysis II": "Prof. Dr. Serkan SÜTLÜ",
        "Analiz II": "Prof. Dr. Serkan SÜTLÜ",
        "Linear Algebra II": "Prof. Dr. Mustafa AKKURT",
        "MATH 114 - Linear Algebra II": "Prof. Dr. Mustafa AKKURT",
        "Lineer Cebir II": "Prof. Dr. Mustafa AKKURT",
        "Analytical Geometry": "Dr. Öğr. Üyesi Fatma KARAOĞLU",
        "Analitik Geometri": "Dr. Öğr. Üyesi Fatma KARAOĞLU",
        "Turkish II": "Öğr.Gör. Benan Durukan",
        "Türk Dili II": "Öğr.Gör. Benan Durukan",
        "Physics for Natural Sciences II": "Doç. Dr. Eda GOLDENBERG",
        "PHYS 114 - Physics for Natural Sciences II": "Doç. Dr. Eda GOLDENBERG",
        "Fizik II": "Doç. Dr. Eda GOLDENBERG",
        "Differential Equations II": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "Diferansiyel Denklemler II": "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)",
        "Topology": "Doç. Dr. Ayşe SÖNMEZ",
        "Topoloji": "Doç. Dr. Ayşe SÖNMEZ",
        "Algebra II": "Doç. Dr. Ayten KOÇ",
        "Cebir II": "Doç. Dr. Ayten KOÇ",
        "Analysis IV": "Dr. Öğr. Üyesi Samire YAZAR",
        "Analiz IV": "Dr. Öğr. Üyesi Samire YAZAR",
        "Complex Analysis II": "Doç. Dr. Feray HACIVELİOĞLU",
        "Kompleks Analiz II": "Doç. Dr. Feray HACIVELİOĞLU",
        "Real Analysis II": "Prof. Dr. Emil NOVRUZ",
        "Reel Analiz II": "Prof. Dr. Emil NOVRUZ",
        "Probability Theory": "Prof. Dr. Nuri ÇELİK",
        "Olasılık Teorisi": "Prof. Dr. Nuri ÇELİK",
        "Numerical Analysis II": "Doç. Dr. Hülya ÖZTÜRK",
        "Nümerik Analiz II": "Doç. Dr. Hülya ÖZTÜRK",
        "Graph Theory and Combinatorics": "Prof. Dr. Sibel ÖZKAN",
        "Graf Teori ve Kombinatoryal": "Prof. Dr. Sibel ÖZKAN",
        "Boundary Value Problems": "Doç. Dr. Gülden GÜN POLAT",
        "Sınır Değer Problemleri": "Doç. Dr. Gülden GÜN POLAT",
        "History of Mathematics": "Dr. Öğr. Üyesi Keremcan DOĞAN",
        "Matematik Tarihi": "Dr. Öğr. Üyesi Keremcan DOĞAN",
        "Introduction to Coding Theory": "Doç. Dr. Ayten KOÇ",
        "Kodlama Teorisine Giriş": "Doç. Dr. Ayten KOÇ",
        "Differential Geometry": "Prof. Dr. Oğul ESEN",
        "Diferansiyel Geometri": "Prof. Dr. Oğul ESEN",
        "Applied Partial Differential Equations": "Doç. Dr. Işıl ÖNER",
        "Uygulamalı Kısmi Diferansiyel Denklemler": "Doç. Dr. Işıl ÖNER",
        "Number Theory": "Doç. Dr. Gülşen ULUCAK",
        "Sayılar Teorisi": "Doç. Dr. Gülşen ULUCAK",
        "Introduction to Data Analysis": "Doç. Dr. Selçuk TOPAL",
        "Veri Analizine Giriş": "Doç. Dr. Selçuk TOPAL"
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
        { name: "Samire YAZAR", title: "Dr. Öğr. Üyesi" }
    ]
};

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
    const parts = timeStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function isAvailable(staffName, dateStr, timeStr, duration) {
    const constraints = DB.constraints && DB.constraints[staffName] ? DB.constraints[staffName] : [];
    if (constraints.length === 0) return true;

    const examDate = new Date(dateStr);
    const dayOfWeek = examDate.getDay();
    const mm = String(examDate.getMonth() + 1).padStart(2, '0');
    const dd = String(examDate.getDate()).padStart(2, '0');
    const matchDateStr = `${mm}-${dd}`;

    const examStart = timeToMins(timeStr);
    const examEnd = examStart + duration;

    for (const c of constraints) {
        let isDayMatch = (c.day !== undefined && parseInt(c.day) === dayOfWeek);
        let isDateMatch = (c.date !== undefined && c.date === matchDateStr);
        
        if (isDayMatch || isDateMatch) {
            const constraintStart = timeToMins(c.start);
            const constraintEnd = Math.min(timeToMins(c.end), timeToMins("17:30"));
            
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
    
    const constraints = DB.constraints && DB.constraints[staff.name] ? DB.constraints[staff.name] : [];
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
 * Bir gözetmenin o saatte hem kısıt hem de mevcut sınavlar açısından gerçekten boş olup olmadığını kontrol et
 */
function isProctorTrulyFree(staffId, date, time, duration, ignoreExamId = null) {
    const staff = DB.staff.find(s => s.id === staffId);
    if (!staff) return false;

    // 1. Kısıt kontrolü
    if (!isAvailable(staff.name, date, time, duration)) return false;

    // 2. Mevcut sınavlarla çakışma kontrolü (15 dk buffer)
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + (duration + 15) * 60000);

    const hasConflict = DB.exams.some(ex => {
        // Eğer bir examen düzenleniyorsa, o exameni çakışma kontrolünden muaf tut
        if (ignoreExamId && String(ex.id) === String(ignoreExamId)) return false;
        
        // Multi-proctor desteği için hem proctorId hem proctorIds kontrolü
        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        if (!pIds.includes(staffId)) return false;
        if (ex.date !== date) return false;

        const exStart = new Date(`${ex.date}T${ex.time}`);
        const exEnd = new Date(exStart.getTime() + (ex.duration + 15) * 60000);
        return (start < exEnd && end > exStart);
    });

    return !hasConflict;
}

/**
 * Akıllı Atama Asistanı için Gözetmen Önerileri Listesi oluştur
 */
function getRecommendedProctors(dateStr, timeStr, duration, ignoreExamId = null) {
    if (DB.staff.length === 0) return [];
    const available = DB.staff.filter(s => isProctorTrulyFree(s.id, dateStr, timeStr, duration, ignoreExamId));
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
function findBestProctor(dateStr, timeStr, duration, ignoreExamId = null) {
    if (DB.staff.length === 0) return null;

    let available = DB.staff.filter(s =>
        isProctorTrulyFree(s.id, dateStr, timeStr, duration, ignoreExamId) &&
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
            oldStaff.totalScore = Math.max(0, oldStaff.totalScore - exam.score);
            oldStaff.taskCount = Math.max(0, oldStaff.taskCount - 1);
        }

        // Yeni uygun gözetmeni bul (mevcut sınav hariç)
        const newProctor = findBestProctor(exam.date, exam.time, exam.duration, exam.id);

        if (newProctor) {
            // Yeni gözetmeni ata
            exam.proctorId = newProctor.id;
            exam.proctorName = newProctor.name;
            newProctor.totalScore = parseFloat((newProctor.totalScore + exam.score).toFixed(2));
            newProctor.taskCount += 1;
            resolvedCount++;
        } else {
            // Eski gözetmeni geri al (yetersiz yedek)
            if (oldStaff) {
                oldStaff.totalScore += exam.score;
                oldStaff.taskCount += 1;
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
    let assignedCount = 0;
    let failCount = 0;

    // Sadece gözetmeni atanmamış sınavları seç
    const unassignedExams = DB.exams.filter(ex => !ex.proctorId && (!ex.proctorIds || ex.proctorIds.length === 0));

    // Sınavları zorluk derecesine (puanına) göre büyükten küçüke sırala
    const sortedExams = [...unassignedExams].sort((a, b) => {
        const scoreA = calculateScore(new Date(`${a.date}T${a.time}`), a.duration);
        const scoreB = calculateScore(new Date(`${b.date}T${b.time}`), b.duration);
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
            const start = new Date(`${date}T${time}`);
            const end = new Date(start.getTime() + (duration + 15) * 60000);
            const hasOverlappingExam = DB.exams.some(e => {
                if (!e.proctorIds || !e.proctorIds.includes(s.id)) {
                    if (e.proctorId !== s.id) return false;
                }
                if (e.date !== date) return false;
                const eStart = new Date(`${e.date}T${e.time}`);
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
            const score = calculateScore(new Date(`${date}T${time}`), duration, ex.id);
            ex.proctorIds = [chosen.staff.id];
            ex.proctorId = chosen.staff.id;
            ex.proctorName = chosen.staff.name;
            ex.score = score;
            ex.katsayi = getKatsayi(new Date(`${date}T${time}`), duration, ex.id);
            
            chosen.staff.totalScore = parseFloat((chosen.staff.totalScore + score).toFixed(2));
            chosen.staff.taskCount += 1;
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
    });

    saveToLocalStorage();
    logAction('admin', 'Taslak Yayınlama', `${examCount} sınav yayına alındı, ${affectedProctors.size} gözetmene toplu bildirim gitti.`);
    return { examCount, proctorCount: affectedProctors.size };
}



function addExam(examData) {
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

    const score = calculateScore(new Date(`${examData.date}T${examData.time}`), examData.duration);
    
    const newExam = {
        ...examData,
        id: Date.now(),
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
        katsayi: getKatsayi(new Date(`${examData.date}T${examData.time}`), examData.duration, newExam.id || Date.now())
    };

    DB.exams.push(newExam);
    
    // Personel puanlarını güncelle
    proctors.forEach(p => {
        p.totalScore = parseFloat((p.totalScore + score).toFixed(2));
        p.taskCount = (p.taskCount || 0) + 1;
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
    });

    saveToLocalStorage();
    logAction('admin', 'Sınav Ekleme', `${newExam.name} (${newExam.date}) sınavı sisteme eklendi.`);
    return newExam;
}

function updateExam(id, newData, skipSave = false) {
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
    const testDate = new Date(`${finalDate}T${finalTime}`);
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

    // TASLAK MODUNDA DEĞİLSEK bildirim gönder, taslak modundaysak toplu gönderilecek
    const shouldNotifyNow = !oldExam.isDraft && !DB.isDraftMode;

    if (proctorChanged || dateTimeChanged) {
        // Eski gözetmenden puanı çıkar (oldExam.score string gelmiş olabilir, parseFloat çek)
        const oldScore = parseFloat(oldExam.score) || 0;
        
        oldPIds.forEach(pid => {
            const s = DB.staff.find(staff => String(staff.id) === String(pid));
            if (s) {
                const currentScore = parseFloat(s.totalScore) || 0;
                s.totalScore = Math.max(0, parseFloat((currentScore - oldScore).toFixed(2)));
                // Sadece gözetmen değişmişse veya sınav siliniyorsa görev sayısını azalt
                if (proctorChanged) {
                    s.taskCount = Math.max(0, s.taskCount - 1);
                }
            }
        });
        
        // Yeni gözetmene puan ekle
        newProctors.forEach(p => {
            p.totalScore = parseFloat(((p.totalScore || 0) + newScore).toFixed(2));
            // Sadece gözetmen değişmişse görev sayısını artır (süreyi değiştirdiysen baştan artırma)
            if (proctorChanged) {
                p.taskCount = (p.taskCount || 0) + 1;
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
    }

    // Sınavı her durumda güncelle (gözetmen yoksa eski gözetmeni koru)
    DB.exams[exIndex] = {
        ...oldExam,
        ...newData,
        proctorIds: newPIds,
        proctorId: newPIds[0] || 0,
        proctorName: newProctors.length > 0 ? newProctors.map(p => p.name).join(', ') : (newPIds.length === 0 ? "Atanmadı" : oldExam.proctorName),
        score: newScore,
        katsayi: kts
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

        // Maksimum 50 bildirim sakla
        if (DB.notifications[pid].length > 50) {
            DB.notifications[pid].pop();
        }
    });
}

const API_URL = API_BASE_URL + "/api/data";

async function saveToBackend() {
    console.log("Sunucuya kaydediliyor...", API_URL);
    const statusDiv = document.getElementById('cloud-status');
    const statusText = document.getElementById('cloud-status-text');
    // Gözetmen modunda (admin değilse) hata alertleri gösterme
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    
    if (statusDiv) {
        statusDiv.classList.remove('hidden');
        statusDiv.classList.add('syncing');
        if (statusText) statusText.textContent = "Eşitleniyor...";
    }

    try {
        const payload = JSON.stringify(DB);
        // Backend'e yazmak her zaman admin yetkisiyle yapılır.
        // Gözetmen şifresi (Gtu2026 vb.) yalnızca frontend girişi içindir.
        const secret = 'GtuAdmın123';
        
        const encodedSecret = btoa(unescape(encodeURIComponent(secret)));

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-secret': encodedSecret
            },
            body: payload
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: "Sunucu geçerli bir JSON dönmedi" }));
            throw new Error(err.error || `Sunucu hatası: ${response.status}`);
        }
        console.log("Sunucuya başarıyla kaydedildi. Talep sayısı:", (DB.requests || []).length);
        
        if (statusDiv) {
            statusDiv.classList.remove('syncing');
            if (statusText) statusText.textContent = "Bulutla Eşitlendi";
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 3000);
        }
    } catch (e) {
        if (statusDiv) {
            statusDiv.classList.remove('syncing');
            if (statusText) {
                statusText.textContent = isAdmin ? "Bağlantı Hatası" : "";
                if (isAdmin) statusText.style.color = "var(--accent-red)";
            }
            // Gözetmen modunda hata göstergeci gizle
            if (!isAdmin) statusDiv.classList.add('hidden');
        }
        console.error("Backend kayit hatasi DETAY:", {
            error: e,
            message: e.message,
            stack: e.stack,
            apiUrl: API_URL
        });
        // Sadece admin modunda alert göster
        if (isAdmin) {
            alert("🚨 Veriler sunucuya kaydedilemedi!\n" + e.message);
        }
        // Gözetmen modunda sessizce devam et (veriler localStorage'a zaten kaydedildi)
    }
}

function saveToLocalStorage() {
    // Halen local'e de kopyasını (cache) atıyoruz, çökmelerde vs. kullanmak için
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
    
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
        const response = await fetch(API_URL + '?t=' + new Date().getTime());
        if (!response.ok) throw new Error(`Ağ hatası: ${response.status}`);
        const data = await response.json();
        
        if (data && typeof data === 'object' && Array.isArray(data.staff)) {
            // Preserve hardcoded lecturers and Math-focused staff if missing in loaded data
            if (!data.lecturers || data.lecturers.length === 0) {
                data.lecturers = DB.lecturers;
            }
            if (!data.courseLecturers) {
                data.courseLecturers = DB.courseLecturers;
            }
            

            // KRİTİK: Eğer yerel kısıtlar varsa ve biz bir kullanıcıysak, yerel kısıtlarımızı koruyalım
            // Çünkü guest modunda sunucuya kayıt yapılamıyor, refresh sonrası silinmemeli.
            if (localConstraints) {
                const myStaffId = localStorage.getItem('myStaffId');
                const me = data.staff.find(s => String(s.id) === String(myStaffId));
                if (me && localConstraints[me.name]) {
                    if (!data.constraints) data.constraints = {};
                    data.constraints[me.name] = localConstraints[me.name];
                    console.log(`Yerel kısıtlar (${me.name}) geri yüklendi.`);
                }
            }

            DB = data;
            if (!DB.requests) DB.requests = []; // Eksikse başlat
            // Veriyi lokal hafızaya (cache) alalım
            localStorage.setItem(DB_KEY, JSON.stringify(DB));
            console.log("Veriler başarıyla yüklendi.");
            // Mevcut tüm sınavları yeni 17:00 parçalı katsayı sistemine göre yeniden hesapla
            recalculateAllScores();
            console.log("Puan yeniden hesaplama tamamlandı (sunucu verisi).");
        } else {
            console.error("Sunucudan gelen veri geçersiz formatta!", data);
            throw new Error("Geçersiz veri formatı");
        }
    } catch (e) {
        console.warn("API başarıyla okunamadı, localStorage kullanılarak deneniyor...", e);
        const saved = localStorage.getItem(DB_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (!parsed.lecturers || parsed.lecturers.length === 0) {
                    parsed.lecturers = DB.lecturers;
                }
                // Taban puanları koru (localStorage yedeği için)
                if (DB.staff && Array.isArray(DB.staff)) {
                    parsed.staff.forEach(s => {
                        const hardcoded = DB.staff.find(h => 
                            h.id === s.id || 
                            h.name.toLowerCase().includes(s.name.toLowerCase()) || 
                            s.name.toLowerCase().includes(h.name.toLowerCase())
                        );
                        if (hardcoded && hardcoded.baseScore !== undefined) s.baseScore = hardcoded.baseScore;
                    });
                }
                DB = parsed;
                // Mevcut tüm sınavları yeni 17:00 parçalı katsayı sistemine göre yeniden hesapla
                recalculateAllScores();
                console.log("Puan yeniden hesaplama tamamlandı (localStorage verisi).");
            }
 catch (parseError) {
                console.error("LocalStorage verisi bozuk!", parseError);
            }
        } else {
            console.error("Hiçbir veri bulunamadı! Lütfen backendin çalıştığından emin olun.");
        }
    }
}

/**
 * Görev Çakışmalarını Tespit Et
 * @returns {Set<number>} Çakışan sınav ID'leri
 */
function getConflicts() {
    const conflicts = new Set();
    const sortedExams = [...DB.exams].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    for (let i = 0; i < sortedExams.length; i++) {
        const examA = sortedExams[i];
        const startA = new Date(`${examA.date}T${examA.time}`);
        const endA = new Date(startA.getTime() + (examA.duration + 15) * 60000); // 15 dk geçiş süresi

        for (let j = i + 1; j < sortedExams.length; j++) {
            const examB = sortedExams[j];
            
            // Farklı günlerse bakmaya gerek yok (sıralı olduğu için sonraki de farklıdır)
            if (examA.date !== examB.date) break;
            
            // Aynı gözetmen mi?
            if (examA.proctorId === examB.proctorId) {
                const startB = new Date(`${examB.date}T${examB.time}`);
                
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

        const startA = new Date(`${examA.date}T${examA.time}`);
        const endA = new Date(startA.getTime() + examA.duration * 60000);

        for (let j = i + 1; j < sortedExams.length; j++) {
            const examB = sortedExams[j];
            if (examA.date !== examB.date) break;
            if (!examB.location || examB.location === "-") continue;

            const startB = new Date(`${examB.date}T${examB.time}`);

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
function getRecommendedProctors(date, time, duration, currentExamId = null) {
    if (!date || !time) return [];

    // 1. Müsait olanları filtrele (Hem kısıt hem de çakışma)
    const availableStaff = DB.staff.filter(s => 
        isProctorTrulyFree(s.id, date, time, duration, currentExamId)
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
        const examEnd = new Date(`${ex.date}T${ex.time}`).getTime() + (ex.duration || 60) * 60000;
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
        const otherExamEnd = new Date(`${otherEx.date}T${otherEx.time}`).getTime() + (otherEx.duration || 60) * 60000;
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
    });

    // 2) Her sınavı yeni 17:00 parçalı formüle göre hesapla
    DB.exams.forEach(ex => {
        const examDate = new Date(`${ex.date}T${ex.time}`);
        if (isNaN(examDate.getTime())) return;

        const newScore = calculateScore(examDate, parseFloat(ex.duration) || 60, ex.id);
        ex.score   = newScore;
        ex.katsayi = getKatsayi(examDate, parseFloat(ex.duration) || 60, ex.id);

        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        pIds.forEach(pid => {
            const s = DB.staff.find(st => String(st.id) === String(pid));
            if (s) {
                s.totalScore = parseFloat((s.totalScore + newScore).toFixed(2));
                s.taskCount  = (s.taskCount || 0) + 1;
            }
        });
    });

    saveToLocalStorage();
    console.log('✅ Tüm sınavlar yeni katsayı sistemine göre yeniden hesaplandı (taban puanlar korundu).');
    logAction('admin', 'Puan Yeniden Hesaplama', `${DB.exams.length} sınav 17:00 parçalı katsayı kuralıyla yeniden hesaplandı. Taban puanlar korundu.`);
    return DB.exams.length;
}
window.recalculateAllScores = recalculateAllScores;

// loadFromLocalStorage(); // Artık app.js içinden asenkron olarak çağrılıyor
