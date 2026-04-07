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

const GLOBAL_LIMITS = {
    MIN_TASKS: 3,
    MAX_TASKS: 7
};

let DB = {
    staff: [
        { id: 1, name: "Prof. Dr. Mustafa AKKURT", totalScore: 0, taskCount: 0 },
        { id: 2, name: "Prof. Dr. Nuri ÇELİK", totalScore: 0, taskCount: 0 },
        { id: 3, name: "Prof. Dr. Oğul ESEN", totalScore: 0, taskCount: 0 },
        { id: 4, name: "Prof. Dr. Mansur İSGENDEROĞLU (İSMAİLOV)", totalScore: 0, taskCount: 0 },
        { id: 5, name: "Prof. Dr. Emil NOVRUZ", totalScore: 0, taskCount: 0 },
        { id: 6, name: "Prof. Dr. Sibel ÖZKAN", totalScore: 0, taskCount: 0 },
        { id: 7, name: "Prof. Dr. Serkan SÜTLÜ", totalScore: 0, taskCount: 0 },
        { id: 8, name: "Prof. Dr. Coşkun YAKAR (Bölüm Başkanı)", totalScore: 0, taskCount: 0 },
        { id: 9, name: "Doç. Dr. Nursel EREY", totalScore: 0, taskCount: 0 },
        { id: 10, name: "Doç. Dr. Gülden GÜN POLAT", totalScore: 0, taskCount: 0 },
        { id: 11, name: "Doç. Dr. Feray HACIVELİOĞLU", totalScore: 0, taskCount: 0 },
        { id: 12, name: "Doç. Dr. Roghayeh HAFEZIEH", totalScore: 0, taskCount: 0 },
        { id: 13, name: "Doç. Dr. Fatma KARAOĞLU CEYHAN", totalScore: 0, taskCount: 0 },
        { id: 14, name: "Doç. Dr. Ayten KOÇ", totalScore: 0, taskCount: 0 },
        { id: 15, name: "Doç. Dr. Işıl ÖNER", totalScore: 0, taskCount: 0 },
        { id: 16, name: "Doç. Dr. Hülya ÖZTÜRK", totalScore: 0, taskCount: 0 },
        { id: 17, name: "Doç. Dr. Ayşe SÖNMEZ", totalScore: 0, taskCount: 0 },
        { id: 18, name: "Doç. Dr. Selçuk TOPAL", totalScore: 0, taskCount: 0 },
        { id: 19, name: "Doç. Dr. Gülşen ULUCAK", totalScore: 0, taskCount: 0 },
        { id: 20, name: "Dr. Öğr. Üyesi Hadi ALIZADEH", totalScore: 0, taskCount: 0 },
        { id: 21, name: "Dr. Öğr. Üyesi Keremcan DOĞAN", totalScore: 0, taskCount: 0 },
        { id: 22, name: "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU", totalScore: 0, taskCount: 0 },
        { id: 23, name: "Dr. Öğr. Üyesi Samire YAZAR", totalScore: 0, taskCount: 0 },
        { id: 24, name: "Arş. Gör. Murat Can AŞKAROĞULLARI", totalScore: 0, taskCount: 0 },
        { id: 25, name: "Arş. Gör. Serkan AYRICA", totalScore: 0, taskCount: 0 },
        { id: 26, name: "Arş. Gör. Serdal ÇÖLMEKCİ", totalScore: 0, taskCount: 0 },
        { id: 27, name: "Arş. Gör. Ömer DEMİR", totalScore: 0, taskCount: 0 },
        { id: 28, name: "Arş. Gör. Saliha DEMİRBÜKEN", totalScore: 0, taskCount: 0 },
        { id: 29, name: "Arş. Gör. Muhammed Ergen", totalScore: 0, taskCount: 0 },
        { id: 30, name: "Arş. Gör. Aslıhan GÜR", totalScore: 0, taskCount: 0 },
        { id: 31, name: "Arş. Gör. Çağla ÖZATAR", totalScore: 0, taskCount: 0 },
        { id: 32, name: "Arş. Gör. Ezgi ÖZTEKİN", totalScore: 0, taskCount: 0 },
        { id: 33, name: "Arş. Gör. Aysel ŞAHİN", totalScore: 0, taskCount: 0 },
        { id: 34, name: "Arş. Gör. Cansu ŞAHİN", totalScore: 0, taskCount: 0 },
        { id: 35, name: "Arş. Gör. Oğuzhan SELÇUK", totalScore: 0, taskCount: 0 },
        { id: 36, name: "Arş. Gör. Yasin TURAN", totalScore: 0, taskCount: 0 },
        { id: 37, name: "Arş. Gör. Şeyma YAŞAR", totalScore: 0, taskCount: 0 }
    ],
    exams: [],
    constraints: {},
    requests: [],
    auditLogs: [],
    notifications: {}, // Personel bazlı bildirimler
    examTypes: ['Vize', 'Final', 'Bütünleme', 'Ek Sınav', 'Mazeret', 'Tercih Günü', 'Diğer'],
    announcements: [],
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
function getKatsayi(date) {
    const day = date.getDay();
    const hour = date.getHours();
    const minutes = date.getMinutes();
    const currentTime = hour + minutes / 60;

    const isWeekend = (day === 0 || day === 6);
    
    if (isWeekend) {
        return (currentTime >= 8.5 && currentTime < 17.5) ? KATSAYILAR.HAFTA_SONU_GUNDUZ : KATSAYILAR.HAFTA_SONU_AKSAM;
    } else {
        return (currentTime >= 8.5 && currentTime < 17.5) ? KATSAYILAR.HAFTA_ICI_MESAI : KATSAYILAR.HAFTA_ICI_AKSAM;
    }
}

function calculateScore(date, duration) {
    return duration * getKatsayi(date);
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
        if (ex.proctorId !== staffId) return false;
        if (ex.date !== date) return false;

        const exStart = new Date(`${ex.date}T${ex.time}`);
        const exEnd = new Date(exStart.getTime() + (ex.duration + 15) * 60000);
        return (start < exEnd && end > exStart);
    });

    return !hasConflict;
}

/**
 * En adil gözetmen atamasını yap (hem kısıt hem sınav çakışması kontrolü ile)
 */
function findBestProctor(dateStr, timeStr, duration, ignoreExamId = null) {
    if (DB.staff.length === 0) return null;

    let available = DB.staff.filter(s =>
        isProctorTrulyFree(s.id, dateStr, timeStr, duration, ignoreExamId) &&
        (s.taskCount || 0) < GLOBAL_LIMITS.MAX_TASKS
    );

    // Eğer MAX_TASKS (7) sınırına herkes ulaştığı için müsait kimse kalmadıysa, bu sınırı esnet. 
    // Böylece test ortamında veya yoğun haftalarda "müsait gözetmen bulunamadı" hatası almayız.
    if (available.length === 0) {
        available = DB.staff.filter(s =>
            isProctorTrulyFree(s.id, dateStr, timeStr, duration, ignoreExamId)
        );
    }

    if (available.length === 0) return null;

    // SIRALAMA STRATEJİSİ: 
    // 1. Önce minimum görev sayısına (3) ulaşmamış olanlara öncelik ver
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
        type: examData.type || "Vize",
        name: examData.name || "İsimsiz Sınav",
        lecturer: examData.lecturer || "-",
        capacity: examData.capacity || "-",
        location: examData.location || "Belirtilmedi",
        proctorIds: proctors.map(p => p.id),
        proctorId: proctors[0].id,
        proctorName: proctors.map(p => p.name).join(', '),
        score: score,
        katsayi: getKatsayi(new Date(`${examData.date}T${examData.time}`))
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
        if (!DB.notifications[p.id]) DB.notifications[p.id] = [];
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
    
    // Yeni puan hesapla
    const newScore = calculateScore(new Date(`${newData.date}T${newData.time}`), newData.duration);
    const newPIds = Array.isArray(newData.proctorIds)
        ? newData.proctorIds
        : (oldExam.proctorIds || (oldExam.proctorId ? [oldExam.proctorId] : []));
    const newProctors = DB.staff.filter(s => newPIds.includes(s.id));

    // Gözetmen değiştiyse eski puanları düş, yeni puanları ekle
    const oldPIds = oldExam.proctorIds || (oldExam.proctorId ? [oldExam.proctorId] : []);
    const proctorChanged = JSON.stringify(oldPIds.slice().sort()) !== JSON.stringify(newPIds.slice().sort());
    const dateTimeChanged = oldExam.date !== newData.date || oldExam.time !== newData.time || oldExam.duration !== newData.duration;

    if (proctorChanged || dateTimeChanged) {
        // Eski gözetmenden puanı çıkar (oldExam.score string gelmiş olabilir, parseFloat çek)
        const oldScore = parseFloat(oldExam.score || 0);
        oldPIds.forEach(pid => {
            const s = DB.staff.find(staff => staff.id === pid);
            if (s) {
                s.totalScore = Math.max(0, parseFloat((s.totalScore - oldScore).toFixed(2)));
                s.taskCount = Math.max(0, s.taskCount - 1);
            }
        });
        // Yeni gözetmene puan ekle
        newProctors.forEach(p => {
            p.totalScore = parseFloat((p.totalScore + newScore).toFixed(2));
            p.taskCount = (p.taskCount || 0) + 1;
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

    if (changeLog.length > 0 || proctorChanged) {
        const allAffected = new Set([...oldPIds, ...newPIds]);
        sendExamChangeNotification(Array.from(allAffected), newData.name, changeLog);
    }

    // Sınavı her durumda güncelle (gözetmen yoksa eski gözetmeni koru)
    DB.exams[exIndex] = {
        ...oldExam,
        ...newData,
        proctorIds: newPIds,
        proctorId: newPIds[0] || 0,
        proctorName: newProctors.length > 0 ? newProctors.map(p => p.name).join(', ') : (newPIds.length === 0 ? "Atanmadı" : oldExam.proctorName),
        score: newScore,
        katsayi: getKatsayi(new Date(`${newData.date}T${newData.time}`))
    };

    if (!skipSave) {
        saveToLocalStorage();
        logAction('admin', 'Sınav Güncelleme', `${newData.name} sınav bilgileri güncellendi.`);
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
        if (!DB.notifications[pid]) DB.notifications[pid] = [];
        
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
                DB = parsed;
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
function resetExamsButKeepScores() {
    DB.exams = [];
    DB.staff.forEach(s => {
        s.taskCount = 0;
    });
    saveToLocalStorage();
}

// loadFromLocalStorage(); // Artık app.js içinden asenkron olarak çağrılıyor
