/**
 * Gözetmenlik UI Kontrolcü
 */

let scoreChartInstance = null;

// Tema Kontrolü - En hızlı şekilde en tepede yapıyoruz
(function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const loginOverlay = document.getElementById('login-overlay');
    const appWrapper = document.getElementById('app-wrapper');
    const loginPassInput = document.getElementById('login-password');
    const btnLogin = document.getElementById('btn-login');
    const btnGuestLogin = document.getElementById('btn-guest-login');
    const loginError = document.getElementById('login-error');

    const finishLogin = (isAdmin) => {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');
        
        if (!isAdmin) document.body.classList.add('guest-mode');
        else document.body.classList.remove('guest-mode');
        
        loginOverlay.classList.add('hidden');
        appWrapper.style.display = 'block';
        initApp();
    };

    // Oturum Kontrolü
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        finishLogin(sessionStorage.getItem('isAdmin') === 'true');
    } else {
        loginOverlay.classList.remove('hidden');
        appWrapper.style.display = 'none';
    }

    const handleLogin = () => {
        if (loginPassInput.value === SYSTEM_PASSWORD) {
            finishLogin(true);
        } else if (loginPassInput.value === GUEST_PASSWORD) {
            finishLogin(false);
        } else {
            loginError.classList.remove('hidden');
            loginPassInput.value = '';
            loginPassInput.focus();
        }
    };

    if (btnLogin) btnLogin.addEventListener('click', handleLogin);
    
    if (loginPassInput) {
        loginPassInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    // Tema Değiştirme Butonu Dinleyicisi
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    if (btnThemeToggle) {
        // İkonu ayarla
        const updateThemeIcon = () => {
            const isLight = document.body.classList.contains('light-mode');
            btnThemeToggle.textContent = isLight ? '☀️' : '🌙';
        };
        updateThemeIcon();

        btnThemeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            updateThemeIcon();
            
            // Eğer grafik varsa renklerini güncellemek için
            const dashboardSection = document.getElementById('section-dashboard');
            if (dashboardSection && !dashboardSection.classList.contains('hidden')) {
                 updateScoreChart();
            }
        });
    }
});

function initApp() {
    // Manuel Veri Düzeltme Yaması (Cansu Şahin - 10 Görev & 1200 Puan Silme)
    if (localStorage.getItem('cansu_fix_executed_v2') !== 'true') {
        const cansu = DB.staff.find(s => s.name === "Cansu Şahin" || s.name === "Cansı Şahin");
        if (cansu) {
            cansu.totalScore = parseFloat((cansu.totalScore - 1200).toFixed(2));
            cansu.taskCount = Math.max(0, cansu.taskCount - 10);
            saveToLocalStorage();
            localStorage.setItem('cansu_fix_executed_v2', 'true');
            console.log("Cansu Şahin verisi başarıyla güncellendi.");
        }
    }

    // Manuel Veri Güncelleme Yaması (Serdal Çömlekçi - 7 Görev Sınırı Düzeltme)
    if (localStorage.getItem('serdal_fix_executed_v2') !== 'true') {
        const serdal = DB.staff.find(s => s.name === "Serdal Çömlekçi");
        if (serdal) {
            serdal.taskCount = 7;
            serdal.totalScore = 840; // 7 * 120
            saveToLocalStorage();
            localStorage.setItem('serdal_fix_executed_v2', 'true');
            console.log("Serdal Çömlekçi verisi 7 görev olarak güncellendi.");
        }
    }
    // Manuel Veri Güncelleme Yaması (E-posta Geri Yükleme)
    if (localStorage.getItem('email_restore_executed_v2') !== 'true') {
        const emailMap = {
            "Oğuzhan Selçuk": "oguzhanselcuk@gtu.edu.tr",
            "Ezgi Öztekin": "ezgioztekin@gtu.edu.tr",
            "Serdal Çömlekçi": "serdalcolmekci@gtu.edu.tr",
            "Aslıhan Gür": "agur@gtu.edu.tr",
            "Şeyma Yaşar": "seymayasar@gtu.edu.tr",
            "Saliha Demirbüken": "sdemirbuken@gtu.edu.tr",
            "Serkan Ayrıca": "s.ayrica2019@gtu.edu.tr",
            "Muhammed Ergen": "mergen@gtu.edu.tr",
            "Ömer Demir": "omerdemir@gtu.edu.tr",
            "Aysel Şahin": "ayselsahin@gtu.edu.tr",
            "Yasin Turan": "yasinturan@gtu.edu.tr",
            "Çağla Özatar": "caglaozatar@gtu.edu.tr",
            "Cansu Şahin": "cansusahin@gtu.edu.tr"
        };
        DB.staff.forEach(s => {
            if (!s.email || s.email === '-' || s.email.trim() === '') {
                if (emailMap[s.name]) {
                    s.email = emailMap[s.name];
                }
            }
        });
        saveToLocalStorage();
        localStorage.setItem('email_restore_executed_v2', 'true');
        console.log("E-posta adresleri başarıyla geri yüklendi.");
    }

    // Serdal v3: DB.exams üzerinde gerçek düzeltme - 7 görev sınırını enforce et
    if (localStorage.getItem('serdal_fix_executed_v3') !== 'true') {
        const serdal = DB.staff.find(s => s.name === "Serdal Çömlekçi");
        if (serdal) {
            // Serdal'a bağlı tüm sınavları bul, tarihe göre sırala
            const serdalExams = DB.exams
                .filter(e => e.proctorId === serdal.id)
                .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

            const MAX = GLOBAL_LIMITS.MAX_TASKS;
            if (serdalExams.length > MAX) {
                // Son (en sonraki tarihlerdeki) fazla sınavları başka gözetmene devret veya sil
                const toRemove = serdalExams.slice(MAX); // 7. indeksten itibaren hepsi

                toRemove.forEach(exam => {
                    // Yedek gözetmen bul (bu sınavı Serdal hariç)
                    const otherStaff = DB.staff.filter(s =>
                        s.id !== serdal.id &&
                        (s.taskCount || 0) < MAX &&
                        isProctorTrulyFree(s.id, exam.date, exam.time, exam.duration, exam.id)
                    ).sort((a, b) => a.totalScore - b.totalScore);

                    if (otherStaff.length > 0) {
                        const newProctor = otherStaff[0];
                        // Eski puanı Serdal'dan düş
                        serdal.totalScore = Math.max(0, parseFloat((serdal.totalScore - exam.score).toFixed(2)));
                        serdal.taskCount = Math.max(0, serdal.taskCount - 1);
                        // Yeni gözetmene ata
                        exam.proctorId = newProctor.id;
                        exam.proctorName = newProctor.name;
                        newProctor.totalScore = parseFloat((newProctor.totalScore + exam.score).toFixed(2));
                        newProctor.taskCount = (newProctor.taskCount || 0) + 1;
                    } else {
                        // Yedek bulunamadı, sadece Serdal'dan düş (sınavı ata bırak = kaldır)
                        serdal.totalScore = Math.max(0, parseFloat((serdal.totalScore - exam.score).toFixed(2)));
                        serdal.taskCount = Math.max(0, serdal.taskCount - 1);
                        DB.exams = DB.exams.filter(e => e.id !== exam.id);
                    }
                });
            }

            saveToLocalStorage();
            localStorage.setItem('serdal_fix_executed_v3', 'true');
            console.log("Serdal v3: exams güncellendi, görev sayısı: " + (DB.exams.filter(e => e.proctorId === serdal.id).length));
        }
    }

    // Serdal v4: Kullanıcının verdiği kesin 7 sınav listesine göre düzelt
    if (localStorage.getItem('serdal_fix_executed_v4') !== 'true') {
        const serdal = DB.staff.find(s => s.name === "Serdal Çömlekçi");
        if (serdal) {
            const serdalExams = [
                { name: "MATH 446 - Quasilinearization Methods", location: "44 -D3/ D1", date: "2026-03-23", time: "09:30", duration: 180 },
                { name: "MATH 407 - Differential Geometry",       location: "16- D3",      date: "2026-03-25", time: "13:30", duration: 180 },
                { name: "MATH 435 - Applied Partial Diff. Equations", location: "12 -D3", date: "2026-04-09", time: "10:00", duration: 120 },
                { name: "MATH 210 - Algebra II",                  location: "50- Amfi2",  date: "2026-04-13", time: "13:30", duration: 120 },
                { name: "MATH 302 - Complex Analysis II",          location: "12- D1",    date: "2026-04-15", time: "09:30", duration: 60  },
                { name: "MATH 206 - Topology",                    location: "77-/D1/D3/D5", date: "2026-04-15", time: "17:00", duration: 120 },
                { name: "MATH 311 - Numerical Analysis II",        location: "8-D1",      date: "2026-04-16", time: "09:30", duration: 120 }
            ];

            // 1) Serdal'ın mevcut sınavlarındaki puanları önceki gözetmenlerden geri al
            DB.exams.filter(e => e.proctorId === serdal.id).forEach(e => {
                serdal.totalScore = Math.max(0, parseFloat((serdal.totalScore - e.score).toFixed(2)));
                serdal.taskCount = Math.max(0, serdal.taskCount - 1);
                // Sınavı "atansız" bırak geçici
                e.proctorId = null;
                e.proctorName = "";
            });

            // 2) Her hedef sınav için işlem yap
            serdalExams.forEach(target => {
                const dateObj = new Date(`${target.date}T${target.time}`);
                const k = getKatsayi(dateObj);
                const score = parseFloat((k * target.duration).toFixed(2));

                // DB'de isimle ara
                let exam = DB.exams.find(e => e.name.trim() === target.name.trim());

                if (exam) {
                    // Mevcutsa: şu anki gözetmeninden puanı geri al
                    const oldProctor = DB.staff.find(s => s.id === exam.proctorId);
                    if (oldProctor && oldProctor.id !== serdal.id) {
                        oldProctor.totalScore = Math.max(0, parseFloat((oldProctor.totalScore - exam.score).toFixed(2)));
                        oldProctor.taskCount = Math.max(0, oldProctor.taskCount - 1);
                    }
                    // Serdal'a ata
                    exam.proctorId = serdal.id;
                    exam.proctorName = serdal.name;
                    exam.score = score;
                    exam.katsayi = k;
                } else {
                    // Yoksa: yeni ekle
                    DB.exams.push({
                        id: Date.now() + Math.random(),
                        name: target.name,
                        location: target.location,
                        date: target.date,
                        time: target.time,
                        duration: target.duration,
                        katsayi: k,
                        score,
                        proctorId: serdal.id,
                        proctorName: serdal.name
                    });
                }

                // Serdal'a puanı ekle
                serdal.totalScore = parseFloat((serdal.totalScore + score).toFixed(2));
                serdal.taskCount = (serdal.taskCount || 0) + 1;
            });

            saveToLocalStorage();
            localStorage.setItem('serdal_fix_executed_v4', 'true');
            console.log("Serdal v4 tamamlandı. Görev sayısı: " + DB.exams.filter(e => e.proctorId === serdal.id).length);
        }
    }

    // Serdal v5: Puanı sıfırdan gerçek sınav kayıtlarından yeniden hesapla
    if (localStorage.getItem('serdal_fix_executed_v5') !== 'true') {
        const serdal = DB.staff.find(s => s.name === "Serdal Çömlekçi");
        if (serdal) {
            const realSerdalExams = DB.exams.filter(e => e.proctorId === serdal.id);
            const realTotal = realSerdalExams.reduce((sum, e) => sum + (e.score || 0), 0);
            serdal.totalScore = parseFloat(realTotal.toFixed(2));
            serdal.taskCount = realSerdalExams.length;
            saveToLocalStorage();
            localStorage.setItem('serdal_fix_executed_v5', 'true');
            console.log(`Serdal v5: Puan=${serdal.totalScore}, Görev=${serdal.taskCount}`);
        }
    }

    // v7: Başlangıç (Baz) Puanları Dahil Ederek Yeniden Hesaplama
    if (localStorage.getItem('score_recalc_v7') !== 'true') {
        // İsimlere göre başlangıç verileri
        const BASE_SCORES = {
            "Oğuzhan Selçuk": { score: 1200, count: 10 },
            "Ezgi Öztekin": { score: 1200, count: 10 },
            "Serdal Çömlekçi": { score: 600, count: 0 },
            "Aslıhan Gür": { score: 1200, count: 10 },
            "Şeyma Yaşar": { score: 1320, count: 11 },
            "Saliha Demirbüken": { score: 1200, count: 10 },
            "Serkan Ayrıca": { score: 1440, count: 12 },
            "Muhammed Ergen": { score: 1320, count: 11 },
            "Ömer Demir": { score: 1440, count: 12 },
            "Aysel Şahin": { score: 1440, count: 12 },
            "Yasin Turan": { score: 1800, count: 15 },
            "Çağla Özatar": { score: 1560, count: 13 },
            "Cansu Şahin": { score: 600, count: 0 }
        };

        // Adım 1: Her sınavın score'unu yeniden hesapla
        DB.exams.forEach(exam => {
            const dateObj = new Date(`${exam.date}T${exam.time}`);
            exam.score = calculateScore(dateObj, exam.duration);
            exam.katsayi = getKatsayi(dateObj);
        });

        // Adım 2: Her personelin baz puanının üzerine gerçek sınavları ekle
        DB.staff.forEach(s => {
            const myExams = DB.exams.filter(e => e.proctorId === s.id);
            const actualScore = myExams.reduce((sum, e) => sum + (e.score || 0), 0);
            const actualCount = myExams.length;

            const base = BASE_SCORES[s.name] || { score: 0, count: 0 };

            s.totalScore = parseFloat((base.score + actualScore).toFixed(2));
            s.taskCount = base.count + actualCount;
        });

        saveToLocalStorage();
        localStorage.setItem('score_recalc_v7', 'true');
        console.log("v7: Tüm puanlar BAZ puanlar dahil edilerek yeniden hesaplandı.");
    }

    // Çağla v8: Çağla Özatar'ın hafta sonuna (18.04.2026 gibi) atanan sınavlarını tespit et ve düzelt
    if (localStorage.getItem('cagla_weekend_fix_v8') !== 'true') {
        const cagla = DB.staff.find(s => s.name === "Çağla Özatar");
        if (cagla) {
            const problematicExams = DB.exams.filter(e => {
                if (e.proctorId !== cagla.id) return false;
                const d = new Date(e.date);
                const day = d.getDay();
                return day === 6 || day === 0; // Cumartesi veya Pazar
            });

            if (problematicExams.length > 0) {
                problematicExams.forEach(exam => {
                    // Çağla'dan puanı ve görev sayısını düş
                    cagla.totalScore = Math.max(0, parseFloat((cagla.totalScore - exam.score).toFixed(2)));
                    cagla.taskCount = Math.max(0, cagla.taskCount - 1);

                    // Yeni uygun gözetmeni bul
                    const newProctor = findBestProctor(exam.date, exam.time, exam.duration, exam.id);
                    if (newProctor) {
                        exam.proctorId = newProctor.id;
                        exam.proctorName = newProctor.name;
                        newProctor.totalScore = parseFloat((newProctor.totalScore + exam.score).toFixed(2));
                        newProctor.taskCount = (newProctor.taskCount || 0) + 1;
                    } else {
                        exam.proctorId = null;
                        exam.proctorName = "ATANMAMIŞ (Müsait kimse yok)";
                    }
                });
                saveToLocalStorage();
                console.log(`Çağla v8: ${problematicExams.length} hafta sonu sınavı başarıyla yeniden yönlendirildi.`);
            }
        }
        localStorage.setItem('cagla_weekend_fix_v8', 'true');
    }

    // INF v9: INF 101 Sınavı gözetmen düzeltmesi
    if (localStorage.getItem('inf_fix_v9') !== 'true') {
        const serdal = DB.staff.find(s => s.name === "Serdal Çömlekçi");
        const oguzhan = DB.staff.find(s => s.name === "Oğuzhan Selçuk");
        const cansu = DB.staff.find(s => s.name === "Cansu Şahin");

        DB.exams.forEach(exam => {
            if (exam.name.includes("INF 101") && exam.date === "2026-04-18") {
                // 1) Atanmamış olana Serdal'ı ata
                if (!exam.proctorId || exam.proctorName.includes("ATANMAMIŞ")) {
                    if (serdal) {
                        exam.proctorId = serdal.id;
                        exam.proctorName = serdal.name;
                        serdal.totalScore = parseFloat((serdal.totalScore + exam.score).toFixed(2));
                        serdal.taskCount = (serdal.taskCount || 0) + 1;
                    }
                }
                // 2) Cansu yerine Oğuzhan'ı ata
                else if (cansu && exam.proctorId === cansu.id) {
                    if (oguzhan) {
                        // Cansu'dan düş
                        cansu.totalScore = Math.max(0, parseFloat((cansu.totalScore - exam.score).toFixed(2)));
                        cansu.taskCount = Math.max(0, cansu.taskCount - 1);
                        // Oğuzhan'a ekle
                        exam.proctorId = oguzhan.id;
                        exam.proctorName = oguzhan.name;
                        oguzhan.totalScore = parseFloat((oguzhan.totalScore + exam.score).toFixed(2));
                        oguzhan.taskCount = (oguzhan.taskCount || 0) + 1;
                    }
                }
            }
        });
        saveToLocalStorage();
        localStorage.setItem('inf_fix_v9', 'true');
        console.log("INF v9: Gözetmen atamaları güncellendi.");
    }

    // v10: MATH 206 (Serdal) ve MATH 438 (Yasin) takası
    if (localStorage.getItem('swap_serdal_yasin_v10') !== 'true') {
        const serdal = DB.staff.find(s => s.name === "Serdal Çömlekçi");
        const yasin = DB.staff.find(s => s.name === "Yasin Turan");

        if (serdal && yasin) {
            const exam206 = DB.exams.find(e => e.name.includes("MATH 206") && e.proctorId === serdal.id);
            const exam438 = DB.exams.find(e => e.name.includes("MATH 438") && e.proctorId === yasin.id);

            if (exam206 && exam438) {
                // 1) Serdal'dan MATH 206'yı düş, MATH 438'i ekle
                serdal.totalScore = parseFloat((serdal.totalScore - exam206.score + exam438.score).toFixed(2));
                // taskCount değişmiyor çünkü 1 düşüp 1 ekliyoruz

                // 2) Yasin'den MATH 438'i düş, MATH 206'yı ekle
                yasin.totalScore = parseFloat((yasin.totalScore - exam438.score + exam206.score).toFixed(2));
                // taskCount değişmiyor

                // 3) Sınav kayıtlarını güncelle
                exam206.proctorId = yasin.id;
                exam206.proctorName = yasin.name;

                exam438.proctorId = serdal.id;
                exam438.proctorName = serdal.name;

                saveToLocalStorage();
                console.log("v10: MATH 206 ve MATH 438 takası başarıyla yapıldı.");
            }
        }
        localStorage.setItem('swap_serdal_yasin_v10', 'true');
    }

    // v11: Serdal Çömlekçi'nin Pazartesi çakışmasını gider (MATH 438'i başka birine aktar)
    if (localStorage.getItem('serdal_conflict_fix_v11') !== 'true') {
        const serdal = DB.staff.find(s => s.name === "Serdal Çömlekçi");
        if (serdal) {
            const problematicExam = DB.exams.find(e => e.name.includes("MATH 438") && e.proctorId === serdal.id && e.date === "2026-04-13");
            if (problematicExam) {
                // Serdal'dan düş
                serdal.totalScore = Math.max(0, parseFloat((serdal.totalScore - problematicExam.score).toFixed(2)));
                serdal.taskCount = Math.max(0, serdal.taskCount - 1);

                // Alternatif gözetmen bul (Aslıhan Gür, Ömer Demir veya müsait biri)
                const newProctor = findBestProctor(problematicExam.date, problematicExam.time, problematicExam.duration, problematicExam.id);
                if (newProctor) {
                    problematicExam.proctorId = newProctor.id;
                    problematicExam.proctorName = newProctor.name;
                    newProctor.totalScore = parseFloat((newProctor.totalScore + problematicExam.score).toFixed(2));
                    newProctor.taskCount = (newProctor.taskCount || 0) + 1;
                    console.log(`v11: MATH 438 Serdal'dan alınıp ${newProctor.name} hocaya atandı.`);
                } else {
                    problematicExam.proctorId = null;
                    problematicExam.proctorName = "ATANMAMIŞ";
                }
                saveToLocalStorage();
            }
        }
        localStorage.setItem('serdal_conflict_fix_v11', 'true');
    }

    // v12: Cansu Şahin ve Serdal Çömlekçi baz puanlarını 600 / görev 0 olarak güncelle
    if (localStorage.getItem('base_score_fix_v12') !== 'true') {
        ["Cansu Şahin", "Serdal Çömlekçi"].forEach(targetName => {
            const person = DB.staff.find(s => s.name === targetName);
            if (person) {
                // Sadece o kişiye atanmış gerçek sınav puanlarını hesapla
                const realExams = DB.exams.filter(e => e.proctorId === person.id);
                const realScore = realExams.reduce((sum, e) => sum + (e.score || 0), 0);
                const realCount = realExams.length;
                // Baz 600 puan + gerçek sınav puanları
                person.totalScore = parseFloat((600 + realScore).toFixed(2));
                // Görev sayısı = sadece gerçek sınav sayısı (baz görev = 0)
                person.taskCount = realCount;
            }
        });
        saveToLocalStorage();
        localStorage.setItem('base_score_fix_v12', 'true');
        console.log("v12: Cansu ve Serdal baz puanları 600/0 olarak güncellendi.");
    }

    // v13: Tüm sınav dağılımını sıfırla ve çakışmasız yeniden yap
    if (localStorage.getItem('reseed_v13') !== 'true') {
        const BASE_SCORES_V13 = {
            "Oğuzhan Selçuk":    { score: 1200, count: 10 },
            "Ezgi Öztekin":      { score: 1200, count: 10 },
            "Serdal Çömlekçi":   { score: 600,  count: 0  },
            "Aslıhan Gür":       { score: 1200, count: 10 },
            "Şeyma Yaşar":       { score: 1320, count: 11 },
            "Saliha Demirbüken": { score: 1200, count: 10 },
            "Serkan Ayrıca":     { score: 1440, count: 12 },
            "Muhammed Ergen":    { score: 1320, count: 11 },
            "Ömer Demir":        { score: 1440, count: 12 },
            "Aysel Şahin":       { score: 1440, count: 12 },
            "Yasin Turan":       { score: 1800, count: 15 },
            "Çağla Özatar":      { score: 1560, count: 13 },
            "Cansu Şahin":       { score: 600,  count: 0  }
        };

        // 1) Tüm personeli baz puanlara sıfırla
        DB.staff.forEach(s => {
            const base = BASE_SCORES_V13[s.name] || { score: 0, count: 0 };
            s.totalScore = base.score;
            s.taskCount  = base.count;
        });

        // 2) Tüm sınavları temizle
        DB.exams = [];

        // 3) Çakışma kontrolüyle yeniden seed et (seedInitialExams artık isProctorTrulyFree kullanıyor)
        seedInitialExams(); // içinde saveToLocalStorage() çağrılıyor

        localStorage.setItem('reseed_v13', 'true');
        console.log("v13: Tüm sınav dağılımı çakışmasız olarak yeniden yapıldı.");
    }

    // v14: Personel talepleri uygulaması
    // - Şeyma Yaşar: 4 Mayıs ve 8 Mayıs atamaları iptal (tarihi uymuyor) + Mayıs sonu kısıtı
    // - MATH 114: Saliha ↔ Yasin takası (9 Nisan ↔ 16 Nisan) + Amfi2 için 3. gözetmen
    if (localStorage.getItem('staff_adjust_v14') !== 'true') {

        // --- ADIM 1: Şeyma Yaşar kısıtları ---
        if (!DB.constraints["Şeyma Yaşar"]) DB.constraints["Şeyma Yaşar"] = [];
        const seymaBlokedDates = [
            "05-04", "05-08",                                           // Tarihi uymuyor
            "05-20","05-21","05-22","05-23","05-24","05-25",            // Mayıs sonu (nikah/kına)
            "05-26","05-27","05-28","05-29","05-30","05-31"
        ];
        seymaBlokedDates.forEach(d => {
            if (!DB.constraints["Şeyma Yaşar"].some(c => c.date === d)) {
                DB.constraints["Şeyma Yaşar"].push({ date: d, start: "00:00", end: "23:59" });
            }
        });

        // --- ADIM 2: Şeyma'nın 4 Mayıs ve 8 Mayıs atamalarını başkasına devret ---
        const seyma = DB.staff.find(s => s.name === "Şeyma Yaşar");
        if (seyma) {
            const seymaConflictExams = DB.exams.filter(e =>
                e.proctorId === seyma.id &&
                (e.date === "2026-05-04" || e.date === "2026-05-08")
            );
            seymaConflictExams.forEach(exam => {
                seyma.totalScore = Math.max(0, parseFloat((seyma.totalScore - exam.score).toFixed(2)));
                seyma.taskCount  = Math.max(0, seyma.taskCount - 1);
                const alt = findBestProctor(exam.date, exam.time, exam.duration, exam.id);
                if (alt) {
                    exam.proctorId   = alt.id;
                    exam.proctorName = alt.name;
                    alt.totalScore   = parseFloat((alt.totalScore + exam.score).toFixed(2));
                    alt.taskCount    = (alt.taskCount || 0) + 1;
                    console.log(`v14: ${exam.name} → ${alt.name} (Şeyma'dan devir)`);
                } else {
                    exam.proctorId   = null;
                    exam.proctorName = "ATANMAMIŞ";
                    console.warn(`v14: ${exam.name} için yedek bulunamadı!`);
                }
            });
        }

        // --- ADIM 3: Saliha Demirbüken ↔ Yasin Turan takası ---
        //   Saliha: 9 Nisan MATH 114 (13:30) → Yasin'e
        //   Yasin:  16 Nisan MATH 106 (18:00) → Saliha'ya
        const saliha = DB.staff.find(s => s.name === "Saliha Demirbüken");
        const yasin  = DB.staff.find(s => s.name === "Yasin Turan");

        if (saliha && yasin) {
            const math114 = DB.exams.find(e =>
                e.name.includes("MATH 114") && e.date === "2026-04-09" && e.proctorId === saliha.id
            );
            const math106 = DB.exams.find(e =>
                e.name.includes("MATH 106") && e.date === "2026-04-16" && e.proctorId === yasin.id
            );

            if (math114) {
                // Saliha MATH 114'ten çıkar, Yasin girer
                saliha.totalScore = Math.max(0, parseFloat((saliha.totalScore - math114.score).toFixed(2)));
                saliha.taskCount  = Math.max(0, saliha.taskCount - 1);
                yasin.totalScore  = parseFloat((yasin.totalScore + math114.score).toFixed(2));
                yasin.taskCount   = (yasin.taskCount || 0) + 1;
                math114.proctorId   = yasin.id;
                math114.proctorName = yasin.name;
                console.log("v14: Saliha → MATH 114'ten çıkarıldı, Yasin eklendi.");
            }

            if (math106) {
                // Yasin MATH 106'dan çıkar, Saliha girer
                yasin.totalScore  = Math.max(0, parseFloat((yasin.totalScore - math106.score).toFixed(2)));
                yasin.taskCount   = Math.max(0, yasin.taskCount - 1);
                saliha.totalScore = parseFloat((saliha.totalScore + math106.score).toFixed(2));
                saliha.taskCount  = (saliha.taskCount || 0) + 1;
                math106.proctorId   = saliha.id;
                math106.proctorName = saliha.name;
                console.log("v14: Yasin → MATH 106'dan çıkarıldı, Saliha eklendi.");
            }
        }

        // --- ADIM 4: MATH 114'e 3. gözetmen ekle (Amfi2 için 2 kişi + D1 için 1 kişi = 3 toplam) ---
        // Mevcut: Ezgi + Yasin (2 kişi). Bir tane daha gerekiyor.
        const math114ref = DB.exams.find(e => e.name.includes("MATH 114") && e.date === "2026-04-09");
        if (math114ref) {
            const currentCount = DB.exams.filter(e => e.name.includes("MATH 114") && e.date === "2026-04-09").length;
            if (currentCount < 3) {
                const thirdProctor = findBestProctor(math114ref.date, math114ref.time, math114ref.duration);
                if (thirdProctor) {
                    const newExamRecord = {
                        id:          Date.now() + Math.random(),
                        name:        math114ref.name,
                        location:    math114ref.location,
                        date:        math114ref.date,
                        time:        math114ref.time,
                        duration:    math114ref.duration,
                        katsayi:     math114ref.katsayi,
                        score:       math114ref.score,
                        proctorId:   thirdProctor.id,
                        proctorName: thirdProctor.name
                    };
                    DB.exams.push(newExamRecord);
                    thirdProctor.totalScore = parseFloat((thirdProctor.totalScore + newExamRecord.score).toFixed(2));
                    thirdProctor.taskCount  = (thirdProctor.taskCount || 0) + 1;
                    console.log(`v14: MATH 114'e 3. gözetmen eklendi: ${thirdProctor.name}`);
                } else {
                    console.warn("v14: MATH 114 için 3. gözetmen bulunamadı!");
                }
            }
        }

        saveToLocalStorage();
        localStorage.setItem('staff_adjust_v14', 'true');
        console.log("v14: Tüm personel talepleri başarıyla uygulandı.");
    }

    // v15: Ezgi Öztekin - Pazartesi (1) ve Perşembe (4) tüm gün kısıt
    if (localStorage.getItem('ezgi_mon_thu_v15') !== 'true') {
        // 1) DB.constraints güncelle
        if (!DB.constraints["Ezgi Öztekin"]) DB.constraints["Ezgi Öztekin"] = [];
        // Mevcut kısmi Pazartesi/Perşembe kısıtlarını kaldır, tam gün ekle
        DB.constraints["Ezgi Öztekin"] = DB.constraints["Ezgi Öztekin"].filter(c =>
            !(c.day === 1 || c.day === 4)   // eski kısmi kısıtları sil
        );
        DB.constraints["Ezgi Öztekin"].push(
            { day: 1, start: "00:00", end: "23:59" },  // Pazartesi - tüm gün
            { day: 4, start: "00:00", end: "23:59" }   // Perşembe  - tüm gün
        );

        // 2) Ezgi'nin mevcut Pazartesi/Perşembe atamalarını başkasına devret
        const ezgi = DB.staff.find(s => s.name === "Ezgi Öztekin");
        if (ezgi) {
            const ezgiMonThuExams = DB.exams.filter(e => {
                if (e.proctorId !== ezgi.id) return false;
                const dayOfWeek = new Date(e.date).getDay();
                return dayOfWeek === 1 || dayOfWeek === 4; // Pazartesi veya Perşembe
            });

            ezgiMonThuExams.forEach(exam => {
                ezgi.totalScore = Math.max(0, parseFloat((ezgi.totalScore - exam.score).toFixed(2)));
                ezgi.taskCount  = Math.max(0, ezgi.taskCount - 1);
                const alt = findBestProctor(exam.date, exam.time, exam.duration, exam.id);
                if (alt) {
                    exam.proctorId   = alt.id;
                    exam.proctorName = alt.name;
                    alt.totalScore   = parseFloat((alt.totalScore + exam.score).toFixed(2));
                    alt.taskCount    = (alt.taskCount || 0) + 1;
                    console.log(`v15: ${exam.name} (${exam.date}) → ${alt.name} (Ezgi'den devir)`);
                } else {
                    exam.proctorId   = null;
                    exam.proctorName = "ATANMAMIŞ";
                    console.warn(`v15: ${exam.name} için yedek bulunamadı!`);
                }
            });
        }

        saveToLocalStorage();
        localStorage.setItem('ezgi_mon_thu_v15', 'true');
        console.log("v15: Ezgi'nin Pazartesi/Perşembe atamaları temizlendi.");
    }

    // v16: Şeyma Yaşar'ı önceki dönem görevlerine ekle
    //   - 23 Mart 09:30: MATH 446 (3 saat)
    //   - 25 Mart 13:30: MATH 204 (3 saat)
    //   - 6 Nisan 17:30: MATH 112 (2 saat)
    //   (27 Mart PHYS 114 ve 30 Mart MATH 304 zaten mevcut)
    if (localStorage.getItem('seyma_assign_v16') !== 'true') {
        const seyma = DB.staff.find(s => s.name === "Şeyma Yaşar");

        if (seyma) {
            const targets = [
                { nameKey: "MATH 446", date: "2026-03-23", time: "09:30", duration: 180 },
                { nameKey: "MATH 204", date: "2026-03-25", time: "13:30", duration: 180 },
                { nameKey: "MATH 112", date: "2026-04-06", time: "17:30", duration: 120 }
            ];

            targets.forEach(t => {
                // Şeyma zaten bu sınavda var mı kontrol et
                const alreadyAssigned = DB.exams.some(e =>
                    e.name.includes(t.nameKey) && e.date === t.date && e.proctorId === seyma.id
                );
                if (alreadyAssigned) {
                    console.log(`v16: Şeyma zaten ${t.nameKey} (${t.date}) sınavında mevcut.`);
                    return;
                }

                // Referans sınavı bul (aynı isim ve tarih)
                const refExam = DB.exams.find(e => e.name.includes(t.nameKey) && e.date === t.date);
                if (!refExam) {
                    console.warn(`v16: ${t.nameKey} (${t.date}) sınavı bulunamadı!`);
                    return;
                }

                const score = calculateScore(new Date(`${t.date}T${t.time}`), t.duration);

                const newRecord = {
                    id:          Date.now() + Math.random(),
                    name:        refExam.name,
                    location:    refExam.location,
                    date:        t.date,
                    time:        t.time,
                    duration:    t.duration,
                    katsayi:     getKatsayi(new Date(`${t.date}T${t.time}`)),
                    score:       score,
                    proctorId:   seyma.id,
                    proctorName: seyma.name
                };

                DB.exams.push(newRecord);
                seyma.totalScore = parseFloat((seyma.totalScore + score).toFixed(2));
                seyma.taskCount  = (seyma.taskCount || 0) + 1;
                console.log(`v16: Şeyma → ${refExam.name} (${t.date}) ataması yapıldı. Puan: ${score}`);
            });
        }

        saveToLocalStorage();
        localStorage.setItem('seyma_assign_v16', 'true');
        console.log("v16: Şeyma Yaşar görev atamaları tamamlandı.");
    }

    // v17: Aslıhan Gür'ü MATH 114 sınavına ata (09.04.2026 Perşembe 13:30)
    if (localStorage.getItem('aslihan_assign_v17') !== 'true') {
        const aslihan = DB.staff.find(s => s.name === "Aslıhan Gür");
        if (aslihan) {
            const targetDate = "2026-04-09";
            const targetName = "MATH 114";
            const refExam = DB.exams.find(e => e.name.includes(targetName) && e.date === targetDate);
            if (refExam) {
                const alreadyAssigned = DB.exams.some(e => 
                    e.name.includes(targetName) && e.date === targetDate && e.proctorId === aslihan.id
                );
                if (!alreadyAssigned) {
                    const newExamRecord = {
                        id: Date.now() + Math.random(),
                        name: refExam.name,
                        location: refExam.location,
                        date: refExam.date,
                        time: refExam.date, // typo
                        time: refExam.time,
                        duration: refExam.duration,
                        katsayi: refExam.katsayi,
                        score: refExam.score,
                        proctorId: aslihan.id,
                        proctorName: aslihan.name
                    };
                    DB.exams.push(newExamRecord);
                    aslihan.totalScore = parseFloat((aslihan.totalScore + newExamRecord.score).toFixed(2));
                    aslihan.taskCount = (aslihan.taskCount || 0) + 1;
                }
            }
        }
        saveToLocalStorage();
        localStorage.setItem('aslihan_assign_v17', 'true');
        console.log("v17: Aslıhan Gür ataması tamamlandı.");
    }

    // v18: Ömer Demir - 06.05.2026 MATH 204 (Çarşamba kısıtı) görevini devret
    if (localStorage.getItem('omer_reassign_v18') !== 'true') {
        const omer = DB.staff.find(s => s.name === "Ömer Demir");
        if (omer) {
            const date = "2026-05-06";
            const exam = DB.exams.find(e => 
                e.proctorId === omer.id && 
                e.date === date && 
                e.name.includes("MATH 204")
            );

            if (exam) {
                // Şeyma Yaşar dışındaki müsait personelleri bul
                const available = DB.staff.filter(s => 
                    s.id !== omer.id && 
                    s.name !== "Şeyma Yaşar" && 
                    isProctorTrulyFree(s.id, exam.date, exam.time, exam.duration, exam.id)
                ).sort((a, b) => a.totalScore - b.totalScore);

                if (available.length > 0) {
                    const nextProctor = available[0];
                    
                    // Ömer'den düş
                    omer.totalScore = Math.max(0, parseFloat((omer.totalScore - exam.score).toFixed(2)));
                    omer.taskCount = Math.max(0, omer.taskCount - 1);

                    // Yeni kişiye ata
                    exam.proctorId = nextProctor.id;
                    exam.proctorName = nextProctor.name;
                    nextProctor.totalScore = parseFloat((nextProctor.totalScore + exam.score).toFixed(2));
                    nextProctor.taskCount = (nextProctor.taskCount || 0) + 1;

                    console.log(`v18: MATH 204 Ömer Demir'den alınıp ${nextProctor.name} hocaya atandı.`);
                } else {
                    console.warn("v18: Ömer Demir'in görevi için Şeyma Yaşar dışında müsait kimse bulunamadı!");
                }
            }
        }
        saveToLocalStorage();
        localStorage.setItem('omer_reassign_v18', 'true');
        console.log("v18: Ömer Demir görev değişimi tamamlandı.");
    }

    // v19: Yasin Turan - 06.04.2026 MATH 112 (Analysis II) görevini iptal et
    if (localStorage.getItem('yasin_remove_v19') !== 'true') {
        const yasin = DB.staff.find(s => s.name === "Yasin Turan");
        if (yasin) {
            const date = "2026-04-06";
            const exam = DB.exams.find(e => 
                e.proctorId === yasin.id && 
                e.date === date && 
                e.name.includes("MATH 112")
            );

            if (exam) {
                // Yasin'den puanı ve görev sayısını düş
                yasin.totalScore = Math.max(0, parseFloat((yasin.totalScore - exam.score).toFixed(2)));
                yasin.taskCount = Math.max(0, yasin.taskCount - 1);

                // Sınav kaydını tamamen sil (Zaten 3 kişiydi, 2 kişi kalacak)
                DB.exams = DB.exams.filter(e => e.id !== exam.id);
                
                console.log(`v19: MATH 112 (Analysis II) sınavından Yasin Turan çıkarıldı.`);
            }
        }
        saveToLocalStorage();
        localStorage.setItem('yasin_remove_v19', 'true');
        console.log("v19: Yasin Turan görev iptali tamamlandı.");
    }

    // v20: Serkan Ayrıca - 09.04.2026 MATH 114 (Linear Algebra II) "ATANMAMIŞ" görevini ona ata
    if (localStorage.getItem('serkan_assign_v20') !== 'true') {
        const serkan = DB.staff.find(s => s.name === "Serkan Ayrıca");
        if (serkan) {
            const date = "2026-04-09";
            // Bu sınavda "ATANMAMIŞ" olan veya proctorId'si null olan kaydı bul
            let exam = DB.exams.find(e => 
                (e.proctorId === null || e.proctorName.includes("ATANMAMIŞ")) && 
                e.date === date && 
                e.name.includes("MATH 114")
            );

            if (exam) {
                // Serkan'a ata
                exam.proctorId = serkan.id;
                exam.proctorName = serkan.name;
                
                // Serkan'ın puanını ve görev sayısını güncelle
                serkan.totalScore = parseFloat((serkan.totalScore + exam.score).toFixed(2));
                serkan.taskCount = (serkan.taskCount || 0) + 1;
                
                console.log(`v20: MATH 114 (Linear Algebra II) sınavına Serkan Ayrıca atandı.`);
            } else {
                // Eğer hiç "ATANMAMIŞ" yoksa ama 3. kişi gerekiyorsa yeni ekle (v14 mantığına benzer)
                const math114ref = DB.exams.find(e => e.name.includes("MATH 114") && e.date === date);
                if (math114ref) {
                    const currentCount = DB.exams.filter(e => e.name.includes("MATH 114") && e.date === date).length;
                    if (currentCount < 3) {
                         const score = calculateScore(new Date(`${date}T13:30`), 120);
                         DB.exams.push({
                            id: Date.now() + Math.random(),
                            name: math114ref.name,
                            location: math114ref.location,
                            date: date,
                            time: "13:30",
                            duration: 120,
                            katsayi: getKatsayi(new Date(`${date}T13:30`)),
                            score: score,
                            proctorId: serkan.id,
                            proctorName: serkan.name
                        });
                        serkan.totalScore = parseFloat((serkan.totalScore + score).toFixed(2));
                        serkan.taskCount = (serkan.taskCount || 0) + 1;
                        console.log(`v20: MATH 114'e Serkan Ayrıca yeni kayıt olarak eklendi.`);
                    }
                }
            }
        }
        saveToLocalStorage();
        localStorage.setItem('serkan_assign_v20', 'true');
        console.log("v20: Serkan Ayrıca ataması tamamlandı.");
    }

    initUI();
    renderDashboard();
    loadStaffSelects(); // Personel seçim dropdownlarını yükle
}

const navButtons = {
    dashboard: document.getElementById('btn-dashboard'),
    schedule: document.getElementById('btn-schedule'),
    exams: document.getElementById('btn-exams'),
    staff: document.getElementById('btn-staff'),
    availability: document.getElementById('btn-availability'),
    constraints: document.getElementById('btn-constraints'),
    stats: document.getElementById('btn-stats'),
    requests: document.getElementById('btn-requests'),
    settings: document.getElementById('btn-settings'),
    'my-profile': document.getElementById('btn-my-profile'),
    archive: document.getElementById('btn-archive')
};

const sections = {
    dashboard: document.getElementById('section-dashboard'),
    schedule: document.getElementById('section-schedule'),
    exams: document.getElementById('section-exams'),
    staff: document.getElementById('section-staff'),
    availability: document.getElementById('section-availability'),
    constraints: document.getElementById('section-constraints'),
    stats: document.getElementById('section-stats'),
    requests: document.getElementById('section-requests'),
    settings: document.getElementById('section-settings'),
    'my-profile': document.getElementById('section-my-profile'),
    archive: document.getElementById('section-archive')
};

// Navigation
Object.entries(navButtons).forEach(([key, btn]) => {
    if (!btn) return;
    btn.addEventListener('click', () => {
        // Update Buttons
        Object.values(navButtons).forEach(b => { if (b) b.classList.remove('active'); });
        btn.classList.add('active');

        // Update Sections
        Object.values(sections).forEach(s => { if (s) s.classList.add('hidden'); });
        if (sections[key]) sections[key].classList.remove('hidden');

        if (key === 'dashboard') renderDashboard();
        if (key === 'schedule') renderSchedule();
        if (key === 'exams') renderExams();
        if (key === 'staff') renderStaff();
        if (key === 'availability') renderAvailability();
        if (key === 'constraints') renderConstraintsPage();
        if (key === 'stats') renderStats();
        if (key === 'requests') renderSwapRequests();
        if (key === 'settings') renderSettings();
        if (key === 'my-profile') renderMyProfile();
        if (key === 'archive') renderArchives();
    });
});

// Takvim Görünüm Değiştiricileri
document.getElementById('btn-view-list')?.addEventListener('click', () => {
    document.getElementById('schedule-list-view').classList.remove('hidden');
    document.getElementById('schedule-calendar-view').classList.add('hidden');
    document.getElementById('btn-view-list').classList.add('active');
    document.getElementById('btn-view-calendar').classList.remove('active');
    renderSchedule();
});

document.getElementById('btn-view-calendar')?.addEventListener('click', () => {
    document.getElementById('schedule-list-view').classList.add('hidden');
    document.getElementById('schedule-calendar-view').classList.remove('hidden');
    document.getElementById('btn-view-list').classList.remove('active');
    document.getElementById('btn-view-calendar').classList.add('active');
    renderCalendar();
});

// Takvim Navigasyonu
document.getElementById('btn-cal-prev')?.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderSchedule();
    updateMonthSelectorUI();
});
document.getElementById('btn-cal-next')?.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderSchedule();
    updateMonthSelectorUI();
});

// 12 Ay Seçici Dinleyicileri
document.querySelectorAll('#month-selector button').forEach(btn => {
    btn.addEventListener('click', () => {
        const month = parseInt(btn.getAttribute('data-month'));
        currentCalendarDate.setMonth(month);
        renderSchedule();
        updateMonthSelectorUI();
    });
});

function updateMonthSelectorUI() {
    const currentMonth = currentCalendarDate.getMonth();
    document.querySelectorAll('#month-selector button').forEach(btn => {
        const m = parseInt(btn.getAttribute('data-month'));
        btn.classList.toggle('active', m === currentMonth);
    });
}

let currentSort = { key: 'date', dir: 'asc' };
let currentCalendarDate = new Date();
let currentTypeFilter = 'all'; // 'all', 'vize', 'final', 'but'
let currentProfileTypeFilter = 'all';

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('header nav button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(sectionId.replace('section-', 'btn-'));
    if (activeBtn) activeBtn.classList.add('active');
}

function initUI() {
    updateMonthSelectorUI();

    
    // Genel Navigasyon Dinleyicileri
    const navButtons = document.querySelectorAll('header nav button');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionId = btn.id.replace('btn-', 'section-');
            showSection(sectionId);
            
            // Sekmeye özel render işlemleri
            if (btn.id === 'btn-dashboard') renderDashboard();
            if (btn.id === 'btn-schedule') renderSchedule();
            if (btn.id === 'btn-exams') renderExams();
            if (btn.id === 'btn-staff') renderStaff();
            if (btn.id === 'btn-availability') renderAvailability();
            if (btn.id === 'btn-stats') renderStats();
            if (btn.id === 'btn-requests') renderSwapRequests();
            if (btn.id === 'btn-my-profile') renderMyProfile();
            if (btn.id === 'btn-settings') renderSettings();
        });
    });

    const btnAddExam = document.getElementById('btn-add-exam');
    if (btnAddExam) btnAddExam.addEventListener('click', showAddExamModal);

    const btnAddStaff = document.getElementById('btn-add-staff');
    if (btnAddStaff) btnAddStaff.addEventListener('click', showAddStaffModal);

    const btnAddProfileCon = document.getElementById('btn-profile-add-con');
    if (btnAddProfileCon) btnAddProfileCon.addEventListener('click', addProfileConstraint);

    document.getElementById('profile-staff-select')?.addEventListener('change', renderMyProfile);
    
    // Profil Takvimi Navigasyonu
    document.getElementById('btn-profile-cal-prev')?.addEventListener('click', () => {
        currentProfileDate.setMonth(currentProfileDate.getMonth() - 1);
        renderProfileCalendar();
    });
    document.getElementById('btn-profile-cal-next')?.addEventListener('click', () => {
        currentProfileDate.setMonth(currentProfileDate.getMonth() + 1);
        renderProfileCalendar();
    });
    
    // Profil Ay Seçiciler
    document.querySelectorAll('#profile-month-selector button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const m = parseInt(e.target.getAttribute('data-month'));
            currentProfileDate.setMonth(m);
            renderProfileCalendar();
        });
    });

    // Profil Filtreler
    document.querySelectorAll('#profile-type-filter button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentProfileTypeFilter = e.target.getAttribute('data-type');
            document.querySelectorAll('#profile-type-filter button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderMyProfile();
        });
    });

    // Profil Kısıt Tipi Değişimi
    document.getElementById('profile-con-type')?.addEventListener('change', (e) => {
        const type = e.target.value;
        const dayGroup = document.getElementById('profile-con-day-group');
        const dateGroup = document.getElementById('profile-con-date-group');
        if (type === 'day') {
            dayGroup.classList.remove('hidden');
            dateGroup.classList.add('hidden');
        } else {
            dayGroup.classList.add('hidden');
            dateGroup.classList.remove('hidden');
        }
    });

    document.querySelectorAll('#profile-month-selector button').forEach(btn => {
        btn.addEventListener('click', () => {
            currentProfileDate.setMonth(parseInt(btn.dataset.month));
            renderProfileCalendar();
        });
    });

    // Sınav Türü Filtreleri (Genel)
    document.querySelectorAll('#schedule-type-filter .type-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#schedule-type-filter .type-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTypeFilter = btn.dataset.type;
            renderSchedule();
        });
    });

    // Sınav Türü Filtreleri (Profil)
    document.querySelectorAll('#profile-type-filter .type-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#profile-type-filter .type-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentProfileTypeFilter = btn.dataset.type;
            renderProfileCalendar();
        });
    });
    document.getElementById('btn-modal-cancel')?.addEventListener('click', hideModal);
    document.getElementById('btn-close-exam-detail')?.addEventListener('click', () => {
        document.getElementById('modal-exam-detail').classList.add('hidden');
    });
    document.getElementById('modal-exam-detail')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-exam-detail')) {
            document.getElementById('modal-exam-detail').classList.add('hidden');
        }
    });

    // Kısıt Yönetimi Form Olayları
    const constraintStaffSelect = document.getElementById('constraint-staff-select');
    if (constraintStaffSelect) {
        constraintStaffSelect.addEventListener('change', () => {
            renderConstraintsList(constraintStaffSelect.value);
        });
    }

    const constraintTypeSelect = document.getElementById('constraint-type');
    if (constraintTypeSelect) {
        constraintTypeSelect.addEventListener('change', () => {
            const isDay = constraintTypeSelect.value === 'day';
            document.getElementById('constraint-day-group').classList.toggle('hidden', !isDay);
            document.getElementById('constraint-date-group').classList.toggle('hidden', isDay);
        });
    }

    const formAddConstraint = document.getElementById('form-add-constraint');
    if (formAddConstraint) {
        formAddConstraint.addEventListener('submit', (e) => {
            e.preventDefault();
            addConstraint();
        });
    }

    // Takas Talebi Form Olayları
    document.getElementById('btn-send-swap-mail')?.addEventListener('click', sendSwapMail);
    document.getElementById('btn-swap-cancel')?.addEventListener('click', () => {
        document.getElementById('modal-swap').classList.add('hidden');
    });
    document.getElementById('form-swap-request')?.addEventListener('submit', (e) => {
        e.preventDefault();
        submitSwapRequest();
    });

    // Tablo sıralama dinleyicileri
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.getAttribute('data-sort');
            if (currentSort.key === sortKey) {
                currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.key = sortKey;
                currentSort.dir = 'asc';
            }
            renderExams();
        });
    });

    // İndirme (Export) Butonları Dinleyicileri
    const btnExportScheduleExcel = document.getElementById('btn-export-schedule-excel');
    if (btnExportScheduleExcel) {
        btnExportScheduleExcel.addEventListener('click', () => {
             exportTableToExcel('table-schedule', 'Sinav_Programi.xlsx');
        });
    }

    const btnExportSchedulePdf = document.getElementById('btn-export-schedule-pdf');
    if (btnExportSchedulePdf) {
        btnExportSchedulePdf.addEventListener('click', exportScheduleToPDF);
    }

    const btnExportSchedule = document.getElementById('btn-export-schedule');
    if (btnExportSchedule) {
        btnExportSchedule.addEventListener('click', () => {
             exportElementAsImage(document.querySelector('#section-schedule .table-container'), 'Sinav_Programi.png');
        });
    }

    const btnResolveConflicts = document.getElementById('btn-resolve-conflicts');
    if (btnResolveConflicts) {
        btnResolveConflicts.addEventListener('click', () => {
            const result = autoResolveConflicts();
            if (result.message) {
                showSuccessToast(`✅ ${result.message}`);
            } else {
                let msg = `${result.resolved} çakışma başarıyla giderildi!`;
                if (result.skipped > 0) {
                    msg += `\n⚠️ ${result.skipped} çakışma için uygun yedek bulunamadı.`;
                }
                showSuccessToast(msg);
            }
            renderExams();
            renderSchedule();
            renderDashboard();
            renderStaff();
        });
    }

    // Yedekleme ve Geri Yükleme (JSON)
    const btnBackup = document.getElementById('btn-backup-system');
    if (btnBackup) {
        btnBackup.addEventListener('click', () => {
            const dataStr = JSON.stringify(DB, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Gozetmenlik_Yedek_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    }

    const btnResetExams = document.getElementById('btn-reset-exams');
    if (btnResetExams) {
        btnResetExams.addEventListener('click', () => {
            if (confirm("DİKKAT: Mevcut tüm sınav programı silinecek!\n\nAncak hocaların birikmiş puanları ve görev sayıları KORUNACAKTIR. Bu işlem vize sonu, final öncesi temizlik için kullanılır. Devam etmek istiyor musunuz?")) {
                resetExamsButKeepScores();
                renderExams();
                renderSchedule();
                renderDashboard();
                renderStaff();
                alert("✓ Sınav programı başarıyla sıfırlandı. Puanlar korundu.");
            }
        });
    }

    const btnRestore = document.getElementById('id-restore-system');
    if (btnRestore) {
        btnRestore.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const importedDB = JSON.parse(event.target.result);
                        if (importedDB && importedDB.staff && importedDB.exams) {
                            if (confirm("Mevcut tüm veriler silinecek ve seçilen yedeğe dönülecek. Onaylıyor musunuz?")) {
                                DB = importedDB;
                                saveToLocalStorage();
                                location.reload();
                            }
                        } else {
                            alert("Hata: Geçersiz yedek dosyası!");
                        }
                    } catch (err) {
                        alert("Hata: Dosya okunamadı!");
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        });
    }

    const btnExportDashboard = document.getElementById('btn-export-dashboard');
    if (btnExportDashboard) {
        btnExportDashboard.addEventListener('click', () => {
             exportElementAsImage(document.getElementById('dashboard-export-container'), 'Gozetmenlik_Analiz.png');
        });
    }

    const btnGitHubSync = document.getElementById('btn-github-sync');
    if (btnGitHubSync) {
        btnGitHubSync.addEventListener('click', showGitHubSyncModal);
    }

    const btnEditAnnounce = document.getElementById('btn-edit-announcement');
    if (btnEditAnnounce) {
        btnEditAnnounce.addEventListener('click', () => {
            const modal = document.getElementById('modal-announcement');
            const input = document.getElementById('announcement-input');
            input.value = DB.announcement || "";
            modal.classList.remove('hidden');
        });
    }

    const btnRemindTomorrow = document.getElementById('btn-remind-tomorrow');
    if (btnRemindTomorrow) {
        btnRemindTomorrow.addEventListener('click', remindTomorrowExams);
    }

    const btnSmartRemind = document.getElementById('btn-smart-remind');
    if (btnSmartRemind) {
        btnSmartRemind.addEventListener('click', remindTomorrowExams);
    }

    const btnCopySyncCode = document.getElementById('btn-copy-sync-code');
    if (btnCopySyncCode) {
        btnCopySyncCode.addEventListener('click', () => {
            const textarea = document.getElementById('github-sync-code');
            textarea.select();
            document.execCommand('copy');
            btnCopySyncCode.textContent = "✅ Kopyalandı!";
            setTimeout(() => { btnCopySyncCode.textContent = "📋 Kodu Kopyala"; }, 2000);
        });
    }

    const btnExportExams = document.getElementById('btn-export-exams');
    if (btnExportExams) {
        btnExportExams.addEventListener('click', () => {
             exportElementAsImage(document.querySelector('#section-exams .table-container'), 'Sinavlar_Listesi.png');
        });
    }

    const btnExportStaff = document.getElementById('btn-export-staff');
    if (btnExportStaff) {
        btnExportStaff.addEventListener('click', () => {
             exportElementAsImage(document.querySelector('#section-staff .table-container'), 'Personel_Listesi.png');
        });
    }

    const btnExportIndividualPdf = document.getElementById('btn-export-individual-schedule-pdf');
    if (btnExportIndividualPdf) {
        btnExportIndividualPdf.addEventListener('click', exportIndividualToPDF);
    }

    const btnExportIndividual = document.getElementById('btn-export-individual-schedule');
    if (btnExportIndividual) {
        btnExportIndividual.addEventListener('click', () => {
            const name = document.getElementById('individual-proctor-name').textContent;
            exportElementAsImage(document.getElementById('individual-schedule-card'), `Program_${name}.png`);
        });
    }

    const btnExportIndividualIcs = document.getElementById('btn-export-individual-ics');
    if (btnExportIndividualIcs) {
        btnExportIndividualIcs.addEventListener('click', () => {
            const staffName = document.getElementById('individual-proctor-name').textContent;
            const exams = DB.exams.filter(ex => ex.proctors.some(p => p.name === staffName));
            downloadICSFile(exams, `Program_${staffName.replace(/\s+/g, '_')}.ics`);
        });
    }

    const btnProfileExportPdf = document.getElementById('btn-profile-export-pdf');
    if (btnProfileExportPdf) {
        btnProfileExportPdf.addEventListener('click', () => {
             // Bireysel portalda seçili hoca için PDF export
             exportIndividualToPDF();
        });
    }

    // --- ARŞİV OLAYLARI ---
    document.getElementById('btn-open-archive-modal')?.addEventListener('click', () => {
        document.getElementById('modal-archive-confirm').classList.remove('hidden');
        document.getElementById('archive-period-name').value = "";
    });

    document.getElementById('btn-archive-cancel')?.addEventListener('click', () => {
        document.getElementById('modal-archive-confirm').classList.add('hidden');
    });

    document.getElementById('btn-archive-confirm-submit')?.addEventListener('click', () => {
        const name = document.getElementById('archive-period-name').value;
        if (!name) return alert("Lütfen bir dönem adı giriniz.");
        
        if (confirm("Bu işlem mevcut sınavları silecektir. Emin misiniz?")) {
            const res = archiveCurrentPeriod(name);
            if (res.success) {
                showSuccessToast(res.message);
                document.getElementById('modal-archive-confirm').classList.add('hidden');
                renderArchives();
            }
        }
    });

    document.getElementById('btn-close-archive-detail')?.addEventListener('click', () => {
        document.getElementById('modal-archive-detail').classList.add('hidden');
    });

    document.getElementById('btn-archive-restore')?.addEventListener('click', () => {
        const id = document.getElementById('modal-archive-detail').dataset.archiveId;
        if (id && confirm("Mevcut sınav programı silinecek ve bu arşiv yüklenecektir. Onaylıyor musunuz?")) {
            if (restoreArchive(parseInt(id))) {
                showSuccessToast("Arşiv başarıyla geri yüklendi!");
                document.getElementById('modal-archive-detail').classList.add('hidden');
                showSection('section-schedule');
                renderSchedule();
            }
        }
    });

    document.getElementById('btn-archive-export-excel')?.addEventListener('click', () => {
        const id = document.getElementById('modal-archive-detail').dataset.archiveId;
        const archive = DB.archives.find(a => a.id === parseInt(id));
        if (archive) {
            exportExamsToExcel(archive.exams, `${archive.name}_Programi.xlsx`);
        }
    });

    const btnCloseIndividual = document.getElementById('btn-close-individual-modal');
    if (btnCloseIndividual) {
        btnCloseIndividual.addEventListener('click', hideIndividualModal);
    }

    const availDateInput = document.getElementById('availability-date');
    if (availDateInput) {
        availDateInput.addEventListener('change', renderAvailability);
    }

    // ----------- Excel Import -----------
    const btnImport = document.getElementById('btn-import-excel');
    if (btnImport) {
        btnImport.addEventListener('click', () => {
            document.getElementById('import-preview').innerHTML = '';
            document.getElementById('import-file-input').value = '';
            document.getElementById('btn-confirm-import').disabled = true;
            document.getElementById('modal-import').classList.remove('hidden');
        });
    }

    const btnImportExamsAlt = document.getElementById('btn-import-auto-assign');
    if (btnImportExamsAlt) {
        btnImportExamsAlt.addEventListener('click', () => {
            document.getElementById('import-preview').innerHTML = '';
            document.getElementById('import-file-input').value = '';
            document.getElementById('btn-confirm-import').disabled = true;
            document.getElementById('modal-import').classList.remove('hidden');
        });
    }

    // Şablon İndir - Personel
    const btnTplStaff = document.getElementById('btn-download-staff-template');
    if (btnTplStaff) {
        btnTplStaff.addEventListener('click', () => {
            const data = [['İsim Soyisim']];
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Personel');
            XLSX.writeFile(wb, 'Personel_Sablonu.xlsx');
        });
    }

    // Şablon İndir - Sınav
    const btnTplExam = document.getElementById('btn-download-exam-template');
    if (btnTplExam) {
        btnTplExam.addEventListener('click', () => {
            const data = [
                ['Ders Adı', 'Derslik / Yer', 'Tarih (YYYY-MM-DD)', 'Saat (HH:MM)', 'Süre (dk)', 'Gözetmen Adı'],
                ['MATH 101', 'Amfi 1', '2026-03-20', '09:00', '90', 'Gülay Mert']
            ];
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Sınavlar');
            XLSX.writeFile(wb, 'Sinav_Sablonu.xlsx');
        });
    }

    // Dosya Yükleme - Önizleme
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const wb = XLSX.read(evt.target.result, { type: 'binary' });
                    const sheetName = wb.SheetNames[0];
                    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

                    if (rows.length < 2) {
                        document.getElementById('import-preview').innerHTML = '<p style="color:#ef4444;">Dosyada yeterli veri yok.</p>';
                        return;
                    }

                    // Önizleme tablosu
                    let html = '<p style="color:#10b981; margin-bottom:.5rem;">✓ ' + (rows.length - 1) + ' satır bulundu. İçerik önizlemesi:</p>';
                    html += '<div style="overflow-x:auto; max-height:200px;"><table style="width:100%; font-size:0.75rem; border-collapse:collapse;">';
                    // Başlık
                    html += '<thead><tr>' + rows[0].map(h => `<th style="padding:6px 8px; border-bottom:1px solid #334155; color:#94a3b8; text-align:left;">${h}</th>`).join('') + '</tr></thead>';
                    // İlk 5 satır önizleme
                    html += '<tbody>';
                    rows.slice(1, 6).forEach(r => {
                        html += '<tr>' + rows[0].map((_, i) => `<td style="padding:5px 8px; border-bottom:1px solid rgba(255,255,255,0.05); color:#f1f5f9;">${r[i] || ''}</td>`).join('') + '</tr>';
                    });
                    if (rows.length > 6) html += `<tr><td colspan="${rows[0].length}" style="padding:5px 8px; color:#94a3b8; font-style:italic;">... ve ${rows.length - 6} satır daha</td></tr>`;
                    html += '</tbody></table></div>';

                    document.getElementById('import-preview').innerHTML = html;
                    document.getElementById('btn-confirm-import').disabled = false;

                    // Satırları button'a aktar
                    document.getElementById('btn-confirm-import')._importData = { rows, sheetName };
                } catch(err) {
                    document.getElementById('import-preview').innerHTML = '<p style="color:#ef4444;">Dosya okunamadı: ' + err.message + '</p>';
                }
            };
            reader.readAsBinaryString(file);
        });
    }

    // Aktarmayı Onayla
    const btnConfirm = document.getElementById('btn-confirm-import');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
            const { rows } = btnConfirm._importData || {};
            if (!rows || rows.length < 2) return;
            const headers = rows[0].map(h => String(h).toLowerCase().trim());

            // --- ADIM 1: Farklı tarih formatlarını YYYY-MM-DD'ye çevir ---
            const parseFlexDate = (raw) => {
                if (!raw) return '';
                const s = String(raw).trim();
                // Zaten YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                // DD.MM.YYYY veya DD/MM/YYYY
                const m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
                if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
                // Excel sayısal tarih (örn. 46120)
                if (/^\d{5}$/.test(s)) {
                    const d = new Date(Math.round((parseFloat(s) - 25569) * 86400 * 1000));
                    return d.toISOString().slice(0,10);
                }
                return s;
            };

            // --- ADIM 2: Saatten sadece HH:MM al ---
            const parseFlexTime = (raw) => {
                if (!raw) return '';
                const s = String(raw).trim();
                const m = s.match(/(\d{1,2}:\d{2})/);
                return m ? m[1] : s;
            };

            // --- ADIM 3: Süre alanından sayıyı çıkar ("120 dk" → 120) ---
            const parseDuration = (raw) => {
                if (!raw && raw !== 0) return 60;
                const n = parseInt(String(raw).replace(/[^\d]/g, ''));
                return isNaN(n) || n <= 0 ? 60 : n;
            };

            // Personel mi Sınav mı? (Esnek kontrol)
            // "isim" veya ("ad" içerip "ders" içermeyenler) → Personel
            const isStaff = headers.some(h => h.includes('isim') || (h.includes('ad') && !h.includes('ders')));
            const isExam  = headers.some(h => h.includes('ders') || h.includes('sinav') || h.includes('sınav') || h.includes('course'));

            let added = 0;
            let skipped = 0;

            if (isStaff) {
                rows.slice(1).forEach(r => {
                    const name = String(r[0] || '').trim();
                    if (!name) return;
                    if (DB.staff.find(s => s.name === name)) return; // Zaten var
                    DB.staff.push({ id: Date.now() + Math.random(), name, totalScore: 0, taskCount: 0 });
                    added++;
                });
                saveToLocalStorage();
                document.getElementById('modal-import').classList.add('hidden');
                alert(`✓ ${added} yeni personel sisteme eklendi.`);
                renderStaff();
                renderDashboard();
            } else if (isExam) {
                // Sütun indekslerini bul (esnek eşleştirme)
                const nameIdx = headers.findIndex(h =>
                    h === 'ders adı' || h === 'ders adı (kod dahil)' || h === 'ders' ||
                    (h.includes('ders') && !h.includes('lik') && !h.includes('yer') && !h.includes('saat'))
                );
                const locIdx = headers.findIndex(h =>
                    h === 'derslik' || h === 'yer' || h === 'derslik / yer' ||
                    h.includes('derslik') || h.includes('konum') || h.includes('salon') || h.includes('yer')
                );
                const dateIdx = headers.findIndex(h => h === 'tarih' || h.includes('tarih') || h.includes('date'));
                const timeIdx = headers.findIndex(h => h === 'saat' || h.includes('saat') || h.includes('vakit') || h.includes('time'));
                const durIdx  = headers.findIndex(h =>
                    h === 'süre' || h === 'süre (dk)' ||
                    h.includes('süre') || h.includes('sure') || h.includes('dakika') || h.includes('duration')
                );
                const procIdx = headers.findIndex(h =>
                    h === 'gözetmen' || h === 'gözetmen adı' || h === 'gözetmenler' ||
                    h.includes('gözetmen') || h.includes('gozetmen') || h.includes('hoca')
                );

                rows.slice(1).forEach(r => {
                    const examName = String(r[nameIdx] ?? '').trim();
                    const rawDate  = r[dateIdx];
                    const rawTime  = r[timeIdx];
                    if (!examName || rawDate === undefined || rawTime === undefined) { skipped++; return; }

                    const date = parseFlexDate(rawDate);
                    const time = parseFlexTime(rawTime);
                    if (!date || !time) { skipped++; return; }

                    const duration = parseDuration(r[durIdx]);

                    // Gözetmen: virgülle ayrılmış olabilir, ilk ismi al
                    const rawProctor   = String(r[procIdx] ?? '').split(/[,،\/]/)[0].trim();
                    let proctor = DB.staff.find(s => s.name === rawProctor);

                    // SINIR KONTROLÜ: Hoca sınırı aşmışsa otomatik atamaya devret
                    if (proctor && (proctor.taskCount || 0) >= GLOBAL_LIMITS.MAX_TASKS) {
                        proctor = null;
                    }

                    // OTOMATİK ATAMA: Hoca bulunamadıysa
                    if (!proctor) {
                        proctor = findBestProctor(date, time, duration);
                    }

                    if (!proctor) { skipped++; return; }

                    const dateObj = new Date(`${date}T${time}`);
                    const k     = getKatsayi(dateObj);
                    const score = parseFloat((k * duration).toFixed(2));

                    DB.exams.push({
                        id: Date.now() + Math.random(),
                        name: examName,
                        location: String(r[locIdx] ?? '').trim(),
                        date, time, duration,
                        katsayi: k, score,
                        proctors: [{ id: proctor.id, name: proctor.name }]
                    });
                    proctor.totalScore = parseFloat((proctor.totalScore + score).toFixed(2));
                    proctor.taskCount  = (proctor.taskCount || 0) + 1;
                    added++;
                });
                saveToLocalStorage();
                document.getElementById('modal-import').classList.add('hidden');
                const msg = skipped > 0
                    ? `✓ ${added} yeni sınav aktarıldı.\n⚠ ${skipped} satır atlandı (eksik tarih/saat/müsait gözetmen).`
                    : `✓ ${added} yeni sınav sisteme aktarıldı.`;
                alert(msg);
                renderExams();
                renderSchedule();
                renderDashboard();
            } else {
                alert('Dosya formatı tanınamadı. Lütfen Sınav Şablonunu kullanarak dosyayı hazırlayın.\n\nBeklenen başlıklar: Ders Adı, Derslik / Yer, Tarih, Saat, Süre (dk), Gözetmen Adı');
            }
        });
    }
}

// Global: Excel Import modalını aç (hem onclick hem event listener ile çağrılabilir)
function openImportModal() {
    const preview = document.getElementById('import-preview');
    const fileInput = document.getElementById('import-file-input');
    const confirmBtn = document.getElementById('btn-confirm-import');
    const modal = document.getElementById('modal-import');
    if (!modal) return;
    if (preview) preview.innerHTML = '';
    if (fileInput) fileInput.value = '';
    if (confirmBtn) confirmBtn.disabled = true;
    modal.classList.remove('hidden');
}

function exportElementAsImage(element, filename) {
    if (!element) return;
    try {
        html2canvas(element, { scale: 2, backgroundColor: '#0f172a' }).then(canvas => {
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    } catch(err) {
        console.error("Resim çıkartılamadı: ", err);
        alert("Resim olarak indirilemedi, eklenti yükleniyor olabilir.");
    }
}

/**
 * WhatsApp Mesaj Linki Oluşturur (Telefon yoksa sorar ve kaydeder)
 */
window.openWhatsApp = function(staffId, message = "") {
    let staff = DB.staff.find(s => s.id === staffId);
    if (!staff) return;

    if (!staff.phone) {
        const phone = prompt(`${staff.name} hocanın telefon numarasını giriniz (Örn: 905XXXXXXXXX):`, "");
        if (!phone) return;
        staff.phone = phone.replace(/\D/g, ''); // Sadece rakamlar
        saveToLocalStorage();
    }

    const encodedMsg = encodeURIComponent(message || `Merhaba ${staff.name}, gözetmenlik görevi hakkında yazıyorum.`);
    const url = `https://wa.me/${staff.phone}?text=${encodedMsg}`;
    window.open(url, '_blank');
};

/**
 * Modern Başarı Bildirimi (Lottie ile)
 */
function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = 'modern-toast';
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-icon">
                <dotlottie-player src="https://lottie.host/86d63032-6a7f-4424-9b81-c4d375267b93/y7gKxVvYf0.json" background="transparent" speed="1.5" style="width: 100px; height: 100px;" autoplay></dotlottie-player>
            </div>
            <div class="toast-text">${message.replace('\n', '<br>')}</div>
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function exportTableToExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    try {
        const wb = XLSX.utils.table_to_book(table, { sheet: "Sınav Programı" });
        XLSX.writeFile(wb, filename);
    } catch (err) {
        console.error("Excel çıkartılamadı: ", err);
        alert("Excel indirelemedi, eklenti yükleniyor olabilir.");
    }
}

function renderDashboard() {
    // Duyuru Paneli Kontrolü
    const announceContainer = document.getElementById('announcement-container');
    const announceDisplay = document.getElementById('announcement-display-text');
    if (announceContainer && announceDisplay) {
        if (DB.announcement && DB.announcement.trim() !== "") {
            announceDisplay.textContent = DB.announcement;
            announceContainer.classList.remove('hidden');
        } else {
            announceContainer.classList.add('hidden');
        }
    }

    renderSwapRequests();
    const tbody = document.querySelector('#table-ranking tbody');
    if (tbody) tbody.innerHTML = '';

    // Sıralama (Puanı en çoktan aza, şeffaflık için)
    const sortedStaff = [...DB.staff].sort((a, b) => b.totalScore - a.totalScore);

    sortedStaff.forEach((s, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><span class="clickable-name" onclick="showStaffSchedule('${s.name}')">${s.name}</span></td>
            <td>${s.totalScore.toFixed(1)}</td>
            <td>${s.taskCount}</td>
            <td><span class="badge ${s.totalScore === 0 ? 'idle' : 'active'}">${s.totalScore === 0 ? 'Beklemede' : 'Görevli'}</span></td>
        `;
        tbody.appendChild(tr);
    });

    // Stats
    document.getElementById('stat-total-exams').textContent = DB.exams.length;
    document.getElementById('stat-total-staff').textContent = DB.staff.length;
    const avg = DB.staff.length ? DB.staff.reduce((a, b) => a + b.totalScore, 0) / DB.staff.length : 0;
    document.getElementById('stat-avg-score').textContent = avg.toFixed(1);

    // Akıllı Asistan Kontrolü (Sadece Admin için)
    updateSmartAlert();

    // Grafigi Guncelle
    updateScoreChart();
}

/**
 * KISIT YÖNETİMİ MANTIĞI
 */

function loadStaffSelects() {
    const selects = ['constraint-staff-select', 'edit-exam-proctor'];
    const staffOptions = DB.staff.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = staffOptions;
    });
}

function renderConstraintsPage() {
    const staffSelect = document.getElementById('constraint-staff-select');
    if (staffSelect && staffSelect.value) {
        renderConstraintsList(staffSelect.value);
    }
}

function renderConstraintsList(staffName) {
    const tbody = document.querySelector('#table-constraints tbody');
    const title = document.getElementById('current-constraints-title');
    title.textContent = `${staffName} - Mevcut Kısıtlar`;
    tbody.innerHTML = '';

    const constraints = DB.constraints[staffName] || [];

    if (constraints.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:2rem;">Bu gözetmen için henüz kısıt eklenmemiş.</td></tr>';
        return;
    }

    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

    constraints.forEach((c, idx) => {
        const tr = document.createElement('tr');
        let timeLabel = "";
        if (c.day !== undefined) {
             timeLabel = `📅 Her ${dayNames[c.day]}`;
        } else {
             timeLabel = `🗓️ ${c.date}`;
        }

        tr.innerHTML = `
            <td>${timeLabel}</td>
            <td>${c.start} - ${c.end}</td>
            <td style="text-align: right;">
                <button class="btn-icon" style="color:#ef4444;" onclick="deleteConstraint('${staffName}', ${idx})">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function addConstraint() {
    const staffName = document.getElementById('constraint-staff-select').value;
    const type = document.getElementById('constraint-type').value;
    const start = document.getElementById('constraint-start').value;
    const end = document.getElementById('constraint-end').value;

    let newConstraint = { start, end };

    if (type === 'day') {
        newConstraint.day = parseInt(document.getElementById('constraint-day').value);
    } else {
        newConstraint.date = document.getElementById('constraint-date').value;
        if (!newConstraint.date) { alert("Lütfen bir tarih seçin!"); return; }
        // YYYY-MM-DD -> MM-DD formatına çevir (logic.js böyle bekliyor)
        const parts = newConstraint.date.split('-');
        newConstraint.date = `${parts[1]}-${parts[2]}`;
    }

    if (!DB.constraints[staffName]) DB.constraints[staffName] = [];
    DB.constraints[staffName].push(newConstraint);

    saveToLocalStorage();
    renderConstraintsList(staffName);
    alert("✓ Kısıt başarıyla eklendi.");
}

window.deleteConstraint = function(staffName, index) {
    if (confirm("Bu kısıtlamayı silmek istediğinize emin misiniz?")) {
        DB.constraints[staffName].splice(index, 1);
        saveToLocalStorage();
        renderConstraintsList(staffName);
    }
}

window.showExamDetail = function(examName, date, time, location) {
    const modal = document.getElementById('modal-exam-detail');
    const title = document.getElementById('exam-detail-title');
    const infoGrid = document.getElementById('exam-detail-info');
    const tbody = document.querySelector('#table-exam-proctors tbody');
    const backupTbody = document.querySelector('#table-backup-suggestions tbody');
    const backupContainer = document.getElementById('backup-pool-container');

    // Bu sınavla ilgili tüm kayıtları bul (Derslik dahil)
    const relatedExams = DB.exams.filter(e =>
        e.name === examName && e.date === date && e.time === time && (location === '' || e.location === location)
    );

    title.textContent = examName;
    const formatDate = date.split('-').reverse().join('.');
    const duration = relatedExams.length > 0 ? relatedExams[0].duration : '-';
    const loc = location || (relatedExams.length > 0 ? relatedExams[0].location : '-');

    infoGrid.innerHTML = `
        <div style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; padding: 1rem; text-align:center;">
            <div style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Tarih</div>
            <div style="font-weight:700; font-size:1.1rem;">${formatDate}</div>
        </div>
        <div style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; padding: 1rem; text-align:center;">
            <div style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Saat / Süre</div>
            <div style="font-weight:700; font-size:1.1rem;">${time} &bull; ${duration} dk</div>
        </div>
        <div style="background: rgba(167, 139, 250, 0.1); border: 1px solid rgba(167, 139, 250, 0.3); border-radius: 12px; padding: 1rem; text-align:center;">
            <div style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Derslik</div>
            <div style="font-weight:700; font-size:1.1rem;">${loc || '-'}</div>
        </div>
    `;

    tbody.innerHTML = '';
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    
    // Admin değilse yedek havuzunu gizle
    if (backupContainer) backupContainer.style.display = isAdmin ? 'block' : 'none';

    if (relatedExams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Görevli bulunmuyor.</td></tr>';
    } else {
        let allProctors = [];
        relatedExams.forEach(ex => {
            ex.proctors.forEach(p => {
                if (!allProctors.some(ap => ap.id === p.id && ap.examId === ex.id)) {
                    allProctors.push({ ...p, examId: ex.id });
                }
            });
        });

        allProctors.forEach((p, idx) => {
            const staff = DB.staff.find(s => s.id === p.id);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td><span class="clickable-name" onclick="showStaffSchedule('${p.name}')">${p.name}</span></td>
                <td>${staff ? staff.totalScore.toFixed(1) : '-'}</td>
                <td>${staff ? staff.taskCount : '-'}</td>
                <td>
                    <div style="display:flex; gap:5px; align-items:center;">
                        <button class="btn-whatsapp" onclick="openWhatsApp(${p.id}, '${examName} (${formatDate} ${time}) sınav görevi hakkında...')" title="WhatsApp ile Yaz">💬</button>
                        ${isAdmin ? `<button class="btn-secondary" onclick="removeProctorFromExam(${p.examId}, ${p.id}, '${examName}', '${date}', '${time}', '${location}')" style="color:#ef4444; border-color:#ef4444; padding:2px 8px; font-size:0.75rem;">Çıkar</button>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Yedek Önerilerini Getir
    if (isAdmin && relatedExams.length > 0) {
        renderBackupSuggestions(date, time, duration, relatedExams[0].id, examName, location);
    }

    modal.classList.remove('hidden');
};

function renderBackupSuggestions(date, time, duration, examId, examName, location) {
    const backupTbody = document.querySelector('#table-backup-suggestions tbody');
    if (!backupTbody) return;
    backupTbody.innerHTML = '';

    // Boştaki ve en düşük puanlı hocaları bul
    const currentProctorIds = new Set();
    DB.exams.filter(e => e.date === date && e.time === time).forEach(e => {
        e.proctors.forEach(p => currentProctorIds.add(p.id));
    });

    const suggestions = DB.staff
        .filter(s => !currentProctorIds.has(s.id)) // O saatte sınavı olmayanlar
        .map(s => {
            const isAvail = isAvailable(s.name, date, time, duration);
            return { ...s, isAvail };
        })
        .filter(s => s.isAvail !== false) // Tamamen meşgul olmayanlar
        .sort((a, b) => a.totalScore - b.totalScore) // Düşük puanlılar başa
        .slice(0, 5); // İlk 5 aday

    if (suggestions.length === 0) {
        backupTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:1rem;">Uygun yedek bulunamadı.</td></tr>';
        return;
    }

    suggestions.forEach(s => {
        const tr = document.createElement('tr');
        const statusLabel = s.isAvail === 'restricted' ? '<span style="color:#f59e0b;">⚠️ Kısıtlı</span>' : '<span style="color:#10b981;">✓ Müsait</span>';
        
        tr.innerHTML = `
            <td><strong>${s.name}</strong></td>
            <td>${s.totalScore.toFixed(1)}</td>
            <td>${statusLabel}</td>
            <td>
                <button class="btn-primary" onclick="assignBackupToExam(${examId}, ${s.id}, '${examName}', '${date}', '${time}', '${location}')" style="background:#6366f1; padding:4px 10px; font-size:0.75rem;">Hızlı Ata</button>
            </td>
        `;
        backupTbody.appendChild(tr);
    });
}

function assignBackupToExam(examId, staffId, examName, date, time, location) {
    const exam = DB.exams.find(e => e.id === examId);
    const staff = DB.staff.find(s => s.id === staffId);
    if (!exam || !staff) return;

    if (exam.proctors.some(p => p.id === staffId)) {
        alert("Bu hoca zaten bu sınavda görevli!");
        return;
    }

    exam.proctors.push({ id: staff.id, name: staff.name });
    saveToLocalStorage();
    showExamDetail(examName, date, time, location);
    renderSchedule();
    updateScoreChart();
    alert(`✓ ${staff.name} başarıyla atandı.`);
}

function removeProctorFromExam(examId, staffId, examName, date, time, location) {
    if (!confirm("Bu hocayı bu sınav görevinden çıkarmak istediğinize emin misiniz?")) return;
    
    const exam = DB.exams.find(e => e.id === examId);
    if (!exam) return;

    exam.proctors = exam.proctors.filter(p => p.id !== staffId);
    saveToLocalStorage();
    showExamDetail(examName, date, time, location);
    renderSchedule();
    updateScoreChart();
}

function renderExams() {
    const tbody = document.querySelector('#table-exams tbody');
    tbody.innerHTML = '';

    // Sıralama oklarını güncelle
    document.querySelectorAll('.sortable').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (icon) {
            if (th.getAttribute('data-sort') === currentSort.key) {
                icon.textContent = currentSort.dir === 'asc' ? ' ▲' : ' ▼';
            } else {
                icon.textContent = '';
            }
        }
    });

    // DB'den sınavları kopya alıp sırala
    const sortedExams = [...DB.exams].sort((a, b) => {
        let valA = a[currentSort.key];
        let valB = b[currentSort.key];

        if (typeof valA === 'string' && typeof valB === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    const conflicts = getConflicts();
    const locConflicts = getLocationConflicts();

    // SADECE GELECEK SINAVLARI GÖSTER (Kullanıcı Talebi)
    const futureExams = sortedExams.filter(ex => !isExamPassed(ex));

    if (futureExams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:2rem;">Gelecekte planlanmış sınav bulunmuyor.</td></tr>';
        return;
    }

    futureExams.forEach(ex => {
        const tr = document.createElement('tr');
        if (conflicts.has(ex.id)) {
            tr.classList.add('conflict-row');
        }
        
        const isLocConflict = locConflicts.has(ex.id);

        const safeDate = ex.date || "";
        const dateObj = safeDate ? new Date(safeDate.replace(/-/g, "/")) : new Date();
        const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const dayName = dayNames[dateObj.getDay()];
        const displayDate = safeDate ? safeDate.split("-").reverse().join(".") + " " + dayName : "-";

        const proctorNames = (ex.proctors || []).map(p => {
             if (!p || !p.name) return "";
             return `<span class="clickable-name" onclick="showStaffSchedule('${p.name}')">${p.name}</span>`;
        }).filter(n => n !== "").join(', ');

        tr.innerHTML = `
            <td>
                <span class="clickable-name" onclick="showExamDetail('${ex.name || ""}', '${safeDate}', '${ex.time || ""}', '${ex.location || ""}')"><strong>${ex.name || "-"}</strong></span>
                ${conflicts.has(ex.id) ? '<span class="conflict-warning">⚠️ Gözetmen Çakışması!</span>' : ''}
            </td>
            <td class="${isLocConflict ? 'location-conflict' : ''}">
                ${ex.location || '-'}
                ${isLocConflict ? '<span class="location-warning">⚠️ Derslik Dolu!</span>' : ''}
            </td>
            <td>${displayDate}</td>
            <td>${ex.time}</td>
            <td>${ex.duration} dk</td>
            <td>x${ex.katsayi.toFixed(1)}</td>
            <td>${ex.score.toFixed(1)}</td>
            <td>${proctorNames || '<span style="color:var(--danger)">Atanmamış</span>'}</td>
            <td>
                <button class="btn-google-cal" onclick="window.open(generateGoogleCalendarLink(${JSON.stringify(ex).replace(/"/g, '&quot;')}), '_blank')" title="Google Takvim'e Ekle">📅</button>
                <button class="btn-swap" onclick="showSwapModal(${ex.id})" style="margin-right: 0.5rem; margin-bottom: 0.3rem;">🔄 Takas İste</button>
                <button class="btn-secondary admin-only" onclick="showEditExamModal(${ex.id})" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; margin-right: 0.5rem; border-color: var(--primary); color: var(--primary);">Düzenle</button>
                <button class="btn-primary" onclick="sendAssignmentEmail(${ex.id})" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; margin-right: 0.5rem; background: #6366f1;">✉ Mail</button>
                <button class="btn-delete admin-only" onclick="deleteExam(${ex.id})">Sil</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderSchedule() {
    const tbody = document.querySelector('#table-schedule tbody');
    const title = document.getElementById('calendar-month-title');
    if (!tbody || !title) return;
    tbody.innerHTML = '';

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

    // Takvim görünümü aktifse onu da güncelle
    const calView = document.getElementById('schedule-calendar-view');
    if (calView && !calView.classList.contains('hidden')) {
        renderCalendar();
    } else {
        // Liste görünümündeysen başlığı "Seçili Ay - Gelecek Ay" yap (Kullanıcı Talebi)
        const nextDate = new Date(year, month + 1, 1);
        const nextMonthName = monthNames[nextDate.getMonth()];
        const nextYear = nextDate.getFullYear();
        title.textContent = `${monthNames[month]} - ${nextMonthName} ${nextYear}`;
    }

    // Filtrele: Seçili ay veya bir sonraki ay
    const filteredExams = DB.exams.filter(ex => {
        if (!ex || !ex.date) return false;
        const d = new Date(ex.date.replace(/-/g, "/"));
        const dMonth = d.getMonth();
        const dYear = d.getFullYear();
        
        const nextDate = new Date(year, month + 1, 1);
        const nextMonth = nextDate.getMonth();
        const nextYear = nextDate.getFullYear();
        
        const isCurrentOrNextMonth = (dMonth === month && dYear === year) || (dMonth === nextMonth && dYear === nextYear);
        const matchesType = currentTypeFilter === 'all' || ex.type === currentTypeFilter;
        
        return isCurrentOrNextMonth && matchesType;
    });

    const groups = {};
    filteredExams.forEach(ex => {
        const key = `${ex.name}_${ex.date}_${ex.time}_${ex.location}`;
        if (!groups[key]) {
            groups[key] = {
                id: ex.id,
                name: ex.name,
                date: ex.date,
                time: ex.time,
                duration: ex.duration,
                type: ex.type || 'vize',
                location: ex.location || "-",
                proctors: []
            };
        }
        if (ex.proctors && Array.isArray(ex.proctors)) {
            ex.proctors.forEach(p => {
                if (p && p.name && !groups[key].proctors.includes(p.name)) {
                    groups[key].proctors.push(p.name);
                }
            });
        }
    });

    const scheduleList = Object.values(groups);
    const conflicts = getConflicts();
    const locConflicts = getLocationConflicts();

    function getYear(name) {
        if (!name) return 0;
        const match = name.match(/\b(1|2|3|4)\d{2}\b/);
        if (match) return parseInt(match[1]);
        if (name.includes("101") || name.includes("102") || name.includes("106") || name.includes("112") || name.includes("114")) return 1;
        return 0;
    }

    scheduleList.sort((a, b) => {
        const ya = getYear(a.name);
        const yb = getYear(b.name);
        if (ya !== yb) return ya - yb;
        const dateA = a.date || "";
        const dateB = b.date || "";
        const timeA = a.time || "";
        const timeB = b.time || "";
        return dateA.localeCompare(dateB) || timeA.localeCompare(timeB);
    });

    let currentYear = -1;

    scheduleList.forEach(ex => {
        const y = getYear(ex.name);
        
        if (y > 0 && y !== currentYear) {
            currentYear = y;
            const trHead = document.createElement('tr');
            trHead.className = 'year-header';
            trHead.innerHTML = `<td colspan="5">${y}. YIL</td>`;
            tbody.appendChild(trHead);
        }

        const tr = document.createElement('tr');
        if (y > 0) tr.classList.add(`row-year-${y}`);
        
        // Bu gruptaki herhangi bir sınav çakışıyor mu?
        const isConflict = DB.exams.some(e => 
            e.name === ex.name && e.date === ex.date && e.time === ex.time && conflicts.has(e.id)
        );
        if (isConflict) tr.classList.add('conflict-row');

        const isLocConflict = DB.exams.some(e => 
            e.name === ex.name && e.date === ex.date && e.time === ex.time && locConflicts.has(e.id)
        );

        const safeDate = ex.date || "";
        const dateObj = safeDate ? new Date(safeDate.replace(/-/g, "/")) : new Date();
        const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const dayName = dayNames[dateObj.getDay()];
        const formatString = safeDate ? safeDate.split("-").reverse().join(".") + " " + dayName : "Tarih Yok"; 

        const typeMap = {
            'vize': 'Vize',
            'final': 'Final',
            'but': 'Bütünleme',
            'mazeret': 'Mazeret Sınavı',
            'ek': 'Ek Sınav',
            'tercih': 'Tercih Günleri',
            'doktora': 'Doktora Yet.',
            'asist': 'Arş. Gör. Sınav',
            'diger': 'Diğer'
        };
        const typeLabel = typeMap[ex.type] || 'Sınav';
        const typeClass = `type-${ex.type || 'vize'}`;

        tr.innerHTML = `
            <td>
                <span class="badge-type ${typeClass}">${typeLabel}</span>
                <span class="clickable-name" onclick="showExamDetail('${ex.name || ""}', '${safeDate}', '${ex.time || ""}', '${ex.location || ""}')"><strong>${ex.name || "İsimsiz"}</strong></span>
                ${isConflict ? '<span class="conflict-warning">⚠️ Gözetmen Çakışması!</span>' : ''}
            </td>
            <td class="${isLocConflict ? 'location-conflict' : ''}">
                ${ex.location || "-"}
                ${isLocConflict ? '<span class="location-warning">⚠️ Derslik Çakışması!</span>' : ''}
            </td>
            <td>${formatString}</td>
            <td>${ex.time}</td>
            <td>${ex.duration} dk</td>
            <td class="proctor-list">${ex.proctors.join(', ')}</td>
            <td>
                 <button class="btn-calendar" onclick="window.open(generateGoogleCalendarLink(${JSON.stringify(ex).replace(/"/g, '&quot;')}), '_blank')" title="Google Takvim'e Ekle">📅</button>
                 <button class="btn-swap" onclick="showSwapModal(${ex.id})" style="margin-right: 0.5rem;">🔄 Takas</button>
                 <button class="btn-secondary admin-only" onclick="showEditScheduleModal('${ex.name}', '${ex.date}', '${ex.time}', '${ex.location}')" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; border-color: var(--primary); color: var(--primary);">Düzenle</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showAddExamModal() {
    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Yeni Sınav Ekle";
    
    fields.innerHTML = `
        <div class="form-group">
            <label>Sınav Türü</label>
            <select id="exam-type" style="width: 100%; background: rgba(15, 23, 42, 0.5); border: 1px solid var(--card-border); padding: 0.75rem; border-radius: 8px; color: white;">
                <option value="vize">Vize</option>
                <option value="final">Final</option>
                <option value="but">Bütünleme</option>
                <option value="mazeret">Mazeret Sınavı</option>
                <option value="ek">Ek Sınav</option>
                <option value="tercih">Tercih Günleri</option>
                <option value="doktora">Doktora Yeterlilik</option>
                <option value="asist">Araştırma Görevliliği Sınavı</option>
                <option value="diger">Diğer</option>
            </select>
        </div>
        <div class="form-group">
            <label>Sınav Tarihi</label>
            <input type="date" id="exam-date" required>
        </div>
        <div class="form-group">
            <label>Başlangıç Saati</label>
            <input type="time" id="exam-time" required>
        </div>
        <div class="form-group">
            <label>Süre (Dakika)</label>
            <input type="number" id="exam-duration" value="60" required>
        </div>
        <div class="form-group">
            <label>Ders Adı</label>
            <input type="text" id="exam-name" placeholder="Örn: Matematik-I" required>
        </div>
        <div class="form-group">
            <label>Derslik / Mevcut</label>
            <input type="text" id="exam-location" placeholder="Örn: Amfi 2">
        </div>
        <div class="form-group">
            <label>Gözetmenler (Seçmezseniz sistem otomatik atar)</label>
            <div id="add-staff-list" class="multi-select-container">
                ${DB.staff.map(s => `
                    <div class="staff-checkbox-item">
                        <input type="checkbox" id="add-staff-${s.id}" value="${s.id}" class="add-staff-cb">
                        <label for="add-staff-${s.id}">${s.name} (${s.totalScore.toFixed(1)} P.)</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div id="add-suggestions" class="suggestion-area hidden">
            <h4>🤖 Akıllı Öneriler</h4>
            <div id="add-suggestion-list" class="suggestion-list"></div>
        </div>
        <div id="add-conflict-warning" class="hidden" style="margin-top: 1rem; color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.75rem; border-radius: 8px; font-size: 0.8rem; font-weight: 600;">
            ⚠️ Bazı seçili gözetmenler o saatte meşgul!
        </div>
    `;
    modal.classList.remove('hidden');

    const updateAddSuggestions = () => {
        const d = document.getElementById('exam-date').value;
        const t = document.getElementById('exam-time').value;
        const dur = parseInt(document.getElementById('exam-duration').value) || 60;
        updateSuggestionsUI(d, t, dur, 'add-suggestions', 'add-suggestion-list', null);
    };

    const checkAddConflicts = () => {
        const d = document.getElementById('exam-date').value;
        const t = document.getElementById('exam-time').value;
        const dur = parseInt(document.getElementById('exam-duration').value) || 60;
        const selectedIds = Array.from(document.querySelectorAll('.add-staff-cb:checked')).map(cb => parseInt(cb.value));
        
        let hasConflict = false;
        selectedIds.forEach(id => {
            if (!isProctorTrulyFree(id, d, t, dur)) hasConflict = true;
        });
        
        const warnDiv = document.getElementById('add-conflict-warning');
        if (warnDiv) warnDiv.classList.toggle('hidden', !hasConflict);
    };

    document.getElementById('exam-duration').addEventListener('input', () => { updateAddSuggestions(); checkAddConflicts(); });
    document.getElementById('exam-date').addEventListener('change', () => { updateAddSuggestions(); checkAddConflicts(); });
    document.getElementById('exam-time').addEventListener('change', () => { updateAddSuggestions(); checkAddConflicts(); });
    document.getElementById('add-staff-list').addEventListener('change', checkAddConflicts);

    document.getElementById('modal-form').onsubmit = (e) => {
        e.preventDefault();
        
        const selectedIds = Array.from(document.querySelectorAll('.add-staff-cb:checked')).map(cb => parseInt(cb.value));

        const data = {
            type: document.getElementById('exam-type').value,
            date: document.getElementById('exam-date').value,
            time: document.getElementById('exam-time').value,
            duration: parseInt(document.getElementById('exam-duration').value),
            name: document.getElementById('exam-name').value,
            location: document.getElementById('exam-location').value,
            proctorIds: selectedIds
        };
        const newExam = addExam(data);
        if (newExam) {
            // E-posta gönderimi için küçük bir gecikme ve onay (UX için)
            setTimeout(() => {
                const staff = DB.staff.find(s => s.id === newExam.proctorId);
                if (staff && staff.email) {
                    if (confirm(`${staff.name} hocaya bilgilendirme e-postası taslağı oluşturulsun mu?`)) {
                        sendAssignmentEmail(newExam.id);
                    }
                } else if (staff) {
                    alert(`Atama tamamlandı: ${staff.name}.\n(Hocanın e-posta adresi kayıtlı olmadığı için mail gönderilemedi)`);
                }
            }, 500);
        }
        hideModal();
        renderExams();
        renderSchedule();
        renderDashboard();
    };
}

function hideModal() {
    document.getElementById('modal').classList.add('hidden');
}

window.deleteExam = (id) => {
    const exIndex = DB.exams.findIndex(e => e.id === id);
    if (exIndex > -1) {
        const ex = DB.exams[exIndex];
        // Tüm gözetmenlerin puanlarını düş
        if (ex.proctors) {
            ex.proctors.forEach(p => {
                const staff = DB.staff.find(s => s.id === p.id);
                if (staff) {
                    staff.totalScore = Math.max(0, staff.totalScore - ex.score);
                    staff.taskCount = Math.max(0, staff.taskCount - 1);
                }
            });
        }
        DB.exams.splice(exIndex, 1);
        saveToLocalStorage();
        renderExams();
        renderSchedule();
        renderDashboard();
    }
};

window.showEditExamModal = (id) => {
    const ex = DB.exams.find(e => e.id === id);
    if (!ex) return;

    document.getElementById('edit-exam-id').value = ex.id;
    document.getElementById('edit-exam-type').value = ex.type || 'vize';
    document.getElementById('edit-exam-name').value = ex.name;
    document.getElementById('edit-exam-location').value = ex.location || '';
    document.getElementById('edit-exam-date').value = ex.date;
    document.getElementById('edit-exam-time').value = ex.time;
    document.getElementById('edit-exam-duration').value = ex.duration;

    const proctorListDiv = document.getElementById('edit-exam-proctors-list');
    proctorListDiv.innerHTML = DB.staff.map(s => {
        const isChecked = ex.proctors.some(p => p.id === s.id);
        return `
            <div class="staff-checkbox-item">
                <input type="checkbox" id="edit-staff-${s.id}" value="${s.id}" class="edit-staff-cb" ${isChecked ? 'checked' : ''}>
                <label for="edit-staff-${s.id}">${s.name} (${s.totalScore.toFixed(1)} P.)</label>
            </div>
        `;
    }).join('');

    const updateEditSuggestions = () => {
        const d = document.getElementById('edit-exam-date').value;
        const t = document.getElementById('edit-exam-time').value;
        const dur = parseInt(document.getElementById('edit-exam-duration').value) || 60;
        // 'edit-exam-proctor' yerine 'edit-staff-cb' ile seçilenleri dikkate al
        const currentSelectedProctorIds = Array.from(document.querySelectorAll('.edit-staff-cb:checked')).map(cb => parseInt(cb.value));
        updateSuggestionsUI(d, t, dur, 'edit-suggestions', 'edit-suggestion-list', ex.id, currentSelectedProctorIds);
    };

    // İlk açılışta ve değişimlerde önerileri güncelle
    updateEditSuggestions();

    document.getElementById('edit-exam-date').addEventListener('change', updateEditSuggestions);
    document.getElementById('edit-exam-time').addEventListener('change', updateEditSuggestions);
    document.getElementById('edit-exam-duration').addEventListener('input', updateEditSuggestions);
    // Checkbox değişikliklerinde de önerileri güncelle
    document.getElementById('edit-exam-proctors-list').addEventListener('change', (event) => {
        if (event.target.classList.contains('edit-staff-cb')) {
            updateEditSuggestions();
            checkEditConflicts();
        }
    });

    const checkEditConflicts = () => {
        const d = document.getElementById('edit-exam-date').value;
        const t = document.getElementById('edit-exam-time').value;
        const dur = parseInt(document.getElementById('edit-exam-duration').value) || 60;
        const selectedIds = Array.from(document.querySelectorAll('.edit-staff-cb:checked')).map(cb => parseInt(cb.value));
        
        let hasConflict = false;
        selectedIds.forEach(id => {
            if (!isProctorTrulyFree(id, d, t, dur, ex.id)) hasConflict = true;
        });
        
        const warnDiv = document.getElementById('edit-conflict-warning');
        if (warnDiv) warnDiv.classList.toggle('hidden', !hasConflict);
    };

    document.getElementById('edit-exam-date').addEventListener('change', checkEditConflicts);
    document.getElementById('edit-exam-time').addEventListener('change', checkEditConflicts);

    document.getElementById('edit-modal').classList.remove('hidden');
};

/**
 * Öneri Sistemi: En uygun gözetmenleri UI'da göster
 */
function updateSuggestionsUI(date, time, duration, containerId, listId, ignoreExamId, currentSelectedIds = []) {
    const container = document.getElementById(containerId);
    const list = document.getElementById(listId);
    if (!container || !list) return;

    if (!date || !time) {
        container.classList.add('hidden');
        return;
    }

    const recommended = getRecommendedProctors(date, time, duration, ignoreExamId);
    
    // Zaten seçili olanları önerilerden çıkar
    const filtered = recommended.filter(s => !currentSelectedIds.includes(s.id));

    if (filtered.length === 0) {
        container.classList.add('hidden');
        return;
    }

    list.innerHTML = '';
    filtered.forEach(s => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-suggestion';
        btn.style = "background: rgba(99, 102, 241, 0.2); border: 1px solid var(--primary); color: white; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 5px; margin-bottom: 5px;";
        btn.innerHTML = `⭐ ${s.name} (${s.totalScore.toFixed(1)} P.)`;
        btn.onclick = () => {
            applySuggestion(s.id, containerId);
        };
        list.appendChild(btn);
    });

    container.classList.remove('hidden');
}

function applySuggestion(staffId, context) {
    if (context === 'add-suggestions') {
        const cb = document.getElementById(`add-staff-${staffId}`);
        if (cb) {
            cb.checked = true;
            // Manuel change event tetikle
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
    } else if (context === 'edit-suggestions') {
        const cb = document.getElementById(`edit-staff-${staffId}`);
        if (cb) {
            cb.checked = true;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
    } else if (context === 'swap-suggestions') {
        const select = document.getElementById('swap-receiver-select');
        if (select) {
            select.value = staffId;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

document.getElementById('edit-modal-form').onsubmit = (e) => {
    e.preventDefault();
    const id = parseFloat(document.getElementById('edit-exam-id').value);
    const selectedIds = Array.from(document.querySelectorAll('.edit-staff-cb:checked')).map(cb => parseInt(cb.value));

    const data = {
        type: document.getElementById('edit-exam-type').value,
        name: document.getElementById('edit-exam-name').value,
        location: document.getElementById('edit-exam-location').value,
        date: document.getElementById('edit-exam-date').value,
        time: document.getElementById('edit-exam-time').value,
        duration: parseInt(document.getElementById('edit-exam-duration').value),
        proctorId: parseInt(document.getElementById('edit-exam-proctor').value)
    };
    
    // Müsaitlik kontrolü
    const targetProctor = DB.staff.find(s => s.id === data.proctorId);
    if (targetProctor && !isAvailable(targetProctor.name, data.date, data.time, data.duration)) {
        alert(`${targetProctor.name} bu tarihte ve saatte müsait değil! Lütfen başka birini seçin veya saati değiştirin.`);
        return; // İşlemi durdur
    }

    updateExam(id, data);
    
    // Güncelleme sonrası bilgilendirme
    if (selectedIds.length > 0) {
        setTimeout(() => {
            if (confirm(`Gözetmenlere güncel görev bilgilerini e-posta ile bildirmek ister misiniz?`)) {
                sendAssignmentEmail(id);
            }
        }, 500);
    }

    document.getElementById('edit-modal').classList.add('hidden');
    renderExams();
    renderSchedule();
    renderDashboard();
};

window.showEditScheduleModal = (name, date, time, location) => {
    // Sınav Programı listesindeki öğeyi düzenlerken aynı saate/isime sahip TÜM sınavları bul
    const groupExams = DB.exams.filter(e => e.name === name && e.date === date && e.time === time);
    if(groupExams.length === 0) return;

    // Herhangi birini baz alarak form verilerini doldur
    const baseEx = groupExams[0];
    
    // Düzenleme alanını normal edit modal üzerinden yürütelim ancak proctor seçimi olmadan, genel değişiklik.
    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Program/Yer Düzenle (" + baseEx.name + ")";
    
    fields.innerHTML = `
        <div class="form-group">
            <label>Ders Adı</label>
            <input type="text" id="sch-exam-name" value="${baseEx.name}" required>
        </div>
        <div class="form-group">
            <label>Derslik / Yer</label>
            <input type="text" id="sch-exam-location" value="${baseEx.location || ''}">
        </div>
        <div class="form-group">
            <label>Tarih</label>
            <input type="date" id="sch-exam-date" value="${baseEx.date}" required>
        </div>
        <div class="form-group">
            <label>Saat</label>
            <input type="time" id="sch-exam-time" value="${baseEx.time}" required>
        </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = (e) => {
        e.preventDefault();
        
        const newName = document.getElementById('sch-exam-name').value;
        const newLocation = document.getElementById('sch-exam-location').value;
        const newDate = document.getElementById('sch-exam-date').value;
        const newTime = document.getElementById('sch-exam-time').value;

        // O gruba ait tüm kayıtları güncelle
        groupExams.forEach(ex => {
            const exIndex = DB.exams.findIndex(e => e.id === ex.id);
            if(exIndex > -1){
                DB.exams[exIndex].name = newName;
                DB.exams[exIndex].location = newLocation;
                DB.exams[exIndex].date = newDate;
                DB.exams[exIndex].time = newTime;
                
                // puan katsayısını tarihe/saate göre tekrar güncelle
                DB.exams[exIndex].katsayi = getKatsayi(new Date(`${newDate}T${newTime}`));
                // (Gözetmen vs silmiyoruz, sadece bilgileri güncelliyoruz)
            }
        });

        saveToLocalStorage();
        hideModal();
        renderExams();
        renderSchedule();
        renderDashboard();
    };
};

function renderStaff() {
    const tbody = document.querySelector('#table-staff tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    DB.staff.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="clickable-name" onclick="showStaffSchedule('${s.name}')">${s.name}</span></td>
            <td>${s.email || '-'}</td>
            <td>${s.totalScore.toFixed(1)}</td>
            <td>${s.taskCount}</td>
            <td class="admin-only" style="white-space:nowrap;">
                <button class="btn-whatsapp" onclick="openWhatsApp(${s.id})" title="WhatsApp ile Yaz" style="margin-right: 0.5rem;">💬</button>
                <button class="btn-secondary" onclick="showEditStaffModal(${s.id})" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; margin-right: 0.5rem;">Düzenle / Duyuru</button>
                <button class="btn-delete" onclick="deleteStaff(${s.id})">Sil</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showAddStaffModal() {
    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Yeni Personel Ekle";
    
    fields.innerHTML = `
        <div class="form-group">
            <label>Personel Adı Soyadı</label>
            <input type="text" id="staff-name" placeholder="Örn: Dr. Can Berk" required>
        </div>
        <div class="form-group">
            <label>E-posta Adresi</label>
            <input type="email" id="staff-email" placeholder="Örn: hoca@gtu.edu.tr">
        </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('staff-name').value;
        const email = document.getElementById('staff-email').value;
        const newStaff = {
            id: Date.now(),
            name: name,
            email: email,
            totalScore: 0,
            taskCount: 0
        };
        DB.staff.push(newStaff);
        saveToLocalStorage();
        hideModal();
        renderStaff();
    };
}

window.deleteStaff = (id) => {
    if (confirm('Bu personeli silmek istediğinize emin misiniz?')) {
        DB.staff = DB.staff.filter(s => s.id !== id);
        saveToLocalStorage();
        renderStaff();
    }
};

window.showEditStaffModal = (id) => {
    const staff = DB.staff.find(s => s.id === id);
    if (!staff) return;

    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Personel Düzenle";
    
    fields.innerHTML = `
        <div class="form-group">
            <label>Personel Adı Soyadı</label>
            <input type="text" id="staff-name" value="${staff.name}" required>
        </div>
        <div class="form-group">
            <label>E-posta Adresi</label>
            <input type="email" id="staff-email" value="${staff.email || ''}" placeholder="Örn: hoca@gtu.edu.tr">
        </div>
        <div class="form-group" style="margin-top: 1rem; border-top: 1px solid var(--card-border); padding-top: 1rem;">
            <label style="color: #fbbf24;">📢 Hocaya Özel Duyuru / Not</label>
            <textarea id="staff-announcement" style="width: 100%; height: 80px; background: rgba(0,0,0,0.2); border: 1px solid var(--card-border); border-radius: 8px; color: white; padding: 10px; margin-top: 5px; font-family: inherit;">${staff.announcement || ''}</textarea>
            <small style="color: var(--text-muted);">Bu hoca kendi profiline girdiğinde en tepede bu notu görecektir.</small>
        </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = (e) => {
        e.preventDefault();
        staff.name = document.getElementById('staff-name').value;
        staff.email = document.getElementById('staff-email').value;
        staff.announcement = document.getElementById('staff-announcement').value;
        
        saveToLocalStorage();
        hideModal();
        renderStaff();
        renderDashboard();
    };
};

/**
 * E-posta Gönderim Mantığı (mailto)
 */
function sendAssignmentEmail(examId, forceStaffId = null) {
    const exam = DB.exams.find(e => e.id === examId);
    if (!exam) return;
    
    let staff;
    if (forceStaffId) {
        staff = DB.staff.find(s => s.id === forceStaffId);
    } else {
        if (exam.proctors.length === 0) {
            alert("Bu sınavda atanmış gözetmen yok!");
            return;
        }
        if (exam.proctors.length === 1) {
            staff = DB.staff.find(s => s.id === exam.proctors[0].id);
        } else {
            const choices = exam.proctors.map((p, i) => `${i+1}- ${p.name}`).join('\n');
            const choice = prompt(`Hangi hocaya mail atmak istersiniz?\n${choices}\n(Sayı giriniz)`, "1");
            if (!choice) return;
            const idx = parseInt(choice) - 1;
            if (exam.proctors[idx]) {
                staff = DB.staff.find(s => s.id === exam.proctors[idx].id);
            } else {
                alert("Geçersiz seçim!");
                return;
            }
        }
    }

    if (!staff || !staff.email) {
        alert("Bu hocanın e-posta adresi kayıtlı değil!");
        return;
    }

    const formatDate = exam.date.split('-').reverse().join('.');
    const isAdmin = !document.body.classList.contains('guest-mode');
    
    let subject, body, recipient;

    if (!isAdmin) {
        recipient = "yasinturan@gtu.edu.tr";
        subject = `Takas Bildirimi: ${exam.name} - ${staff.name}`;
        
        // Takas bildirimi şablonunu kullan
        body = parseTemplate(DB.templates.swap_notif, {
            sinav_adi: exam.name,
            tarih: formatDate,
            saat: exam.time,
            gonderen_adi: "Hoca (Misafir Modu)",
            hedef_hoca: staff.name
        });
    } else {
        recipient = staff.email;
        const isSwap = confirm(`Bu mail bir 'Takas Bildirimi' (Devretme Beyanı) metni mi olsun?\n\n'Tamam' derseniz Takas metni, 'İptal' derseniz standart Atama metni kullanılır.`);

        if (isSwap) {
            subject = 'Takas Talebi Bildirimi - ' + staff.name + ' / ' + exam.name;
            body = parseTemplate(DB.templates.swap_notif, {
                sinav_adi: exam.name,
                tarih: formatDate,
                saat: exam.time,
                gonderen_adi: "Yönetici",
                hedef_hoca: staff.name
            });
        } else {
            subject = `[Gözetmenlik Sistemi] Yeni Sınav Görevi: ${exam.name}`;
            body = parseTemplate(DB.templates.assignment, {
                hoca_adi: staff.name,
                sinav_adi: exam.name,
                tarih: formatDate,
                saat: exam.time,
                sure: exam.duration,
                yer: exam.location || '-',
                katsayi: exam.katsayi.toFixed(1),
                puan: exam.score.toFixed(1),
                toplam_gorev: staff.taskCount || 0
            });
        }
    }

    const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
}
window.sendAssignmentEmail = sendAssignmentEmail;
/**
 * Takas Talebi Bildirimi (Hocadan Yöneticiye)
 */
function sendSwapRequestEmail(examId, fromStaffId, suggestedToStaffId) {
    const exam = DB.exams.find(e => e.id === examId);
    if (!exam) return;
    
    const fromStaff = DB.staff.find(s => s.id === fromStaffId);
    const toStaff = suggestedToStaffId ? DB.staff.find(s => s.id === suggestedToStaffId) : null;
    
    const formatDate = exam.date.split('-').reverse().join('.');
    const subject = 'Takas Talebi Bildirimi - ' + fromStaff.name + ' / ' + exam.name;
    const targetName = toStaff ? toStaff.name : '[Belirtilmedi]';
    const targetEmail = toStaff ? toStaff.email : '';
    
    const body = parseTemplate(DB.templates.swap_request, {
        alici_adi: targetName,
        gonderen_adi: fromStaff.name,
        sinav_adi: exam.name,
        tarih: formatDate
    });

    const mailtoLink = `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
}


window.showStaffSchedule = (staffName) => {
    const modal = document.getElementById('modal-staff-schedule');
    const title = document.getElementById('staff-name-title');
    const nameHeader = document.getElementById('individual-proctor-name');
    const tbody = document.querySelector('#table-individual-schedule tbody');
    
    title.textContent = `${staffName} - Bireysel Program`;
    nameHeader.textContent = staffName;
    tbody.innerHTML = '';
    
    // Filtrele (Sadece bugün ve gelecek - Saat dahil) ve tarihe göre sırala
    const now = new Date();

    const individualExams = DB.exams
        .filter(ex => ex.proctors.some(p => p.name === staffName))
        .filter(ex => {
            const examStart = new Date(`${ex.date}T${ex.time || '00:00'}`);
            return examStart >= now;
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        
    individualExams.forEach(ex => {
        const tr = document.createElement('tr');
        const dateStr = ex.date.split("-").reverse().join(".");
        
        tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="btn-google-cal" onclick="window.open(generateGoogleCalendarLink(${JSON.stringify(ex).replace(/"/g, '&quot;')}), '_blank')" title="Google Takvim'e Ekle" style="padding: 2px 5px; font-size: 0.8rem;">📅</button>
                    <strong>${ex.name}</strong>
                </div>
            </td>
            <td>${ex.location || '-'}</td>
            <td>${dateStr} <br> <small>${ex.time}</small></td>
            <td>${ex.duration} dk</td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn-swap" onclick="showSwapModal(${ex.id}, '${staffName}')">🔄 Takas İste</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // PDF & ICS Butonları
    const btnPdf = document.getElementById('btn-export-individual-schedule-pdf');
    if (btnPdf) {
        const newBtn = btnPdf.cloneNode(true);
        btnPdf.parentNode.replaceChild(newBtn, btnPdf);
        newBtn.addEventListener('click', () => exportIndividualToPDF());
    }

    const btnIcs = document.getElementById('btn-export-individual-ics');
    if (btnIcs) {
        const newIcsBtn = btnIcs.cloneNode(true);
        btnIcs.parentNode.replaceChild(newIcsBtn, btnIcs);
        newIcsBtn.addEventListener('click', () => {
            const exams = DB.exams.filter(ex => ex.proctors.some(p => p.name === staffName));
            downloadICSFile(exams, `Program_${staffName.replace(/\s+/g, '_')}.ics`);
        });
    }

    modal.classList.remove('hidden');
};

function hideIndividualModal() {
    document.getElementById('modal-staff-schedule').classList.add('hidden');
}

/**
 * UI Öneri Listesini Güncelle
 */
function updateSuggestionsUI(date, time, duration, areaId, listId, currentExamId, selectId = null) {
    const area = document.getElementById(areaId);
    const list = document.getElementById(listId);
    if (!area || !list) return;

    if (!date || !time) {
        area.classList.add('hidden');
        return;
    }

    const recs = getRecommendedProctors(date, time, duration, currentExamId);
    
    if (recs.length === 0) {
        area.classList.add('hidden');
        return;
    }

    area.classList.remove('hidden');
    list.innerHTML = recs.map(s => `
        <div class="suggestion-item" onclick="selectSuggestedProctor('${areaId}', '${selectId}', ${s.id})">
            <strong>${s.name}</strong>
            <span class="staff-score">${s.totalScore.toFixed(1)} Puan</span>
        </div>
    `).join('');
}

window.selectSuggestedProctor = (areaId, selectId, staffId) => {
    // Eğer düzenleme modalındaysak selectId bellidir, ekleme modalındaysak select yoktur (Çünkü henüz eklenmedi)
    // Ekleme modalında proctor seçimi için logic.js içindeki atama mantığını kullanıyoruz, 
    // ancak kullanıcı deneyimi için ekleme modalında da bir select olsaydı iyi olurdu.
    // Şimdilik ekleme modalında öneriye tıklayınca hoca adını saklayıp form submit'te kullanabiliriz veya ekleme modalına da select ekleyebiliriz.
    
    if (selectId && selectId !== 'null') {
        // Edit modalındayız, checkbox'u bul ve işaretle
        const cb = document.querySelector(`.edit-staff-cb[value="${staffId}"]`);
        if (cb) {
            cb.checked = true;
            document.getElementById(areaId).classList.add('hidden');
        }
    } else {
        // Add modalındayız
        const cb = document.querySelector(`.add-staff-cb[value="${staffId}"]`);
        if (cb) {
            cb.checked = true;
            document.getElementById(areaId).classList.add('hidden');
        }
    }
};

function renderAvailability() {
    const dateInput = document.getElementById('availability-date');
    const grid = document.getElementById('availability-grid');
    if (!grid) return;

    const selectedDate = dateInput ? dateInput.value : '';

    if (!selectedDate) {
        grid.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Bir tarih seçin...</p>';
        return;
    }

    // Seçilen günde sınav saatlerini topla (benzersiz saatler)
    const dayExams = DB.exams.filter(e => e.date === selectedDate);
    const timeSlots = [...new Set(dayExams.map(e => e.time))].sort();

    if (timeSlots.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Bu tarihte kayıtlı sınav bulunmuyor.</p>';
        return;
    }

    // Tarih için gün numarası (kısıt kontrolü)
    const dateObj = new Date(`${selectedDate}T08:00`);
    const dayOfWeek = dateObj.getDay(); // 0=Paz, 6=Cts

    // Tablo oluştur
    let html = '<div style="overflow-x:auto"><table class="avail-table"><thead><tr>';
    html += '<th class="staff-col">Gözetmen</th>';
    timeSlots.forEach(t => {
        // Bitiş saatini de hesapla
        const relatedExams = dayExams.filter(e => e.time === t);
        const dur = relatedExams.length > 0 ? relatedExams[0].duration : 60;
        const [hh, mm] = t.split(':').map(Number);
        const endMin = hh * 60 + mm + dur;
        const endTime = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
        html += `<th>${t}<br><span style="font-weight:300">${endTime}</span></th>`;
    });
    html += '</tr></thead><tbody>';

    DB.staff.forEach(s => {
        html += `<tr><td class="staff-col"><span class="clickable-name" onclick="showStaffSchedule('${s.name}')">${s.name}</span></td>`;

        timeSlots.forEach(t => {
            // Bu saatte bu personelin sınavı var mı?
            const busyExam = dayExams.find(e => e.time === t && e.proctors.some(p => p.id === s.id));

            if (busyExam) {
                html += `<td class="avail-cell-busy" title="${busyExam.name}">📋 ${busyExam.name}</td>`;
            } else {
                // Kısıt kontrolü
                const isRestricted = !isAvailable(s.name, selectedDate, t, 60);
                if (isRestricted) {
                    html += '<td class="avail-cell-restricted" title="Kısıtlı">⚠️</td>';
                } else {
                    html += '<td class="avail-cell-free">✓</td>';
                }
            }
        });

        html += '</tr>';
    });

    html += '</tbody></table></div>';
    grid.innerHTML = html;
}

function updateScoreChart() {
    const ctx = document.getElementById('scoreChart');
    if (!ctx) return;

    const labels = DB.staff.map(s => s.name);
    const data = DB.staff.map(s => s.totalScore);

    if (scoreChartInstance) {
        scoreChartInstance.destroy();
    }

    scoreChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Toplam Puan',
                data: data,
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                borderColor: '#6366f1',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: document.body.classList.contains('light-mode') 
                            ? 'rgba(0, 0, 0, 0.05)' 
                            : 'rgba(255, 255, 255, 0.05)' 
                    },
                    ticks: { 
                        color: document.body.classList.contains('light-mode') ? '#64748b' : '#94a3b8' 
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        color: document.body.classList.contains('light-mode') ? '#64748b' : '#94a3b8',
                        font: { size: 10 } 
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function showGitHubSyncModal() {
    const modal = document.getElementById('modal-github-sync');
    const textarea = document.getElementById('github-sync-code');
    
    // DB objesini logic.js formatında metne dönüştür
    const dbCode = `let DB = ${JSON.stringify(DB, null, 4)};`;
    
    textarea.value = dbCode;
    modal.classList.remove('hidden');
}

/**
 * TAKAS SİSTEMİ UI FONKSİYONLARI
 */

function renderSwapRequests() {
    const card = document.getElementById('card-swap-requests');
    const tbody = document.querySelector('#table-swap-requests tbody');
    if (!card || !tbody) return;

    const pendings = DB.swapRequests.filter(r => r.status === 'pending');
    
    card.classList.remove('hidden');
    tbody.innerHTML = '';

    if (pendings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:1rem;">Bekleyen takas talebi bulunmuyor.</td></tr>';
        return;
    }

    pendings.forEach(req => {
        const exam = DB.exams.find(e => e.id === req.examId);
        const fromStaff = DB.staff.find(s => s.id === req.fromStaffId);
        const suggestedStaff = req.suggestedToStaffId ? DB.staff.find(s => s.id === req.suggestedToStaffId) : null;
        if (!exam || !fromStaff) return;

        const tr = document.createElement('tr');
        const examDate = exam.date.split("-").reverse().join(".");
        
        tr.innerHTML = `
            <td><strong>${exam.name}</strong></td>
            <td>${fromStaff.name}</td>
            <td>${examDate} ${exam.time}</td>
            <td style="color:var(--primary); font-weight:600;">${suggestedStaff ? '💡 ' + suggestedStaff.name : '-'}</td>
            <td>
                <button class="btn-primary" onclick="openConfirmSwapModal(${req.id})" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; background: var(--accent-green);">Onayla</button>
                <button class="btn-delete" onclick="rejectSwapRequest(${req.id}); renderDashboard();" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">Reddet</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.requestSwap = (examId, staffId) => {
    const exam = DB.exams.find(e => e.id === examId);
    if (!exam) return;

    document.getElementById('req-swap-exam-id').value = examId;
    document.getElementById('req-swap-exam-name').textContent = exam.name;
    
    // 1. Devredilecek Kişi Seçeneklerini Doldur (Sınavdaki mevcut gözetmenler)
    const giverSelect = document.getElementById('req-swap-staff-select');
    giverSelect.innerHTML = `<option value="">Lütfen listeden seçin</option>`;
    
    // Sınavdaki gözetmenleri bul
    let currentProctors = [];
    if (exam.proctors && Array.isArray(exam.proctors)) {
        currentProctors = exam.proctors;
    } else if (exam.proctorId) {
        const p = DB.staff.find(s => s.id === exam.proctorId);
        if (p) currentProctors = [p];
    }

    currentProctors.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (p.id === staffId) option.selected = true;
        giverSelect.appendChild(option);
    });

    // 2. Devralacak (Hedef) Kişi Listesini Doldur (Mevcut gözetmenler hariç herkes)
    const takerSelect = document.getElementById('req-swap-suggested-select');
    const existingIds = currentProctors.map(p => p.id);
    
    takerSelect.innerHTML = `<option value="">Hedef Seçin (Opsiyonel)</option>` + 
        DB.staff
          .filter(s => !existingIds.includes(s.id))
          .map(s => `<option value="${s.id}">${s.name} (${s.totalScore.toFixed(1)} P.)</option>`)
          .join('');

    const warning = document.getElementById('req-swap-warning');
    warning.classList.add('hidden');
    
    takerSelect.onchange = () => {
        const toId = parseInt(takerSelect.value);
        if (!toId) { warning.classList.add('hidden'); return; }

        try {
            const busyReason = getProctorBusyReason(toId, exam.date, exam.time, exam.duration, exam.id);
            if (busyReason) {
                warning.innerHTML = `⚠️ Seçilen hoca o saatte müsait değil!<br><strong>Sebep:</strong> ${busyReason}`;
                warning.classList.remove('hidden');
            } else {
                warning.classList.add('hidden');
            }
        } catch(e) { console.error(e); }
    };

    document.getElementById('modal-request-swap').classList.remove('hidden');
}

function getProctorBusyReason(staffId, date, time, duration, ignoreExamId = null) {
    const staff = DB.staff.find(s => s.id === staffId);
    if (!staff) return "Personel bulunamadı.";

    // 1. Kısıt kontrolü
    try {
        if (!isAvailable(staff.name, date, time, duration)) {
            return "Bölüm kısıtı var (Bu saatte görevlendirilemez)";
        }
    } catch(e) { /* isAvailable yoksa atla */ }

    // 2. Çakışan sınav kontrolü
    const conflictingExam = DB.exams.find(ex => {
        if (ex.id === ignoreExamId) return false;
        if (ex.date !== date) return false;

        let hasConflict = false;
        if (ex.proctors && Array.isArray(ex.proctors)) {
            hasConflict = ex.proctors.some(p => p.id === staffId);
        } else if (ex.proctorId === staffId) {
            hasConflict = true;
        }
        if (!hasConflict) return false;

        const exStart = timeToMins(ex.time);
        const exEnd = exStart + ex.duration + 15;
        const startMins = timeToMins(time);
        const endMins = startMins + duration + 15;
        return (startMins < exEnd && endMins > exStart);
    });

    if (conflictingExam) {
        return `Şu sınavla çakışıyor: ${conflictingExam.name} (${conflictingExam.time})`;
    }

    return null;
}

function createSwapRequest(examId, fromStaffId, toStaffId = null) {
    const exam = DB.exams.find(e => e.id === examId);
    if (!exam) return false;

    if (!DB.swapRequests) DB.swapRequests = [];

    DB.swapRequests.push({
        id: Date.now(),
        examId: examId,
        fromStaffId: fromStaffId,
        suggestedToStaffId: toStaffId,
        status: 'pending',
        timestamp: new Date().toISOString()
    });
    saveToLocalStorage();
    return true;
}

window.submitSwapForm = () => {
    const examId = parseInt(document.getElementById('req-swap-exam-id').value);
    const staffId = parseInt(document.getElementById('req-swap-staff-select').value);
    const suggestedId = parseInt(document.getElementById('req-swap-suggested-select').value) || null;

    if (!staffId) {
        alert("Lütfen görevi devredecek kişiyi seçin.");
        return;
    }

    if (suggestedId) {
        const exam = DB.exams.find(e => e.id === examId);
        if (exam) {
            const busyReason = getProctorBusyReason(suggestedId, exam.date, exam.time, exam.duration, examId);
            if (busyReason) {
                const proceed = confirm(`⚠️ Seçtiğiniz yeni gözetmen bu sınav saatinde müsait değil!\n\nSebep: ${busyReason}\n\nYine de talebi yöneticiye göndermek istiyor musunuz?`);
                if (!proceed) return;
            }
        }
    }

    if (createSwapRequest(examId, staffId, suggestedId)) {
        alert('Takas talebiniz başarıyla oluşturuldu. Yönetici onayı bekleniyor.');
        
        if (confirm('Yöneticiye e-posta bildirimi göndermek ister misiniz?')) {
            sendSwapRequestEmail(examId, staffId, suggestedId);
        }
        
        document.getElementById('modal-request-swap').classList.add('hidden');
        hideIndividualModal();
        renderDashboard();
    }
};

window.initiateSwapFromAdmin = (examId) => {
    const exam = DB.exams.find(e => e.id === examId);
    if (!exam) return;
    if (!exam.proctors || exam.proctors.length === 0) {
        alert("Bu sınavda atanmış gözetmen yok!");
        return;
    }
    
    // Artık prompt sormaya gerek yok, modal içinden seçim yapılacak
    requestSwap(examId, null);
};

window.openConfirmSwapModal = (requestId) => {
    const req = DB.swapRequests.find(r => r.id === requestId);
    if (!req) return;
    
    const exam = DB.exams.find(e => e.id === req.examId);
    const fromStaff = DB.staff.find(s => s.id === req.fromStaffId);
    const suggestedStaff = req.suggestedToStaffId ? DB.staff.find(s => s.id === req.suggestedToStaffId) : null;
    
    document.getElementById('swap-request-id').value = requestId;
    document.getElementById('swap-exam-name').textContent = exam.name;
    document.getElementById('swap-from-staff').textContent = fromStaff.name;
    
    const suggestedContainer = document.getElementById('swap-suggested-container');
    const suggestedName = document.getElementById('swap-suggested-staff');
    if (suggestedStaff) {
        suggestedContainer.classList.remove('hidden');
        suggestedName.textContent = suggestedStaff.name;
    } else {
        suggestedContainer.classList.add('hidden');
    }

    const select = document.getElementById('swap-to-staff-select');
    // Talep eden hariç herkesi listele
    select.innerHTML = `<option value="">Hoca Seçin...</option>` + 
        DB.staff
          .filter(s => s.id !== fromStaff.id)
          .map(s => `<option value="${s.id}">${s.name} (${s.totalScore.toFixed(1)} P.)</option>`)
          .join('');
    
    // Eğer önerilen biri varsa onu otomatik seç
    if (suggestedStaff) {
        select.value = suggestedStaff.id;
    }

    const warning = document.getElementById('swap-warning');
    warning.classList.add('hidden');
    
    select.onchange = () => {
        const toId = parseInt(select.value);
        const toStaff = DB.staff.find(s => s.id === toId);
        if (toStaff && !isAvailable(toStaff.name, exam.date, exam.time, exam.duration, exam.id)) {
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
    };

    document.getElementById('modal-confirm-swap').classList.remove('hidden');
}

document.getElementById('form-confirm-swap').onsubmit = (e) => {
    e.preventDefault();
    const reqId = parseInt(document.getElementById('swap-request-id').value);
    const toId = parseInt(document.getElementById('swap-to-staff-select').value);
    
    if (approveSwapRequest(reqId, toId)) {
        document.getElementById('modal-confirm-swap').classList.add('hidden');
        renderDashboard();
        renderExams();
        renderSchedule();
        alert("Takas başarıyla onaylandı ve puanlar güncellendi.");
    }
}

/**
 * Yarın sınavı olan tüm gözetmenleri bulur ve hatırlatma seçenekleri sunar.
 */
function remindTomorrowExams() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const formatDate = tomorrowStr.split('-').reverse().join('.');

    const tomorrowExams = DB.exams.filter(e => e.date === tomorrowStr);

    if (tomorrowExams.length === 0) {
        alert(`📅 ${formatDate} tarihinde (Yarın) kayıtlı bir sınav bulunamadı.`);
        return;
    }

    // Görevli listesini hazırla
    let proctors = [];
    tomorrowExams.forEach(ex => {
        if (ex.proctors && ex.proctors.length > 0) {
            ex.proctors.forEach(p => {
                proctors.push({
                    examName: ex.name,
                    examTime: ex.time,
                    examLocation: ex.location || '-',
                    staffId: p.id,
                    staffName: p.name
                });
            });
        } else if (ex.proctorId) {
            // Eski veri yapısı desteği
            proctors.push({
                examName: ex.name,
                examTime: ex.time,
                examLocation: ex.location || '-',
                staffId: ex.proctorId,
                staffName: ex.proctorName
            });
        }
    });

    if (proctors.length === 0) {
        alert(`⚠️ ${formatDate} tarihindeki sınavlara henüz gözetmen atanmamış.`);
        return;
    }

    // Tekil hocaları bul (Aynı hoca iki sınavda olabilir)
    const uniqueProctors = [];
    const seen = new Set();
    proctors.forEach(p => {
        const key = `${p.staffId}-${p.examName}`;
        if (!seen.has(key)) {
            uniqueProctors.push(p);
            seen.add(key);
        }
    });

    // Liste özeti göster
    let listMsg = `📅 ${formatDate} Tarihli Sınav Görevlileri:\n\n`;
    uniqueProctors.forEach((p, i) => {
        listMsg += `${i+1}. ${p.staffName} (${p.examName} - ${p.examTime})\n`;
    });
    listMsg += `\nBu hocalara hatırlatma e-postası göndermek istiyor musunuz?`;

    if (confirm(listMsg)) {
        // Mail gönderim akışı
        // Tarayıcıların çok fazla pencereyi engellememesi için tek tek onay alarak gidelim
        sendNextReminder(uniqueProctors, 0);
    }
}

function sendNextReminder(list, index) {
    if (index >= list.length) {
        alert("✅ Tüm hatırlatmalar tamamlandı.");
        return;
    }

    const p = list[index];
    const staff = DB.staff.find(s => s.id === p.staffId);
    
    if (staff && staff.email) {
        sendReminderEmail(p.staffId, p.examName, p.examTime, p.examLocation);
        
        if (index + 1 < list.length) {
            setTimeout(() => {
                if (confirm(`${p.staffName} için mail taslağı açıldı. Sıradaki (${list[index+1].staffName}) için devam edilsin mi?`)) {
                    sendNextReminder(list, index + 1);
                }
            }, 500);
        } else {
            alert("✅ Tüm hatırlatmalar tamamlandı.");
        }
    } else {
        alert(`⚠️ ${p.staffName} hocanın e-posta adresi bulunamadı!`);
        sendNextReminder(list, index + 1);
    }
}

function sendReminderEmail(staffId, examName, examTime, examLocation) {
    const staff = DB.staff.find(s => s.id === staffId);
    if (!staff) return;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const formatDate = tomorrow.toISOString().split('T')[0].split('-').reverse().join('.');

    const subject = `[Hatırlatma] Yarınki Sınav Göreviniz: ${examName}`;
    
    // Şablonu kullan
    const bodyTxt = parseTemplate(DB.templates.reminder, {
        hoca_adi: staff.name,
        sinav_adi: examName,
        tarih: formatDate,
        saat: examTime,
        yer: examLocation || '-'
    });

    const mailtoLink = `mailto:${staff.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyTxt)}`;
    window.open(mailtoLink, '_blank');
}

/**
 * Yarın sınavı olanları kontrol eder ve Dashboard üzerinde bildirim gösterir.
 */
function updateSmartAlert() {
    const alertContainer = document.getElementById('smart-alert-container');
    if (!alertContainer) return;

    // Sadece admin ise kontrol et (guest-mode yoksa admindir)
    if (document.body.classList.contains('guest-mode')) {
        alertContainer.classList.add('hidden');
        return;
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const tomorrowExams = DB.exams.filter(e => e.date === tomorrowStr);

    if (tomorrowExams.length > 0) {
        // Görevli sayısını bul
        const proctors = new Set();
        tomorrowExams.forEach(ex => {
            if (ex.proctors && ex.proctors.length > 0) {
                ex.proctors.forEach(p => proctors.add(p.id));
            } else if (ex.proctorId) {
                proctors.add(ex.proctorId);
            }
        });

        if (proctors.size > 0) {
            const msgEl = document.getElementById('smart-alert-msg');
            msgEl.textContent = `Yarın yapılacak ${tomorrowExams.length} sınavda toplam ${proctors.size} hocanın görevli olduğu tespit edildi.`;
            alertContainer.classList.remove('hidden');
        } else {
            alertContainer.classList.add('hidden');
        }
    } else {
        alertContainer.classList.add('hidden');
    }
}

/**
 * TAKAS SİSTEMİ MANTIĞI
 */
let currentSwapMailSent = false;

window.showSwapModal = function(examId, forceInitiatorName = null) {
    const exam = DB.exams.find(e => e.id === examId);
    if (!exam) return;

    document.getElementById('swap-exam-id').value = examId;
    document.getElementById('swap-exam-name').textContent = exam.name;
    
    // Dropdown'ları doldur
    const receiverSelect = document.getElementById('swap-receiver-select');
    const initiatorSelect = document.getElementById('swap-initiator-select');
    
    const staffOptions = DB.staff.map(s => `<option value="${s.id}">${s.name} (${s.totalScore.toFixed(1)} P.)</option>`).join('');
    receiverSelect.innerHTML = `<option value="">Bir gözetmen seçin...</option>` + staffOptions;
    initiatorSelect.innerHTML = staffOptions;
    
    // Mevcut gözetmenlerden birini ilk sıraya al
    if (exam.proctors && exam.proctors.length > 0) {
        let defaultInit = exam.proctors[0];
        if (forceInitiatorName) {
            const found = exam.proctors.find(p => p.name === forceInitiatorName);
            if (found) defaultInit = found;
        }
        initiatorSelect.value = defaultInit.id;
    }

    // Formu sıfırla
    currentSwapMailSent = false;
    const submitBtn = document.getElementById('btn-swap-submit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.5";
    }
    const mailBox = document.getElementById('swap-step-mail');
    if (mailBox) mailBox.classList.remove('completed');
    const hint = document.getElementById('swap-submit-hint');
    if (hint) hint.classList.remove('hidden');

    const updateSwapSuggestions = () => {
        updateSuggestionsUI(exam.date, exam.time, exam.duration, 'swap-suggestions', 'swap-suggestion-list', exam.id);
    };
    updateSwapSuggestions();

    const checkSwapConflict = () => {
        const receiverId = parseInt(document.getElementById('swap-receiver-select').value);
        const warnDiv = document.getElementById('swap-conflict-warning');
        if (!receiverId || isNaN(receiverId)) {
            warnDiv.classList.add('hidden');
            return;
        }
        const isFree = isProctorTrulyFree(receiverId, exam.date, exam.time, exam.duration, exam.id);
        warnDiv.classList.toggle('hidden', isFree);
    };

    document.getElementById('swap-receiver-select').addEventListener('change', checkSwapConflict);
    checkSwapConflict();

    document.getElementById('modal-swap').classList.remove('hidden');
}

window.sendSwapMail = function() {
    const examName = document.getElementById('swap-exam-name').textContent;
    const receiverId = document.getElementById('swap-receiver-select').value;
    const initiatorId = document.getElementById('swap-initiator-select').value;

    if (!receiverId) {
        alert("Lütfen önce takas yapmak istediğiniz gözetmeni seçin!");
        return;
    }

    const receiver = DB.staff.find(s => s.id == receiverId);
    const initiator = DB.staff.find(s => s.id == initiatorId);
    const exam = DB.exams.find(e => e.id == document.getElementById('swap-exam-id').value);

    const formatDate = exam ? exam.date.split('-').reverse().join('.') : '';
    const subject = encodeURIComponent(`Sınav Takası Onayı: ${examName}`);
    
    // Takas İsteği şablonunu kullan
    const bodyTxt = parseTemplate(DB.templates.swap_request, {
        alici_adi: receiver.name,
        gonderen_adi: initiator.name,
        sinav_adi: examName,
        tarih: formatDate
    });
    const body = encodeURIComponent(bodyTxt);
    
    window.open(`mailto:${receiver.email || ''}?subject=${subject}&body=${body}`, '_blank');

    // Adım tamamlandı
    currentSwapMailSent = true;
    const submitBtn = document.getElementById('btn-swap-submit');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
    }
    const mailBox = document.getElementById('swap-step-mail');
    if (mailBox) mailBox.classList.add('completed');
    const hint = document.getElementById('swap-submit-hint');
    if (hint) hint.classList.add('hidden');
    
    alert("Mail penceresi açıldı. Talebi gönderdikten sonra onay bekleme sürecine geçebilirsiniz.");
}

window.submitSwapRequest = function() {
    try {
        const examIdVal = document.getElementById('swap-exam-id').value;
        const initIdVal = document.getElementById('swap-initiator-select').value;
        const recvIdVal = document.getElementById('swap-receiver-select').value;

        const examId = Number(examIdVal);
        const initiatorId = Number(initIdVal);
        const receiverId = Number(recvIdVal);

        const initiator = DB.staff.find(s => s.id == initiatorId);
        const receiver = DB.staff.find(s => s.id == receiverId);

        if (!initiator || !receiver) {
            alert("Hata: Gözetmen bilgileri eksik. Lütfen geçerli seçimler yapın.");
            return;
        }

        // DB.requests dizisini doğrudan burada güvence altına al
        if (!DB.requests || !Array.isArray(DB.requests)) {
            DB.requests = [];
        }

        // Sınav bilgisini al
        var exam = DB.exams.find(function(e) { return e.id == examId; });

        var newReq = {
            id: Date.now(),
            examId: examId,
            examName: exam ? exam.name : 'Bilinmiyor',
            examDate: exam ? exam.date : '',
            examTime: exam ? exam.time : '',
            initiatorId: initiatorId,
            initiatorName: initiator.name,
            receiverId: receiverId,
            receiverName: receiver.name,
            status: 'pending_admin',
            createdAt: new Date().toISOString()
        };

        DB.requests.push(newReq);
        saveToLocalStorage();

        document.getElementById('modal-swap').classList.add('hidden');
        alert("Talep başarıyla oluşturuldu ve yönetici paneline iletildi.");
        
        if (typeof updateRequestBadge === 'function') updateRequestBadge();
        if (!document.getElementById('section-requests').classList.contains('hidden')) {
            if (typeof renderSwapRequests === 'function') renderSwapRequests();
        }
    } catch (err) {
        alert("Kayıt sırasında bir hata oluştu: " + err.message);
        console.error(err);
    }
}

window.renderSwapRequests = function() {
    const tbody = document.querySelector('#table-requests tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const requests = DB.requests || [];
    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Henüz bir talep bulunmuyor.</td></tr>';
        return;
    }

    requests.sort((a,b) => b.id - a.id).forEach(req => {
        const tr = document.createElement('tr');
        const exam = DB.exams.find(e => e.id == req.examId);
        
        // Sınav bilgilerini al (önce DB'den, bulunamazsa request'ten)
        const examName = exam ? exam.name : (req.examName || 'Bilinmiyor');
        const examDateRaw = exam ? exam.date : (req.examDate || '');
        const dateStr = examDateRaw ? examDateRaw.split('-').reverse().join('.') : '-';
        
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${examName}</td>
            <td>${req.initiatorName}</td>
            <td>${req.receiverName}</td>
            <td><span class="status-badge status-${req.status.replace('_','-')}">${formatStatus(req.status)}</span></td>
            <td style="text-align:right;">
                ${req.status === 'pending_admin' ? `
                    <button class="btn-primary" onclick="processSwap(${req.id}, true)" style="background:#10b981; padding:0.4rem 0.8rem; font-size:0.75rem; margin-right:5px;">Onayla</button>
                    <button class="btn-delete" onclick="processSwap(${req.id}, false)" style="padding:0.4rem 0.8rem; font-size:0.75rem;">Reddet</button>
                ` : '-'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function formatStatus(status) {
    const map = {
        'pending_mail': 'Mail Onayı Bekleniyor',
        'pending_admin': 'Yönetici Onayı Bekliyor',
        'approved': 'Onaylandı',
        'rejected': 'Reddedildi'
    };
    return map[status] || status;
}

window.processSwap = function(requestId, approve) {
    const req = DB.requests.find(r => r.id === requestId);
    if (!req) return;

    if (!approve) {
        updateRequestStatus(requestId, 'rejected');
        renderSwapRequests();
        updateRequestBadge();
        return;
    }

    // Onayla ve Sınavı Güncelle
    const exam = DB.exams.find(e => e.id == req.examId);
    if (exam) {
        const initiator = DB.staff.find(s => s.id == req.initiatorId);
        const receiver = DB.staff.find(s => s.id == req.receiverId);

        if (initiator && receiver) {
            // Puan güncelleme
            initiator.totalScore = Math.max(0, parseFloat((initiator.totalScore - exam.score).toFixed(2)));
            initiator.taskCount = Math.max(0, initiator.taskCount - 1);
            
            receiver.totalScore = parseFloat((receiver.totalScore + exam.score).toFixed(2));
            receiver.taskCount = (receiver.taskCount || 0) + 1;

            const pIdx = exam.proctors.findIndex(p => p.id === initiator.id);
            if (pIdx > -1) {
                exam.proctors[pIdx] = { id: receiver.id, name: receiver.name };
            }

            updateRequestStatus(requestId, 'approved');
            saveToLocalStorage();
            renderSwapRequests();
            updateRequestBadge();
            renderExams();
            renderSchedule();
            renderDashboard();
            alert("Takas işlemi başarıyla tamamlandı.");
        }
    }
}

function updateRequestBadge() {
    const badge = document.getElementById('request-badge');
    if (!badge) return;
    const count = (DB.requests || []).filter(r => r.status === 'pending_admin').length;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

updateRequestBadge();





/**
 * İstatistik Paneli Render
 */
function renderStats() {
    const data = getDetailedStats();
    
    // 1. Global Grafik (Bar Chart)
    const chartContainer = document.getElementById('stats-global-chart');
    if (chartContainer) {
        chartContainer.innerHTML = '';
        const total = Object.values(data.categories).reduce((a, b) => a + b, 0);
        
        const colors = {
            "Hafta İçi / Gündüz": "#6366f1",
            "Hafta İçi / Akşam": "#818cf8",
            "Hafta Sonu / Gündüz": "#a78bfa",
            "Hafta Sonu / Akşam": "#c084fc"
        };

        Object.entries(data.categories).forEach(([label, count]) => {
            const percent = total > 0 ? (count / total * 100).toFixed(1) : 0;
            const barHtml = `
                <div class="stats-bar-item">
                    <div class="stats-bar-label">
                        <span>${label}</span>
                        <span>${count} Görev (${percent}%)</span>
                    </div>
                    <div class="stats-bar-wrapper">
                        <div class="stats-bar-fill" style="width: ${percent}%; background: ${colors[label]};"></div>
                    </div>
                </div>
            `;
            chartContainer.innerHTML += barHtml;
        });
    }

    // 2. Detaylı Tablo
    const tbody = document.querySelector('#table-staff-stats tbody');
    if (tbody) {
        tbody.innerHTML = '';
        data.staffStats.forEach(s => {
            const tr = document.createElement('tr');
            
            // Ortalama görev sayısından %50 fazla ise kırmızı göster (Yüklenme uyarısı)
            const isHighLoad = s.totalTasks > (GLOBAL_LIMITS.MAX_TASKS - 1);
            
            tr.innerHTML = `
                <td style="font-weight: 600;">${s.name}</td>
                <td>${s.breakdown["Hafta İçi / Gündüz"]}</td>
                <td>${s.breakdown["Hafta İçi / Akşam"]}</td>
                <td>${s.breakdown["Hafta Sonu / Gündüz"]}</td>
                <td>${s.breakdown["Hafta Sonu / Akşam"]}</td>
                <td class="${isHighLoad ? 'high-load' : ''}">${s.totalTasks}</td>
                <td style="color: var(--primary); font-weight: 700;">${s.totalScore.toFixed(1)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

/**
 * Duyuru Kaydetme
 */
window.saveAnnouncement = function() {
    const input = document.getElementById('announcement-input');
    if (input) {
        DB.announcement = input.value.trim();
        saveToLocalStorage();
        document.getElementById('modal-announcement').classList.add('hidden');
        renderDashboard();
        alert("✓ Duyuru başarıyla güncellendi.");
    }
};

/**
 * AYARLAR & ŞABLON YÖNETİMİ
 */
function renderSettings() {
    if (!DB.templates) return;
    document.getElementById('template-assignment').value = DB.templates.assignment || "";
    document.getElementById('template-swap_request').value = DB.templates.swap_request || "";
    document.getElementById('template-swap_notif').value = DB.templates.swap_notif || "";
    document.getElementById('template-reminder').value = DB.templates.reminder || "";
}

window.saveTemplates = function() {
    if (!DB.templates) DB.templates = {};
    DB.templates.assignment = document.getElementById('template-assignment').value;
    DB.templates.swap_request = document.getElementById('template-swap_request').value;
    DB.templates.swap_notif = document.getElementById('template-swap_notif').value;
    DB.templates.reminder = document.getElementById('template-reminder').value;
    
    saveToLocalStorage();
    alert("✓ Şablonlar başarıyla kaydedildi!");
};

window.resetTemplates = function() {
    if (confirm("Tüm şablonları varsayılan ayarlara döndürmek istediğinize emin misiniz?")) {
        DB.templates = {
            assignment: `Sayın {hoca_adi},\n\nGözetmenlik sisteminde adınıza yeni bir sınav görevi tanımlanmıştır:\n\n* Sınav: {sinav_adi}\n* Tarih: {tarih}\n* Saat: {saat}\n* Süre: {sure} Dakika\n* Yer / Derslik: {yer}\n\nEk Görev Bilgileri:\n* Sınav Katsayısı: {katsayi}x\n* Kazanılacak Puan: {puan}\n* Toplam Görev Sayınız: {toplam_gorev}\n\nSisteme giriş yaparak güncel puan tablonuzu ve programın tamamını görüntüleyebilirsiniz.\n\nÖnemli Not: Bu görevlendirme, sistemde beyan etmiş olduğunuz müsaitlik durumunuza ve kısıtlarınıza uygun olarak planlanmıştır. Belirtilen saatlerde beklenmedik bir engeliniz oluşması durumunda; Müsaitlik sekmesinden takas isteği göndereceğiniz hocanın müsaitlik durumunu inceleyebilirsiniz. Sınav Programı veya Sınavlar sekmesinden yerinize görev alabilecek diğer hocalarımızla iletişime geçerek "Takas İste" butonu üzerinden mail ile onay alabilirsiniz.\n\nİyi çalışmalar dileriz.\nGTU Matematik Bölümü`,
            swap_request: `Merhaba {alici_adi},\n\n{tarih} tarihindeki {sinav_adi} sınavımdaki görevimi seninle takas etmek istiyorum. Onay verirsen yöneticiye bildireceğim.\n\nİyi çalışmalar,\n{gonderen_adi}`,
            swap_notif: `Merhaba,\n\n{tarih} günü saat {saat}'nde yapılacak olan {sinav_adi} dersindeki gözetmenlik görevimi {hedef_hoca}'na devrettiğimi bildiririm.\n\nBilgilerinize iyi çalışmalar`,
            reminder: `Sayın {hoca_adi},\n\nGözetmenlik sistemindeki yarınki sınav görevinizi hatırlatmak isteriz:\n\n* Sınav: {sinav_adi}\n* Tarih: {tarih} (Yarın)\n* Saat: {saat}\n* Yer / Derslik: {yer}\n\nSınav saatinden en az 15 dakika önce sınav yerinde bulunmanızı rica ederiz. Herhangi bir değişiklik olması durumunda lütfen sistem üzerinden bildiriniz.\n\nİyi çalışmalar dileriz.\nGTU Matematik Bölümü`
        };
        saveToLocalStorage();
        renderSettings();
        alert("✓ Şablonlar varsayılan ayarlara döndürüldü.");
    }
};

function parseTemplate(template, data) {
    if (!template) return "";
    let res = template;
    for (const key in data) {
        res = res.replaceAll(`{${key}}`, data[key]);
    }
    return res;
}

/**
 * TAKVİM GÖRÜNÜMÜ RENDER MOTORU
 */
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const title = document.getElementById('calendar-month-title');
    if (!grid || !title) return;

    grid.innerHTML = '';
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    title.textContent = `${monthNames[month]} ${year}`;

    // Gün Başlıkları
    const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    dayNames.forEach(d => {
        const div = document.createElement('div');
        div.className = 'calendar-day-head';
        div.textContent = d;
        grid.appendChild(div);
    });

    // Ayın ilk günü ve toplam gün sayısı
    const firstDay = new Date(year, month, 1);
    // JS'de 0:Pazar, 1:Pzt ... Bizim takvim Pzt'den başlıyor.
    let startDay = firstDay.getDay(); // 0-6
    startDay = startDay === 0 ? 6 : startDay - 1; // Pzt=0 yapmak için

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Önceki aydan sarkan günler
    for (let i = startDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        grid.appendChild(createDayCell(day, true));
    }

    // Bu ayın günleri
    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
        grid.appendChild(createDayCell(d, false, isToday));
    }

    // Gelecek aydan sarkan günler (Gridi 42 hücreye tamamla)
    const totalCells = grid.children.length - 7; // Başlıklar hariç
    const remaining = 42 - totalCells;
    for (let i = 1; i <= remaining; i++) {
        grid.appendChild(createDayCell(i, true));
    }
}

function createDayCell(day, isOtherMonth, isToday = false) {
    const cell = document.createElement('div');
    cell.className = `calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`;
    
    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = day;
    cell.appendChild(num);

    if (!isOtherMonth) {
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'calendar-events';
        
        // Sınavları filtrele
        const dateStr = `${currentCalendarDate.getFullYear()}-${String(currentCalendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const exams = DB.exams.filter(e => e.date === dateStr && (currentTypeFilter === 'all' || e.type === currentTypeFilter));
        
        exams.forEach(ex => {
            const badge = document.createElement('div');
            const typeClass = `type-${ex.type || 'vize'}`;
            badge.className = `calendar-event ${typeClass}`;
            badge.title = `${ex.name} (${ex.time})`;
            badge.textContent = `${ex.time} - ${ex.name}`;
            badge.onclick = (e) => {
                e.stopPropagation();
                showExamDetail(ex.name, ex.date, ex.time, ex.location || '');
            };
            eventsContainer.appendChild(badge);
        });
        
        cell.appendChild(eventsContainer);
    }
    
    return cell;
}

// --- Bireysel Hoca Portalı Fonksiyonları ---

let currentProfileDate = new Date();
let currentProfileTab = 'upcoming'; // 'upcoming' veya 'past'

function renderMyProfile() {
    const staffSelect = document.getElementById('profile-staff-select');
    const content = document.getElementById('profile-content');
    const emptyState = document.getElementById('profile-empty-state');
    
    // Select doldur (eğer boşsa)
    if (staffSelect.options.length === 0) {
        staffSelect.innerHTML = '<option value="">Hoca Seçiniz...</option>' + 
            DB.staff.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        
        // Kayıtlı hocayı hatırla
        const savedId = localStorage.getItem('my_profile_id');
        if (savedId) staffSelect.value = savedId;
    }

    const staffId = parseInt(staffSelect.value);
    if (!staffId) {
        content.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    localStorage.setItem('my_profile_id', staffId);
    content.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    // Takvim ve PDF butonlarını göster
    const profileIcsBtn = document.getElementById('btn-profile-export-ics');
    if (profileIcsBtn) {
        profileIcsBtn.style.display = 'block';
        const newBtn = profileIcsBtn.cloneNode(true);
        profileIcsBtn.parentNode.replaceChild(newBtn, profileIcsBtn);
        newBtn.addEventListener('click', () => {
             const exams = DB.exams.filter(e => e.proctors.some(p => p.id === staffId));
             downloadICSFile(exams, `Gozetmenlik_Takvim_${staff.name.replace(/\s+/g, '_')}.ics`);
        });
    }
    const profilePdfBtn = document.getElementById('btn-profile-export-pdf');
    if (profilePdfBtn) profilePdfBtn.style.display = 'block';

    const staff = DB.staff.find(s => s.id === staffId);
    if (!staff) return;

    // --- ÖZEL DUYURU GÖSTERİMİ ---
    const annCard = document.getElementById('profile-announcement-card');
    const annText = document.getElementById('profile-announcement-text');
    if (staff.announcement && staff.announcement.trim() !== '') {
        annText.textContent = staff.announcement;
        annCard.classList.remove('hidden');
    } else {
        annCard.classList.add('hidden');
    }

    // İstatistikler
    document.getElementById('profile-stat-score').textContent = staff.totalScore.toFixed(1);
    
    const myExams = DB.exams.filter(e => e.proctors.some(p => p.id === staffId));
    document.getElementById('profile-stat-tasks').textContent = myExams.length;

    // Sıralama
    const sortedStaff = [...DB.staff].sort((a, b) => b.totalScore - a.totalScore);
    const rank = sortedStaff.findIndex(s => s.id === staffId) + 1;
    document.getElementById('profile-stat-rank').textContent = `#${rank}`;

    // --- EK ANALİZLER (İş Arkadaşları & Tahmin) ---
    
    // 1. Sık Çalışılan İş Arkadaşları
    const partnersMap = {};
    // Mevcut sınavlar
    myExams.forEach(ex => {
        ex.proctors.forEach(p => {
            if (p.id !== staffId) {
                partnersMap[p.name] = (partnersMap[p.name] || 0) + 1;
            }
        });
    });
    // Arşivdeki sınavlar
    if (DB.archives) {
        DB.archives.forEach(arch => {
            arch.exams.forEach(ex => {
                if (ex.proctors && ex.proctors.some(p => p.id === staffId)) {
                    ex.proctors.forEach(p => {
                        if (p.id !== staffId) {
                            partnersMap[p.name] = (partnersMap[p.name] || 0) + 1;
                        }
                    });
                }
            });
        });
    }
    const topPartners = Object.entries(partnersMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(p => p[0]);
    
    document.getElementById('profile-partners').textContent = topPartners.length > 0 ? topPartners.join(' & ') : "Henüz veri yok";

    // 2. Bir Sonraki Görev Tahmini
    // Basit bir olasılık hesabı: Puan sıralaması düşükse (rank yüksekse) görev ihtimali artar.
    const totalStaffCount = DB.staff.length;
    const rankPercentage = (rank / totalStaffCount) * 100;
    
    let predictionText = "";
    if (rankPercentage > 70) {
        predictionText = "🚀 Yüksek Öncelik (Puanınız düşük)";
    } else if (rankPercentage > 30) {
        predictionText = "⚖️ Orta Öncelik";
    } else {
        predictionText = "📅 Düşük Öncelik (Puanınız yüksek)";
    }
    
    const upcomingUnassigned = DB.exams.filter(e => e.proctors.length === 0 && new Date(`${e.date}T${e.time}`) > new Date());
    if (upcomingUnassigned.length > 0) {
        predictionText += ` - İlk fırsat: ${upcomingUnassigned[0].date.split('-').reverse().join('.')}`;
    } else {
        predictionText += " - Yakında";
    }
    document.getElementById('profile-prediction').textContent = predictionText;

    // --- LİSTE GÖRÜNÜMÜ ---
    const tbody = document.querySelector('#table-profile-exams tbody');
    tbody.innerHTML = '';
    
    // Tarihe göre sırala (Bugünden sonrakiler - Saat dahil hassas filtre)
    const now = new Date();
    
    let displayExams = [];
    
    if (currentProfileTab === 'upcoming') {
        displayExams = myExams
            .filter(e => {
                const examStart = new Date(`${e.date}T${e.time || '00:00'}`);
                return examStart >= now;
            });
    } else {
        // GEÇMİŞ / ARŞİV SEKME MANTIĞI
        // 1. Mevcut sınavlar içindeki geçmiş sınavlar (Saati geçmiş olanlar dahil)
        const pastCurrent = myExams.filter(e => {
            const examStart = new Date(`${e.date}T${e.time || '00:00'}`);
            return examStart < now;
        });
        
        // 2. DB.archives içindeki bu hocaya ait sınavlar
        let archivedForStaff = [];
        if (DB.archives && Array.isArray(DB.archives)) {
            DB.archives.forEach(arch => {
                const staffInArch = arch.exams.filter(ex => 
                    ex.proctors && ex.proctors.some(p => p.id === staffId)
                );
                // Arşiv ismini sınav adına ekleyelim ki hangi dönem olduğu anlaşılsın
                staffInArch.forEach(sEx => {
                    archivedForStaff.push({
                        ...sEx,
                        name: `[${arch.name}] ${sEx.name}`
                    });
                });
            });
        }
        
        displayExams = [...pastCurrent, ...archivedForStaff];
    }

    const sortedToDisplay = displayExams
        .filter(e => currentProfileTypeFilter === 'all' || e.type === currentProfileTypeFilter)
        .sort((a, b) => {
            // Arşivler genelde daha eski olduğu için geçmişte ters sıralama (en yakın geçmiş en üstte) daha iyi olabilir
            return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
        });

    // En yakın sınavı bul (Vurgulamak için)
    let nextExamId = null;
    if (currentProfileTab === 'upcoming') {
        const soonest = [...sortedToDisplay].sort((a, b) => {
            return new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`);
        });
        if (soonest.length > 0) nextExamId = soonest[0].id;
    }

    sortedToDisplay.forEach(ex => {
        const tr = document.createElement('tr');
        if (ex.id === nextExamId) {
            tr.className = 'next-exam-highlight';
        }

        const typeMap = {
            'vize': 'Vize',
            'final': 'Final',
            'but': 'Bütünleme',
            'mazeret': 'Mazeret',
            'ek': 'Ek Sınav',
            'tercih': 'Tercih Günleri',
            'doktora': 'Doktora Yet.',
            'asist': 'Arş. Gör. Sınav',
            'diger': 'Diğer'
        };
        const typeLabel = typeMap[ex.type] || 'Sınav';
        const typeClass = `type-${ex.type || 'vize'}`;
        const isNext = ex.id === nextExamId;

        tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="btn-google-cal" onclick="window.open(generateGoogleCalendarLink(${JSON.stringify(ex).replace(/"/g, '&quot;')}), '_blank')" title="Google Takvim'e Ekle" style="padding: 2px 5px; font-size: 0.8rem;">📅</button>
                    <span class="badge-type ${typeClass}" style="zoom: 0.8;">${typeLabel}</span> 
                    <strong>${ex.name}</strong>
                    ${isNext ? '<span class="next-exam-badge">SIRADAKİ</span>' : ''}
                </div>
            </td>
            <td>${ex.date.split('-').reverse().join('.')}</td>
            <td>${ex.time}</td>
        `;
        tbody.appendChild(tr);
    });

    if (sortedToDisplay.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--text-muted);">${currentProfileTab === 'upcoming' ? 'Yaklaşan sınavınız bulunmuyor.' : 'Geçmiş/Arşivlenmiş sınavınız bulunmuyor.'}</td></tr>`;
    }

    renderProfileCalendar();
    renderProfileConstraints(staffId);
    renderProfileSwapRequests(staffId);
    renderProfileChecklist(staffId);
    updateProfileCountdown(staffId);
}

function updateProfileCountdown(staffId) {
    const countdownEl = document.getElementById('profile-countdown');
    if (!countdownEl) return;

    // Varsa eski interval'i temizle
    if (window.profileCountdownInterval) clearInterval(window.profileCountdownInterval);

    const updateUI = () => {
        const now = new Date();
        const myExams = DB.exams.filter(e => e.proctors.some(p => p.id === staffId));
        
        // Gelecekteki en yakın sınavı bul
        const upcoming = myExams
            .map(e => ({ ...e, start: new Date(`${e.date}T${e.time || '00:00'}`) }))
            .filter(e => e.start > now)
            .sort((a, b) => a.start - b.start);

        if (upcoming.length === 0) {
            countdownEl.textContent = "Yakın zamanda görev yok";
            countdownEl.style.color = "var(--text-muted)";
            return;
        }

        const nextExam = upcoming[0];
        const diff = nextExam.start - now;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        let parts = [];
        if (days > 0) parts.push(`${days}g`);
        if (hours > 0 || days > 0) parts.push(`${hours}s`);
        parts.push(`${mins}d`);
        parts.push(`${secs}sn`);

        countdownEl.textContent = parts.join(' ');
        countdownEl.style.color = "#10b981";
        countdownEl.title = `${nextExam.name} (${nextExam.date} ${nextExam.time})`;
    };

    updateUI();
    window.profileCountdownInterval = setInterval(updateUI, 1000);
}

function renderProfileChecklist(staffId) {
    const container = document.getElementById('profile-checklist-container');
    if (!container) return;
    container.innerHTML = '';

    const defaultItems = [
        "Sınav evraklarını / optikleri teslim almayı unutmayın.",
        "Öğrenci kimliklerini tek tek kontrol edin.",
        "Sınav imza sirküsünü (yoklama listesini) imzalatın.",
        "Sınav sonrası evrakları eksiksiz teslim edin."
    ];

    // DB.checklists yapısını başlatalım
    if (!DB.checklists) DB.checklists = {};
    if (!DB.checklists[staffId]) DB.checklists[staffId] = defaultItems.map(text => ({ text, done: false }));

    const items = DB.checklists[staffId];

    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '10px';
        div.style.padding = '8px';
        div.style.borderRadius = '6px';
        div.style.background = 'rgba(255,255,255,0.03)';
        div.style.cursor = 'pointer';
        div.className = 'checklist-row';
        if (item.done) div.style.opacity = '0.5';

        div.innerHTML = `
            <input type="checkbox" ${item.done ? 'checked' : ''} style="cursor:pointer">
            <span style="font-size: 0.9rem; color: ${item.done ? 'var(--text-muted)' : 'white'}; text-decoration: ${item.done ? 'line-through' : 'none'};">${item.text}</span>
        `;

        div.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') {
                const cb = div.querySelector('input');
                cb.checked = !cb.checked;
            }
            items[index].done = !items[index].done;
            saveDB();
            renderProfileChecklist(staffId);
        };

        container.appendChild(div);
    });
}

function renderProfileSwapRequests(staffId) {
    const tbody = document.querySelector('#table-profile-swap-requests tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!DB.swapRequests) return;

    const myRequests = DB.swapRequests.filter(r => r.fromStaffId === staffId || r.suggestedToStaffId === staffId);

    if (myRequests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-muted);">Henüz bir talep bulunmuyor.</td></tr>';
        return;
    }

    myRequests.forEach(req => {
        const exam = DB.exams.find(e => e.id === req.examId);
        if (!exam) return;

        const isSender = req.fromStaffId === staffId;
        const otherPartyId = isSender ? req.suggestedToStaffId : req.fromStaffId;
        const otherStaff = otherPartyId ? DB.staff.find(s => s.id === otherPartyId) : null;

        const role = isSender ? '<span style="color:#f87171;">Gönderen</span>' : '<span style="color:#60a5fa;">Alıcı</span>';
        const otherName = otherStaff ? otherStaff.name : (isSender ? 'Yönetici Ataması Bekleniyor' : 'Belirtilmedi');
        
        let statusBadge = "";
        switch(req.status) {
            case 'pending': statusBadge = '<span class="badge-type type-vize" style="background:#f59e0b;">Beklemede</span>'; break;
            case 'approved': statusBadge = '<span class="badge-type type-final" style="background:#10b981;">Onaylandı</span>'; break;
            case 'rejected': statusBadge = '<span class="badge-type" style="background:#ef4444;">Reddedildi</span>'; break;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${exam.name}</strong><br><small style="color:var(--text-muted)">${exam.date.split('-').reverse().join('.')} ${exam.time}</small></td>
            <td>${role}</td>
            <td>${otherName}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Bireysel Portal Sekme Dinleyicileri
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('profile-tab-btn')) {
        document.querySelectorAll('.profile-tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.color = 'var(--text-muted)';
            btn.style.fontWeight = '500';
        });
        e.target.classList.add('active');
        e.target.style.color = 'white';
        e.target.style.fontWeight = '600';
        currentProfileTab = e.target.getAttribute('data-tab');
        renderMyProfile();
    }
});

function renderProfileConstraints(staffId) {
    const listContainer = document.getElementById('profile-constraints-list');
    if (!listContainer) return;

    const staff = DB.staff.find(s => s.id === staffId);
    if (!staff) return;

    const constraints = DB.constraints[staff.name] || [];
    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

    if (constraints.length === 0) {
        listContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Henüz bir kısıt eklemediniz.</p>';
        return;
    }

    listContainer.innerHTML = constraints.map((c, index) => {
        let dayLabel = "Özel";
        if (c.day !== undefined) {
            dayLabel = dayNames[c.day];
        } else if (c.date) {
            // MM-DD formatını daha güzel göster
            const parts = c.date.split('-');
            dayLabel = `${parts[1]}.${parts[0]}`; // DD.MM
        }
        return `
            <div class="constraint-badge" title="${c.day !== undefined ? 'Haftalık Tekrar Eden' : 'Tek Seferlik Tarih'}">
                <span class="day-name">${dayLabel}</span>
                <span class="time-range">${c.start} - ${c.end}</span>
                <button class="btn-delete-con" onclick="deleteProfileConstraint(${staffId}, ${index})" title="Sil">×</button>
            </div>
        `;
    }).join('');
}

function addProfileConstraint() {
    const staffId = parseInt(document.getElementById('profile-staff-select').value);
    if (!staffId) return;

    const staff = DB.staff.find(s => s.id === staffId);
    if (!staff) return;

    const type = document.getElementById('profile-con-type').value;
    const start = document.getElementById('profile-con-start').value;
    const end = document.getElementById('profile-con-end').value;

    if (!start || !end) {
        alert("Lütfen saatleri giriniz.");
        return;
    }

    let newCon = { start, end };

    if (type === 'day') {
        newCon.day = parseInt(document.getElementById('profile-con-day').value);
    } else {
        const rawDate = document.getElementById('profile-con-date').value;
        if (!rawDate) { alert("Lütfen tarih seçiniz."); return; }
        // YYYY-MM-DD -> MM-DD (logic.js böyle istiyor)
        const parts = rawDate.split('-');
        newCon.date = `${parts[1]}-${parts[2]}`;
    }

    if (!DB.constraints[staff.name]) {
        DB.constraints[staff.name] = [];
    }

    DB.constraints[staff.name].push(newCon);
    saveToLocalStorage();
    
    // UI Güncelle
    renderProfileConstraints(staffId);
    renderProfileCalendar(); // Takvimde de görünmesi için
    alert("Kısıt başarıyla eklendi.");
}

function deleteProfileConstraint(staffId, index) {
    const staff = DB.staff.find(s => s.id === staffId);
    if (!staff) return;

    if (confirm("Bu kısıtı silmek istediğinize emin misiniz?")) {
        DB.constraints[staff.name].splice(index, 1);
        saveToLocalStorage();
        renderProfileConstraints(staffId);
        renderProfileCalendar();
    }
}

function renderProfileCalendar() {
    const grid = document.getElementById('profile-calendar-grid');
    const title = document.getElementById('profile-calendar-month-title');
    if (!grid || !title) return;

    grid.innerHTML = '';
    const year = currentProfileDate.getFullYear();
    const month = currentProfileDate.getMonth();
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    title.textContent = `${monthNames[month]} ${year}`;

    // Aktif ayın butonu (Profil içindeki selector)
    document.querySelectorAll('#profile-month-selector button').forEach(btn => {
        const m = parseInt(btn.getAttribute('data-month'));
        btn.classList.toggle('active', m === month);
    });

    // Gün başlıkları
    const dayNamesShort = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    dayNamesShort.forEach(d => {
        const div = document.createElement('div');
        div.className = 'calendar-day-head';
        div.textContent = d;
        grid.appendChild(div);
    });

    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    for (let i = startDay - 1; i >= 0; i--) {
        grid.appendChild(createProfileDayCell(daysInPrevMonth - i, true));
    }

    const today = new Date();
    const staffId = parseInt(document.getElementById('profile-staff-select').value);

    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
        grid.appendChild(createProfileDayCell(d, false, isToday, staffId));
    }

    const totalCells = grid.children.length - 7;
    const remaining = 42 - totalCells;
    for (let i = 1; i <= remaining; i++) {
        grid.appendChild(createProfileDayCell(i, true));
    }
}

function createProfileDayCell(day, isOtherMonth, isToday = false, staffId = null) {
    const cell = document.createElement('div');
    cell.className = `calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`;
    
    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = day;
    cell.appendChild(num);

    if (!isOtherMonth && staffId) {
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'calendar-events';
        
        const dateStr = `${currentProfileDate.getFullYear()}-${String(currentProfileDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Sadece bu hocaya ait sınavları + Tür filtresini bul
        const exams = DB.exams.filter(e => e.date === dateStr && e.proctors.some(p => p.id === staffId) && (currentProfileTypeFilter === 'all' || e.type === currentProfileTypeFilter));
        
        exams.forEach(ex => {
            const badge = document.createElement('div');
            const typeClass = `type-${ex.type || 'vize'}`;
            badge.className = `calendar-event ${typeClass}`;
            badge.style.color = 'white';
            badge.textContent = `${ex.time} - ${ex.name}`;
            badge.onclick = (e) => {
                e.stopPropagation();
                showExamDetail(ex.name, ex.date, ex.time, ex.location || '');
            };
            eventsContainer.appendChild(badge);
            cell.style.background = 'rgba(99, 102, 241, 0.05)'; // Görevi olan günü boya
        });

        // Kısıt kontrolü (Eğer sınav yoksa ama hoca meşgulse belirt)
        const staff = DB.staff.find(s => s.id === staffId);
        if (staff) {
            const isRestricted = !isAvailable(staff.name, dateStr, "09:00", 480); // Günün büyük bölümünü kapsayan bir kontrol
            if (isRestricted && exams.length === 0) {
                const badge = document.createElement('div');
                badge.className = 'calendar-event';
                badge.style.background = 'rgba(239, 68, 68, 0.1)';
                badge.style.color = '#ef4444';
                badge.style.border = '1px dashed #ef4444';
                badge.style.fontSize = '0.7rem';
                badge.textContent = '🕒 Müsait Değil';
                eventsContainer.appendChild(badge);
                cell.style.background = 'rgba(239, 68, 68, 0.03)';
            }
        }
        
        cell.appendChild(eventsContainer);
    }
    
    return cell;
}

/**
 * Genel Sınav Programını Resmi PDF Olarak İndir
 */
function exportScheduleToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Başlık ve Kurumsal Bilgiler
    doc.setFontSize(10);
    doc.text("T.C. GEBZE TEKNIK UNIVERSITESI", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("MATEMATIK BOLUMU SINAV GOREVLENDIRME CIZELGESI", 105, 22, { align: "center" });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const today = new Date().toLocaleDateString('tr-TR');
    doc.text(`Rapor Tarihi: ${today}`, 195, 30, { align: "right" });

    // Cizgi
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(15, 33, 195, 33);

    // Tablo Verilerini Hazırla
    const table = document.getElementById('table-schedule');
    const rows = [];
    const tableRows = table.querySelectorAll('tbody tr');
    
    tableRows.forEach(tr => {
        if (tr.classList.contains('year-header')) {
             rows.push([{ content: tr.innerText, colSpan: 6, styles: { fillColor: [224, 231, 255], fontStyle: 'bold', textColor: [67, 56, 202] } }]);
             return;
        }
        const row = [];
        tr.querySelectorAll('td').forEach((td, index) => {
            if (index < 6) { // İşlem sütununu atla
                row.push(turkishToEnglish(td.innerText));
            }
        });
        if (row.length > 0) rows.push(row);
    });

    // AutoTable
    doc.autoTable({
        head: [['Ders / Sinav', 'Derslik / Yer', 'Tarih', 'Saat', 'Sure', 'Gozetmenler']],
        body: rows,
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, font: 'helvetica', cellPadding: 3 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { top: 40, left: 15, right: 15 },
        didDrawPage: function(data) {
            doc.setFontSize(8);
            doc.text(`Sayfa ${data.pageNumber}`, 105, 285, { align: "center" });
        }
    });

    const finalY = doc.lastAutoTable.finalY + 20;
    if (finalY < 250) {
        doc.setFontSize(10);
        doc.text("Bolum Baskani Onayi", 150, finalY + 10, { align: "center" });
        doc.text("..............................", 150, finalY + 25, { align: "center" });
    }

    doc.save(`Sinav_Programi_${today.replace(/\./g, '_')}.pdf`);
}

/**
 * Bireysel Hoca Programını PDF Olarak İndir
 */
function exportIndividualToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const name = document.getElementById('individual-proctor-name').textContent;
    const today = new Date().toLocaleDateString('tr-TR');

    // Başlık
    doc.setFontSize(10);
    doc.text("T.C. GEBZE TEKNIK UNIVERSITESI", 105, 15, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("KISISEL SINAV GOREV CIZELGESI", 105, 22, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229);
    doc.text(turkishToEnglish(name), 105, 32, { align: "center" });

    doc.setDrawColor(200, 200, 200);
    doc.line(15, 38, 195, 38);

    // Tablo Verileri
    const table = document.getElementById('table-individual-schedule');
    const rows = [];
    const tableRows = table.querySelectorAll('tbody tr');
    
    tableRows.forEach(tr => {
        const row = [];
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 4) {
            row.push(turkishToEnglish(tds[0].innerText)); // Sınav
            row.push(turkishToEnglish(tds[1].innerText)); // Yer
            row.push(turkishToEnglish(tds[2].innerText)); // Görevli
            row.push(turkishToEnglish(tds[3].innerText)); // Tarih & Saat
            rows.push(row);
        }
    });

    doc.autoTable({
        head: [['Ders / Sinav', 'Yer', 'Gorevli', 'Tarih & Saat']],
        body: rows,
        startY: 45,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 10 },
        styles: { fontSize: 9, cellPadding: 4 },
        margin: { left: 15, right: 15 }
    });

    doc.save(`Program_${name.replace(' ', '_')}.pdf`);
}

/**
 * Sınav verisinden Google Takvim linki oluşturur
 */
function generateGoogleCalendarLink(exam) {
    const title = encodeURIComponent(`Sınav Görevi: ${exam.name}`);
    const location = encodeURIComponent(exam.location || "Belirtilmemiş");
    
    // Tarih formatı: YYYYMMDDTHHMMSS (Yerel saat)
    const dateStr = exam.date.replace(/-/g, '');
    const timeStr = exam.time.replace(/:/g, '') + '00';
    const start = `${dateStr}T${timeStr}`;
    
    // Bitiş saati (başlangıç + süre)
    const startDate = new Date(`${exam.date}T${exam.time}`);
    const endDate = new Date(startDate.getTime() + (exam.duration || 60) * 60000);
    
    const endYear = endDate.getFullYear();
    const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
    const endDateDay = String(endDate.getDate()).padStart(2, '0');
    const endHours = String(endDate.getHours()).padStart(2, '0');
    const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
    const endStr = `${endYear}${endMonth}${endDateDay}T${endHours}${endMinutes}00`;
    
    const details = encodeURIComponent(`Gözetmenlik Görevi\nSüre: ${exam.duration} dk\nPuan: ${exam.score ? exam.score.toFixed(1) : ''}`);
    
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${endStr}&details=${details}&location=${location}&sf=true&output=xml`;
}

/**
 * Seçili sınavları içeren bir .ics dosyası indirir
 */
function downloadICSFile(exams, filename = "Sinav_Gorevleri.ics") {
    if (!exams || exams.length === 0) {
        alert("Dışa aktarılacak sınav bulunamadı!");
        return;
    }

    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//GTU Matematik//Sinav Gozetmenlik//TR\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n";
    
    exams.forEach(ex => {
        const dateStr = ex.date.replace(/-/g, '');
        const timeStr = ex.time.replace(/:/g, '') + '00';
        const start = `${dateStr}T${timeStr}`;

        const startDate = new Date(`${ex.date}T${ex.time}`);
        const endDate = new Date(startDate.getTime() + (ex.duration || 60) * 60000);
        
        const endYear = endDate.getFullYear();
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
        const endDateDay = String(endDate.getDate()).padStart(2, '0');
        const endHours = String(endDate.getHours()).padStart(2, '0');
        const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
        const endStr = `${endYear}${endMonth}${endDateDay}T${endHours}${endMinutes}00`;
        
        icsContent += "BEGIN:VEVENT\n";
        icsContent += `DTSTART;TZID=Europe/Istanbul:${start}\n`;
        icsContent += `DTEND;TZID=Europe/Istanbul:${endStr}\n`;
        icsContent += `SUMMARY:Sinav Gorevi: ${ex.name}\n`;
        icsContent += `LOCATION:${ex.location || "Belirtilmemis"}\n`;
        icsContent += `DESCRIPTION:Gozetmenlik Gorevi - Sure: ${ex.duration} dk\n`;
        icsContent += "STATUS:CONFIRMED\n";
        icsContent += "END:VEVENT\n";
    });
    
    icsContent += "END:VCALENDAR";
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccessToast("Takvim dosyası (.ics) oluşturuldu!");
}

/**
 * Türkçe karakterleri PDF uyumlu (ASCII) karakterlere dönüştürür.
 * jsPDF varsayılan fontları Türkçe karakterleri desteklemediği için kullanılır.
 */
function turkishToEnglish(text) {
    if (!text) return "";
    return text
        .replace(/İ/g, "I")
        .replace(/ı/g, "i")
        .replace(/Ğ/g, "G")
        .replace(/ğ/g, "g")
        .replace(/Ü/g, "U")
        .replace(/ü/g, "u")
        .replace(/Ş/g, "S")
        .replace(/ş/g, "s")
        .replace(/Ö/g, "O")
        .replace(/ö/g, "o")
        .replace(/Ç/g, "C")
        .replace(/ç/g, "c");
}

/**
 * Arşiv listesini ve karşılaştırma grafiğini render eder.
 */
function renderArchives() {
    renderCompletedExams(); // Tamamlanan sınavları da listele
    const tableBody = document.querySelector('#table-archives tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!DB.archives || DB.archives.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">Henüz bir arşiv bulunmuyor.</td></tr>';
        return;
    }

    DB.archives.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(archive => {
        const avgScore = archive.examCount > 0 
            ? (archive.staffSnapshot.reduce((sum, s) => sum + s.totalScore, 0) / archive.staffSnapshot.length).toFixed(1)
            : 0;
            
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600; color:#818cf8;">${archive.name}</td>
            <td>${new Date(archive.date).toLocaleDateString('tr-TR')}</td>
            <td>${archive.examCount} Sınav</td>
            <td>${avgScore} Puan</td>
            <td style="text-align:right;">
                <button class="btn-secondary" onclick="showArchiveDetail(${archive.id})" style="font-size:0.8rem; padding:5px 10px;">Detay</button>
                <button class="btn-secondary admin-only" onclick="handleDeleteArchive(${archive.id})" style="font-size:0.8rem; padding:5px 10px; border-color:#ef4444; color:#ef4444;">Sil</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    updateArchiveComparisonChart();
}

function showArchiveDetail(id) {
    const archive = DB.archives.find(a => a.id === id);
    if (!archive) return;

    const modal = document.getElementById('modal-archive-detail');
    modal.dataset.archiveId = id;
    document.getElementById('archive-detail-title').textContent = archive.name;
    
    const avg = (archive.staffSnapshot.reduce((sum, s) => sum + s.totalScore, 0) / archive.staffSnapshot.length).toFixed(1);
    document.getElementById('archive-summary-text').innerHTML = `
        <strong>Tarih:</strong> ${new Date(archive.date).toLocaleString('tr-TR')}<br>
        <strong>Toplam Sınav:</strong> ${archive.examCount}<br>
        <strong>Ortalama Hoca Puanı:</strong> ${avg}
    `;

    const tbody = document.querySelector('#table-archive-exams tbody');
    tbody.innerHTML = '';
    archive.exams.forEach(ex => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${ex.name}</td>
            <td>${ex.date}</td>
            <td>${ex.time}</td>
            <td style="font-size:0.8rem;">${ex.proctors ? ex.proctors.map(p => p.name).join(', ') : (ex.proctorName || '')}</td>
        `;
        tbody.appendChild(tr);
    });

    modal.classList.remove('hidden');
}

function handleDeleteArchive(id) {
    if (confirm("Bu arşivi kalıcı olarak silmek istediğinize emin misiniz?")) {
        deleteArchive(id);
        renderArchives();
    }
}

/**
 * Arşivler arası ortalama puanları kıyaslayan basit bir çubuk grafik oluşturur.
 */
function updateArchiveComparisonChart() {
    const container = document.getElementById('archive-comparison-chart');
    if (!container) return;
    container.innerHTML = '';

    if (!DB.archives || DB.archives.length < 1) {
        container.innerHTML = '<p style="color: var(--text-muted); margin: auto;">Henüz karşılaştırılacak arşiv bulunmuyor.</p>';
        return;
    }

    // Son 5 arşivi al
    const lastArchives = [...DB.archives].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-5);
    
    // Maksimum puanı bul (Yükseklik ölçekleme için)
    const avgs = lastArchives.map(a => a.staffSnapshot.reduce((sum, s) => sum + s.totalScore, 0) / a.staffSnapshot.length);
    const maxAvg = Math.max(...avgs, 100);

    lastArchives.forEach((archive, i) => {
        const avg = avgs[i];
        const heightPercent = (avg / maxAvg) * 100;
        
        const barWrapper = document.createElement('div');
        barWrapper.style.cssText = `flex:1; display:flex; flex-direction:column; align-items:center; gap:8px;`;
        
        const bar = document.createElement('div');
        bar.style.cssText = `width:100%; min-width:30px; background:linear-gradient(to top, #4f46e5, #818cf8); border-radius:4px 4px 0 0; height:${heightPercent}%; transition:height 0.5s; cursor:pointer;`;
        bar.title = `${archive.name}: ${avg.toFixed(1)} Puan`;
        
        const label = document.createElement('span');
        label.style.cssText = `font-size:0.7rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;`;
        label.textContent = archive.name.split(' ')[0]; // İlk kelimeyi al (Örn: 2025)

        barWrapper.appendChild(bar);
        barWrapper.appendChild(label);
        container.appendChild(barWrapper);
    });
}


/**
 * Tamamlanan (Tarihi geçmiş) sınavları Arşiv sekmesindeki ilgili tabloda listeler.
 */
function renderCompletedExams() {
    const tbody = document.querySelector('#table-completed-exams tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Geçmiş sınavları bul ve tarihe göre azalan (en yeni en üstte) sırala
    const passedExams = DB.exams
        .filter(ex => isExamPassed(ex))
        .sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time}`);
            const dateB = new Date(`${b.date}T${b.time}`);
            return dateB - dateA;
        });

    if (passedExams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">Henüz tamamlanmış sınav bulunmuyor.</td></tr>';
        return;
    }

    passedExams.forEach(ex => {
        const tr = document.createElement('tr');
        const safeDate = ex.date || "";
        const dateObj = safeDate ? new Date(safeDate.replace(/-/g, "/")) : new Date();
        const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const dayName = dayNames[dateObj.getDay()];
        const displayDate = safeDate ? safeDate.split("-").reverse().join(".") + " " + dayName : "-";

        const proctorNames = (ex.proctors || []).map(p => {
             if (!p || !p.name) return "";
             return `<span class="clickable-name" onclick="showStaffSchedule('${p.name}')">${p.name}</span>`;
        }).filter(n => n !== "").join(', ');

        tr.innerHTML = `
            <td><strong>${ex.name || "-"}</strong></td>
            <td>${ex.location || "-"}</td>
            <td>${displayDate}</td>
            <td>${ex.time}</td>
            <td>${ex.duration} dk</td>
            <td>${proctorNames || '-'}</td>
            <td style="text-align: right;">
                <button class="btn-secondary" onclick="showExamDetail('${ex.name || ""}', '${safeDate}', '${ex.time || ""}', '${ex.location || ""}')" style="font-size:0.8rem; padding:4px 8px;">Detay</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Global'e aç
window.showArchiveDetail = showArchiveDetail;
window.handleDeleteArchive = handleDeleteArchive;

// --- GitHub Senkronizasyon ve Veri Aktarımı ---

window.openGithubSyncModal = function() {
    const modal = document.getElementById('modal-github-sync');
    const container = document.getElementById('github-code-container');
    if (!modal || !container) return;

    // DB objesini temizle ve formatla
    const dbCopy = JSON.parse(JSON.stringify(DB));
    
    const code = `/**
 * Gözetmenlik Sistemi Veri Havuzu (Global DB)
 * Bu dosya sistem verilerini taşır.
 */
const DB = ${JSON.stringify(dbCopy, null, 4)};`;

    container.value = code;
    modal.classList.remove('hidden');
};

window.copyGithubCode = function() {
    const container = document.getElementById('github-code-container');
    container.select();
    document.execCommand('copy');
    alert("✓ Kod kopyalandı! Şimdi logic.js dosyasını güncelleyebilirsiniz.");
};

// Global init çağrısı
document.addEventListener('DOMContentLoaded', () => {
    // Mobil menü vs. gerekirse buraya eklenebilir.
});
