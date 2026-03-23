const SYSTEM_PASSWORD = "GtuAdmin123";
const GUEST_PASSWORD = "Gtu2026";
const DB_KEY = 'gozetmenlik_db_v30';

// --- FIREBASE YAPILANDIRMASI ---
const firebaseConfig = {
  apiKey: "AIzaSyD1D_oYBEBnEyGk0y6tKYeEcrN7u_xcLCY",
  authDomain: "gtugztmnlk.firebaseapp.com",
  databaseURL: "https://gtugztmnlk-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gtugztmnlk",
  storageBucket: "gtugztmnlk.firebasestorage.app",
  messagingSenderId: "789056586509",
  appId: "1:789056586509:web:1a28be40505d32ec1d2644",
  measurementId: "G-T2604KJ1TY"
};

// Firebase başlatma
firebase.initializeApp(firebaseConfig);
const isFirebaseActive = true;


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

// Varsayılan kısıtlamalar (İlk kurulum için)
const DEFAULT_CONSTRAINTS = {
    "Aysel Şahin": [
        { day: 4, start: "12:00", end: "17:30" }
    ],
    "Muhammed Ergen": [
        { day: 2, start: "00:00", end: "23:59" },
        { day: 4, start: "12:00", end: "17:30" }
    ],
    "Saliha Demirbüken": [
        { day: 1, start: "08:30", end: "13:30" },
        { day: 4, start: "12:30", end: "15:30" },
        { day: 5, start: "08:30", end: "13:30" },
        { day: 6, start: "00:00", end: "23:59" },
        { day: 0, start: "00:00", end: "23:59" }
    ],
    "Oğuzhan Selçuk": [
        { day: 1, start: "13:30", end: "16:20" },
        { day: 3, start: "13:30", end: "16:20" },
        { day: 4, start: "11:30", end: "14:30" }
    ],
    "Cansu Şahin": [
        { day: 1, start: "13:30", end: "16:20" },
        { day: 3, start: "13:30", end: "16:20" },
        { day: 4, start: "11:30", end: "14:30" }
    ],
    "Ezgi Öztekin": [
        { day: 1, start: "00:00", end: "23:59" },   // Pazartesi - tüm gün
        { day: 2, start: "10:00", end: "12:00" },
        { day: 4, start: "00:00", end: "23:59" },   // Perşembe - tüm gün
        { day: 5, start: "10:00", end: "11:00" },
        { date: "05-13", start: "08:30", end: "17:30" },
        { date: "05-14", start: "08:30", end: "17:30" }
    ],
    "Serdal Çömlekçi": [
        { day: 1, start: "16:00", end: "17:30" },
        { day: 2, start: "10:00", end: "12:00" },
        { day: 4, start: "13:30", end: "15:20" },
        { day: 5, start: "10:00", end: "11:00" },
        { date: "05-13", start: "08:30", end: "17:30" },
        { date: "05-14", start: "08:30", end: "17:30" }
    ],
    "Çağla Özatar": [
        { day: 1, start: "17:30", end: "23:59" },
        { day: 2, start: "17:30", end: "23:59" },
        { day: 3, start: "17:30", end: "23:59" },
        { day: 4, start: "17:30", end: "23:59" },
        { day: 5, start: "17:30", end: "23:59" },
        { day: 6, start: "00:00", end: "23:59" },
        { day: 0, start: "00:00", end: "23:59" }
    ],
    "Ömer Demir": [
        { day: 3, start: "00:00", end: "23:59" }
    ],
    "Yasin Turan": [
        { day: 6, start: "00:00", end: "23:59" }
    ]
};

let DB = {
    staff: [
        { id: 1, name: "Oğuzhan Selçuk", email: "oguzhanselcuk@gtu.edu.tr", totalScore: 1200, taskCount: 10 },
        { id: 2, name: "Ezgi Öztekin", email: "ezgioztekin@gtu.edu.tr", totalScore: 1200, taskCount: 10 },
        { id: 3, name: "Serdal Çömlekçi", email: "serdalcolmekci@gtu.edu.tr", totalScore: 600, taskCount: 0 },
        { id: 4, name: "Aslıhan Gür", email: "agur@gtu.edu.tr", totalScore: 1200, taskCount: 10 },
        { id: 5, name: "Şeyma Yaşar", email: "seymayasar@gtu.edu.tr", totalScore: 1320, taskCount: 11 },
        { id: 6, name: "Saliha Demirbüken", email: "sdemirbuken@gtu.edu.tr", totalScore: 1200, taskCount: 10 },
        { id: 7, name: "Serkan Ayrıca", email: "s.ayrica2019@gtu.edu.tr", totalScore: 1440, taskCount: 12 },
        { id: 9, name: "Muhammed Ergen", email: "mergen@gtu.edu.tr", totalScore: 1320, taskCount: 11 },
        { id: 10, name: "Ömer Demir", email: "omerdemir@gtu.edu.tr", totalScore: 1440, taskCount: 12 },
        { id: 11, name: "Aysel Şahin", email: "ayselsahin@gtu.edu.tr", totalScore: 1440, taskCount: 12 },
        { id: 12, name: "Yasin Turan", email: "yasinturan@gtu.edu.tr", totalScore: 1800, taskCount: 15 },
        { id: 13, name: "Çağla Özatar", email: "caglaozatar@gtu.edu.tr", totalScore: 1560, taskCount: 13 },
        { id: 14, name: "Cansu Şahin", email: "cansusahin@gtu.edu.tr", totalScore: 600, taskCount: 0 }
    ],
    exams: [],
    constraints: DEFAULT_CONSTRAINTS,
    requests: [],
    announcement: "",
    archives: [],
    templates: {
        assignment: `Sayın {hoca_adi},\n\nGözetmenlik sisteminde adınıza yeni bir sınav görevi tanımlanmıştır:\n\n* Sınav: {sinav_adi}\n* Tarih: {tarih}\n* Saat: {saat}\n* Süre: {sure} Dakika\n* Yer / Derslik: {yer}\n\nEk Görev Bilgileri:\n* Sınav Katsayısı: {katsayi}x\n* Kazanılacak Puan: {puan}\n* Toplam Görev Sayınız: {toplam_gorev}\n\nSisteme giriş yaparak güncel puan tablonuzu ve programın tamamını görüntüleyebilirsiniz.\n\nÖnemli Not: Bu görevlendirme, sistemde beyan etmiş olduğunuz müsaitlik durumunuza ve kısıtlarınıza uygun olarak planlanmıştır. Belirtilen saatlerde beklenmedik bir engeliniz oluşması durumunda; Müsaitlik sekmesinden takas isteği göndereceğiniz hocanın müsaitlik durumunu inceleyebilirsiniz. Sınav Programı veya Sınavlar sekmesinden yerinize görev alabilecek diğer hocalarımızla iletişime geçerek "Takas İste" butonu üzerinden mail ile onay alabilirsiniz.\n\nİyi çalışmalar dileriz.\nGTU Matematik Bölümü`,
        swap_request: `Merhaba {alici_adi},\n\n{tarih} tarihindeki {sinav_adi} sınavımdaki görevimi seninle takas etmek istiyorum. Onay verirsen yöneticiye bildireceğim.\n\nİyi çalışmalar,\n{gonderen_adi}`,
        swap_notif: `Merhaba,\n\n{tarih} günü saat {saat}'nde yapılacak olan {sinav_adi} dersindeki gözetmenlik görevimi {hedef_hoca}'na devrettiğimi bildiririm.\n\nBilgilerinize iyi çalışmalar`,
        reminder: `Sayın {hoca_adi},\n\nGözetmenlik sistemindeki yarınki sınav görevinizi hatırlatmak isteriz:\n\n* Sınav: {sinav_adi}\n* Tarih: {tarih} (Yarın)\n* Saat: {saat}\n* Yer / Derslik: {yer}\n\nSınav saatinden en az 15 dakika önce sınav yerinde bulunmanızı rica ederiz. Herhangi bir değişiklik olması durumunda lütfen sistem üzerinden bildiriniz.\n\nİyi çalışmalar dileriz.\nGTU Matematik Bölümü`
    },
    version: 34
};

/**
 * v27 (Takas Sistemi) yapıdan v28 (Hedefli Takas) yapıya geçiş
 */
function migrateToV28(oldDB) {
    if (!oldDB) return oldDB;
    return {
        ...oldDB,
        version: 28
    };
}

/**
 * v26 (Çoklu gözetmen) yapıdan v27 (Takas Sistemi) yapıya geçiş
 */
function migrateToV27(oldDB) {
    if (!oldDB) return oldDB;
    // v27'ye geçerken swapRequests dizisi eklendi
    return {
        ...oldDB,
        requests: oldDB.swapRequests || oldDB.requests || [],
        version: 27
    };
}

/**
 * v25 (Tekil gözetmen) yapıdan v26 (Çoklu gözetmen) yapıya geçiş
 */
function migrateToV26(oldDB) {
    if (!oldDB || !oldDB.exams) return oldDB;
    
    const newExams = [];
    const groups = {};

    oldDB.exams.forEach(ex => {
        // Aynı sınavı (zaman ve yer bazlı) grupla
        const key = `${ex.name}_${ex.date}_${ex.time}_${ex.location || ''}`;
        if (!groups[key]) {
            groups[key] = {
                id: ex.id,
                name: ex.name,
                location: ex.location,
                date: ex.date,
                time: ex.time,
                duration: ex.duration,
                katsayi: ex.katsayi,
                score: ex.score,
                proctors: []
            };
            newExams.push(groups[key]);
        }
        
        // Eğer bu gözetmen henüz eklenmemişse listeye ekle
        if (ex.proctorId && !groups[key].proctors.some(p => p.id === ex.proctorId)) {
            groups[key].proctors.push({
                id: ex.proctorId,
                name: ex.proctorName
            });
        }
    });

    return {
        ...oldDB,
        exams: newExams,
        version: 26
    };
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
        if (ex.id === ignoreExamId) return false;
        // Bu sınavın gözetmenleri arasında bu hoca var mı?
        if (!ex.proctors.some(p => p.id === staffId)) return false;
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
    const recommended = getRecommendedProctors(dateStr, timeStr, duration, ignoreExamId);
    return recommended.length > 0 ? recommended[0] : null;
}

/**
 * En uygun 3 gözetmeni öneri olarak döndür
 */
function getRecommendedProctors(dateStr, timeStr, duration, ignoreExamId = null) {
    if (DB.staff.length === 0) return [];

    const available = DB.staff.filter(s =>
        isProctorTrulyFree(s.id, dateStr, timeStr, duration, ignoreExamId) &&
        (s.taskCount || 0) < GLOBAL_LIMITS.MAX_TASKS
    );

    if (available.length === 0) return [];

    // SIRALAMA STRATEJİSİ: 
    // 1. Önce minimum görev sayısına ulaşmamış olanlar
    // 2. En düşük puanlı olanlar
    const sorted = available.sort((a, b) => {
        const aMinReached = (a.taskCount || 0) >= GLOBAL_LIMITS.MIN_TASKS;
        const bMinReached = (b.taskCount || 0) >= GLOBAL_LIMITS.MIN_TASKS;

        if (aMinReached !== bMinReached) {
            return aMinReached ? 1 : -1;
        }
        return a.totalScore - b.totalScore;
    });

    return sorted.slice(0, 3);
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
        ex.proctors.forEach(p => {
            const proctorStaff = DB.staff.find(s => s.id === p.id);
            if (!proctorStaff) return;
            if (!isAvailable(proctorStaff.name, ex.date, ex.time, ex.duration)) {
                violationExamIds.add(ex.id);
            }
        });
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

        // Eski gözetmenlerin puanlarını düş
        exam.proctors.forEach(p => {
            const oldStaff = DB.staff.find(s => s.id === p.id);
            if (oldStaff) {
                oldStaff.totalScore = Math.max(0, oldStaff.totalScore - exam.score);
                oldStaff.taskCount = Math.max(0, oldStaff.taskCount - 1);
            }
        });

        // Yeni gözetmenleri bul (şimdilik tek kişiye düşürüp temiz kurulum yapar gibi)
        const newProctor = findBestProctor(exam.date, exam.time, exam.duration, exam.id);

        if (newProctor) {
            // Yeni gözetmeni ata
            exam.proctors = [{ id: newProctor.id, name: newProctor.name }];
            newProctor.totalScore = parseFloat((newProctor.totalScore + exam.score).toFixed(2));
            newProctor.taskCount += 1;
            resolvedCount++;
        } else {
            // Eski gözetmenleri geri al (yetersiz yedek)
            exam.proctors.forEach(p => {
                const oldStaff = DB.staff.find(s => s.id === p.id);
                if (oldStaff) {
                    oldStaff.totalScore += exam.score;
                    oldStaff.taskCount += 1;
                }
            });
            skippedCount++;
        }
    });

    saveToLocalStorage();
    return { resolved: resolvedCount, skipped: skippedCount };
}


function addExam(examData) {
    const proctorIds = examData.proctorIds || [];
    if (proctorIds.length === 0) {
        // Eğer hoca seçilmemişse algoritma ile bir tane bul
        const recommended = findBestProctor(examData.date, examData.time, examData.duration);
        if (recommended) proctorIds.push(recommended.id);
        else {
            alert("Bu tarih ve saatte müsait bir gözetmen bulunamadı!");
            return;
        }
    }

    const score = calculateScore(new Date(`${examData.date}T${examData.time}`), examData.duration);
    const dateObj = new Date(`${examData.date}T${examData.time}`);
    
    const newExam = {
        name: examData.name,
        type: examData.type || "vize",
        location: examData.location || "Belirtilmedi",
        date: examData.date,
        time: examData.time,
        duration: examData.duration,
        id: Date.now() + Math.random(),
        proctors: [],
        score: score,
        katsayi: getKatsayi(dateObj)
    };

    proctorIds.forEach(pId => {
        const staff = DB.staff.find(s => s.id === pId);
        if (staff) {
            newExam.proctors.push({ id: staff.id, name: staff.name });
            staff.totalScore = parseFloat((staff.totalScore + score).toFixed(2));
            staff.taskCount = (staff.taskCount || 0) + 1;
        }
    });

    DB.exams.push(newExam);
    saveToLocalStorage();
    return newExam;
}

function updateExam(id, newData) {
    const exIndex = DB.exams.findIndex(e => e.id === id);
    if (exIndex === -1) return;

    const exam = DB.exams[exIndex];
    
    // 1. Eski gözetmenlerden yükü düş
    exam.proctors.forEach(p => {
        const staff = DB.staff.find(s => s.id === p.id);
        if (staff) {
            staff.totalScore = Math.max(0, parseFloat((staff.totalScore - exam.score).toFixed(2)));
            staff.taskCount = Math.max(0, staff.taskCount - 1);
        }
    });

    // 2. Yeni verileri uygula
    exam.type = newData.type || "vize";
    exam.name = newData.name;
    exam.location = newData.location || "Belirtilmedi";
    exam.date = newData.date;
    exam.time = newData.time;
    exam.duration = newData.duration;
    
    const dateObj = new Date(`${newData.date}T${newData.time}`);
    exam.katsayi = getKatsayi(dateObj);
    exam.score = calculateScore(dateObj, newData.duration);

    // 3. Yeni gözetmenleri ata ve yükleri ekle
    exam.proctors = [];
    const newProctorIds = newData.proctorIds || [];
    
    newProctorIds.forEach(pId => {
        const staff = DB.staff.find(s => s.id === pId);
        if (staff) {
            exam.proctors.push({ id: staff.id, name: staff.name });
            staff.totalScore = parseFloat((staff.totalScore + exam.score).toFixed(2));
            staff.taskCount = (staff.taskCount || 0) + 1;
        }
    });
    
    saveToLocalStorage();
}

/**
 * TAKAS SİSTEMİ FONKSİYONLARI
 */

function addSwapRequest(examId, initiatorId, initiatorName, receiverId, receiverName) {
    if (typeof DB.requests === 'undefined' || !Array.isArray(DB.requests)) {
        try {
            DB.requests = [];
        } catch (e) {
            console.error("DB.requests dizisi oluşturulamadı:", e);
            throw new Error("Veritabanına erişilemiyor. DB nesnesi değiştirilemez olabilir.");
        }
    }
    
    if (!DB.requests || typeof DB.requests.push !== 'function') {
        throw new Error("Veritabanı yapısı bozuk (DB.requests geçerli bir dizi değil).");
    }

    const request = {
        id: Date.now(),
        examId: examId,
        initiatorId: initiatorId,
        initiatorName: initiatorName,
        receiverId: receiverId,
        receiverName: receiverName,
        status: 'pending_admin',
        createdAt: new Date().toISOString()
    };
    
    DB.requests.push(request);
    saveToLocalStorage();
    return request;
}

function updateRequestStatus(requestId, newStatus) {
    if (!DB.requests) return false;
    const req = DB.requests.find(r => r.id === requestId);
    if(req) {
        req.status = newStatus;
        if (newStatus === 'approved' || newStatus === 'rejected') {
            req.resolvedAt = new Date().toISOString();
        }
        saveToLocalStorage();
        return true;
    }
    return false;
}

// Global'e aç
window.addSwapRequest = addSwapRequest;
window.updateRequestStatus = updateRequestStatus;

function approveSwapRequest(requestId, toStaffId) {
    const reqIndex = DB.requests.findIndex(r => r.id === requestId);
    if (reqIndex === -1) return;
    
    const request = DB.requests[reqIndex];
    const exam = DB.exams.find(e => e.id === request.examId);
    if (!exam) return;

    const fromStaff = DB.staff.find(s => s.id === request.initiatorId);
    const toStaff = DB.staff.find(s => s.id === toStaffId);
    
    if (fromStaff && toStaff) {
        // 1. Eski hocadan yükü düş
        fromStaff.totalScore = Math.max(0, parseFloat((fromStaff.totalScore - exam.score).toFixed(2)));
        fromStaff.taskCount = Math.max(0, fromStaff.taskCount - 1);

        // 2. Yeni hocaya yükü ekle
        toStaff.totalScore = parseFloat((toStaff.totalScore + exam.score).toFixed(2));
        toStaff.taskCount = (toStaff.taskCount || 0) + 1;

        // 3. Sınav kaydındaki hocayı güncelle
        const pIndex = exam.proctors.findIndex(p => p.id === fromStaff.id);
        if (pIndex > -1) {
            exam.proctors[pIndex] = { id: toStaff.id, name: toStaff.name };
        }

        // 4. Talebi onaylandı yap
        request.status = 'approved';
        request.resolvedAt = new Date().toISOString();
        
        saveToLocalStorage();
        return true;
    }
    return false;
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
            if (ex.proctors && ex.proctors.some(p => p.id === staff.id)) {
                const dateObj = new Date(ex.date.replace(/-/g, "/"));
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

function saveToLocalStorage() {
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
    
    // Firebase bulutuna kaydet
    firebase.database().ref('gozetmenlik_db').set(DB)
        .catch(err => console.error("Firebase'e kaydedilirken hata oluştu:", err));
}


function rejectSwapRequest(requestId) {
    const reqIndex = DB.requests.findIndex(r => r.id === requestId);
    if (reqIndex > -1) {
        DB.requests.splice(reqIndex, 1);
        saveToLocalStorage();
    }
}




function migrateToV30(oldDB) {
    if (!oldDB) return oldDB;
    const emailMap = {
        "Oğuzhan Selçuk": "oguzhanselcuk@gtu.edu.tr",
        "Ezgi Öztekin": "ezgioztekin@gtu.edu.tr",
        "Serdal Çömlekçi": "serdalcolmekci@gtu.edu.tr",
        "Aslıhan Gür": "agur@gtu.edu.tr",
        "Saliha Demirbüken": "sdemirbuken@gtu.edu.tr",
        "Serkan Ayrıca": "s.ayrica2019@gtu.edu.tr",
        "Muhammed Ergen": "mergen@gtu.edu.tr",
        "Ömer Demir": "omerdemir@gtu.edu.tr",
        "Aysel Şahin": "ayselsahin@gtu.edu.tr",
        "Yasin Turan": "yasinturan@gtu.edu.tr",
        "Çağla Özatar": "caglaozatar@gtu.edu.tr",
        "Cansu Şahin": "cansusahin@gtu.edu.tr"
    };

    if (oldDB.staff) {
        oldDB.staff.forEach(s => {
            if (emailMap[s.name]) {
                s.email = emailMap[s.name];
            }
        });
    }
    oldDB.version = 31;
    return oldDB;
}

function migrateToV29(oldDB) {
    if (!oldDB) return oldDB;
    // Saliha'ya özel hafta sonu kısıtı ekle (User Talebi)
    const salihaName = "Saliha Demirbüken";
    if (!oldDB.constraints) oldDB.constraints = {};
    if (!oldDB.constraints[salihaName]) oldDB.constraints[salihaName] = [];
    
    const hasSat = oldDB.constraints[salihaName].some(c => c.day === 6);
    const hasSun = oldDB.constraints[salihaName].some(c => c.day === 0);

    if (!hasSat) {
        oldDB.constraints[salihaName].push({ day: 6, start: "00:00", end: "23:59" });
    }
    if (!hasSun) {
        oldDB.constraints[salihaName].push({ day: 0, start: "00:00", end: "23:59" });
    }
    oldDB.version = 29;
    return oldDB;
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem(DB_KEY);
    
    // 1. Önce yerel veriyi yükle (Hızlı başlangıç için)
    if (saved) {
        DB = JSON.parse(saved);
    }

    // 2. Firebase bulutundan veriyi dinle (Canlı senkronizasyon)
    firebase.database().ref('gozetmenlik_db').on('value', (snapshot) => {
        const cloudData = snapshot.val();
        if (cloudData) {
            // Eğer bulutta veri varsa ve yerel veriden yeniyse (veya yerel veri yoksa) güncelle
            if (!DB || cloudData.version >= (DB.version || 0)) {
                DB = cloudData;
                localStorage.setItem(DB_KEY, JSON.stringify(DB));
                
                // Arayüzü tetikle
                if (window.dispatchEvent) {
                    window.dispatchEvent(new Event('db-updated'));
                }
                console.log("Firebase verisi senkronize edildi.");
            }
        } else if (DB && DB.staff && DB.staff.length > 0) {
            // Eğer Firebase tamamen boşsa, yereldeki veriyi Firebase'e yükle (Migration)
            saveToLocalStorage();
            console.log("Yerel veri Firebase'e aktarıldı (Migration).");
        }
    });

    // Klasik migrasyon işlemleri (Versiyon kontrolü)
    if (DB && (!DB.version || DB.version < 36)) {
        let dbToSave = DB; 
        if (DB.version < 29) dbToSave = migrateToV29(dbToSave);
        if (dbToSave.version < 30) dbToSave = migrateToV30(dbToSave);
        
        // v31 için swapRequests -> requests kontrolü
        if (dbToSave.swapRequests && !dbToSave.requests) {
            dbToSave.requests = dbToSave.swapRequests;
            delete dbToSave.swapRequests;
        }
        // v32 Duyuru Alanı
        if (dbToSave.announcement === undefined) {
            dbToSave.announcement = "";
        }
        // v33 E-Posta Şablonları
        if (!dbToSave.templates) {
            dbToSave.templates = {
                assignment: `Sayın {hoca_adi},\n\nGözetmenlik sisteminde adınıza yeni bir sınav görevi tanımlanmıştır:\n\n* Sınav: {sinav_adi}\n* Tarih: {tarih}\n* Saat: {saat}\n* Süre: {sure} Dakika\n* Yer / Derslik: {yer}\n\nEk Görev Bilgileri:\n* Sınav Katsayısı: {katsayi}x\n* Kazanılacak Puan: {puan}\n* Toplam Görev Sayınız: {toplam_gorev}\n\nSisteme giriş yaparak güncel puan tablonuzu ve programın tamamını görüntüleyebilirsiniz.\n\nÖnemli Not: Bu görevlendirme, sistemde beyan etmiş olduğunuz müsaitlik durumunuza ve kısıtlarınıza uygun olarak planlanmıştır. Belirtilen saatlerde beklenmedik bir engeliniz oluşması durumunda; Müsaitlik sekmesinden takas isteği göndereceğiniz hocanın müsaitlik durumunu inceleyebilirsiniz. Sınav Programı veya Sınavlar sekmesinden yerinize görev alabilecek diğer hocalarımızla iletişime geçerek "Takas İste" butonu üzerinden mail ile onay alabilirsiniz.\n\nİyi çalışmalar dileriz.\nGTU Matematik Bölümü`,
                swap_request: `Merhaba {alici_adi},\n\n{tarih} tarihindeki {sinav_adi} sınavımdaki görevimi seninle takas etmek istiyorum. Onay verirsen yöneticiye bildireceğim.\n\nİyi çalışmalar,\n{gonderen_adi}`,
                swap_notif: `Merhaba,\n\n{tarih} günü saat {saat}'nde yapılacak olan {sinav_adi} dersindeki gözetmenlik görevimi {hedef_hoca}'na devrettiğimi bildiririm.\n\nBilgilerinize iyi çalışmalar`,
                reminder: `Sayın {hoca_adi},\n\nGözetmenlik sistemindeki yarınki sınav görevinizi hatırlatmak isteriz:\n\n* Sınav: {sinav_adi}\n* Tarih: {tarih} (Yarın)\n* Saat: {saat}\n* Yer / Derslik: {yer}\n\nSınav saatinden en az 15 dakika önce sınav yerinde bulunmanızı rica ederiz. Herhangi bir değişiklik olması durumunda lütfen sistem üzerinden bildiriniz.\n\nİyi çalışmalar dileriz.\nGTU Matematik Bölümü`
            };
        }
        // v36 - Taleplere sınav bilgisi ekle (akıllı eşleştirme)
        if (dbToSave.requests && dbToSave.requests.length > 0) {
            dbToSave.requests.forEach(function(req) {
                if (req.examName && req.examName !== 'Bilinmeyen Sınav') return; 
                
                var exams = dbToSave.exams || [];
                var exam = exams.find(function(e) { return e.id == req.examId; });
                
                if (!exam && req.initiatorId) {
                    var initiatorExams = exams.filter(function(e) {
                        return e.proctors && e.proctors.some(function(p) {
                            return p.id == req.initiatorId;
                        });
                    });
                    if (initiatorExams.length === 1) {
                        exam = initiatorExams[0];
                    }
                }
                
                if (exam) {
                    req.examName = exam.name;
                    req.examDate = exam.date;
                    req.examTime = exam.time;
                    req.examId = exam.id;
                } else {
                    req.examName = 'Bilinmeyen Sınav';
                    req.examDate = '';
                    req.examTime = '';
                }
            });
        }
        dbToSave.version = 36;
        DB = dbToSave;
        saveToLocalStorage();
    } else if (!DB) {
        const v29 = localStorage.getItem('gozetmenlik_db_v29');
        const v28 = localStorage.getItem('gozetmenlik_db_v28');
        if (v29) {
            DB = migrateToV30(JSON.parse(v29));
        } else if (v28) {
            DB = migrateToV30(migrateToV29(JSON.parse(v28)));
        } else {
            seedInitialExams();
            return;
        }
        saveToLocalStorage();
    }

    // Ek Güvenlik Kontrolleri
    if (DB && DB.exams) {
        DB.exams.forEach(ex => {
            if (!Array.isArray(ex.proctors)) {
                ex.proctors = [];
                if (ex.proctorId) {
                    ex.proctors.push({ id: ex.proctorId, name: ex.proctorName || '' });
                }
            }
            if (!ex.type) ex.type = 'vize';
        });
    }
}

loadFromLocalStorage();


/**
 * Sınavın geçip geçmediğini kontrol eder.
 */
function isExamPassed(ex) {
    if (!ex.date || !ex.time) return false;
    
    // Güvenli tarih ayrıştırma: YYYY-MM-DD ve HH:mm
    const dateParts = ex.date.split('-');
    const timeParts = ex.time.split(':');
    
    if (dateParts.length !== 3 || timeParts.length !== 2) return false;
    
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // Aylar 0-indeksli
    const day = parseInt(dateParts[2], 10);
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);

    const examDateTime = new Date(year, month, day, hours, minutes);
    const now = new Date();
    
    return examDateTime < now;
}

window.isExamPassed = isExamPassed;

function seedInitialExams() {
    const initialExamsWithProctors = [
        // TEST İÇİN GEÇMİŞ SINAVLAR
        { name: "TEST 101 - Geçmiş Sınav", date: "2026-03-20", time: "10:00", duration: 90, location: "-", proctors: ["Ömer Demir"] },
        { name: "TEST 102 - Dünki Sınav", date: "2026-03-21", time: "14:00", duration: 90, location: "-", proctors: ["Ezgi Öztekin"] },
        
        // 1. YIL
        // INF 101 - 18 Nisan Cumartesi 11:00 | 3 kişi
        { name: "INF 101 - Introduction to Computing", date: "2026-04-18", time: "11:00", duration: 90, location: "-", proctors: ["Ömer Demir", "Yasin Turan", "Çağla Özatar"] },
        // MATH 112 - 06 Nisan Pazartesi 17:30-19:30 | 73 kişi, 3 salon
        { name: "MATH 112 - Analysis II", date: "2026-04-06", time: "17:30", duration: 120, location: "73 - /D1/D3/D4", proctors: ["Serkan Ayrıca", "Aslıhan Gür"] },

        // MATH 114 - 09 Nisan Perşembe 13:30-15:30 | 78 kişi, 2 salon
        { name: "MATH 114 - Linear Algebra II", date: "2026-04-09", time: "13:30", duration: 120, location: "78 - Amfi 2/D1", proctors: ["Saliha Demirbüken", "Ezgi Öztekin", "Serkan Ayrıca"] },
        // MATH 106 - 16 Nisan Perşembe 18:00-19:30 | 118 kişi, 4 salon
        { name: "MATH 106 - Analytical Geometry", date: "2026-04-16", time: "18:00", duration: 90, location: "118-/D1/D3/D5/D9", proctors: ["Muhammed Ergen", "Yasin Turan", "Cansu Şahin", "Aysel Şahin"] },
        // TUR 102 - 17 Nisan Cuma 18:00 | 3 kişi
        { name: "TUR 102 - Turkish II", date: "2026-04-17", time: "18:00", duration: 60, location: "-", proctors: ["Oğuzhan Selçuk", "Ezgi Öztekin", "Ömer Demir"] },
        // PHYS 114 - 27 Mart Cuma 18:00 | 2 kişi (I. Vize)
        { name: "PHYS 114 - Physics for Natural Sciences II", date: "2026-03-27", time: "18:00", duration: 90, location: "-", proctors: ["Aysel Şahin", "Şeyma Yaşar"] },
        // PHYS 114 - 8 Mayıs Cuma 18:00 | 2 kişi (II. Vize)
        { name: "PHYS 114 - Physics for Natural Sciences II (II. Vize)", date: "2026-05-08", time: "18:00", duration: 90, location: "II. Vize", proctors: ["Şeyma Yaşar", "Serkan Ayrıca"] },

        // 2. YIL
        // MATH 204 - 25 Mart Çarşamba 13:30-16:30 | 55 kişi, Amfi 2
        { name: "MATH 204 - Differential Equations II", date: "2026-03-25", time: "13:30", duration: 180, location: "55/ Amfi 2", proctors: ["Saliha Demirbüken", "Aslıhan Gür"] },
        // MATH 204 (II. Vize) - 6 Mayıs Çarşamba 13:30-16:30
        { name: "MATH 204 - Differential Equations II (II. Vize)", date: "2026-05-06", time: "13:30", duration: 180, location: "55/ Amfi 2 (II. Vize)", proctors: ["Oğuzhan Selçuk", "Ömer Demir"] },
        // MATH 206 - 15 Nisan Çarşamba 17:00-19:00 | 77 kişi, 3 salon
        { name: "MATH 206 - Topology", date: "2026-04-15", time: "17:00", duration: 120, location: "77-/D1/D3/D5", proctors: ["Ezgi Öztekin", "Muhammed Ergen", "Cansu Şahin"] },
        // MATH 210 - 13 Nisan Pazartesi 13:30-15:30 | 50 kişi, Amfi 2
        { name: "MATH 210 - Algebra II", date: "2026-04-13", time: "13:30", duration: 120, location: "50- Amfi2", proctors: ["Serdal Çömlekçi", "Oğuzhan Selçuk"] },
        // MATH 212 - 14 Nisan Salı 11:00-13:00 | 50 kişi, Amfi 2
        { name: "MATH 212 - Analysis IV", date: "2026-04-14", time: "11:00", duration: 120, location: "50- Amfi2", proctors: ["Saliha Demirbüken", "Çağla Özatar"] },
        // HIS 102 - 17 Nisan Cuma 19:00 | 2 kişi
        { name: "HIS 102 - Atatürk İlkeleri ve İnkılap Tarihi II", date: "2026-04-17", time: "19:00", duration: 60, location: "-", proctors: ["Aslıhan Gür", "Muhammed Ergen"] },

        // 3. YIL
        // MATH 302 - 15 Nisan Çarşamba 09:30 | 12 kişi, D1
        { name: "MATH 302 - Complex Analysis II", date: "2026-04-15", time: "09:30", duration: 60, location: "12- D1", proctors: ["Serdal Çömlekçi"] },
        // MATH 304 - 30 Mart Pazartesi 16:30-18:30 | 51 kişi, D1/D3
        { name: "MATH 304 - Real Analysis II", date: "2026-03-30", time: "16:30", duration: 120, location: "51-D1/D3", proctors: ["Aysel Şahin", "Şeyma Yaşar"] },
        // MATH 308 - 08 Nisan 2026 Çarşamba 13:30 | 52 kişi, Amfi 2  ← (resimde yıl düzeltildi: 2026)
        { name: "MATH 308 - Probability Theory", date: "2026-04-08", time: "13:30", duration: 60, location: "52 -Amfi 2", proctors: ["Cansu Şahin", "Serkan Ayrıca"] },
        // MATH 311 - 16 Nisan Perşembe 09:30-11:30 | 8 kişi, D1
        { name: "MATH 311 - Numerical Analysis II", date: "2026-04-16", time: "09:30", duration: 120, location: "8-D1", proctors: ["Serdal Çömlekçi"] },
        // ENG 112 - 18 Nisan Cumartesi 14:00 | 2 kişi
        { name: "ENG 112 - Academic English", date: "2026-04-18", time: "14:00", duration: 60, location: "-", proctors: ["Oğuzhan Selçuk", "Ezgi Öztekin"] },

        // 4. YIL
        // MATH 446 - 23 Mart Pazartesi 09:30-12:30 | 44 kişi, D3/D1
        { name: "MATH 446 - Quasilinearization Methods", date: "2026-03-23", time: "09:30", duration: 180, location: "44 -D3/ D1", proctors: ["Serdal Çömlekçi", "Saliha Demirbüken"] },
        // MATH 446 (II. Vize) - 04 Mayıs Pazartesi 09:30-12:30
        { name: "MATH 446 - Quasilinearization Methods (II. Vize)", date: "2026-05-04", time: "09:30", duration: 180, location: "44 -D3/ D1(II. Vize)", proctors: ["Cansu Şahin", "Şeyma Yaşar"] },
        // MATH 438 - 13 Nisan Pazartesi 13:30-15:30 | 22 kişi, D3
        { name: "MATH 438 - Graph Theory and Combinatorics", date: "2026-04-13", time: "13:30", duration: 120, location: "22 -D3", proctors: ["Yasin Turan"] },
        // MATH 434 - 14 Nisan Salı 09:30-11:20 | 29 kişi, D3
        { name: "MATH 434 - Boundary Value Problems", date: "2026-04-14", time: "09:30", duration: 110, location: "29 -D3", proctors: ["Çağla Özatar"] },
        // MATH 452 - 08 Nisan 2026 Çarşamba 09:30 | 52 kişi  ← (resimde yıl düzeltildi: 2026)
        { name: "MATH 452 - History of Mathematics", date: "2026-04-08", time: "09:30", duration: 60, location: "52 -", proctors: ["Ezgi Öztekin"] },
        // MATH 419 - 14 Nisan Salı 13:30-15:30 | 37 kişi, D3
        { name: "MATH 419 - Introduction to Coding Theory", date: "2026-04-14", time: "13:30", duration: 120, location: "37 - D3", proctors: ["Serkan Ayrıca"] },
        // MATH 407 - 25 Mart Çarşamba 13:30-16:30 | 16 kişi, D3
        { name: "MATH 407 - Differential Geometry", date: "2026-03-25", time: "13:30", duration: 180, location: "16- D3", proctors: ["Ömer Demir"] },
        // MATH 407 (II. Vize) - 06 Mayıs Çarşamba 13:30-16:30
        { name: "MATH 407 - Differential Geometry (II. Vize)", date: "2026-05-06", time: "13:30", duration: 180, location: "16- D3 (II. Vize)", proctors: ["Serdal Çömlekçi"] },
        // MATH 435 - 09 Nisan Perşembe 10:00-12:00 | 12 kişi, D3
        { name: "MATH 435 - Applied Partial Diff. Equations", date: "2026-04-09", time: "10:00", duration: 120, location: "12 -D3", proctors: ["Oğuzhan Selçuk"] },
        // MATH 449 - 13 Nisan Pazartesi 17:00-19:00 | 29 kişi, D3
        { name: "MATH 449 - Number Theory", date: "2026-04-13", time: "17:00", duration: 120, location: "29-D3", proctors: ["Aysel Şahin"] },
        // MATH 411 - 17 Nisan Cuma 10:00-12:00 | 21 kişi, D3
        { name: "MATH 411 - Introduction to Data Analysis", date: "2026-04-17", time: "10:00", duration: 120, location: "21 -D3", proctors: ["Cansu Şahin"] }
    ];

    initialExamsWithProctors.forEach((examData) => {
        const dateObj = new Date(`${examData.date}T${examData.time}`);
        const score = calculateScore(dateObj, examData.duration);
        const katsayi = getKatsayi(dateObj);

        const newExam = {
            name: examData.name,
            type: "vize",
            location: examData.location || "Belirtilmedi",
            date: examData.date,
            time: examData.time,
            duration: examData.duration,
            id: Date.now() + Math.random(),
            proctors: [],
            score: score,
            katsayi: katsayi
        };

        examData.proctors.forEach(proctorName => {
            const staffMember = DB.staff.find(s => s.name === proctorName || s.name.includes(proctorName) || proctorName.includes(s.name));
            if (staffMember) {
                let finalProctor = staffMember;
                
                // Kısıt VEYA zaman çakışması varsa, sistemden en uygun yedeği ata (mevcut sınavdaki hocalar hariç)
                if (!isProctorTrulyFree(staffMember.id, examData.date, examData.time, examData.duration)) {
                    console.log(`${staffMember.name} müsait değil: ${examData.name}, yedek aranıyor...`);
                    const alternate = findBestProctor(examData.date, examData.time, examData.duration);
                    if (alternate) finalProctor = alternate;
                }

                newExam.proctors.push({ id: finalProctor.id, name: finalProctor.name });
                finalProctor.totalScore = parseFloat((finalProctor.totalScore + score).toFixed(2));
                finalProctor.taskCount = (finalProctor.taskCount || 0) + 1;
            }
        });
        DB.exams.push(newExam);
    });
    saveToLocalStorage();
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
            
            // Aynı gözetmen farklı sınavlarda çakışıyor mu?
            const commonProctors = examA.proctors.filter(pa => 
                examB.proctors.some(pb => pb.id === pa.id)
            );

            if (commonProctors.length > 0) {
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
 * Sınav Programını Sıfırla ama Puanları Koru
 */
function resetExamsButKeepScores() {
    DB.exams = [];
    DB.requests = [];
    saveToLocalStorage();
}

/**
 * Mevcut sınav dönemini arşivler ve sistemi yeni döneme hazırlar.
 * @param {string} periodName - Arşivlenecek dönemin adı (Örn: "2025 Bahar Vizeleri")
 */
function archiveCurrentPeriod(periodName) {
    if (!periodName) return { success: false, message: "Dönem adı gereklidir." };

    // Mevcut durumun bir snapshot'ını al
    const snapshot = {
        id: Date.now(),
        name: periodName,
        date: new Date().toISOString(),
        examCount: DB.exams.length,
        staffSnapshot: DB.staff.map(s => ({
            id: s.id,
            name: s.name,
            totalScore: s.totalScore,
            taskCount: s.taskCount
        })),
        exams: [...DB.exams] // Sınavların tam listesini sakla
    };

    // Arşive ekle
    if (!DB.archives) DB.archives = [];
    DB.archives.push(snapshot);

    // Mevcut sınavları ve talepleri temizle
    DB.exams = [];
    DB.requests = [];
    
    saveToLocalStorage();
    return { success: true, message: "Dönem başarıyla arşivlendi." };
}

function deleteArchive(archiveId) {
    if (!DB.archives) return;
    DB.archives = DB.archives.filter(a => a.id !== archiveId);
    saveToLocalStorage();
}

/**
 * Belirli bir arşive ait sınavları mevcut listeye geri yükler (Dikkat: Mevcutları siler)
 */
function restoreArchive(archiveId) {
    const archive = DB.archives.find(a => a.id === archiveId);
    if (archive) {
        DB.exams = [...archive.exams];
        saveToLocalStorage();
        return true;
    }
    return false;
}

loadFromLocalStorage();
