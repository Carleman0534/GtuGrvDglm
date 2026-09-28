/**
 * Gözetmenlik UI Kontrolcü
 */

/**
 * UI Dinamik Bileşenleri
 */
window.getInitials = function(name) {
    if(!name) return "?";
    const parts = name.split(" ").filter(p => !p.includes(".") && p.length > 1);
    const mainParts = parts.length > 0 ? parts : name.split(" ");
    const initials = mainParts.slice(0, 2).map(p => p[0]).join("");
    return initials.toUpperCase();
};

window.getAvatarColor = function(name) {
    const colors = ["--av-1", "--av-2", "--av-3", "--av-4", "--av-5", "--av-6", "--av-7", "--av-8"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `var(${colors[Math.abs(hash) % colors.length]})`;
};

window.getAvatarHtml = function(name) {
    const initials = getInitials(name);
    const color = getAvatarColor(name);
    return `<div class="avatar-circle" style="background: ${color}">${initials}</div>`;
};

/**
 * Puan rengine göre şik bir renk döndürür.
 */
window.getScoreColor = function(score) {
    if (score >= 80) return "#10b981"; // Yeşil (Çok Esnek)
    if (score >= 50) return "#f59e0b"; // Turuncu (Orta)
    return "#ef4444"; // Kirmizi (Kisitli)
};

/**
 * Sistemin güncel web adresini döndürür.
 */
window.getSystemUrl = function() {
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
};

// ============================================================
// 🔑 PERSONEL ŞİFRE VE KİMLİK DOĞRULAMA YARDIMCILARI
// ============================================================
window.getDefaultStaffPassword = function(staffName) {
    if (!staffName) return '';
    const map = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'i': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'I': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
    };
    let firstName = staffName.split(' ').find(w => !w.includes('.') && w.length > 2) || staffName.split(' ')[0];
    firstName = firstName.replace(/[çğıiöşüÇĞİIÖŞÜ]/g, m => map[m] || m).toLowerCase().replace(/[^a-z]/g, '');
    return firstName ? (firstName + '123') : '';
};

window.isStaffPasswordMatch = function(staff, password, inputHash) {
    if (!staff || !password) return false;
    const cleanPass = password.trim();

    // 1. Güncel / Kayıtlı Şifre Kontrolü
    if (staff.staffPassword && staff.staffPassword === cleanPass) return true;
    if (staff.passwordHash && inputHash && staff.passwordHash === inputHash) return true;

    // 2. Aslıhan Gür, Serkan Ayrıca ve Yasin Turan için Eski Şifreler
    const OLD_PASSWORDS = {
        4: '159159',      // Aslıhan Gür
        7: '1604',        // Serkan Ayrıca
        12: '147258369'   // Yasin Turan
    };
    if (OLD_PASSWORDS[staff.id] && OLD_PASSWORDS[staff.id] === cleanPass) return true;
    if (staff.oldPassword && staff.oldPassword === cleanPass) return true;

    // 3. Standart isim123 Formatındaki Şifre (Örn: yasin123, cansu123, cagla123...)
    const defaultPass = getDefaultStaffPassword(staff.name);
    if (defaultPass && defaultPass.toLowerCase() === cleanPass.toLowerCase()) return true;

    return false;
};

window.logoutUser = function() {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('isLecturer');
    sessionStorage.removeItem('userPassword');
    localStorage.removeItem('myStaffId');
    window.location.reload();
};


document.addEventListener('DOMContentLoaded', () => {
    const loginOverlay = document.getElementById('login-overlay');
    const appWrapper = document.getElementById('app-wrapper');
    let currentImportType = 'exams'; // 'staff' veya 'exams'
    const loginPassInput = document.getElementById('login-password');
    const btnLogin = document.getElementById('btn-login');
    const btnLoginLecturer = document.getElementById('btn-login-lecturer');
    const loginError = document.getElementById('login-error');

    // Şifreler (frontend yerel kontrolü)
    const ADMIN_PASSWORD = 'GtuAdmın123';
    const GOZETMEN_PASSWORD = 'Gtu2026';

    const finishLogin = async (isAdmin, isLecturer = false) => {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');
        sessionStorage.setItem('isLecturer', isLecturer ? 'true' : 'false');
        
        if (Object.keys(navButtons).length === 0) initNavigation();

        window.showToast = function(message, type = 'success') {
            let container = document.querySelector('.toast-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'toast-container';
                document.body.appendChild(container);
            }
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `
                <div style="font-size: 1.25rem;">${type === 'success' ? '✅' : '⚠️'}</div>
                <div style="font-weight: 500;">${message}</div>
            `;
            container.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 3000);
            }, 3000);
        };

        const isLecturerMode = sessionStorage.getItem('isLecturer') === 'true';
        
        // Hoca modunda her şeyi gizle, sadece programi ve yeni portali göster
        if (isLecturerMode) {
            document.body.classList.add('lecturer-mode');
            document.querySelectorAll('.lecturer-only').forEach(el => el.classList.remove('hidden'));
            
            // Başlangiçta Programi göster
            Object.values(sections).forEach(s => { if(s) s.classList.add('hidden'); });
            if (sections.schedule) sections.schedule.classList.remove('hidden');
            Object.values(navButtons).forEach(b => { if(b) b.classList.remove('active'); });
            if (navButtons.schedule) navButtons.schedule.classList.add('active');
        } else {
            document.body.classList.remove('lecturer-mode');
            document.querySelectorAll('.lecturer-only').forEach(el => el.classList.add('hidden'));
        }

        if (!isAdmin) document.body.classList.add('guest-mode');
        else document.body.classList.remove('guest-mode');

        if (isAdmin) document.body.classList.add('admin-mode');
        else document.body.classList.remove('admin-mode');
        
        loginOverlay.classList.add('hidden');
        appWrapper.style.display = 'block';
        await initApp();
        
        if (document.getElementById('btn-lecturer-portal')) {
            // Buton zaten navButtons içinde olduğu için ayrica listener eklemeye gerek yok, 
            // yukaridaki Object.entries(navButtons).forEach döngüsü bunu halledecek.
        }

        // Portal dropdown listeners moved to functions themselves or global scope for reliability
        
        if (isLecturer) {
            // Olasi event listener asenkron gecikmelerini aşmak için kisa bir gecikme ve fallback
            setTimeout(() => {
                const btnSchedule = document.getElementById('btn-schedule');
                if (btnSchedule) btnSchedule.click();
                
                // Eğer click listener henüz bağlanmadiysa diye manuel çağir (fallback)
                if (typeof renderSchedule === 'function') renderSchedule();
            }, 50);
        }
    };

    // Oturum Kontrolü
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        finishLogin(sessionStorage.getItem('isAdmin') === 'true', sessionStorage.getItem('isLecturer') === 'true');
    } else {
        loginOverlay.classList.remove('hidden');
        appWrapper.style.display = 'none';
    }

    const handleLogin = async () => {
        try {
            const password = loginPassInput.value.trim();
            if (!password) return;

            let inputHash = password;
            try {
                if (typeof hashSHA256 === 'function') {
                    inputHash = await hashSHA256(password);
                }
            } catch (hashErr) {
                console.warn('Hash hesaplama atlandı:', hashErr);
            }

            // 1. Yönetici şifresi (SHA-256 Hash Doğrulamasi & Düz Metin Yedek)
            const lowerPass = password.toLowerCase().replace(/ı/g, 'i');
            const isAdminPlain = (lowerPass === 'gtuadmin123' || lowerPass === 'gtuturan123' || password === ADMIN_PASSWORD);
            const isAdminHash = (window.AUTH_HASHES && Array.isArray(window.AUTH_HASHES.ADMIN_HASHES) && window.AUTH_HASHES.ADMIN_HASHES.includes(inputHash));
            const isAdminMatch = isAdminPlain || isAdminHash;

            if (isAdminMatch) {
                sessionStorage.setItem('userPassword', password);
                logAction('system', 'Giriş', 'Yönetici girişi yapildi (Güvenli Hash Doğrulandi).');
                if (loginError) loginError.classList.add('hidden');
                finishLogin(true);
                return;
            }

            // 2. Genel gözetmen şifresi (SHA-256 Hash Doğrulamasi & Düz Metin Yedek)
            const isProctorPlain = (lowerPass === 'gtu2026' || password === GOZETMEN_PASSWORD);
            const isProctorHash = (window.AUTH_HASHES && window.AUTH_HASHES.PROCTOR_HASH && inputHash === window.AUTH_HASHES.PROCTOR_HASH);
            const isProctorMatch = isProctorPlain || isProctorHash;

            if (isProctorMatch) {
                localStorage.removeItem('myStaffId');
                logAction('system', 'Giriş', 'Gözetmen girişi yapildi (Genel Şifre: Gtu2026).');
                if (loginError) loginError.classList.add('hidden');
                await finishLogin(false);
                setTimeout(() => {
                    const btnProfile = document.getElementById('btn-profile');
                    if (btnProfile) btnProfile.click();
                    if (typeof renderProfile === 'function') renderProfile();
                }, 100);
                return;
            }

            // 3. Bireysel gözetmen şifresi - DB'den kontrol et
            let staffList = [];
            const cached = localStorage.getItem(DB_KEY);
            if (cached) {
                try { staffList = JSON.parse(cached).staff || []; } catch(e) {}
            }
            if (staffList.length === 0) {
                if (btnLogin) { btnLogin.textContent = 'Kontrol ediliyor...'; btnLogin.disabled = true; }
                await loadFromDataJSON();
                staffList = DB.staff || [];
                if (btnLogin) { btnLogin.textContent = 'Giriş Yap'; btnLogin.disabled = false; }
            }

            let matchedStaff = staffList.find(s => isStaffPasswordMatch(s, password, inputHash));

            if (!matchedStaff && typeof loadFromDataJSON === 'function') {
                await loadFromDataJSON();
                staffList = DB.staff || [];
                matchedStaff = staffList.find(s => isStaffPasswordMatch(s, password, inputHash));
            }

            if (matchedStaff) {
                localStorage.setItem('myStaffId', String(matchedStaff.id));
                logAction('system', 'Giriş', `${matchedStaff.name} kişisel şifresiyle doğrudan kendi profiline giriş yaptı.`);
                if (loginError) loginError.classList.add('hidden');
                await finishLogin(false);
                setTimeout(() => {
                    const btnProfile = document.getElementById('btn-profile');
                    if (btnProfile) btnProfile.click();
                    if (typeof renderProfile === 'function') renderProfile();
                }, 100);
                return;
            }

            // 4. Hatali şifre
            if (loginError) {
                loginError.textContent = 'Hatalı şifre, lütfen tekrar deneyin.';
                loginError.classList.remove('hidden');
            }
            loginPassInput.value = '';
            loginPassInput.focus();
        } catch (err) {
            console.error("Giriş işlemi sırasında hata:", err);
            if (loginError) {
                loginError.textContent = "Giriş sırasında bir hata oluştu, lütfen tekrar deneyin.";
                loginError.classList.remove('hidden');
            }
        } finally {
            if (btnLogin) { btnLogin.textContent = 'Giriş Yap'; btnLogin.disabled = false; }
        }
    };

    if (btnLogin) btnLogin.addEventListener('click', handleLogin);

    if (btnLoginLecturer) {
        btnLoginLecturer.addEventListener('click', () => {
            logAction('system', 'Giriş', 'Hoca girişi yapildi (Sadece Program).');
            if (loginError) loginError.classList.add('hidden');
            finishLogin(false, true);
        });
    }
    if (loginPassInput) {
        loginPassInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    initExcelImport();
});

// UI Bileşenleri ve Navigasyon Yapisi
const navButtons = {};
const sections = {};
let navigationInitialized = false;

function initNavigation() {
    if (navigationInitialized) return;
    navigationInitialized = true;
    navButtons.dashboard = document.getElementById('btn-dashboard');
    navButtons.schedule = document.getElementById('btn-schedule');
    navButtons.exams = document.getElementById('btn-exams');
    navButtons.staff = document.getElementById('btn-staff');
    navButtons.availability = document.getElementById('btn-availability');
    navButtons.requests = document.getElementById('btn-requests');
    navButtons.profile = document.getElementById('btn-profile');
    navButtons.audit = document.getElementById('btn-audit');
    navButtons.announcements = document.getElementById('btn-announcements');
    navButtons.timeline = document.getElementById('btn-timeline');
    navButtons.stats = document.getElementById('btn-stats');
    navButtons.lecturerPortal = document.getElementById('btn-lecturer-portal');
    navButtons.feedback = document.getElementById('btn-feedback');

    sections.dashboard = document.getElementById('section-dashboard');
    sections.schedule = document.getElementById('section-schedule');
    sections.exams = document.getElementById('section-exams');
    sections.staff = document.getElementById('section-staff');
    sections.availability = document.getElementById('section-availability');
    sections.requests = document.getElementById('section-requests');
    sections.profile = document.getElementById('section-profile');
    sections.audit = document.getElementById('section-audit');
    sections.announcements = document.getElementById('section-announcements');
    sections.timeline = document.getElementById('section-timeline');
    sections.stats = document.getElementById('section-stats');
    sections.lecturerPortal = document.getElementById('sec-lecturer-portal');
    sections.feedback = document.getElementById('section-feedback');

    Object.entries(navButtons).forEach(([key, btn]) => {
        if (!btn) return;
        btn.addEventListener('click', () => {
            // Update Buttons
            Object.values(navButtons).forEach(b => { if(b) b.classList.remove('active'); });
            btn.classList.add('active');

            // Update Sections
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            if ((btn.classList.contains('admin-only') && !isAdmin) || 
                (btn.classList.contains('user-only') && isAdmin)) {
                // Yetkisiz erişim girişimi
                if (sections.dashboard) sections.dashboard.classList.remove('hidden');
                if (navButtons.dashboard) navButtons.dashboard.classList.add('active');
                btn.classList.remove('active');
                return;
            }

            Object.values(sections).forEach(s => { if(s) s.classList.add('hidden'); });
            if (sections[key]) sections[key].classList.remove('hidden');

            if (key === 'dashboard') renderDashboard();
            if (key === 'schedule') renderSchedule();
            if (key === 'exams') renderExams();
            if (key === 'staff') renderStaff();
            if (key === 'availability') renderAvailability();
            if (key === 'constraints') renderConstraintsPage();
            if (key === 'requests') loadFromDataJSON().then(() => renderSwapRequests());
            if (key === 'profile') { renderProfile(); updateNotificationBadge(); }
            if (key === 'audit') renderAuditLogs();
            if (key === 'announcements') { renderAnnouncements(); markAnnouncementsAsRead(); }
            if (key === 'timeline') renderMonthlyCalendar();
            if (key === 'stats') renderStats();
            if (key === 'lecturerPortal') loadLecturerPortalStaff();
            if (key === 'feedback') renderFeedbackPage();
        });
    });
}

async function initApp() {
    // Sitenin en güncel veriyi Backend API'den asenkron olarak okumasini bekliyoruz
    await loadFromDataJSON();

    if (!DB.constraints) DB.constraints = {};
    if (!DB.requests) DB.requests = [];
    if (!DB.feedbacks) DB.feedbacks = [];
    if (!DB.taskStatuses) DB.taskStatuses = {};

    // Tarihi geçmiş kisitlari otomatik olarak temizle
    if (typeof cleanExpiredConstraints === 'function') {
        cleanExpiredConstraints(true);
    }

    // Sinav tarihi geçmiş talepleri otomatik sona erdir
    const expireResult = autoExpireRequests();
    if (expireResult.expired > 0) {
        console.log(`🕐 ${expireResult.expired} süresi geçmiş talep otomatik kapatildi.`);
    }
    // Migration: Old single announcement to new announcements array
    if (DB.announcement && !DB.announcements) {
        DB.announcements = [{
            id: Date.now(),
            text: DB.announcement.text,
            updatedAt: DB.announcement.updatedAt
        }];
        delete DB.announcement;
    }

    if (!DB.announcements) {
        DB.announcements = [];
    }

    if (!DB.auditLogs) {
        DB.auditLogs = [];
    }
    
    // Varsayilan/Zorunlu duyurulari kontrol et ve eksikse ekle
    const defaultAnnouncements = [
        {
            id: 1,
            text: "### 📢 Rehber: Kisit Ayarlarim Sistemi Ne Zaman Kullanilmalidir?\n\nYeni eklenen **Kisit Ayarlarim** özelliği ile sinav görevlendirmelerinizi daha düzenli hale getirebilirsiniz. Aşağidaki durumlarda kisit girmeniz önerilir:\n\n1. **Ders Saatleriniz:** Haftalik sabit ders saatlerinizi sisteme girerek sinavlarin derslerinizle çakişmasini engelleyebilirsiniz.\n2. **Toplantilar:** Sabit bölüm toplantilari veya araştirma saatleriniz için haftalik kisit ekleyebilirsiniz.\n3. **Özel Randevular:** Sadece belirli bir tarihte (örn: hastane randevusu) özel bir işiniz varsa o günü kapatabilirsiniz.\n4. **Ulaşim:** Şehir dişina çikacağiniz tarihlerde sistemin size görev verilmesini önlemek için tarih bazli kisit ekleyebilirsiniz.\n\n[Kisit Ayarlarinizi Hemen Güncelleyin]({{AVAIL_LINK}})",
            isImportant: true,
            updatedAt: new Date().toISOString()
        },
        {
            id: 2,
            text: "### 📢 DUYURU 2: Müsaitlik ve Kisit Girişi\n\nSistemin doğru çalişabilmesi için müsait olmadiğiniz gün ve saatleri girmeniz önemlidir.\n\n👉 Kendi müsait olmadiğiniz saatleri sistem üzerinden girebilirsiniz.\n\nBu bilgiler:\n- Size uygun görevlerin belirlenmesinde\n- Yerine geçme önerilerinin doğru yapilmasinda\n\naktif olarak kullanilacaktir.",
            isImportant: false,
            updatedAt: new Date().toISOString()
        },
        {
            id: 3,
            text: "### 📢 DUYURU 3: Akilli Eşleştirme Sistemi\n\nSistem, yerine geçecek kişileri rastgele değil, belirli kriterlere göre akilli şekilde önerir.\n\nDeğerlendirme kriterleri:\n- Müsaitlik durumu\n- Toplam görev sayisi (adaletli dağilim)\n- Ayni gün içindeki görev yoğunluğu\n\nBu sayede görev dağilimi daha dengeli ve adil hale getirilir.",
            isImportant: false,
            updatedAt: new Date().toISOString()
        },
        {
            id: 4,
            text: "### 📢 DUYURU 4: Bildirim ve Devralma Süreci\n\nPazar yeri süreci artik daha hizli:\n1. Talep oluşturulur\n2. Uygun kişilere bildirim gider\n3. Bir kullanici talebi kabul eder\n4. İşlem aninda gerçekleşir ve puanlar güncellenir\n\nTüm süreç profilinizden takip edilebilir.",
            isImportant: false,
            updatedAt: new Date().toISOString()
        },
        {
            id: 5,
            text: "### 📢 DUYURU 5: Önemli Bilgilendirme\n\n- Ayni görev için yalnizca bir aktif talep oluşturabilirsiniz\n- Pazar yerinden alinan görevler aninda kesinleşir\n- Kendi oluşturduğunuz talepleri dilediğiniz zaman iptal edebilirsiniz",
            isImportant: true,
            updatedAt: new Date().toISOString()
        },
        {
            id: 6,
            text: "### 🛒 Pazar Yeri (Açik Görevler) Kullanim Kilavuzu\n\nSinav görevlendirme sisteminde yer alan **Pazar Yeri (Açik Görevler)** sekmesi, hocalarimizin kendi aralarinda görev devri yapmalarini kolaylaştirmak için tasarlanmiştir.\n\n**Pazar Yeri Nasil Çalişir?**\n1. **Görev Paylaşimi:** Bir hoca, \"Yerime Biri Lazim\" butonuna basarak görevini Pazar Yeri'ne birakabilir.\n2. **Görev Almak:** Başka bir hoca, Pazar Yeri'nde listelenen bir görevi \"Görevi Al\" butonuna basarak aninda üstlenebilir.\n3. **Gizleme:** İlgilenmediğiniz görevleri \"Reddet\" butonu ile listenizden gizleyebilirsiniz.\n\n[Açik Görevleri Şimdi İnceleyin]({{MARKET_LINK}})",
            isImportant: true,
            updatedAt: new Date().toISOString()
        },
        {
            id: 7,
            text: "### 📢 Manuel Yerine Atama Hakkinda\n\nSistem üzerinden otomatik talep oluşturmanin yani sira, dilerseniz yerinize geçecek kişiyi manuel olarak da seçebilirsiniz.\n\nBunun için:\n\n**Personel listesi üzerinden**\nveya\n**Sistem içinde ilgili kişinin adina tiklayarak**\n\n“Yerine Ata” seçeneğini kullanabilirsiniz.\n\nSeçtiğiniz kişinin müsait olmasi durumunda atama işlemini başlatabilirsiniz.",
            isImportant: true,
            updatedAt: new Date().toISOString()
        },
        {
            id: 8,
            text: "### 🛒 Pazar Yeri Süreç Güncellemesi\n\nArtik pazar yerinden (\"Açik Görevler\") bir görev devralmak çok daha kolay! Bir görevi kabul ettiğinizde, devreden kişinin onayina gerek kalmadan işlem aninda gerçekleşecek ve görev profilinize eklenecektir.\n\n[Açik Görevleri Şimdi İnceleyin]({{MARKET_LINK}})",
            isImportant: true,
            updatedAt: new Date().toISOString()
        },
        {
            id: 9,
            text: "### 🔄 Önemli: Takas ve Devir Süreci Güncellendi!\n\nArtik gözetmenler arasindaki görev takaslari ve devirleri için **yönetici onayi gerekmemektedir.**\n\nİşleyiş:\n1. Diğer hoca ile anlaştiğinizda (Direct Swap) veya Pazar Yeri'nden bir görev aldiğinizda işlem **aninda** gerçekleşir.\n2. Puanlar ve görev listeleri otomatik olarak güncellenir.\n3. Süreci hizlandirmak için yönetici bekleme aşamasi tamamen kaldirilmiştir.\n\nİyi görevler dileriz.",
            isImportant: true,
            updatedAt: new Date().toISOString()
        }
    ];

    defaultAnnouncements.forEach(def => {
        const existingIdx = DB.announcements.findIndex(a => a.id === def.id);
        if (existingIdx !== -1) {
            // Mevcut duyuruyu güncelle (Örn: Onay süreci kisimlari değiştiği için)
            DB.announcements[existingIdx] = def;
        } else {
            DB.announcements.push(def);
        }
    });

    // Sinav Türleri Başlatma
    if (!DB.examTypes || !Array.isArray(DB.examTypes) || DB.examTypes.length === 0) {
        DB.examTypes = ['Vize', 'Final', 'Bütünleme', 'Ek Sinav', 'Mazeret', 'Tercih Günü', 'Diğer'];
    }

    if (!DB.templates) {
        DB.templates = {
            swap_request: "Merhaba {alici_adi},\n\n{tarih} tarihindeki {sinav_adi} sinavimdaki görevimi seninle takas etmek istiyorum. Onay verirsen yöneticiye bildireceğim.\n\n🌐 Sisteme Giriş: {site_url}\n\nİyi çalişmalar,\n{gonderen_adi}",
            assignment_email_subject: "📅 Yeni Gözetmenlik Görevi: {sinav_adi} | {tarih}",
            assignment_email_body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px; border-radius: 10px;">
  <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px;">&#128197; Yeni Gözetmenlik Görevi</h1>
    <p style="color: #c4b5fd; margin: 8px 0 0 0; font-size: 14px;">GTU Matematik Bölümü - Gözetmenlik Sistemi</p>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 15px; color: #374151;">Sayin <strong>{personel_adi} Hocam</strong>,</p>
    <p style="font-size: 15px; color: #374151; line-height: 1.6;">Aşağida belirtilen sinava <strong>gözetmen</strong> olarak atanmişsiniz. Lütfen tarih ve saati not aliniz.</p>
    <div style="background: #f8f7ff; border-left: 4px solid #4f46e5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
        <tr><td style="padding: 8px 0; font-weight: bold; color: #6d28d9; width: 140px;">&#128218; Sinav Adi</td><td style="padding: 8px 0;"><strong>{sinav_adi}</strong></td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #6d28d9;">&#128100; Dersi Veren</td><td style="padding: 8px 0;">{dersi_veren}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #6d28d9;">&#128197; Tarih</td><td style="padding: 8px 0;">{tarih}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #6d28d9;">&#128336; Saat</td><td style="padding: 8px 0;">{saat}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #6d28d9;">&#127979; Derslik</td><td style="padding: 8px 0;">{derslik}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #6d28d9;">&#9201; Süre</td><td style="padding: 8px 0;">{sure} dakika</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #6d28d9;">&#128101; Gözetmenler</td><td style="padding: 8px 0;">{gozetmenler}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #6d28d9;">&#11088; Puan</td><td style="padding: 8px 0;"><strong style="color: #4f46e5;">{puan}</strong></td></tr>
      </table>
    </div>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{site_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);">
        🌐 Gözetmenlik Sistemine Giriş Yap
      </a>
      <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">Doğrudan bağlanti: <a href="{site_url}" style="color: #4f46e5; word-break: break-all;">{site_url}</a></p>
    </div>
    <div style="background: #fefce8; border: 1px solid #fde68a; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">&#9888;&#65039; <strong>Görev Değişikliği Yapmak İçin:</strong></p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #78350f; line-height: 1.6;">Görevinizde değişiklik yapmak istediğinizde sisteme (<a href="{site_url}" style="color: #92400e; font-weight: bold; text-decoration: underline;">{site_url}</a>) giriş yaparak <strong>Profilim</strong> sekmesinden uygun bir kişiyi kendiniz araştirip, <strong>Takas Teklifi Gönder</strong> veya <strong>Görevi Pazar Yeri'ne Birak</strong> seçeneğini kullanarak değişikliği kendiniz gerçekleştirebilirsiniz. Herhangi bir yönetici onayina gerek yoktur.</p>
    </div>
    <p style="font-size: 13px; color: #9ca3af; margin-top: 30px;">Bu mesaj GTU Matematik Bölümü Gözetmenlik Sistemi tarafindan otomatik olarak gönderilmiştir.<br>Sistem Adresi: <a href="{site_url}" style="color: #6366f1;">{site_url}</a></p>
  </div>
</div>`,
            update_email_subject: "🔄 Görev Güncellendi: {sinav_adi} | {tarih}",
            update_email_body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px; border-radius: 10px;">
  <div style="background: linear-gradient(135deg, #d97706, #f59e0b); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px;">&#128260; Görev Güncelleme Bildirimi</h1>
    <p style="color: #fef3c7; margin: 8px 0 0 0; font-size: 14px;">GTU Matematik Bölümü - Gözetmenlik Sistemi</p>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 15px; color: #374151;">Sayin <strong>{personel_adi} Hocam</strong>,</p>
    <p style="font-size: 15px; color: #374151; line-height: 1.6;">Atandiğiniz sinavda bazi bilgiler <strong>güncellenmiştir</strong>. Ayrintilari aşağida bulabilirsiniz.</p>
    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
        <tr><td style="padding: 8px 0; font-weight: bold; color: #b45309; width: 140px;">&#128218; Sinav Adi</td><td style="padding: 8px 0;"><strong>{sinav_adi}</strong></td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #b45309;">&#128100; Dersi Veren</td><td style="padding: 8px 0;">{dersi_veren}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #b45309;">&#128197; Tarih</td><td style="padding: 8px 0;">{tarih}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #b45309;">&#128336; Saat</td><td style="padding: 8px 0;">{saat}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #b45309;">&#127979; Derslik</td><td style="padding: 8px 0;">{derslik}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #b45309;">&#9201; Süre</td><td style="padding: 8px 0;">{sure} dakika</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #b45309;">&#128101; Gözetmenler</td><td style="padding: 8px 0;">{gozetmenler}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #b45309;">&#11088; Puan</td><td style="padding: 8px 0;"><strong style="color: #d97706;">{puan}</strong></td></tr>
      </table>
    </div>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{site_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #d97706, #f59e0b); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.3);">
        🌐 Güncel Programi İncele
      </a>
      <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">Doğrudan bağlanti: <a href="{site_url}" style="color: #d97706; word-break: break-all;">{site_url}</a></p>
    </div>
    <div style="background: #fefce8; border: 1px solid #fde68a; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">&#9888;&#65039; <strong>Görev Değişikliği Yapmak İçin:</strong></p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #78350f; line-height: 1.6;">Görevinizde değişiklik yapmak istediğinizde sisteme (<a href="{site_url}" style="color: #92400e; font-weight: bold; text-decoration: underline;">{site_url}</a>) giriş yaparak <strong>Profilim</strong> sekmesinden uygun bir kişiyi kendiniz araştirip, <strong>Takas Teklifi Gönder</strong> veya <strong>Görevi Pazar Yeri'ne Birak</strong> seçeneğini kullanarak değişikliği kendiniz gerçekleştirebilirsiniz. Herhangi bir yönetici onayina gerek yoktur.</p>
    </div>
    <p style="font-size: 13px; color: #9ca3af; margin-top: 30px;">Bu mesaj GTU Matematik Bölümü Gözetmenlik Sistemi tarafindan otomatik olarak gönderilmiştir.<br>Sistem Adresi: <a href="{site_url}" style="color: #d97706;">{site_url}</a></p>
  </div>
</div>`,
            cancel_email_subject: "❌ Görev İptal Edildi: {sinav_adi} | {tarih}",
            cancel_email_body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px; border-radius: 10px;">
  <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px;">&#10060; Görev İptal Edildi</h1>
    <p style="color: #fee2e2; margin: 8px 0 0 0; font-size: 14px;">GTU Matematik Bölümü - Gözetmenlik Sistemi</p>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 15px; color: #374151;">Sayin <strong>{personel_adi} Hocam</strong>,</p>
    <p style="font-size: 15px; color: #374151; line-height: 1.6;">Aşağida belirtilen sinavdaki gözetmenlik göreviniz <strong>iptal edilmiştir</strong>.</p>
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
        <tr><td style="padding: 8px 0; font-weight: bold; color: #dc2626; width: 140px;">&#128218; Sinav Adi</td><td style="padding: 8px 0;"><strong>{sinav_adi}</strong></td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #dc2626;">&#128100; Dersi Veren</td><td style="padding: 8px 0;">{dersi_veren}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #dc2626;">&#128197; Tarih</td><td style="padding: 8px 0;">{tarih}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #dc2626;">&#128336; Saat</td><td style="padding: 8px 0;">{saat}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #dc2626;">&#127979; Derslik</td><td style="padding: 8px 0;">{derslik}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold; color: #dc2626;">&#9201; Süre</td><td style="padding: 8px 0;">{sure} dakika</td></tr>
      </table>
    </div>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{site_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 15px;">
        🌐 Sisteme Giriş Yap & Görevlerimi Gör
      </a>
      <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">Bağlanti: <a href="{site_url}" style="color: #4f46e5; word-break: break-all;">{site_url}</a></p>
    </div>
    <p style="font-size: 13px; color: #9ca3af; margin-top: 30px;">Bu mesaj GTU Matematik Bölümü Gözetmenlik Sistemi tarafindan otomatik olarak gönderilmiştir.<br>Sistem Adresi: <a href="{site_url}" style="color: #6366f1;">{site_url}</a></p>
  </div>
</div>`
        };
    }
    if (!DB.emailSettings) {
        DB.emailSettings = {
            enabled: false,
            provider: 'smtpjs',
            smtpToken: '',
            apiEndpoint: '',
            fromEmail: 'noreply@gtu.edu.tr'
        };
    }

    // Auto-match lecturers for existing exams based on courseLecturers map
    if (DB.exams && Array.isArray(DB.exams)) {
        let changed = false;
        DB.exams.forEach(ex => {
            if (!ex.lecturer || ex.lecturer === "-" || ex.lecturer === "") {
                // Fuzzy/Partial matching
                const entry = Object.entries(DB.courseLecturers).find(([k,v]) => {
                    const examName = (ex.name || "").toLowerCase();
                    const courseKey = k.toLowerCase();
                    return examName === courseKey || examName.includes(courseKey) || courseKey.includes(examName);
                });
                const mapped = entry ? entry[1] : null;

                if (mapped) {
                    ex.lecturer = mapped;
                    changed = true;
                }
            }
        });
        if (changed) saveToLocalStorage();
    }

    processTercihGunleri2026(); // 2026 Tercih Günleri Görevlerini otomatik işleyip ekle
    processAgustos2026Vizeler(); // Ağustos 2026 Vize (PHYS113/114 & MATH111/112) sinavlarini otomatik işleyip ekle

    initNavigation();
    initUI();
    applyTheme(); // Theme on load
    renderProfile();
    updateRequestBadge(); // Update badge on load
    updateAnnouncementBadge(); // New announcement badge
    updateMarketplaceBadge(); // Marketplace badge
    updateNotificationBadge(); // Notification badge
    updateMessageBadge(); // Hoca mesaji rozeti
    updateFeedbackBadge(); // Öneri ve şikayet rozeti
    loadStaffSelects(); // Personel seçim dropdownlarini yükle
    updateDraftBanner(); // Taslak Modu Banner'i Güncelle
    if (typeof updateUndoUI === 'function') updateUndoUI(); // Undo UI

    // Günlük otomatik yedeklemeyi tetikle (arayüz açildiktan 2 saniye sonra)
    setTimeout(checkAndPerformDailyBackup, 2000);
    // Gece yarisi dönümü ihtimaline karşi her saat başi tekrar kontrol et
    setInterval(checkAndPerformDailyBackup, 60 * 60 * 1000);

    // 🔌 Firebase çevrimdişi senkronizasyon dinleyicisini başlat
    if (typeof initOfflineSyncListener === 'function') {
        initOfflineSyncListener();
    }

    // 🔄 PERİYODİK OTOMATİK SENKRONİZASYON
    // Her 2 dakikada bir Firebase'den kontrol et.
    // Başka bir kullanici değişiklik yaptiysa otomatik güncelle ve yedekle.
    startPeriodicSync();
}

/**
 * Her 2 dakikada bir Firebase'den veri çekip yerel veriyle karşilaştirir.
 * Değişiklik varsa: DB güncellenir, ekran yenilenir, snapshot kaydedilir.
 * Değişiklik yoksa: Hiçbir şey yapilmaz (sessiz).
 */
function startPeriodicSync() {
    const SYNC_INTERVAL_MS = 5 * 1000; // 5 saniye (Aktif Canli Senkronizasyon)
    const API_URL_SYNC = typeof API_URL !== 'undefined' ? API_URL :
        'https://gtumath-db-default-rtdb.europe-west1.firebasedatabase.app/gizli_yol_gtu_admin_data.json';

    async function checkForUpdates() {
        // Çevrimdişiysa veya şu an kayit yapiliyorsa atla
        if (!navigator.onLine) return;
        if (typeof _isSyncing !== 'undefined' && _isSyncing) return;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(API_URL_SYNC + '?t=' + Date.now(), {
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) return;
            const remoteData = await response.json();
            if (!remoteData || !Array.isArray(remoteData.staff)) return;

            // Değişiklik kontrolü: Sinav, personel, kisit ve talep sayilarini karşilaştir
            const localExamCount     = (DB.exams     || []).length;
            const localStaffCount    = (DB.staff     || []).length;
            const localRequestCount  = (DB.requests  || []).length;
            const localConstraintStr = JSON.stringify(DB.constraints || {});

            const remoteExamCount     = (remoteData.exams     || []).length;
            const remoteStaffCount    = (remoteData.staff     || []).length;
            const remoteRequestCount  = (remoteData.requests  || []).length;
            const remoteConstraintStr = JSON.stringify(remoteData.constraints || {});

            const hasChanges =
                JSON.stringify(DB.exams || []) !== JSON.stringify(remoteData.exams || []) ||
                JSON.stringify(DB.staff || []) !== JSON.stringify(remoteData.staff || []) ||
                JSON.stringify(DB.requests || []) !== JSON.stringify(remoteData.requests || []) ||
                JSON.stringify(DB.constraints || {}) !== JSON.stringify(remoteData.constraints || {});

            if (!hasChanges) {
                console.log('🔄 Periyodik senkronizasyon: Değişiklik yok.');
                return;
            }

            console.log('📥 Periyodik senkronizasyon: Değişiklik algilandi! Güncelleniyor...', {
                sinav: `${localExamCount} → ${remoteExamCount}`,
                personel: `${localStaffCount} → ${remoteStaffCount}`,
                talep: `${localRequestCount} → ${remoteRequestCount}`,
                kisitDeğişti: localConstraintStr !== remoteConstraintStr
            });

            // Yerel lecturers ve courseLecturers korunarak uzak veriyi birleştir
            if (!remoteData.lecturers || remoteData.lecturers.length === 0) {
                remoteData.lecturers = DB.lecturers;
            }
            if (!remoteData.courseLecturers || Object.keys(remoteData.courseLecturers).length === 0) {
                remoteData.courseLecturers = DB.courseLecturers;
            }

            DB = remoteData;
            if (!DB.constraints) DB.constraints = {};
            if (!DB.requests) DB.requests = [];

            // localStorage güncelle + snapshot kaydet
            try { localStorage.setItem(typeof DB_KEY !== 'undefined' ? DB_KEY : 'gozetmenlik_db_v25', JSON.stringify(DB)); } catch(e) {}
            if (typeof saveAutoSnapshot === 'function') {
                saveAutoSnapshot(DB, 'Periyodik Senkronizasyon');
            }

            // Ekranlari sessizce yenile (kullaniciyi rahatsiz etmeden)
            if (typeof renderExams       === 'function') renderExams();
            if (typeof renderStaff       === 'function') renderStaff();
            if (typeof renderSchedule    === 'function') renderSchedule();
            if (typeof renderDashboard   === 'function') renderDashboard();
            if (typeof renderSwapRequests=== 'function') renderSwapRequests();
            if (typeof updateRequestBadge=== 'function') updateRequestBadge();
            if (typeof updateMarketplaceBadge === 'function') updateMarketplaceBadge();

            // Kullaniciya sessiz bildirim (toast — alert değil)
            if (typeof window.showToast === 'function') {
                window.showToast('🔄 Başka bir kullanicinin değişiklikleri senkronize edildi.', 'success');
            }

        } catch (e) {
            // Hata durumunda sessizce atla, bir sonraki döngüde tekrar denenecek
            console.warn('⚠️ Periyodik senkronizasyon hatasi (önemsiz):', e.message);
        }
    }

    // İlk kontrol: Sayfa açildiktan 30 saniye sonra (başlangiç yüklemesiyle çakişmasin)
    setTimeout(checkForUpdates, 5 * 1000);

    // Sonraki kontroller: Her 2 dakikada bir
    setInterval(checkForUpdates, SYNC_INTERVAL_MS);

    console.log('⏱️ Periyodik senkronizasyon başlatildi (her 2 dakikada bir).');
}


/**
 * GÜNLÜK OTOMATİK YEDEKLEME SİSTEMİ
 * Yönetici (Admin) olarak giriş yapildiğinda ve o gün henüz yedek indirilmemişse otomatik olarak JSON dosyasini indirir.
 */
function downloadBackupFile(prefix = 'Yedek') {
    if (!DB) return;
    const now = new Date();
    const dStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;
    const dataStr = JSON.stringify(DB, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gozetmenlik_${prefix}_${dStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
window.downloadBackupFile = downloadBackupFile;

function checkAndPerformDailyBackup() {
    if (sessionStorage.getItem('isAdmin') !== 'true') return;
    if (!DB || (!DB.staff && !DB.exams)) return;

    // Otomatik Anlik Kasa Snapshot'i al
    if (typeof saveAutoSnapshot === 'function') {
        saveAutoSnapshot(DB, 'Admin Girişi Otomatik Yedeği');
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const lastBackupDate = localStorage.getItem('last_auto_backup_date');

    if (lastBackupDate !== todayStr) {
        console.log(`⏳ Günlük otomatik yedekleme başlatiliyor: ${todayStr}`);
        try {
            downloadBackupFile('Otomatik_Gunluk_Yedek');
            localStorage.setItem('last_auto_backup_date', todayStr);

            if (typeof window.showToast === 'function') {
                window.showToast(`📅 Günlük Otomatik Yedek İndirildi (${todayStr})`, 'success');
            }
            console.log(`✅ Günlük otomatik yedek başariyla indirildi (${todayStr}).`);
        } catch (e) {
            console.error("Otomatik yedek alma hatasi:", e);
        }
    }

    // Ayrica yaklaşan sinavlarin hatirlatmalarini kontrol et ve gönder
    if (typeof checkAndSendExamReminders === 'function') {
        checkAndSendExamReminders().catch(e => console.error("Hatirlatma kontrol hatasi:", e));
    }

}

/**
 * 2026 TERCİH GÜNLERİ ETKİNLİĞİ GÖREVLERİNİ SİSTEME İŞLEME
 * Kongre Merkezi Fuaye Alani Görevleri (10:30 - 16:00 / 330 Dakika)
 */
function processTercihGunleri2026() {
    if (!DB || !DB.exams || !DB.staff) return;

    // Daha önce eklenmiş mi kontrol et (23.07.2026 tarihli Tercih Günü görevi var mi)
    const alreadyAdded = DB.exams.some(ex => (ex.name || "").includes("Tercih") && ex.date === "2026-07-23");
    if (alreadyAdded) return;

    console.log("⏳ 2026 Tercih Günleri Etkinliği görevleri sisteme işleniyor...");

    const normalize = (str) => (str || "").toLocaleLowerCase('tr-TR')
        .replace(/prof\.|dr\.|öğr\.|üyesi|doç\.|arş\.|gör\.|[\.\(\)]/g, '')
        .replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/i/g, 'i')
        .replace(/\s+/g, ' ').trim().toUpperCase();

    const tasks = [
        { date: "2026-07-23", lecturer: "Dr. Fatih YETGİN", proctorKey: "Şeyma YAŞAR" },
        { date: "2026-07-24", lecturer: "Dr. Yasemin BÜYÜKÇOLAK", proctorKey: "Cansu ŞAHİN" },
        { date: "2026-07-25", lecturer: "Doç. Dr. Ayten KOÇ", proctorKey: "Yasin TURAN" },
        { date: "2026-07-27", lecturer: "Dr. Öğr. Üyesi Tuğba MAHMUTÇEPOĞLU", proctorKey: "Aysel ŞAHİN" },
        { date: "2026-07-28", lecturer: "Dr. Öğr. Üyesi Keremcan DOĞAN", proctorKey: "Çağla ÖZATAR" },
        { date: "2026-07-29", lecturer: "Dr. Saliha DEMİRBÜKEN", proctorKey: "Aslihan GÜR" },
        { date: "2026-07-30", lecturer: "Doç. Dr. Gülşen ULUCAK", proctorKey: "Serdal ÇÖMLEKCİ" },
        { date: "2026-07-31", lecturer: "Doç. Dr. Hülya ÖZTÜRK", proctorKey: "Oğuzhan SELÇUK" },
        { date: "2026-08-01", lecturer: "Dr. Öğr. Üyesi Hadi ALİZADEH", proctorKey: "Ezgi ÖZTEKİN" },
        { date: "2026-08-02", lecturer: "Doç. Dr. Fatma KARAOĞLU CEYHAN", proctorKey: "Ömer DEMİR" }
    ];

    const baseId = Date.now();
    let count = 0;

    tasks.forEach((item, idx) => {
        // Görevliyi DB.staff içinde ismine veya soyismine göre güvenilir şekilde bul
        const matchedStaff = DB.staff.find(s => {
            const normStaff = normalize(s.name);
            const normKey = normalize(item.proctorKey);
            if (item.proctorKey.includes("Serdal") && (normStaff.includes("SERDAL") || normStaff.includes("COMLEK"))) return true;
            return normStaff.includes(normKey);
        });

        if (matchedStaff) {
            const examId = baseId + idx + 500;
            const newTask = {
                id: examId,
                name: "2026 Tercih Günleri Etkinliği",
                date: item.date,
                time: "10:30",
                duration: 330,
                type: "Tercih Günü",
                isNonExam: true,
                location: "Kongre Merkezi Fuaye Alani",
                capacity: 1,
                lecturer: item.lecturer,
                proctorId: matchedStaff.id,
                proctorIds: [matchedStaff.id],
                proctorName: matchedStaff.name,
                isDraft: false
            };

            const dObj = typeof getSafeDate === 'function' ? getSafeDate(newTask.date, newTask.time) : new Date(`${newTask.date}T${newTask.time}`);
            if (!isNaN(dObj.getTime())) {
                if (typeof calculateScore === 'function') newTask.score = calculateScore(dObj, newTask.duration, examId);
                if (typeof getKatsayi === 'function') newTask.katsayi = getKatsayi(dObj, newTask.duration, examId);
            }

            DB.exams.push(newTask);
            count++;
        } else {
            console.warn("Tercih günleri için personel bulunamadi:", item.proctorKey);
        }
    });

    if (count > 0) {
        if (typeof recalculateAllScores === 'function') recalculateAllScores();
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
        if (typeof logAction === 'function') logAction('system', 'Görev Eşleşmesi', `2026 Tercih Günleri kapsaminda ${count} adet görev (330'ar dk) işlendi.`);
        
        setTimeout(() => {
            if (typeof window.showToast === 'function') {
                window.showToast(`✨ 2026 Tercih Günleri (${count} Görev - 330 Dk) Sisteme İşlendi!`, 'success');
            }
        }, 1200);
        console.log(`✅ 2026 Tercih Günleri Etkinliği kapsaminda ${count} görev sisteme başariyla işlendi!`);
    }
}

/**
 * AĞUSTOS 2026 VİZE SINAV PROGRAMINI SİSTEME İŞLEME (PHYS113, PHYS114, MATH111, MATH112)
 * Not: Tercih Günleri daha önce işlendiği için burada tekrar edilmemiştir.
 */
function processAgustos2026Vizeler() {
    if (!DB || !DB.exams || !DB.staff) return;

    // Daha önce eklenip eklenmediğini kontrol et (10.08.2026 tarihli MATH111 veya 06.08.2026 PHYS 114 sinavi)
    const alreadyAdded = DB.exams.some(ex => (ex.name || "").toUpperCase().includes("MATH111") && ex.date === "2026-08-10");
    if (alreadyAdded) return;

    console.log("⏳ Ağustos 2026 Vize sinavlari sisteme işleniyor...");

    const normalize = (str) => (str || "").toLocaleLowerCase('tr-TR')
        .replace(/prof\.|dr\.|öğr\.|üyesi|doç\.|arş\.|gör\.|[\.\(\)]/g, '')
        .replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g')
        .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/i/g, 'i')
        .replace(/\s+/g, ' ').trim().toUpperCase();

    const newExams = [
        {
            name: "PHYS 114 - Physics for Natural Sciences II",
            date: "2026-08-06",
            time: "18:00",
            duration: 120,
            location: "Elektronik Müh. Z02+Z03+Z09 (Derslik ile ilgili Ek Bilgilendirme yapilacaktir.)",
            capacity: "200",
            proctorKeys: ["Yasin Turan"]
        },
        {
            name: "MATH 112 - Analysis II",
            date: "2026-08-07",
            time: "10:00",
            duration: 120,
            location: "Merkez Amfiler",
            capacity: "200",
            proctorKeys: ["Aslihan Gür", "Aysel Şahin", "Cansu Şahin", "Ezgi Öztekin", "Ömer Demir", "Şeyma Yaşar"]
        },
        {
            name: "PHYS113 Physics for Natural Sciences I",
            date: "2026-08-05",
            time: "18:00",
            duration: 120,
            location: "Elektronik Müh. Z04+Z07+Z09 (Derslik ile ilgili ek bilgilendirme yapilacaktir.)",
            capacity: "200",
            proctorKeys: ["Ezgi Öztekin"]
        },
        {
            name: "MATH111 Mathematical Analysis I",
            date: "2026-08-10",
            time: "18:00",
            duration: 120,
            location: "Elektronik Müh. Z16+Z40+Z42+Z46+Z50",
            capacity: "200",
            proctorKeys: ["Cansu Şahin", "Muhammed Ergen", "Oğuzhan Selçuk", "Serdal Çömlekçi", "Serkan Ayrica"]
        }
    ];

    const baseId = Date.now() + 2000;
    let count = 0;

    newExams.forEach((item, idx) => {
        const matchedStaffIds = [];
        const matchedStaffNames = [];

        item.proctorKeys.forEach(proctorKey => {
            const matchedStaff = DB.staff.find(s => {
                const normStaff = normalize(s.name);
                const normKey = normalize(proctorKey);
                if (proctorKey.toLowerCase().includes("serdal") && (normStaff.includes("SERDAL") || normStaff.includes("COMLEK"))) return true;
                return normStaff.includes(normKey);
            });

            if (matchedStaff) {
                matchedStaffIds.push(matchedStaff.id);
                matchedStaffNames.push(matchedStaff.name);
            } else {
                console.warn("Vize sinavi için personel bulunamadi:", proctorKey);
            }
        });

        if (matchedStaffIds.length > 0) {
            const examId = baseId + idx + 100;
            const newTask = {
                id: examId,
                name: item.name,
                date: item.date,
                time: item.time,
                duration: item.duration,
                type: "Vize",
                isNonExam: false,
                location: item.location,
                capacity: item.capacity,
                lecturer: "-",
                proctorId: matchedStaffIds[0],
                proctorIds: matchedStaffIds,
                proctorName: matchedStaffNames.join(', '),
                isDraft: false
            };

            const dObj = typeof getSafeDate === 'function' ? getSafeDate(newTask.date, newTask.time) : new Date(`${newTask.date}T${newTask.time}`);
            if (!isNaN(dObj.getTime())) {
                if (typeof calculateScore === 'function') newTask.score = calculateScore(dObj, newTask.duration, examId);
                if (typeof getKatsayi === 'function') newTask.katsayi = getKatsayi(dObj, newTask.duration, examId);
            }

            DB.exams.push(newTask);
            count++;
        }
    });

    if (count > 0) {
        if (typeof recalculateAllScores === 'function') recalculateAllScores();
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
        if (typeof logAction === 'function') logAction('system', 'Görev Eşleşmesi', `Ağustos 2026 programindan ${count} adet vize sinavi (120'şer dk) eklendi.`);
        
        setTimeout(() => {
            if (typeof window.showToast === 'function') {
                window.showToast(`✨ Ağustos 2026 Vize Programi (${count} Sinav) Sisteme İşlendi!`, 'success');
            }
        }, 1800);
        console.log(`✅ Ağustos 2026 Vize Programi kapsaminda ${count} sinav başariyla işlendi!`);
    }
}

/**
 * TASLAK MODU BANNER VE KONTROLLERİ
 */
function updateDraftBanner() {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    let banner = document.getElementById('draft-banner');

    if (!DB.isDraftMode || !isAdmin) {
        if (banner) banner.remove();
        return;
    }

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'draft-banner';
        banner.className = 'draft-banner';
        document.body.appendChild(banner);
    }

    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.5rem;">🛠️</span>
            <div>
                <div style="font-size:0.9rem; font-weight:800; letter-spacing:0.05em;">TASLAK MODU AKTİF</div>
                <div style="font-size:0.7rem; opacity:0.8; font-weight:500;">Yapilan atamalar hocalara bildirilmez.</div>
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <button onclick="handleAIButtonClick()" class="btn-primary" style="background:#8b5cf6; border:1px solid rgba(255,255,255,0.2); box-shadow:0 0 15px rgba(139, 92, 246, 0.4);">✨ AI Optimizasyon</button>
            <button onclick="handlePublishDraft()" class="btn-primary" style="background:#10b981; border:1px solid rgba(255,255,255,0.2); box-shadow:0 0 15px rgba(16, 185, 129, 0.4);">🚀 Taslaği Yayinla</button>
        </div>
    `;
}

window.handleAIButtonClick = function() {
    if (confirm("Atanmamiş tüm sinavlar için AI destekli en adil dağitim yapilacaktir. Onayliyor musunuz?")) {
        const res = runGlobalOptimization();
        alert(`✅ Optimizasyon Tamamlandi!\n\n${res.assigned} sinav başariyla atandi.\n${res.failed} sinav için uygun gözetmen bulunamadi.`);
        renderDashboard();
        renderExams();
        renderSchedule();
    }
};

window.handlePublishDraft = function() {
    const draftCount = DB.exams.filter(e => e.isDraft).length;
    if (draftCount === 0) {
        alert("Yayina alinacak taslak sinav bulunamadi.");
        return;
    }

    if (confirm(`${draftCount} adet sinav yayina alinacak ve ilgili gözetmenlere bildirim gönderilecektir. Devam edilsin mi?`)) {
        const res = publishDraft();
        alert(`🚀 Başarili!\n\n${res.examCount} sinav yayina alindi.\n${res.proctorCount} gözetmene bildirim gönderildi.`);
        updateDraftBanner();
        renderDashboard();
        renderExams();
        renderSchedule();
    }
};


/**
 * Takas onayi için şifre doğrulama yardimcisi.
 * Gözetmenin staffPassword'i varsa modal açar ve doğru şifre girilince resolve eder.
 * staffPassword yoksa doğrudan onay (confirm) alir.
 * @param {string} description - Modalde gösterilecek açiklama
 * @param {object} staff - DB.staff nesnesi
 * @returns {Promise<boolean>}
 */
function confirmWithPassword(description, staff) {
    return new Promise((resolve) => {
        // Şifre yoksa klasik confirm
        if (!staff || !staff.staffPassword) {
            resolve(confirm(description));
            return;
        }

        // Şifre modalini aç
        const modal = document.getElementById('modal-swap-confirm-password');
        const desc  = document.getElementById('swap-confirm-desc');
        const input = document.getElementById('swap-confirm-pass-input');
        const error = document.getElementById('swap-confirm-error');
        const okBtn = document.getElementById('btn-swap-confirm-ok');
        const cancelBtn = document.getElementById('btn-swap-confirm-cancel');

        desc.textContent = description;
        input.value = '';
        error.classList.add('hidden');
        modal.classList.remove('hidden');
        setTimeout(() => input.focus(), 100);

        // Temizleyici
        const cleanup = (result) => {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keypress', onEnter);
            resolve(result);
        };

        const onOk = () => {
            if (isStaffPasswordMatch(staff, input.value)) {
                cleanup(true);
            } else {
                error.classList.remove('hidden');
                input.value = '';
                input.focus();
            }
        };
        const onCancel = () => cleanup(false);
        const onEnter = (e) => { if (e.key === 'Enter') onOk(); };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keypress', onEnter);
    });
}



let currentSort = { key: 'date', dir: 'asc' };
let currentExamTab = 'active';
let currentTimelineDate = new Date().toISOString().split('T')[0];

window.switchExamTab = (tab) => {
    currentExamTab = tab;
    // Update tab buttons
    document.getElementById('btn-exam-tab-active')?.classList.toggle('active', tab === 'active');
    document.getElementById('btn-exam-tab-archive')?.classList.toggle('active', tab === 'archive');
    renderExams();
};

window.updateUndoUI = function() {
    const btnUndo = document.getElementById('btn-undo');
    if (!btnUndo) return;
    
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin || typeof UNDO_STACK === 'undefined' || UNDO_STACK.length === 0) {
        btnUndo.classList.add('hidden');
        return;
    }
    
    const lastAction = UNDO_STACK[UNDO_STACK.length - 1];
    btnUndo.innerHTML = `<span class="icon" style="margin:0; margin-right:4px;">↩️</span>Geri Al: ${lastAction.actionName}`;
    btnUndo.classList.remove('hidden');
};

function initUI() {
    document.getElementById('btn-undo')?.addEventListener('click', () => {
        if (confirm("Son işlemi geri almak istediğinize emin misiniz? Puanlar ve atamalar bir önceki haline dönecek.")) {
            if (typeof undoLastAction === 'function' && undoLastAction()) {
                // Ekranda değişiklikleri yansitmak için listeleri güncelle
                if (typeof renderDashboard === 'function') renderDashboard();
                if (typeof renderExams === 'function') renderExams();
                if (typeof renderSchedule === 'function') renderSchedule();
                if (typeof renderStaff === 'function') renderStaff();
                showToast("İşlem başariyla geri alindi.", "success");
            }
        }
    });

    document.getElementById('btn-add-exam').addEventListener('click', showAddExamModal);
    document.getElementById('btn-manage-types')?.addEventListener('click', () => {
        document.getElementById('modal-manage-types').classList.remove('hidden');
        renderExamTypesList();
    });
    document.getElementById('btn-add-staff').addEventListener('click', showAddStaffModal);
    document.getElementById('btn-modal-cancel').addEventListener('click', hideModal);

    // PDF Export Listeners
    document.getElementById('btn-export-dashboard-pdf')?.addEventListener('click', () => exportToPDF('table-duty-breakdown', 'Dashboard Puan Dağilimi'));
    document.getElementById('btn-export-staff-pdf')?.addEventListener('click', () => exportToPDF('table-staff', 'Personel Listesi'));
    document.getElementById('btn-export-exams-pdf')?.addEventListener('click', () => exportToPDF('table-exams', 'Sinav Listesi'));
    document.getElementById('btn-export-schedule-pdf')?.addEventListener('click', () => {
        let targetId = 'table-schedule';
        let pdfTitle = 'Genel Sinav Programi';
        if (currentScheduleView === 'calendar') {
             // Takvim görünümünde PDF yerine Resim öneriliyor ama opsiyonel olarak resim basariz
             exportElementAsImage(document.getElementById('calendar-grid'), 'Sinav_Programi_Takvim.png');
             return;
        }
        exportToPDF(targetId, pdfTitle);
    });

    document.getElementById('btn-email-settings')?.addEventListener('click', showEmailSettingsModal);
    document.getElementById('btn-email-templates')?.addEventListener('click', showEmailTemplatesModal);
    
    // Theme Toggle
    document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);

    // Audit Log Clear
    document.getElementById('btn-clear-audit')?.addEventListener('click', () => {
        if (confirm('Tüm işlem geçmişi silinecektir. Emin misiniz?')) {
            DB.auditLogs = [];
            saveToLocalStorage();
            renderAuditLogs();
        }
    });
    
    // Choice Modal Listeners
    document.getElementById('btn-choice-no')?.addEventListener('click', () => {
        if (window.resolveChoice) window.resolveChoice(false);
        document.getElementById('modal-choice').classList.add('hidden');
    });
    document.getElementById('btn-choice-yes')?.addEventListener('click', () => {
        if (window.resolveChoice) window.resolveChoice(true);
        document.getElementById('modal-choice').classList.add('hidden');
    });

    // Profile Setup Listeners
    document.getElementById('btn-save-identity')?.addEventListener('click', () => {
        const dropdown = document.getElementById('profile-setup-dropdown');
        const staffId = dropdown.value;
        if (!staffId) return;

        // Şifresi olan profil dropdown'dan seçilemez
        const selectedStaff = DB.staff.find(s => String(s.id) === String(staffId));
        if (selectedStaff && selectedStaff.staffPassword) {
            const errorEl = document.getElementById('profile-password-error');
            if (errorEl) {
                errorEl.textContent = `🔒 "${selectedStaff.name}" profili şifre korumali. Lütfen yukaridaki şifre alanini kullanin.`;
                errorEl.classList.remove('hidden');
            }
            // Şifre inputuna odaklan
            const passInput = document.getElementById('profile-password-login');
            if (passInput) passInput.focus();
            return;
        }

        localStorage.setItem('myStaffId', staffId);
        renderProfile();
        updateNotificationBadge();
    });

    // Profil Şifreli Giriş
    const doProfilePasswordLogin = () => {
        const input = document.getElementById('profile-password-login');
        const errorEl = document.getElementById('profile-password-error');
        const pass = input ? input.value.trim() : '';
        if (!pass) return;

        const matched = DB.staff.find(s => isStaffPasswordMatch(s, pass));
        if (matched) {
            localStorage.setItem('myStaffId', String(matched.id));
            if (errorEl) errorEl.classList.add('hidden');
            renderProfile();
            updateNotificationBadge();
        } else {
            if (errorEl) errorEl.classList.remove('hidden');
            if (input) { input.value = ''; input.focus(); }
        }
    };

    document.getElementById('btn-profile-password-login')?.addEventListener('click', doProfilePasswordLogin);
    document.getElementById('profile-password-login')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doProfilePasswordLogin();
    });

    document.getElementById('btn-change-identity')?.addEventListener('click', () => {
        localStorage.removeItem('myStaffId');
        renderProfile();
        updateNotificationBadge();
    });

    // Profile Tab Listeners
    document.querySelectorAll('#section-profile .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('#section-profile .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('#section-profile .tab-pane').forEach(p => p.classList.add('hidden'));
            const pane = document.getElementById(`tab-${tabId}`);
            if (pane) pane.classList.remove('hidden');

            if (tabId === 'marketplace') renderMarketplace();
            if (tabId === 'notifications') {
                renderNotifications();
                markNotificationsAsRead();
            }
            if (tabId === 'my-timeline') {
                renderMyTimeline();
            }
            if (tabId === 'swap-history') {
                if (typeof renderSwapHistory === 'function') renderSwapHistory();
            }
            if (tabId === 'responsible') {
                clearMessageBadge();
            }
            if (tabId === 'scorecard') {
                if (typeof renderScorecard === 'function') renderScorecard();
            }
        });
    });

    // Kişisel takvim ay nav butonlari
    document.getElementById('btn-my-timeline-prev')?.addEventListener('click', () => {
        myTimelineDate.setMonth(myTimelineDate.getMonth() - 1);
        renderMyTimeline();
    });
    document.getElementById('btn-my-timeline-next')?.addEventListener('click', () => {
        myTimelineDate.setMonth(myTimelineDate.getMonth() + 1);
        renderMyTimeline();
    });

    document.getElementById('btn-prev-month')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('btn-next-month')?.addEventListener('click', () => changeMonth(1));

    document.getElementById('btn-close-exam-detail')?.addEventListener('click', () => {
        document.getElementById('modal-exam-detail').classList.add('hidden');
    });
    document.getElementById('modal-exam-detail')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-exam-detail')) {
            document.getElementById('modal-exam-detail').classList.add('hidden');
        }
    });


    // Profile Constraint Listeners
    document.getElementById('profile-constraint-type')?.addEventListener('change', (e) => {
        const type = e.target.value;
        document.getElementById('profile-constraint-day-group').classList.toggle('hidden', type !== 'day');
        document.getElementById('profile-constraint-date-group').classList.toggle('hidden', type !== 'date');
        const drGroup = document.getElementById('profile-constraint-daterange-group');
        if (drGroup) drGroup.classList.toggle('hidden', type !== 'daterange');
    });

    document.getElementById('form-profile-add-constraint')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleProfileConstraintAdd();
    });

    // Swap Request Form listeners
    document.getElementById('btn-swap-cancel')?.addEventListener('click', () => {
        document.getElementById('modal-swap').classList.add('hidden');
    });

    document.getElementById('form-swap-request')?.addEventListener('submit', (e) => {
        e.preventDefault();
        submitSwapForm();
    });

    document.getElementById('form-confirm-swap')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const requestId = parseInt(document.getElementById('swap-request-id-confirm').value);
        processSwap(requestId, true);
    });

    // Kisit Yönetimi Form Olaylari
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

    // Tablo siralama dinleyicileri
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

    document.getElementById('btn-export-schedule-excel')?.addEventListener('click', () => {
        exportTableToExcel('table-schedule', 'Sinav_Programi.xlsx');
    });

    document.getElementById('btn-export-schedule')?.addEventListener('click', () => {
        const target = currentScheduleView === 'calendar' ? document.getElementById('calendar-grid') : document.querySelector('#schedule-list-view .table-container');
        exportElementAsImage(target, 'Sinav_Programi.png');
    });

    const btnResolveConflicts = document.getElementById('btn-resolve-conflicts');
    if (btnResolveConflicts) {
        btnResolveConflicts.addEventListener('click', () => {
            const result = autoResolveConflicts();
            if (result.message) {
                alert(`✅ ${result.message}`);
            } else {
                let msg = `✅ ${result.resolved} çakişma başariyla giderildi!`;
                if (result.skipped > 0) {
                    msg += `\n⚠️ ${result.skipped} çakişma için uygun yedek gözetmen bulunamadi. Bu sinavlari lütfen manuel olarak düzenleyin.`;
                }
                alert(msg);
            }
            renderExams();
            renderSchedule();
            renderDashboard();
            renderStaff();
        });
    }

    // Snapshot Vault (Yedek Geçmişi & Kurtarma) Modal Yönetimi
    const btnSnapshotVault = document.getElementById('btn-snapshot-vault');
    const modalSnapshotVault = document.getElementById('modal-snapshot-vault');
    const btnCloseVaultModal = document.getElementById('btn-close-vault-modal');
    const btnVaultManualSnapshot = document.getElementById('btn-vault-manual-snapshot');
    const btnVaultDownloadAll = document.getElementById('btn-vault-download-all');

    window.openSnapshotVault = function() {
        if (typeof renderSnapshotVaultList === 'function') renderSnapshotVaultList();
        const modal = document.getElementById('modal-snapshot-vault');
        if (modal) modal.classList.remove('hidden');
    };

    window.adminGoToStaffProfile = function(staffId) {
        if (!staffId) return;
        localStorage.setItem('myStaffId', String(staffId));
        const btnProfile = document.getElementById('btn-profile');
        if (btnProfile) btnProfile.click();
        if (typeof renderProfile === 'function') renderProfile();
        const staff = (DB.staff || []).find(s => String(s.id) === String(staffId));
        if (typeof window.showToast === 'function') {
            window.showToast(`👑 Yönetici Modu: ${staff ? staff.name : 'Personel'} profili açildi.`, 'info');
        }
    };

    if (btnSnapshotVault && modalSnapshotVault) {
        btnSnapshotVault.addEventListener('click', () => {
            window.openSnapshotVault();
        });
    }

    if (btnCloseVaultModal && modalSnapshotVault) {
        btnCloseVaultModal.addEventListener('click', () => {
            modalSnapshotVault.classList.add('hidden');
        });
        modalSnapshotVault.addEventListener('click', (e) => {
            if (e.target === modalSnapshotVault) modalSnapshotVault.classList.add('hidden');
        });
    }

    if (btnVaultManualSnapshot) {
        btnVaultManualSnapshot.addEventListener('click', () => {
            if (typeof saveAutoSnapshot === 'function') {
                saveAutoSnapshot(DB, 'Yönetici Manuel Yedek');
                renderSnapshotVaultList();
                if (typeof window.showToast === 'function') {
                    window.showToast('📸 Anlik yedek başariyla alindi!', 'success');
                } else {
                    alert('✓ Anlik yedek başariyla alindi!');
                }
            }
        });
    }

    if (btnVaultDownloadAll) {
        btnVaultDownloadAll.addEventListener('click', () => {
            downloadBackupFile('Manuel_Yedek');
        });
    }

    // Yedekleme ve Geri Yükleme (JSON)
    const btnBackup = document.getElementById('btn-backup-system');
    if (btnBackup) {
        btnBackup.addEventListener('click', () => {
            downloadBackupFile('Kullanici_Yedegi');
        });
    }

    const btnResetExams = document.getElementById('btn-reset-exams');
    if (btnResetExams) {
        btnResetExams.addEventListener('click', () => {
            if (confirm("DİKKAT: Mevcut tüm sinav programi silinecek!\n\nAncak hocalarin birikmiş puanlari ve görev sayilari KORUNACAKTIR. Bu işlem vize sonu, final öncesi temizlik için kullanilir. Devam etmek istiyor musunuz?")) {
                resetExamsButKeepScores();
                renderExams();
                renderSchedule();
                renderDashboard();
                renderStaff();
                alert("✓ Sinav programi başariyla sifirlandi. Puanlar korundu.");
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
                reader.onload = async (event) => {
                    try {
                        const importedDB = JSON.parse(event.target.result);
                        if (importedDB && importedDB.staff && importedDB.exams) {
                            if (confirm("Mevcut tüm veriler silinecek ve seçilen yedeğe dönülecek. Onayliyor musunuz?")) {
                                DB = importedDB;
                                saveToLocalStorage();
                                
                                // Admin girişi ise reload öncesi sunucuya yazmayi BEKLE (reload işlemi fetch'i iptal etmesin diye)
                                if (sessionStorage.getItem('isAdmin') === 'true') {
                                    try {
                                        await saveToBackend();
                                    } catch(e) {
                                        console.error("Yedek sunucuya gönderilirken hata oluştu:", e);
                                    }
                                }
                                
                                location.reload();
                            }
                        } else {
                            alert("Hata: Geçersiz yedek dosyasi!");
                        }
                    } catch (err) {
                        alert("Hata: Dosya okunamadi!");
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        });
    }

    function renderSnapshotVaultList() {
        const container = document.getElementById('vault-snapshots-list');
        if (!container) return;
        const snapshots = typeof getSavedSnapshots === 'function' ? getSavedSnapshots() : [];
        if (!snapshots || snapshots.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 30px;">Henüz kaydedilmiş anlik görüntü bulunmuyor.<br><small style="opacity: 0.7;">Site açildiğinda veya işlem yapildiğinda otomatik oluşur.</small></div>`;
            return;
        }
        
        let html = '';
        snapshots.forEach((snap, idx) => {
            const isLatest = idx === 0;
            html += `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid ${isLatest ? '#0284c7' : 'rgba(255,255,255,0.1)'}; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                <div>
                    <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                        <span>🕒 ${snap.displayDate}</span>
                        ${isLatest ? '<span style="background: #0284c7; color: white; font-size: 11px; padding: 2px 6px; border-radius: 4px;">En Güncel</span>' : ''}
                        <span style="font-size: 12px; color: #94a3b8; font-weight: normal;">(${snap.source || 'Otomatik'})</span>
                    </div>
                    <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px;">
                        📋 <strong>${snap.examCount}</strong> Sinav &nbsp;|&nbsp; 👥 <strong>${snap.staffCount}</strong> Personel &nbsp;|&nbsp; 🔄 <strong>${snap.requestCount || 0}</strong> Talep
                    </div>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button onclick="window.handleRestoreFromVault(${snap.id})" style="background: #16a34a; color: white; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-weight: 600;">↩️ Bu Yedeğe Dön</button>
                    <button onclick="window.handleDownloadVaultItem(${snap.id})" style="background: #475569; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer;" title="JSON Olarak İndir">💾 İndir</button>
                    <button onclick="window.handleDeleteVaultItem(${snap.id})" style="background: #dc2626; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer;" title="Kaydi Sil">🗑️</button>
                </div>
            </div>
            `;
        });
        container.innerHTML = html;
    }
    window.renderSnapshotVaultList = renderSnapshotVaultList;

    window.handleRestoreFromVault = async function(id) {
        if (confirm("⚠️ Bu yedeğe geri dönmek istediğinize emin misiniz?\n\nMevcut veriler bu yedeğin verileriyle güncellenecek ve sistem yenilenecektir.")) {
            try {
                const restored = restoreFromSnapshot(id);
                if (sessionStorage.getItem('isAdmin') === 'true') {
                    try { await saveToBackend(); } catch(e) {}
                }
                alert(`✓ ${restored.displayDate} tarihli yedeğe başariyla dönüldü! Sayfa yenileniyor...`);
                location.reload();
            } catch(e) {
                alert("Hata: " + e.message);
            }
        }
    };

    window.handleDownloadVaultItem = function(id) {
        const vault = typeof getSavedSnapshots === 'function' ? getSavedSnapshots() : [];
        const snap = vault.find(s => s.id === id);
        if (snap && snap.data) {
            const dataStr = JSON.stringify(snap.data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            const cleanDate = (snap.displayDate || '').replace(/[\s\.:]+/g, '_');
            link.download = `Gozetmenlik_Kasa_Yedek_${cleanDate}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    window.handleDeleteVaultItem = function(id) {
        if (confirm("Bu anlik görüntüyü kasadan silmek istediğinize emin misiniz?")) {
            if (typeof deleteSnapshot === 'function') {
                deleteSnapshot(id);
                renderSnapshotVaultList();
            }
        }
    };

    const btnExportDashboard = document.getElementById('btn-export-dashboard');
    if (btnExportDashboard) {
        btnExportDashboard.addEventListener('click', () => {
             exportElementAsImage(document.getElementById('dashboard-export-container'), 'Gozetmenlik_Analiz.png');
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

    // Taslak Modu Toggle
    const draftToggleInput = document.getElementById('toggle-draft-mode-input');
    if (draftToggleInput) {
        draftToggleInput.checked = DB.isDraftMode || false;
        draftToggleInput.addEventListener('change', (e) => {
            DB.isDraftMode = e.target.checked;
            saveToLocalStorage();
            updateDraftBanner();
            if (DB.isDraftMode) {
                showToast("🛠️ Taslak Modu Açildi. Atamalar gizli kalacak.", "success");
            } else {
                showToast("Taslak Modu Kapatildi.", "success");
            }
        });
    }

    const btnExportIndividual = document.getElementById('btn-export-individual-schedule');
    if (btnExportIndividual) {
        btnExportIndividual.addEventListener('click', () => {
            const name = document.getElementById('individual-proctor-name').textContent;
            exportElementAsImage(document.getElementById('individual-schedule-card'), `Program_${name}.png`);
        });
    }

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
            currentImportType = 'staff';
            document.getElementById('import-preview').innerHTML = '';
            document.getElementById('import-file-input').value = '';
            document.getElementById('btn-confirm-import').disabled = true;
            document.getElementById('modal-import').classList.remove('hidden');
        });
    }



    // Excel Akilli Import Butonu (Sinav Listesi bölümü)
    const btnImportExamsExcel = document.getElementById('btn-import-exams-excel');
    if (btnImportExamsExcel) {
        btnImportExamsExcel.addEventListener('click', () => {
            currentImportType = 'exams';
            document.getElementById('import-preview').innerHTML = '';
            document.getElementById('import-file-input').value = '';
            document.getElementById('btn-confirm-import').disabled = true;
            document.getElementById('modal-import').classList.remove('hidden');
        });
    }

    // Dönemlik Taslak Butonu
    const btnDonemlikTaslak = document.getElementById('btn-donemlik-taslak');
    if (btnDonemlikTaslak) {
        btnDonemlikTaslak.addEventListener('click', showDonemlikTaslakModal);
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

    // Şablon İndir - Sinav
    const btnTplExam = document.getElementById('btn-download-exam-template');
    if (btnTplExam) {
        btnTplExam.addEventListener('click', () => {
            const data = [
                ['Dersin Kodu', 'Dersin Adi', 'Dersi veren Öğr Üyesi', 'Sinav Tarihi ve Saati', 'Sinif Mevcudu Derslik', 'Gözetmen'],
                ['INF 100', 'Bilgisayara Giriş', 'Dr. Öğr. Üyesi Hadi ALIZADEH', '25 Kasim 2025 Sali, 18:15', '250', '']
            ];
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Sinavlar');
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
                    let html = '<p style="color:#10b981; margin-bottom:.5rem;">✓ ' + (rows.length - 1) + ' satir bulundu. İçerik önizlemesi:</p>';
                    html += '<div style="overflow-x:auto; max-height:200px;"><table style="width:100%; font-size:0.75rem; border-collapse:collapse;">';
                    // Başlik
                    html += '<thead><tr>' + rows[0].map(h => `<th style="padding:6px 8px; border-bottom:1px solid #334155; color:#94a3b8; text-align:left;">${h}</th>`).join('') + '</tr></thead>';
                    // İlk 5 satir önizleme
                    html += '<tbody>';
                    rows.slice(1, 6).forEach(r => {
                        html += '<tr>' + rows[0].map((_, i) => `<td style="padding:5px 8px; border-bottom:1px solid rgba(255,255,255,0.05); color:#f1f5f9;">${r[i] || ''}</td>`).join('') + '</tr>';
                    });
                    if (rows.length > 6) html += `<tr><td colspan="${rows[0].length}" style="padding:5px 8px; color:#94a3b8; font-style:italic;">... ve ${rows.length - 6} satir daha</td></tr>`;
                    html += '</tbody></table></div>';

                    document.getElementById('import-preview').innerHTML = html;
                    document.getElementById('btn-confirm-import').disabled = false;

                    // === AKILLI SÜTUN EŞLEŞTİRME UI ===
                    let SCHEMA_FIELDS = [];
                    let AUTO_KEYWORDS = {};

                    if (currentImportType === 'staff') {
                        SCHEMA_FIELDS = [
                            { key: 'name',      label: '👤 İsim Soyisim', required: true  },
                            { key: 'email',     label: '📧 E-posta',      required: false },
                            { key: 'baseScore', label: '📊 Başl. Puani', required: false },
                        ];
                        AUTO_KEYWORDS = {
                            name:      ['isim', 'ad soyad', 'personel', 'name', 'hoca'],
                            email:     ['eposta', 'mail', 'email'],
                            baseScore: ['puan', 'score', 'başlangiç', 'base'],
                        };
                    } else {
                        SCHEMA_FIELDS = [
                            { key: 'name',     label: '📚 Sinav Adi',   required: true  },
                            { key: 'date',     label: '📅 Tarih',        required: true  },
                            { key: 'time',     label: '🕐 Saat',         required: true  },
                            { key: 'duration', label: '⌛ Süre (dk)',    required: false },
                            { key: 'location', label: '📍 Konum',        required: false },
                            { key: 'lecturer', label: '👤 Hoca',         required: false },
                            { key: 'type',     label: '📋 Tür',          required: false },
                            { key: 'proctor',  label: '🛡️ Gözetmen',    required: false },
                        ];
                        AUTO_KEYWORDS = {
                            name:     ['ders','sinav','isim','name','exam','kod'],
                            date:     ['tarih','date','gun'],
                            time:     ['saat','time','vakit'],
                            duration: ['süre','dakika','duration'],
                            location: ['yer','derslik','sinif','location','room'],
                            lecturer: ['hoca','lecturer','öğretim','instructor'],
                            type:     ['tür','type','kind'],
                            proctor:  ['gözetmen','proctor','invigilator'],
                        };
                    }

                    const SAVED_MAP_KEY = 'excel_col_map_' + currentImportType;
                    const savedMap = JSON.parse(localStorage.getItem(SAVED_MAP_KEY) || '{}');
                    
                    const autoGuess = (headerRaw) => {
                        const h = String(headerRaw).toLowerCase();
                        if (savedMap[headerRaw]) return savedMap[headerRaw];
                        for (const [field, keys] of Object.entries(AUTO_KEYWORDS)) {
                            if (keys.some(k => h.includes(k))) return field;
                        }
                        return '';
                    };

                    let mapHtml = `<div id="smart-col-map" style="margin-top:1rem; background:rgba(99,102,241,0.1); border:1px solid #6366f1; border-radius:12px; padding:1rem;">`;
                    mapHtml += `<div style="font-size:0.85rem; color:#a78bfa; font-weight:700; margin-bottom:10px;">🧠 Akilli Sütun Eşleştirme (${currentImportType === 'staff' ? 'Personel' : 'Sinav'})</div>`;
                    mapHtml += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">`;
                    rows[0].forEach((h, idx) => {
                        const guess = autoGuess(String(h).trim());
                        const opts = SCHEMA_FIELDS.map(f =>
                            `<option value="${f.key}" ${guess === f.key ? 'selected' : ''}>${f.label}</option>`
                        ).join('');
                        mapHtml += `
                        <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:8px;">
                            <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:4px;">${h}</div>
                            <select data-col-idx="${idx}" class="smart-map-select"
                                style="width:100%; background:rgba(0,0,0,0.3); border:1px solid #334155; padding:4px 6px; border-radius:6px; color:white; font-size:0.8rem;">
                                <option value="">— Yoksay —</option>
                                ${opts}
                            </select>
                        </div>`;
                    });
                    mapHtml += `</div></div>`;
                    document.getElementById('import-preview').innerHTML += mapHtml;

                    // Satirlari button'a aktar
                    document.getElementById('btn-confirm-import')._importData = { rows, sheetName, smartMap: true };

                } catch(err) {
                    document.getElementById('import-preview').innerHTML = '<p style="color:#ef4444;">Dosya okunamadi: ' + err.message + '</p>';
                }
            };
            reader.readAsBinaryString(file);
        });
    }

    // Aktarmayi Onayla
    const btnConfirm = document.getElementById('btn-confirm-import');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            const data = btnConfirm._importData;
            if (!data || !data.rows || data.rows.length < 2) return;

            const rows = data.rows;

            // === AKILLI EŞLEŞTİRME MODU ===
            if (data.smartMap) {
                const SAVED_MAP_KEY = 'excel_col_map_' + currentImportType;
                const savedMap = JSON.parse(localStorage.getItem(SAVED_MAP_KEY) || '{}');

                // Seçilen mapping'i oku
                const colMap = {}; // { field -> colIndex }
                document.querySelectorAll('.smart-map-select').forEach(sel => {
                    const val = sel.value;
                    const idx = parseInt(sel.dataset.colIdx);
                    if (val) {
                        colMap[val] = idx;
                        const headerName = rows[0][idx];
                        if (headerName) savedMap[String(headerName).trim()] = val;
                    }
                });
                localStorage.setItem(SAVED_MAP_KEY, JSON.stringify(savedMap));

                let addedCount = 0, skipCount = 0;

                // --- PERSONEL MODU ---
                if (currentImportType === 'staff') {
                    if (colMap.name === undefined) {
                        alert('⚠️ En azindan İsim Soyisim sütununu eşleştirmeniz gerekiyor!');
                        return;
                    }
                    rows.slice(1).forEach(row => {
                        const name = String(row[colMap.name] || '').trim();
                        if (!name) return;
                        const email = colMap.email !== undefined ? String(row[colMap.email] || '').trim() : '';
                        const baseScore = colMap.baseScore !== undefined ? (parseFloat(row[colMap.baseScore]) || 0) : 0;

                        const exists = DB.staff.find(s => s.name.toLowerCase() === name.toLowerCase());
                        if (!exists) {
                            const newId = DB.staff.length > 0 ? (Math.max(...DB.staff.map(s => s.id)) + 1) : 1;
                            DB.staff.push({
                                id: newId,
                                name: name,
                                email: email,
                                totalScore: baseScore,
                                baseScore: baseScore,
                                taskCount: 0
                            });
                            addedCount++;
                        } else {
                            skipCount++;
                        }
                    });
                    saveToLocalStorage();
                    if (typeof saveToBackend === 'function') await saveToBackend();
                    document.getElementById('modal-import').classList.add('hidden');
                    renderStaff(); renderDashboard();
                    showToast(`✅ ${addedCount} hoca eklendi.${skipCount > 0 ? ` (${skipCount} mükerrer atlandi)` : ''}`);
                    return;
                }

                // --- SINAV MODU ---
                if (!colMap.name || !colMap.date || !colMap.time) {
                    alert('⚠️ En azindan Sinav Adi, Tarih ve Saat sütunlarini eşleştirmeniz gerekiyor!');
                    return;
                }

                const monthsMap = {
                    'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04', 'mayis': '05', 'haziran': '06',
                    'temmuz': '07', 'ağustos': '08', 'eylül': '09', 'ekim': '10', 'kasim': '11', 'aralik': '12'
                };

                rows.slice(1).forEach(row => {
                    const name = String(row[colMap.name] || '').trim();
                    let dateRaw = String(row[colMap.date] || '').trim();
                    let timeRaw = String(row[colMap.time] || '').trim();
                    if (!name || !dateRaw) return;

                    // Tarih/Saat Akilli Ayriştirma
                    let combined = (dateRaw + " " + timeRaw).toLowerCase();
                    for (const [mName, mVal] of Object.entries(monthsMap)) {
                        combined = combined.replace(mName, mVal);
                    }
                    combined = combined.replace(/pazartesi|sali|çarşamba|perşembe|cuma|cumartesi|pazar/g, '')
                                       .replace(/[,./-]/g, ' ')
                                       .replace(/\s+/g, ' ').trim();

                    const parts = combined.match(/\d+/g);
                    if (!parts || parts.length < 3) return;

                    let d, m, y, h = "09", min = "00";
                    if (parts[0].length === 4) { // YYYY MM DD
                        y = parts[0]; m = parts[1]; d = parts[2];
                        if (parts.length >= 5) { h = parts[3]; min = parts[4]; }
                    } else { // DD MM YYYY
                        d = parts[0]; m = parts[1]; y = parts[2];
                        if (parts.length >= 5) { h = parts[3]; min = parts[4]; }
                    }
                    
                    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    const time = `${h.padStart(2, '0')}:${min.padStart(2, '0')}`;

                    const duration = colMap.duration !== undefined ? (parseInt(row[colMap.duration]) || 90) : 90;
                    const location = colMap.location !== undefined ? String(row[colMap.location] || '').trim() : '';
                    const lecturer = colMap.lecturer !== undefined ? String(row[colMap.lecturer] || '').trim() : '';
                    const type     = colMap.type     !== undefined ? String(row[colMap.type]     || '').trim() : 'Vize';
                    const proctorName = colMap.proctor !== undefined ? String(row[colMap.proctor] || '').trim() : '';

                    const isDuplicate = DB.exams.some(ex => ex.name === name && ex.date === date && ex.time === time);
                    if (!isDuplicate) {
                        const score = calculateScore(getSafeDate(date, time), duration);
                        const katsayi = getKatsayi(getSafeDate(date, time));
                        const newExam = {
                            id: Date.now() + Math.floor(Math.random() * 10000),
                            name, date, time, duration, location, lecturer,
                            type: type || 'Vize',
                            score, katsayi,
                            proctorIds: [], proctorId: null, proctorName: '',
                            isDraft: DB.isDraftMode,
                            createdAt: new Date().toISOString()
                        };
                        if (proctorName) {
                            const staff = DB.staff.find(s => s.name.toLowerCase().includes(proctorName.toLowerCase()));
                            if (staff) {
                                newExam.proctorIds = [staff.id];
                                newExam.proctorId = staff.id;
                                newExam.proctorName = staff.name;
                                staff.totalScore = parseFloat((staff.totalScore + score).toFixed(2));
                                staff.taskCount++;
                            }
                        }
                        DB.exams.push(newExam);
                        addedCount++;
                    } else {
                        skipCount++;
                    }
                });

                saveToLocalStorage();
                if (typeof saveToBackend === 'function') await saveToBackend();
                document.getElementById('modal-import').classList.add('hidden');
                renderExams(); renderStaff(); renderSchedule(); renderDashboard();
                showToast(`✅ ${addedCount} sinav eklendi.${skipCount > 0 ? ` (${skipCount} mükerrer atlandi)` : ''}`);
                return;
            }

            // === ESKİ GENEL IMPORT (Fallback) ===
            const headers = rows[0].map(h => String(h).trim().toLowerCase());
            
            // Sütun indekslerini bul
            const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k.toLowerCase())));

            // Import Türü Belirle
            const isStaffImport = getIdx(['isim', 'personel', 'ad soyad']) !== -1 && getIdx(['sinav', 'ders', 'tarih']) === -1;

            let addedCount = 0;
            let skipCount = 0;

            if (isStaffImport) {
                // --- Personel İçe Aktar ---
                const nameIdx = getIdx(['isim', 'ad soyad', 'personel']);
                
                rows.slice(1).forEach(row => {
                    const name = String(row[nameIdx] || "").trim();
                    if (!name) return;

                    const exists = DB.staff.find(s => s.name.toLowerCase() === name.toLowerCase());
                    if (!exists) {
                        const newId = DB.staff.length > 0 ? (Math.max(...DB.staff.map(s => s.id)) + 1) : 1;
                        DB.staff.push({
                            id: newId,
                            name: name,
                            totalScore: 0,
                            taskCount: 0
                        });
                        addedCount++;
                    } else {
                        skipCount++;
                    }
                });
                alert(`✅ ${addedCount} hoca sisteme eklendi.${skipCount > 0 ? ` (${skipCount} mükerrer kayit atlandi.)` : ''}`);
            } else {
                // --- Sinav İçe Aktar ---
                const nameIdx = getIdx(['sinav', 'ders', 'name', 'exam']);
                const dateIdx = getIdx(['tarih', 'date']);
                const timeIdx = getIdx(['saat', 'time', 'vakit']);
                const durIdx = getIdx(['süre', 'duration']);
                const locIdx = getIdx(['yer', 'derslik', 'sinif', 'location']);
                const lectIdx = getIdx(['hoca', 'lecturer', 'öğretim']);
                const proctIdx = getIdx(['gözetmen', 'proctor']);

                rows.slice(1).forEach(row => {
                    const name = String(row[nameIdx] || "").trim();
                    const dateRaw = String(row[dateIdx] || "").trim();
                    const timeRaw = String(row[timeIdx] || "").trim();
                    
                    if (!name || !dateRaw || !timeRaw) return;

                    // Tarih Normalizasyonu (DD.MM.YYYY veya YYYY-MM-DD)
                    let date = dateRaw;
                    if (date.includes('.') || date.includes('/')) {
                        const parts = date.split(/[./]/);
                        if (parts[0].length === 4) date = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
                        else date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                    }

                    // Saat Normalizasyonu (HH:MM veya HH.MM)
                    let time = timeRaw.replace('.', ':');
                    if (time.length === 4 && !time.includes(':')) time = time.slice(0,2) + ":" + time.slice(2);
                    if (time.length === 5 && !time.includes(':')) time = time.replace('.', ':'); // fallback
                    if (time.length === 4 && time.includes(':')) time = "0" + time;

                    const duration = parseInt(row[durIdx]) || 60;
                    const location = String(row[locIdx] || "").trim();
                    const lecturer = String(row[lectIdx] || "").trim();
                    const proctorName = String(row[proctIdx] || "").trim();

                    const isDuplicate = DB.exams.some(ex => ex.name === name && ex.date === date && ex.time === time);
                    if (!isDuplicate) {
                        const score = calculateScore(getSafeDate(date, time), duration);
                        const katsayi = getKatsayi(getSafeDate(date, time));
                        
                        const newExam = {
                            id: Date.now() + Math.floor(Math.random() * 10000),
                            name, date, time, duration, location, lecturer,
                            score, katsayi,
                            proctorIds: [],
                            proctorId: null,
                            proctorName: "",
                            isDraft: DB.isDraftMode,
                            createdAt: new Date().toISOString()
                        };

                        // Eğer gözetmen ismi varsa ata
                        if (proctorName) {
                            const staff = DB.staff.find(s => s.name.toLowerCase().includes(proctorName.toLowerCase()));
                            if (staff) {
                                newExam.proctorIds = [staff.id];
                                newExam.proctorId = staff.id;
                                newExam.proctorName = staff.name;
                                staff.totalScore = parseFloat((staff.totalScore + score).toFixed(2));
                                staff.taskCount++;
                            }
                        }

                        DB.exams.push(newExam);
                        addedCount++;
                    } else {
                        skipCount++;
                    }
                });
                alert(`✅ ${addedCount} sinav başariyla eklendi.${skipCount > 0 ? ` (${skipCount} mükerrer kayit atlandi.)` : ''}`);
            }

            saveToLocalStorage();
            if (typeof saveToBackend === 'function') await saveToBackend();
            
            document.getElementById('modal-import').classList.add('hidden');
            renderExams();
            renderStaff();
            renderSchedule();
            renderDashboard();
        });
    }

    // Announcement Listeners
    document.getElementById('btn-add-announcement')?.addEventListener('click', () => editAnnouncement(null));
    document.getElementById('form-edit-announcement')?.addEventListener('submit', handleAnnouncementSubmit);

    // --- Phase 3: Batch Assignment & Search ---
    document.getElementById('btn-batch-assign')?.addEventListener('click', window.batchAutoAssign);
    document.getElementById('btn-donemlik-taslak')?.addEventListener('click', showDonemlikTaslakModal);
    document.getElementById('exam-search')?.addEventListener('input', renderExams);
    document.getElementById('staff-search')?.addEventListener('input', renderStaff);
    document.getElementById('lecturer-search')?.addEventListener('input', () => {
        if (typeof renderLecturers === 'function') renderLecturers();
    });
    document.getElementById('mapping-search')?.addEventListener('input', () => {
        if (typeof renderMappings === 'function') renderMappings();
    });
    document.getElementById('schedule-search')?.addEventListener('input', renderSchedule);

    // --- Schedule Filter Listeners ---
    const scheduleTypeFilters = document.querySelectorAll('.type-filter-btn');
    scheduleTypeFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            scheduleTypeFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentScheduleType = btn.dataset.type;
            renderSchedule();
        });
    });

    // Timeline Listeners
    const timelineDateInput = document.getElementById('timeline-date-input');
    if (timelineDateInput) {
        timelineDateInput.value = currentTimelineDate;
        timelineDateInput.addEventListener('change', (e) => {
            currentTimelineDate = e.target.value;
            renderTimeline();
        });
    }

    document.getElementById('btn-timeline-prev')?.addEventListener('click', () => {
        const d = new Date(currentTimelineDate);
        d.setMonth(d.getMonth() - 1);
        currentTimelineDate = d.toISOString().split('T')[0];
        renderMonthlyCalendar();
    });

    document.getElementById('btn-timeline-next')?.addEventListener('click', () => {
        const d = new Date(currentTimelineDate);
        d.setMonth(d.getMonth() + 1);
        currentTimelineDate = d.toISOString().split('T')[0];
        renderMonthlyCalendar();
    });

    document.getElementById('btn-close-daily-detail')?.addEventListener('click', () => {
        document.getElementById('modal-daily-detail').classList.add('hidden');
    });

    // Notification Listeners
    document.getElementById('btn-notifications')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNotifPanel();
    });

    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notif-panel');
        const btn = document.getElementById('btn-notifications');
        if (panel && !panel.classList.contains('hidden') && !panel.contains(e.target) && !btn.contains(e.target)) {
            panel.classList.add('hidden');
        }
    });

    document.getElementById('btn-clear-notifs')?.addEventListener('click', () => {
        const panel = document.getElementById('notif-panel');
        if (panel) panel.classList.add('hidden');
    });

    // İlk kurulumda veya güncellemede bildirimleri sifirla (User'in isteği üzerine)
    const isReset = localStorage.getItem('notifReset_v2');
    if (!isReset) {
        localStorage.setItem('lastNotifCheck', Date.now());
        localStorage.setItem('notifReset_v2', 'true');
    }

    updateNotifBadge();

    // Geri Bildirim Formu Dinleyicileri
    document.getElementById('form-submit-feedback')?.addEventListener('submit', window.submitFeedback);

    // Geri Bildirim Filtre Dinleyicileri
    document.querySelectorAll('.feedback-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.feedback-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.currentFeedbackFilter = btn.dataset.filter;
            renderFeedbackPage();
        });
    });
}


function exportElementAsImage(element, filename) {
    if (!element) return;
    try {
        // Orijinal stilleri kaydet
        const origMaxHeight = element.style.maxHeight;
        const origOverflowY = element.style.overflowY;
        const origHeight = element.style.height;

        // Altindaki tüm tablo konteynerlerinin orijinal stillerini kaydet
        const tableContainers = element.querySelectorAll('.table-container');
        const origTableStyles = Array.from(tableContainers).map(tc => ({
            el: tc,
            maxHeight: tc.style.maxHeight,
            overflowY: tc.style.overflowY,
            height: tc.style.height
        }));

        // Elemanlari tam boyuta genişlet (scroll/clipping engellemek için)
        element.style.maxHeight = 'none';
        element.style.overflowY = 'visible';
        element.style.height = 'auto';

        tableContainers.forEach(tc => {
            tc.style.maxHeight = 'none';
            tc.style.overflowY = 'visible';
            tc.style.height = 'auto';
        });

        html2canvas(element, { 
            scale: 2, 
            backgroundColor: '#0f172a',
            logging: false,
            useCORS: true
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();

            // Stilleri eski haline geri yükle
            element.style.maxHeight = origMaxHeight;
            element.style.overflowY = origOverflowY;
            element.style.height = origHeight;

            origTableStyles.forEach(style => {
                style.el.style.maxHeight = style.maxHeight;
                style.el.style.overflowY = style.overflowY;
                style.el.style.height = style.height;
            });
        });
    } catch(err) {
        console.error("Resim çikartilamadi: ", err);
        alert("Resim olarak indirilemedi, eklenti yükleniyor olabilir.");
    }
}

function exportTableToExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    try {
        const wb = XLSX.utils.table_to_book(table, { sheet: "Sinav Programi" });
        XLSX.writeFile(wb, filename);
    } catch (err) {
        console.error("Excel çikartilamadi: ", err);
        alert("Excel indirelemedi, eklenti yükleniyor olabilir.");
    }
}

function renderDashboard() {
    const tbody = document.querySelector('#table-ranking tbody');
    const tbodyBreakdown = document.querySelector('#table-duty-breakdown tbody');
    tbody.innerHTML = '';
    if (tbodyBreakdown) tbodyBreakdown.innerHTML = '';

    // Görev dağilim istatistiklerini hazirla
    const stats = {};
    DB.staff.forEach(s => {
        stats[s.id] = { hiG: 0, hiA: 0, hsG: 0, hsA: 0, total: 0 };
    });

    DB.exams.forEach(ex => {
        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        pIds.forEach(pid => {
            if (!stats[pid]) return;
            
            const k = ex.katsayi;
            if (k === 1.0) stats[pid].hiG++;
            else if (k === 1.5) stats[pid].hiA++;
            else if (k === 2.0) stats[pid].hsG++;
            else if (k === 2.5) stats[pid].hsA++;
            
            stats[pid].total++;
        });
    });

    // Siralama (Puani en çoktan aza)
    const sortedStaffExam = [...DB.staff].sort((a, b) => b.totalScore - a.totalScore);
    const sortedStaffNonExam = [...DB.staff].sort((a, b) => (b.nonExamScore || 0) - (a.nonExamScore || 0));

    const tbodyNonExam = document.querySelector('#table-ranking-non-exam tbody');
    if (tbodyNonExam) tbodyNonExam.innerHTML = '';

    // 1. Sinav Gözetmenliği Puan Siralamasi (totalScore'a göre azalan)
    sortedStaffExam.forEach((s, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>
                <div class="name-with-avatar">
                    ${getAvatarHtml(s.name)}
                    <span class="clickable-name" onclick="showStaffSchedule('${s.name}')">${s.name}</span>
                </div>
            </td>
            <td>${s.totalScore.toFixed(1)}</td>
            <td>${s.taskCount}</td>
            <td><span class="badge ${s.totalScore === 0 ? 'idle' : 'active'}">${s.totalScore === 0 ? 'Beklemede' : 'Görevli'}</span></td>
        `;
        tbody.appendChild(tr);
    });

    // 2. Sinav Dişi Görev Siralamasi (nonExamScore'a göre azalan)
    sortedStaffNonExam.forEach((s, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>
                <div class="name-with-avatar">
                    ${getAvatarHtml(s.name)}
                    <span class="clickable-name" onclick="showStaffSchedule('${s.name}')">${s.name}</span>
                </div>
            </td>
            <td>${(s.nonExamScore || 0).toFixed(1)}</td>
            <td>${s.nonExamTaskCount || 0}</td>
            <td><span class="badge ${!s.nonExamScore ? 'idle' : 'active'}">${!s.nonExamScore ? 'Beklemede' : 'Görevli'}</span></td>
        `;
        if (tbodyNonExam) tbodyNonExam.appendChild(tr);

        // Görev Dağilim Detay Tablosu
        if (tbodyBreakdown) {
            const trB = document.createElement('tr');
            const st = stats[s.id];
            trB.innerHTML = `
                <td>
                    <div class="name-with-avatar">
                        ${getAvatarHtml(s.name)}
                        <span class="clickable-name" onclick="showStaffSchedule('${s.name}')">${s.name}</span>
                    </div>
                </td>
                <td>${st.hiG}</td>
                <td>${st.hiA}</td>
                <td>${st.hsG}</td>
                <td>${st.hsA}</td>
                <td><strong>${st.total}</strong></td>
            `;
            tbodyBreakdown.appendChild(trB);
        }
    });

    // Stats
    const totalExamsElem = document.getElementById('stat-total-exams');
    const totalStaffElem = document.getElementById('stat-total-staff');
    const avgScoreElem = document.getElementById('stat-avg-score');

    if (totalExamsElem) totalExamsElem.textContent = DB.exams.length;
    if (totalStaffElem) totalStaffElem.textContent = DB.staff.length;
    
    const avg = DB.staff.length ? DB.staff.reduce((a, b) => a + b.totalScore, 0) / DB.staff.length : 0;
    if (avgScoreElem) avgScoreElem.textContent = avg.toFixed(1);

    // Çakişma sayisi
    const conflictElem = document.getElementById('stat-conflicts');
    if (conflictElem) {
        const conflicts = getConflicts();
        conflictElem.textContent = conflicts.size;
    }

    // Pazar Yeri (Açik Görevler) Panel Kartini Güncelle
    renderMarketplaceDashboard();
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
    if (typeof cleanExpiredConstraints === 'function') cleanExpiredConstraints(true);
    const staffSelect = document.getElementById('constraint-staff-select');
    if (staffSelect && staffSelect.value) {
        renderConstraintsList(staffSelect.value);
    }
}

function renderConstraintsList(staffName) {
    if (!DB.constraints) DB.constraints = {};
    const tbody = document.querySelector('#table-constraints tbody');
    const title = document.getElementById('current-constraints-title');
    if (title) title.textContent = `${staffName} - Mevcut Kisitlar`;
    if (!tbody) return;
    tbody.innerHTML = '';

    const constraints = DB.constraints[staffName] || [];

    if (constraints.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:2rem;">Bu gözetmen için henüz kisit eklenmemiş.</td></tr>';
        return;
    }

    const dayNames = ["Pazar", "Pazartesi", "Sali", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

    constraints.forEach((c, idx) => {
        const tr = document.createElement('tr');
        let timeLabel = "";
        if (c.day !== undefined) {
             timeLabel = `📅 Her ${dayNames[c.day]}`;
        } else if (c.startDate && c.endDate) {
             timeLabel = `📆 ${c.startDate} / ${c.endDate}`;
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
    if (!DB.constraints) DB.constraints = {};
    const staffName = document.getElementById('constraint-staff-select').value;
    if (!staffName) { alert("Lütfen bir gözetmen seçin!"); return; }

    const type = document.getElementById('constraint-type').value;
    const start = document.getElementById('constraint-start').value;
    const end = document.getElementById('constraint-end').value;

    let newConstraint = { start, end };

    if (type === 'day') {
        newConstraint.day = parseInt(document.getElementById('constraint-day').value);
    } else {
        newConstraint.date = document.getElementById('constraint-date').value;
        if (!newConstraint.date) { alert("Lütfen bir tarih seçin!"); return; }
        // YYYY-MM-DD -> MM-DD formatina çevir (logic.js böyle bekliyor)
        const parts = newConstraint.date.split('-');
        newConstraint.date = `${parts[1]}-${parts[2]}`;
    }

    if (!DB.constraints[staffName]) DB.constraints[staffName] = [];
    DB.constraints[staffName].push(newConstraint);

    saveToLocalStorage();
    renderConstraintsList(staffName);
    alert("✓ Kisit başariyla eklendi.");
}

window.deleteConstraint = function(staffName, index) {
    if (confirm("Bu kisitlamayi silmek istediğinize emin misiniz?")) {
        if (!DB.constraints) DB.constraints = {};
        if (DB.constraints[staffName]) {
            DB.constraints[staffName].splice(index, 1);
            saveToLocalStorage();
            renderConstraintsList(staffName);
        }
    }
}

window.showExamDetail = function(examName, date, time, location) {
    const modal = document.getElementById('modal-exam-detail');
    const title = document.getElementById('exam-detail-title');
    const infoGrid = document.getElementById('exam-detail-info');
    const tbody = document.querySelector('#table-exam-proctors tbody');

    // Bu sinavla ilgili tum gozetmenleri bul
    const relatedExams = DB.exams.filter(e =>
        e.name === examName && e.date === date && e.time === time
    );

    title.textContent = examName;
    
    document.getElementById('btn-download-attendance').onclick = () => {
        generateAttendancePDF(examName, date, time, location, relatedExams);
    };

    const bulkCancelBtn = document.getElementById('btn-bulk-cancel-mail');
    if (bulkCancelBtn) {
        const baseEx = relatedExams[0];
        if (baseEx && ((baseEx.proctorIds && baseEx.proctorIds.length > 0) || baseEx.proctorId)) {
            bulkCancelBtn.style.display = 'flex';
            bulkCancelBtn.onclick = () => {
                window.sendBulkCancelMailViaOutlook(baseEx.id);
            };
        } else {
            bulkCancelBtn.style.display = 'none';
        }
    }

    const formatDate = date.split('-').reverse().join('.');
    const duration = relatedExams.length > 0 ? relatedExams[0].duration : '-';
    const loc = location || (relatedExams.length > 0 ? relatedExams[0].location : '-');

    const exForLecturer = DB.exams.find(e => e.name === examName && e.date === date && e.time === time);
    const lecturer = exForLecturer ? (exForLecturer.lecturer || '-') : '-';

    infoGrid.innerHTML = `
        <div style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; padding: 1rem; text-align:center;">
            <div style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Tarih</div>
            <div style="font-weight:700; font-size:1.1rem;">${formatDate}</div>
        </div>
        <div style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; padding: 1rem; text-align:center;">
            <div style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Saat / Süre</div>
            <div style="font-weight:700; font-size:1.1rem;">${time} &bull; ${duration} dk</div>
        </div>
        <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 1rem; text-align:center;">
            <div style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Dersi Veren</div>
            <div style="font-weight:700; font-size:1.1rem; color:var(--accent-orange);">${lecturer}</div>
        </div>
        <div style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; padding: 1rem; text-align:center;">
            <div style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Mevcut / Yer</div>
            <div style="font-weight:700; font-size:1.1rem;">${exForLecturer ? (exForLecturer.capacity || '-') : '-'}</div>
        </div>
        <div style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 12px; padding: 1rem; text-align:center;">
            <div style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Derslik</div>
            <div style="font-weight:700; font-size:1.1rem;">${loc || '-'}</div>
        </div>
    `;

    // Hoca Notu Gösterimi
    const noteContainer = document.getElementById('exam-detail-note-container');
    const noteContent = document.getElementById('exam-detail-note-content');
    if (noteContainer && noteContent) {
        const firstNote = relatedExams.find(e => e.lecturerNote)?.lecturerNote;
        if (firstNote && firstNote.trim() !== "") {
            noteContent.textContent = firstNote;
            noteContainer.classList.remove('hidden');
        } else {
            noteContainer.classList.add('hidden');
        }
    }

    tbody.innerHTML = '';
    if (relatedExams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Gözetmen atanmamiş.</td></tr>';
    } else {
        const now = new Date();
        // Tüm gözetmenleri (proctorIds içindeki her hoca için) tek tek listele
        let globalIdx = 1;
        relatedExams.forEach((ex) => {
            const currentProctorIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
            
            currentProctorIds.forEach(pid => {
                const staff = DB.staff.find(s => s.id === pid);
                if (!staff) return;

                const examDate = getSafeDate(ex.date, ex.time);
                const examEnd = new Date(examDate.getTime() + ex.duration * 60000);
                const isPast = examEnd < now;

                const isNotified = ex.notifiedStaffIds && ex.notifiedStaffIds.map(String).includes(String(staff.id));
                const statusBadge = isNotified
                    ? `<span class="badge" style="background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3); font-size:0.75rem; padding:2px 6px; border-radius:4px; font-weight:600;">📧 Gönderildi</span>`
                    : `<span class="badge" style="background:rgba(148,163,184,0.15); color:#cbd5e1; border:1px solid rgba(148,163,184,0.3); font-size:0.75rem; padding:2px 6px; border-radius:4px; font-weight:600;">✉️ Bekliyor</span>`;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${globalIdx++}</td>
                    <td><span class="clickable-name" onclick="showStaffSchedule('${staff.name}')">${staff.name}</span></td>
                    <td>${staff.totalScore.toFixed(1)}</td>
                    <td>${staff.taskCount}</td>
                    <td>${statusBadge}</td>
                    <td style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                        ${!isPast ? `<button class="btn-secondary" style="font-size:0.75rem; padding: 4px 8px; border-color:#0ea5e9; color:#38bdf8; background:none; line-height: 1;" onclick="sendSingleProctorMailViaOutlook(${ex.id}, ${staff.id})" title="Hocaya Özel Görev Maili Gönder">📧 Mail</button>` : ''}
                        ${!isPast ? `<button class="btn-swap" style="font-size:0.75rem; padding: 4px 10px; line-height: 1;" onclick="takeOverDuty('${ex.id}', '${staff.id}')">Yerine Geç</button>` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        });
    }

    modal.classList.remove('hidden');
};

/**
 * Görevi Devralma (Takeover) Fonksiyonu
 */
window.takeOverDuty = async function(examId, oldProctorId) {
    try {
        const exam = DB.exams.find(e => String(e.id) === String(examId));
        if (!exam) return alert("Sinav bulunamadi.");

        const oldProctor = DB.staff.find(s => String(s.id) === String(oldProctorId));
        if (!oldProctor) return alert("Hoca verisi bulunamadi.");

        let newProctorName = "";
        let newProctor = null;

        if (sessionStorage.getItem('isAdmin') === 'true') {
            // Admin ise kimi atayacağini seçsin
            newProctor = await showStaffSelectModal("Görevi devralacak hocayi seçin:");
            if (!newProctor) return;
        } else {
            // Misafir ise "Kimseniz?" diye soralim
            newProctor = await showStaffSelectModal("Lütfen kendi isminizi seçerek görevi devralin:");
            if (!newProctor) return;
        }

        if (!newProctor) return alert("Belirtilen isimde bir hoca bulunamadi! Lütfen tam ve doğru yazin.");
        if (newProctor.id === oldProctor.id) return alert("Zaten bu görev bu hocaya atanmiş!");

        // Müsaitlik kontrolü
        if (!isProctorTrulyFree(newProctor.id, exam.date, exam.time, exam.duration, exam.id)) {
            if (!confirm("⚠️ Bu saatte başka bir göreviniz veya kisitiniz var! Yine de devam etmek istiyor musunuz?")) return;
        }

        if (!confirm(`${oldProctor.name} hocanin görevini ${newProctor.name} hocaya devretmek istediğinize emin misiniz?`)) return;

        // PUAN GÜNCELLEME (nonExam/exam ayrimi)
        if (shouldCountAsNonExam(exam)) {
            oldProctor.nonExamScore = Math.max(0, parseFloat(((oldProctor.nonExamScore || 0) - exam.score).toFixed(2)));
            oldProctor.nonExamTaskCount = Math.max(0, (oldProctor.nonExamTaskCount || 1) - 1);
            newProctor.nonExamScore = parseFloat(((newProctor.nonExamScore || 0) + exam.score).toFixed(2));
            newProctor.nonExamTaskCount = (newProctor.nonExamTaskCount || 0) + 1;
        } else {
            oldProctor.totalScore = parseFloat((oldProctor.totalScore - exam.score).toFixed(2));
            oldProctor.taskCount = Math.max(0, (oldProctor.taskCount || 1) - 1);
            newProctor.totalScore = parseFloat((newProctor.totalScore + exam.score).toFixed(2));
            newProctor.taskCount = (newProctor.taskCount || 0) + 1;
        }

        // SINAV GÜNCELLEME
        exam.proctorId = newProctor.id;
        exam.proctorName = newProctor.name;
        if (!exam.proctorIds || exam.proctorIds.length === 0) {
            exam.proctorIds = [newProctor.id];
        } else {
            const idx = exam.proctorIds.indexOf(parseInt(oldProctorId));
            if (idx !== -1) exam.proctorIds[idx] = newProctor.id;
            else exam.proctorIds = [newProctor.id];
        }

        // KAYDET VE YENİLE
        saveToLocalStorage();
        renderDashboard();
        renderExams();
        renderSchedule();
        renderStaff();
        
        console.log("Görev devralma başarili, sunucuya kaydediliyor...");
        await saveToBackend();
        
        logAction('user', 'Görev Devralma', `${exam.name} görevi ${oldProctor.name}'dan ${newProctor.name}'a devredildi.`);
        alert(`✅ Başarili!\n${exam.name} görevi ${newProctor.name} hocaya başariyla devredildi.`);
        document.getElementById('modal-exam-detail').classList.add('hidden');

    } catch (err) {
        console.error("Görevi devralma hatasi:", err);
        alert("Bir hata oluştu: " + err.message);
    }
};

/**
 * Personel Seçim Modali (Promise tabanli)
 */
window.showStaffSelectModal = function(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-staff-select');
        const dropdown = document.getElementById('takeover-staff-dropdown');
        const btnConfirm = document.getElementById('btn-staff-select-confirm');
        const btnCancel = document.getElementById('btn-staff-select-cancel');
        const title = modal.querySelector('h3');

        title.textContent = message;
        
        // Dropdown doldur
        dropdown.innerHTML = DB.staff
            .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
            .map(s => `<option value="${s.id}">${s.name}</option>`)
            .join('');

        modal.classList.remove('hidden');

        const cleanup = () => {
            modal.classList.add('hidden');
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
        };

        btnConfirm.onclick = () => {
            const staffId = parseInt(dropdown.value);
            const staff = DB.staff.find(s => s.id === staffId);
            cleanup();
            resolve(staff);
        };

        btnCancel.onclick = () => {
            cleanup();
            resolve(null);
        };
    });
};

function renderExams() {
    const tbody = document.querySelector('#table-exams tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchTerm = document.getElementById('exam-search')?.value.toLowerCase() || '';

    // Siralama oklarini güncelle
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

    // DB'den sinavlari kopya alip sirala
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

    const now = new Date();
    const conflicts = getConflicts();
    const locConflicts = getLocationConflicts();

    const filteredExams = sortedExams.filter(ex => {
        // Archiving filter
        const examDateStr = ex.date || "";
        const examTimeStr = ex.time || "00:00";
        const examDate = getSafeDate(examDateStr, examTimeStr);
        const examEnd = new Date(examDate.getTime() + (ex.duration || 60) * 60000);
        const isPast = examEnd < now;

        if (currentExamTab === 'active' && isPast) return false;
        if (currentExamTab === 'archive' && !isPast) return false;

        // Search filter
        if (!searchTerm) return true;
        
        const name = (ex.name || "").toLowerCase();
        const lecturer = (ex.lecturer || "").toLowerCase();
        
        const pNames = (ex.proctorIds || [ex.proctorId]).map(pid => {
            if (!pid) return '';
            const s = DB.staff.find(staff => String(staff.id) === String(pid));
            return s ? s.name.toLowerCase() : '';
        }).join(' ');

        return name.includes(searchTerm) || 
               lecturer.includes(searchTerm) || 
               pNames.includes(searchTerm);
    });

    filteredExams.forEach(ex => {
        const tr = document.createElement('tr');
        if (ex.isDraft) tr.classList.add('exam-row-draft');
        if (conflicts.has(ex.id)) {
            tr.classList.add('conflict-row');
        }
        
        const isLocConflict = locConflicts.has(ex.id);

        const dateObj = new Date(ex.date.replace(/-/g, "/"));
        const dayNames = ["Pazar", "Pazartesi", "Sali", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const dayName = dayNames[dateObj.getDay()];
        const displayDate = ex.date.split("-").reverse().join(".") + " " + dayName;

        const pNamesHTML = (ex.proctorIds || [ex.proctorId]).map(pid => {
            if (!pid) return '';
            const s = DB.staff.find(staff => String(staff.id) === String(pid));
            const name = s ? s.name : (ex.proctorName || 'Personel');
            const isNotified = ex.notifiedStaffIds && ex.notifiedStaffIds.map(String).includes(String(pid));
            const icon = isNotified 
                ? `<span title="E-posta Gönderildi" style="color:#10b981; margin-left:4px; cursor:help; font-size:0.85rem;">📧</span>` 
                : `<span title="E-posta Gönderilmedi" style="color:#94a3b8; margin-left:4px; cursor:help; font-size:0.85rem;">✉️</span>`;
            return `<span style="display:inline-flex; align-items:center; margin-right:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${name}${s ? icon : ' <small style="color:var(--text-muted); margin-left:4px;">(Ayrildi)</small>'}</span>`;
        }).filter(Boolean).join(' ') || (ex.proctorName ? `<span style="display:inline-flex; align-items:center; margin-right:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${ex.proctorName}</span>` : '-');

        tr.innerHTML = `
            <td><span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #a78bfa; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(139, 92, 246, 0.3);">${ex.type || 'Vize'}</span></td>
            <td>
                <span class="clickable-name" onclick="showExamDetail('${ex.name}', '${ex.date}', '${ex.time}', '${ex.location || ''}')"><strong>${ex.name}</strong></span>
                ${conflicts.has(ex.id) ? '<span class="conflict-warning">⚠️ Zaman Çakişmasi!</span>' : ''}
            </td>
            <td>${ex.lecturer || '-'}</td>
            <td class="${isLocConflict ? 'location-conflict' : ''}">
                ${ex.location || '-'}
                ${isLocConflict ? '<span class="location-warning">⚠️ Derslik Dolu!</span>' : ''}
            </td>
            <td>${displayDate}</td>
            <td>${ex.time}</td>
            <td>${ex.duration}</td>
            <td>x${ex.katsayi.toFixed(1)}</td>
            <td>${ex.score.toFixed(1)}</td>
            <td>${pNamesHTML}</td>
            <td style="display: flex; gap: 8px; justify-content: flex-end;">
                 ${conflicts.has(ex.id) ? `<button class="btn-primary" onclick="quickFixConflict(${ex.id})" title="Otomatik Çöz" style="padding: 0.45rem; background: var(--accent-orange); border-radius: 6px;"><span class="icon" style="margin:0; font-size: 0.9rem;">🧙‍♂️</span></button>` : ''}
                 ${(() => {
                     const myStaffId = localStorage.getItem('myStaffId');
                     const hasRequest = (DB.requests || []).find(r => 
                         String(r.examId) === String(ex.id) && 
                         String(r.initiatorId) === String(myStaffId) && 
                         ['pending', 'pending_peer'].includes(r.status)
                     );
                     if (hasRequest) {
                         return `<button class="btn-delete" onclick="cancelSwapRequest(${hasRequest.id})" title="Talebi İptal Et" style="padding: 0.3rem 0.6rem; border-radius: 6px;"><span class="icon" style="margin:0;">🚫</span></button>`;
                     }
                     const isMe = (ex.proctorIds || [ex.proctorId]).map(pid => String(pid)).includes(myStaffId);
                     if (isMe) {
                         return `
                            <button class="btn-secondary" onclick="initiateDirectSwap(${ex.id})" title="Hoca ile Takas Et" style="padding: 0.3rem 0.6rem; border-radius: 6px;"><span class="icon" style="margin:0;">🔄</span></button>
                            <button class="btn-primary" onclick="initiateOpenSwap(${ex.id})" title="Pazar Yerine Birak" style="padding: 0.3rem 0.6rem; border-radius: 6px; background: #8b5cf6;"><span class="icon" style="margin:0;">📢</span></button>
                         `;
                     }
                     return '';
                 })()}
                 <button class="btn-secondary admin-only" onclick="showEditExamModal(${ex.id})" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; border-color: var(--primary); color: var(--primary);">Düzenle</button>
                 <button class="btn-delete admin-only" onclick="deleteExam(${ex.id})">Sil</button>
                 <button class="btn-secondary admin-only" onclick="sendExamMailViaOutlook(${ex.id})" title="Gözetmenlere Mail Gönder" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; background: rgba(14,165,233,0.15); border-color: #0ea5e9; color: #38bdf8;">📧 Mail</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}


let currentScheduleDate = new Date(); // Genel program için seçili ay
let currentScheduleType = 'all'; 
let currentScheduleView = 'list';

window.switchScheduleView = (mode) => {
    currentScheduleView = mode;
    document.getElementById('btn-view-list').classList.toggle('active', mode === 'list');
    document.getElementById('btn-view-calendar').classList.toggle('active', mode === 'calendar');
    
    document.getElementById('schedule-list-view').classList.toggle('hidden', mode !== 'list');
    document.getElementById('schedule-calendar-view').classList.toggle('hidden', mode !== 'calendar');
    
    renderSchedule();
};

window.changeScheduleMonth = (delta) => {
    currentScheduleDate.setMonth(currentScheduleDate.getMonth() + delta);
    renderSchedule();
};

function renderSchedule() {
    const tbodyActive = document.querySelector('#table-schedule tbody');
    const title = document.getElementById('calendar-month-title');
    const grid = document.getElementById('calendar-grid');

    if (!tbodyActive || !title) return;
    
    // Temizle
    tbodyActive.innerHTML = '';
    if (grid) grid.innerHTML = '';

    const year = currentScheduleDate.getFullYear();
    const month = currentScheduleDate.getMonth();
    const nextMonthDate = new Date(year, month + 1, 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = nextMonthDate.getMonth();

    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasim", "Aralik"];
    if (year === nextYear) {
        title.textContent = `${monthNames[month]} - ${monthNames[nextMonth]} ${year}`;
    } else {
        title.textContent = `${monthNames[month]} ${year} - ${monthNames[nextMonth]} ${nextYear}`;
    }

    // Gruplama
    const groups = {};
    const now = new Date();
    
    const personalToggle = document.getElementById('toggle-personal-schedule');
    const isPersonalOnly = personalToggle ? personalToggle.checked : false;
    const myStaffId = localStorage.getItem('myStaffId');
    
    DB.exams.forEach(ex => {
        // Kişiye özel filtre açiksa ve bu sinav bana atanmamişsa atla
        if (isPersonalOnly && myStaffId) {
            const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
            if (!pIds.includes(myStaffId)) return;
        }

        // Tarihi geçmiş sinavlari programda gösterme
        const examDateStr = ex.date || "";
        const examTimeStr = ex.time || "00:00";
        const examDate = getSafeDate(examDateStr, examTimeStr);
        const examEnd = new Date(examDate.getTime() + (ex.duration || 60) * 60000);
        
        if (examEnd < now) return;

        const key = `${ex.type}_${ex.name}_${ex.date}_${ex.time}_${ex.location}`;
        if (!groups[key]) {
            groups[key] = {
                id: ex.id,
                type: ex.type || 'vize',
                name: ex.name,
                date: ex.date,
                time: ex.time,
                duration: ex.duration,
                lecturer: ex.lecturer || "-",
                capacity: ex.capacity || "-",
                location: ex.location || "-",
                isDraft: ex.isDraft,
                proctors: []
            };
        }
        const pNames = (ex.proctorIds || [ex.proctorId]).map(pid => {
            if (!pid) return '';
            const s = DB.staff.find(staff => String(staff.id) === String(pid));
            return s ? s.name : (ex.proctorName || '');
        }).filter(n => n !== '');
        if (pNames.length === 0 && ex.proctorName) {
            pNames.push(ex.proctorName);
        }
        groups[key].proctors.push(...pNames);
    });

    // Tekilleştirme
    Object.keys(groups).forEach(k => {
        groups[k].proctors = [...new Set(groups[k].proctors)];
    });

    const scheduleList = Object.values(groups);
    const searchTerm = document.getElementById('schedule-search')?.value.toLowerCase() || '';

    // Filtreleme (2 Aylik Dönem + Tür + Arama)
    const filteredSchedule = scheduleList.filter(ex => {
        if (!ex.date) return false;
        const d = new Date(ex.date.replace(/-/g, "/"));
        const matchesMonth = (d.getMonth() === month && d.getFullYear() === year) || 
                             (d.getMonth() === nextMonth && d.getFullYear() === nextYear);
        const matchesType = currentScheduleType === 'all' || ex.type === currentScheduleType;
        
        let matchesSearch = true;
        if (searchTerm) {
            matchesSearch = (ex.name || "").toLowerCase().includes(searchTerm) ||
                            (ex.lecturer || "").toLowerCase().includes(searchTerm) ||
                            (ex.proctors || []).some(p => p.toLowerCase().includes(searchTerm)) ||
                            (ex.location || "").toLowerCase().includes(searchTerm);
        }
        
        return matchesMonth && matchesType && matchesSearch;
    });

    // Siralama ve Kategorize Etme
    function getYear(name) {
        const lowerName = name.toLowerCase();
        
        // Açikça (1. Yil, 2. Sinif vb) belirtilmişse öncelikli al
        const explicitMatch = lowerName.match(/(1|2|3|4)\.\s*(yil|sinif)/);
        if (explicitMatch) return parseInt(explicitMatch[1]);
        
        if (lowerName.includes("yüksek lisans") || lowerName.includes("doktora") || lowerName.includes("yl")) return 5;

        // Yüksek Lisans / Doktora: 500 ve üzeri
        if (name.match(/\b(5|6|7|8|9)\d{2}\b/)) return 5;
        
        // Lisans: 100, 200, 300, 400
        const match = name.match(/\b(1|2|3|4)\d{2}\b/);
        if (match) return parseInt(match[1]);
        
        // İsim bazli zorunlu/ortak dersler genelde 1. sinif
        if (lowerName.includes("101") || lowerName.includes("102") || lowerName.includes("106") || lowerName.includes("112") || lowerName.includes("114")) return 1;
        
        // Bulunamayanlar
        return 0;
    }

    filteredSchedule.sort((a, b) => {
        const ya = getYear(a.name);
        const yb = getYear(b.name);
        
        // 0 (Diğer) olanlari en sona atmak için ağirlik(weight) hesapliyoruz
        const weightA = ya === 0 ? 99 : ya;
        const weightB = yb === 0 ? 99 : yb;
        
        if (weightA !== weightB) return weightA - weightB;
        return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    });

    const conflicts = getConflicts();
    const locConflicts = getLocationConflicts();

    // 1. Liste Görünümü Render
    let curYearActive = -1;

    filteredSchedule.forEach(ex => {
        const y = getYear(ex.name);
        
        if (y !== curYearActive) {
            curYearActive = y;
            const trHead = document.createElement('tr');
            trHead.className = 'year-header';
            
            let labelText = "";
            if (y === 5) labelText = "🎓 Yüksek Lisans / Doktora";
            else if (y > 0 && y < 5) labelText = `🏫 ${y}. YIL`;
            else labelText = "📚 Diğer / Ortak Dersler";

            trHead.innerHTML = `<td colspan="11" style="background: rgba(99,102,241,0.15); border-left: 4px solid var(--primary); color: #c7d2fe; padding-left: 1rem; font-weight: 700; letter-spacing: 0.5px;">${labelText}</td>`;
            tbodyActive.appendChild(trHead);
        }

        const tr = document.createElement('tr');
        if (ex.isDraft) tr.classList.add('exam-row-draft');
        const isConflict = DB.exams.some(e => e.name === ex.name && e.date === ex.date && e.time === ex.time && conflicts.has(e.id));
        if (isConflict) tr.classList.add('conflict-row');

        const isLocConflict = DB.exams.some(e => e.name === ex.name && e.date === ex.date && e.time === ex.time && locConflicts.has(e.id));

        const dateObj = new Date(ex.date.replace(/-/g, "/"));
        const dayNames = ["Pazar", "Pazartesi", "Sali", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const dayName = dayNames[dateObj.getDay()];
        const formatString = ex.date.split("-").reverse().join(".") + " " + dayName; 
        
        // Group Key identifier to use for bulk actions instead of a single ID
        const examGroupKey = btoa(encodeURIComponent(`${ex.type}|${ex.name}|${ex.date}|${ex.time}|${ex.location}`));

        tr.innerHTML = `
            <td class="admin-only" style="text-align: center;"><input type="checkbox" class="bulk-check" value="${examGroupKey}" style="cursor: pointer;"></td>
            <td><span class="badge-type type-${ex.type}">${ex.type.toUpperCase()}</span></td>
            <td>
                <span class="clickable-name" onclick="showExamDetail('${ex.name.replace(/'/g, "\\'")}', '${ex.date}', '${ex.time}', '${ex.location.replace(/'/g, "\\'")}')"><strong>${ex.name}</strong></span>
                ${isConflict ? `
                    <span class="conflict-warning" style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:#ef4444; margin-top:4px;">
                        ⚠️ Gözetmen Çakişmasi
                        <button class="btn-primary admin-only" onclick="autoResolveGroupConflict('${examGroupKey}')" style="background:#10b981; padding:2px 6px; font-size:0.65rem; border-radius:4px; border:none;">✨ Auto-Çöz</button>
                    </span>
                ` : ''}
            </td>
            <td>${ex.lecturer}</td>
            <td>${ex.capacity}</td>
            <td class="${isLocConflict ? 'location-conflict' : ''}">
                ${ex.location}
                ${isLocConflict ? '<span class="location-warning" style="display:block; font-size:0.7rem; color:#f59e0b;">⚠️ Derslik Çakişmasi!</span>' : ''}
            </td>
            <td>${formatString}</td>
            <td>${ex.time}</td>
            <td>${ex.duration} dk</td>
            <td class="proctor-list">${ex.proctors.join(', ')}</td>
            <td class="admin-only">
                 <button class="btn-secondary" onclick="showEditScheduleModal('${ex.name.replace(/'/g, "\\'")}', '${ex.date}', '${ex.time}', '${ex.location.replace(/'/g, "\\'")}') " style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; border-color: var(--primary); color: var(--primary);">Düzenle</button>
                 <button class="btn-secondary" onclick="sendScheduleMailViaOutlook('${ex.name.replace(/'/g, "\\'")}','${ex.date}','${ex.time}','${ex.location.replace(/'/g, "\\'")}')" title="Gözetmenlere Mail Gönder" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; background: rgba(14,165,233,0.15); border-color: #0ea5e9; color: #38bdf8;">📧 Mail</button>
            </td>
        `;
        tbodyActive.appendChild(tr);
    });

    if (tbodyActive.children.length === 0) tbodyActive.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--text-muted); padding:2rem;">Bu 2 aylik dönem için sinav programi bulunmuyor.</td></tr>';

    // 2. Takvim Görünümü Render
    if (currentScheduleView === 'calendar' && grid) {
        renderCalendarGrid(filteredSchedule, year, month);
    }
}

function renderCalendarGrid(exams, year, month) {
    const mainGrid = document.getElementById('calendar-grid');
    if (!mainGrid) return;
    mainGrid.innerHTML = '';

    // 2 ayi alt alta modern kartlar halinde yerleştirecek yapi
    mainGrid.style.display = 'flex';
    mainGrid.style.flexDirection = 'column';
    mainGrid.style.gap = '2.5rem';
    mainGrid.className = ''; // calendar-grid CSS izgara sinifini iptal edip iç bloklara veriyoruz

    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasim", "Aralik"];

    // İki aylik döngü (seçilen ay ve hemen sonraki ay)
    for (let offset = 0; offset <= 1; offset++) {
        const targetDate = new Date(year, month + offset, 1);
        const curYear = targetDate.getFullYear();
        const curMonth = targetDate.getMonth();

        const monthBox = document.createElement('div');
        monthBox.className = 'month-calendar-box';
        monthBox.style.background = 'rgba(255, 255, 255, 0.02)';
        monthBox.style.padding = '1.5rem';
        monthBox.style.borderRadius = '16px';
        monthBox.style.border = '1px solid var(--glass-border)';
        monthBox.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.25)';

        const heading = document.createElement('h3');
        heading.style.textAlign = 'center';
        heading.style.margin = '0 0 1.2rem 0';
        heading.style.color = 'var(--primary)';
        heading.style.fontSize = '1.25rem';
        heading.style.fontWeight = '700';
        heading.style.letterSpacing = '0.05em';
        heading.textContent = `${monthNames[curMonth]} ${curYear}`;
        monthBox.appendChild(heading);

        const subGrid = document.createElement('div');
        subGrid.className = 'calendar-grid';

        const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
        dayNames.forEach(d => {
            const div = document.createElement('div');
            div.className = 'calendar-day-head';
            div.textContent = d;
            subGrid.appendChild(div);
        });

        const firstDay = new Date(curYear, curMonth, 1);
        let startDayIdx = (firstDay.getDay() + 6) % 7; // Pzt=0
        const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(curYear, curMonth, 0).getDate();

        // Önceki Ay
        for (let i = startDayIdx - 1; i >= 0; i--) {
            subGrid.appendChild(createScheduleDayCell(daysInPrevMonth - i, true));
        }

        // Bu Ay
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const dayExams = exams.filter(e => e.date === dateStr);
            subGrid.appendChild(createScheduleDayCell(d, false, isToday, dayExams));
        }

        // Gelecek Ay
        const totalCells = subGrid.children.length - 7;
        const remaining = 42 - totalCells;
        for (let i = 1; i <= remaining; i++) {
            subGrid.appendChild(createScheduleDayCell(i, true));
        }

        monthBox.appendChild(subGrid);
        mainGrid.appendChild(monthBox);
    }
}

function createScheduleDayCell(day, isOtherMonth, isToday = false, dayExams = []) {
    const cell = document.createElement('div');
    cell.className = `calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`;
    
    cell.innerHTML = `<div class="day-number">${day}</div>`;
    
    if (!isOtherMonth && dayExams.length > 0) {
        const container = document.createElement('div');
        container.className = 'calendar-events';
        dayExams.forEach(ex => {
            const ev = document.createElement('div');
            ev.className = `calendar-event type-${ex.type}`;
            ev.textContent = `${ex.time} ${ex.name}`;
            ev.title = `${ex.name} - ${ex.location}`;
            ev.onclick = (e) => {
                e.stopPropagation();
                showExamDetail(ex.name, ex.date, ex.time, ex.location);
            };
            container.appendChild(ev);
        });
        cell.appendChild(container);
    }
    
    return cell;
}

/**
 * Genel Sinav Programinda Sekme Değiştirme
 */
window.switchGeneralScheduleTab = (tabName) => {
    const btnActive = document.getElementById('tab-gen-btn-active');
    const btnArchive = document.getElementById('tab-gen-btn-archive');
    
    if (tabName === 'active') {
        btnActive.classList.add('active');
        btnArchive.classList.remove('active');
        document.getElementById('tab-gen-content-active').classList.add('active');
        document.getElementById('tab-gen-content-archive').classList.remove('active');
    } else {
        btnActive.classList.remove('active');
        btnArchive.classList.add('active');
        document.getElementById('tab-gen-content-active').classList.remove('active');
        document.getElementById('tab-gen-content-archive').classList.add('active');
    }
};

function getCourseCatalogOptionsHtml() {
    const catalog = (typeof getCourseCatalog === 'function') ? getCourseCatalog() : (DB.courseCatalog || DEFAULT_COURSE_CATALOG || []);
    const examNames = (DB.exams || []).map(e => e.name).filter(Boolean);
    
    const set = new Set();
    // 1. Formatlanmiş tam ad, kod ve ders adi
    catalog.forEach(c => {
        set.add(`${c.code} - ${c.name}`);
        set.add(c.code);
        set.add(c.name);
    });
    // 2. Sistemde kayitli mevcut sinav adlari
    examNames.forEach(n => set.add(n));

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr')).map(val => `<option value="${val}">`).join('');
}

// Global aktif katalog seçim hedefleri
window._activeCatalogTargetNameInput = 'exam-name';
window._activeCatalogTargetLecturerInput = 'exam-lecturer';
window._currentCatalogFilter = 'all';

window.openCourseCatalogPicker = function(nameInputId = 'exam-name', lecturerInputId = 'exam-lecturer') {
    window._activeCatalogTargetNameInput = nameInputId;
    window._activeCatalogTargetLecturerInput = lecturerInputId;
    
    const modal = document.getElementById('modal-course-catalog');
    if (!modal) return;
    
    const searchInput = document.getElementById('catalog-picker-search');
    if (searchInput) {
        searchInput.value = '';
        if (!searchInput._hasInputListener) {
            searchInput.addEventListener('input', (e) => {
                renderCourseCatalogPickerList(window._currentCatalogFilter, e.target.value);
            });
            searchInput._hasInputListener = true;
        }
    }
    
    window._currentCatalogFilter = 'all';
    const tabBtns = document.querySelectorAll('#catalog-picker-tabs button');
    tabBtns.forEach(btn => btn.classList.remove('active'));
    if (tabBtns[0]) tabBtns[0].classList.add('active');

    renderCourseCatalogPickerList('all', '');
    modal.classList.remove('hidden');
    if (searchInput) searchInput.focus();
};

window.closeCourseCatalogPicker = function() {
    const modal = document.getElementById('modal-course-catalog');
    if (modal) modal.classList.add('hidden');
};

window.filterCatalogPicker = function(yearFilter, btnEl) {
    window._currentCatalogFilter = yearFilter;
    const tabBtns = document.querySelectorAll('#catalog-picker-tabs button');
    tabBtns.forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    
    const searchVal = document.getElementById('catalog-picker-search')?.value || '';
    renderCourseCatalogPickerList(yearFilter, searchVal);
};

window.renderCourseCatalogPickerList = function(yearFilter = 'all', searchQuery = '') {
    const container = document.getElementById('catalog-picker-list');
    const countEl = document.getElementById('catalog-picker-count');
    if (!container) return;
    
    const catalog = (typeof getCourseCatalog === 'function') ? getCourseCatalog() : (DB.courseCatalog || DEFAULT_COURSE_CATALOG || []);
    const q = searchQuery.trim().toLowerCase();
    
    const filtered = catalog.filter(c => {
        if (yearFilter !== 'all') {
            if (yearFilter === 'Servis') {
                if (c.year !== 'Servis') return false;
            } else {
                if (parseInt(c.year) !== parseInt(yearFilter)) return false;
            }
        }
        if (q) {
            const matchCode = c.code.toLowerCase().includes(q);
            const matchName = c.name.toLowerCase().includes(q);
            const matchLang = (c.lang || '').toLowerCase().includes(q);
            const matchTerm = (c.term || '').toLowerCase().includes(q);
            const matchLecturer = (c.lecturer || '').toLowerCase().includes(q);
            if (!matchCode && !matchName && !matchLang && !matchTerm && !matchLecturer) return false;
        }
        return true;
    });
    
    if (countEl) {
        countEl.textContent = `${filtered.length} / ${catalog.length} ders listeleniyor`;
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 30px;">
                🔍 Arama kriterine uygun ders bulunamadi.
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(c => {
        const fullTitle = `${c.code} - ${c.name}`;
        const yearBadge = c.year === 'Servis' ? '🏛️ Servis' : `🎓 ${c.year}. Sinif`;
        const typeColor = c.type === 'Zorunlu' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)';
        const typeBorder = c.type === 'Zorunlu' ? '#6366f1' : '#10b981';
        const typeText = c.type === 'Zorunlu' ? '#a5b4fc' : '#6ee7b7';
        
        return `
            <div onclick="selectCourseFromPicker('${c.code.replace(/'/g, "\\'")}', '${c.name.replace(/'/g, "\\'")}')" 
                style="background: rgba(255,255,255,0.04); border: 1px solid var(--glass-border); border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: all 0.2s ease; display: flex; flex-direction: column; justify-content: space-between;"
                onmouseover="this.style.borderColor='#38bdf8'; this.style.background='rgba(56,189,248,0.08)';"
                onmouseout="this.style.borderColor='var(--glass-border)'; this.style.background='rgba(255,255,255,0.04)';">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; margin-bottom: 4px;">
                        <span style="font-weight: 700; color: #38bdf8; font-size: 0.95rem;">${c.code}</span>
                        <span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: ${typeColor}; border: 1px solid ${typeBorder}; color: ${typeText};">${c.type || 'Zorunlu'}</span>
                    </div>
                    <div style="font-weight: 600; font-size: 0.88rem; color: white; margin-bottom: 6px; line-height: 1.25;">${c.name}</div>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 6px; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>${yearBadge}</span>
                        <span>🌐 ${c.lang || 'İngilizce'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; color: #94a3b8;">
                        <span>📅 ${c.term || '-'}</span>
                        <span>⭐ ${c.credit ? c.credit + ' Kredi' : ''} ${c.akts ? '/ ' + c.akts + ' AKTS' : ''}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

window.selectCourseFromPicker = function(courseCode, courseName) {
    const targetNameInput = document.getElementById(window._activeCatalogTargetNameInput);
    if (targetNameInput) {
        targetNameInput.value = `${courseCode} - ${courseName}`;
        targetNameInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    closeCourseCatalogPicker();
};

function showAddExamModal() {
    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Yeni Sinav Ekle";

    // Eğer DB.lecturers bir şekilde boş kalmişsa, hardcoded değerleri geri getir (Güvenlik önlemi)
    if (!DB.lecturers || DB.lecturers.length === 0) {
        console.warn("DB.lecturers boş, varsayilanlar yükleniyor...");
        DB.lecturers = [
            { name: "Mustafa AKKURT", title: "Prof. Dr." },
            { name: "Nuri ÇELİK", title: "Prof. Dr." },
            { name: "Oğul ESEN", title: "Prof. Dr." },
            { name: "Mansur İSGENDEROĞLU (İSMAİLOV)", title: "Prof. Dr." },
            { name: "Emil NOVRUZ", title: "Prof. Dr." },
            { name: "Sibel ÖZKAN", title: "Prof. Dr." },
            { name: "Serkan SÜTLÜ", title: "Prof. Dr." },
            { name: "Coşkun YAKAR (Bölüm Başkani)", title: "Prof. Dr." },
            { name: "Nursel EREY", title: "Doç. Dr." },
            { name: "Gülden GÜN POLAT", title: "Doç. Dr." },
            { name: "Feray HACIVELİOĞLU", title: "Doç. Dr." },
            { name: "Roghayeh HAFEZIEH", title: "Doç. Dr." },
            { name: "Fatma KARAOĞLU CEYHAN", title: "Doç. Dr." },
            { name: "Ayten KOÇ", title: "Doç. Dr." },
            { name: "Işil ÖNER", title: "Doç. Dr." },
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
            { name: "Zeynep Karadeniz Cisdik", title: "Öğr. Gör." },
            { name: "Orkun Canbek", title: "Öğr. Gör." },
            { name: "Oğuzhan DURSUN", title: "Öğr. Gör. Dr." },
            { name: "Pelin Ayşe GÖKGÖZ", title: "Araş. Gör. Dr." },
            { name: "Eda GOLDENBERG", title: "Doç. Dr." }
        ];
    }
    
    // Eski seçimleri temizle
    window.selectedProctorId = null;
    
    fields.innerHTML = `
        <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="margin:0;">Sinav Türü</label>
                <button type="button" class="btn-icon" onclick="openTypeManager()" style="font-size:0.8rem; padding:2px 5px; opacity:0.7;">⚙️ Yönet</button>
            </div>
            <select id="exam-type" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: 8px; color: white;">
                ${(DB.examTypes || []).map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 10px;">
                <input type="checkbox" id="exam-is-non-exam" style="width: 16px; height: 16px;">
                <label for="exam-is-non-exam" style="margin: 0; cursor: pointer; color: var(--accent-orange);">Sinav Dişi Görev (Sadece Görev Puanini Etkiler)</label>
            </div>
        </div>
        <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="margin:0;">Sinav/Ders Adi</label>
                <button type="button" class="btn-icon" onclick="openCourseCatalogPicker('exam-name', 'exam-lecturer')" style="font-size:0.8rem; padding:2px 8px; background:rgba(14,165,233,0.2); border:1px solid #0284c7; color:#38bdf8; border-radius:4px; cursor:pointer;">📚 Katalogdan Seç</button>
            </div>
            <input type="text" id="exam-name" list="exam-memory-list" placeholder="Örn: MAT 101 veya MATH 101" required autocomplete="off">
            <datalist id="exam-memory-list">
                ${getCourseCatalogOptionsHtml()}
            </datalist>
            <div id="add-exam-catalog-info" style="display:none; font-size:0.75rem; color:#38bdf8; margin-top:4px; padding:5px 8px; background:rgba(14,165,233,0.1); border-radius:6px; border:1px solid rgba(14,165,233,0.25);"></div>
            <small style="color:var(--text-muted); font-size:0.75rem; margin-top:4px; display:block;">
               💡 <b>Katalog Eşleşmesi:</b> Ders kodunu veya adini yazdiğinizda sistem dersi otomatik tanir ve sorumlu hocayi seçer.
            </small>
        </div>
        <div class="form-group">
            <label>Dersi Veren Hoca</label>
            <select id="exam-lecturer" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: 8px; color: white;">
                <option value="-">Seçin...</option>
                ${(DB.lecturers || []).map(l => `<option value="${l.title} ${l.name}">${l.title} ${l.name}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Sinif Mevcudu</label>
            <input type="number" id="exam-capacity" placeholder="Örn: 250">
        </div>
        <div class="form-group">
            <label>Sinav Tarihi</label>
            <input type="date" id="exam-date" required>
        </div>
        <div class="form-group">
            <label>Başlangiç Saati</label>
            <input type="time" id="exam-time" required>
        </div>
        <div class="form-group">
            <label>Süre (Dakika)</label>
            <input type="number" id="exam-duration" value="60" required>
        </div>
        <div class="form-group">
            <label>Derslik / Yer Bilgisi</label>
            <input type="text" id="exam-location" placeholder="Örn: Amfi 2">
        </div>
        <div class="form-group">
            <label>Gözetmen Ekle</label>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <select id="exam-proctor-select" style="flex:1; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: 8px; color: white;"></select>
                <button type="button" class="btn-primary" onclick="addProctorToAddList()" style="padding:0 1.25rem;">Ekle</button>
            </div>
            <div id="add-proctor-list" style="display:grid; gap:8px; max-height:150px; overflow-y:auto; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid var(--glass-border);">
                <!-- Seçili gözetmenler buraya gelecek -->
            </div>
        </div>
        <div id="add-suggestions" class="suggestion-area hidden">
            <h4>🤖 Akilli Öneriler</h4>
            <div id="add-suggestion-list" class="suggestion-list"></div>
        </div>
    `;
    modal.classList.remove('hidden');

    const updateAddSuggestions = () => {
        const d = document.getElementById('exam-date').value;
        const t = document.getElementById('exam-time').value;
        const dur = parseInt(document.getElementById('exam-duration').value) || 60;
        const isNonExam = document.getElementById('exam-is-non-exam')?.checked || false;
        const name = document.getElementById('new-exam-name')?.value || "";
        updateSuggestionsUI(d, t, dur, 'add-suggestions', 'add-suggestion-list', null, null, isNonExam, name);
    };

    document.getElementById('exam-date').addEventListener('change', updateAddSuggestions);
    document.getElementById('exam-time').addEventListener('change', updateAddSuggestions);
    document.getElementById('exam-duration').addEventListener('input', updateAddSuggestions);
    const cbAdd = document.getElementById('exam-is-non-exam');
    if (cbAdd) cbAdd.addEventListener('change', updateAddSuggestions);

    // --- KURS HAFIZASI VE DERS KATALOĞU ENTEGRASYONU ---
    document.getElementById('exam-name').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const infoBadge = document.getElementById('add-exam-catalog-info');
        if (!val) {
            if (infoBadge) { infoBadge.style.display = 'none'; infoBadge.innerHTML = ''; }
            return;
        }

        const selectL = document.getElementById('exam-lecturer');
        const capInput = document.getElementById('exam-capacity');
        const locInput = document.getElementById('exam-location');
        const durInput = document.getElementById('exam-duration');

        /**
         * Hoca adini select option'lardan bulup seçer.
         * Önce tam eşleşme, sonra kismi eşleşme dener.
         * @param {string} lecturerName  - Seçilecek hocanin adi (ünvan dahil veya hariç)
         * @param {boolean} force        - true ise mevcut seçimi sifirlayip yeniden atar
         */
        function autoSelectLecturer(lecturerName, force = true) {
            if (!lecturerName || !selectL) return false;
            const needle = lecturerName.trim().toLowerCase();
            // 1. Tam eşleşme
            for (let i = 0; i < selectL.options.length; i++) {
                if (selectL.options[i].value.trim().toLowerCase() === needle) {
                    selectL.selectedIndex = i;
                    // Görsel ipucu: select'i kisa süre vurgula
                    selectL.style.borderColor = '#10b981';
                    selectL.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.25)';
                    setTimeout(() => { selectL.style.borderColor = ''; selectL.style.boxShadow = ''; }, 1800);
                    return true;
                }
            }
            // 2. Kismi eşleşme: option içinde needle var mi? veya needle içinde option var mi?
            for (let i = 0; i < selectL.options.length; i++) {
                const opt = selectL.options[i].value.trim().toLowerCase();
                if (opt.includes(needle) || needle.includes(opt)) {
                    selectL.selectedIndex = i;
                    selectL.style.borderColor = '#10b981';
                    selectL.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.25)';
                    setTimeout(() => { selectL.style.borderColor = ''; selectL.style.boxShadow = ''; }, 1800);
                    return true;
                }
            }
            // 3. Soyadi ile eşleşme — sadece soyadin son parçasini karşilaştir
            const needleParts = needle.split(' ').filter(p => p.length > 2);
            for (let i = 0; i < selectL.options.length; i++) {
                const opt = selectL.options[i].value.trim().toLowerCase();
                if (needleParts.some(part => opt.includes(part))) {
                    selectL.selectedIndex = i;
                    selectL.style.borderColor = '#f59e0b';
                    selectL.style.boxShadow = '0 0 0 2px rgba(245,158,11,0.2)';
                    setTimeout(() => { selectL.style.borderColor = ''; selectL.style.boxShadow = ''; }, 1800);
                    return true;
                }
            }
            return false;
        }

        // 1. Resmi Ders Kataloğunda ara
        const catCourse = (typeof findCourseInCatalog === 'function') ? findCourseInCatalog(val) : null;
        if (catCourse && infoBadge) {
            infoBadge.style.display = 'block';
            infoBadge.innerHTML = `📘 <b>${catCourse.code} - ${catCourse.name}</b> &nbsp;|&nbsp; 🌐 ${catCourse.lang} &nbsp;|&nbsp; 📅 ${catCourse.term} &nbsp;|&nbsp; ⭐ ${catCourse.credit} Kredi / ${catCourse.akts} AKTS &nbsp;(${catCourse.type})`;
            
            // Dersin sorumlu hocasini çoklu kaynaktan belirle
            const lecturerToSelect =
                catCourse.lecturer ||
                (DB.courseLecturers && (
                    DB.courseLecturers[`${catCourse.code} - ${catCourse.name}`] ||
                    DB.courseLecturers[catCourse.code] ||
                    DB.courseLecturers[catCourse.name]
                )) ||
                (DB.courseLecturers && DB.courseLecturers[val]);

            // Hoca bulunduysa her zaman güncelle (mevcut seçimden bağimsiz)
            if (lecturerToSelect) {
                autoSelectLecturer(lecturerToSelect, true);
            }
        } else if (infoBadge) {
            infoBadge.style.display = 'none';
            infoBadge.innerHTML = '';
        }

        // 2. Geçmiş sinavlarda bu isimde bir kayit varsa o kayittan hoca ve diğer bilgileri al
        const pastExams = DB.exams.filter(ex => ex.name.toLowerCase() === val.toLowerCase());
        if (pastExams.length > 0) {
            const latest = pastExams[pastExams.length - 1];
            // Hoca: katalog eşleşmesi bulamazdiysa geçmiş sinavdan al
            if (latest.lecturer && (!catCourse || !catCourse.lecturer)) {
                autoSelectLecturer(latest.lecturer, false);
            }
            if (latest.capacity && capInput && !capInput.value) capInput.value = latest.capacity;
            if (latest.location && locInput && !locInput.value) locInput.value = latest.location;
            if (latest.duration && durInput && durInput.value === '60') durInput.value = latest.duration;
        } else if (!catCourse) {
            // 3. Katalogda da geçmiş sinavlarda da yoksa DB.courseLecturers doğrudan dene
            const lecturerName = DB.courseLecturers && DB.courseLecturers[val];
            if (lecturerName) autoSelectLecturer(lecturerName, true);
        }
    });

    window.addProctorToAddListManually = (id) => {
        if (!window.tempSelectedProctors.includes(id)) {
            window.tempSelectedProctors.push(id);
            renderTempProctorList();
            updateProctorSelect();
            updateAddSuggestions();
        }
    };

    document.getElementById('modal-form').onsubmit = (e) => {
        e.preventDefault();
        const examData = {
            isNonExam: document.getElementById('exam-is-non-exam')?.checked || false,
            type: document.getElementById('exam-type').value,
            name: document.getElementById('exam-name').value,
            lecturer: document.getElementById('exam-lecturer').value,
            capacity: document.getElementById('exam-capacity').value,
            location: document.getElementById('exam-location').value,
            date: document.getElementById('exam-date').value,
            time: document.getElementById('exam-time').value,
            duration: parseInt(document.getElementById('exam-duration').value),
            proctorIds: window.tempSelectedProctors || []
        };

        // Müsaitlik kontrolü (Seçili tüm hocalar için)
        for (const pid of examData.proctorIds) {
            const staff = DB.staff.find(s => s.id === pid);
            if (staff && !isAvailable(staff.name, examData.date, examData.time, examData.duration)) {
                if (!confirm(`${staff.name} bu saatte müsait değil! Yine de devam etmek istiyor musunuz?`)) return;
            }
        }

        addExam(examData);
        
        window.tempSelectedProctors = [];
        
        hideModal();
        renderExams();
        renderSchedule();
        renderDashboard();
        updateNotificationBadge();
    };

    // Proctor selection setup
    window.tempSelectedProctors = [];
    const updateProctorSelect = () => {
        const select = document.getElementById('exam-proctor-select');
        select.innerHTML = `<option value="">Hoca Seçin...</option>` + DB.staff
            .filter(s => !window.tempSelectedProctors.includes(s.id))
            .sort((a,b) => a.name.localeCompare(b.name, 'tr'))
            .map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    };

    window.addProctorToAddList = () => {
        const select = document.getElementById('exam-proctor-select');
        const id = parseInt(select.value);
        if (id && !window.tempSelectedProctors.includes(id)) {
            window.tempSelectedProctors.push(id);
            renderTempProctorList();
            updateProctorSelect();
            updateAddSuggestions();
        }
    };

    window.removeProctorFromAddList = (id) => {
        window.tempSelectedProctors = window.tempSelectedProctors.filter(pid => pid !== id);
        renderTempProctorList();
        updateProctorSelect();
        updateAddSuggestions();
    };

    const renderTempProctorList = () => {
        const list = document.getElementById('add-proctor-list');
        list.innerHTML = window.tempSelectedProctors.map(id => {
            const staff = DB.staff.find(s => String(s.id) === String(id));
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:6px 10px; border-radius:6px; border:1px solid var(--glass-border);">
                    <span style="font-size:0.85rem;">${staff ? staff.name : '???'}</span>
                    <button type="button" class="btn-icon" onclick="removeProctorFromAddList(${id})" style="color:var(--accent-red); font-size:1rem; filter:grayscale(1) brightness(2);">🗑️</button>
                </div>
            `;
        }).join('') || '<div style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:10px;">Henüz hoca seçilmedi</div>';
    };

    updateProctorSelect();
    renderTempProctorList();
    updateAddSuggestions();
}

function hideModal() {
    document.getElementById('modal').classList.add('hidden');
}

/**
 * Sinav gözetmenlerine Outlook üzerinden mail gönder (mailto: linki ile)
 */
window.sendExamMailViaOutlook = (examId) => {
    const exam = DB.exams.find(e => String(e.id) === String(examId));
    if (!exam) return;

    // Tüm gözetmenleri bul
    const proctorIds = exam.proctorIds || (exam.proctorId ? [exam.proctorId] : []);
    const proctors = proctorIds
        .map(pid => DB.staff.find(s => String(s.id) === String(pid)))
        .filter(Boolean);

    if (proctors.length === 0) {
        alert('Bu sinava atanmiş gözetmen bulunamadi.');
        return;
    }

    // E-postasi olmayan gözetmenler varsa uyar
    const noEmail = proctors.filter(p => !p.email);
    if (noEmail.length > 0) {
        const names = noEmail.map(p => p.name).join(', ');
        if (!confirm(`⚠️ Şu kişilerin e-posta adresi eksik: ${names}\n\nDevam etmek istiyor musunuz?`)) return;
    }

    const emailList = proctors.map(p => p.email).filter(Boolean).join(';');
    if (!emailList) {
        alert('Atanmiş gözetmenlerin hiçbirinin e-posta adresi girilmemiş.\nPersonel sekmesinden e-posta adreslerini ekleyin.');
        return;
    }

    const gozetmenler = proctors.map(p => p.name).join(', ');
    const scoreText = typeof exam.score === 'number' ? exam.score.toFixed(1) : (exam.score || '-');
    const siteUrl = (typeof window.getSystemUrl === 'function') ? window.getSystemUrl() : (window.location.origin + window.location.pathname);

    const subject = `📅 Yeni Gözetmenlik Görevi: ${exam.name} | ${exam.date}`;

    const body = `Sayin Hocam,
 
${exam.date} tarihinde saat ${exam.time}'de yapilacak olan "${exam.name}" sinavina gözetmen olarak atandiniz.
 
SINAV BİLGİLERİ
----------------------------
📚 Sinav Adi : ${exam.name}
👨‍🏫 Dersi Veren : ${exam.lecturer || '-'}
📅 Tarih : ${exam.date}
🕒 Saat : ${exam.time}
🏫 Derslik : ${exam.location || '-'}
⏱ Süre : ${exam.duration} dakika
👥 Gözetmenler: ${gozetmenler}
⭐ Puan : ${scoreText}
----------------------------

🌐 SİSTEME ERİŞİM VE PROGRAM TAKİBİ:
Sinav detaylarina ve kişisel programiniza aşağidaki web adresinden ulaşabilirsiniz:
${siteUrl}

⚠️ GÖREV DEĞİŞİKLİĞİ YAPMAK İÇİN:
Görevinizde değişiklik yapmak istediğinizde sisteme (${siteUrl}) giriş yaparak "Profilim" sekmesinden uygun bir kişiyi kendiniz araştirip, "Takas Teklifi Gönder" veya "Görevi Pazar Yeri'ne Birak" seçeneğini kullanarak değişikliği kendiniz gerçekleştirebilirsiniz. Herhangi bir yönetici onayina gerek yoktur.

İyi çalişmalar dileriz.
GTU Matematik Bölümü - Gözetmenlik Sistemi
${siteUrl}`;

    // Gizli link oluştur ve tikla (sayfa yenilenmeden Outlook açilir)
    const mailtoLink = `mailto:${encodeURIComponent(emailList)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement('a');
    a.href = mailtoLink;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);

    logAction('admin', 'Mail Gönderim', `"${exam.name}" sinavi için ${proctors.length} gözetmene Outlook üzerinden mail hazirlandi.`);

    // Bildirim durumunu güncelle (gönderilen gözetmenleri işaretle)
    if (!exam.notifiedStaffIds) exam.notifiedStaffIds = [];
    proctors.forEach(p => {
        if (!exam.notifiedStaffIds.map(String).includes(String(p.id))) {
            exam.notifiedStaffIds.push(p.id);
        }
    });
    saveToLocalStorage();
    renderExams();
};

/**
 * Sinav Programi tablosundan (isim+tarih+saat+yer) gözetmenlere Outlook üzerinden mail gönder
 */
window.sendScheduleMailViaOutlook = (examName, examDate, examTime, examLocation) => {
    // Gruba dahil olan tüm sinavlari bul (ayni ad+tarih+saat+yer)
    const matchingExams = DB.exams.filter(e =>
        e.name === examName && e.date === examDate && e.time === examTime && e.location === examLocation
    );

    if (matchingExams.length === 0) { alert('Sinav bulunamadi.'); return; }

    // Tüm gözetmen ID'lerini topla (tekrarsiz)
    const allProctorIds = [...new Set(matchingExams.flatMap(e => e.proctorIds || (e.proctorId ? [e.proctorId] : [])))];
    const proctors = allProctorIds.map(pid => DB.staff.find(s => String(s.id) === String(pid))).filter(Boolean);

    if (proctors.length === 0) { alert('Bu sinava atanmiş gözetmen bulunamadi.'); return; }

    // E-postasi eksik olanlari kontrol et
    const noEmail = proctors.filter(p => !p.email);
    if (noEmail.length > 0) {
        const names = noEmail.map(p => p.name).join(', ');
        if (!confirm(`⚠️ E-posta adresi eksik: ${names}\n\nDevam edilsin mi?`)) return;
    }

    const emailList = proctors.map(p => p.email).filter(Boolean).join(';');
    if (!emailList) { alert('Gözetmenlerin e-posta adresi girilmemiş.'); return; }

    const refExam = matchingExams[0];
    const gozetmenler = proctors.map(p => p.name).join(', ');
    const scoreText = typeof refExam.score === 'number' ? refExam.score.toFixed(1) : (refExam.score || '-');
    const siteUrl = (typeof window.getSystemUrl === 'function') ? window.getSystemUrl() : (window.location.origin + window.location.pathname);

    const subject = `📅 Yeni Gözetmenlik Görevi: ${examName} | ${examDate}`;
    const body = `Sayin Hocam,
 
${examDate} tarihinde saat ${examTime}'de yapilacak olan "${examName}" sinavina gözetmen olarak atandiniz.
 
SINAV BİLGİLERİ
----------------------------
📚 Sinav Adi : ${examName}
👨‍🏫 Dersi Veren : ${refExam.lecturer || '-'}
📅 Tarih : ${examDate}
🕒 Saat : ${examTime}
🏫 Derslik : ${examLocation || '-'}
⏱ Süre : ${refExam.duration} dakika
👥 Gözetmenler: ${gozetmenler}
⭐ Puan : ${scoreText}
----------------------------

🌐 SİSTEME ERİŞİM VE PROGRAM TAKİBİ:
Sinav detaylarina ve kişisel programiniza aşağidaki web adresinden ulaşabilirsiniz:
${siteUrl}

⚠️ GÖREV DEĞİŞİKLİĞİ YAPMAK İÇİN:
Görevinizde değişiklik yapmak istediğinizde sisteme (${siteUrl}) giriş yaparak "Profilim" sekmesinden uygun bir kişiyi kendiniz araştirip, "Takas Teklifi Gönder" veya "Görevi Pazar Yeri'ne Birak" seçeneğini kullanarak değişikliği kendiniz gerçekleştirebilirsiniz. Herhangi bir yönetici onayina gerek yoktur.

İyi çalişmalar dileriz.
GTU Matematik Bölümü - Gözetmenlik Sistemi
${siteUrl}`;

    const mailtoLink = `mailto:${encodeURIComponent(emailList)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Gizli link oluştur ve tikla (sayfa yenilenmeden Outlook açilir)
    const a = document.createElement('a');
    a.href = mailtoLink;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);

    logAction('admin', 'Mail Gönderim', `"${examName}" sinavi için ${proctors.length} gözetmene Outlook üzerinden mail hazirlandi.`);
};

/**
 * Sinav iptali durumunda gözetmene Outlook üzerinden mail gönder (mailto: linki ile)
 */
window.sendCancelMailViaOutlook = (staffId, exam) => {
    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff || !staff.email) {
        alert('Bu gözetmenin e-posta adresi eksik.\nPersonel sekmesinden e-posta adresini ekleyin.');
        return;
    }

    const siteUrl = (typeof window.getSystemUrl === 'function') ? window.getSystemUrl() : (window.location.origin + window.location.pathname);
    const subject = `❌ Görev İptal Edildi: ${exam.name} | ${exam.date}`;
    
    let body = `Sayin ${staff.name} Hocam,
 
Atandiğiniz sinavdaki gözetmenlik göreviniz iptal edilmiştir. Bilgileri aşağida bulabilirsiniz.
 
SINAV BİLGİLERİ
----------------------------
📚 Sinav Adi   : ${exam.name}
👨‍🏫 Dersi Veren : ${exam.lecturer || '-'}
📅 Tarih       : ${exam.date}
🕒 Saat        : ${exam.time}
🏫 Derslik     : ${exam.location || '-'}
⏱ Süre        : ${exam.duration} dakika
----------------------------

🌐 SİSTEME GİRİŞ:
Güncel sinav görevlerinizi görüntülemek için:
${siteUrl}
 
Bu mesaj Gözetmenlik Takip ve Atama Sistemi üzerinden hazirlanmiştir.
İyi çalişmalar dileriz.
GTU Matematik Bölümü - Gözetmenlik Sistemi
${siteUrl}`;

    // E-posta şablonlarindan temizlenmiş düz yazi kullanmaya çaliş (varsa)
    if (DB.templates && DB.templates.cancel_email_body) {
        let tempText = DB.templates.cancel_email_body;
        // HTML to plain text conversion
        tempText = tempText.replace(/<br\s*\/?>/gi, '\n');
        tempText = tempText.replace(/<\/p>/gi, '\n\n');
        tempText = tempText.replace(/<\/tr>/gi, '\n');
        tempText = tempText.replace(/<[^>]+>/g, '');
        tempText = tempText.replace(/&nbsp;/g, ' ');
        tempText = tempText.replace(/&#10060;/g, '❌');
        tempText = tempText.replace(/&#128218;/g, '📚');
        tempText = tempText.replace(/&#128100;/g, '👨‍🏫');
        tempText = tempText.replace(/&#128197;/g, '📅');
        tempText = tempText.replace(/&#128336;/g, '🕒');
        tempText = tempText.replace(/&#127979;/g, '🏫');

        const proctorIds = exam.proctorIds || (exam.proctorId ? [exam.proctorId] : []);
        const gozetmenler = proctorIds
            .map(pid => { const s = DB.staff.find(x => String(x.id) === String(pid)); return s ? s.name : ''; })
            .filter(n => n)
            .join(', ') || exam.proctorName || '-';

        body = tempText
            .replace(/{personel_adi}/g, staff.name)
            .replace(/{sinav_adi}/g, exam.name || '-')
            .replace(/{dersi_veren}/g, exam.lecturer || '-')
            .replace(/{tarih}/g, exam.date || '-')
            .replace(/{saat}/g, exam.time || '-')
            .replace(/{derslik}/g, exam.location || '-')
            .replace(/{sure}/g, exam.duration || '-')
            .replace(/{puan}/g, typeof exam.score === 'number' ? exam.score.toFixed(1) : (exam.score || '-'))
            .replace(/{gozetmenler}/g, gozetmenler)
            .replace(/{site_url}/g, siteUrl)
            .replace(/{system_url}/g, siteUrl);
    }

    const mailtoLink = `mailto:${encodeURIComponent(staff.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement('a');
    a.href = mailtoLink;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);

    logAction('admin', 'Mail Gönderim', `"${exam.name}" sinavi iptali için ${staff.name} hocaya Outlook üzerinden mail hazirlandi.`);
};

window.removeProctorAndSendCancelMail = (staffId) => {
    const examId = document.getElementById('edit-exam-id').value;
    const exam = DB.exams.find(e => String(e.id) === String(examId));
    if (!exam) return;
    
    const staff = DB.staff.find(s => s.id === staffId);
    if (!staff) return;
    
    if (confirm(`"${staff.name}" hocayi gözetmenlikten çikarip iptal maili hazirlamak istiyor musunuz?`)) {
        window.sendCancelMailViaOutlook(staffId, exam);
        window.removeProctorFromEditList(staffId);
    }
};


window.sendSingleProctorMailViaOutlook = (examId, staffId) => {
    const exam = DB.exams.find(e => String(e.id) === String(examId));
    if (!exam) return;
    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff || !staff.email) {
        alert('Bu gözetmenin e-posta adresi eksik.\nPersonel sekmesinden e-posta adresini ekleyin.');
        return;
    }

    const siteUrl = (typeof window.getSystemUrl === 'function') ? window.getSystemUrl() : (window.location.origin + window.location.pathname);
    const gozetmenler = (exam.proctorIds || [exam.proctorId])
        .map(pid => { const s = DB.staff.find(x => String(x.id) === String(pid)); return s ? s.name : ''; })
        .filter(n => n)
        .join(', ') || exam.proctorName || '-';

    const scoreText = typeof exam.score === 'number' ? exam.score.toFixed(1) : (exam.score || '-');
    const subject = `📅 Yeni Gözetmenlik Görevi: ${exam.name} | ${exam.date}`;
    
    const body = `Sayin ${staff.name} Hocam,
 
${exam.date} tarihinde saat ${exam.time}'de yapilacak olan "${exam.name}" sinavina gözetmen olarak atandiniz.
 
SINAV BİLGİLERİ
----------------------------
📚 Sinav Adi : ${exam.name}
👨‍🏫 Dersi Veren : ${exam.lecturer || '-'}
📅 Tarih : ${exam.date}
🕒 Saat : ${exam.time}
🏫 Derslik : ${exam.location || '-'}
⏱ Süre : ${exam.duration} dakika
👥 Gözetmenler: ${gozetmenler}
⭐ Puan : ${scoreText}
----------------------------

🌐 SİSTEME ERİŞİM VE PROGRAM TAKİBİ:
Sinav detaylarina ve kişisel programiniza aşağidaki web adresinden ulaşabilirsiniz:
${siteUrl}

⚠️ GÖREV DEĞİŞİKLİĞİ YAPMAK İÇİN:
Görevinizde değişiklik yapmak istediğinizde sisteme (${siteUrl}) giriş yaparak "Profilim" sekmesinden uygun bir kişiyi kendiniz araştirip, "Takas Teklifi Gönder" veya "Görevi Pazar Yeri'ne Birak" seçeneğini kullanarak değişikliği kendiniz gerçekleştirebilirsiniz. Herhangi bir yönetici onayina gerek yoktur.
 
İyi çalişmalar dileriz.
GTU Matematik Bölümü - Gözetmenlik Sistemi
${siteUrl}`;

    const mailtoLink = `mailto:${encodeURIComponent(staff.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement('a');
    a.href = mailtoLink;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);

    // Bildirim durumunu güncelle (gönderilen gözetmeni işaretle)
    if (!exam.notifiedStaffIds) exam.notifiedStaffIds = [];
    if (!exam.notifiedStaffIds.map(String).includes(String(staffId))) {
        exam.notifiedStaffIds.push(staffId);
    }
    saveToLocalStorage();
    renderExams();
    showExamDetail(exam.name, exam.date, exam.time, exam.location);
};

window.sendBulkCancelMailViaOutlook = (examId) => {
    const exam = DB.exams.find(e => String(e.id) === String(examId));
    if (!exam) return;

    const proctorIds = exam.proctorIds || (exam.proctorId ? [exam.proctorId] : []);
    const proctors = proctorIds
        .map(pid => DB.staff.find(s => String(s.id) === String(pid)))
        .filter(Boolean);

    if (proctors.length === 0) {
        alert('Bu sinava atanmiş gözetmen bulunamadi.');
        return;
    }

    const emailList = proctors.map(p => p.email).filter(Boolean).join(';');
    if (!emailList) {
        alert('Gözetmenlerin hiçbirinin e-posta adresi girilmemiş.');
        return;
    }

    if (!confirm(`"${exam.name}" sinavi için ${proctors.length} gözetmene Outlook üzerinden Toplu İptal Maili hazirlansin mi?`)) {
        return;
    }

    const siteUrl = (typeof window.getSystemUrl === 'function') ? window.getSystemUrl() : (window.location.origin + window.location.pathname);
    const subject = `❌ Görev İptal Edildi: ${exam.name} | ${exam.date}`;
    let body = `Sayin Hocalarim,
 
${exam.date} tarihindeki "${exam.name}" sinavi iptal edilmiştir. Bu sinavdaki gözetmenlik göreviniz de bu doğrultuda iptal edilmiştir.
 
İPTAL OLAN SINAV BİLGİLERİ
----------------------------
📚 Sinav Adi   : ${exam.name}
👨‍🏫 Dersi Veren : ${exam.lecturer || '-'}
📅 Tarih       : ${exam.date}
🕒 Saat        : ${exam.time}
🏫 Derslik     : ${exam.location || '-'}
⏱ Süre        : ${exam.duration} dakika
----------------------------

🌐 SİSTEME GİRİŞ:
Güncel sinav programina aşağidaki bağlantidan erişebilirsiniz:
${siteUrl}
 
İyi çalişmalar dileriz.
GTU Matematik Bölümü - Gözetmenlik Sistemi
${siteUrl}`;

    if (DB.templates && DB.templates.cancel_email_body) {
        let tempText = DB.templates.cancel_email_body;
        tempText = tempText.replace(/<br\s*\/?>/gi, '\n');
        tempText = tempText.replace(/<\/p>/gi, '\n\n');
        tempText = tempText.replace(/<\/tr>/gi, '\n');
        tempText = tempText.replace(/<[^>]+>/g, '');
        tempText = tempText.replace(/&nbsp;/g, ' ');
        tempText = tempText.replace(/&#10060;/g, '❌');
        tempText = tempText.replace(/&#128218;/g, '📚');
        tempText = tempText.replace(/&#128100;/g, '👨‍🏫');
        tempText = tempText.replace(/&#128197;/g, '📅');
        tempText = tempText.replace(/&#128336;/g, '🕒');
        tempText = tempText.replace(/&#127979;/g, '🏫');

        const gozetmenler = proctors.map(p => p.name).join(', ');

        body = tempText
            .replace(/{personel_adi}/g, 'Hocalarim')
            .replace(/{sinav_adi}/g, exam.name || '-')
            .replace(/{dersi_veren}/g, exam.lecturer || '-')
            .replace(/{tarih}/g, exam.date || '-')
            .replace(/{saat}/g, exam.time || '-')
            .replace(/{derslik}/g, exam.location || '-')
            .replace(/{sure}/g, exam.duration || '-')
            .replace(/{puan}/g, typeof exam.score === 'number' ? exam.score.toFixed(1) : (exam.score || '-'))
            .replace(/{gozetmenler}/g, gozetmenler)
            .replace(/{site_url}/g, siteUrl)
            .replace(/{system_url}/g, siteUrl);
    }

    const mailtoLink = `mailto:${encodeURIComponent(emailList)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement('a');
    a.href = mailtoLink;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);

    logAction('admin', 'Mail Gönderim', `"${exam.name}" sinavi toplu iptali için ${proctors.length} gözetmene Outlook üzerinden mail hazirlandi.`);
};

window.deleteExam = async (id) => {
    const exIndex = DB.exams.findIndex(e => String(e.id) === String(id));
    if (exIndex === -1) return;
    const ex = DB.exams[exIndex];

    const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
    const proctors = pIds.map(pid => DB.staff.find(s => String(s.id) === String(pid))).filter(Boolean);

    let wantMail = false;
    if (proctors.length > 0) {
        const hasEmails = proctors.some(p => p.email);
        if (hasEmails) {
            wantMail = confirm(`"${ex.name}" sinavi siliniyor.\nAtanmiş gözetmenlere (${proctors.map(p=>p.name).join(', ')}) Outlook üzerinden Toplu İptal Maili hazirlamak ister misiniz?`);
        } else {
            if (!confirm(`"${ex.name}" sinavini silmek istediğinize emin misiniz?`)) return;
        }
    } else {
        if (!confirm(`"${ex.name}" sinavini silmek istediğinize emin misiniz?`)) return;
    }

    takeSnapshot("Sinav Silme");

    if (wantMail) {
        // Toplu mailto hazirliği
        const siteUrl = (typeof window.getSystemUrl === 'function') ? window.getSystemUrl() : (window.location.origin + window.location.pathname);
        const emailList = proctors.map(p => p.email).filter(Boolean).join(';');
        const subject = `❌ Sinav İptali / Görev İptal Edildi: ${ex.name} | ${ex.date}`;
        
        let body = `Sayin Hocalarim,
 
${ex.date} tarihindeki "${ex.name}" sinavi iptal edilmiştir. Bu sinavdaki gözetmenlik göreviniz de bu doğrultuda iptal edilmiştir.
 
İPTAL OLAN SINAV BİLGİLERİ
----------------------------
📚 Sinav Adi   : ${ex.name}
👨‍🏫 Dersi Veren : ${ex.lecturer || '-'}
📅 Tarih       : ${ex.date}
🕒 Saat        : ${ex.time}
🏫 Derslik     : ${ex.location || '-'}
⏱ Süre        : ${ex.duration} dakika
----------------------------

🌐 SİSTEME GİRİŞ:
Güncel sinav takvimine erişmek için:
${siteUrl}
 
İyi çalişmalar dileriz.
GTU Matematik Bölümü - Gözetmenlik Sistemi
${siteUrl}`;

        if (DB.templates && DB.templates.cancel_email_body) {
            let tempText = DB.templates.cancel_email_body;
            tempText = tempText.replace(/<br\s*\/?>/gi, '\n');
            tempText = tempText.replace(/<\/p>/gi, '\n\n');
            tempText = tempText.replace(/<\/tr>/gi, '\n');
            tempText = tempText.replace(/<[^>]+>/g, '');
            tempText = tempText.replace(/&nbsp;/g, ' ');
            tempText = tempText.replace(/&#10060;/g, '❌');
            tempText = tempText.replace(/&#128218;/g, '📚');
            tempText = tempText.replace(/&#128100;/g, '👨‍🏫');
            tempText = tempText.replace(/&#128197;/g, '📅');
            tempText = tempText.replace(/&#128336;/g, '🕒');
            tempText = tempText.replace(/&#127979;/g, '🏫');

            const gozetmenler = proctors.map(p => p.name).join(', ');

            body = tempText
                .replace(/{personel_adi}/g, 'Hocalarim')
                .replace(/{sinav_adi}/g, ex.name || '-')
                .replace(/{dersi_veren}/g, ex.lecturer || '-')
                .replace(/{tarih}/g, ex.date || '-')
                .replace(/{saat}/g, ex.time || '-')
                .replace(/{derslik}/g, ex.location || '-')
                .replace(/{sure}/g, ex.duration || '-')
                .replace(/{puan}/g, typeof ex.score === 'number' ? ex.score.toFixed(1) : (ex.score || '-'))
                .replace(/{gozetmenler}/g, gozetmenler)
                .replace(/{site_url}/g, siteUrl)
                .replace(/{system_url}/g, siteUrl);
        }

        const mailtoLink = `mailto:${encodeURIComponent(emailList)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        const a = document.createElement('a');
        a.href = mailtoLink;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
    }

    pIds.forEach(pid => {
        const staff = DB.staff.find(s => s.id === pid);
        if (staff) {
            if (shouldCountAsNonExam(ex)) {
                staff.nonExamScore = Math.max(0, parseFloat(((staff.nonExamScore || 0) - ex.score).toFixed(2)));
                staff.nonExamTaskCount = Math.max(0, (staff.nonExamTaskCount || 0) - 1);
            } else {
                staff.totalScore = Math.max(0, staff.totalScore - ex.score);
                staff.taskCount = Math.max(0, staff.taskCount - 1);
            }
        }
        if (!ex.isDraft) {
            sendAssignmentEmail(pid, ex, 'cancel');
        }
    });

    DB.exams.splice(exIndex, 1);
    saveToLocalStorage();
    logAction('admin', 'Sinav Silme', `${ex.name} sinavi silindi ${wantMail ? '(Toplu iptal maili tetiklendi)' : ''}.`);
    renderExams();
    renderSchedule();
    renderDashboard();
    await saveToBackend();
};

window.showEditExamModal = (id) => {
    const ex = DB.exams.find(e => String(e.id) === String(id));
    if (!ex) return;

    document.getElementById('edit-exam-id').value = ex.id;
    
    // Header'da yönetim butonu ekle (opsiyonel ama tutarlilik için)
    const typeLabelContainer = document.querySelector('#edit-modal .form-group:first-child');
    if (typeLabelContainer) {
         typeLabelContainer.style.position = 'relative';
         // Eğer zaten buton yoksa ekleyelim (burada select'in üstündeki label'i bulup yanina koyuyoruz)
         // Not: Index.html'de sabit durabilir veya burada dinamik ekletebiliriz.
         // En iyisi index.html'de label yanina butonu koymak.
    }

    const typeSelect = document.getElementById('edit-exam-type');
    if (typeSelect && !typeSelect._changeHandlerRegistered) {
        typeSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const isNonExam = ['Tercih Günü', 'Diğer'].includes(val);
            const chk = document.getElementById('edit-exam-is-non-exam');
            if (chk) {
                chk.checked = isNonExam;
                updateEditSuggestions();
            }
        });
        typeSelect._changeHandlerRegistered = true;
    }
    typeSelect.innerHTML = (DB.examTypes || []).map(t => 
        `<option value="${t}" ${t === ex.type ? 'selected' : ''}>${t}</option>`
    ).join('');
    
    document.getElementById('edit-exam-name').value = ex.name;
    const isNonExamEl = document.getElementById('edit-exam-is-non-exam');
    if (isNonExamEl) isNonExamEl.checked = !!ex.isNonExam;
    
    // Eğer DB.lecturers bir şekilde boş kalmişsa, hardcoded değerleri geri getir (Güvenlik önlemi)
    if (!DB.lecturers || DB.lecturers.length === 0) {
        console.warn("DB.lecturers boş, varsayilanlar yükleniyor...");
        DB.lecturers = [
            { name: "Mustafa AKKURT", title: "Prof. Dr." },
            { name: "Nuri ÇELİK", title: "Prof. Dr." },
            { name: "Oğul ESEN", title: "Prof. Dr." },
            { name: "Mansur İSGENDEROĞLU (İSMAİLOV)", title: "Prof. Dr." },
            { name: "Emil NOVRUZ", title: "Prof. Dr." },
            { name: "Sibel ÖZKAN", title: "Prof. Dr." },
            { name: "Serkan SÜTLÜ", title: "Prof. Dr." },
            { name: "Coşkun YAKAR (Bölüm Başkani)", title: "Prof. Dr." },
            { name: "Nursel EREY", title: "Doç. Dr." },
            { name: "Gülden GÜN POLAT", title: "Doç. Dr." },
            { name: "Feray HACIVELİOĞLU", title: "Doç. Dr." },
            { name: "Roghayeh HAFEZIEH", title: "Doç. Dr." },
            { name: "Fatma KARAOĞLU CEYHAN", title: "Doç. Dr." },
            { name: "Ayten KOÇ", title: "Doç. Dr." },
            { name: "Işil ÖNER", title: "Doç. Dr." },
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
            { name: "Zeynep Karadeniz Cisdik", title: "Öğr. Gör." },
            { name: "Orkun Canbek", title: "Öğr. Gör." },
            { name: "Oğuzhan DURSUN", title: "Öğr. Gör. Dr." },
            { name: "Pelin Ayşe GÖKGÖZ", title: "Araş. Gör. Dr." },
            { name: "Eda GOLDENBERG", title: "Doç. Dr." }
        ];
    }

    const lecturerSelect = document.getElementById('edit-exam-lecturer');
    lecturerSelect.innerHTML = `<option value="-">Seçin...</option>` + 
        (DB.lecturers || []).map(l => {
            const fullName = `${l.title} ${l.name}`;
            return `<option value="${fullName}" ${fullName === ex.lecturer ? 'selected' : ''}>${fullName}</option>`;
        }).join('');
    
    document.getElementById('edit-exam-capacity').value = ex.capacity || '';
    document.getElementById('edit-exam-location').value = ex.location || '';
    document.getElementById('edit-exam-date').value = ex.date;
    document.getElementById('edit-exam-time').value = ex.time;
    document.getElementById('edit-exam-duration').value = ex.duration;
    document.getElementById('edit-exam-note').value = ex.lecturerNote || '';

    // Initialize tempEditProctors with existing proctors
    window.tempEditProctors = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
    
    const updateEditAvailabilityStatus = () => {
        const d = document.getElementById('edit-exam-date')?.value;
        const t = document.getElementById('edit-exam-time')?.value;
        const dur = parseInt(document.getElementById('edit-exam-duration')?.value) || 60;
        const statusBox = document.getElementById('edit-exam-avail-status');

        if (!d || !t || !statusBox) return;

        const available = [];
        const restricted = [];
        const busy = [];

        const currentExamId = document.getElementById('edit-exam-id')?.value;
        const startMin = (typeof timeToMins === 'function') ? timeToMins(t) : 0;
        const endMin = startMin + dur;

        (DB.staff || []).forEach(s => {
            const otherExams = (DB.exams || []).filter(oe => 
                String(oe.id) !== String(currentExamId) && 
                oe.date === d &&
                (oe.proctorIds || (oe.proctorId ? [oe.proctorId] : [])).map(String).includes(String(s.id))
            );

            let hasOverlap = false;
            let overlapName = '';
            for (const oe of otherExams) {
                const os = (typeof timeToMins === 'function') ? timeToMins(oe.time) : 0;
                const oeEnd = os + (parseInt(oe.duration) || 60);
                if (startMin < oeEnd && endMin > os) {
                    hasOverlap = true;
                    overlapName = oe.name;
                    break;
                }
            }

            if (hasOverlap) {
                busy.push({ name: s.name, reason: `Başka Sinav: ${overlapName}` });
            } else if (typeof isAvailable === 'function' && !isAvailable(s.name, d, t, dur)) {
                restricted.push({ name: s.name, reason: 'Ders / Kisitli' });
            } else {
                available.push(s);
            }
        });

        statusBox.style.display = 'block';
        if (restricted.length === 0 && busy.length === 0) {
            statusBox.style.background = 'rgba(16, 185, 129, 0.12)';
            statusBox.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            statusBox.style.color = '#10b981';
            statusBox.innerHTML = `🟢 <strong>Tüm Gözetmenler Müsait (${available.length}/${DB.staff.length})</strong> - Herhangi bir ders veya sinav çakişmasi yok.`;
        } else {
            statusBox.style.background = 'rgba(245, 158, 11, 0.12)';
            statusBox.style.borderColor = 'rgba(245, 158, 11, 0.4)';
            statusBox.style.color = '#fbbf24';
            const clashDetails = [];
            if (restricted.length > 0) clashDetails.push(`<strong>${restricted.length} Gözetmenin Dersi/Kisiti Var:</strong> ${restricted.map(r => r.name).join(', ')}`);
            if (busy.length > 0) clashDetails.push(`<strong>${busy.length} Gözetmen Başka Sinavda:</strong> ${busy.map(b => b.name).join(', ')}`);
            statusBox.innerHTML = `⚠️ <strong>Müsaitlik Durumu (${available.length}/${DB.staff.length} Müsait):</strong><br>` + clashDetails.join('<br>');
        }
    };

    const updateEditProctorSelect = () => {
        const select = document.getElementById('edit-exam-proctor-select');
        const d = document.getElementById('edit-exam-date')?.value;
        const t = document.getElementById('edit-exam-time')?.value;
        const dur = parseInt(document.getElementById('edit-exam-duration')?.value) || 60;

        select.innerHTML = `<option value="">Hoca Seçin...</option>` + DB.staff
            .filter(s => !window.tempEditProctors.includes(s.id))
            .sort((a,b) => a.name.localeCompare(b.name, 'tr'))
            .map(s => {
                let badge = '';
                if (d && t && typeof isAvailable === 'function' && !isAvailable(s.name, d, t, dur)) {
                    badge = ' ⚠️ [Kisitli/Derste]';
                }
                return `<option value="${s.id}">${s.name}${badge}</option>`;
            }).join('');
    };

    window.renderEditProctorList = () => {
        const list = document.getElementById('edit-proctor-list');
        list.innerHTML = window.tempEditProctors.map(id => {
            const staff = DB.staff.find(s => String(s.id) === String(id));
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:6px 10px; border-radius:6px; border:1px solid var(--glass-border);">
                    <span style="font-size:0.85rem;">${staff ? staff.name : '???'}</span>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <button type="button" class="btn-icon" onclick="removeProctorAndSendCancelMail(${id})" title="Gözetmenliği İptal Et ve Mail Gönder" style="color:#38bdf8; font-size:1.1rem; cursor:pointer; background:none; border:none; padding:0;">📧</button>
                        <button type="button" class="btn-icon" onclick="removeProctorFromEditList(${id})" title="Sadece Listeden Çikar" style="color:var(--accent-red); font-size:1rem; filter:grayscale(1) brightness(2); cursor:pointer; background:none; border:none; padding:0;">🗑️</button>
                    </div>
                </div>
            `;
        }).join('') || '<div style="text-align:center; color:var(--text-muted); font-size:0.8rem; padding:10px;">Henüz hoca seçilmedi</div>';
    };

    window.addProctorToEditList = () => {
        const select = document.getElementById('edit-exam-proctor-select');
        const id = parseInt(select.value);
        if (id && !window.tempEditProctors.includes(id)) {
            window.tempEditProctors.push(id);
            renderEditProctorList();
            updateEditProctorSelect();
            updateEditSuggestions();
            updateEditAvailabilityStatus();
        }
    };

    window.removeProctorFromEditList = (id) => {
        window.tempEditProctors = window.tempEditProctors.filter(pid => pid !== id);
        renderEditProctorList();
        updateEditProctorSelect();
        updateEditSuggestions();
        updateEditAvailabilityStatus();
    };

    // Initial setup for proctor selection
    updateEditProctorSelect();
    renderEditProctorList();

    // Listener birikimini önlemek için flag kullan — cloneNode yerine
    const dateEl = document.getElementById('edit-exam-date');
    const timeEl = document.getElementById('edit-exam-time');
    const durEl  = document.getElementById('edit-exam-duration');
    const nameEl = document.getElementById('edit-exam-name');

    // Değerleri direkt set et (cloneNode ile kayip yaşanmaz)
    dateEl.value = ex.date;
    timeEl.value = ex.time;
    durEl.value  = ex.duration;
    nameEl.value = ex.name;

    const updateEditSuggestions = () => {
        const d   = document.getElementById('edit-exam-date').value;
        const t   = document.getElementById('edit-exam-time').value;
        const dur = parseInt(document.getElementById('edit-exam-duration').value) || 60;
        const isNonExam = document.getElementById('edit-exam-is-non-exam')?.checked || false;
        const name = document.getElementById('edit-exam-name')?.value || "";
        updateSuggestionsUI(d, t, dur, 'edit-suggestions', 'edit-suggestion-list', ex.id, null, isNonExam, name);
    };

    // Datalist seçeneklerini ve başlangiç katalog rozetini güncelle
    const editDatalist = document.getElementById('edit-exam-memory-list');
    if (editDatalist) {
        editDatalist.innerHTML = getCourseCatalogOptionsHtml();
    }
    
    const editInfoBadge = document.getElementById('edit-exam-catalog-info');
    const initCat = (typeof findCourseInCatalog === 'function') ? findCourseInCatalog(ex.name) : null;
    if (initCat && editInfoBadge) {
        editInfoBadge.style.display = 'block';
        editInfoBadge.innerHTML = `📘 <b>${initCat.code} - ${initCat.name}</b> &nbsp;|&nbsp; 🌐 ${initCat.lang} &nbsp;|&nbsp; 📅 ${initCat.term} &nbsp;|&nbsp; ⭐ ${initCat.credit} Kredi / ${initCat.akts} AKTS &nbsp;(${initCat.type})`;
    } else if (editInfoBadge) {
        editInfoBadge.style.display = 'none';
        editInfoBadge.innerHTML = '';
    }

    // Her açilişta listener'lari temizle ve yeniden ekle (flag ile)
    if (dateEl._editHandler)  dateEl.removeEventListener('change', dateEl._editHandler);
    if (timeEl._editHandler)  timeEl.removeEventListener('change', timeEl._editHandler);
    if (durEl._editHandler)   durEl.removeEventListener('input',  durEl._editHandler);
    if (nameEl._editHandler)  nameEl.removeEventListener('input',  nameEl._editHandler);

    dateEl._editHandler = () => { updateEditSuggestions(); updateEditAvailabilityStatus(); updateEditProctorSelect(); };
    timeEl._editHandler = () => { updateEditSuggestions(); updateEditAvailabilityStatus(); updateEditProctorSelect(); };
    durEl._editHandler  = () => { updateEditSuggestions(); updateEditAvailabilityStatus(); updateEditProctorSelect(); };
    nameEl._editHandler = (e) => {
        const val = e.target.value.trim();
        const badge = document.getElementById('edit-exam-catalog-info');
        const catCourse = (typeof findCourseInCatalog === 'function') ? findCourseInCatalog(val) : null;
        
        if (catCourse && badge) {
            badge.style.display = 'block';
            badge.innerHTML = `📘 <b>${catCourse.code} - ${catCourse.name}</b> &nbsp;|&nbsp; 🌐 ${catCourse.lang} &nbsp;|&nbsp; 📅 ${catCourse.term} &nbsp;|&nbsp; ⭐ ${catCourse.credit} Kredi / ${catCourse.akts} AKTS &nbsp;(${catCourse.type})`;
        } else if (badge) {
            badge.style.display = 'none';
            badge.innerHTML = '';
        }

        const lecturerName = (catCourse && catCourse.lecturer) || 
            (catCourse && DB.courseLecturers && (DB.courseLecturers[`${catCourse.code} - ${catCourse.name}`] || DB.courseLecturers[catCourse.code] || DB.courseLecturers[catCourse.name])) ||
            (DB.courseLecturers && DB.courseLecturers[val]);

        if (lecturerName) {
            const selectL = document.getElementById('edit-exam-lecturer');
            if (selectL) {
                const needle = lecturerName.trim().toLowerCase();
                let found = false;
                // 1. Tam eşleşme
                for (let i = 0; i < selectL.options.length; i++) {
                    if (selectL.options[i].value.trim().toLowerCase() === needle) {
                        selectL.selectedIndex = i; found = true; break;
                    }
                }
                // 2. Kismi eşleşme
                if (!found) {
                    for (let i = 0; i < selectL.options.length; i++) {
                        const opt = selectL.options[i].value.trim().toLowerCase();
                        if (opt.includes(needle) || needle.includes(opt)) {
                            selectL.selectedIndex = i; found = true; break;
                        }
                    }
                }
                // 3. Soyad eşleşmesi
                if (!found) {
                    const parts = needle.split(' ').filter(p => p.length > 2);
                    for (let i = 0; i < selectL.options.length; i++) {
                        const opt = selectL.options[i].value.trim().toLowerCase();
                        if (parts.some(part => opt.includes(part))) {
                            selectL.selectedIndex = i; found = true; break;
                        }
                    }
                }
                if (found) {
                    selectL.style.borderColor = '#10b981';
                    selectL.style.boxShadow = '0 0 0 2px rgba(16,185,129,0.25)';
                    setTimeout(() => { selectL.style.borderColor = ''; selectL.style.boxShadow = ''; }, 1800);
                }
            }
        }
    };

    dateEl.addEventListener('change', dateEl._editHandler);
    timeEl.addEventListener('change', timeEl._editHandler);
    durEl.addEventListener('input',   durEl._editHandler);
    nameEl.addEventListener('input',  nameEl._editHandler);

    updateEditSuggestions();
    updateEditAvailabilityStatus();
    document.getElementById('edit-modal').classList.remove('hidden');
};

document.getElementById('edit-modal-form').onsubmit = async (e) => {
    e.preventDefault();
    // ID'yi string olarak al — parseInt büyük Date.now() değerlerinde precision kaybi yaratir
    const id = document.getElementById('edit-exam-id').value;

    // tempEditProctors atanmişsa doğrudan kullan (boş dizi de olsa, kullanici tümünü silmiş demektir)
    const currentExam = DB.exams.find(ex => String(ex.id) === String(id));
    const proctorIds = Array.isArray(window.tempEditProctors)
        ? window.tempEditProctors
        : (currentExam ? (currentExam.proctorIds || (currentExam.proctorId ? [currentExam.proctorId] : [])) : []);

    const durationVal = parseInt(document.getElementById('edit-exam-duration').value);
    if (!durationVal || durationVal <= 0) {
        alert('Lütfen geçerli bir süre (dakika) giriniz!');
        return;
    }

    const data = {
        isNonExam: document.getElementById('edit-exam-is-non-exam')?.checked || false,
        type:       document.getElementById('edit-exam-type').value,
        name:       document.getElementById('edit-exam-name').value,
        lecturer:   document.getElementById('edit-exam-lecturer').value,
        capacity:   document.getElementById('edit-exam-capacity').value,
        location:   document.getElementById('edit-exam-location').value,
        date:       document.getElementById('edit-exam-date').value,
        time:       document.getElementById('edit-exam-time').value,
        duration:   durationVal,
        proctorIds: proctorIds,
        lecturerNote: document.getElementById('edit-exam-note').value
    };

    // Müsaitlik kontrolü
    for (const pid of data.proctorIds) {
        const staff = DB.staff.find(s => s.id === pid);
        if (staff && !isAvailable(staff.name, data.date, data.time, data.duration, id)) {
            if (!confirm(`${staff.name} bu saatte müsait değil! Yine de devam etmek istiyor musunuz?`)) return;
        }
    }

    updateExam(id, data);
    document.getElementById('edit-modal').classList.add('hidden');
    renderExams();
    renderSchedule();
    renderDashboard();
    await saveToBackend();
};


window.showEditScheduleModal = (name, date, time, location) => {
    const groupExams = DB.exams.filter(e => e.name === name && e.date === date && e.time === time);
    if(groupExams.length === 0) return;

    const baseEx = groupExams[0];
    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Program/Yer Düzenle (" + baseEx.name + ")";
    
    fields.innerHTML = `
        <div class="form-group">
            <label>Ders Adi</label>
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
        <div class="form-group">
            <label>Süre (Dakika)</label>
            <input type="number" id="sch-exam-duration" value="${baseEx.duration}" required>
        </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = async (e) => {
        e.preventDefault();
        
        const newName = document.getElementById('sch-exam-name').value;
        const newLocation = document.getElementById('sch-exam-location').value;
        const newDate = document.getElementById('sch-exam-date').value;
        const newTime = document.getElementById('sch-exam-time').value;
        const newDuration = parseInt(document.getElementById('sch-exam-duration').value) || 60;

        // O gruba ait tüm kayitlari güncelle
        for (const ex of groupExams) {
            updateExam(ex.id, {
                name: newName,
                location: newLocation,
                date: newDate,
                time: newTime,
                duration: newDuration
            }, true); // skipSave = true
        }

        saveToLocalStorage(); // Tek seferde kaydet
        logAction('admin', 'Sinav Programi Güncelleme', `${newName} grubundaki ${groupExams.length} sinav güncellendi.`);
        
        hideModal();
        renderExams();
        renderSchedule();
        renderDashboard();
        updateNotificationBadge();
        await saveToBackend();
    };
};

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

    // 2. Detayli Tablo
    const tbody = document.querySelector('#table-staff-stats tbody');
    if (tbody) {
        tbody.innerHTML = '';
        data.staffStats.forEach(s => {
            const tr = document.createElement('tr');
            
            // Ortalama görev sayisindan %50 fazla ise kirmizi göster (Yüklenme uyarisi)
            const isHighLoad = s.totalTasks > (GLOBAL_LIMITS.MAX_TASKS - 1);
            
            tr.innerHTML = `
                <td>
                    <div class="name-with-avatar">
                        ${getAvatarHtml(s.name)}
                        <span style="font-weight: 600;">${s.name}</span>
                    </div>
                </td>
                <td>${s.breakdown["Hafta İçi / Gündüz"]}</td>
                <td>${s.breakdown["Hafta İçi / Akşam"]}</td>
                <td>${s.breakdown["Hafta Sonu / Gündüz"]}</td>
                <td>${s.breakdown["Hafta Sonu / Akşam"]}</td>
                <td class="${isHighLoad ? 'high-load' : ''}">${s.totalTasks}</td>
                <td style="color: var(--primary); font-weight: 700;">${s.totalScore.toFixed(1)}</td>
                <td>
                    <span class="badge" style="background: ${getScoreColor(calculateAvailabilityScore(s.id))}22; color: ${getScoreColor(calculateAvailabilityScore(s.id))}; border: 1px solid ${getScoreColor(calculateAvailabilityScore(s.id))}44;">
                        %${calculateAvailabilityScore(s.id)}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Puan Dağilim Grafiğini de güncelle
    setTimeout(() => {
        if (typeof renderScoreChart === 'function') renderScoreChart();
    }, 100);
}

function getStaffConstraintsSummaryHtml(staffName, staffId) {
    const TurkishDayShort = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    const constraints = (typeof getConstraintsForStaff === 'function') ? getConstraintsForStaff(staffName) : ((DB.constraints && DB.constraints[staffName]) || []);
    
    if (!constraints || constraints.length === 0) {
        return `<span style="color: #10b981; font-size: 0.8rem; font-weight: 500; display: inline-flex; align-items: center; gap: 5px;">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981;"></span>
            Tam Müsait
        </span>`;
    }

    let pills = [];
    constraints.slice(0, 2).forEach(c => {
        let text = "";
        if (c.day !== undefined) {
            text = `${TurkishDayShort[c.day]} ${c.start}-${c.end}`;
        } else if (c.startDate && c.endDate) {
            text = `${c.startDate.split('-').slice(1).join('/')}-${c.endDate.split('-').slice(1).join('/')}`;
        } else if (c.date) {
            text = `${c.date} ${c.start}`;
        }
        pills.push(`<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">🚫 ${text}</span>`);
    });

    if (constraints.length > 2) {
        pills.push(`<span class="badge" style="background: rgba(255, 255, 255, 0.1); color: #cbd5e1; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; cursor: pointer;" onclick="showStaffConstraintsModal(${staffId})" title="Tüm kisitlari görüntüle">+${constraints.length - 2} daha</span>`);
    }

    return `<div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">${pills.join('')}</div>`;
}

function renderStaff() {
    const tbody = document.querySelector('#table-staff tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchTerm = document.getElementById('staff-search')?.value.toLowerCase() || '';
    const filteredStaff = DB.staff.filter(s => s.name.toLowerCase().includes(searchTerm));

    filteredStaff.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="name-with-avatar">
                    ${getAvatarHtml(s.name)}
                    <span class="clickable-name" onclick="showStaffSchedule('${s.name}')">${s.name}</span>
                </div>
            </td>
            <td><span class="email-text">${s.email || '-'}</span></td>
            <td>${s.totalScore.toFixed(1)}</td>
            <td>${s.taskCount}</td>
            <td>
                <div class="flex-score-container" title="Esneklik Puani: %${calculateAvailabilityScore(s.id)}">
                    <div class="flex-score-bar" style="width: ${calculateAvailabilityScore(s.id)}%; background: ${getScoreColor(calculateAvailabilityScore(s.id))}"></div>
                    <span class="flex-score-text">%${calculateAvailabilityScore(s.id)}</span>
                </div>
            </td>
            <td>
                ${getStaffConstraintsSummaryHtml(s.name, s.id)}
            </td>
            <td class="admin-only" style="white-space: nowrap; text-align: right;">
                <button class="btn-primary" style="background:#ef4444; padding:0.25rem 0.55rem; font-size:0.8rem; margin-right:4px;" onclick="showStaffConstraintsModal(${s.id})" title="Kisit zamanlarini görüntüle ve düzenle">🚫 Kisitlar</button>
                <button class="btn-primary" style="background:#10b981; padding:0.25rem 0.5rem; font-size:0.8rem; margin-right:4px;" onclick="adminGoToStaffProfile(${s.id})" title="Bu personelin profiline doğrudan geçiş yap">👤 Profil</button>
                <button class="btn-primary" style="background:#6366f1; padding:0.25rem 0.5rem; font-size:0.8rem;" onclick="showStaffReportModal(${s.id})">🔍 Karne</button>
                <button class="btn-edit" style="margin-left:4px;" onclick="showEditStaffModal(${s.id})">Düzenle</button>
                <button class="btn-delete" style="margin-left:4px;" onclick="deleteStaff(${s.id})">Sil</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (typeof renderLecturers === 'function') renderLecturers();
    if (typeof renderMappings === 'function') renderMappings();
    if (typeof renderStaffConstraintsMaster === 'function') renderStaffConstraintsMaster();
}

window.renderStaffConstraintsMaster = function() {
    const tbody = document.querySelector('#table-staff-constraints tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchTerm = (document.getElementById('constraint-search')?.value || '').toLowerCase();
    const dayFilter = document.getElementById('constraint-day-filter')?.value || 'all';

    const TurkishDayShort = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

    let staffList = (DB.staff || []).slice().sort((a,b) => a.name.localeCompare(b.name, 'tr'));

    if (searchTerm) {
        staffList = staffList.filter(s => s.name.toLowerCase().includes(searchTerm) || (s.email || '').toLowerCase().includes(searchTerm));
    }

    let renderedCount = 0;

    staffList.forEach(s => {
        const constraints = (typeof getConstraintsForStaff === 'function') ? getConstraintsForStaff(s.name) : ((DB.constraints && DB.constraints[s.name]) || []);
        
        // Gün filtresi kontrolü
        if (dayFilter !== 'all') {
            if (dayFilter === 'special') {
                const hasSpecial = constraints.some(c => c.day === undefined);
                if (!hasSpecial) return;
            } else {
                const dayNum = parseInt(dayFilter, 10);
                const hasDay = constraints.some(c => c.day !== undefined && parseInt(c.day, 10) === dayNum);
                if (!hasDay) return;
            }
        }

        renderedCount++;

        const weeklyConstraints = constraints.filter(c => c.day !== undefined);
        const specialConstraints = constraints.filter(c => c.day === undefined);

        let weeklyBadges = '<span style="color:var(--text-muted); font-size:0.8rem;">Kayit yok</span>';
        if (weeklyConstraints.length > 0) {
            weeklyBadges = weeklyConstraints.map(c => 
                `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.75rem; padding: 3px 8px; border-radius: 6px; margin: 2px; display: inline-block;">
                    <strong>${TurkishDayShort[c.day]}</strong> ${c.start} - ${c.end}
                </span>`
            ).join('');
        }

        let specialBadges = '<span style="color:var(--text-muted); font-size:0.8rem;">Kayit yok</span>';
        if (specialConstraints.length > 0) {
            specialBadges = specialConstraints.map(c => {
                let text = "";
                if (c.startDate && c.endDate) text = `📅 ${c.startDate} / ${c.endDate} (${c.start}-${c.end})`;
                else if (c.date) text = `📅 ${c.date} (${c.start}-${c.end})`;
                else text = `${c.start}-${c.end}`;
                return `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.75rem; padding: 3px 8px; border-radius: 6px; margin: 2px; display: inline-block;">
                    ${text}
                </span>`;
            }).join('');
        }

        const flexScore = calculateAvailabilityScore(s.id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="name-with-avatar">
                    ${getAvatarHtml(s.name)}
                    <div>
                        <strong style="color:white; font-size:0.9rem;">${s.name}</strong>
                        <small style="display:block; color:var(--text-muted); font-size:0.75rem;">${s.email || '-'}</small>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge" style="background:${getScoreColor(flexScore)}22; color:${getScoreColor(flexScore)}; border:1px solid ${getScoreColor(flexScore)}44; font-weight:700;">
                    %${flexScore}
                </span>
            </td>
            <td>
                <strong style="color:${constraints.length > 0 ? '#f87171' : '#10b981'}; font-size:0.9rem;">${constraints.length} Kisit</strong>
            </td>
            <td>${weeklyBadges}</td>
            <td>${specialBadges}</td>
            <td class="admin-only" style="text-align: right;">
                <button class="btn-primary" style="background:#ef4444; padding:0.35rem 0.75rem; font-size:0.8rem; display:inline-flex; align-items:center; gap:4px;" onclick="showStaffConstraintsModal(${s.id})">
                    <span>⚙️</span> Kisitlari Yönet
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (renderedCount === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2.5rem;">Seçilen kriterlere uygun personel kisiti bulunamadi.</td></tr>`;
    }
};

window.showStaffConstraintsModal = function(staffId) {
    const staff = (DB.staff || []).find(s => String(s.id) === String(staffId));
    if (!staff) {
        showToast('Personel bulunamadi!', 'error');
        return;
    }

    const modal = document.getElementById('modal-staff-constraints-admin');
    if (!modal) return;

    document.getElementById('modal-staff-constraints-name').textContent = `${staff.name} - Kisit Zamanlari`;
    const flexScore = calculateAvailabilityScore(staff.id);
    document.getElementById('modal-staff-constraints-subtitle').innerHTML = `Müsaitlik Esneklik Skoru: <strong style="color:${getScoreColor(flexScore)};">%${flexScore}</strong> | E-posta: ${staff.email || '-'}`;

    document.getElementById('admin-constraint-staff-name').value = staff.name;
    document.getElementById('admin-constraint-staff-id').value = staff.id;

    renderStaffConstraintsModalTable(staff.name);
    modal.classList.remove('hidden');
};

window.renderStaffConstraintsModalTable = function(staffName) {
    const tbody = document.querySelector('#table-staff-constraints-modal tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const TurkishDays = ["Pazar", "Pazartesi", "Sali", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const constraints = (typeof getConstraintsForStaff === 'function') ? getConstraintsForStaff(staffName) : ((DB.constraints && DB.constraints[staffName]) || []);

    if (constraints.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Bu personele ait kayitli kisit bulunmuyor. Personel tüm saatlerde tam müsaittir.</td></tr>`;
        return;
    }

    constraints.forEach((c, idx) => {
        let label = "";
        let typeBadge = "";
        if (c.day !== undefined) {
            typeBadge = '<span class="badge" style="background:rgba(99,102,241,0.2); color:#818cf8; margin-right:6px;">Haftalik</span>';
            label = `Her Hafta ${TurkishDays[c.day]}`;
        } else if (c.startDate && c.endDate) {
            typeBadge = '<span class="badge" style="background:rgba(245,158,11,0.2); color:#fbbf24; margin-right:6px;">Tarih Araliği</span>';
            label = `${c.startDate} - ${c.endDate}`;
        } else if (c.date) {
            typeBadge = '<span class="badge" style="background:rgba(236,72,153,0.2); color:#f472b6; margin-right:6px;">Özel Tarih</span>';
            label = `${c.date}`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${typeBadge}<strong>${label}</strong></td>
            <td><span style="color:#38bdf8; font-weight:600;">${c.start} - ${c.end}</span></td>
            <td style="text-align: right;">
                <button class="btn-delete" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="deleteStaffConstraintAdmin('${staffName.replace(/'/g, "\\'")}', ${idx})">🗑️ Sil</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.toggleAdminConstraintTypeInputs = function() {
    const type = document.getElementById('admin-constraint-type')?.value;
    const dayGroup = document.getElementById('admin-constraint-day-group');
    const dateGroup = document.getElementById('admin-constraint-date-group');
    const rangeGroup = document.getElementById('admin-constraint-range-group');

    if (dayGroup) dayGroup.classList.toggle('hidden', type !== 'weekly');
    if (dateGroup) dateGroup.classList.toggle('hidden', type !== 'single_date');
    if (rangeGroup) rangeGroup.classList.toggle('hidden', type !== 'date_range');
};

window.saveStaffConstraintAdmin = async function() {
    const staffName = document.getElementById('admin-constraint-staff-name')?.value;
    const staffId = document.getElementById('admin-constraint-staff-id')?.value;
    if (!staffName) return;

    const type = document.getElementById('admin-constraint-type')?.value;
    const startTime = document.getElementById('admin-constraint-start-time')?.value || '08:30';
    const endTime = document.getElementById('admin-constraint-end-time')?.value || '12:30';

    if (startTime >= endTime) {
        showToast('Başlangiç saati bitiş saatinden önce olmalidir!', 'error');
        return;
    }

    if (!DB.constraints) DB.constraints = {};
    if (!DB.constraints[staffName]) DB.constraints[staffName] = [];

    let newConstraint = { start: startTime, end: endTime };

    if (type === 'weekly') {
        const day = parseInt(document.getElementById('admin-constraint-day')?.value || 1, 10);
        newConstraint.day = day;
    } else if (type === 'single_date') {
        const date = document.getElementById('admin-constraint-date')?.value;
        if (!date) {
            showToast('Lütfen bir tarih seçiniz!', 'error');
            return;
        }
        newConstraint.date = date;
    } else if (type === 'date_range') {
        const startDate = document.getElementById('admin-constraint-start-date')?.value;
        const endDate = document.getElementById('admin-constraint-end-date')?.value;
        if (!startDate || !endDate) {
            showToast('Lütfen başlangiç ve bitiş tarihlerini seçiniz!', 'error');
            return;
        }
        if (startDate > endDate) {
            showToast('Başlangiç tarihi bitiş tarihinden sonra olamaz!', 'error');
            return;
        }
        newConstraint.startDate = startDate;
        newConstraint.endDate = endDate;
    }

    DB.constraints[staffName].push(newConstraint);
    saveToLocalStorage();

    renderStaffConstraintsModalTable(staffName);
    renderStaff();
    renderStaffConstraintsMaster();
    if (typeof renderProfileConstraints === 'function') renderProfileConstraints();

    showToast(`✅ ${staffName} için kisit kaydedildi!`, 'success');
    await saveToBackend();
};

window.deleteStaffConstraintAdmin = async function(staffName, index) {
    if (!DB.constraints || !DB.constraints[staffName]) return;
    if (!confirm('Bu kisiti silmek istediğinize emin misiniz?')) return;

    DB.constraints[staffName].splice(index, 1);
    saveToLocalStorage();

    renderStaffConstraintsModalTable(staffName);
    renderStaff();
    renderStaffConstraintsMaster();
    if (typeof renderProfileConstraints === 'function') renderProfileConstraints();

    showToast('Kisit silindi.', 'info');
    await saveToBackend();
};

window.clearAllStaffConstraintsAdmin = async function() {
    const staffName = document.getElementById('admin-constraint-staff-name')?.value;
    if (!staffName || !DB.constraints || !DB.constraints[staffName]) return;

    if (!confirm(`${staffName} personeline ait TÜM kisitlari silmek istediğinize emin misiniz?`)) return;

    DB.constraints[staffName] = [];
    saveToLocalStorage();

    renderStaffConstraintsModalTable(staffName);
    renderStaff();
    renderStaffConstraintsMaster();
    if (typeof renderProfileConstraints === 'function') renderProfileConstraints();

    showToast(`${staffName} için tüm kisitlar temizlendi.`, 'info');
    await saveToBackend();
};

window.switchStaffTab = function(tabName) {
    const btnProctors = document.getElementById('btn-staff-tab-proctors');
    const btnConstraints = document.getElementById('btn-staff-tab-constraints');
    const btnLecturers = document.getElementById('btn-staff-tab-lecturers');
    const btnMappings = document.getElementById('btn-staff-tab-mappings');
    
    const containerProctors = document.getElementById('staff-tab-proctors-container');
    const containerConstraints = document.getElementById('staff-tab-constraints-container');
    const containerLecturers = document.getElementById('staff-tab-lecturers-container');
    const containerMappings = document.getElementById('staff-tab-mappings-container');
    
    const controlsProctors = document.getElementById('proctors-controls');
    const controlsConstraints = document.getElementById('constraints-controls');
    const controlsLecturers = document.getElementById('lecturers-controls');
    const controlsMappings = document.getElementById('mappings-controls');

    if (btnProctors) btnProctors.classList.remove('active');
    if (btnConstraints) btnConstraints.classList.remove('active');
    if (btnLecturers) btnLecturers.classList.remove('active');
    if (btnMappings) btnMappings.classList.remove('active');

    if (containerProctors) containerProctors.classList.add('hidden');
    if (containerConstraints) containerConstraints.classList.add('hidden');
    if (containerLecturers) containerLecturers.classList.add('hidden');
    if (containerMappings) containerMappings.classList.add('hidden');

    if (controlsProctors) controlsProctors.classList.add('hidden');
    if (controlsConstraints) controlsConstraints.classList.add('hidden');
    if (controlsLecturers) controlsLecturers.classList.add('hidden');
    if (controlsMappings) controlsMappings.classList.add('hidden');

    if (tabName === 'proctors') {
        if (btnProctors) btnProctors.classList.add('active');
        if (containerProctors) containerProctors.classList.remove('hidden');
        if (controlsProctors) controlsProctors.classList.remove('hidden');
        renderStaff();
    } else if (tabName === 'constraints') {
        if (btnConstraints) btnConstraints.classList.add('active');
        if (containerConstraints) containerConstraints.classList.remove('hidden');
        if (controlsConstraints) controlsConstraints.classList.remove('hidden');
        renderStaffConstraintsMaster();
    } else if (tabName === 'lecturers') {
        if (btnLecturers) btnLecturers.classList.add('active');
        if (containerLecturers) containerLecturers.classList.remove('hidden');
        if (controlsLecturers) controlsLecturers.classList.remove('hidden');
        renderLecturers();
    } else if (tabName === 'mappings') {
        if (btnMappings) btnMappings.classList.add('active');
        if (containerMappings) containerMappings.classList.remove('hidden');
        if (controlsMappings) controlsMappings.classList.remove('hidden');
        renderMappings();
    }
};

window.renderLecturers = function() {
    const tbody = document.querySelector('#table-table-lecturers tbody') || document.querySelector('#table-lecturers tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchTerm = document.getElementById('lecturer-search')?.value.toLowerCase() || '';
    
    if (!DB.lecturers) DB.lecturers = [];
    
    const filteredLecturers = DB.lecturers.filter(l => 
        (l.name || '').toLowerCase().includes(searchTerm) || 
        (l.title || '').toLowerCase().includes(searchTerm)
    );

    filteredLecturers.sort((a,b) => (a.name || '').localeCompare(b.name || '', 'tr'));

    filteredLecturers.forEach((l) => {
        const originalIndex = DB.lecturers.findIndex(item => item === l);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span style="font-weight: 600; color: var(--primary);">${l.title || '-'}</span></td>
            <td><span style="font-weight: 500; color: white;">${l.name || '-'}</span></td>
            <td class="admin-only" style="text-align: right;">
                <button class="btn-edit" onclick="showEditLecturerModal(${originalIndex})">Düzenle</button>
                <button class="btn-delete" onclick="deleteLecturer(${originalIndex})">Sil</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.renderMappings = function() {
    const tbody = document.querySelector('#table-mappings tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchTerm = document.getElementById('mapping-search')?.value.toLowerCase() || '';

    if (!DB.courseLecturers) DB.courseLecturers = {};

    const entries = Object.entries(DB.courseLecturers);
    const filteredEntries = entries.filter(([course, lecturer]) => 
        course.toLowerCase().includes(searchTerm) || 
        lecturer.toLowerCase().includes(searchTerm)
    );

    filteredEntries.sort((a, b) => a[0].localeCompare(b[0], 'tr'));

    filteredEntries.forEach(([course, lecturer]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span style="font-weight: 600; color: white;">${course}</span></td>
            <td><span style="font-weight: 500; color: var(--primary);">${lecturer}</span></td>
            <td class="admin-only" style="text-align: right;">
                <button class="btn-edit" onclick="showEditMappingModal('${course.replace(/'/g, "\\'")}', '${lecturer.replace(/'/g, "\\'")}')">Düzenle</button>
                <button class="btn-delete" onclick="deleteMapping('${course.replace(/'/g, "\\'")}')">Sil</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.showAddLecturerModal = function() {
    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Yeni Hoca Ekle";
    
    fields.innerHTML = `
        <div class="form-group">
            <label>Unvani (Title)</label>
            <input type="text" id="lecturer-title" placeholder="Örn: Prof. Dr. veya Dr. Öğr. Üyesi" required>
        </div>
        <div class="form-group">
            <label>İsim Soyisim</label>
            <input type="text" id="lecturer-name" placeholder="Örn: Ahmet Yilmaz" required>
        </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('lecturer-title').value.trim();
        const name = document.getElementById('lecturer-name').value.trim();
        
        if (!DB.lecturers) DB.lecturers = [];
        
        const newLecturer = { title, name };
        DB.lecturers.push(newLecturer);
        
        saveToLocalStorage();
        logAction('admin', 'Hoca Ekleme', `${title} ${name} hoca listesine eklendi.`);
        hideModal();
        renderLecturers();
        await saveToBackend();
    };
};

window.showEditLecturerModal = function(index) {
    if (!DB.lecturers || !DB.lecturers[index]) return;
    const l = DB.lecturers[index];

    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Hoca Düzenle";
    
    fields.innerHTML = `
        <div class="form-group">
            <label>Unvani (Title)</label>
            <input type="text" id="lecturer-title" value="${l.title || ''}" placeholder="Örn: Prof. Dr." required>
        </div>
        <div class="form-group">
            <label>İsim Soyisim</label>
            <input type="text" id="lecturer-name" value="${l.name || ''}" placeholder="Örn: Ahmet Yilmaz" required>
        </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('lecturer-title').value.trim();
        const name = document.getElementById('lecturer-name').value.trim();
        
        DB.lecturers[index] = { title, name };
        
        saveToLocalStorage();
        logAction('admin', 'Hoca Güncelleme', `${title} ${name} bilgileri güncellendi.`);
        hideModal();
        renderLecturers();
        await saveToBackend();
    };
};

window.deleteLecturer = async function(index) {
    if (!DB.lecturers || !DB.lecturers[index]) return;
    const l = DB.lecturers[index];
    const fullName = `${l.title} ${l.name}`;
    if (confirm(`"${fullName}" hocasini silmek istediğinize emin misiniz?`)) {
        DB.lecturers.splice(index, 1);
        saveToLocalStorage();
        logAction('admin', 'Hoca Silme', `"${fullName}" hocasi sistemden silindi.`);
        renderLecturers();
        await saveToBackend();
    }
};

window.showAddMappingModal = function() {
    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Yeni Ders-Hoca Eşleştirmesi Ekle";
    
    if (!DB.lecturers) DB.lecturers = [];
    const lecturerOptions = DB.lecturers.map(l => {
        const fullName = `${l.title} ${l.name}`;
        return `<option value="${fullName}">${fullName}</option>`;
    }).join('');

    fields.innerHTML = `
        <div class="form-group">
            <label>Ders Adi</label>
            <input type="text" id="mapping-course" placeholder="Örn: PHYS 113 veya Türk Dili I" required style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: 8px; color: white;">
        </div>
        <div class="form-group">
            <label>Sorumlu Hoca</label>
            <select id="mapping-lecturer" required style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: 8px; color: white;">
                <option value="">Seçin...</option>
                ${lecturerOptions}
            </select>
        </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = async (e) => {
        e.preventDefault();
        const course = document.getElementById('mapping-course').value.trim();
        const lecturer = document.getElementById('mapping-lecturer').value;
        
        if (!DB.courseLecturers) DB.courseLecturers = {};
        DB.courseLecturers[course] = lecturer;
        
        saveToLocalStorage();
        logAction('admin', 'Ders Eşleştirme Ekleme', `"${course}" dersi "${lecturer}" ile eşleştirildi.`);
        hideModal();
        renderMappings();
        await saveToBackend();
    };
};

window.showEditMappingModal = function(oldCourse, currentLecturer) {
    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Eşleştirmeyi Düzenle";
    
    if (!DB.lecturers) DB.lecturers = [];
    const lecturerOptions = DB.lecturers.map(l => {
        const fullName = `${l.title} ${l.name}`;
        return `<option value="${fullName}" ${fullName === currentLecturer ? 'selected' : ''}>${fullName}</option>`;
    }).join('');

    fields.innerHTML = `
        <div class="form-group">
            <label>Ders Adi</label>
            <input type="text" id="mapping-course" value="${oldCourse}" required style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: 8px; color: white;">
        </div>
        <div class="form-group">
            <label>Sorumlu Hoca</label>
            <select id="mapping-lecturer" required style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: 8px; color: white;">
                <option value="">Seçin...</option>
                ${lecturerOptions}
            </select>
        </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = async (e) => {
        e.preventDefault();
        const newCourse = document.getElementById('mapping-course').value.trim();
        const newLecturer = document.getElementById('mapping-lecturer').value;
        
        if (!DB.courseLecturers) DB.courseLecturers = {};
        
        if (newCourse !== oldCourse) {
            delete DB.courseLecturers[oldCourse];
        }
        
        DB.courseLecturers[newCourse] = newLecturer;
        
        saveToLocalStorage();
        logAction('admin', 'Ders Eşleştirme Güncelleme', `"${newCourse}" dersi eşleştirmesi güncellendi.`);
        hideModal();
        renderMappings();
        await saveToBackend();
    };
};

window.deleteMapping = async function(course) {
    if (confirm(`"${course}" dersinin hoca eşleştirmesini silmek istediğinize emin misiniz?`)) {
        if (DB.courseLecturers && DB.courseLecturers[course]) {
            delete DB.courseLecturers[course];
            saveToLocalStorage();
            logAction('admin', 'Ders Eşleştirme Silme', `"${course}" ders eşleştirmesi silindi.`);
            renderMappings();
            await saveToBackend();
        }
    }
};


function showAddStaffModal() {
    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Yeni Personel Ekle";
    
    fields.innerHTML = `
        <div class="form-group">
            <label>Personel Adi Soyadi</label>
            <input type="text" id="staff-name" placeholder="Örn: Dr. Can Berk" required>
        </div>
        <div class="form-group">
            <label>E-posta Adresi</label>
            <input type="email" id="staff-email" placeholder="personel@gtu.edu.tr">
        </div>
        <div class="form-group">
            <label>Cinsiyet</label>
            <select id="staff-gender" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); border-radius: 8px; color: white;">
                <option value="Belirtilmemiş">Belirtilmemiş (İsimden Tahmin Et)</option>
                <option value="Erkek">Erkek</option>
                <option value="Kadin">Kadin</option>
            </select>
        </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('staff-name').value;
        const email = document.getElementById('staff-email').value;
        const genderVal = document.getElementById('staff-gender').value;
        const gender = genderVal === 'Belirtilmemiş' ? predictGender(name) : genderVal;
        const newStaff = {
            id: Date.now(),
            name: name,
            email: email,
            gender: gender,
            totalScore: 0,
            taskCount: 0,
            baseScore: 0
        };
        DB.staff.push(newStaff);
        saveToLocalStorage();
        logAction('admin', 'Personel Ekleme', `${newStaff.name} personel listesine eklendi.`);
        hideModal();
        renderStaff();
    };
}

window.showEditStaffModal = (id) => {
    const staff = DB.staff.find(s => String(s.id) === String(id));
    if (!staff) return;

    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Personel Düzenle";
    
    const gender = staff.gender || 'Belirtilmemiş';
    
    fields.innerHTML = `
        <div class="form-group">
            <label>Personel Adi Soyadi</label>
            <input type="text" id="staff-name" value="${staff.name}" required>
        </div>
        <div class="form-group">
            <label>E-posta Adresi</label>
            <input type="email" id="staff-email" value="${staff.email || ''}">
        </div>
        <div class="form-group">
            <label>Cinsiyet</label>
            <select id="staff-gender" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); border-radius: 8px; color: white;">
                <option value="Belirtilmemiş" ${gender === 'Belirtilmemiş' ? 'selected' : ''}>Belirtilmemiş (İsimden Tahmin Et)</option>
                <option value="Erkek" ${gender === 'Erkek' ? 'selected' : ''}>Erkek</option>
                <option value="Kadin" ${gender === 'Kadin' ? 'selected' : ''}>Kadin</option>
            </select>
        </div>
    `;
    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = (e) => {
        e.preventDefault();
        staff.name = document.getElementById('staff-name').value;
        staff.email = document.getElementById('staff-email').value;
        const genderVal = document.getElementById('staff-gender').value;
        staff.gender = genderVal === 'Belirtilmemiş' ? predictGender(staff.name) : genderVal;
        
        saveToLocalStorage();
        logAction('admin', 'Personel Güncelleme', `${staff.name} bilgileri güncellendi.`);
        hideModal();
        renderStaff();
    };
};

window.deleteStaff = async (id) => {
    const staff = DB.staff.find(s => String(s.id) === String(id));
    if (!staff) return;

    if (confirm(`"${staff.name}" personelini silmek istediğinize emin misiniz?\n\nℹ️ Bu personelin geçmiş veya mevcut sinavlarda yaptiği görevler korunacak, sadece personel listesinden ve aktif panelden çikarilacaktir.`)) {
        if (typeof takeSnapshot === 'function') {
            takeSnapshot("Personel Silme: " + staff.name);
        }

        // Sinav kayitlarinda görev geçmişini ve ismini koru
        if (DB.exams && Array.isArray(DB.exams)) {
            DB.exams.forEach(ex => {
                const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
                if (pIds.map(String).includes(String(staff.id))) {
                    if (!ex.proctorName || !ex.proctorName.includes(staff.name)) {
                        ex.proctorName = ex.proctorName ? `${ex.proctorName}, ${staff.name}` : staff.name;
                    }
                }
            });
        }

        // Personel listesinden çikar
        DB.staff = DB.staff.filter(s => String(s.id) !== String(id));

        // Personelin kisitlarini temizle
        if (DB.constraints && DB.constraints[staff.name]) {
            delete DB.constraints[staff.name];
        }

        saveToLocalStorage();
        logAction('admin', 'Personel Silme', `${staff.name} sistemden silindi (Sinavlardaki görev geçmişi korundu).`);
        renderStaff();
        renderExams();
        renderSchedule();
        renderDashboard();
        await saveToBackend();
        alert(`✓ ${staff.name} sistemden silindi. Sinavlardaki görev geçmişi korundu.`);
    }
};

window.showEmailSettingsModal = () => {
    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "📢 Bildirim & Webhook Ayarlari";
    
    if (!DB.emailSettings) {
        DB.emailSettings = {
            enabled: false,
            provider: 'emailjs',
            smtpToken: '',
            apiEndpoint: '',
            fromEmail: 'noreply@gtu.edu.tr',
            emailjsServiceId: '',
            emailjsTemplateId: '',
            emailjsPublicKey: '',
            webhookEnabled: false,
            webhookUrl: '',
            eventToggles: {
                marketplace_drop: true,
                swap_offer: true,
                swap_accepted: true,
                swap_rejected: true
            }
        };
    }
    const es = DB.emailSettings;
    const toggles = es.eventToggles || { marketplace_drop: true, swap_offer: true, swap_accepted: true, swap_rejected: true };

    fields.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <!-- SİSTEM WEB ADRESİ BÖLÜMÜ -->
            <div style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25); border-radius: 12px; padding: 1.25rem;">
                <strong style="color: #6366f1; font-size: 1rem; display: flex; align-items: center; gap: 6px; margin-bottom: 0.5rem;">
                    <span>🌐</span> Sistem Web Adresi (URL)
                </strong>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                    Gözetmenlere gönderilen tüm görev, güncelleme, iptal ve takas bildirimlerinde personelin tek tikla sisteme ulaşabilmesi için bu web adresi kullanilir.
                </p>
                <div class="form-group" style="margin-bottom: 0;">
                    <input type="text" id="email-system-url" value="${es.systemUrl || ''}" placeholder="Örn: https://sinav.gtu.edu.tr (Boş birakilirsa mevcut site adresi otomatik kullanilir)" style="font-size: 0.85rem; font-family: monospace;">
                </div>
            </div>

            <!-- WEBHOOK BÖLÜMÜ -->
            <div style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25); border-radius: 12px; padding: 1.25rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                    <div>
                        <strong style="color: #6366f1; font-size: 1rem; display: flex; align-items: center; gap: 6px;">
                            <span>🚀</span> Discord / Webhook Anlik Bildirimi
                        </strong>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                            Takas teklifleri ve pazar yeri hareketleri Discord / Telegram / Slack kanalina zengin formatta aninda iletilir.
                        </p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="webhook-enabled" ${es.webhookEnabled ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.8rem; font-weight: 600;">Webhook URL (Discord / Slack / Genel HTTP)</label>
                    <input type="text" id="webhook-url" value="${es.webhookUrl || ''}" placeholder="https://discord.com/api/webhooks/..." style="font-size: 0.85rem; font-family: monospace;">
                </div>
            </div>

            <!-- E-POSTA BÖLÜMÜ -->
            <div style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 12px; padding: 1.25rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                    <div>
                        <strong style="color: #10b981; font-size: 1rem; display: flex; align-items: center; gap: 6px;">
                            <span>📧</span> E-Posta Bildirim Sistemi
                        </strong>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                            Gözetmenlerin kurumsal e-posta adreslerine (@gtu.edu.tr) doğrudan bildirim gönderir.
                        </p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="email-enabled" ${es.enabled ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>

                <div class="form-group">
                    <label style="font-size: 0.8rem;">E-Posta Servis Sağlayici</label>
                    <select id="email-provider" onchange="toggleEmailProviderFields()" style="font-size: 0.85rem;">
                        <option value="emailjs" ${es.provider === 'emailjs' ? 'selected' : ''}>EmailJS (Önerilen - Sunucusuz & Ücretsiz)</option>
                        <option value="smtpjs" ${es.provider === 'smtpjs' ? 'selected' : ''}>SmtpJS</option>
                        <option value="api" ${es.provider === 'api' ? 'selected' : ''}>Özel API Endpoint (POST)</option>
                    </select>
                </div>

                <!-- EmailJS Alanlari -->
                <div id="group-emailjs" class="${es.provider !== 'emailjs' ? 'hidden' : ''}">
                    <div class="form-group">
                        <label style="font-size: 0.8rem;">EmailJS Service ID</label>
                        <input type="text" id="emailjs-service-id" value="${es.emailjsServiceId || ''}" placeholder="service_xxxxxxx">
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem;">EmailJS Template ID</label>
                        <input type="text" id="emailjs-template-id" value="${es.emailjsTemplateId || ''}" placeholder="template_xxxxxxx">
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem;">EmailJS Public Key</label>
                        <input type="password" id="emailjs-public-key" value="${es.emailjsPublicKey || ''}" placeholder="EmailJS Public Key">
                        <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">* Emailjs.com adresinden ücretsiz hesap açarak Service ID, Template ID ve Public Key alabilirsiniz.</p>
                    </div>
                </div>

                <!-- SmtpJS Alanlari -->
                <div id="group-smtpjs" class="${es.provider !== 'smtpjs' ? 'hidden' : ''}">
                    <div class="form-group">
                        <label style="font-size: 0.8rem;">Gönderen E-posta (From)</label>
                        <input type="text" id="email-from" value="${es.fromEmail || 'noreply@gtu.edu.tr'}" placeholder="noreply@gtu.edu.tr">
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem;">SmtpJS Secure Token</label>
                        <input type="password" id="email-token" value="${es.smtpToken || ''}" placeholder="SmtpJS Token...">
                        <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">* SmtpJS.com üzerinden token alabilirsiniz.</p>
                    </div>
                </div>

                <!-- Özel API Alanlari -->
                <div id="group-api" class="${es.provider !== 'api' ? 'hidden' : ''}">
                    <div class="form-group">
                        <label style="font-size: 0.8rem;">API Endpoint (POST)</label>
                        <input type="text" id="email-api" value="${es.apiEndpoint || ''}" placeholder="https://api.siteniz.com/send-email">
                    </div>
                </div>
            </div>

            <!-- BİLDİRİM OLAY SEÇİMLERİ -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 12px; padding: 1.25rem;">
                <strong style="font-size: 0.9rem; display: block; margin-bottom: 0.75rem;">🔔 Bildirim Gönderilecek Olaylar</strong>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
                        <input type="checkbox" id="toggle-event-marketplace" ${toggles.marketplace_drop !== false ? 'checked' : ''}>
                        <span>📢 Pazar Yeri Açik İlanlari</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
                        <input type="checkbox" id="toggle-event-swap-offer" ${toggles.swap_offer !== false ? 'checked' : ''}>
                        <span>🔄 Birebir Takas Teklifleri</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
                        <input type="checkbox" id="toggle-event-swap-accepted" ${toggles.swap_accepted !== false ? 'checked' : ''}>
                        <span>✅ Onaylanan / Biten Takaslar</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer;">
                        <input type="checkbox" id="toggle-event-swap-rejected" ${toggles.swap_rejected !== false ? 'checked' : ''}>
                        <span>❌ Reddedilen / İptal Talepler</span>
                    </label>
                </div>
            </div>

            <!-- TEST BUTONU -->
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn-secondary" onclick="sendTestNotificationUI()" style="background: rgba(99,102,241,0.2); color: #818cf8; border-color: rgba(99,102,241,0.4);">
                    🔔 Test Bildirimi Gönder
                </button>
            </div>
        </div>
    `;

    window.toggleEmailProviderFields = () => {
        const provider = document.getElementById('email-provider').value;
        document.getElementById('group-emailjs')?.classList.toggle('hidden', provider !== 'emailjs');
        document.getElementById('group-smtpjs')?.classList.toggle('hidden', provider !== 'smtpjs');
        document.getElementById('group-api')?.classList.toggle('hidden', provider !== 'api');
    };

    window.sendTestNotificationUI = async () => {
        const webhookUrl = document.getElementById('webhook-url')?.value?.trim();
        const webhookEnabled = document.getElementById('webhook-enabled')?.checked;
        const emailEnabled = document.getElementById('email-enabled')?.checked;
        const provider = document.getElementById('email-provider')?.value;
        const emailjsServiceId = document.getElementById('emailjs-service-id')?.value?.trim();
        const emailjsTemplateId = document.getElementById('emailjs-template-id')?.value?.trim();
        const emailjsPublicKey = document.getElementById('emailjs-public-key')?.value?.trim();
        const emailFrom = document.getElementById('email-from')?.value?.trim();
        const smtpToken = document.getElementById('email-token')?.value?.trim();
        const apiEndpoint = document.getElementById('email-api')?.value?.trim();

        let results = [];

        // 1. Webhook Testi
        if (webhookEnabled && webhookUrl) {
            try {
                const res = await sendWebhookNotification({
                    title: "🧪 GTÜ Gözetmenlik Sistemi - Canli Test Bildirimi",
                    description: "Tebrikler! Webhook entegrasyonu başariyla çalişiyor. Takas ve pazar yeri hareketleri anlik olarak bu kanala iletilecektir.",
                    fields: [
                        { name: "📡 Servis Durumu", value: "Aktif / Canli", inline: true },
                        { name: "🕒 Tarih & Saat", value: new Date().toLocaleString('tr-TR'), inline: true },
                        { name: "⚖️ Sistem", value: "GTÜ Matematik Gözetmenlik Katsayi Sistemi", inline: false }
                    ],
                    color: 0x10b981,
                    eventType: 'test_notification',
                    url: webhookUrl
                });
                if (res.success) {
                    results.push("✅ Webhook testi başarili!");
                } else {
                    results.push("⚠️ Webhook testi başarisiz: " + (res.error || res.statusText || 'Bilinmeyen hata'));
                }
            } catch (err) {
                results.push("⚠️ Webhook testi hatasi: " + err.message);
            }
        } else if (webhookEnabled && !webhookUrl) {
            results.push("⚠️ Webhook etkin ancak Webhook URL girilmemiş.");
        }

        // 2. E-posta Testi
        if (emailEnabled) {
            const myStaffId = localStorage.getItem('myStaffId');
            const targetStaff = DB.staff.find(s => String(s.id) === String(myStaffId)) || DB.staff[0];
            const testEmail = targetStaff ? targetStaff.email : 'test@gtu.edu.tr';

            try {
                const origSettings = { ...DB.emailSettings };
                DB.emailSettings = {
                    ...DB.emailSettings,
                    enabled: true,
                    provider,
                    fromEmail,
                    smtpToken,
                    apiEndpoint,
                    emailjsServiceId,
                    emailjsTemplateId,
                    emailjsPublicKey
                };

                const res = await sendSwapNotificationEmail({
                    toEmail: testEmail,
                    subject: "🧪 GTÜ Gözetmenlik - E-posta Test Bildirimi",
                    body: `Sayin ${targetStaff ? targetStaff.name : 'Gözetmen'},\n\nBu bir test e-postasidir. E-posta bildirim entegrasyonunuz başariyla çalişmaktadir.\n\nTarih: ${new Date().toLocaleString('tr-TR')}\nGTÜ Matematik Bölümü`,
                    templateParams: {
                        to_name: targetStaff ? targetStaff.name : 'Gözetmen',
                        test_time: new Date().toLocaleString('tr-TR')
                    },
                    eventType: 'test_notification'
                });

                DB.emailSettings = origSettings;

                if (res.success) {
                    results.push(`✅ E-posta testi başarili (${testEmail} adresine gönderildi)!`);
                } else {
                    results.push(`⚠️ E-posta testi başarisiz: ${res.reason || res.error || 'Ayrinti konsolda'}`);
                }
            } catch (err) {
                results.push("⚠️ E-posta gönderim hatasi: " + err.message);
            }
        }

        if (results.length === 0) {
            alert("Test gönderilecek bir servis (Webhook veya E-posta) etkinleştirilmemiş.");
        } else {
            alert(results.join('\n\n'));
        }
    };

    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = async (e) => {
        e.preventDefault();
        DB.emailSettings = {
            enabled: document.getElementById('email-enabled')?.checked || false,
            provider: document.getElementById('email-provider')?.value || 'emailjs',
            fromEmail: document.getElementById('email-from')?.value || 'noreply@gtu.edu.tr',
            smtpToken: document.getElementById('email-token')?.value || '',
            apiEndpoint: document.getElementById('email-api')?.value || '',
            systemUrl: document.getElementById('email-system-url')?.value?.trim() || '',
            emailjsServiceId: document.getElementById('emailjs-service-id')?.value || '',
            emailjsTemplateId: document.getElementById('emailjs-template-id')?.value || '',
            emailjsPublicKey: document.getElementById('emailjs-public-key')?.value || '',
            webhookEnabled: document.getElementById('webhook-enabled')?.checked || false,
            webhookUrl: document.getElementById('webhook-url')?.value?.trim() || '',
            eventToggles: {
                marketplace_drop: document.getElementById('toggle-event-marketplace')?.checked !== false,
                swap_offer: document.getElementById('toggle-event-swap-offer')?.checked !== false,
                swap_accepted: document.getElementById('toggle-event-swap-accepted')?.checked !== false,
                swap_rejected: document.getElementById('toggle-event-swap-rejected')?.checked !== false
            }
        };
        
        saveToLocalStorage();
        logAction('admin', 'Bildirim Ayarlari', `Bildirim ve Webhook ayarlari güncellendi (Webhook: ${DB.emailSettings.webhookEnabled ? 'Açik' : 'Kapali'}, E-posta: ${DB.emailSettings.enabled ? 'Açik' : 'Kapali'}).`);
        hideModal();
        await saveToBackend();
        alert('✅ Bildirim ve Webhook ayarlari başariyla kaydedildi.');
    };
};

window.showEmailTemplatesModal = () => {
    if (!DB.templates) {
        DB.templates = {
            swap_request: "Merhaba {alici_adi},\n\n{tarih} tarihindeki {sinav_adi} sinavimdaki görevimi seninle takas etmek istiyorum. Onay verirsen yöneticiye bildireceğim.\n\n🌐 Sisteme Giriş: {site_url}\n\nİyi çalişmalar,\n{gonderen_adi}",
            assignment_email_subject: "📅 Yeni Gözetmenlik Görevi: {sinav_adi} | {tarih}",
            assignment_email_body: "",
            update_email_subject: "🔄 Görev Güncellendi: {sinav_adi} | {tarih}",
            update_email_body: "",
            cancel_email_subject: "❌ Görev İptal Edildi: {sinav_adi} | {tarih}",
            cancel_email_body: ""
        };
    }

    document.getElementById('tpl-new-subject').value = DB.templates.assignment_email_subject || '';
    document.getElementById('tpl-new-body').value = DB.templates.assignment_email_body || '';
    document.getElementById('tpl-update-subject').value = DB.templates.update_email_subject || '';
    document.getElementById('tpl-update-body').value = DB.templates.update_email_body || '';
    document.getElementById('tpl-cancel-subject').value = DB.templates.cancel_email_subject || '';
    document.getElementById('tpl-cancel-body').value = DB.templates.cancel_email_body || '';

    switchTemplateEditTab('new');
    document.getElementById('modal-email-templates').classList.remove('hidden');
};

window.switchTemplateEditTab = (type) => {
    const btnNew = document.getElementById('tpl-tab-btn-new');
    const btnUpdate = document.getElementById('tpl-tab-btn-update');
    const btnCancel = document.getElementById('tpl-tab-btn-cancel');

    const conNew = document.getElementById('tpl-edit-new-container');
    const conUpdate = document.getElementById('tpl-edit-update-container');
    const conCancel = document.getElementById('tpl-edit-cancel-container');

    btnNew.classList.remove('active');
    btnUpdate.classList.remove('active');
    btnCancel.classList.remove('active');

    conNew.classList.add('hidden');
    conUpdate.classList.add('hidden');
    conCancel.classList.add('hidden');

    if (type === 'new') {
        btnNew.classList.add('active');
        conNew.classList.remove('hidden');
    } else if (type === 'update') {
        btnUpdate.classList.add('active');
        conUpdate.classList.remove('hidden');
    } else if (type === 'cancel') {
        btnCancel.classList.add('active');
        conCancel.classList.remove('hidden');
    }
};

window.saveEmailTemplates = async (e) => {
    e.preventDefault();
    if (!DB.templates) DB.templates = {};

    DB.templates.assignment_email_subject = document.getElementById('tpl-new-subject').value.trim();
    DB.templates.assignment_email_body = document.getElementById('tpl-new-body').value;
    DB.templates.update_email_subject = document.getElementById('tpl-update-subject').value.trim();
    DB.templates.update_email_body = document.getElementById('tpl-update-body').value;
    DB.templates.cancel_email_subject = document.getElementById('tpl-cancel-subject').value.trim();
    DB.templates.cancel_email_body = document.getElementById('tpl-cancel-body').value;

    saveToLocalStorage();
    logAction('admin', 'Şablon Güncelleme', 'E-posta şablonlari güncellendi.');
    document.getElementById('modal-email-templates').classList.add('hidden');
    alert('E-posta şablonlari kaydedildi.');
    await saveToBackend();
};


window.showStaffSchedule = (staffName) => {
    const modal = document.getElementById('modal-staff-schedule');
    const title = document.getElementById('staff-name-title');
    const nameHeader = document.getElementById('individual-proctor-name');
    
    title.textContent = `${staffName} - Bireysel Program`;
    nameHeader.textContent = staffName;
    
    // Sekme sifirlama
    switchIndividualTab('active');
    
    const tbodyActive = document.querySelector('#table-individual-schedule tbody');
    const tbodyArchive = document.querySelector('#table-archive-schedule tbody');
    tbodyActive.innerHTML = '';
    tbodyArchive.innerHTML = '';
    
    // Şimdiki zamani al (Karşilaştirma için)
    const now = new Date();
    
    // Filtrele ve tarihe göre sirala
    const staffObj = DB.staff.find(s => s.name === staffName);
    const individualExams = DB.exams
        .filter(ex => {
            const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
            if (staffObj && pIds.includes(staffObj.id)) return true;
            return ex.proctorName && ex.proctorName.includes(staffName);
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        
    individualExams.forEach(ex => {
        const tr = document.createElement('tr');
        const dateStr = ex.date.split("-").reverse().join(".");
        
        // Sinavin bitiş zamanini hesapla (yaklaşik)
        const examDate = getSafeDate(ex.date, ex.time);
        const examEnd = new Date(examDate.getTime() + ex.duration * 60000);
        
        tr.innerHTML = `
            <td><span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #a78bfa; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(139, 92, 246, 0.3);">${ex.type || 'Vize'}</span></td>
            <td style="font-weight: 600;">${ex.name}</td>
            <td>${ex.lecturer || '-'}</td>
            <td>${ex.capacity || '-'}</td>
            <td>${ex.location}</td>
            <td>${dateStr}</td>
            <td>${ex.time}</td>
            <td>${ex.duration} dk</td>
        `;

        // Eğer sinav bittiyse Arşiv'e, bitmediyse veya bugünse Aktif'e
        if (examEnd < now) {
            tbodyArchive.appendChild(tr);
        } else {
            const activeReq = (DB.requests || []).find(r => r.examId == ex.id && ['pending', 'accepted_waiting_approval'].includes(r.status));
            
            const tdAction = document.createElement('td');
            tdAction.style.textAlign = 'right';
            
            const isMe = String(ex.proctorId) === String(localStorage.getItem('myStaffId')) || 
                         (ex.proctorIds || []).map(pid => String(pid)).includes(localStorage.getItem('myStaffId'));

            if (activeReq) {
                const isInitiator = String(activeReq.initiatorId) === String(localStorage.getItem('myStaffId'));
                const statusLabels = {
                    'pending': '<span class="status-badge status-pending" style="font-size:0.6rem;">Açik Talep</span>',
                    'accepted_waiting_approval': '<span class="status-badge status-pending-peer" style="font-size:0.6rem;">Onay Bekliyor</span>',
                    'pending_peer': '<span class="status-badge status-pending-peer" style="font-size:0.6rem;">Onay Bekliyor</span>'
                };
                tdAction.innerHTML = `
                    ${isInitiator ? `<button class="btn-delete" onclick="cancelSwapRequest(${activeReq.id})" title="Talebi İptal Et" style="padding: 0.35rem 0.6rem; font-size: 0.7rem; margin-right: 5px;"><span class="icon" style="margin:0;">🚫</span></button>` : ''}
                    ${statusLabels[activeReq.status] || ''} <span class="badge active">Görevli</span>
                `;
            } else {
                tdAction.innerHTML = `
                    ${isMe ? `<button class="btn-secondary" onclick="initiateDirectSwap(${ex.id})" title="Hoca ile Takas Et" style="padding: 0.35rem 0.6rem; border-size: 0.7rem; margin-right: 5px;"><span class="icon" style="margin:0;">🔄</span></button>` : ''}
                    ${isMe ? `<button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.7rem; background: var(--accent-orange); margin-right: 5px;" onclick="initiateOpenSwap(${ex.id})">Yerime Biri Lazim</button>` : ''}
                    <span class="badge active">Görevli</span>
                `;
            }
            tr.appendChild(tdAction);
            tbodyActive.appendChild(tr);
        }
    });

    // Eğer tablolar boşsa mesaj göster
    if (tbodyActive.children.length === 0) {
        tbodyActive.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:2rem;">Aktif görev bulunmuyor.</td></tr>';
    }
    if (tbodyArchive.children.length === 0) {
        tbodyArchive.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem;">Arşivlenmiş görev bulunmuyor.</td></tr>';
    }

    // --- İKİLİ ONAY SİSTEMİ: Onay Bekleyenleri Göster ---
    const peerSection = document.getElementById('peer-approval-section');
    const peerList = document.getElementById('peer-approval-list');
    if (peerSection && peerList) {
        const staff = DB.staff.find(s => s.name === staffName);
        if (staff) {
            // Eğer ben receiver isem ve onaylamadiysam:
            const myIncoming = (DB.requests || []).filter(r => r.status === 'pending_peer' && r.receiverId === staff.id && !r.toApproved);

            if (myIncoming.length > 0) {
                peerSection.classList.remove('hidden');
                peerList.innerHTML = myIncoming.map(r => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:1rem; border-radius:8px; margin-bottom:10px;">
                        <div style="font-size:0.85rem;">
                            <strong>${r.examName}</strong><br>
                            <span style="color:var(--text-muted)">${r.initiatorName} size devretmek istiyor.</span>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button class="btn-primary" onclick="approveSwapPeer(${r.id}, ${staff.id})" style="background:#10b981; padding:0.4rem 0.8rem; font-size:0.75rem;">Onayla</button>
                            <button class="btn-delete" onclick="rejectSwapPeer(${r.id})" style="padding:0.4rem 0.8rem; font-size:0.75rem;">Reddet</button>
                        </div>
                    </div>
                `).join('');
            } else {
                peerSection.classList.add('hidden');
            }
        }
    }
    
    modal.classList.remove('hidden');

    // --- MANUEL ATAMA (FEATURE 4.3) ---
    const btnAssign = document.getElementById('btn-assign-substitute');
    const currentUser = JSON.parse(sessionStorage.getItem('user'));
    const isGuest = sessionStorage.getItem('isAdmin') === 'false' && currentUser;
    
    if (isGuest && staffName !== currentUser.name) {
        const targetStaff = DB.staff.find(s => s.name === staffName);
        if (targetStaff) {
            btnAssign.style.display = 'block';
            btnAssign.onclick = () => assignAsSubstitute(targetStaff.id, targetStaff.name, currentUser);
        } else {
            btnAssign.style.display = 'none';
        }
    } else {
        btnAssign.style.display = 'none';
    }
};

window.assignAsSubstitute = async function(targetStaffId, targetStaffName, currentUser) {
    const myExams = DB.exams.filter(ex => {
        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        const examDate = getSafeDate(ex.date, ex.time);
        return pIds.includes(currentUser.id) && examDate > new Date();
    });

    if (myExams.length === 0) {
        alert("Üzerinizde devredilebilecek aktif bir görev bulunmuyor.");
        return;
    }

    let selectedExam;
    if (myExams.length === 1) {
        selectedExam = myExams[0];
        if (!confirm(`${selectedExam.name} (${selectedExam.date} ${selectedExam.time}) görevini ${targetStaffName} hocaya devretmek istiyor musunuz?`)) return;
    } else {
        const examOptions = myExams.map((ex, i) => `${i+1}-) ${ex.name} (${ex.date} ${ex.time})`).join('\n');
        const choice = prompt(`Hangi görevi devretmek istiyorsunuz? (1-${myExams.length} arasi rakam girin)\n\n${examOptions}`);
        const idx = parseInt(choice) - 1;
        if (isNaN(idx) || idx < 0 || idx >= myExams.length) {
            alert("Geçersiz seçim.");
            return;
        }
        selectedExam = myExams[idx];
    }

    if (!isAvailable(targetStaffName, selectedExam.date, selectedExam.time, selectedExam.duration)) {
        alert(`${targetStaffName} bu saatte müsait değil! Lütfen başka birini seçin.`);
        return;
    }

    if (confirm("Atama işlemini başlatiyorum. Onayliyor musunuz?")) {
        const oldProctorIds = [...(selectedExam.proctorIds || [])];
        const newProctorIds = oldProctorIds.filter(id => id !== currentUser.id);
        newProctorIds.push(targetStaffId);
        
        const updateData = {
            ...selectedExam,
            proctorIds: newProctorIds
        };
        
        updateExam(selectedExam.id, updateData);
        alert("Görev başariyla devredildi.");
        hideIndividualModal();
        renderExams();
        renderSchedule();
        renderDashboard();
    }
};

window.approveSwapPeer = async function(requestId, staffId) {
    const req = DB.requests.find(r => r.id === requestId);
    if (!req) return;

    // Direct swap desteği ekle (Eğer yanlişlikla buradan gelirse)
    if (req.type === 'direct_swap') {
        return acceptDirectSwap(requestId);
    }

    if (req.receiverId === staffId) {
        req.toApproved = true;
        
        // BİREBİR TAKAS falan değilse (initiatorId ve examId varsa)
        const exam = DB.exams.find(e => String(e.id) === String(req.examId));
        const fromStaff = DB.staff.find(s => s.id == req.initiatorId);
        const toStaff = DB.staff.find(s => s.id == staffId);

        if (exam && fromStaff && toStaff) {
            if (shouldCountAsNonExam(exam)) {
                fromStaff.nonExamScore = Math.max(0, parseFloat(((fromStaff.nonExamScore || 0) - exam.score).toFixed(2)));
                fromStaff.nonExamTaskCount = Math.max(0, (fromStaff.nonExamTaskCount || 0) - 1);
                toStaff.nonExamScore = parseFloat(((toStaff.nonExamScore || 0) + exam.score).toFixed(2));
                toStaff.nonExamTaskCount = (toStaff.nonExamTaskCount || 0) + 1;
            } else {
                fromStaff.totalScore = Math.max(0, parseFloat((fromStaff.totalScore - exam.score).toFixed(2)));
                fromStaff.taskCount = Math.max(0, fromStaff.taskCount - 1);
                toStaff.totalScore = parseFloat((toStaff.totalScore + exam.score).toFixed(2));
                toStaff.taskCount = (toStaff.taskCount || 0) + 1;
            }

            exam.proctorId = toStaff.id;
            exam.proctorName = toStaff.name;
            if (!exam.proctorIds) exam.proctorIds = [toStaff.id];
            else {
                const idx = exam.proctorIds.indexOf(fromStaff.id);
                if (idx !== -1) exam.proctorIds[idx] = toStaff.id;
            }

            req.status = 'approved';
            saveToLocalStorage();
            
            // Webhook ve E-posta bildirimi tetikle
            dispatchNotificationEvent('swap_accepted', {
                initiatorName: fromStaff.name,
                initiatorId: fromStaff.id,
                receiverName: toStaff.name,
                receiverId: toStaff.id,
                examName: exam.name,
                swapType: 'peer_transfer'
            });

            alert("✅ Görev devri işlemini onayladiniz. Değişiklik aninda kaydedildi.");
        }
        
        const staff = DB.staff.find(s => s.id === staffId);
        await saveToBackend();
    }
};

window.rejectSwapPeer = async function(requestId) {
    const req = DB.requests.find(r => r.id === requestId);
    if (!req) return;
    req.status = 'rejected';
    saveToLocalStorage();
    
    const receiver = DB.staff.find(s => s.id === req.receiverId);
    dispatchNotificationEvent('swap_rejected', {
        initiatorName: req.initiatorName,
        initiatorId: req.initiatorId,
        receiverName: receiver ? receiver.name : req.receiverName,
        examName: req.examName
    });

    alert("Takas talebini reddettiniz.");
    
    if (receiver) showStaffSchedule(receiver.name);

    await saveToBackend();
};

function hideIndividualModal() {
    document.getElementById('modal-staff-schedule').classList.add('hidden');
}

/**
 * Bireysel Program Modalinda Sekme Değiştirme
 */
window.switchIndividualTab = function(tab) {
    // Butonlari güncelle
    const btnActive = document.getElementById('tab-btn-active');
    const btnArchive = document.getElementById('tab-btn-archive');
    
    if (btnActive && btnArchive) {
        btnActive.classList.remove('active');
        btnArchive.classList.remove('active');
        if (tab === 'active') btnActive.classList.add('active');
        else btnArchive.classList.add('active');
    }

    // Panelleri güncelle
    const paneActive = document.getElementById('tab-content-active');
    const paneArchive = document.getElementById('tab-content-archive');

    if (paneActive && paneArchive) {
        paneActive.classList.remove('active');
        paneArchive.classList.remove('active');
        if (tab === 'active') paneActive.classList.add('active');
        else paneArchive.classList.add('active');
    }
};

/**
 * UI Öneri Listesini Güncelle
 */
function updateSuggestionsUI(date, time, duration, areaId, listId, currentExamId, selectId = null, isNonExam = false, examName = "") {
    const area = document.getElementById(areaId);
    const list = document.getElementById(listId);
    if (!area || !list) return;

    if (!date || !time) {
        area.classList.add('hidden');
        return;
    }

    const recs = getRecommendedProctors(date, time, duration, currentExamId, isNonExam, examName);
    
    if (recs.length === 0) {
        area.classList.add('hidden');
        return;
    }

    area.classList.remove('hidden');
    list.innerHTML = recs.map(s => `
        <div class="suggestion-item" onclick="selectSuggestedProctor('${areaId}', '${selectId}', ${s.id})">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div>
                    <strong style="display: block;">${s.name}</strong>
                    <span style="font-size: 0.7rem; color: var(--accent-green); font-weight: 600;">${s.reason}</span>
                </div>
                <div style="text-align: right;">
                    <span class="staff-score" style="display: block;">${s.totalScore.toFixed(1)} Puan</span>
                    <span style="font-size: 0.65rem; opacity: 0.7;">${s.taskCount} Görev</span>
                </div>
            </div>
        </div>
    `).join('');
}

window.selectSuggestedProctor = (areaId, selectId, staffId) => {
    // Eğer düzenleme modalindaysak selectId bellidir, ekleme modalindaysak select yoktur (Çünkü henüz eklenmedi)
    // Ekleme modalinda proctor seçimi için logic.js içindeki atama mantiğini kullaniyoruz, 
    // ancak kullanici deneyimi için ekleme modalinda da bir select olsaydi iyi olurdu.
    // Şimdilik ekleme modalinda öneriye tiklayinca hoca adini saklayip form submit'te kullanabiliriz veya ekleme modalina da select ekleyebiliriz.
    
    if (selectId && selectId !== 'null') {
        const select = document.getElementById(selectId);
        if (select) {
            select.value = staffId;
            // Görsel geribildirim için alani gizle
            document.getElementById(areaId).classList.add('hidden');
        }
    } else {
        // Ekleme modalinda "proctor" seçimi yok, algoritmaya birakiliyor. 
        // Ancak kullanici "Ben bunu istiyorum" diyorsa, bir hoca ismi seçtirip Manuel atama gibi davranabiliriz.
        // Basitlik adina ekleme modalinda öneriye tiklayinca otomatik atama yapacak bir gizli alan ekleyelim.
        window.selectedProctorId = staffId;
        alert(`${DB.staff.find(s=>s.id === staffId).name} seçildi. Kaydet'e bastiğinizda bu hoca atanacaktir.`);
        document.getElementById(areaId).classList.add('hidden');
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

    // Seçilen günde sinav saatlerini topla (benzersiz saatler)
    const dayExams = DB.exams.filter(e => e.date === selectedDate);
    const timeSlots = [...new Set(dayExams.map(e => e.time))].sort();

    if (timeSlots.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Bu tarihte kayitli sinav bulunmuyor.</p>';
        return;
    }

    // Tarih için gün numarasi (kisit kontrolü)
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
            // Bu saatte bu personelin sinavi var mi?
            const busyExam = dayExams.find(e => e.time === t && e.proctorId === s.id);

            if (busyExam) {
                html += `<td class="avail-cell-busy" title="${busyExam.name}">📋 ${busyExam.name}</td>`;
            } else {
                // Kisit kontrolü
                const isRestricted = !isAvailable(s.name, selectedDate, t, 60);
                if (isRestricted) {
                    html += '<td class="avail-cell-restricted" title="Kisitli">⚠️</td>';
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



/**
 * TAKAS SİSTEMİ ÇEKİRDEK MANTIĞI
 */

window.showSwapModal = function(examId, forceInitiatorId = null) {
    const exam = DB.exams.find(e => String(e.id) === String(examId));
    if (!exam) return;

    document.getElementById('swap-exam-id').value = examId;
    document.getElementById('swap-exam-name').textContent = exam.name;
    
    const receiverSelect = document.getElementById('swap-receiver-select');
    const initiatorSelect = document.getElementById('swap-initiator-select');
    
    if (!receiverSelect || !initiatorSelect) return;

    const staffOptions = DB.staff.map(s => `<option value="${s.id}">${s.name} (${s.totalScore.toFixed(1)} P.)</option>`).join('');
    receiverSelect.innerHTML = `<option value="">Bir gözetmen seçin (Opsiyonel)...</option>` + staffOptions;
    initiatorSelect.innerHTML = staffOptions;
    
    // Devreden hoca (Initiator) otomatik seçimi
    if (forceInitiatorId) {
        initiatorSelect.value = forceInitiatorId;
    } else if (exam.proctorId) {
        initiatorSelect.value = exam.proctorId;
    }

    // Çakişma kontrolü için dinleyici
    const checkSwapConflict = () => {
        const receiverId = parseInt(receiverSelect.value);
        const warnDiv = document.getElementById('swap-conflict-warning');
        if (!receiverId || isNaN(receiverId)) {
            warnDiv.classList.add('hidden');
            return;
        }
        // isAvailable(staffName, date, time, duration)
        const staff = DB.staff.find(s => s.id === receiverId);
        const isFree = staff ? isAvailable(staff.name, exam.date, exam.time, exam.duration, exam.id) : true;
        warnDiv.classList.toggle('hidden', isFree);
    };

    receiverSelect.addEventListener('change', checkSwapConflict);
    checkSwapConflict();

    // Akilli Önerileri Tetikle (Feature 4.1)
    updateSuggestionsUI(exam.date, exam.time, exam.duration, 'swap-suggestions', 'swap-suggestion-list', exam.id, 'swap-receiver-select', exam.isNonExam, exam.name);

    document.getElementById('modal-swap').classList.remove('hidden');
};

function createSwapRequest(examId, initiatorId, receiverId) {
    const exam = DB.exams.find(e => String(e.id) === String(examId));
    const initiator = DB.staff.find(s => String(s.id) === String(initiatorId));
    const receiver = receiverId ? DB.staff.find(s => String(s.id) === String(receiverId)) : null;

    if (!exam || !initiator) return false;

    const newReq = {
        id: Date.now(),
        examId: exam.id,
        examName: exam.name,
        examDate: exam.date,
        examTime: exam.time,
        initiatorId: initiator.id,
        initiatorName: initiator.name,
        receiverId: receiver ? receiver.id : null,
        receiverName: receiver ? receiver.name : "Açik Talep",
        status: 'pending',
        fromApproved: true,
        toApproved: false,
        createdAt: new Date().toISOString()
    };

    if (!DB.requests) DB.requests = [];
    DB.requests.push(newReq);
    
    if (receiver) {
        if (!DB.notifications) DB.notifications = {};
        if (!Array.isArray(DB.notifications[receiver.id])) DB.notifications[receiver.id] = [];
        DB.notifications[receiver.id].unshift({
            id: Date.now() + 1,
            message: `🔄 **Takas Talebi:** ${initiator.name}, "${exam.name}" görevini sana devretmek istiyor.`,
            type: 'swap_request',
            requestId: newReq.id,
            createdAt: new Date().toISOString(),
            isRead: false
        });

        // Anlik Webhook & E-posta Bildirimi (Birebir)
        dispatchNotificationEvent('swap_offer', {
            initiatorName: initiator.name,
            receiverName: receiver.name,
            receiverId: receiver.id,
            initiatorExamName: exam.name,
            examDate: exam.date,
            examTime: exam.time,
            duration: exam.duration,
            score: exam.score,
            requestId: newReq.id
        });
    } else {
        // Anlik Webhook Bildirimi (Pazar Yeri Açik İlan)
        dispatchNotificationEvent('marketplace_drop', {
            initiatorName: initiator.name,
            initiatorId: initiator.id,
            examName: exam.name,
            examDate: exam.date,
            examTime: exam.time,
            duration: exam.duration,
            score: exam.score,
            requestId: newReq.id
        });
    }

    logAction('user', 'Takas Talebi', `${initiator.name}, ${exam.name} için talep oluşturdu.`);
    saveToLocalStorage();
    return true;
}

window.submitSwapForm = async function() {
    try {
        const examIdElem = document.getElementById('swap-exam-id');
        const initiatorElem = document.getElementById('swap-initiator-select');
        const receiverElem = document.getElementById('swap-receiver-select');

        if (!examIdElem || !initiatorElem || !receiverElem) {
            console.error("Form elemanlari bulunamadi!");
            return;
        }

        const examId = examIdElem.value;
        const initiatorId = initiatorElem.value;
        const receiverId = receiverElem.value || null;

        if (!initiatorId) {
            alert("Lütfen görevi devredecek hocayi seçin.");
            return;
        }

        if (String(initiatorId) === String(receiverId)) {
            alert("Görevi kendinize devredemezsiniz.");
            return;
        }

        const initiator = DB.staff.find(s => String(s.id) === String(initiatorId));
        const receiver = receiverId ? DB.staff.find(s => String(s.id) === String(receiverId)) : null;
        const exam = DB.exams.find(e => String(e.id) === String(examId));

        if (!exam) {
            console.error("Sinav bulunamadi. Aranan ID:", examId, "Mevcut ID'ler:", DB.exams.map(e => e.id));
            alert("Sinav verisi bulunamadi (ID: " + examId + "). Lütfen sayfayi yenileyip tekrar deneyin.");
            return;
        }
        if (!initiator) {
            alert("Devreden personel verisi bulunamadi (ID: " + initiatorId + ").");
            return;
        }

        if (receiver) {
            const hasConfirmed = await showChoiceModal(`${receiver.name} hocanin takas isteğinden haberi var mi?`);
            if (!hasConfirmed) {
                alert("Talep gönderilmedi.");
                return;
            }
        }

        if (createSwapRequest(examId, initiatorId, receiverId)) {
            alert("Takas talebiniz başariyla oluşturuldu.");
            document.getElementById('modal-swap').classList.add('hidden');

            renderDashboard();
            await saveToBackend();
        } else {
            alert("Takas gerçekleştirilemedi: Sinav bulunamadi.");
        }
    } catch (err) {
        console.error("Takas gönderme hatasi:", err);
        alert("Takas talebi gönderilirken bir hata oluştu: " + err.message);
    }
};

/**
 * MARKETPLACE BADGE
 */

window.updateMarketplaceBadge = function() {
    const badge = document.getElementById('marketplace-badge');
    if (!badge) return;
    
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) {
        badge.classList.add('hidden');
        return;
    }

    const myStaffIdNum = parseInt(myStaffId);
    const dismissedKey = `dismissed_requests_${myStaffId}`;
    const dismissedIds = JSON.parse(localStorage.getItem(dismissedKey) || "[]");

    const now = new Date();
    const openCount = (DB.requests || [])
        .filter(r => {
            if (r.status !== 'pending' || r.receiverId !== null || r.initiatorId === myStaffIdNum) return false;
            if (dismissedIds.includes(r.id)) return false;
            // Geçmiş sinavlari gösterme
            const exam = DB.exams.find(e => String(e.id) === String(r.examId));
            if (!exam) return false;
            const examDate = getSafeDate(exam.date, exam.time);
            const examEnd = new Date(examDate.getTime() + (exam.duration || 60) * 60000);
            return examEnd >= now;
        })
        .length;

    if (openCount > 0) {
        badge.textContent = openCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
    updateProfileMarketplaceAnnouncement();
};

window.renderMarketplaceDashboard = function() {
    const card = document.getElementById('card-marketplace-dashboard');
    const tbody = document.querySelector('#table-marketplace-dashboard tbody');
    if (!tbody || !card) return;
    
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) {
        card.classList.add('hidden');
        return;
    }

    const myStaffIdNum = parseInt(myStaffId);
    const dismissedKey = `dismissed_requests_${myStaffId}`;
    const dismissedIds = JSON.parse(localStorage.getItem(dismissedKey) || "[]");

    const now = new Date();
    const openRequests = (DB.requests || [])
        .filter(r => {
            if (r.status !== 'pending' || r.receiverId !== null || r.initiatorId === myStaffIdNum) return false;
            if (dismissedIds.includes(r.id)) return false;
            // Geçmiş sinavlari gösterme
            const exam = DB.exams.find(e => String(e.id) === String(r.examId));
            if (!exam) return false;
            const examDate = getSafeDate(exam.date, exam.time);
            const examEnd = new Date(examDate.getTime() + (exam.duration || 60) * 60000);
            return examEnd >= now;
        });

    if (openRequests.length === 0) {
        card.classList.add('hidden');
        return;
    }

    card.classList.remove('hidden');
    tbody.innerHTML = '';
    openRequests.forEach(req => {
        const exam = DB.exams.find(e => e.id == req.examId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${req.examName}</strong></td>
            <td>${req.examDate.split('-').reverse().join('.')}</td>
            <td>${req.examTime}</td>
            <td><span class="score-tag">+${exam ? exam.score : 0}</span></td>
            <td style="text-align:right;">
                <button class="btn-primary" onclick="goToProfileMarketplace()" style="padding: 0.3rem 0.6rem; font-size: 0.7rem; background: var(--accent-green);">İncele</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.updateProfileMarketplaceAnnouncement = function() {
    const banner = document.getElementById('profile-marketplace-announcement');
    if (!banner) return;

    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) {
        banner.classList.add('hidden');
        return;
    }

    const myStaffIdNum = parseInt(myStaffId);
    const dismissedKey = `dismissed_requests_${myStaffId}`;
    const dismissedIds = JSON.parse(localStorage.getItem(dismissedKey) || "[]");

    const now = new Date();
    // Kullanicinin müsait olduğu açik talepleri bul
    const openRequests = (DB.requests || [])
        .filter(r => {
            if (r.status !== 'pending' || r.receiverId !== null || r.initiatorId === myStaffIdNum) return false;
            if (dismissedIds.includes(r.id)) return false;
            // Geçmiş sinavlari gösterme
            const exam = DB.exams.find(e => String(e.id) === String(r.examId));
            if (!exam) return false;
            const examDate = getSafeDate(exam.date, exam.time);
            const examEnd = new Date(examDate.getTime() + (exam.duration || 60) * 60000);
            return examEnd >= now;
        });

    // Müsaitlik kontrolü yapilmiş olanlari filtrele (renderMarketplace mantiği gibi)
    const availableRequests = openRequests.filter(req => {
        const exam = DB.exams.find(e => e.id == req.examId);
        return exam && isProctorTrulyFree(myStaffIdNum, req.examDate, req.examTime, exam.duration);
    });

    if (availableRequests.length === 0) {
        banner.classList.add('hidden');
        return;
    }

    // En yakin/güncel olani göster
    const req = availableRequests[0];
    const exam = DB.exams.find(e => e.id == req.examId);
    const formattedDate = req.examDate.split('-').reverse().join('.');

    banner.innerHTML = `
        <div class="marketplace-notice-content">
            <div class="marketplace-notice-icon">🛒</div>
            <div class="marketplace-notice-text">
                <h4>Pazar Yeri Duyurusu</h4>
                <p><b>${req.examName}</b> (${formattedDate} - ${req.examTime}) görevi için yer araniyor. Devralmak isterseniz <b>Açik Görevler</b> sekmesine göz atabilirsiniz.</p>
            </div>
        </div>
        <button class="marketplace-notice-btn" onclick="document.querySelector('.tab-btn[data-tab=\'marketplace\']').click()">İncele</button>
    `;
    banner.classList.remove('hidden');
};

/**
 * BİLDİRİM SİSTEMİ UI
 */

window.updateNotificationBadge = function() {
    const badge = document.getElementById('notif-badge-profile');
    if (!badge) return;

    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId || !DB.notifications || !DB.notifications[myStaffId]) {
        badge.classList.add('hidden');
        badge.textContent = '0';
        return;
    }

    const unreadCount = DB.notifications[myStaffId].filter(n => !n.isRead).length;

    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
};

window.renderNotifications = function() {
    const tbody = document.querySelector('#profile-table-notifications tbody');
    if (!tbody) return;

    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Lütfen önce kimliğinizi seçin.</td></tr>';
        return;
    }

    const notifs = (DB.notifications && DB.notifications[myStaffId]) ? DB.notifications[myStaffId] : [];

    if (notifs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 3rem; color: var(--text-muted);">Henüz bildiriminiz bulunmuyor.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    notifs.forEach(n => {
        const tr = document.createElement('tr');
        tr.className = n.isRead ? 'notif-read' : 'notif-unread';
        
        const dateStr = new Date(n.createdAt).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        tr.innerHTML = `
            <td style="width: 50px; text-align: center;">
                <span class="notif-icon-circle ${n.type}">
                    ${n.type === 'new_assignment' ? '📅' : '📋'}
                </span>
            </td>
            <td>
                <div class="notif-msg">${n.message}</div>
                <div class="notif-time">${dateStr}</div>
            </td>
            <td style="width: 100px; text-align: right;">
                ${!n.isRead ? '<span class="unread-dot-pulse"></span>' : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.markNotificationsAsRead = function() {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId || !DB.notifications || !DB.notifications[myStaffId]) return;

    let changed = false;
    DB.notifications[myStaffId].forEach(n => {
        if (!n.isRead) {
            n.isRead = true;
            changed = true;
        }
    });

    if (changed) {
        saveToLocalStorage();
        updateNotificationBadge();
    }
};


window.showChoiceModal = function(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-choice');
        const msgElem = document.getElementById('choice-message');
        if (!modal || !msgElem) return resolve(false);
        
        msgElem.textContent = message;
        modal.classList.remove('hidden');
        window.resolveChoice = resolve;
    });
};

/**
 * En Sik Beraber Görev Yaptiğim Arkadaşlarimi Hesapla ve Render Et
 */
function renderCollaborators() {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) return;

    const collaboratorsMap = {}; // staffId -> count
    
    // Tüm sinavlari tara (aktif + arşiv)
    DB.exams.forEach(ex => {
        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        const pIdsStr = pIds.map(id => String(id));
        
        if (pIdsStr.includes(String(myStaffId))) {
            pIdsStr.forEach(pid => {
                if (pid !== String(myStaffId)) {
                    collaboratorsMap[pid] = (collaboratorsMap[pid] || 0) + 1;
                }
            });
        }
    });

    const collaboratorsList = Object.entries(collaboratorsMap)
        .map(([id, count]) => {
            const staff = DB.staff.find(s => String(s.id) === String(id));
            if (!staff) return null;
            return { staff, count };
        })
        .filter(c => c !== null)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // İlk 5 arkadaş

    const container = document.getElementById('profile-collaborators-section');
    const listEl = document.getElementById('profile-collaborators-list');
    
    if (!container || !listEl) return;

    if (collaboratorsList.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    listEl.innerHTML = collaboratorsList.map(c => {
        const names = c.staff.name.split(' ');
        const initials = (names[0][0] + (names.length > 1 ? names[names.length - 1][0] : '')).toUpperCase();
        
        let funTag = "🤝";
        let funTitle = "Ekip Üyesi";
        
        if (c.count >= 5) { funTag = "🔥"; funTitle = "Ayrilmaz Parça"; }
        else if (c.count >= 3) { funTag = "⭐"; funTitle = "Yilmaz İkili"; }
        else if (c.count >= 2) { funTag = "💪"; funTitle = "Siki Dost"; }

        return `
            <div class="collaborator-card" onclick="showStaffSchedule('${c.staff.name.replace(/'/g, "\\'")}')">
                <div class="collaborator-fun-tag">${funTag}</div>
                <div class="collaborator-avatar">${initials}</div>
                <span class="collaborator-name" title="${c.staff.name}">${c.staff.name}</span>
                <span class="collaborator-title">${funTitle}</span>
                <div class="collaborator-count">${c.count} Ortak Görev</div>
            </div>
        `;
    }).join('');
}

/**
 * Başari Rozetlerini Hesapla
 */
function calculateAchievements(myStaffId) {
    const exams = DB.exams.filter(ex => {
        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        return pIds.map(id => String(id)).includes(String(myStaffId));
    });

    const now = new Date();
    const completedExams = exams.filter(ex => {
        const examEnd = getSafeDate(ex.date, ex.time).getTime() + (ex.duration || 60) * 60000;
        return examEnd < now.getTime();
    });

    return [
        {
            id: 'early_bird',
            name: 'Erken Kalkan',
            icon: '🌅',
            desc: '3+ sabah sinavina (09:30 ve öncesi) katildiniz.',
            isUnlocked: completedExams.filter(ex => ex.time <= "09:30").length >= 3
        },
        {
            id: 'night_owl',
            name: 'Gece Kuşu',
            icon: '🦉',
            desc: '3+ akşam sinavina (17:00 ve sonrasi) katildiniz.',
            isUnlocked: completedExams.filter(ex => ex.time >= "17:00").length >= 3
        },
        {
            id: 'helper',
            name: 'Yardimsever',
            icon: '🛡️',
            desc: 'Başkalarindan gelen 3+ takas talebini kabul ettiniz.',
            isUnlocked: (DB.requests || []).filter(r => r.status === 'approved' && String(r.receiverId) === String(myStaffId)).length >= 3
        },
        {
            id: 'weekend',
            name: 'Hafta Sonu Savaşçisi',
            icon: '🏔️',
            desc: 'Hafta sonu 2+ sinav görevini başariyla tamamladiniz.',
            isUnlocked: completedExams.filter(ex => {
                const day = new Date(ex.date).getDay();
                return day === 0 || day === 6;
            }).length >= 2
        },
        {
            id: 'marathon',
            name: 'Maratoncu',
            icon: '📚',
            desc: 'Toplam gözetmenlik süreniz 500 dakikayi aşti.',
            isUnlocked: completedExams.reduce((sum, ex) => sum + (ex.duration || 60), 0) >= 500
        },
        {
            id: 'task_master',
            name: 'Görev Adami',
            icon: '🎯',
            desc: 'Sistemde toplam 5+ görevi başariyla tamamladiniz.',
            isUnlocked: completedExams.length >= 5
        }
    ];
}

/**
 * Başari Rozetlerini Render Et (Kaldirildi - Güvenli No-op)
 */
function renderAchievements() {
    const container = document.getElementById('profile-achievements-list');
    if (!container) return;
}

/**
 * Seviye ve Unvan Rozetini Kurumsal Olarak Render Et
 */
function renderLevelSystem(staff) {
    const badge = document.getElementById('profile-rank-badge');
    if (badge) {
        badge.textContent = staff.role === 'admin' ? 'Yönetici' : (staff.title || 'Gözetmen');
        badge.style.background = staff.role === 'admin' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, var(--primary), #3b82f6)';
    }
}

/**
 * Kişisel Notlari Render Et (Güvenli No-op)
 */
function renderQuickNotes(staff) {
    const notesInput = document.getElementById('profile-notes-input');
    if (notesInput) {
        notesInput.value = staff.notes || "";
    }
}

/**
 * Kişisel Notlari Kaydet
 */
window.saveQuickNotes = async function() {
    const myStaffId = localStorage.getItem('myStaffId');
    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) return;

    const notesInput = document.getElementById('profile-notes-input');
    if (notesInput) {
        staff.notes = notesInput.value;
        saveToLocalStorage();
    }
};

/**
 * Profil Sayfasini Yönet
 */
window.renderProfile = function() {
    if (typeof applyGenderTheme === 'function') applyGenderTheme();
    renderCollaborators();
    renderAchievements();
    renderSmartSwaps();
    const myStaffId = localStorage.getItem('myStaffId');
    const setupSection = document.getElementById('profile-identity-setup');
    const mainSection = document.getElementById('profile-main-content');
    
    if (!myStaffId) {
        setupSection.classList.remove('hidden');
        mainSection.classList.add('hidden');
        
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        // Dropdown'i doldur — normal kullanici için şifreliler kilitli, yönetici için hepsi açik
        const dropdown = document.getElementById('profile-setup-dropdown');
        dropdown.innerHTML = '<option value="">' + (isAdmin ? '👑 [Yönetici] Profilini Açmak İstediğiniz Personeli Seçin...' : 'İsminizi Seçin...') + '</option>';
        DB.staff.slice().sort((a,b) => a.name.localeCompare(b.name, 'tr')).forEach(s => {
            const isLocked = !isAdmin && !!s.staffPassword;
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = isLocked ? `🔒 ${s.name}` : (isAdmin ? `👑 ${s.name}` : s.name);
            opt.disabled = isLocked;
            opt.style.color = isLocked ? '#6b7280' : '';
            dropdown.appendChild(opt);
        });
    } else {
        setupSection.classList.add('hidden');
        mainSection.classList.remove('hidden');
        
        const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
        if (!staff) {
            localStorage.removeItem('myStaffId');
            renderProfile();
            return;
        }

        renderLevelSystem(staff);

        // Kişisel Şifre Bilgilendirme Duyurusu Metnini Güncelle
        const annText = document.getElementById('profile-password-announcement-text');
        if (annText) {
            const defaultPass = getDefaultStaffPassword(staff.name);
            const oldPass = { 4: '159159', 7: '1604', 12: '147258369' }[staff.id] || staff.oldPassword;
            let passInfo = 'Sisteme ilk giriş ekranında genel şifre (<strong>Gtu2026</strong>) yerine doğrudan <strong>' + defaultPass + '</strong>';
            if (oldPass) {
                passInfo += ' veya eski şifreniz (<strong>' + oldPass + '</strong>)';
            }
            passInfo += ' ile giriş yaparak doğrudan profilinize ulaşabilirsiniz. Şifrenizi değiştirmek isterseniz aşağıdaki <strong>"Kişisel Giriş Şifrem"</strong> panelinden dilediğiniz zaman güncelleyebilirsiniz.';
            annText.innerHTML = passInfo;
        }

        // Şifre ayarlama bölümünü göster
        renderPasswordSection(staff);

        // Yönetici Modu: Profil Başliğinda Hizli Personel Değiştirici Bari
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        const heroActions = document.querySelector('.profile-hero-actions');
        if (heroActions) {
            let switcher = document.getElementById('admin-profile-quick-switcher');
            if (isAdmin) {
                if (!switcher) {
                    switcher = document.createElement('div');
                    switcher.id = 'admin-profile-quick-switcher';
                    switcher.style.cssText = "display: inline-flex; align-items: center; gap: 8px; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); padding: 4px 10px; border-radius: 8px; margin-right: 8px;";
                    heroActions.prepend(switcher);
                }
                const staffOptions = DB.staff.slice().sort((a,b) => a.name.localeCompare(b.name, 'tr')).map(s => 
                    `<option value="${s.id}" ${String(s.id) === String(staff.id) ? 'selected' : ''}>👑 ${s.name}</option>`
                ).join('');
                switcher.innerHTML = `
                    <span style="font-size: 0.75rem; font-weight: 700; color: #818cf8; white-space: nowrap;">👑 Profil Değiştir:</span>
                    <select style="background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 4px 8px; font-size: 0.8rem; cursor: pointer;" onchange="adminGoToStaffProfile(this.value)">
                        ${staffOptions}
                    </select>
                `;
            } else if (switcher) {
                switcher.remove();
            }
        }

        // Gelen Takas Tekliflerini Göster
        const incomingSwaps = (DB.requests || []).filter(r => 
            (r.type === 'direct_swap' && r.status === 'pending_peer' && String(r.receiverId) === String(staff.id)) ||
            (r.type === 'smart_swap' && r.status === 'pending' && String(r.receiverId) === String(staff.id))
        );

        const swapNotice = document.getElementById('profile-swap-proposals');
        if (swapNotice) {
            if (incomingSwaps.length > 0) {
                swapNotice.classList.remove('hidden');
                swapNotice.innerHTML = `
                    <div style="background: rgba(139, 92, 246, 0.15); border: 1px solid var(--primary); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
                        <h4 style="color: var(--primary); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.2rem;">🔄</span> Yeni Takas Teklifleri
                        </h4>
                        ${incomingSwaps.map(r => {
                            const isSmart = r.type === 'smart_swap';
                            // direct_swap: receiverExamId, initiatorExamId
                            // smart_swap: targetExamId, examId
                            const myExamId = isSmart ? r.targetExamId : r.receiverExamId;
                            const hisExamId = isSmart ? r.examId : r.initiatorExamId;

                            const myExam = DB.exams.find(e => String(e.id) === String(myExamId));
                            const hisExam = DB.exams.find(e => String(e.id) === String(hisExamId));
                            
                            const acceptFn = isSmart ? `acceptSmartSwap(${r.id})` : `acceptDirectSwap(${r.id})`;
                            const rejectFn = isSmart ? `rejectSmartSwap(${r.id})` : `rejectDirectSwap(${r.id})`;

                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05);">
                                    <div style="font-size: 0.9rem;">
                                        ${isSmart ? '<span style="background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-right: 8px; font-weight: 700;">AI ÖNERİSİ</span>' : ''}
                                        <strong>${r.initiatorName || 'Hoca'}</strong>, 
                                        <span style="color: var(--accent-orange);">${hisExam ? hisExam.name : '???'}</span> sinavi ile 
                                        sizin <span style="color: var(--primary);">${myExam ? myExam.name : '???'}</span> sinavinizi takas etmek istiyor.
                                    </div>
                                    <div style="display: flex; gap: 10px;">
                                        <button class="btn-primary" onclick="${acceptFn}" style="background: var(--accent-green); padding: 0.4rem 0.8rem; font-size: 0.8rem;">Kabul Et</button>
                                        <button class="btn-delete" onclick="${rejectFn}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Reddet</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else {
                swapNotice.classList.add('hidden');
            }
        }

        // Header Bilgileri
        // Header Bilgileri (Yeni Premium Hero Tasarimi)
        const profileName = document.getElementById('profile-name');
        if (profileName) profileName.textContent = staff.name;
        
        const btnProfileReport = document.getElementById('btn-profile-report');
        if (btnProfileReport) {
            btnProfileReport.onclick = () => showStaffReportModal(staff.id);
        }
        
        const avatarLetters = document.getElementById('profile-avatar-letters');
        if (avatarLetters) {
            const initials = staff.name.split(' ').map(n => n[0]).join('').toUpperCase();
            avatarLetters.textContent = initials;
        }

        // Görevleri listele
        const myExams = DB.exams.filter(e => isStaffProctorById(e, myStaffId));
        const now = new Date();
        const activeExams = myExams.filter(e => {
            const examDate = getSafeDate(e.date, e.time);
            const examEnd = new Date(examDate.getTime() + (e.duration || 60) * 60000);
            return examEnd >= now;
        }).sort((a,b) => a.date.localeCompare(b.date));

        const archiveExams = myExams.filter(e => {
            const examDate = getSafeDate(e.date, e.time);
            const examEnd = new Date(examDate.getTime() + (e.duration || 60) * 60000);
            return examEnd < now;
        }).sort((a,b) => b.date.localeCompare(a.date));

        const activeBody = document.querySelector('#profile-table-active tbody');
        activeBody.innerHTML = '';
            activeExams.forEach(ex => {
                const statusBadge = (typeof getTaskStatusBadge === 'function') ? getTaskStatusBadge(ex.id, myStaffId) : '';
                activeBody.innerHTML += `
                    <tr>
                        <td><span class="clickable-name" onclick="showExamDetail('${ex.name.replace(/'/g, "\\'")}', '${ex.date}', '${ex.time}', '${ex.location || ''}')"><strong>${ex.name}</strong></span></td>
                        <td><span class="badge-location">${ex.location || '-'}</span></td>
                        <td>${ex.lecturer || '-'}</td>
                        <td>${ex.date}</td>
                        <td>${ex.time}</td>
                        <td>${ex.duration} dk</td>
                        <td><span class="score-tag">+${ex.score}</span></td>
                        <td>${statusBadge || '<span style="color:var(--text-muted);font-size:0.7rem;">Normal</span>'}</td>
                        <td style="display: flex; gap: 5px; justify-content: flex-end; flex-wrap: wrap;">
                            <button class="btn-secondary" onclick="exportSingleExamToICal('${ex.id}')" title="Bu Sinavi Takvime (.ics) Ekle" style="padding: 0.3rem 0.6rem; border-radius: 6px; background: rgba(2, 132, 199, 0.15); color: #38bdf8; border-color: rgba(2, 132, 199, 0.3);"><span class="icon" style="margin:0;">📅</span></button>
                            ${(() => {
                                const hasRequest = (DB.requests || []).find(r => 
                                    (String(r.examId) === String(ex.id) || String(r.initiatorExamId) === String(ex.id)) && 
                                    String(r.initiatorId) === String(myStaffId) && 
                                    ['pending', 'pending_peer'].includes(r.status)
                                );
                                if (hasRequest) {
                                    return `<button class="btn-delete" onclick="cancelSwapRequest('${hasRequest.id}')" title="Talebi İptal Et" style="padding: 0.3rem 0.6rem; border-radius: 6px;"><span class="icon" style="margin:0;">🚫</span></button>`;
                                }
                                return `
                                    <button onclick="initiateDirectSwap('${ex.id}')" title="Hoca ile Takas Et (Sistem İçi Onay)" style="padding: 0.3rem 0.55rem; border-radius: 6px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.35); color: #a78bfa; cursor:pointer; font-size:0.72rem; font-weight:600;">🔄 Takas</button>
                                    <button onclick="typeof openSwapEmailModal==='function' && openSwapEmailModal('${ex.id}')" title="Takas Maili Oluştur" style="padding: 0.3rem 0.55rem; border-radius: 6px; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.35); color: #fbbf24; cursor:pointer; font-size:0.72rem; font-weight:600;">✉️ Takas Mail</button>
                                    <button onclick="initiateOpenSwap('${ex.id}')" title="Pazara Birak (Sistem)" style="padding: 0.3rem 0.55rem; border-radius: 6px; background: rgba(14,165,233,0.15); border: 1px solid rgba(14,165,233,0.35); color: #38bdf8; cursor:pointer; font-size:0.72rem; font-weight:600;">📢 Pazar</button>
                                    <button onclick="typeof openMarketEmailModal==='function' && openMarketEmailModal('${ex.id}')" title="Hocalara E-posta ile Bildir" style="padding: 0.3rem 0.55rem; border-radius: 6px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.35); color: #34d399; cursor:pointer; font-size:0.72rem; font-weight:600;">📤 Bildir</button>
                                `;
                            })()}
                        </td>
                    </tr>
                `;
            });

        const archiveBody = document.querySelector('#profile-table-archive tbody');
        archiveBody.innerHTML = '';
        archiveExams.forEach(ex => {
            archiveBody.innerHTML += `
                <tr>
                    <td><span class="clickable-name" onclick="showExamDetail('${ex.name.replace(/'/g, "\\'")}', '${ex.date}', '${ex.time}', '${ex.location || ''}')"><strong>${ex.name}</strong></span></td>
                    <td>${ex.location || '-'}</td>
                    <td>${ex.lecturer || '-'}</td>
                    <td>${ex.date}</td>
                    <td>${ex.time}</td>
                    <td>${ex.duration || '-'} dk</td>
                    <td><span class="score-tag" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">+${ex.score}</span></td>
                    <td style="text-align:right;">
                        <button class="btn-secondary" onclick="updateExamDurationFromProfile('${ex.id}')" title="Süreyi Güncelle" style="padding: 0.35rem 0.7rem; border-radius: 6px; font-size: 0.75rem; border-color:var(--accent-orange); color:var(--accent-orange);">⏱️ Süre Gir</button>
                    </td>
                </tr>
            `;
        });

        // Takvim ve diğer verileri güncelle
        renderProfileConstraints();
        renderMarketplace();
        updateMarketplaceBadge();
        updateProfileMarketplaceAnnouncement();

        // === KİŞİSEL PORTAL EK RENDERİ ===
        const staffIdNum = parseInt(myStaffId);
        renderPersonalCalendar(staffIdNum);
        updateProfileDashboard(staffIdNum);
        renderProfileChecklist(staffIdNum);
        renderResponsibleExamsTab(staffIdNum, staff);
        renderLecturerExamsTab(staffIdNum, staff);

        // Şifre Ayarlama Bölümünü Render Et (sadece gözetmen modunda)
        if (!isAdmin) {
            renderPasswordSection(staff);
        } else {
            const pwSection = document.getElementById('profile-password-section');
            if (pwSection) pwSection.innerHTML = '';
        }
        if (typeof renderScorecard === 'function') renderScorecard();
    }
};

// ===== KİŞİSEL PORTAL YARDIMCI FONKSİYONLARI (Gözetmenlik'ten uyarlandi) =====

let myTimelineDate = new Date();

function renderMyTimeline() {
    const container = document.getElementById('my-timeline-calendar-grid');
    const monthLabel = document.getElementById('my-timeline-month-label');
    if (!container) return;

    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) {
        container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:2rem; grid-column:span 7;">Takvimi görmek için lütfen profilinizi kurun.</p>`;
        return;
    }

    const staff  = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) return;

    const year  = myTimelineDate.getFullYear();
    const month = myTimelineDate.getMonth();
    const monthNames = ['Ocak','\u015eubat','Mart','Nisan','May\u0131s','Haziran','Temmuz','A\u011fustos','Eyl\u00fcl','Ekim','Kas\u0131m','Aral\u0131k'];
    if (monthLabel) monthLabel.textContent = `${monthNames[month]} ${year}`;

    const firstDay   = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay === 0) ? 6 : firstDay - 1;
    const todayStr   = new Date().toISOString().split('T')[0];

    // Proctored & responsible exams this month
    const proctored    = DB.exams.filter(e => isStaffProctorById(e, myStaffId));
    const responsible  = DB.exams.filter(e => e.lecturer === staff.name);

    // Header
    const dayNames = ['Pzt','Sal','\u00c7ar','Per','Cum','Cmt','Paz'];
    let html = dayNames.map(d => `<div style="text-align:center; font-weight:700; color:var(--primary); font-size:0.7rem; padding:6px 0; border-bottom:2px solid rgba(99,102,241,0.2);">${d}</div>`).join('');

    // Empty leading cells
    for (let i = 0; i < startOffset; i++) {
        html += `<div style="border-radius:10px; background:transparent; min-height:70px;"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isToday = dateStr === todayStr;

        const dayProctored   = proctored.filter(e => e.date === dateStr);
        const dayResponsible = responsible.filter(e => e.date === dateStr);
        const bothIds = dayProctored.filter(e => dayResponsible.some(r => r.id === e.id)).map(e => e.id);

        const hasProctor     = dayProctored.length > 0;
        const hasResponsible = dayResponsible.length > 0;
        const hasBoth        = bothIds.length > 0;

        let dotColor   = 'transparent';
        let dotClass   = '';
        if (hasBoth)        { dotColor = 'var(--accent-red)'; }
        else if (hasProctor && hasResponsible) { dotColor = 'var(--accent-red)'; }
        else if (hasProctor)     { dotColor = 'var(--primary)'; }
        else if (hasResponsible) { dotColor = 'var(--accent-orange)'; }

        const allDayExams = [...new Map([...dayProctored, ...dayResponsible].map(e => [e.id, e])).values()];
        
        const border = isToday
            ? 'border: 2px solid var(--primary); box-shadow: 0 0 10px rgba(99,102,241,0.25);'
            : 'border: 1px solid var(--glass-border);';

        const examsBadges = allDayExams.slice(0, 2).map(ex => {
            const isProc = dayProctored.some(e => e.id === ex.id);
            const isResp = dayResponsible.some(e => e.id === ex.id);
            let bg = isProc && isResp ? 'var(--accent-red)' : isProc ? 'var(--primary)' : 'var(--accent-orange)';
            return `<div style="font-size:0.55rem; background:${bg}; color:white !important; padding:2px 4px; border-radius:4px; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${ex.name} ${ex.time}">${ex.time} ${ex.name.substring(0,8)}${ex.name.length>8?'..':''}</div>`;
        }).join('');

        const moreCount = allDayExams.length > 2 ? `<div style="font-size:0.55rem; color:var(--text-muted); margin-top:2px;">+${allDayExams.length - 2} daha</div>` : '';

        const clickAction = allDayExams.length > 0
            ? `onclick="showMyTimelineDayDetail('${dateStr}')"`
            : '';

        html += `
            <div ${clickAction} style="border-radius:10px; ${border} background:${allDayExams.length ? 'rgba(99,102,241,0.08)' : 'var(--glass-bg)'}; min-height:70px; padding:6px 5px; cursor:${allDayExams.length?'pointer':'default'}; transition: all 0.2s ease;" 
                onmouseenter="${allDayExams.length ? 'this.style.background=\'rgba(99,102,241,0.15)\';this.style.transform=\'translateY(-2px)\'' : ''}" 
                onmouseleave="${allDayExams.length ? 'this.style.background=\'rgba(99,102,241,0.08)\';this.style.transform=\'translateY(0)\'' : ''}">
                <div style="font-size:0.75rem; font-weight:${isToday?'800':'600'}; color:${isToday?'var(--primary)':'var(--text-primary)'}; margin-bottom:2px;">${day}</div>
                ${examsBadges}
                ${moreCount}
            </div>
        `;
    }

    container.innerHTML = html;

    // Day detail panel gizle
    const detail = document.getElementById('my-timeline-day-detail');
    if (detail) detail.classList.add('hidden');
}

window.showMyTimelineDayDetail = function(dateStr) {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) return;
    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) return;

    const dayNames = ['Pazar','Pazartesi','Sal\u0131','\u00c7ar\u015famba','Per\u015fembe','Cuma','Cumartesi'];
    const dateObj = new Date(dateStr + 'T00:00');
    const formatted = dateStr.split('-').reverse().join('.') + ' ' + dayNames[dateObj.getDay()];

    const proctored   = DB.exams.filter(e => isStaffProctorById(e, myStaffId) && e.date === dateStr);
    const responsible = DB.exams.filter(e => e.lecturer === staff.name && e.date === dateStr);
    const allExams    = [...new Map([...proctored, ...responsible].map(e => [e.id, e])).values()]
        .sort((a, b) => a.time.localeCompare(b.time));

    const titleEl = document.getElementById('my-timeline-day-title');
    const examsEl = document.getElementById('my-timeline-day-exams');
    const detail  = document.getElementById('my-timeline-day-detail');
    if (!titleEl || !examsEl || !detail) return;

    titleEl.textContent = `\ud83d\udcc5 ${formatted}`;

    examsEl.innerHTML = allExams.map(ex => {
        const isProc = proctored.some(e => e.id === ex.id);
        const isResp = responsible.some(e => e.id === ex.id);
        const role = isProc && isResp
            ? `<span style="background:var(--accent-red); color:white; padding:2px 8px; border-radius:6px; font-size:0.7rem;">Gözetmen + Sorumlu</span>`
            : isProc
            ? `<span style="background:var(--primary); color:white; padding:2px 8px; border-radius:6px; font-size:0.7rem;">Gözetmen</span>`
            : `<span style="background:var(--accent-orange); color:white; padding:2px 8px; border-radius:6px; font-size:0.7rem;">Sorumlu Hoca</span>`;
        return `
            <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.04); border:1px solid var(--glass-border); border-radius:12px; padding:1rem; margin-bottom:10px;">
                <div>
                    <div style="font-weight:700; margin-bottom:4px;">${ex.name}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${ex.time} &bull; ${ex.duration} dk &bull; ${ex.location || '-'}</div>
                </div>
                ${role}
            </div>
        `;
    }).join('');

    detail.classList.remove('hidden');
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};



let calendarDate = new Date();
let calendarFilter = 'all';
let profileCountdownTimer = null;

function changeMonth(delta) {

    calendarDate.setMonth(calendarDate.getMonth() + delta);
    const myStaffId = parseInt(localStorage.getItem('myStaffId'));
    if (myStaffId) renderPersonalCalendar(myStaffId);
}

// Takvim filtre butonlari
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('calendar-filter-btn')) {
        document.querySelectorAll('.calendar-filter-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = 'var(--text-muted)';
        });
        e.target.classList.add('active');
        e.target.style.background = 'rgba(99,102,241,0.15)';
        e.target.style.color = 'var(--primary)';
        calendarFilter = e.target.getAttribute('data-filter') || 'all';
        const myStaffId = parseInt(localStorage.getItem('myStaffId'));
        if (myStaffId) renderPersonalCalendar(myStaffId);
    }
});

function isStaffProctorById(exam, staffId) {
    if (!exam || !staffId) return false;
    const sid = String(staffId);
    if (String(exam.proctorId) === sid) return true;
    if (Array.isArray(exam.proctorIds) && exam.proctorIds.map(String).includes(sid)) return true;
    return false;
}

function renderPersonalCalendar(staffId) {
    const container = document.getElementById('profile-calendar-grid');
    const monthDisplay = document.getElementById('calendar-month-year');
    if (!container || !staffId) return;

    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthNames = ["Ocak", "\u015eubat", "Mart", "Nisan", "May\u0131s", "Haziran", "Temmuz", "A\u011fustos", "Eyl\u00fcl", "Ekim", "Kas\u0131m", "Aral\u0131k"];
    if (monthDisplay) monthDisplay.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Pazartesi ba\u015flang\u0131\u00e7l\u0131 ofset (0=Pzt, ..., 6=Paz)
    let startOffset = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    const daysArr = ["Pzt", "Sal", "\u00c7ar", "Per", "Cum", "Cmt", "Paz"];
    let html = daysArr.map(d => `<div style="text-align:center; font-weight:700; color:var(--primary); font-size:0.65rem; padding: 4px;">${d}</div>`).join('');

    for (let i = 0; i < startOffset; i++) {
        html += '<div></div>';
    }

    const myProctorExams = DB.exams.filter(e => isStaffProctorById(e, staffId));
    const myResponsibleExams = DB.exams.filter(e => e.lecturer === staff.name);
    const todayStr = new Date().toISOString().split('T')[0];

    for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const isToday = dateStr === todayStr;

        const proctorExamsAtDate = myProctorExams.filter(ex => ex.date === dateStr);
        const responsibleExamsAtDate = myResponsibleExams.filter(ex => ex.date === dateStr);
        const isProctor = proctorExamsAtDate.length > 0;
        const isResponsible = responsibleExamsAtDate.length > 0;
        
        // Merge to show preview
        const combinedExamsOnDay = [...new Map([...proctorExamsAtDate, ...responsibleExamsAtDate].map(e => [e.id, e])).values()]
            .sort((a,b) => a.time.localeCompare(b.time));

        let bgColor = 'var(--glass-bg)';
        let indicator = '';

        if (isProctor && isResponsible) {
            bgColor = 'rgba(239, 68, 68, 0.12)';
        } else if (isProctor) {
            bgColor = 'rgba(99, 102, 241, 0.08)';
        } else if (isResponsible) {
            bgColor = 'rgba(245, 158, 11, 0.12)';
        }

        const examPreviews = combinedExamsOnDay.slice(0, 2).map(ex => {
            const isP = proctorExamsAtDate.some(e => e.id === ex.id);
            const isR = responsibleExamsAtDate.some(e => e.id === ex.id);
            let roleColor = 'var(--primary)';
            if (isP && isR) roleColor = 'var(--accent-red)';
            else if (isR) roleColor = 'var(--accent-orange)';
            
            return `<div style="font-size:0.52rem; background:${roleColor}; color:white !important; padding:1px 3px; border-radius:3px; margin:1px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ex.time} ${ex.name.substring(0,6)}..</div>`;
        }).join('');

        const todayStyle = isToday ? 'border: 2px solid var(--primary); box-shadow: 0 0 8px rgba(99,102,241,0.25);' : 'border: 1px solid var(--glass-border);';
        const hasClick = (combinedExamsOnDay.length > 0) ? `onclick="showProfileCalDayDetail('${dateStr}')" style="cursor:pointer; ${todayStyle} background:${bgColor};"` : `style="${todayStyle} background:${bgColor};"`;

        html += `
            <div ${hasClick} class="profile-cal-day" style="display: flex; flex-direction: column; align-items: stretch; justify-content: start; min-height: 55px; padding: 4px 3px; border-radius: 8px; transition: all 0.2s;">
                <div style="font-size:0.68rem; font-weight: ${isToday ? '800' : '600'}; color: ${isToday ? 'var(--primary)' : 'var(--text-primary)'}; margin-bottom: 2px; text-align:center;">${d}</div>
                <div style="display: flex; flex-direction: column;">
                    ${examPreviews}
                    ${combinedExamsOnDay.length > 2 ? `<div style="font-size:0.5rem; color:var(--text-muted); text-align:center; margin-top:1px;">+${combinedExamsOnDay.length - 2}</div>` : ''}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

window.showProfileCalDayDetail = function(dateStr) {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) return;
    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) return;

    const detailPanel = document.getElementById('profile-cal-day-detail');
    const titleEl = document.getElementById('profile-cal-day-title');
    const examsEl = document.getElementById('profile-cal-day-exams');
    if (!detailPanel || !titleEl || !examsEl) return;

    const proctorExams = DB.exams.filter(e => isStaffProctorById(e, myStaffId) && e.date === dateStr);
    const responsibleExams = DB.exams.filter(e => e.lecturer === staff.name && e.date === dateStr);
    
    // Union of both (using Map to ensure uniqueness by ID)
    const allRelevantExams = [...new Map([...proctorExams, ...responsibleExams].map(e => [e.id, e])).values()]
        .sort((a,b) => a.time.localeCompare(b.time));

    const formattedDate = dateStr.split('-').reverse().join('.');
    titleEl.textContent = `📅 ${formattedDate} Programi`;
    
    examsEl.innerHTML = allRelevantExams.length > 0 
        ? allRelevantExams.map(ex => {
            const isProc = proctorExams.some(e => e.id === ex.id);
            const isResp = responsibleExams.some(e => e.id === ex.id);
            let roleInfo = '';
            if (isProc && isResp) roleInfo = '<span class="badge" style="background: var(--accent-red); font-size: 0.65rem;">Gözetmen + Sorumlu</span>';
            else if (isProc) roleInfo = '<span class="badge" style="background: var(--primary); font-size: 0.65rem;">Gözetmen</span>';
            else if (isResp) roleInfo = '<span class="badge" style="background: var(--accent-orange); font-size: 0.65rem;">Sorumlu Hoca</span>';

            return `
                <div style="background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 10px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                        <div style="font-weight: 700; font-size: 0.85rem; color: white;">${ex.name}</div>
                        ${roleInfo}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 10px;">
                        <span>🕒 ${ex.time} (${ex.duration} dk)</span>
                        <span>📍 ${ex.location || '-'}</span>
                    </div>
                </div>
            `;
        }).join('')
        : '<div style="color: var(--text-muted); font-size: 0.8rem;">Bu tarihte görev bulunmuyor.</div>';

    detailPanel.classList.remove('hidden');
    detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

function updateProfileDashboard(staffId) {
    if (!staffId) return;
    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff) return;

    // 1. Puan & Siralama
    const puanEl = document.getElementById('profile-dash-puan');
    if (puanEl) puanEl.textContent = (staff.totalScore || 0).toFixed(1);

    const sorted = [...(DB.staff || [])].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    const rank = sorted.findIndex(s => String(s.id) === String(staffId)) + 1;
    const rankEl = document.getElementById('profile-dash-rank');
    if (rankEl) rankEl.textContent = `#${rank} Sirada`;

    // Bölüm Ortalamasi ve Farki
    const allStaff = DB.staff || [];
    const avgScore = allStaff.length > 0 ? (allStaff.reduce((sum, s) => sum + (s.totalScore || 0), 0) / allStaff.length) : 0;
    const diff = (staff.totalScore || 0) - avgScore;
    const diffBadge = document.getElementById('profile-kpi-diff-badge');
    if (diffBadge) {
        if (diff > 1.5) {
            diffBadge.innerHTML = `<span style="color:#fb923c; font-weight:600;">+${diff.toFixed(1)} P. (Ort. Üzeri)</span>`;
        } else if (diff < -1.5) {
            diffBadge.innerHTML = `<span style="color:#38bdf8; font-weight:600;">${diff.toFixed(1)} P. (Ort. Alti)</span>`;
        } else {
            diffBadge.innerHTML = `<span style="color:#34d399; font-weight:600;">✓ Dengeli Dağilim</span>`;
        }
    }

    // 2. Dönemlik Görev Yükü & Süresi
    const myExams = (DB.exams || []).filter(e => isStaffProctorById(e, staffId));
    const now = new Date();
    const activeExams = myExams.filter(e => {
        const examDate = getSafeDate(e.date, e.time);
        const examEnd = new Date(examDate.getTime() + (e.duration || 60) * 60000);
        return examEnd >= now;
    });

    const totalMinutes = myExams.reduce((acc, e) => acc + parseInt(e.duration || 60, 10), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    const dutyCountEl = document.getElementById('profile-kpi-duty-count');
    const dutyHoursEl = document.getElementById('profile-kpi-duty-hours');
    const avgBadgeEl = document.getElementById('profile-kpi-avg-badge');

    if (dutyCountEl) dutyCountEl.textContent = activeExams.length;
    if (dutyHoursEl) dutyHoursEl.textContent = `${totalHours} Saat (${myExams.length} Toplam)`;
    if (avgBadgeEl) avgBadgeEl.textContent = `Bölüm Ort: ${avgScore.toFixed(1)} P.`;

    // 3. Müsaitlik Esnekliği & Kisit Özeti
    const flexScore = (typeof calculateAvailabilityScore === 'function') ? calculateAvailabilityScore(staffId) : 100;
    const flexScoreEl = document.getElementById('profile-kpi-flex-score');
    if (flexScoreEl) {
        flexScoreEl.textContent = `%${flexScore}`;
        if (flexScore >= 80) flexScoreEl.style.color = '#10b981';
        else if (flexScore >= 50) flexScoreEl.style.color = '#f59e0b';
        else flexScoreEl.style.color = '#ef4444';
    }

    const constrSummaryEl = document.getElementById('profile-kpi-constraint-summary');
    if (constrSummaryEl) {
        const staffConstraints = (DB.constraints || []).filter(c => c.staffName === staff.name || c.staffId === staff.id);
        if (staffConstraints.length === 0) {
            constrSummaryEl.innerHTML = `<span style="color:#34d399;">✓ Tam Müsait</span>`;
        } else {
            const cList = staffConstraints.map(c => {
                if (c.type === 'day') return `${c.day.substring(0,3)} ${c.startHour || ''}-${c.endHour || ''}`;
                return `${c.date ? c.date.substring(5) : 'Tarih'}`;
            }).slice(0, 2).join(', ');
            constrSummaryEl.innerHTML = `<span style="color:#f87171;" title="${staffConstraints.length} kisit">🚫 ${cList}${staffConstraints.length > 2 ? '...' : ''}</span>`;
        }
    }

    // 4. Sinav Günü Canli Durum Banner'i (Bugün / Yarin)
    const liveBanner = document.getElementById('profile-live-duty-banner');
    if (liveBanner) {
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        const todayExams = myExams.filter(e => e.date === todayStr);
        const tomorrowExams = myExams.filter(e => e.date === tomorrowStr);

        if (todayExams.length > 0) {
            const nextToday = todayExams.sort((a,b) => a.time.localeCompare(b.time))[0];
            const pIds = (nextToday.proctorIds && nextToday.proctorIds.length > 0) ? nextToday.proctorIds : (nextToday.proctorId ? [nextToday.proctorId] : []);
            const partners = pIds
                .filter(id => String(id) !== String(staffId))
                .map(id => {
                    const st = (DB.staff || []).find(s => String(s.id) === String(id));
                    return st ? st.name : '';
                }).filter(Boolean).join(', ');

            liveBanner.className = 'profile-live-duty-banner';
            liveBanner.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <div style="display: flex; align-items: center; font-weight: 800; font-size: 1.05rem; color: #ef4444; margin-bottom: 4px;">
                            <span class="live-pulse-dot"></span> 🔴 BUGÜN SINAV GÖREVİNİZ BULUNMAKTADIR (${nextToday.time})
                        </div>
                        <div style="font-size: 0.95rem; font-weight: 700; color: #f1f5f9; margin-bottom: 3px;">
                            📚 ${nextToday.name} &bull; 📍 Derslik: <span style="color: #fbbf24;">${nextToday.location || 'Derslik Belirtilmedi'}</span> &bull; ⌛ ${nextToday.duration || 60} dk &bull; <span style="color:#38bdf8;">+${nextToday.score} Puan</span>
                        </div>
                        <div style="font-size: 0.8rem; color: #cbd5e1;">
                            👤 Sorumlu Hoca: <strong>${nextToday.lecturer || '-'}</strong> ${partners ? `&nbsp;|&nbsp; 🤝 Görev Partneriniz: <strong style="color:#a5b4fc;">${partners}</strong>` : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" class="btn-primary" style="background: #0284c7; padding: 0.5rem 0.9rem; font-size: 0.8rem;" onclick="showExamDetail('${nextToday.name.replace(/'/g, "\\'")}', '${nextToday.date}', '${nextToday.time}', '${nextToday.location || ''}')">
                            🔍 Detay
                        </button>
                        <button type="button" class="btn-primary" style="background: #10b981; padding: 0.5rem 0.9rem; font-size: 0.8rem;" onclick="exportSingleExamToICal('${nextToday.id}')">
                            📅 .ics İndir
                        </button>
                        <button type="button" class="btn-secondary" style="background: rgba(245,158,11,0.2); color:#fbbf24; border-color: rgba(245,158,11,0.4); padding: 0.5rem 0.9rem; font-size: 0.8rem;" onclick="initiateDirectSwap('${nextToday.id}')">
                            🔄 Takasa Çikar
                        </button>
                    </div>
                </div>
            `;
            liveBanner.classList.remove('hidden');
        } else if (tomorrowExams.length > 0) {
            const nextTomorrow = tomorrowExams.sort((a,b) => a.time.localeCompare(b.time))[0];
            const pIds = (nextTomorrow.proctorIds && nextTomorrow.proctorIds.length > 0) ? nextTomorrow.proctorIds : (nextTomorrow.proctorId ? [nextTomorrow.proctorId] : []);
            const partners = pIds
                .filter(id => String(id) !== String(staffId))
                .map(id => {
                    const st = (DB.staff || []).find(s => String(s.id) === String(id));
                    return st ? st.name : '';
                }).filter(Boolean).join(', ');

            liveBanner.className = 'profile-live-duty-banner tomorrow-duty';
            liveBanner.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <div style="display: flex; align-items: center; font-weight: 800; font-size: 1.05rem; color: #fbbf24; margin-bottom: 4px;">
                            <span class="live-pulse-dot tomorrow"></span> 🟡 YARIN SINAV GÖREVİNİZ VAR (${nextTomorrow.time})
                        </div>
                        <div style="font-size: 0.95rem; font-weight: 700; color: #f1f5f9; margin-bottom: 3px;">
                            📚 ${nextTomorrow.name} &bull; 📍 Derslik: <span style="color: #38bdf8;">${nextTomorrow.location || 'Derslik Belirtilmedi'}</span> &bull; ⌛ ${nextTomorrow.duration || 60} dk &bull; <span style="color:#38bdf8;">+${nextTomorrow.score} Puan</span>
                        </div>
                        <div style="font-size: 0.8rem; color: #cbd5e1;">
                            👤 Sorumlu Hoca: <strong>${nextTomorrow.lecturer || '-'}</strong> ${partners ? `&nbsp;|&nbsp; 🤝 Görev Partneriniz: <strong style="color:#a5b4fc;">${partners}</strong>` : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" class="btn-primary" style="background: #0284c7; padding: 0.5rem 0.9rem; font-size: 0.8rem;" onclick="showExamDetail('${nextTomorrow.name.replace(/'/g, "\\'")}', '${nextTomorrow.date}', '${nextTomorrow.time}', '${nextTomorrow.location || ''}')">
                            🔍 Detay
                        </button>
                        <button type="button" class="btn-primary" style="background: #10b981; padding: 0.5rem 0.9rem; font-size: 0.8rem;" onclick="exportSingleExamToICal('${nextTomorrow.id}')">
                            📅 .ics İndir
                        </button>
                        <button type="button" class="btn-secondary" style="background: rgba(245,158,11,0.2); color:#fbbf24; border-color: rgba(245,158,11,0.4); padding: 0.5rem 0.9rem; font-size: 0.8rem;" onclick="initiateDirectSwap('${nextTomorrow.id}')">
                            🔄 Takasa Çikar
                        </button>
                    </div>
                </div>
            `;
            liveBanner.classList.remove('hidden');
        } else {
            liveBanner.classList.add('hidden');
        }
    }

    // 5. Sik Birlikte Çaliştiklarim
    const matesCount = {};
    myExams.forEach(ex => {
        const ids = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        ids.forEach(pid => {
            if (String(pid) !== String(staffId)) {
                const p = DB.staff.find(s => String(s.id) === String(pid));
                if (p) matesCount[p.name] = (matesCount[p.name] || 0) + 1;
            }
        });
    });
    const sortedMates = Object.entries(matesCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const matesEl = document.getElementById('profile-dash-mates');
    if (matesEl) {
        matesEl.innerHTML = sortedMates.length > 0
            ? sortedMates.map(([name, cnt]) => `<span style="display:block; margin-bottom:2px;">&bull; <strong>${name}</strong> <span style="color:var(--primary); font-weight:700;">(${cnt} kez)</span></span>`).join('')
            : '<span style="color:var(--text-muted);">Henüz ortak görev yapilmadi</span>';
    }

    // 6. Geri sayim
    startProfileCountdown(staffId);
}

window.exportSingleExamToICal = function(examId) {
    const exam = (DB.exams || []).find(e => String(e.id) === String(examId));
    if (!exam) {
        if (typeof showToast === 'function') showToast('Sinav bulunamadi.', 'warning');
        return;
    }
    if (typeof generateICalContent === 'function' && typeof downloadICalFile === 'function') {
        const icsData = generateICalContent([exam], exam.name);
        const cleanName = exam.name.replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_');
        downloadICalFile(icsData, `${cleanName}_Sinav_Gorevi.ics`);
        if (typeof showToast === 'function') {
            showToast(`📅 "${exam.name}" takvim (.ics) dosyasi indirildi!`, 'success');
        }
    }
};

function startProfileCountdown(staffId) {
    if (profileCountdownTimer) clearInterval(profileCountdownTimer);
    const countVal = document.getElementById('profile-countdown');
    const countTarget = document.getElementById('profile-countdown-target');
    if (!countVal || !countTarget) return;

    const now = new Date();
    const upcoming = DB.exams
        .filter(e => isStaffProctorById(e, staffId) && getSafeDate(e.date, e.time) > now)
        .sort((a, b) => (a.date + 'T' + a.time).localeCompare(b.date + 'T' + b.time));

    if (upcoming.length === 0) {
        countVal.textContent = '-- : -- : --';
        countTarget.textContent = 'Aktif görev bulunmuyor';
        return;
    }

    const next = upcoming[0];
    const targetDate = getSafeDate(next.date, next.time);
    countTarget.textContent = `${next.time} - ${next.name} (${next.location || 'Salon'})`;

    const update = () => {
        const diff = targetDate - new Date();
        if (diff <= 0) { 
            countVal.textContent = 'Sinav Başladi!'; 
            clearInterval(profileCountdownTimer); 
            return; 
        }
        const totalHours = Math.floor(diff / 3600000);
        const days = Math.floor(totalHours / 24);
        const remHours = totalHours % 24;
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        if (days > 0) {
            countVal.textContent = `${days}g ${remHours.toString().padStart(2, '0')}s ${m.toString().padStart(2, '0')}d`;
        } else {
            countVal.textContent = `${remHours.toString().padStart(2, '0')} : ${m.toString().padStart(2, '0')} : ${s.toString().padStart(2, '0')}`;
        }
    };
    update();
    profileCountdownTimer = setInterval(update, 1000);
}

function renderProfileChecklist(staffId) {
    const container = document.getElementById('profile-checklist-container');
    if (!container || !staffId) return;

    const defaultItems = [
        'S\u0131nav evraklar\u0131n\u0131 teslim al\u0131n.',
        '\u00d6\u011frenci kimliklerini kontrol edin.',
        '\u0130mza sirk\u00fcs\u00fcn\u00fc imzalat\u0131n.',
        'Evraklar\u0131 eksiksiz teslim edin.'
    ];

    if (!DB.checklists) DB.checklists = {};
    if (!DB.checklists[staffId]) DB.checklists[staffId] = defaultItems.map(text => ({ text, done: false }));

    const items = DB.checklists[staffId];
    container.innerHTML = '';
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.style = `display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:10px; background:rgba(255,255,255,0.03); cursor:pointer; margin-bottom:6px; opacity:${item.done ? 0.5 : 1};`;
        div.innerHTML = `
            <input type="checkbox" ${item.done ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer; accent-color: var(--primary);">
            <span style="font-size:0.8rem; color:${item.done ? 'var(--text-muted)' : 'white'}; text-decoration:${item.done ? 'line-through' : 'none'}; line-height:1.3;">${item.text}</span>
        `;
        div.onclick = (e) => {
            items[index].done = !items[index].done;
            saveToLocalStorage();
            renderProfileChecklist(staffId);
        };
        container.appendChild(div);
    });
}

function renderResponsibleExamsTab(staffId, staff) {
    const tbody = document.querySelector('#profile-table-responsible tbody');
    if (!tbody || !staff) return;
    tbody.innerHTML = '';

    // Bu sekme artik "Proctor olarak atandiğim sinavlarin hocalarindan gelen mesajlar" olacak
    const now = new Date();
    const myMessages = DB.exams
        .filter(ex => {
            const pIds = ex.proctorIds || [ex.proctorId];
            const isMe = pIds.some(pid => String(pid) === String(staff.id));
            if (!isMe) return false;

            // Sinav bitmiş mi kontrolü (Sadece gelecek/aktif sinavlari göster)
            const exDate = getSafeDate(ex.date, ex.time);
            const exEnd = new Date(exDate.getTime() + (ex.duration || 60) * 60000);
            return exEnd > now;
        })
        .sort((a, b) => (a.date + 'T' + a.time).localeCompare(b.date + 'T' + b.time));

    if (myMessages.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">Henüz hocalardan gelen bir mesaj bulunmuyor.</td></tr>`;
        return;
    }

    myMessages.forEach(ex => {
        const msg = ex.lecturerNote || `${ex.name} sinavi içi bilgilendirme bekleniyor...`;
        
        tbody.innerHTML += `
            <tr>
                <td><strong>${ex.lecturer || '-'}</strong></td>
                <td>${ex.name}</td>
                <td style="font-size:0.85rem;">${ex.date} <span style="opacity:0.6;">${ex.time}</span></td>
                <td><span class="note-pill" style="background: rgba(99,102,241,0.1); padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; color: var(--primary); border: 1px solid rgba(99,102,241,0.2);">${msg}</span></td>
                <td style="text-align:right;">
                    <button class="btn-secondary" onclick="showExamDetail('${ex.name.replace(/'/g, "\\'")}', '${ex.date}', '${ex.time}', '${ex.location.replace(/'/g, "\\'")}')" style="font-size:0.75rem; padding:4px 8px;">Detay</button>
                </td>
            </tr>
        `;
    });
}

/**
 * HOCA PANELİ: Sorumlu Olduğum Dersler (Mesaj Gönder)
 */
function renderLecturerExamsTab(staffId, staff) {
    const tbody = document.querySelector('#profile-table-lecturer-exams tbody');
    if (!tbody || !staff) return;
    tbody.innerHTML = '';

    const lecturerExams = DB.exams
        .filter(ex => ex.lecturer === staff.name)
        .sort((a, b) => (a.date + 'T' + a.time).localeCompare(b.date + 'T' + b.time));

    if (lecturerExams.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">Henüz sorumlu olduğunuz ders sinavi bulunmuyor.</td></tr>`;
        return;
    }

    lecturerExams.forEach(ex => {
        const pNames = (ex.proctorIds || [ex.proctorId]).map(pid => {
            const s = DB.staff.find(st => String(st.id) === String(pid));
            return s ? s.name : '???';
        }).filter(n => n !== '???');
        
        const proctorsStr = pNames.length > 0 ? pNames.join(', ') : '<span style="color:var(--accent-orange);">Henüz atanmadi</span>';
        const msg = ex.lecturerNote || '<span style="opacity:0.5;">Fikir/Not yok</span>';

        tbody.innerHTML += `
            <tr>
                <td><strong>${ex.name}</strong></td>
                <td style="font-size:0.85rem;">${proctorsStr}</td>
                <td style="font-size:0.85rem;">${ex.date} <span style="opacity:0.6;">${ex.time}</span></td>
                <td><span class="note-pill" style="background: rgba(34,197,94,0.1); padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; color: var(--accent-green); border: 1px solid rgba(34,197,94,0.2);">${msg}</span></td>
                <td style="text-align:right;"><button class="btn-primary" onclick="openLecturerMessageModal(${ex.id})" style="font-size:0.75rem; padding:4px 8px; background:linear-gradient(135deg, var(--primary), #4f46e5);">Özel Not/Mesaj</button></td>
            </tr>
        `;
    });
}

/**
 * HOCA MESAJ MODALI FONKSİYONLARI
 */
window.openLecturerMessageModal = function(id) {
    const ex = DB.exams.find(e => String(e.id) === String(id));
    if (!ex) return;

    document.getElementById('lecturer-message-exam-id').value = id;
    document.getElementById('lecturer-message-text').value = ex.lecturerNote || '';
    
    document.getElementById('lecturer-message-info').innerHTML = `
        <strong>${ex.name}</strong><br>
        <span style="font-size:0.8rem;">Tarih: ${ex.date} | Saat: ${ex.time}</span>
    `;

    document.getElementById('modal-lecturer-message').classList.remove('hidden');
};

window.closeLecturerMessageModal = function() {
    document.getElementById('modal-lecturer-message').classList.add('hidden');
};

window.saveLecturerMessage = function() {
    const id = parseInt(document.getElementById('lecturer-message-exam-id').value);
    const text = document.getElementById('lecturer-message-text').value;
    
    const ex = DB.exams.find(e => String(e.id) === String(id));
    if (ex) {
        ex.lecturerNote = text;
        ex.lecturerNoteTimestamp = Date.now(); // Bildirim için zaman damgasi
        
        // Kaydet
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
        if (typeof saveToBackend === 'function') saveToBackend();
        
        showToast('Mesajiniz gözetmenlere iletildi.');
        if (document.getElementById('lecturer-message-text')) {
            document.getElementById('lecturer-message-text').value = '';
        }
        closeLecturerMessageModal();
        
        // Tablolari yenile
        const myStaffId = localStorage.getItem('myStaffId');
        const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
        renderLecturerExamsTab(myStaffId, staff);
        renderResponsibleExamsTab(myStaffId, staff);
        
        // Eğer portal açiksa orayi da yenile
        const portalSelect = document.getElementById('lecturer-portal-staff-select');
        if (portalSelect && portalSelect.value) {
            renderLecturerPortal(portalSelect.value);
        }
    }
};

/**
 * HOCA PORTALI (Şifresiz Login Tarafi)
 */
function loadLecturerPortalStaff() {
    const select = document.getElementById('lecturer-portal-staff-select');
    if (!select) return;
    
    if (select.options.length > 1) return;

    // DB.lecturers listesini kullan (Title + Name formatinda)
    const sortedLecturers = (DB.lecturers || []).slice().sort((a,b) => a.name.localeCompare(b.name, 'tr'));
    
    select.innerHTML = '<option value="">Lütfen İsminizi Seçin...</option>' + 
        sortedLecturers.map(l => {
            const fullName = `${l.title} ${l.name}`;
            return `<option value="${fullName}">${fullName}</option>`;
        }).join('');
}

window.onLecturerPortalStaffChange = function(lecturerName) {
    const courseGroup = document.getElementById('lecturer-portal-course-group');
    const courseSelect = document.getElementById('lecturer-portal-course-select');
    const editor = document.getElementById('lecturer-portal-editor');
    const empty = document.getElementById('lecturer-portal-empty');

    if (!lecturerName) {
        if (courseGroup) courseGroup.classList.add('hidden');
        if (editor) editor.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (courseGroup) courseGroup.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');
    if (editor) editor.classList.add('hidden');

    // Bu hocaya ait sinavlari bul (Daha esnek bir isim eşleşmesi için trim ve toLocaleLowerCase('tr') kullaniyoruz)
    const myExams = DB.exams.filter(ex => {
        if (!ex.lecturer) return false;
        
        const normExLect = ex.lecturer.toLocaleLowerCase('tr').trim();
        const normSelLect = lecturerName.toLocaleLowerCase('tr').trim();
        
        // Tam eşleşme veya birinin diğerini içermesi durumu
        return normExLect === normSelLect || 
               normExLect.includes(normSelLect) || 
               normSelLect.includes(normExLect);
    }).sort((a,b) => (a.date + ' ' + a.time).localeCompare(b.date + ' ' + b.time));

    courseSelect.innerHTML = '<option value="">Lütfen Ders Seçin...</option>';
    
    if (myExams.length > 0) {
        courseSelect.innerHTML += '<option value="all-exams">★★★ TÜM SINAVLARIM / TÜM GÖZETMENLER ★★★</option>';
        courseSelect.innerHTML += myExams.map(ex => `<option value="${ex.id}">${ex.name} (${ex.date} ${ex.time})</option>`).join('');
    } else {
        courseSelect.innerHTML = '<option value="">Adiniza kayitli ders bulunamadi.</option>';
    }
};

window.onLecturerPortalCourseChange = function(examId) {
    const lecturerName = document.getElementById('lecturer-portal-staff-select').value;
    const editor = document.getElementById('lecturer-portal-editor');
    const title = document.getElementById('lecturer-portal-course-title');
    const details = document.getElementById('lecturer-portal-course-details');
    const textarea = document.getElementById('lecturer-portal-note');
    const proctorsEl = document.getElementById('lecturer-portal-proctors');
    const proctorsContainer = document.getElementById('lecturer-portal-proctors-container');
    const saveStatus = document.getElementById('lecturer-portal-save-status');

    if (!examId) {
        if (editor) editor.classList.add('hidden');
        return;
    }

    if (editor) editor.classList.remove('hidden');
    if (saveStatus) saveStatus.classList.add('hidden');

    if (examId === 'all-exams') {
        const myExams = DB.exams.filter(ex => {
            if (!ex.lecturer) return false;
            return ex.lecturer.toLocaleLowerCase('tr').trim().includes(lecturerName.toLocaleLowerCase('tr').trim()) ||
                   lecturerName.toLocaleLowerCase('tr').trim().includes(ex.lecturer.toLocaleLowerCase('tr').trim());
        });

        title.textContent = "🚀 Tüm Sinavlarim (Toplu Mesaj)";
        details.innerHTML = `<span style="color:var(--accent-orange);">Bu alana yazacağiniz not, aşağida listelenen tüm sinavlariniza ve görevli gözetmenlere iletilecektir.</span>`;
        
        // Tüm gözetmenleri topla (tekil hoca isimleri)
        const allPids = [];
        myExams.forEach(ex => {
            (ex.proctorIds || [ex.proctorId]).forEach(pid => {
                if (pid && !allPids.includes(String(pid))) allPids.push(String(pid));
            });
        });

        const pNames = allPids.map(pid => {
            const s = DB.staff.find(st => String(st.id) === String(pid));
            return s ? s.name : null;
        }).filter(Boolean).sort();

        if (proctorsEl) {
            proctorsEl.innerHTML = pNames.length > 0 
                ? pNames.map(n => `<div style="margin-bottom:2px;">• ${n}</div>`).join('') 
                : '<span style="color:var(--accent-orange); opacity:0.7;">Atanmiş gözetmen bulunamadi</span>';
        }
        
        // Eğer tüm sinavlarin notu ayniysa onu getir, farkliysa boş birak veya ilkini getir
        const firstNote = myExams.length > 0 ? (myExams[0].lecturerNote || '') : '';
        const allSame = myExams.every(ex => (ex.lecturerNote || '') === firstNote);
        textarea.value = allSame ? firstNote : "";
        textarea.placeholder = "Tüm sinavlariniza ortak bir not iletmek için buraya yazin...";

    } else {
        const exam = DB.exams.find(e => String(e.id) === String(examId));
        if (!exam) return;

        title.textContent = exam.name;
        details.innerHTML = `📅 ${exam.date} &nbsp; 🕒 ${exam.time} &nbsp; 📍 ${exam.location || ''}`;
        
        const pNames = (exam.proctorIds || [exam.proctorId]).map(pid => {
            if (!pid) return null;
            const s = DB.staff.find(st => String(st.id) === String(pid));
            return s ? s.name : null;
        }).filter(Boolean);

        if (proctorsEl) {
            proctorsEl.innerHTML = pNames.length > 0 
                ? pNames.map(n => `<div style="margin-bottom:2px;">• ${n}</div>`).join('') 
                : '<span style="color:var(--accent-orange); opacity:0.7;">Henüz atanmadi</span>';
        }

        textarea.value = exam.lecturerNote || '';
        textarea.placeholder = "Sinav gözetmenlerine iletmek istediğiniz notu buraya yazin...";
    }
};

window.saveLecturerPortalNote = async function() {
    const lecturerName = document.getElementById('lecturer-portal-staff-select').value;
    const courseSelect = document.getElementById('lecturer-portal-course-select');
    const textarea = document.getElementById('lecturer-portal-note');
    const saveStatus = document.getElementById('lecturer-portal-save-status');

    const examId = courseSelect ? courseSelect.value : null;
    const note = textarea ? textarea.value.trim() : '';

    if (!examId || !lecturerName) {
        showToast('Lütfen önce ders seçiniz!', 'error');
        return;
    }

    try {
        if (examId === 'all-exams') {
            const myExams = DB.exams.filter(ex => {
                if (!ex.lecturer) return false;
                return ex.lecturer.toLocaleLowerCase('tr').trim().includes(lecturerName.toLocaleLowerCase('tr').trim()) ||
                       lecturerName.toLocaleLowerCase('tr').trim().includes(ex.lecturer.toLocaleLowerCase('tr').trim());
            });

            myExams.forEach(ex => {
                ex.lecturerNote = note;
                ex.lecturerNoteTimestamp = Date.now();
            });
            showToast(`${myExams.length} sinava ortak mesajiniz iletildi.`);
            if (textarea) textarea.value = '';
        } else {
            const exam = DB.exams.find(e => String(e.id) === String(examId));
            if (!exam) throw new Error("Sinav bulunamadi.");
            exam.lecturerNote = note;
            exam.lecturerNoteTimestamp = Date.now();
            showToast('Mesajiniz gözetmenlere iletildi.');
            if (textarea) textarea.value = '';
        }

        // Yerel kaydet (Aninda başarili olsun)
        saveToLocalStorage();

        // Geri bildirim
        if (saveStatus) {
            saveStatus.classList.remove('hidden');
            setTimeout(() => saveStatus.classList.add('hidden'), 3000);
        }

        // Buluta kaydet
        await saveToBackend();

    } catch (err) {
        console.error("Save error:", err);
        showToast('Kayit sirasinda bir hata oluştu: ' + err.message, 'error');
    }

    const myStaffId = localStorage.getItem('myStaffId');
    if (myStaffId) {
        const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
        if (typeof renderLecturerExamsTab === 'function') renderLecturerExamsTab(myStaffId, staff);
        if (typeof renderResponsibleExamsTab === 'function') renderResponsibleExamsTab(myStaffId, staff);
    }
};


/**
 * Gözetmenin Kendi Sinav Süresini Düzenlemesi
 */
window.updateExamDurationFromProfile = function(id) {
    try {
        const ex = DB.exams.find(e => String(e.id) === String(id));
        if (!ex) {
            console.error('Sinav bulunamadi:', id);
            return;
        }

        const newDur = prompt(`${ex.name} sinavi için yeni süreyi (dakika) girin:`, ex.duration || 60);
        if (newDur !== null) {
            const val = parseInt(newDur);
            if (!isNaN(val) && val > 0) {
                // Centralized update function (it handles score, proctor totals, and storage)
                updateExam(id, { duration: val });
                
                // Kayit ve UI Yenileme
                if (typeof saveToBackend === 'function') saveToBackend();
                
                if (typeof showToast === 'function') showToast('Sinav süresi güncellendi.');
                else alert('Sinav süresi güncellendi.');

                renderProfile(); // Görüntüyü yenile
                
                // Eğer "Sorumlu Olduğum" sekmesi açiksa orayi da yenile
                const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
                if (activeTab === 'responsible') {
                    const myStaffId = localStorage.getItem('myStaffId');
                    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
                    if (staff && typeof renderResponsibleExamsTab === 'function') {
                        renderResponsibleExamsTab(myStaffId, staff);
                    }
                }
            } else {
                if (typeof showToast === 'function') showToast('Geçersiz süre!', 'error');
                else alert('Geçersiz süre!');
            }
        }
    } catch (err) {
        console.error('Süre güncelleme hatasi:', err);
        alert('Bir hata oluştu: ' + err.message);
    }
};

function renderPasswordSection(staff) {
    let container = document.getElementById('profile-password-section');
    if (!container) return;

    const hasCustomPass = !!staff.staffPassword;
    const defaultPass = getDefaultStaffPassword(staff.name);
    const oldPass = { 4: '159159', 7: '1604', 12: '147258369' }[staff.id] || staff.oldPassword;
    
    let passNote = `Varsayılan giriş şifreniz: <strong>${defaultPass}</strong>`;
    if (oldPass) {
        passNote += ` | Eski şifreniz: <strong>${oldPass}</strong>`;
    }

    container.innerHTML = `
        <div style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; background: rgba(99,102,241,0.07); border: 1px solid rgba(99,102,241,0.25); border-radius: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <h4 style="margin: 0; font-size: 0.92rem; color: var(--primary); display: flex; align-items: center; gap: 6px;">
                    <span>🔑</span> Kişisel Giriş Şifrem
                </h4>
                ${hasCustomPass ? '<span style="font-size:0.75rem; color:var(--accent-green); background:rgba(34,197,94,0.12); padding:3px 10px; border-radius:20px; font-weight:600;">✓ Özel Şifre Aktif</span>' : '<span style="font-size:0.75rem; color:#a5b4fc; background:rgba(99,102,241,0.12); padding:3px 10px; border-radius:20px;">Standart Şifre</span>'}
            </div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.6rem; line-height: 1.45;">
                Ana giriş ekranında genel şifre yerine kendi şifrenizle giriş yaparak doğrudan profilinize ulaşabilirsiniz. İsterseniz buradan yeni bir şifre belirleyebilirsiniz.
            </p>
            <div style="font-size: 0.78rem; color: #94a3b8; background: rgba(0,0,0,0.2); padding: 7px 11px; border-radius: 8px; margin-bottom: 1rem; border: 1px dashed rgba(255,255,255,0.1);">
                💡 ${passNote}
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <input type="password" id="profile-pass-input" placeholder="Yeni şifrenizi girin..." 
                    style="flex:1; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 0.65rem 0.9rem; border-radius: 9px; color:white; font-family:inherit; font-size: 0.88rem;">
                <button onclick="saveProfilePassword(${staff.id})" class="btn-primary" style="white-space:nowrap; padding: 0.65rem 1.1rem; font-size:0.85rem; background: linear-gradient(135deg, var(--primary), #4f46e5);">Kaydet</button>
                ${hasCustomPass ? `<button onclick="removeProfilePassword(${staff.id})" class="btn-secondary" style="white-space:nowrap; padding: 0.65rem 0.9rem; font-size:0.85rem; color:var(--accent-red); border-color: rgba(239,68,68,0.3);">Varsayılana Dön</button>` : ''}
            </div>
        </div>
    `;
}

window.saveProfilePassword = async function(staffId) {
    const input = document.getElementById('profile-pass-input');
    const newPass = (input && input.value) ? input.value.trim() : '';
    if (!newPass) { alert('Şifre boş olamaz!'); return; }
    if (newPass.length < 4) { alert('Şifre en az 4 karakter olmalıdır!'); return; }

    const ADMIN_PASSWORD_1 = 'GtuAdmın123';
    const ADMIN_PASSWORD_2 = 'GtuAdmin123';
    const GOZETMEN_PASSWORD = 'Gtu2026';
    if (newPass === ADMIN_PASSWORD_1 || newPass === ADMIN_PASSWORD_2 || newPass === GOZETMEN_PASSWORD) {
        alert('Bu şifre sisteme ayrılmış genel bir şifredir, lütfen kendinize özel farklı bir şifre seçin.');
        return;
    }
    const conflict = DB.staff.find(s => s.staffPassword === newPass && String(s.id) !== String(staffId));
    if (conflict) {
        alert('Bu şifre zaten başka bir personel tarafından kullanılıyor! Lütfen farklı bir şifre belirleyin.');
        return;
    }

    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff) return;
    staff.staffPassword = newPass;
    saveToLocalStorage();
    if (typeof saveToBackend === 'function') {
        await saveToBackend();
    }
    alert(`✓ Şifreniz başarıyla kaydedildi!\n\nArtık ana giriş ekranında "${newPass}" şifrenizle doğrudan kendi profilinize giriş yapabilirsiniz.`);
    renderPasswordSection(staff);
    if (typeof renderProfile === 'function') renderProfile();
};

window.removeProfilePassword = async function(staffId) {
    if (!confirm('Kişisel şifrenizi kaldırıp standart isminiz123 şifresine dönmek istediğinize emin misiniz?')) return;
    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff) return;
    delete staff.staffPassword;
    saveToLocalStorage();
    if (typeof saveToBackend === 'function') {
        await saveToBackend();
    }
    renderPasswordSection(staff);
    if (typeof renderProfile === 'function') renderProfile();
};


// ============================================================
// 🔑 ŞİFRE DEĞİŞTİRME MODAL FONKSİYONLARI
// ============================================================
window.openChangePasswordModal = function(staffId) {
    const targetId = staffId || localStorage.getItem('myStaffId');
    if (!targetId) {
        alert("Lütfen önce bir profil seçin veya giriş yapın.");
        return;
    }

    const staff = DB.staff.find(s => String(s.id) === String(targetId));
    if (!staff) {
        alert("Personel kaydı bulunamadı.");
        return;
    }

    const nameEl = document.getElementById('modal-pwd-staff-name');
    if (nameEl) nameEl.textContent = staff.name;

    const infoEl = document.getElementById('modal-pwd-current-info');
    if (infoEl) {
        const defaultPass = getDefaultStaffPassword(staff.name);
        const oldPass = { 4: '159159', 7: '1604', 12: '147258369' }[staff.id] || staff.oldPassword;
        let html = `<div><strong>Personel:</strong> ${staff.name}</div>`;
        html += `<div style="margin-top:4px;"><strong>Varsayılan Şifre:</strong> <code>${defaultPass}</code></div>`;
        if (oldPass) {
            html += `<div style="margin-top:2px;"><strong>Eski Şifre:</strong> <code>${oldPass}</code></div>`;
        }
        if (staff.staffPassword) {
            html += `<div style="margin-top:4px; color:var(--accent-green);"><strong>✓ Mevcut Özel Şifreniz:</strong> <code>${staff.staffPassword}</code></div>`;
        } else {
            html += `<div style="margin-top:4px; color:#a5b4fc;"><strong>Durum:</strong> Standart şifre aktif. Yeni bir şifre belirleyebilirsiniz.</div>`;
        }
        infoEl.innerHTML = html;
    }

    const passInput = document.getElementById('modal-input-new-pass');
    const confirmInput = document.getElementById('modal-input-new-pass-confirm');
    const errEl = document.getElementById('modal-pwd-error');

    if (passInput) { passInput.value = ''; passInput.type = 'password'; }
    if (confirmInput) { confirmInput.value = ''; confirmInput.type = 'password'; }
    if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }

    const modal = document.getElementById('modal-change-password');
    if (modal) modal.classList.remove('hidden');
    setTimeout(() => passInput?.focus(), 100);
};

window.closeChangePasswordModal = function() {
    const modal = document.getElementById('modal-change-password');
    if (modal) modal.classList.add('hidden');
};

window.togglePassVisibility = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
};

window.submitChangePasswordModal = async function() {
    const staffId = localStorage.getItem('myStaffId');
    if (!staffId) {
        alert("Oturum bulunamadı.");
        return;
    }

    const passInput = document.getElementById('modal-input-new-pass');
    const confirmInput = document.getElementById('modal-input-new-pass-confirm');
    const errEl = document.getElementById('modal-pwd-error');

    const newPass = passInput ? passInput.value.trim() : '';
    const confirmPass = confirmInput ? confirmInput.value.trim() : '';

    const showError = (msg) => {
        if (errEl) {
            errEl.textContent = msg;
            errEl.classList.remove('hidden');
        } else {
            alert(msg);
        }
    };

    if (!newPass) return showError("Lütfen yeni şifrenizi girin.");
    if (newPass.length < 4) return showError("Şifre en az 4 karakter uzunluğunda olmalıdır.");
    if (newPass !== confirmPass) return showError("Girdiğiniz şifreler birbiriyle eşleşmiyor! Lütfen tekrar kontrol edin.");

    const ADMIN_PASSWORD_1 = 'GtuAdmın123';
    const ADMIN_PASSWORD_2 = 'GtuAdmin123';
    const GOZETMEN_PASSWORD = 'Gtu2026';
    if (newPass === ADMIN_PASSWORD_1 || newPass === ADMIN_PASSWORD_2 || newPass === GOZETMEN_PASSWORD) {
        return showError("Bu şifre sisteme ayrılmış genel bir şifredir. Lütfen kendinize özel farklı bir şifre belirleyin.");
    }

    const conflict = DB.staff.find(s => s.staffPassword === newPass && String(s.id) !== String(staffId));
    if (conflict) {
        return showError(`Bu şifre zaten başka bir gözetmen (${conflict.name}) tarafından kullanılıyor! Lütfen farklı bir şifre seçin.`);
    }

    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff) return showError("Personel kaydı bulunamadı.");

    const saveBtn = document.getElementById('btn-modal-save-pwd');
    if (saveBtn) { saveBtn.textContent = 'Kaydediliyor...'; saveBtn.disabled = true; }

    try {
        staff.staffPassword = newPass;
        saveToLocalStorage();
        if (typeof saveToBackend === 'function') {
            await saveToBackend();
        }

        closeChangePasswordModal();
        if (typeof renderProfile === 'function') renderProfile();
        if (typeof renderPasswordSection === 'function') renderPasswordSection(staff);
        if (typeof window.showToast === 'function') {
            window.showToast(`✅ Şifreniz başarıyla "${newPass}" olarak güncellendi!`);
        } else {
            alert(`✅ Şifreniz başarıyla kaydedildi!\n\nArtık ana giriş ekranında "${newPass}" şifrenizle doğrudan kendi profilinize giriş yapabilirsiniz.`);
        }
    } catch (e) {
        showError("Kayıt sırasında bir hata oluştu: " + e.message);
    } finally {
        if (saveBtn) { saveBtn.textContent = '💾 Şifreyi Kaydet ve Güncelle'; saveBtn.disabled = false; }
    }
};

window.resetToDefaultPasswordModal = async function() {
    const staffId = localStorage.getItem('myStaffId');
    if (!staffId) return;

    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff) return;

    const defaultPass = getDefaultStaffPassword(staff.name);
    if (!confirm(`Kişisel şifrenizi kaldırıp standart varsayılan şifrenize (${defaultPass}) dönmek istediğinize emin misiniz?`)) {
        return;
    }

    delete staff.staffPassword;
    saveToLocalStorage();
    if (typeof saveToBackend === 'function') {
        await saveToBackend();
    }

    closeChangePasswordModal();
    if (typeof renderProfile === 'function') renderProfile();
    if (typeof renderPasswordSection === 'function') renderPasswordSection(staff);
    if (typeof window.showToast === 'function') {
        window.showToast(`✅ Şifreniz standart (${defaultPass}) olarak sıfırlandı.`);
    } else {
        alert(`✅ Şifreniz standart (${defaultPass}) olarak sıfırlandı.`);
    }
};


/**
 * DUYURU SİSTEMİ FONKSİYONLARI
 */

function renderAnnouncements() {
    const container = document.getElementById('announcements-container');
    if (!container) return;
    container.innerHTML = '';

    const sorted = [...DB.announcements].sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    sorted.forEach(ann => {
        let text = ann.text || "";
        text = text.replace(/\n/g, '<br>');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/### (.*?)(<br>|$)/g, '<h3>$1</h3>');
        
        // Özel Link: Müsaitlik Girişi
        if (text.includes('{{AVAIL_LINK}}')) {
            text = text.replace('{{AVAIL_LINK}}', '#');
            text = text.replace(/\[(.*?)\]\(#\)/g, '<button class="btn-primary" style="padding: 8px 16px; font-size: 0.8rem; margin-top: 10px;" onclick="goToProfileAvailability()">$1</button>');
        }
        
        if (text.includes('{{MARKET_LINK}}')) {
            text = text.replace('{{MARKET_LINK}}', '#');
            text = text.replace(/\[(.*?)\]\(#\)/g, '<button class="btn-primary" style="padding: 8px 16px; font-size: 0.8rem; margin-top: 10px;" onclick="goToProfileMarketplace()">$1</button>');
        }
        
        const date = new Date(ann.updatedAt).toLocaleString('tr-TR');
        
        const card = document.createElement('div');
        card.className = `card-large announcement-card ${ann.isImportant ? 'important' : ''}`;
        card.style.position = 'relative';
        
        let importantBadge = ann.isImportant ? '<span class="important-badge">ÖNEMLİ</span>' : '';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
                <div style="display:flex; align-items:center; gap:10px;">
                    ${importantBadge}
                    <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">🕒 ${date}</span>
                </div>
                <div class="admin-only" style="display:flex; gap:10px;">
                    <button class="btn-icon" onclick="editAnnouncement(${ann.id})">✏️</button>
                    <button class="btn-icon" style="color:var(--accent-red);" onclick="deleteAnnouncement(${ann.id})">🗑️</button>
                </div>
            </div>
            <div class="announcement-content">${text}</div>
        `;
        container.appendChild(card);
    });
    
    updateAnnouncementBadge(); 
}

window.editAnnouncement = function(id) {
    const modal = document.getElementById('modal-edit-announcement');
    const title = document.getElementById('modal-announcement-title');
    const textarea = document.getElementById('edit-announcement-text');
    const idInput = document.getElementById('edit-announcement-id');
    const importantCheckbox = document.getElementById('edit-announcement-important');
    
    if (id) {
        const ann = DB.announcements.find(a => String(a.id) === String(id));
        title.textContent = "Duyuruyu Düzenle";
        textarea.value = ann ? ann.text : "";
        idInput.value = id;
        importantCheckbox.checked = ann ? !!ann.isImportant : false;
    } else {
        title.textContent = "Yeni Duyuru Ekle";
        textarea.value = "";
        idInput.value = "";
        importantCheckbox.checked = false;
    }
    
    modal.classList.remove('hidden');
}

async function handleAnnouncementSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-announcement-id').value;
    const text = document.getElementById('edit-announcement-text').value;
    const isImportant = document.getElementById('edit-announcement-important').checked;

    if (!text.trim()) {
        alert("Duyuru metni boş olamaz!");
        return;
    }

    if (id) {
        // Güncelle
        const ann = DB.announcements.find(a => String(a.id) === String(id));
        if (ann) {
            ann.text = text;
            ann.isImportant = isImportant;
            ann.updatedAt = new Date().toISOString();
        }
    } else {
        // Yeni Ekle
        DB.announcements.push({
            id: Date.now(),
            text: text,
            isImportant: isImportant,
            updatedAt: new Date().toISOString()
        });
    }
    
    saveToLocalStorage();
    renderAnnouncements();
    
    document.getElementById('modal-edit-announcement').classList.add('hidden');
    alert("✓ Duyuru başariyla kaydedildi.");
}

window.deleteAnnouncement = function(id) {
    if (confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) {
        DB.announcements = DB.announcements.filter(a => String(a.id) !== String(id));
        saveToLocalStorage();
        renderAnnouncements();
        alert("✓ Duyuru silindi.");
    }
}


function updateAnnouncementBadge() {
    const badge = document.getElementById('announcement-badge');
    if (!badge) return;

    const lastRead = parseInt(localStorage.getItem('lastReadAnnouncementId') || '0');
    const newCount = DB.announcements.filter(a => a.id > lastRead).length;

    if (newCount > 0) {
        badge.innerText = newCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function markAnnouncementsAsRead() {
    if (DB.announcements && DB.announcements.length > 0) {
        const latestId = Math.max(...DB.announcements.map(a => a.id));
        localStorage.setItem('lastReadAnnouncementId', latestId.toString());
        updateAnnouncementBadge();
    }
}

/**
 * PROFİL MÜSAİTLİK YÖNETİMİ
 */

function renderProfileConstraints() {
    if (typeof cleanExpiredConstraints === 'function') cleanExpiredConstraints(true);
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) return;

    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) return;

    const container = document.querySelector('#profile-table-constraints tbody');
    if (!container) return;

    const userConstraints = DB.constraints[staff.name] || [];
    container.innerHTML = '';

    if (userConstraints.length === 0) {
        container.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:2rem;">Henüz bir kisit girmediniz.</td></tr>';
    } else {
        const TurkishDays = ["Pazar", "Pazartesi", "Sali", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        userConstraints.forEach((c, idx) => {
            let label = "";
            if (c.day !== undefined) {
                label = `Haftalik: ${TurkishDays[c.day]}`;
            } else if (c.startDate && c.endDate) {
                label = `Toplu Tarih: ${c.startDate} / ${c.endDate}`;
            } else if (c.date) {
                label = `Özel Tarih: ${c.date}`;
            }
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${label}</strong></td>
                <td>${c.start} - ${c.end}</td>
                <td style="text-align: right;">
                    <button class="btn-icon" style="color:var(--accent-red);" onclick="handleProfileConstraintDelete('${staff.name}', ${idx})">🗑️ Sil</button>
                </td>
            `;
            container.appendChild(tr);
        });
    }

    // Görsel izgarayi ve mini takvimi aninda yenile
    vcgBuild(staff.name);
    if (typeof renderMiniAvailabilityGrid === 'function') renderMiniAvailabilityGrid(userConstraints);
    if (typeof renderPersonalCalendar === 'function') renderPersonalCalendar(myStaffId);
}

/**
 * GÖRSEL HAFTALIK KISIT IZGARASI
 * Satirlar: 08:00–18:30 arasi 30dk dilimler (21 satir)
 * Sütunlar: Pzt(1) Sal(2) Çar(3) Per(4) Cum(5) Cmt(6) Paz(0)
 */
const VCG_SLOTS   = []; // ["08:00","08:30", ... "18:00"]
const VCG_DAYS    = [1, 2, 3, 4, 5, 6, 0]; // JS getDay değerleri
const VCG_DAYNAMES= ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"];
// Izgara state: vcgState[dayIndex][slotIndex] = true (kapali)
let vcgState = Array.from({length: 7}, () => []);

(function initVcgSlots() {
    for (let h = 8; h <= 18; h++) {
        VCG_SLOTS.push(`${String(h).padStart(2,'0')}:00`);
        if (h < 18) VCG_SLOTS.push(`${String(h).padStart(2,'0')}:30`);
    }
    VCG_SLOTS.push('18:30');
})();

function vcgBuild(staffName) {
    const tbody = document.getElementById('vcg-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Mevcut kisitlardan izgara state'ini yükle
    vcgState = Array.from({length: 7}, () => Array(VCG_SLOTS.length - 1).fill(false));
    const constraints = (DB.constraints && DB.constraints[staffName]) || [];
    constraints.forEach(c => {
        if (c.day === undefined) return; // Sadece haftalik kisitlar
        const dayIdx = VCG_DAYS.indexOf(c.day);
        if (dayIdx === -1) return;
        const startMins = timeStrToMins(c.start);
        const endMins   = timeStrToMins(c.end);
        VCG_SLOTS.forEach((slotStr, si) => {
            if (si >= VCG_SLOTS.length - 1) return;
            const slotStart = timeStrToMins(slotStr);
            const slotEnd   = timeStrToMins(VCG_SLOTS[si + 1]);
            if (slotStart >= startMins && slotEnd <= endMins) {
                vcgState[dayIdx][si] = true;
            }
        });
    });

    VCG_SLOTS.forEach((slotStr, si) => {
        if (si >= VCG_SLOTS.length - 1) return;
        const tr = document.createElement('tr');
        const nextSlot = VCG_SLOTS[si + 1];
        tr.innerHTML = `<td style="padding:3px 6px; color:var(--text-muted); font-size:0.7rem; white-space:nowrap;">${slotStr}–${nextSlot}</td>`;
        VCG_DAYS.forEach((_, di) => {
            const td = document.createElement('td');
            td.style.cssText = 'padding:2px 3px; text-align:center; cursor:pointer;';
            td.dataset.day = di;
            td.dataset.slot = si;
            const isBlocked = vcgState[di][si];
            td.innerHTML = `<div class="vcg-cell" style="
                width:100%; min-width:28px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:0.65rem;
                background:${isBlocked ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.12)'};
                border:1px solid ${isBlocked ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.2)'};
                color:${isBlocked ? '#f87171' : 'rgba(134,239,172,0.7)'};
                transition:background 0.15s;
            ">${isBlocked ? '🔴' : '✅'}</div>`;
            td.addEventListener('click', () => vcgToggle(di, si, td));
            // Sürükleyerek seçim
            td.addEventListener('mouseenter', (e) => { if (e.buttons === 1) vcgToggle(di, si, td); });
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function timeStrToMins(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function vcgToggle(di, si, td) {
    vcgState[di][si] = !vcgState[di][si];
    const isBlocked = vcgState[di][si];
    const cell = td.querySelector('.vcg-cell');
    if (cell) {
        cell.style.background    = isBlocked ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.12)';
        cell.style.border        = `1px solid ${isBlocked ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.2)'}`;
        cell.style.color         = isBlocked ? '#f87171' : 'rgba(134,239,172,0.7)';
        cell.textContent         = isBlocked ? '🔴' : '✅';
    }
}

window.vcgSaveAll = function() {
    const myStaffId = localStorage.getItem('myStaffId');
    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) {
        alert("Lütfen önce profil sayfasindan kimliğinizi seçin.");
        return;
    }

    if (!DB.constraints) DB.constraints = {};

    // Mevcut özel tarih kisitlarini koru (sadece haftalik olanlari sil ve yeniden yaz)
    const oldConstraints = DB.constraints[staff.name] || [];
    const nonDayConstraints = oldConstraints.filter(c => c.day === undefined);

    // vcgState'den ardişik bloklari birleştirerek kisit oluştur
    const newConstraints = [...nonDayConstraints];

    VCG_DAYS.forEach((dayNum, di) => {
        let blockStart = null;
        for (let si = 0; si <= VCG_SLOTS.length - 1; si++) {
            const isBlocked = si < VCG_SLOTS.length - 1 && vcgState[di][si];
            if (isBlocked && blockStart === null) {
                blockStart = si;
            }
            if (!isBlocked && blockStart !== null) {
                newConstraints.push({ day: dayNum, start: VCG_SLOTS[blockStart], end: VCG_SLOTS[si] });
                blockStart = null;
            }
        }
        if (blockStart !== null) {
            newConstraints.push({ day: dayNum, start: VCG_SLOTS[blockStart], end: VCG_SLOTS[VCG_SLOTS.length - 1] });
        }
    });

    DB.constraints[staff.name] = newConstraints;
    saveToLocalStorage();
    renderProfileConstraints();
    showToast('✅ Kisitlariniz kaydedildi!', 'success');
};

window.vcgClearAll = function() {
    if (!confirm('Tüm haftalik kisitlariniz silinecek. Emin misiniz?')) return;
    const myStaffId = localStorage.getItem('myStaffId');
    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) {
        alert("Lütfen önce profil sayfasindan kimliğinizi seçin.");
        return;
    }
    if (!DB.constraints) DB.constraints = {};
    const oldConstraints = DB.constraints[staff.name] || [];
    DB.constraints[staff.name] = oldConstraints.filter(c => c.day === undefined);
    vcgState = Array.from({length: 7}, () => Array(VCG_SLOTS.length - 1).fill(false));
    saveToLocalStorage();
    renderProfileConstraints();
    showToast('Tüm haftalik kisitlariniz temizlendi.', 'info');
};

window.toggleDateConstraintFields = function() {
    const type = document.getElementById('profile-constraint-type')?.value;
    const dateGrp      = document.getElementById('profile-constraint-date-group');
    const daterangeGrp = document.getElementById('profile-constraint-daterange-group');
    if (!dateGrp || !daterangeGrp) return;
    if (type === 'date') {
        dateGrp.classList.remove('hidden');
        daterangeGrp.classList.add('hidden');
    } else {
        dateGrp.classList.add('hidden');
        daterangeGrp.classList.remove('hidden');
    }
};


function renderMiniAvailabilityGrid(constraints) {
    const grid = document.getElementById('profile-availability-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const days = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    days.forEach((day, i) => {
        const hasConstraint = constraints.some(c => c.day === (i === 0 ? 0 : i)); // Pazar=0 fixed
        const cell = document.createElement('div');
        cell.style.textAlign = 'center';
        cell.style.padding = '10px 5px';
        cell.style.borderRadius = '8px';
        cell.style.background = hasConstraint ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.1)';
        cell.style.border = hasConstraint ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.2)';
        cell.innerHTML = `
            <div style="font-size: 0.65rem; color: var(--text-muted);">${day}</div>
            <div style="font-size: 0.8rem; margin-top: 4px;">${hasConstraint ? '🚫' : '✅'}</div>
        `;
        grid.appendChild(cell);
    });
}

function handleProfileConstraintAdd() {
    const myStaffId = localStorage.getItem('myStaffId');
    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) {
        alert("Lütfen önce profil sayfasindan kimliğinizi seçin.");
        return;
    }

    const type = document.getElementById('profile-constraint-type').value;
    const start = document.getElementById('profile-constraint-start').value;
    const end = document.getElementById('profile-constraint-end').value;

    const newConstraint = { start, end };
    if (type === 'day') {
        const dayEl = document.getElementById('profile-constraint-day');
        if (dayEl) newConstraint.day = parseInt(dayEl.value);
    } else if (type === 'date') {
        const dateVal = document.getElementById('profile-constraint-date').value; // YYYY-MM-DD
        if (!dateVal) { alert("Lütfen tarih seçin!"); return; }
        const parts = dateVal.split('-');
        newConstraint.date = `${parts[1]}-${parts[2]}`; // MM-DD formati logic.js uyumlu
    } else if (type === 'daterange') {
        const startVal = document.getElementById('profile-constraint-daterange-start').value;
        const endVal = document.getElementById('profile-constraint-daterange-end').value;
        if (!startVal || !endVal) { alert("Lütfen başlangiç ve bitiş tarihlerini seçin!"); return; }
        if (startVal > endVal) { alert("Başlangiç tarihi bitiş tarihinden sonra olamaz!"); return; }
        newConstraint.startDate = startVal;
        newConstraint.endDate = endVal;
    }

    if (!DB.constraints) DB.constraints = {};
    if (!DB.constraints[staff.name]) DB.constraints[staff.name] = [];
    DB.constraints[staff.name].push(newConstraint);

    saveToLocalStorage();
    renderProfileConstraints();
    showToast("✓ Müsaitlik kisiti profilinize eklendi.", "success");
}

window.handleProfileConstraintDelete = function(name, idx) {
    if (confirm("Bu kisiti silmek istediğinize emin misiniz?")) {
        if (!DB.constraints) DB.constraints = {};
        if (DB.constraints[name]) {
            DB.constraints[name].splice(idx, 1);
            saveToLocalStorage();
            renderProfileConstraints();
            showToast("Kisit silindi.", "info");
        }
    }
}

window.initiateOpenSwap = function(examId) {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) {
        alert("Lütfen önce profilinizden kimliğinizi seçin.");
        return;
    }

    // Aktif talep kontrolü
    const existing = (DB.requests || []).find(r => r.examId == examId && ['pending', 'accepted_waiting_approval'].includes(r.status));
    if (existing) {
        alert("Bu görev için zaten aktif bir yer değiştirme talebiniz bulunuyor.");
        return;
    }

    const exam = DB.exams.find(e => e.id == examId);
    if (!exam) return;

    const dateStr = exam.date ? exam.date.split('-').reverse().join('.') : '';
    if (confirm(`${exam.name} sinavi (${dateStr} ${exam.time}) için yerinize birini aramak istediğinize emin misiniz?\n\nGörev "Pazar Yeri"ne alinacak ve diğer hocalar devralabilecektir.`)) {
        const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
        
        const newReq = {
            id: Date.now(),
            examId: exam.id,
            examName: exam.name,
            examDate: exam.date,
            examTime: exam.time,
            initiatorId: staff.id,
            initiatorName: staff.name,
            receiverId: null,
            receiverName: "Açik Talep",
            status: 'pending', // Spec: pending
            fromApproved: true,
            toApproved: false,
            createdAt: new Date().toISOString()
        };

        if (!DB.requests) DB.requests = [];
        DB.requests.push(newReq);

        // Görev durumunu güncelle
        if (!DB.taskStatuses) DB.taskStatuses = {};
        DB.taskStatuses[`${examId}_${myStaffId}`] = 'market_listed';

        logAction('SWAP_INITIATED', `${staff.name}, ${exam.name} için yer değiştirme talebi açti.`, { examId });
        saveToLocalStorage();
        
        // Pazar Yeri Webhook bildirimi gönder
        dispatchNotificationEvent('marketplace_drop', {
            initiatorName: staff.name,
            initiatorId: staff.id,
            examName: exam.name,
            examDate: exam.date,
            examTime: exam.time,
            duration: exam.duration,
            score: exam.score,
            requestId: newReq.id
        });

        // E-posta bildirimi gönderme seçeneği sun
        const sendEmail = confirm("✅ Görev Pazar Yeri'ne alindi!\n\nHocalara e-posta ile de bildirim göndermek ister misiniz?\n\nTamam → E-posta Hazirla\nİptal → Sadece Pazar Yerine Ekle");
        if (sendEmail && typeof openMarketEmailModal === 'function') {
            openMarketEmailModal(examId);
        } else {
            if (typeof showToast === 'function') {
                showToast('✅ Görev Pazar Yeri\'ne eklendi. Diğer hocalar "Açik Görevler" sekmesinden kabul edebilir.', 'success');
            }
        }
        
        renderProfile();
        updateMarketplaceBadge();
    }
};

window.renderMarketplace = function() {
    const myStaffId = localStorage.getItem('myStaffId');
    const tbody = document.querySelector('#profile-table-marketplace tbody');
    if (!tbody || !myStaffId) return;

    tbody.innerHTML = '';
    const myStaffIdNum = parseInt(myStaffId);

    // Açik talepleri bul (pending ve receiverId null)
    // Filtreleme: Kullanici tarafindan reddedilmiş (gizlenmiş) talepleri çikar
    const dismissedKey = `dismissed_requests_${myStaffId}`;
    const dismissedIds = JSON.parse(localStorage.getItem(dismissedKey) || "[]");

    const now = new Date();
    const openRequests = (DB.requests || [])
        .filter(r => {
            if (r.status !== 'pending' || r.receiverId !== null || r.initiatorId === myStaffIdNum) return false;
            if (dismissedIds.includes(r.id)) return false;
            // Geçmiş sinavlari gösterme
            const exam = DB.exams.find(e => String(e.id) === String(r.examId));
            if (!exam) return false;
            const examDate = getSafeDate(exam.date, exam.time);
            const examEnd = new Date(examDate.getTime() + (exam.duration || 60) * 60000);
            return examEnd >= now;
        });

    if (openRequests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Şu an için uygun açik görev bulunmuyor.</td></tr>';
        return;
    }

    openRequests.forEach(req => {
        const exam = DB.exams.find(e => e.id == req.examId);
        if (!exam) return;

        // Kullanici bu saatte müsait mi?
        const isFree = isProctorTrulyFree(myStaffIdNum, req.examDate, req.examTime, exam.duration);
        
        if (isFree) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${req.examName}</strong><br><small>${req.initiatorName} tarafindan birakildi</small></td>
                <td>${req.examDate.split("-").reverse().join(".")}</td>
                <td>${req.examTime}</td>
                <td>${exam.duration} dk</td>
                <td><span class="score-tag">+${exam.score || 0}</span></td>
                <td style="text-align:right; display: flex; gap: 5px; justify-content: flex-end;">
                    <button class="btn-primary" onclick="acceptOpenRequest(${req.id})" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; background: var(--accent-green);">Görevi Al</button>
                    <button class="btn-secondary" onclick="openOfferSwapModal(${req.id})" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; background: var(--accent-orange);">Takas Teklif Et</button>
                    <button class="btn-delete" onclick="dismissMarketplaceRequest(${req.id})" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">Reddet</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });

    if (tbody.children.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Müsait olduğunuz bir açik görev bulunmuyor.</td></tr>';
    }
};

window.dismissMarketplaceRequest = function(requestId) {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) return;

    const dismissedKey = `dismissed_requests_${myStaffId}`;
    const dismissedIds = JSON.parse(localStorage.getItem(dismissedKey) || "[]");
    
    if (!dismissedIds.includes(requestId)) {
        dismissedIds.push(requestId);
        localStorage.setItem(dismissedKey, JSON.stringify(dismissedIds));
    }
    
    renderMarketplace();
    updateMarketplaceBadge();
};

window.acceptOpenRequest = async function(requestId) {
    const myStaffId = localStorage.getItem('myStaffId');
    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) return;

    const req = DB.requests.find(r => r.id === requestId);
    if (!req) return;

    // Race condition kontrolü
    if (req.status !== 'pending') {
        alert("Üzgünüz, bu görev az önce başkasi tarafindan kabul edildi veya iptal edildi.");
        renderProfile();
        return;
    }

    const exam = DB.exams.find(e => e.id == req.examId);
    if (!exam) return;

    const confirmed = await confirmWithPassword(
        `"${req.examName}" görevini devralacağinizi onaylamak için lütfen kişisel şifrenizi girin.`,
        staff
    );
    if (confirmed) {
        const fromStaff = DB.staff.find(s => s.id == req.initiatorId);
        const toStaff = staff;

        // Puan ve Görev Sayisi Güncelleme (nonExam/exam ayrimi)
        if (fromStaff) {
            if (shouldCountAsNonExam(exam)) {
                fromStaff.nonExamScore = Math.max(0, parseFloat(((fromStaff.nonExamScore || 0) - exam.score).toFixed(2)));
                fromStaff.nonExamTaskCount = Math.max(0, (fromStaff.nonExamTaskCount || 0) - 1);
            } else {
                fromStaff.totalScore = Math.max(0, parseFloat((fromStaff.totalScore - exam.score).toFixed(2)));
                fromStaff.taskCount = Math.max(0, fromStaff.taskCount - 1);
            }
        }
        if (shouldCountAsNonExam(exam)) {
            toStaff.nonExamScore = parseFloat(((toStaff.nonExamScore || 0) + exam.score).toFixed(2));
            toStaff.nonExamTaskCount = (toStaff.nonExamTaskCount || 0) + 1;
        } else {
            toStaff.totalScore = parseFloat((toStaff.totalScore + exam.score).toFixed(2));
            toStaff.taskCount = (toStaff.taskCount || 0) + 1;
        }

        // Sinavi Güncelle
        if (!exam.proctorIds) exam.proctorIds = [exam.proctorId];
        
        // Initiator'i bul ve değiştir
        const idx = exam.proctorIds.indexOf(req.initiatorId);
        if (idx !== -1) {
            exam.proctorIds[idx] = toStaff.id;
        } else {
            // Eğer val bir şekilde yoksa (eski data?), listeye ekle veya yer değiştir
            exam.proctorIds = [toStaff.id];
        }
        
        // proctorId (ana sorumlu) eğer değişen kişi ise onu da güncelle
        if (exam.proctorId === req.initiatorId) {
            exam.proctorId = toStaff.id;
        }

        // İsimleri güncelle
        const allProctors = DB.staff.filter(s => exam.proctorIds.includes(s.id));
        exam.proctorName = allProctors.map(p => p.name).join(', ');

        // Talebi Güncelle
        req.status = 'approved';
        req.receiverId = toStaff.id;
        req.receiverName = toStaff.name;
        req.toApproved = true;

        // Görev durumlarini güncelle
        if (!DB.taskStatuses) DB.taskStatuses = {};
        DB.taskStatuses[`${exam.id}_${req.initiatorId}`] = 'transferred';
        DB.taskStatuses[`${exam.id}_${toStaff.id}`] = 'normal';

        logAction('user', 'Açik Talep Kabulü', `${toStaff.name}, ${req.initiatorName}'in ${req.examName} görevini devraldi.`);
        
        saveToLocalStorage();
        
        // Bildirim tetikle (Webhook & E-posta)
        dispatchNotificationEvent('swap_accepted', {
            initiatorName: fromStaff ? fromStaff.name : req.initiatorName,
            initiatorId: fromStaff ? fromStaff.id : req.initiatorId,
            receiverName: toStaff.name,
            receiverId: toStaff.id,
            examName: exam.name,
            swapType: 'marketplace_claim'
        });

        // Admin modundaysa sunucuya kaydet
        await saveToBackend();
        
        alert("✓ Görev başariyla devralindi ve puanlar güncellendi.");
        
        renderProfile();
        updateMarketplaceBadge();
        renderDashboard();
        renderExams();
        renderSchedule();
    }
};

window.confirmOpenRequest = async function(requestId) {
    const req = DB.requests.find(r => r.id === requestId);
    if (!req) return;

    if (confirm(`${req.receiverName} hocaya görevi devretmek istediğinize emin misiniz? İşlem aninda gerçekleşecektir.`)) {
        req.toApproved = true;
        
        const exam = DB.exams.find(e => e.id == req.examId);
        const fromStaff = DB.staff.find(s => s.id == req.initiatorId);
        const toStaff = DB.staff.find(s => s.id == req.receiverId);

        if (exam && fromStaff && toStaff) {
            if (shouldCountAsNonExam(exam)) {
                fromStaff.nonExamScore = Math.max(0, parseFloat(((fromStaff.nonExamScore || 0) - exam.score).toFixed(2)));
                fromStaff.nonExamTaskCount = Math.max(0, (fromStaff.nonExamTaskCount || 0) - 1);
                toStaff.nonExamScore = parseFloat(((toStaff.nonExamScore || 0) + exam.score).toFixed(2));
                toStaff.nonExamTaskCount = (toStaff.nonExamTaskCount || 0) + 1;
            } else {
                fromStaff.totalScore = Math.max(0, parseFloat((fromStaff.totalScore - exam.score).toFixed(2)));
                fromStaff.taskCount = Math.max(0, fromStaff.taskCount - 1);
                toStaff.totalScore = parseFloat((toStaff.totalScore + exam.score).toFixed(2));
                toStaff.taskCount = (toStaff.taskCount || 0) + 1;
            }

            exam.proctorId = toStaff.id;
            exam.proctorName = toStaff.name;
            if (!exam.proctorIds) exam.proctorIds = [toStaff.id];
            else {
                const idx = exam.proctorIds.indexOf(fromStaff.id);
                if (idx !== -1) exam.proctorIds[idx] = toStaff.id;
            }

            req.status = 'approved';
            logAction('SWAP_CONFIRMED', `${req.initiatorName}, ${req.receiverName}'i onayladi (Aninda gerçekleşti).`, { requestId });
            saveToLocalStorage();
            
            // Bildirim tetikle (Webhook & E-posta)
            dispatchNotificationEvent('swap_accepted', {
                initiatorName: fromStaff.name,
                initiatorId: fromStaff.id,
                receiverName: toStaff.name,
                receiverId: toStaff.id,
                examName: exam.name,
                swapType: 'open_confirm'
            });

            alert("✓ Onaylandi. Görev devri aninda gerçekleşti ve puanlar güncellendi.");
            renderProfile();
        }
    }
};

window.rejectOpenRequest = function(requestId) {
    const req = DB.requests.find(r => r.id === requestId);
    if (!req) return;

    if (confirm("Bu hocanin kabulünü reddetmek istediğinize emin misiniz? Talebiniz tekrar açik hale gelecektir.")) {
        req.receiverId = null;
        req.receiverName = "Açik Talep";
        req.status = 'pending';
        logAction('SWAP_REJECTED', `${req.initiatorName}, ${req.receiverName}'i reddetti (Talep tekrar açildi).`, { requestId });
        saveToLocalStorage();
        renderProfile();
    }
};

window.goToProfileAvailability = function() {
    // 1. Profil sekmesine geç
    document.getElementById('btn-profile').click();
    
    // 2. Kisit Ayarlarim tabina geç
    const availTabBtn = document.querySelector('#section-profile .tab-btn[data-tab="availability"]');
    if (availTabBtn) availTabBtn.click();
};

window.goToProfileMarketplace = function() {
    // 1. Profil sekmesine geç
    document.getElementById('btn-profile').click();
    
    // 2. Pazar Yeri tabina geç
    const marketTabBtn = document.querySelector('#section-profile .tab-btn[data-tab="marketplace"]');
    if (marketTabBtn) marketTabBtn.click();
};

window.openTypeManager = () => {
    document.getElementById('modal-manage-types').classList.remove('hidden');
    renderExamTypesList();
};

/**
 * DIRECT SWAP (BİREBİR TAKAS) MANTIĞI
 */

window.cancelSwapRequest = function(requestId) {
    if (confirm("Bu talebi iptal etmek istediğinize emin misiniz?")) {
        const reqIndex = DB.requests.findIndex(r => String(r.id) === String(requestId));
        if (reqIndex > -1) {
            const req = DB.requests[reqIndex];
            DB.requests.splice(reqIndex, 1);

            // Görev durumunu temizle
            if (DB.taskStatuses) {
                const myStaffId = localStorage.getItem('myStaffId');
                const examId = req.examId || req.initiatorExamId;
                if (examId && myStaffId) {
                    const key = `${examId}_${myStaffId}`;
                    if (DB.taskStatuses[key] === 'market_listed' || DB.taskStatuses[key] === 'swap_pending' || DB.taskStatuses[key] === 'swap_requested') {
                        delete DB.taskStatuses[key];
                    }
                }
            }

            logAction('user', 'Talep İptali', `${req.initiatorName}, ${req.examName || 'bilinmeyen sinav'} için açtiği talebi iptal etti.`);
            saveToLocalStorage();
            
            // Bildirim tetikle (Webhook)
            dispatchNotificationEvent('swap_cancelled', {
                initiatorName: req.initiatorName,
                examName: req.examName || 'Görev Devri / Takas'
            });

            renderExams();
            renderProfile();
            updateMarketplaceBadge();
            if (typeof showToast === 'function') showToast('✓ Talep başariyla iptal edildi.', 'success');
            else alert("✓ Talep başariyla iptal edildi.");
        }
    }
};

window.initiateDirectSwap = function(myExamId) {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) return alert("Lütfen önce profilinizden kimliğinizi seçin.");

    const myExam = DB.exams.find(e => String(e.id) === String(myExamId));
    if (!myExam) return;

    document.getElementById('direct-swap-my-exam-id').value = myExamId;
    document.getElementById('direct-swap-my-exam-name').textContent = `${myExam.name} (${myExam.date})`;
    
    // Hoca listesini doldur (kendim hariç)
    const targetSelect = document.getElementById('direct-swap-target-proctor');
    targetSelect.innerHTML = '<option value="">Hoca Seçin...</option>' + 
        DB.staff.filter(s => String(s.id) !== String(myStaffId))
               .sort((a,b) => a.name.localeCompare(b.name, 'tr'))
               .map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    // Reset modal state
    document.getElementById('direct-swap-target-exams-container').classList.add('hidden');
    document.getElementById('direct-swap-summary').classList.add('hidden');
    document.getElementById('btn-confirm-direct-swap').disabled = true;

    document.getElementById('modal-direct-swap').classList.remove('hidden');

    // Change listener
    targetSelect.onchange = () => {
        const targetId = targetSelect.value;
        if (!targetId) {
            document.getElementById('direct-swap-target-exams-container').classList.add('hidden');
            return;
        }
        renderDirectSwapTargetExams(targetId);
    };
};

window.renderDirectSwapTargetExams = function(targetStaffId) {
    const container = document.getElementById('direct-swap-target-exams-container');
    const list = document.getElementById('direct-swap-exam-list');
    
    // Hocanin aktif sinavlarini bul
    const now = new Date();
    const targetExams = DB.exams.filter(e => {
        if (String(e.proctorId) !== String(targetStaffId)) return false;
        if (!e.date || !e.time) return false;
        const examDate = getSafeDate(e.date, e.time);
        const examEnd = new Date(examDate.getTime() + (e.duration || 60) * 60000);
        return examEnd >= now;
    });

    if (targetExams.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem;">Bu hocanin aktif görevi bulunmuyor.</p>';
    } else {
        list.innerHTML = targetExams.map(ex => `
            <div class="suggestion-item" onclick="selectDirectSwapTargetExam(${ex.id}, \`${ex.name.replace(/`/g, '').replace(/"/g, '&quot;')}\`, '${ex.date}', this)">
                <div style="font-weight: 600;">${ex.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${ex.date} - ${ex.time}</div>
            </div>
        `).join('');
    }
    container.classList.remove('hidden');
};

window.selectDirectSwapTargetExam = function(examId, name, date, element) {
    window.selectedDirectSwapTargetExamId = examId;
    document.getElementById('direct-swap-target-exam-name').textContent = `${name} (${date})`;
    document.getElementById('direct-swap-summary').classList.remove('hidden');
    document.getElementById('btn-confirm-direct-swap').disabled = false;
    
    // Highlight selected
    document.querySelectorAll('#direct-swap-exam-list .suggestion-item').forEach(el => el.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    } else if (typeof event !== 'undefined' && event.currentTarget) {
        event.currentTarget.classList.add('active'); // Fallback
    }
};

document.getElementById('btn-confirm-direct-swap').onclick = async function() {
    try {
        const myExamId = document.getElementById('direct-swap-my-exam-id').value;
        const targetStaffId = document.getElementById('direct-swap-target-proctor').value;
        const targetExamId = window.selectedDirectSwapTargetExamId;
        const myStaffId = localStorage.getItem('myStaffId');

        if (!myExamId || !targetStaffId || !targetExamId) {
            alert("Lütfen karşi tarafin sinavini seçiniz.");
            return;
        }

        const myStaff = DB.staff.find(s => String(s.id) === String(myStaffId));
        const targetStaff = DB.staff.find(s => String(s.id) === String(targetStaffId));
        const myExam = DB.exams.find(e => String(e.id) === String(myExamId));
        const targetExam = DB.exams.find(e => String(e.id) === String(targetExamId));

        if (!myStaff || !targetStaff || !myExam || !targetExam) {
            alert("Kayit bulunamadi. Lütfen sayfayi yenileyin.");
            return;
        }

        if (confirm(`${targetStaff.name} hocaya birebir takas teklifi göndermek istediğinize emin misiniz?`)) {
            if (!DB.requests) DB.requests = [];
            
            const newReq = {
                id: Date.now(),
                type: 'direct_swap',
                initiatorId: parseInt(myStaffId),
                initiatorName: myStaff.name,
                initiatorExamId: Number(myExamId),
                receiverId: parseInt(targetStaffId),
                receiverName: targetStaff.name,
                receiverExamId: Number(targetExamId),
                status: 'pending_peer',
                createdAt: new Date().toISOString()
            };
            DB.requests.push(newReq);

            saveToLocalStorage();
            
            // Webhook ve E-posta bildirimi tetikle
            dispatchNotificationEvent('swap_offer', {
                initiatorName: myStaff.name,
                receiverName: targetStaff.name,
                receiverId: targetStaff.id,
                initiatorExamName: myExam.name,
                receiverExamName: targetExam.name,
                examDate: myExam.date,
                examTime: myExam.time
            });

            alert("Takas teklifiniz iletildi. Hocanin onaylamasi bekleniyor.");
            document.getElementById('modal-direct-swap').classList.add('hidden');
            renderProfile();
        }
    } catch(err) {
        alert("Teklif Gönderilirken Hata: " + err.message);
        console.error("Direct swap error:", err);
    }
};

window.openOfferSwapModal = function(requestId) {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) return alert("Lütfen önce profilinizden kimliğinizi seçin.");

    const req = DB.requests.find(r => String(r.id) === String(requestId));
    if (!req) return;

    const targetExam = DB.exams.find(e => String(e.id) === String(req.examId));
    if (!targetExam) return;

    document.getElementById('offer-swap-request-id').value = requestId;
    document.getElementById('offer-swap-target-exam-name').textContent = `${targetExam.name} (${targetExam.date})`;
    
    // Kendi aktif sinavlarimi bul
    const now = new Date();
    const myExams = DB.exams.filter(e => {
        if (!e.proctorIds && e.proctorId !== parseInt(myStaffId)) return false;
        if (e.proctorIds && !e.proctorIds.includes(parseInt(myStaffId))) return false;
        if (!e.date || !e.time) return false;
        const examDate = getSafeDate(e.date, e.time);
        const examEnd = new Date(examDate.getTime() + (e.duration || 60) * 60000);
        return examEnd >= now;
    });

    const list = document.getElementById('offer-swap-exam-list');
    if (myExams.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem;">Aktif göreviniz bulunmuyor. Takas teklif edemezsiniz.</p>';
    } else {
        list.innerHTML = myExams.map(ex => `
            <div class="suggestion-item" onclick="selectOfferSwapExam(${ex.id}, \`${ex.name.replace(/`/g, '').replace(/"/g, '&quot;')}\`, '${ex.date}', this)">
                <div style="font-weight: 600;">${ex.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${ex.date} - ${ex.time}</div>
            </div>
        `).join('');
    }

    document.getElementById('offer-swap-summary').classList.add('hidden');
    document.getElementById('btn-confirm-offer-swap').disabled = true;
    window.selectedOfferSwapMyExamId = null;

    document.getElementById('modal-offer-swap').classList.remove('hidden');
};

window.selectOfferSwapExam = function(examId, name, date, element) {
    window.selectedOfferSwapMyExamId = examId;
    document.getElementById('offer-swap-my-exam-name').textContent = `${name} (${date})`;
    document.getElementById('offer-swap-summary').classList.remove('hidden');
    document.getElementById('btn-confirm-offer-swap').disabled = false;
    
    document.querySelectorAll('#offer-swap-exam-list .suggestion-item').forEach(el => el.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    }
};

window.confirmOfferSwap = async function() {
    try {
        const requestId = document.getElementById('offer-swap-request-id').value;
        const myExamId = window.selectedOfferSwapMyExamId;
        const myStaffId = localStorage.getItem('myStaffId');

        if (!myExamId || !requestId) {
            alert("Lütfen vereceğiniz sinavi seçiniz.");
            return;
        }

        const openReq = DB.requests.find(r => String(r.id) === String(requestId));
        const myStaff = DB.staff.find(s => String(s.id) === String(myStaffId));
        const targetStaff = DB.staff.find(s => String(s.id) === String(openReq.initiatorId));
        const myExam = DB.exams.find(e => String(e.id) === String(myExamId));
        const targetExam = DB.exams.find(e => String(e.id) === String(openReq.examId));

        if (!myStaff || !targetStaff || !myExam || !targetExam || !openReq) {
            alert("Kayit bulunamadi. Lütfen sayfayi yenileyin.");
            return;
        }

        if (confirm(`Pazar yerindeki bu görev için ${targetStaff.name} hocaya takas teklifi göndermek istediğinize emin misiniz?`)) {
            if (!DB.requests) DB.requests = [];
            
            const newReq = {
                id: Date.now(),
                type: 'direct_swap',
                initiatorId: parseInt(myStaffId),
                initiatorName: myStaff.name,
                initiatorExamId: Number(myExamId),
                receiverId: targetStaff.id,
                receiverName: targetStaff.name,
                receiverExamId: targetExam.id,
                status: 'pending_peer',
                createdAt: new Date().toISOString()
            };
            DB.requests.push(newReq);

            saveToLocalStorage();
            
            // Webhook ve E-posta bildirimi tetikle
            dispatchNotificationEvent('swap_offer', {
                initiatorName: myStaff.name,
                receiverName: targetStaff.name,
                receiverId: targetStaff.id,
                initiatorExamName: myExam.name,
                receiverExamName: targetExam.name,
                examDate: myExam.date,
                examTime: myExam.time
            });

            alert("Takas teklifiniz iletildi. Görevin sahibinin profilinden onaylamasi bekleniyor.");
            document.getElementById('modal-offer-swap').classList.add('hidden');
            renderProfile();
        }
    } catch(err) {
        alert("Teklif Gönderilirken Hata: " + err.message);
        console.error("Offer swap error:", err);
    }
};

window.acceptDirectSwap = async function(requestId) {
    const req = DB.requests.find(r => String(r.id) === String(requestId));
    if (!req) return;

    const myExam = DB.exams.find(e => String(e.id) === String(req.receiverExamId));
    const hisExam = DB.exams.find(e => String(e.id) === String(req.initiatorExamId));
    const myStaff = DB.staff.find(s => s.id == req.receiverId);
    const hisStaff = DB.staff.find(s => s.id == req.initiatorId);

    if (!myExam || !hisExam || !myStaff || !hisStaff) {
        req.status = 'rejected';
        saveToLocalStorage();
        alert("Eski veri veya uyumsuz sinav hatasi oluştu, bu hatali talep iptal edildi.");
        renderProfile();
        return;
    }

    const confirmed = await confirmWithPassword(
        `${hisStaff.name} ile görevi takas etmeyi onaylamak için lütfen kişisel şifrenizi girin.`,
        myStaff
    );
    if (confirmed) {
        // PUAN GÜNCELLEME
        // Benim eski sinavimi ondan çikar, onun sinavini bana ekle demiyoruz. 
        // Birebir değişim: MyExam onun oluyor, HisExam benim oluyor.
        
        // 1. Benim puanimdan benim eski sinavimi düş, onun sinavini ekle
        myStaff.totalScore = parseFloat((myStaff.totalScore - myExam.score + hisExam.score).toFixed(2));
        
        // 2. Onun puanindan onun sinavini düş, benimkini ekle
        hisStaff.totalScore = parseFloat((hisStaff.totalScore - hisExam.score + myExam.score).toFixed(2));

        // 3. Görev sayilari değişmez (1 verildi 1 alindi)

        // 4. Sinavlarin Gözetmenlerini Değiştir
        // MyExam -> hisStaff
        myExam.proctorId = hisStaff.id;
        myExam.proctorName = hisStaff.name;
        if (myExam.proctorIds) {
            const idx = myExam.proctorIds.indexOf(req.receiverId);
            if (idx !== -1) myExam.proctorIds[idx] = hisStaff.id;
            else myExam.proctorIds = [hisStaff.id];
        }

        // HisExam -> myStaff
        hisExam.proctorId = myStaff.id;
        hisExam.proctorName = myStaff.name;
        if (hisExam.proctorIds) {
            const idx = hisExam.proctorIds.indexOf(req.initiatorId);
            if (idx !== -1) hisExam.proctorIds[idx] = myStaff.id;
            else hisExam.proctorIds = [myStaff.id];
        }

        // 5. Talebi Güncelle
        req.status = 'approved';
        req.updatedAt = new Date().toISOString();

        // 6. Görev durumlarini güncelle
        if (!DB.taskStatuses) DB.taskStatuses = {};
        DB.taskStatuses[`${myExam.id}_${req.receiverId}`] = 'swap_completed';
        DB.taskStatuses[`${hisExam.id}_${req.initiatorId}`] = 'swap_completed';

        saveToLocalStorage();
        logAction('user', 'Birebir Takas', `${hisStaff.name} ve ${myStaff.name} hocalar ${hisExam.name} ile ${myExam.name} sinavlarini takas etti.`);
        
        // Webhook ve E-posta bildirimi tetikle
        dispatchNotificationEvent('swap_accepted', {
            initiatorName: hisStaff.name,
            initiatorId: hisStaff.id,
            receiverName: myStaff.name,
            receiverId: myStaff.id,
            examName: hisExam.name,
            secondExamName: myExam.name,
            swapType: 'direct_swap'
        });

        alert("✅ Takas işlemi başariyla tamamlandi!");
        
        await saveToBackend();
        
        renderProfile();
        renderDashboard();
        renderExams();
        renderSchedule();
    }
};

window.rejectDirectSwap = async function(requestId) {
    const req = DB.requests.find(r => String(r.id) === String(requestId));
    if (!req) return;

    if (confirm("Bu takas teklifini reddetmek istediğinize emin misiniz?")) {
        req.status = 'rejected';
        saveToLocalStorage();
        
        // Webhook ve E-posta bildirimi tetikle
        dispatchNotificationEvent('swap_rejected', {
            initiatorName: req.initiatorName,
            initiatorId: req.initiatorId,
            receiverName: req.receiverName,
            examName: 'Birebir Takas Teklifi'
        });

        renderProfile();
        await saveToBackend();
    }
};

window.renderExamTypesList = () => {
    const list = document.getElementById('exam-types-list');
    if(!list) return;
    list.innerHTML = (DB.examTypes || []).map(t => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px; border:1px solid var(--glass-border);">
            <span style="font-size:0.9rem;">${t}</span>
            <button class="btn-icon" onclick="deleteExamType('${t}')" style="color:#ef4444; border:none; background:none; cursor:pointer; font-size:1.1rem; filter:grayscale(1) brightness(2);">🗑️</button>
        </div>
    `).join('');

    // Mevcut açik modal'lardaki dropdown'lari tazele
    const addTypeSelect = document.getElementById('exam-type');
    if (addTypeSelect) {
        addTypeSelect.innerHTML = (DB.examTypes || []).map(t => `<option value="${t}">${t}</option>`).join('');
    }
    const editTypeSelect = document.getElementById('edit-exam-type');
    if (editTypeSelect) {
        editTypeSelect.innerHTML = (DB.examTypes || []).map(t => `<option value="${t}">${t}</option>`).join('');
    }
};

window.addExamType = async () => {
    const input = document.getElementById('new-exam-type-input');
    const type = input.value.trim();
    if (type && !DB.examTypes.includes(type)) {
        DB.examTypes.push(type);
        saveToLocalStorage();
        renderExamTypesList();
        input.value = '';
        await saveToBackend();
    }
};

window.deleteExamType = async (type) => {
    if (confirm(`"${type}" türünü silmek istediğinize emin misiniz?`)) {
        DB.examTypes = DB.examTypes.filter(t => t !== type);
        saveToLocalStorage();
        renderExamTypesList();
        await saveToBackend();
    }
};
window.batchAutoAssign = async function() {
    const unassignedExams = DB.exams.filter(ex => !ex.proctorId && (!ex.proctorIds || ex.proctorIds.length === 0));
    if (unassignedExams.length === 0) {
        alert("Atama yapilacak gözetmensiz sinav bulunamadi.");
        return;
    }

    if (confirm(`${unassignedExams.length} adet sinava otomatik gözetmen atansin mi?`)) {
        let assignedCount = 0;
        unassignedExams.forEach(ex => {
            const best = findBestProctor(ex.date, ex.time, ex.duration);
            if (best) {
                ex.proctorId = best.id;
                ex.proctorIds = [best.id];
                ex.proctorName = best.name;
                
                const score = calculateScore(getSafeDate(ex.date, ex.time), ex.duration);
                ex.score = score;
                
                if (shouldCountAsNonExam(ex)) {
                    best.nonExamScore = parseFloat(((best.nonExamScore || 0) + score).toFixed(2));
                    best.nonExamTaskCount = (best.nonExamTaskCount || 0) + 1;
                } else {
                    best.totalScore = parseFloat((best.totalScore + score).toFixed(2));
                    best.taskCount = (best.taskCount || 0) + 1;
                }
                assignedCount++;
            }
        });

        saveToLocalStorage();
        await saveToBackend();
        
        logAction('admin', 'Toplu Atama', `${assignedCount} unassigned sinava otomatik gözetmen atandi.`);
        
        renderExams();
        renderDashboard();
        renderStaff();
        alert(`✓ ${assignedCount} sinava başariyla atama yapildi.`);
    }
};

window.quickFixConflict = async function(examId) {
    const exam = DB.exams.find(e => e.id === examId);
    if (!exam) return;

    if (confirm(`${exam.name} sinavi için çakişmayi otomatik gidermek istiyor musunuz? Uygun en iyi gözetmen atanacaktir.`)) {
        // Eski gözetmen puanlarini düş (Multi-proctor desteğiyle)
        const oldPIds = exam.proctorIds || [exam.proctorId];
        oldPIds.forEach(pid => {
            const s = DB.staff.find(staff => staff.id === pid);
            if (s) {
                if (shouldCountAsNonExam(exam)) {
                    s.nonExamScore = Math.max(0, parseFloat(((s.nonExamScore || 0) - exam.score).toFixed(2)));
                    s.nonExamTaskCount = Math.max(0, (s.nonExamTaskCount || 0) - 1);
                } else {
                    s.totalScore = Math.max(0, parseFloat((s.totalScore - exam.score).toFixed(2)));
                    s.taskCount = Math.max(0, s.taskCount - 1);
                }
            }
        });

        // Yeni gözetmen bul
        const best = findBestProctor(exam.date, exam.time, exam.duration, exam.id);
        if (best) {
            exam.proctorId = best.id;
            exam.proctorIds = [best.id];
            exam.proctorName = best.name;

            if (shouldCountAsNonExam(exam)) {
                best.nonExamScore = parseFloat(((best.nonExamScore || 0) + exam.score).toFixed(2));
                best.nonExamTaskCount = (best.nonExamTaskCount || 0) + 1;
            } else {
                best.totalScore = parseFloat((best.totalScore + exam.score).toFixed(2));
                best.taskCount = (best.taskCount || 0) + 1;
            }

            saveToLocalStorage();
            await saveToBackend();

            renderExams();
            renderDashboard();
            renderStaff();
            renderSchedule();
            alert(`✓ ${best.name} başariyla atandi.`);
        } else {
            // Eski gözetmenleri geri al (yetersiz yedek)
            oldPIds.forEach(pid => {
                const s = DB.staff.find(staff => staff.id === pid);
                if (s) {
                    if (shouldCountAsNonExam(exam)) {
                        s.nonExamScore = parseFloat(((s.nonExamScore || 0) + exam.score).toFixed(2));
                        s.nonExamTaskCount = (s.nonExamTaskCount || 0) + 1;
                    } else {
                        s.totalScore = parseFloat((s.totalScore + exam.score).toFixed(2));
                        s.taskCount = (s.taskCount || 0) + 1;
                    }
                }
            });
            alert("⚠️ Uygun yedek gözetmen bulunamadi!");
        }
    }
};

/**
 * DASHBOARD PUAN GRAFİĞİ
 */
window.renderScoreChart = function() {
    const ctx = document.getElementById('score-distribution-chart');
    if (!ctx || !window.Chart) return;

    if (window.myScoreChart) window.myScoreChart.destroy();

    const sortedStaff = [...DB.staff].sort((a,b) => b.totalScore - a.totalScore);
    const labels = sortedStaff.map(s => s.name);
    const scores = sortedStaff.map(s => s.totalScore);

    window.myScoreChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Toplam Puan',
                data: scores,
                backgroundColor: 'rgba(99, 102, 241, 0.6)',
                borderColor: '#6366f1',
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
};

// Hook into dashboard rendering
const originalRenderDashboard = window.renderDashboard;
window.renderDashboard = function() {
    if (typeof originalRenderDashboard === 'function') originalRenderDashboard();
    setTimeout(renderScoreChart, 200);
};

// --- NEW FEATURES: AUDIT LOG, PDF EXPORT, THEME ---

/**
 * Audit Log Arayüzünü Render Etme
 */
function renderAuditLogs() {
    const tbody = document.querySelector('#table-audit tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!DB.auditLogs || DB.auditLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">Henüz işlem kaydi bulunmuyor.</td></tr>';
        return;
    }
    
    DB.auditLogs.forEach(log => {
        const tr = document.createElement('tr');
        
        // Kategoriye göre renk atama
        let catColor = 'var(--text-muted)';
        if (log.category === 'admin') catColor = 'var(--primary)';
        if (log.category === 'user') catColor = 'var(--accent-green)';
        
        tr.innerHTML = `
            <td style="font-size: 0.8rem; white-space: nowrap;">${log.timestamp}</td>
            <td><span class="badge" style="background: rgba(255,255,255,0.05); color: ${catColor}; border: 1px solid ${catColor}44; padding: 2px 8px;">${log.category}</span></td>
            <td style="font-weight: 700;">${log.action}</td>
            <td style="color: var(--text-secondary); font-size: 0.85rem;">${log.details}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * PDF Olarak Dişa Aktar (jsPDF & AutoTable)
 */
async function exportToPDF(tableId, title) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Yatay format
    
    let pdfFont = 'helvetica';
    let hasRoboto = false;
    try {
        // Türkçe destekleyen Roboto fontlarini çekip sanal dosya sistemine ekliyoruz
        const [fontRes, boldRes] = await Promise.all([
            fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf'),
            fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf')
        ]);
        
        if (fontRes.ok) {
            const fontBuffer = await fontRes.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(fontBuffer);
            for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
            doc.addFileToVFS('Roboto-Regular.ttf', window.btoa(binary));
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
            hasRoboto = true;
        }
        if (boldRes.ok) {
            const boldBuffer = await boldRes.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(boldBuffer);
            for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
            doc.addFileToVFS('Roboto-Medium.ttf', window.btoa(binary));
            doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');
        }
        if (hasRoboto) {
            pdfFont = 'Roboto';
        }
    } catch (e) {
        console.warn('Font yüklenemedi. Varsayilan font kullanilacak:', e);
    }
    doc.setFont(pdfFont);

    const adjustTextForFont = (str) => {
        if (typeof str !== 'string') return str;
        if (pdfFont === 'helvetica') {
            const trMap = {
                'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'i': 'i', 'İ': 'I',
                'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
            };
            return str.replace(/[çÇğĞiİöÖşŞüÜ]/g, m => trMap[m]);
        }
        return str;
    };

    // Emojileri temizleyen ama Türkçe karakterlere dokunmayan fonksiyon
    const cleanStr = (str) => {
        if (typeof str !== 'string') return str;
        const cleaned = str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
        return adjustTextForFont(cleaned);
    };
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(cleanStr(title), 14, 22);
    
    // Date
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(cleanStr(`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`), 14, 30);

    const table = document.getElementById(tableId);
    if (!table) {
        alert('Tablo bulunamadi!');
        return;
    }

    // AutoTable
    doc.autoTable({
        html: `#${tableId}`,
        startY: 35,
        theme: 'grid',
        styles: {
            font: pdfFont, // Dinamik fontumuz
            fontStyle: 'normal',
            fontSize: 8,
            cellPadding: 3,
            valign: 'middle'
        },
        headStyles: {
            fillColor: [99, 102, 241], // Primary color
            textColor: 255,
            fontSize: 9,
            font: pdfFont,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250]
        },
        didParseCell: function (data) {
            // Harflere dokunmadan sadece emojileri temizle
            if (data.cell && Array.isArray(data.cell.text)) {
                data.cell.text = data.cell.text.map(cleanStr);
            } else if (data.cell && typeof data.cell.text === 'string') {
                data.cell.text = cleanStr(data.cell.text);
            }
        }
    });

    // Sadece Dosya ismi için güvenlik amaciyla Türkçe karakter değiştirelim (indirilirken hata olmasin)
    const replaceTRForFilename = (str) => {
        const trMap = {
            'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'i': 'i', 'İ': 'I',
            'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
        };
        return str.replace(/[çÇğĞiİöÖşŞüÜ]/g, m => trMap[m]).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
    };

    const filename = `${replaceTRForFilename(title).toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    doc.save(filename);
}

window.generateAttendancePDF = async function(examName, date, time, location, relatedExams) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4'); // Dikey A4
    
    try {
        // Türkçe fontlari yükle
        const [fontRes, boldRes] = await Promise.all([
            fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf'),
            fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf')
        ]);
        
        if (fontRes.ok) {
            const fontBuffer = await fontRes.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(fontBuffer);
            for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
            doc.addFileToVFS('Roboto-Regular.ttf', window.btoa(binary));
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        }
        if (boldRes.ok) {
            const boldBuffer = await boldRes.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(boldBuffer);
            for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
            doc.addFileToVFS('Roboto-Medium.ttf', window.btoa(binary));
            doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold');
        }
        doc.setFont('Roboto');
    } catch (e) {
        console.warn('Font yüklenemedi. Varsayilan font kullanilacak:', e);
    }

    const cleanStr = (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ''); // Emojileri temizle
    };

    const formatDate = date.split('-').reverse().join('.');
    
    // Gözetmenleri birleştir
    const proctorsSet = new Set();
    relatedExams.forEach(ex => {
        if (ex.proctorName) proctorsSet.add(ex.proctorName);
        if (ex.proctorIds) {
            ex.proctorIds.forEach(pid => {
                const s = DB.staff.find(x => x.id == pid);
                if (s) proctorsSet.add(s.name);
            });
        }
    });
    const proctorsStr = Array.from(proctorsSet).join(', ') || 'Atanmadi';

    // Akilli sinif / bölüm tespiti
    let classStr = "";
    const nameLower = examName.toLowerCase();
    const classMatch = nameLower.match(/(1|2|3|4)\.\s*(sinif|yil)/);
    if (classMatch) {
        classStr = classMatch[1] + ". Sinif";
    } else {
        const codeMatch = examName.match(/\b([1-4])\d{2}\b/);
        if (codeMatch) {
            classStr = codeMatch[1] + ". Sinif";
        }
    }
    const deptStr = "Matematik Bölümü" + (classStr ? " / " + classStr : "");

    // Logo çizimi (Base64 olarak doğrudan gömülüdür, CORS veya dosya yolu hatalarini önler)
    let startY = 32; // Üst tablonun başlayacaği koordinat
    try {
        const logoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUoAAADACAYAAABidSoPAAAQAElEQVR4Aey9h3cVV74u+FXVyUc5ZwQSEkggcsYkG4PBud1ud9vd/bpf33vfnXlzZ9a8tWbNmvh/zMyaebfbnex2tjFgDBiDyVFIQkhCOecsnTjfrySBhAICBBykXdI+VbX3rt/e+6tT3/mFXVV6UC0KAYWAQkAhMCMCOtSiEFAIKAQUAjMioIhyRnhUoUJAIaAQAEKCKNWJUAgoBBQCoYyAIspQPjuqbwoBhUBIIKCIMiROg+qEQkAhEMoIKKIcOztqrRBQCCgEpkFAEeU0wKhshYBCQCEwhoAiyjEk1FohoBBQCEyDgCLKaYB5NtmqVYWAQiAUEVBEGYpnRfVJIaAQCCkEFFGG1OlQnVEIKARCEQFFlKF4Vp5tn1TrCgGFwH0IKKK8DxC1qxBQCCgE7kdAEeX9iKh9hYBCQCFwHwKKKO8DRA2GBgKqFwqBUEJAEWUonQ3VF4WAQiAkEVBEGZKnRXVKIaAQCCUEFFGG0tlQfQktBFRvFAKjCCiiHAVCrRQCCgGFwHQIKKKcDhmVrxBQCCgERhFQRDkKhFopBEITAdWrUEBAEWUonAXVB4WAQiCkEVBEGdKnR3VOIaAQCAUEFFGGwllQfVAIhDYCC753iigX/FdAAaAQUAg8CAFFlA9CSJUrBBQCCx4BRZQL/iugAFAIPB8IPMteKqJ8luirthUCCoHnAgFFlM/FaVKdVAgoBJ4lAooonyX6qm2FgELguUDgLlE+F71VnVQIKAQUAs8AAUWUzwB01aRCQCHwfCGgiPL5Ol+qtwoBhcAzQCC0iPIZAKCaVAgoBBQCD0JAEeWDEFLlCgGFwIJHQBHlgv8KKAAUAgqBByGgiHISQipDIaAQUAhMREAR5UQ81J5CQCGgEJiEgCLKSZCoDIWAQkAhMBEBRZQT8QiVPdUPhYBCIIQQUEQZQidDdUUhoBAITQQUUYbmeVG9UggoBEIIAUWUIXQyQq0rqj8KAYXACAKKKEdwUJ8KAYWAQmBaBBRRTguNKlAIKAQUAiMIKKIcwUF9hioCql8KgRBAQBFlCJwE1QWFgEIgtBFQRBna50f1TiGgEAgBBBRRhsBJUF0IdQRU/xY6AoooF/o3QI1fIaAQeCACiigfCJGqoBBYGAh4vX40tXbD6/MvjAE/xCgVUT4EWKqqQuAZIvBEm27t6MPZy+UwyAhWi/FE23oehROW57Hbqs8KAYXAXCFQUdmKr78vREpSNOJjI+dK7LySo4hyXp1ONRiFwMMhcLmwGp8evoo1y1ORnZnwcAcvoNqKKBfQyVZDVQiMIRBEED+cK8XXR29gbUEGVq/IGCuacb1QCxVRLtQzr8a9YBEYGBzGF99ex8nvS5C/LAU7Ni5dsFjMduCKKGeLlKqnEJgHCHT1DOCjQ1fR3t2HX/5iM17fuwpWqwrePOjUKqJ8EEKqXCEwTxDo6OzDx19fRmfXAH52YC1yspNgs1mev9E9gx4ronwGoKsmFQJPG4GW1m787ZvLaKjvRFSECxFhzqfdhee6PUWUz/XpU51XCMwOAV3XECnkSDPbaTPg96tJ5bNDbqSWIsoRHNSnQmBeIhAMjgwrLjYCr724EokRYdi8JpN+SWVyjyAzu8/JRDm741QthYBCIMQRKK9qQXll091eBsiam9ZnIiMt7m6e2pgdAoooZ4eTqqUQeK4QkOh2d3c/6pu7cfVmNW7eqkNhSR2WZiVCzPDnajAh0FlFlFlCFwElQXFAJziYDfH0BdYxcq6ztw8WYtDp0sxpff30RsdBjC3I65bGrByApRolww+KuBKgTmHIHK2jZ89X0hblW0AIEA/4PIWRyP3KykOW9roQhURLlQzrQa54JBICLMgbTkKAZsDAwN++B22LFtXRYMeTTQgkFhbgeqiHJu8VTSFALPBAGPx4e+/iH0Dwyj8FY9kuMisH1tJl7cmoN3Dq5GcmLUM+nXfGlUEeX0Z1KVKASeCwR8Pj8OnyzCn/5xgUGbWhSXNeLMxQq0dQ1i6/psZKTGPhfjCOVOKqIM5bOj+qYQeAAC8lTyk2dLcZ1aZEfvAAaoUcbHRwCGhtmVLaiiv/IBIlTxLBBQRDkLkFQVhUCoItDdO4jiimYYFh3iguwe8CDCzsj2sB/QAJk7CbU8NgKKKB8bwicrQElXCMyEQEyU27zjxuWwwcG0Jj8DL+1Yhg3rMpGRFI3F6Wpy+Uz4zbZMn21FVU8hoBAIPQRk8riQYUZiNOIiXFhEf6TNbsELm5bihQ1Z0DQt9Dr9CD0KBkfvxXyEY+fiEEWUc4GikqEQeMYIOJw21DR14VpxLeobulBYUo+Y6LBn3KtHbz4QCKCzqx89dC00NHdB7jR6dGmPf6QiysfHcP5LUCMMaQSEUGqaOgBdwzcnivD//OkU+umrdNitId3v8Z0TjVGmNxWXNeCr727g8PEiVNe1YWjYYz4SLjrSPb76U99WRPnUIVcNKgQeHYGfLpWjrLIZMm9yeNiL1rZe1DV2YnDQA6/Hx4COBt1lRfaSRITyIv3v7RtELft+6nwZ/vjpefzj0BVcu1lDvg9iyaI4FOSlIyEuEmFu+zMfiiLKZ34KVAcUArNDQCaSl1a0oKGpE3/96iL+/vUl/H8fnzPnTW5atQjrVqSTVBxISYhAcnz47IQ+xVqDQx7UNrSjpa0HV29W4dNvr+K7U0UoohY5OORFVLgLu7ctx8GXVmHZ0mTouv4UezdzU6HTk5n7qUoXPAILG4Cmlm5culKFnMUJKKtpR1V9JxpaehDgX0VtG+Kj3Xj1pQK8ujsfedlJZgQ8FBATrVc0x+Lb9ThKUvzyaCEuXa9CW0c//PRDpiVG4qWtufj1Wxvx5v7VSE6IDIVuT+qDIspJkKgMhUDoIeBgJHvXtqVoG310WoTLBpvVgNXQYTEM9A4MQ5aE2DBkpETL5jNLQ3QJNJLYL16rxA/nbpMgi6n1NtGk1pGbFW8+XV3uJlqbn4b1qxcje0kS3K5nb17PBJgiypnQUWUKgWeMgM8XQB9JMCrSjcWLEqDLLJlAEB6fn4EOH4a9fsjMmTOXK/Hx55dw8lw5YmPCnkmvu3sGzDuB5GHBpWX1ZqTa6/OZk941TYOXfa5v6oGMZWVeGn2QGYiJCoP2THr7cI0qonw4vFTthY3AUx99WVUzPv72Gurolywub0R8XDg2FGTAabciPSUG6amxsF09DOYU1zegCb6/2zWp/eaByHxy4U1+PK76zh88iauFFahvLKFGq6HGq+FROiG22FDDYM2wogvbMzGlnVZWJKREFI+yAedWEWUD0JIlSsEniECjc1dqKlqwV8+v4gvjt7Aj5fvQJTKt15ehfdfX48P3lhvvgNHumijOZ6eFPnECShAjVZeM3H2cjnOM529cgfXSxvR3N6H9q5BdPUOoYXbV2/V48L1GgzSFN+1aSl2b87FkkXxsFgM6e5zlfTnqreqswqBBYLAsMeH81cq4HLasCw3xSRHQ9fg8/pws6wJ0dFh0A0dmqbR75cEp80CWumIjHA+MYR6+4YYra7BiTMlOPR9EX66Uon+AQ+y0mIQHWYnIfrQSZLs6Bk0yTAm3AW5tXIj/ZBrVmQgOsr9xPr2pAXrT7oBJV8hoBB4eATK77Tg8LEiXCysNYMz71NzfGnbMojJLb6+krJGU6hM1L59pxnd/cMI+APm5GyzYA4/mlu78eOFMvzp8wv48sgNNDLanp4WBcNiQUS4A06HBdGRTgZrNFhI5r0kT4fDir0v5OKDtzZAXARz2J1nIkoR5TOBXTWqEJgeAblDpa6hy6zQ0zeIQpq1SfERyFmSADuj31aS0Y8Xy/HRN5fx0VeX8OOlO0hOiMBylsfHhJnHzcVHR/cASknCXxwrxPHTt9BDbTEpKQJhbhscNhvs1Gh7egdQR+IMY9Q6EAjQNzmMzNQYbF6dieTEaDid9rnoyjOXoT/zHqgOKAQUAncRkBeDtbR1I42+xjiSo5X+vJ6efvyNhPjZkWvo7RuG1WpQewziTnUbypgMQ8PBXfl497X1jHiH43EW0VaraltRfqcJJ86WonOrDxnsiwSR0hLDIf2prO/E1ZI6DHq8jL4H4aTZ76VLIDbKxUBTJn5+YA0WzbNX4iqifGxVLgLu7ctx8GXVmHZ0mTouv4UezdzU6HTk5n7qUoXPAILG4Cmlm5culKFnMUJKKtpR1V9JxpaehDgX0VtG+Kj3Xj1pQK8ujsfedlJZgQ8FBATrVc0x+Lb9ThKUvzyaCEuXa9CW0c//PRDpiVG4qWtufj1Wxvx5v7VSE6IDIVuT+qDIspJkKgMhUDoIeBgJHvXtqVoG310WoTLBpvVgNXQYTEM9A4MQ5aE2DBkpETL5jNLQ3QJNJLYL16rxA/nbpMgi6n1NtGk1pGbFW8+XV3uJlqbn4b1qxcje0kS3K5nb17PBJgiypnQUWUKgWeMgM8XQB9JMCrSjcWLEqDLLJlAEB6fn4EOH4a9fsjMmTOXK/Hx55dw8lw5YmPCnkmvu3sGzDuB5GHBpWX1ZqTa6/OZk941TYOXfa5v6oGMZWVeGn2QGYiJCoP2THr7cI0qonw4vFTthY3AUx99WVUzPv72Gurolywub0R8XDg2FGTAabciPSUG6amxsF09DOYU1zegCb6/2zWp/eaByHxy4U1+PK76zh88iauFFahvLKFGq6HGq+FROiG22FDDYM2wogvbMzGlnVZWJKREFI+yAedWEWUD0JIlSsEniECjc1dqKlqwV8+v4gvjt7Aj5fvQJTKt15ehfdfX48P3lhvvgNHumijOZ6eFPnECShAjVZeM3H2cjnOM529cgfXSxvR3N6H9q5BdPUOoYXbV2/V48L1GgzSFN+1aSl2b87FkkXxsFgM6e5zlfTnqreqswqBBYLAsMeH81cq4HLasCw3xSRHQ9fg8/pws6wJ0dFh0A0dmqbR75cEp80CWumIjHA+MYR6+4YYra7BiTMlOPR9EX66Uon+AQ+y0mIQHWYnIfrQSZLs6Bk0yTAm3AW5tXIj/ZBrVmQgOsr9xPr2pAXrT7oBJV8hoBB4eATK77Tg8LEiXCysNYMz71NzfGnbMojJLb6+krJGU6hM1L59pxnd/cMI+APm5GyzYA4/mlu78eOFMvzp8wv48sgNNDLanp4WBcNiQUS4A06HBdGRTgZrNFhI5r0kT4fDir0v5OKDtzZAXARz2J1nIkoR5TOBXTWqEJgeAblDpa6hy6zQ0zeIQpq1SfERyFmSADuj31aS0Y8Xy/HRN5fx0VeX8OOlO0hOiMBylsfHhJnHzcVHR/cASknCXxwrxPHTt9BDbTEpKQJhbhscNhvs1Gh7egdQR+IMY9Q6EAjQNzmMzNQYbF6dieTEaDid9rnoyjOXoT/zHqgOKAQUAncRkBeDtbR1I42+xjiSo5X+vJ6efvyNhPjZkWvo7RuG1WpQewziTnUbypgMQ8PBXfl497X1jHiH43EW0VaraltRfqcJJ86WonOrDxnsiwSR0hLDIf2prO/E1ZI6DHq8jL4H4aTZ76VLIDbKxUBTJn5+YA0WzbNX4iqifGxVLgLu7ctx8GXVmHZ0mTouv4UezdzU6HTk5n7qUoXPAILG4Cmlm5culKFnMUJKKtpR1V9JxpaehDgX0VtG+Kj3Xj1pQK8ujsfedlJZgQ8FBATrVc0x+Lb9ThKUvzyaCEuXa9CW0c//PRDpiVG4qWtufj1Wxvx5v7VSE6IDIVuT+qDIspJkKgMhUDoIeBgJHvXtqVoG310WoTLBpvVgNXQYTEM9A4MQ5aE2DBkpETL5jNLQ3QJNJLYL16rxA/nbpMgi6n1NtGk1pGbFW8+XV3uJlqbn4b1qxcje0kS3K5nb17PBJgiypnQUWUKgWeMgM8XQB9JMCrSjcWLEqDLLJlAEB6fn4EOH4a9fsjMmTOXK/Hx55dw8lw5YmPCnkmvu3sGzDuB5GHBpWX1ZqTa6/OZk941TYOXfa5v6oGMZWVeGn2QGYiJCoP2THr7cI0qonw4vFTthY3AUx99WVUzPv72Gurolywub0R8XDg2FGTAabciPSUG6amxsF09DOYU1zegCb6/2zWp/eaByHxy4U1+PK76zh88iauFFahvLKFGq6HGq+FROiG22FDDYM2wogvbMzGlnVZWJKREFI+yAedWEWUD0JIlSsEniECjc1dqKlqwV8+v4gvjt7Aj5fvQJTKt15ehfdfX48P3lhvvgNHumijOZ6eFPnECShAjVZeM3H2cjnOM529cgfXSxvR3N6H9q5BdPUOoYXbV2/V48L1GgzSFN+1aSl2b87FkkXxsFgM6e5zlfTnqreqswqBBYLAsMeH81cq4HLasCw3xSRHQ9fg8/pws6wJ0dFh0A0dmqbR75cEp80CWumIjHA+MYR6+4YYra7BiTMlOPR9EX66Uon+AQ+y0mIQHWYnIfrQSZLs6Bk0yTAm3AW5tXIj/ZBrVmQgOsr9xPr2pAXrT7oBJV8hoBB4eATK77Tg8LEiXCysNYMz71NzfGnbMojJLb6+krJGU6hM1L59pxnd/cMI+APm5GyzYA4/mlu78eOFMvzp8wv48sgNNDLanp4WBcNiQUS4A06HBdGRTgZrNFhI5r0kT4fDir0v5OKDtzZAXARz2J1nIkoR5TOBXTWqEJgeAblDpa6hy6zQ0zeIQpq1SfERyFmSADuj31aS0Y8Xy/HRN5fx0VeX8OOlO0hOiMBylsfHhJnHzcVHR/cASknCXxwrxPHTt9BDbTEpKQJhbhscNhvs1Gh7egdQR+IMY9Q6EAjQNzmMzNQYbF6dieTEaDid9rnoyjOXoT/zHqgOKAQUAncRkBeDtbR1I42+xjiSo5X+vJ6efvyNhPjZkWvo7RuG1WpQewziTnUbypgMQ8PBXfl497X1jHiH43EW0VaraltRfqcJJ86WonOrDxnsiwSR0hLDIf2prO/E1ZI6DHq8jL4H4aTZ76VLIDbKxUBTJn5+YA0WzbNX4iqifGxVLgLu7ctx8GXVmHZ0mTouv4UezdzU6HTk5n7qUoXPAILG4Cmlm5culKFnMUJKKtpR1V9JxpaehDgX0VtG+Kj3Xj1pQK8ujsfedlJZgQ8FBATrVc0x+Lb9ThKUvzyaCEuXa9CW0c//PRDpiVG4qWtufj1Wxvx5v7VSE6IDIVuT+qDIspJkKgMhUDoIeBgJHvXtqVoG310WoTLBpvVgNXQYTEM9A4MQ5aE2DBkpETL5jNLQ3QJNJLYL16rxA/nbpMgi6n1NtGk1pGbFW8+XV3uJlqbn4b1qxcje0kS3K5nb17PBJgiypnQUWUKgWeMgM8XQB9JMCrSjcWLEqDLLJlAEB6fn4EOH4a9fsjMmTOXK/Hx55dw8lw5YmPCnkmvu3sGzDuB5GHBpWX1ZqTa6/OZk941TYOXfa5v6oGMZWVeGn2QGYiJCoP2THr7cI0qonw4vFTthY3AUx99WVUzPv72Gurolywub0R8XDg2FGTAabciPSUG6amxsF09DOYU1zegCb6/2zWp/eaByHxy4U1+PK76zh88iauFFahvLKFGq6HGq+FROiG22FDDYM2wogvbMzGlnVZWJKREFI+yAedWEWUD0JIlSsEniECjc1dqKlqwV8+v4gvjt7Aj5fvQJTKt15ehfdfX48P3lhvvgNHumijOZ6eFPnECShAjVZeM3H2cjnOM529cgfXSxvR3N6H9q5BdPUOoYXbV2/V48L1GgzSFN+1aSl2b87FkkXxsFgM6e5zlfTnqreqswqBBYLAsMeH81cq4HLasCw3xSRHQ9fg8/pws6wJ0dFh0A0dmqbR75cEp80CWumIjHA+MYR6+4YYra7BiTMlOPR9EX66Uon+AQ+y0mIQHWYnIfrQSZLs6Bk0yTAm3AW5tXIj/ZBrVmQgOsr9xPr2pAXrT7oBJV8hoBB4eATK77Tg8LEiXCysNYMz71NzfGnbMojJLb6+krJGU6hM1L59pxnd/cMI+APm5GyzYA4/mlu78eOFMvzp8wv48sgNNDLanp4WBcNiQUS4A06HBdGRTgZrNFhI5r0kT4fDir0v5OKDtzZAXARz2J1nIkoR5TOBXTWqEJgeAblDpa6hy6zQ0zeIQpq1SfERyFmSADuj31aS0Y8Xy/HRN5fx0VeX8OOlO0hOiMBylsfHhJnHzcVHR/cASknCXxwrxPHTt9BDbTEpKQJhbhscNhvs1Gh7egdQR+IMY9Q6EAjQNzmMzNQYbF6dieTEaDid9rnoyjOXoT/zHqgOKAQUAncRkBeDtbR1I42+xjiSo5X+vJ6efvyNhPjZkWvo7RuG1WpQewziTnUbypgMQ8PBXfl497X1jHiH43EW0VaraltRfqcJJ86WonOrDxnsiwSR0hLDIf2prO/E1ZI6DHq8jL4H4aTZ76VLIDbKxUBTJn5+YA0WzbNX4iqifGxVLgLu7ctx8GXVmHZ0mTouv4UezdzU6HTk5n7qUoXPAILG4Cmlm5culKFnMUJKKtpR1V9JxpaehDgX0VtG+Kj3Xj1pQK8ujsfedlJZgQ8FBATrVc0x+Lb9ThKUvzyaCEuXa9CW0c//PRDpiVG4qWtufj1Wxvx5v7VSE6IDIVuT+qDIspJkKgMhUDoIeBgJHvXtqVoG310WoTLBpvVgNXQYTEM9A4MQ5aE2DBkpETL5jNLQ3QJNJLYL16rxA/nbpMgi6n1NtGk1pGbFW8+XV3uJlqbn4b1qxcje0kS3K5nb17PBJgiypnQUWUKgWeMgM8XQB9JMCrSjcWLEqDLLJlAEB6fn4EOH4a9fsjMmTOXK/Hx55dw8lw5YmPCnkmvu3sGzDuB5GHBpWX1ZqTa6/OZk941TYOXfa5v6oGMZWVeGn2QGYiJCoP2THr7cI0qonw4vFTthY3AUx99WVUzPv72Gurolywub0R8XDg2FGTAabciPSUG6amxsF09DOYU1zegCb6/2zWp/eaByHxy4U1+PK76zh88iauFFahvLKFGq6HGq+FROiG22FDDYM2wogvbMzGlnVZWJKREFI+yAedWEWUD0JIlSsEniECjc1dqKlqwV8+v4gvjt7Aj5fvQJTKt15ehfdfX48P3lhvvgNHumijOZ6eFPnECShAjVZeM3H2cjnOM529cgfXSxvR3N6H9q5BdPUOoYXbV2/V48L1GgzSFN+1aSl2b87FkkXxsFgM6e5zlfTnqreqswqBBYLAsMeH81cq4HLasCw3xSRHQ9fg8/pws6wJ0dFh0A0dmqbR75cEp80CWumIjHA+MYR6+4YYra7BiTMlOPR9EX66Uon+AQ+y0mIQHWYnIfrQSZLs6Bk0yTAm3AW5tXIj/ZBrVmQgOsr9xPr2pAXrT7oBJV8hoBB4eATK77Tg8LEiXCysNYMz71NzfGnbMojJLb6+krJGU6hM1L59pxnd/cMI+APm5GyzYA4/mlu78eOFMvzp8wv48sgNNDLanp4WBcNiQUS4A06HBdGRTgZrNFhI5r0kT4fDir0v5OKDtzZAXARz2J1nIkoR5TOBXTWqEJgeAblDpa6hy6zQ0zeIQpq1SfERyFmSADuj31aS0Y8Xy/HRN5fx0VeX8OOlO0hOiMBylsfHhJnHzcVHR/cASknCXxwrxPHTt9BDbTEpKQJhbhscNhvs1Gh7egdQR+IMY9Q6EAjQNzmMzNQYbF6dieTEaDid9rnoyjOXoT/zHqgOKAQUAncRkBeDtbR1I42+xjiSo5X+vJ6efvyNhPjZkWvo7RuG1WpQewziTnUbypgMQ8PBXfl497X1jHiH43EW0VaraltRfqcJJ86WonOrDxnsiwSR0hLDIf2prO/E1ZI6DHq8jL4H4aTZ76VLIDbKxUBTJn5+YA0WzbNX4iqifGxVLgLu7ctx8GXVmHZ0mTouv4UezdzU6HTk5n7qUoXPAILG4Cmlm5culKFnMUJKKtpR1V9JxpaehDgX0VtG+Kj3Xj1pQK8ujsfedlJZgQ8FBATrVc0x+Lb9ThKUvzyaCEuXa9CW0c//PRDpiVG4qWtufj1Wxvx5v7VSE6IDIVuT+qDIspJkKgMhUDoIeBgJHvXtqVoG310WoTLBpvVgNXQYTEM9A4MQ5aE2DBkpETL5jNLQ3QJNJLYL16rxA/nbpMgi6n1NtGk1pGbFW8+XV3uJlqbn4b1qxcje0kS3K5nb17PBJgiypnQUWUKgWeMgM8XQB9JMCrSjcWLEqDLLJlAEB6fn4EOH4a9fsjMmTOXK/Hx55dw8lw5YmPCnkmvu3sGzDuB5GHBpWX1ZqTa6/OZk941TYOXfa5v6oGMZWVeGn2QGYiJCoP2THr7cI0qonw4vFTthY3AUx99WVUzPv72Gurolywub0R8XDg2FGTAabciPSUG6amxsF09DOYU1zegCb6/2zWp/eaByHxy4U1+PK76zh88iauFFahvLKFGq6HGq+FROiG22FDDYM2wogvbMzGlnVZWJKREFI+yAedWEWUD0JIlSsEniECjc1dqKlqwV8+v4gvjt7Aj5fvQJTKt15ehfdfX48P3lhvvgNHumijOZ6eFPnECShAjVZeM3H2cjnOM529cgfXSxvR3N6H9q5BdPUOoYXbV2/V48L1GgzSFN+1aSl2b87FkkXxsFgM6e5zlfTnqreqswqBBYLAsMeH81cq4HLasCw3xSRHQ9fg8/pws6wJ0dFh0A0dmqbR75cEp80CWumIjHA+MYR6+4YYra7BiTMlOPR9EX66Uon+AQ+y0mIQHWYnIfrQSZLs6Bk0yTAm3AW5tXIj/ZBrVmQgOsr9xPr2pAXrT7oBJV8hoBB4eATK77Tg8LEiXCysNYMz71NzfGnbMojJLb6+krJGU6hM1L59pxnd/cMI+APm5GyzYA4/mlu78eOFMvzp8wv48sgNNDLanp4WBcNiQUS4A06HBdGRTgZrNFhI5r0kT4fDir0v5OKDtzZAXARz2J1nIkoR5TOBXTWqEJgeAblDpa6hy6zQ0zeIQpq1SfERyFmSADuj31aS0Y8Xy/HRN5fx0VeX8OOlO0hOiMBylsfHhJnHzcVHR/cASknCXxwrxPHTt9BDbTEpKQJhbhscNhvs1Gh7egdQR+IMY9Q6EAjQNzmMzNQYbF6dieTEaDid9rnoyjOXoT/zHqgOKAQUAncRkBeDtbR1I42+xjiSo5X+vUednqqbIYSQYDSXlTbhyswZXmW6U1KG4rAFCiEUkxcuFNRxDOb44dgN//vwCvjpeiLaOfvPHQSaMW60G9u9YjqT4iLtNDAwO04frhzzMQzItFgM1DR34+Nur+IjYPEr665eXcPhkMUR7FZljaey2Sg+1bTv7UttUxXNwiW1dwdFTxbPD6KdSlFdO/1CMsbamWoetWwFLXCQGyybPV3SuXGoSaYC+XPMXdQoBwaAPwYB/ipLJWbrLiagDOxH99l62GYWgvLBsJj/ofSI0hw3e+lb0HD+PoPlk9PsqLKBdRZRP6WSLprT3heXYs3kpLJpOzc8LQ9cgQZ5KBnjO0DQVDfCH8yNkeYpkdvpiBS6ReNq6BiAkEiDBgmaUfxoNdMOqTGxYtYiyfSYhWyi/u3cIpXdaIPdZi8wfKHfaRJL8gSRw/73YAV5cAWpAOuVJn29VNOPID8U4+mOJuf7m+E18c+ImDnEtwZhT52/jRkk9Tds+U3vz83jxOcZHh+OdV9ZgWXbyBNQNwyC5Y0Sz1gA2w2P7IbhUMwr+KEmOLWY/5S2N4xsT7X43z4G0OTDkJfEDQqaVte04f60K0vdp8RnDjhjdmuExa+Pbm7St6wiTKUEkLX/PyJsax+poxCF81wZY42IQnHLKkMaqAWqHw1zP/l9umYx9/1W41uaZAZpZa5f8ZdTorxy4XIz+c4Wzb3Ae1lRE+RRPqs6LZOv6bPzqrfVYtTzdNEGF/PwkP53soOk6dK4Ng2uLDs3ghUGCkikyg0M+s6dhYTbERLjM7fs/RBM7sHsF5KEUcj+27HuoYQrR6ZSlU6aVsi33JUPXYbBdTWN7FCp94sr815kfFxsGH8mut98DSR7210vSHuZ6iPJlQvgggy8D3DbbCwAiSTS2iDAnFmfE4SCDMr99ZxPN6Tjcv4ivMm9xImwWi0nyPQMeRr59JLDAIydQqzasOn2ROu5fVuWlakaTQLmY/hL/4Z/gK/7Z/tW4Y//H/tW/9Xn994/hN/97P/hW/9f/+V//9yP0nB1/27vNl/p3V2L86E1vXLMF2mv5f/r4Qb+3Lxca1y/HLX27Gez/djN+9s9Fk1G/e3oD3f7oF77+5Ebt3FMAU7Vz09g//u904VbU4L64X06C5T2f7WnI0XnqxAO/tXY039qzEr94uwC9eXI0XNixFRmokhL2h0RwnxUUgKz0e2zdm4c1XVuPnb67HRz/bgv//d5uRejTefpL4EwK29tIkeEky1n/tBw3Q41YnU3oH/gYwNUR7fFh8ej57vjkKP19/WNywFexiAh+0rQOAYtPAs0GN3wK+vBex976B/D9Cnz+N3wNce3vX6P/v8Wb/7s9Hn8TveZ/gYf/P4H7b/f7oZ8P3v//G/4Wf//8j5Gv3v/vF9d/T5/jF8/W98E/m4Z+q+5v7H+Mff7n/rG+419H9D/gZ6x+fJqX3Xv+Z/51rAP4B7Wvj77v0Z9HfC97v3ZtF77s/gZtA0YI7pGkCjKRs0N+B/QOIB+tqH0XfsArzNZv/f894/I/+N7cZ4j9L3e4fHj3e0N3T3tPD33TvK6bY1M/9rT/4Zg+VvQ6NZGkPQpYfO13tP/vG/4Wf/f6d7Y48Wj2y8PzvC//q/Wd3393QzoM8/tWbvD7Fp/3e098N1D30eZp/j32P+N/Z6gNn/3v8drnt4/HhH7/9t6O/uPXzO+8ff5v+t9/D3nZ/B5/Gz/nv4hP7r//F9d/T5v/F9R5/x93D3Pf8zVtfzP2P+NzCgzz+1Zu8PsWn/d7T3w9P0O0eCexiAh8WPe/eM3/Yv7wV8H34+G/q8/ofvP/p8Hv+/Z3yNv93/7vP9d/T5v/F9R5/j/cZq9Dvf/xvff3r997/7x/fd0+f7p+j/+bPhZ/8zH+Nn9L//wfvvdP/u9N3/2dDfeP8d/Rvff//P/n9Pf2P8zfb3/nvff6ebv//P/u+d7o3t9Dvv39PX/sbf7n9v6HP9d//u+f5p+nz/GL7+N76JfNyz9P//Dx5Fv3e/3f/WM9xr6P+G/A30js/0jvX/A/4fMNDP/wP2vvdP0/e7P4P+Tvj3kH/nWsA/gHtav9+9P4P+Tvj3Pv/WGPj/AcWf8d/jxwAAAABJRU5CYII=";
        doc.addImage(logoBase64, 'PNG', 15, 6, 32, 19);
    } catch (err) {
        console.warn("Logo yüklenirken hata oluştu:", err);
    }

    // SINAV TUTANAĞI Başliği
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(60, 60, 60);
    doc.text("SINAV TUTANAĞI", 105, 17, { align: "center" });

    // Üst Tablo (Sinav Detaylari)
    doc.autoTable({
        startY: startY,
        margin: { left: 15, right: 15 },
        body: [
            [{ content: 'Tarih', styles: { fontStyle: 'bold', fillColor: [255, 255, 255] } }, { content: formatDate, colSpan: 3 }],
            [{ content: 'Bölüm/Program/Sinif', styles: { fontStyle: 'bold', fillColor: [255, 255, 255] } }, { content: deptStr, colSpan: 3 }],
            [{ content: 'Ders Adi', styles: { fontStyle: 'bold', fillColor: [255, 255, 255] } }, { content: cleanStr(examName), colSpan: 3 }],
            [
                { content: 'Gözetmen', styles: { fontStyle: 'bold', fillColor: [255, 255, 255] } }, 
                { content: cleanStr(proctorsStr) }, 
                { content: 'İmza', styles: { fontStyle: 'bold', fillColor: [255, 255, 255] } }, 
                { content: '' }
            ]
        ],
        theme: 'grid',
        styles: {
            font: 'Roboto',
            fontSize: 9,
            cellPadding: 2.2,
            textColor: [0, 0, 0],
            lineColor: [0, 0, 0],
            lineWidth: 0.25,
            valign: 'middle'
        },
        columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 85 },
            2: { cellWidth: 15 },
            3: { cellWidth: 45 }
        }
    });

    const topTableFinalY = doc.lastAutoTable.finalY;

    // "Sinava giren öğrencinin" başliği
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text("Sinava giren öğrencinin", 15, topTableFinalY + 4);

    // Boş Tablo Verisi (40 Öğrenci Kapasiteli)
    // Sütun sirasi: Sira No, Adi Soyadi, Numarasi, İmza
    const tableData = [];
    for (let i = 1; i <= 40; i++) {
        tableData.push([i.toString(), "", "", ""]);
    }

    doc.autoTable({
        startY: topTableFinalY + 5.5,
        margin: { left: 15, right: 15 },
        head: [['Sira No', 'Adi, Soyadi', 'Numarasi', 'İmza']],
        body: tableData,
        theme: 'grid',
        styles: {
            font: 'Roboto',
            fontSize: 8.5,
            cellPadding: 1.6,
            valign: 'middle',
            lineColor: [0, 0, 0],
            lineWidth: 0.25,
            textColor: [0, 0, 0]
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineColor: [0, 0, 0],
            lineWidth: 0.25
        },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 85 },
            2: { cellWidth: 45 },
            3: { cellWidth: 35 }
        }
    });

    const studentTableFinalY = doc.lastAutoTable.finalY;

    // Sinava katilim ve not bilgileri
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(9);
    doc.text("Sinava toplam ........................ öğrenci katilmiştir.", 15, studentTableFinalY + 5);

    doc.setFont('Roboto', 'bold');
    doc.text("Not: Sinav tutanaği sinav kâğitlariyla birlikte muhafaza edilecektir.", 15, studentTableFinalY + 9);

    // Sayfa alti kodu (FR-0282)
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text("FR-0282 Yayin Tarihi: 06.11.2017 Değ.No:0 Değ.Tarihi:-", 15, 288);

    // Dosyayi İndir
    const replaceTRForFilename = (str) => {
        const trMap = {
            'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'i': 'i', 'İ': 'I',
            'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
        };
        return str.replace(/[çÇğĞiİöÖşŞüÜ]/g, m => trMap[m]).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
    };
    
    const filename = `Yoklama_${replaceTRForFilename(examName).toLowerCase().replace(/\s+/g, '_')}_${formatDate}.pdf`;
    doc.save(filename);
};

/**
 * Tema Kontrolü
 */
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = isDark ? '🌙' : '☀️';
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function applyTheme() {
    const savedTheme = localStorage.getItem('theme');
    const toggleBtn = document.getElementById('btn-theme-toggle');
    
    // Varsayilan tema artik 'light' (Akademik Tema). Sadece 'dark' ise dark-theme class'i ekle.
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (toggleBtn) toggleBtn.textContent = '🌙';
    } else {
        document.body.classList.remove('dark-theme');
        if (toggleBtn) toggleBtn.textContent = '☀️';
    }
}

/**
 * GÖRSEL SINAV ÇİZELGESİ (TIMELINE) MANTIĞI
 */

function renderTimeline() {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    // Sinavlari tarihe göre filtrele
    const exams = DB.exams.filter(ex => ex.date === currentTimelineDate);
    
    if (exams.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-muted);">
            <div style="font-size:3rem; margin-bottom:1rem;">📅</div>
            <p>Bu tarihte (${currentTimelineDate.split('-').reverse().join('.')}) kayitli sinav bulunmuyor.</p>
        </div>`;
        return;
    }

    // Odalara göre grupla
    const roomGroups = {};
    exams.forEach(ex => {
        const loc = ex.location || "Belirsiz";
        if (!roomGroups[loc]) roomGroups[loc] = [];
        roomGroups[loc].push(ex);
    });

    const startHour = 8;
    const endHour = 21;
    const totalHours = endHour - startHour;

    const timeToPx = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        const totalMinutes = (h - startHour) * 60 + (m || 0);
        const percent = (totalMinutes / (totalHours * 60)) * 100;
        return Math.max(0, Math.min(100, percent));
    };

    let html = `<div class="timeline-grid">`;
    
    // Saat Başliklari
    html += `<div class="timeline-header-hours">`;
    for (let i = startHour; i <= endHour; i++) {
        html += `<div class="hour-mark">${String(i).padStart(2, '0')}:00</div>`;
    }
    html += `</div>`;

    // "Şimdi" İşaretçisi
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (currentTimelineDate === todayStr) {
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        if (currentHour >= startHour && currentHour < endHour) {
            const left = timeToPx(`${currentHour}:${currentMin}`);
            html += `<div class="timeline-now-marker" style="left: calc(180px + ${left}%)"></div>`;
        }
    }

    // Satirlar (Derslikler)
    Object.entries(roomGroups).forEach(([room, roomExams]) => {
        html += `<div class="timeline-row">
            <div class="timeline-room-label">
                <div class="room-name">${room}</div>
                <div class="room-capacity">${roomExams.length} Sinav</div>
            </div>
            <div class="timeline-content-area">`;
        
        roomExams.forEach(ex => {
            const left = timeToPx(ex.time);
            const width = (ex.duration / (totalHours * 60)) * 100;
            
            // Sinav türüne göre renkler
            let blockStyle = "";
            if (ex.type === 'Final') blockStyle = "background: linear-gradient(135deg, #ef4444, #b91c1c);";
            else if (ex.type === 'Bütünleme') blockStyle = "background: linear-gradient(135deg, #f59e0b, #d97706);";
            
            html += `
                <div class="timeline-block" 
                     style="left: ${left}%; width: ${width}%; ${blockStyle}" 
                     onclick="showExamDetail('${ex.name.replace(/'/g, "\\'")}', '${ex.date}', '${ex.time}', '${ex.location || ''}')">
                    <div class="exam-name">${ex.name}</div>
                    <div class="exam-info">${ex.time} (${ex.duration} dk)</div>
                </div>
            `;
        });

        html += `</div></div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

/**
 * BİLDİRİM MERKEZİ MANTIĞI
 */

function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;

    const isHidden = panel.classList.toggle('hidden');
    const badge = document.getElementById('notif-badge');

    if (!isHidden) {
        renderNotifications();
        // Panel açildiğinda tüm bildirimleri görülmüş say (Badge'i gizle ve süreyi kaydet)
        setTimeout(() => {
            localStorage.setItem('lastNotifCheck', Date.now());
            updateNotifBadge();
        }, 500);
    }
}

function getNotifications() {
    const myStaffId = localStorage.getItem('myStaffId');
    const notifs = [];

    // 1. Duyurular ÇIKARTILDI (User isteği)
    
    // 2. Takas Talepleri ve Pazar Yeri (Marketplace) Güncellemeleri
    if (myStaffId) {
        // Pazar Yerindeki Açik Görevler (Initiator ben değilsem ve sinav bitmediyse)
        const openMarketplace = (DB.requests || []).filter(r => 
            r.status === 'open' && 
            String(r.initiatorId) !== String(myStaffId)
        );

        openMarketplace.forEach(req => {
            notifs.push({
                type: 'marketplace',
                title: 'Açik Görev',
                message: `Pazar yerinde yeni bir görev var: "${req.examName}"`,
                time: req.timestamp,
                icon: '🛒'
            });
        });

        // Takas Taleplerim ve Bana Gelenler
        const myRequests = (DB.requests || []).filter(r => 
            (String(r.initiatorId) === String(myStaffId) || String(r.peerId) === String(myStaffId)) && 
            r.status !== 'open'
        );

        myRequests.forEach(req => {
            const isInitiator = String(req.initiatorId) === String(myStaffId);
            let msg = "";
            let icon = "🔄";

            if (req.status === 'approved') {
                msg = `"${req.examName}" takas talebi onaylandi!`;
                icon = "✅";
            } else if (req.status === 'rejected') {
                msg = `"${req.examName}" takas talebi reddedildi.`;
                icon = "❌";
            } else if (req.status === 'pending_peer' && !isInitiator) {
                msg = `Size yeni bir takas teklifi geldi: "${req.examName || 'Bilinmeyen Sinav'}"`;
                icon = "📩";
            }

            if (msg) {
                notifs.push({
                    type: 'request',
                    title: 'Takas Güncellemesi',
                    message: msg,
                    time: req.updatedAt || (req.timestamp + 1),
                    icon: icon
                });
            }
        });

        // 3. Yaklaşan Sinavlar (Sonraki 48 saat içindeki sinavlar)
        const now = Date.now();
        const futureLimit = now + (48 * 60 * 60 * 1000);
        DB.exams.filter(ex => String(ex.proctorId) === String(myStaffId)).forEach(ex => {
            const exDate = getSafeDate(ex.date, ex.time).getTime();
            if (exDate > now && exDate < futureLimit) {
                notifs.push({
                    type: 'exam',
                    title: 'Yaklaşan Görev',
                    message: `Hatirlatma: "${ex.name}" sinavi yaklaşiyor (${ex.date} ${ex.time})`,
                    time: exDate - 1, // Sinavin tam vaktinden bir saniye önce olsun ki listede üstte görünsün
                    icon: '⏳'
                });
            }
        });
    }

    // Tarihe göre yeniden eskiye sirala
    return notifs.sort((a,b) => b.time - a.time);
}

function renderNotifications() {
    const list = document.getElementById('notif-list');
    if (!list) return;

    const notifs = getNotifications();
    const lastCheck = parseInt(localStorage.getItem('lastNotifCheck') || '0');

    if (notifs.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.8rem;">Henüz bildirim yok.</div>`;
        return;
    }

    list.innerHTML = notifs.map(n => {
        const isNew = n.time > lastCheck;
        const timeStr = formatRelativeTime(n.time);
        
        return `
            <div class="notif-item ${isNew ? 'unread' : ''}">
                <div class="notif-icon">${n.icon}</div>
                <div class="notif-content">
                    <div class="notif-message"><strong>${n.title}</strong>: ${n.message}</div>
                    <div class="notif-time">${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');
}

function updateNotifBadge() {
    const badge = document.getElementById('notif-badge');
    const bell = document.getElementById('btn-notifications');
    if (!badge || !bell) return;

    const notifs = getNotifications();
    const lastCheck = parseInt(localStorage.getItem('lastNotifCheck') || '0');
    // Sadece görülmemiş bildirimlerin sayisini al
    const newCount = notifs.filter(n => n.time > lastCheck).length;

    if (newCount > 0) {
        badge.textContent = newCount > 9 ? '9+' : newCount;
        badge.classList.remove('hidden');
        bell.classList.add('pulse-animation');
    } else {
        badge.classList.add('hidden');
        bell.classList.remove('pulse-animation');
    }
}

function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} gün önce`;
    if (hours > 0) return `${hours} saat önce`;
    if (mins > 0) return `${mins} dk önce`;
    return 'Az önce';
}

/**
 * AYLIK TAKVİM MANTIĞI
 */

function renderMonthlyCalendar() {
    const container = document.getElementById('calendar-container');
    const label = document.getElementById('calendar-month-year');
    const subLabel = document.getElementById('calendar-date-label');
    if (!container || !label) return;

    const d = new Date(currentTimelineDate);
    const year = d.getFullYear();
    const month = d.getMonth();

    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasim", "Aralik"];
    label.textContent = `${monthNames[month]} ${year}`;
    if (subLabel) subLabel.textContent = `${monthNames[month]} ayi genel sinav dağilimi`;

    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Monday = 0, ..., Sunday = 6
    const startOffset = (firstDay === 0) ? 6 : firstDay - 1;

    let html = `
        <div class="calendar-grid">
            <div class="calendar-weekday">Pzt</div>
            <div class="calendar-weekday">Sal</div>
            <div class="calendar-weekday">Çar</div>
            <div class="calendar-weekday">Per</div>
            <div class="calendar-weekday">Cum</div>
            <div class="calendar-weekday">Cmt</div>
            <div class="calendar-weekday">Paz</div>
    `;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Padding (Last Month)
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month">
            <div class="day-number">${prevMonthDays - i}</div>
        </div>`;
    }

    // Days (Current Month)
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const dayExams = DB.exams.filter(ex => ex.date === dateStr);

        html += `
            <div class="calendar-day ${isToday ? 'today' : ''}" onclick="showDailyTimeline('${dateStr}')">
                <div class="day-number">${day}</div>
                <div class="calendar-exam-list">
                    ${dayExams.slice(0, 3).map(ex => `
                        <div class="calendar-exam-item" style="${ex.type === 'Final' ? 'background:var(--accent-red)' : ''}">
                            ${ex.time} ${ex.name}
                        </div>
                    `).join('')}
                    ${dayExams.length > 3 ? `<div style="font-size:0.6rem; color:var(--text-muted); margin-top:2px;">+${dayExams.length - 3} Sinav Daha</div>` : ''}
                </div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

function showDailyTimeline(dateStr) {
    currentTimelineDate = dateStr;
    const modal = document.getElementById('modal-daily-detail');
    const title = document.getElementById('daily-detail-title');
    if (modal && title) {
        title.innerHTML = `📅 ${dateStr.split('-').reverse().join('.')} Tarihli Detayli Çizelge`;
        modal.classList.remove('hidden');
        renderTimeline();
    }
}

/**
 * HOCA MESAJI BİLDİRİM ROZETİ (YENİ MESAJ NOKTASI)
 */
function updateMessageBadge() {
    const badge = document.getElementById('notif-badge-messages');
    if (!badge) return;

    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) return;

    const lastChecked = parseInt(localStorage.getItem('lastCheckedMessages') || '0');
    
    // Benim gözetmen olduğum ve yeni veya güncellenmiş notu olan sinavlar
    const hasNewMessage = DB.exams.some(ex => {
        const pIds = ex.proctorIds || [ex.proctorId];
        const isMe = pIds.some(pid => String(pid) === String(myStaffId));
        if (!isMe) return false;
        
        // Not var mi ve son kontrolümüzden sonra mi güncellenmiş?
        return ex.lecturerNote && ex.lecturerNoteTimestamp && ex.lecturerNoteTimestamp > lastChecked;
    });

    if (hasNewMessage) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function clearMessageBadge() {
    localStorage.setItem('lastCheckedMessages', Date.now().toString());
    const badge = document.getElementById('notif-badge-messages');
    if (badge) badge.classList.add('hidden');
}

/**
 * AKILLI TAKAS GÖRÜNÜMÜ (Kusursuz Takas)
 */
window.renderSmartSwaps = function() {
    const myStaffId = localStorage.getItem('myStaffId');
    const container = document.getElementById('profile-smart-swaps');
    const listEl = document.getElementById('smart-swaps-list');
    if (!container || !listEl || !myStaffId) return;

    const matches = findSmartSwaps(myStaffId);
    if (matches.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    listEl.innerHTML = matches.slice(0, 5).map(m => `
        <div class="suggestion-item" style="border-left: 4px solid ${m.priority === 2 ? '#ef4444' : '#8b5cf6'}; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; display: flex; align-items: center; gap: 15px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 0.85rem; color: #f8fafc; display: flex; align-items: center; gap: 8px;">
                    <span style="color: ${m.priority === 2 ? '#f87171' : '#a78bfa'};">${m.reason}</span>
                    <span style="opacity: 0.3;">•</span>
                    <span>${m.myExam.name}</span>
                </div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 5px; line-height: 1.4;">
                    🔄 <strong>${m.otherStaff.name}</strong> hocanin <strong>${m.otherExam.name}</strong> (${m.otherExam.date.split('-').reverse().join('.')} ${m.otherExam.time}) sinavi ile takas edebilirsiniz. Her iki tarafin da programi bu takas için uygundur.
                </div>
            </div>
            <button class="btn-primary" onclick="initiateSmartSwapProposal(${m.myExam.id}, ${m.otherStaff.id}, ${m.otherExam.id})" 
                style="padding: 8px 16px; font-size: 0.75rem; background: ${m.priority === 2 ? '#ef4444' : '#6366f1'}; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Teklif Et</button>
        </div>
    `).join('');
};

window.initiateSmartSwapProposal = async function(myExamId, otherStaffId, otherExamId) {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) return;

    const res = requestSmartSwap(myExamId, otherExamId, otherStaffId, myStaffId);
    if (res.success) {
        alert("✅ Başarili!\n" + res.message);
        renderProfile();
        updateNotificationBadge();
        await saveToBackend();
    } else {
        alert("❌ Hata: " + res.message);
    }
};

/**
 * Şifre Ayarlarini Render Et (Profil Güvenliği)
 */
function renderPasswordSettings(staff) {
    const container = document.getElementById('profile-password-section');
    if (!container) return;

    if (!staff.staffPassword) {
        container.innerHTML = `
            <div class="card-large" style="margin-bottom: 2rem; border: 1px solid #f59e0b66; background: rgba(245, 158, 11, 0.03);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem;">
                    <span style="font-size: 1.5rem;">🔒</span>
                    <h4 style="margin: 0; font-size: 0.9rem; color: #f59e0b; text-transform: uppercase;">Profil Şifreleme</h4>
                </div>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.25rem;">Hesabinizi güvene almak ve başkalarinin profilinize erişmesini engellemek için bir giriş şifresi belirleyebilirsiniz.</p>
                <div style="display: flex; gap: 10px;">
                    <input type="password" id="new-staff-password" placeholder="Yeni Şifre..." style="flex:1; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: 8px; color: white;">
                    <button class="btn-primary" onclick="setStaffPassword()" style="background: #f59e0b;">Şifreyi Kaydet</button>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="card-large" style="margin-bottom: 2rem; border: 1px solid #10b98166; background: rgba(16, 185, 129, 0.03);">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem;">
                    <span style="font-size: 1.5rem;">✅</span>
                    <h4 style="margin: 0; font-size: 0.9rem; color: #10b981; text-transform: uppercase;">Hesabiniz Güvende</h4>
                </div>
                <p style="font-size: 0.8rem; color: var(--text-muted);">Sistem şifreniz aktif. Şifrenizi değiştirmek veya kaldirmak için yönetici ile iletişime geçebilirsiniz.</p>
            </div>
        `;
    }
}

window.setStaffPassword = async function() {
    const input = document.getElementById('new-staff-password');
    const pass = input ? input.value.trim() : '';
    if (!pass) return alert("Lütfen bir şifre girin.");

    const myStaffId = localStorage.getItem('myStaffId');
    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) return;

    if (confirm("Profilinizi bu şifre ile korumak istediğinize emin misiniz? Bir sonraki girişte bu şifre sorulacaktir.")) {
        staff.staffPassword = pass;
        saveToLocalStorage();
        renderProfile();
        await saveToBackend();
        alert("✅ Şifreniz başariyla kaydedildi.");
    }
};

/**
 * AKILLI TAKAS ONAYLAMA / REDDETME
 */
window.acceptSmartSwap = async function(requestId) {
    const reqIndex = DB.requests.findIndex(r => String(r.id) === String(requestId));
    if (reqIndex === -1) return;
    const req = DB.requests[reqIndex];

    const myExam = DB.exams.find(e => String(e.id) === String(req.targetExamId));
    const hisExam = DB.exams.find(e => String(e.id) === String(req.examId));
    const me = DB.staff.find(s => String(s.id) === String(req.receiverId));
    const him = DB.staff.find(s => String(s.id) === String(req.initiatorId));

    if (!myExam || !hisExam || !me || !him) {
        alert("Hata: Sinav veya personel bilgisi bulunamadi!");
        return;
    }

    if (confirm("Bu akilli takas teklifini kabul etmek istiyor musunuz? Sinav görevleriniz karşilikli olarak değiştirilecektir.")) {
        // Puan ve görev sayilarini güncelle – nonExam/exam ayrimina göre (Önce eskileri çikar)
        if (shouldCountAsNonExam(myExam)) {
            me.nonExamScore = Math.max(0, parseFloat(((me.nonExamScore || 0) - myExam.score).toFixed(2)));
            me.nonExamTaskCount = Math.max(0, (me.nonExamTaskCount || 0) - 1);
        } else {
            me.totalScore = Math.max(0, parseFloat((me.totalScore - myExam.score).toFixed(2)));
            me.taskCount = Math.max(0, me.taskCount - 1);
        }
        if (shouldCountAsNonExam(hisExam)) {
            him.nonExamScore = Math.max(0, parseFloat(((him.nonExamScore || 0) - hisExam.score).toFixed(2)));
            him.nonExamTaskCount = Math.max(0, (him.nonExamTaskCount || 0) - 1);
        } else {
            him.totalScore = Math.max(0, parseFloat((him.totalScore - hisExam.score).toFixed(2)));
            him.taskCount = Math.max(0, him.taskCount - 1);
        }

        // Şimdi karşilikli ata
        myExam.proctorId = him.id;
        myExam.proctorIds = [him.id];
        myExam.proctorName = him.name;
        
        hisExam.proctorId = me.id;
        hisExam.proctorIds = [me.id];
        hisExam.proctorName = me.name;

        // Yeni puanlari ekle
        if (shouldCountAsNonExam(hisExam)) {
            me.nonExamScore = parseFloat(((me.nonExamScore || 0) + hisExam.score).toFixed(2));
            me.nonExamTaskCount = (me.nonExamTaskCount || 0) + 1;
        } else {
            me.totalScore = parseFloat((me.totalScore + hisExam.score).toFixed(2));
            me.taskCount += 1;
        }
        if (shouldCountAsNonExam(myExam)) {
            him.nonExamScore = parseFloat(((him.nonExamScore || 0) + myExam.score).toFixed(2));
            him.nonExamTaskCount = (him.nonExamTaskCount || 0) + 1;
        } else {
            him.totalScore = parseFloat((him.totalScore + myExam.score).toFixed(2));
            him.taskCount += 1;
        }

        // Talebi tamamlandi olarak işaretle ve kaldir
        DB.requests.splice(reqIndex, 1);
        
        // Bildirim gönder
        if (!DB.notifications) DB.notifications = {};
        if (!Array.isArray(DB.notifications[him.id])) DB.notifications[him.id] = [];
        DB.notifications[him.id].unshift({
            id: Date.now(),
            message: `✅ **Takas Onaylandi:** ${me.name}, gönderdiğin akilli takas teklifini kabul etti!`,
            type: 'swap_approved',
            createdAt: new Date().toISOString(),
            isRead: false
        });

        saveToLocalStorage();
        renderProfile();
        updateNotifBadge();
        
        // Webhook ve E-posta bildirimi tetikle
        dispatchNotificationEvent('swap_accepted', {
            initiatorName: him.name,
            initiatorId: him.id,
            receiverName: me.name,
            receiverId: me.id,
            examName: hisExam.name,
            secondExamName: myExam.name,
            swapType: 'smart_swap'
        });

        await saveToBackend();
        
        alert("✅ Takas başariyla gerçekleştirildi!");
    }
};

window.rejectSmartSwap = async function(requestId) {
    const reqIndex = DB.requests.findIndex(r => String(r.id) === String(requestId));
    if (reqIndex === -1) return;
    const req = DB.requests[reqIndex];

    if (confirm("Bu takas teklifini reddetmek istediğinize emin misiniz?")) {
        // Talebi kaldir
        const removed = DB.requests.splice(reqIndex, 1)[0];
        
        saveToLocalStorage();
        renderProfile();
        updateNotifBadge();
        
        // Webhook ve E-posta bildirimi tetikle
        dispatchNotificationEvent('swap_rejected', {
            initiatorName: req.initiatorName,
            initiatorId: req.initiatorId,
            receiverName: req.receiverName,
            examName: 'Akilli Takas Teklifi'
        });

        await saveToBackend();
        alert("✅ Teklif reddedildi.");
    }
};

/**
 * EXCEL'DEN SINAV İÇE AKTARMA MANTIĞI
 */
let draftExams = [];

function initExcelImport() {
    const btnImport = document.getElementById('btn-import-exams-excel');
    const fileInput = document.getElementById('excel-import-input');
    const btnAllImport = document.getElementById('btn-import-all-excel');
    const uploadModal = document.getElementById('modal-excel-upload');
    const dropZone = document.getElementById('excel-drop-zone');

    if (btnImport && uploadModal) {
        btnImport.addEventListener('click', () => {
            if (dropZone) dropZone.style.borderColor = 'rgba(99,102,241,0.5)';
            const text = document.getElementById('excel-drop-text');
            const icon = document.getElementById('excel-drop-icon');
            if (text) text.innerHTML = "Excel Dosyasini Sürükleyin";
            if (icon) icon.innerHTML = "📥";
            uploadModal.classList.remove('hidden');
        });
    }

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.background = 'rgba(99,102,241,0.2)';
            dropZone.style.borderColor = 'var(--primary)';
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.background = 'rgba(99,102,241,0.05)';
            dropZone.style.borderColor = 'rgba(99,102,241,0.5)';
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.background = 'rgba(99,102,241,0.05)';
            dropZone.style.borderColor = 'rgba(99,102,241,0.5)';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                handleExcelExamsFile({ target: fileInput });
            }
        });
    }

    if (fileInput) fileInput.addEventListener('change', handleExcelExamsFile);
    if (btnAllImport) btnAllImport.addEventListener('click', importAllExcelExams);
}

function parseTurkishDateTimeAndDuration(rawStr, defaultDuration = 60) {
    let dateStr = "";
    let timeStr = "09:00";
    let duration = defaultDuration;
    let endTimeStr = "";
    
    if (rawStr === null || rawStr === undefined || rawStr === "") {
        return { date: new Date().toISOString().split('T')[0], time: "09:00", duration: defaultDuration, endTime: "10:00" };
    }

    if (typeof rawStr === 'number') {
        const excelDate = new Date((rawStr - (25567 + 1)) * 86400 * 1000);
        const d = String(excelDate.getUTCDate()).padStart(2, '0');
        const m = String(excelDate.getUTCMonth() + 1).padStart(2, '0');
        const y = excelDate.getUTCFullYear();
        dateStr = `${y}-${m}-${d}`;
        timeStr = `${String(excelDate.getUTCHours()).padStart(2,'0')}:${String(excelDate.getUTCMinutes()).padStart(2,'0')}`;
        return { date: dateStr, time: timeStr, duration: defaultDuration, endTime: "" };
    }

    rawStr = String(rawStr).replace(/\r?\n/g, ' ').trim();
    
    // 1. Saat Araliği Kontrolü: "09:30-11:20", "13:30-15:20", "09:30 - 11:20", "15:30-16:20"
    const timeRangeMatch = rawStr.match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/);
    if (timeRangeMatch) {
        const startH = parseInt(timeRangeMatch[1], 10);
        const startM = parseInt(timeRangeMatch[2], 10);
        const endH = parseInt(timeRangeMatch[3], 10);
        const endM = parseInt(timeRangeMatch[4], 10);
        
        timeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
        endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        
        const startTotalMin = startH * 60 + startM;
        const endTotalMin = endH * 60 + endM;
        if (endTotalMin > startTotalMin) {
            duration = endTotalMin - startTotalMin;
        }
    } else {
        // Tekil saat: "10:30", "09:00"
        const singleTimeMatch = rawStr.match(/(\d{1,2})[:.](\d{2})/);
        if (singleTimeMatch) {
            const h = parseInt(singleTimeMatch[1], 10);
            const m = parseInt(singleTimeMatch[2], 10);
            timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const endTotal = h * 60 + m + defaultDuration;
            const endH = Math.floor(endTotal / 60) % 24;
            const endM = endTotal % 60;
            endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        }
    }
    
    const months = {
        "ocak": "01", "şubat": "02", "subat": "02", "mart": "03", "nisan": "04", "mayis": "05", "mayis": "05", "haziran": "06",
        "temmuz": "07", "ağustos": "08", "agustos": "08", "eylül": "09", "eylul": "09", "ekim": "10", "kasim": "11", "kasim": "11", "aralik": "12", "aralik": "12"
    };
    
    // Ay ismi içeren Türkçe Tarih: "16 Haziran 2026 Sali 10:30", "11 Haziran 2026"
    const regexTurkishDate = /(\d{1,2})\s+([a-zA-ZğüşiöçĞÜŞİÖÇ]+)\s+(\d{4})/;
    const dateMatch = rawStr.match(regexTurkishDate);
    
    if (dateMatch && months[dateMatch[2].toLowerCase()]) {
        const d = dateMatch[1].padStart(2, '0');
        const m = months[dateMatch[2].toLowerCase()];
        const y = dateMatch[3];
        dateStr = `${y}-${m}-${d}`;
    } else {
        // Noktali veya tireli tarih: "08.06.2026", "9.06.2026", "15.06.2026Pazartesi"
        const stdMatch = rawStr.match(/(\d{1,4})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
        if (stdMatch) {
            let p1 = stdMatch[1], p2 = stdMatch[2], p3 = stdMatch[3];
            if (p1.length === 4) {
                dateStr = `${p1}-${p2.padStart(2,'0')}-${p3.padStart(2,'0')}`;
            } else if (p3.length === 4) {
                dateStr = `${p3}-${p2.padStart(2,'0')}-${p1.padStart(2,'0')}`;
            } else if (p3.length === 2) {
                dateStr = `20${p3}-${p2.padStart(2,'0')}-${p1.padStart(2,'0')}`;
            }
        }
    }
    
    if (!dateStr) {
        dateStr = new Date().toISOString().split('T')[0];
    }
    
    return { date: dateStr, time: timeStr, duration: duration, endTime: endTimeStr };
}

// Eski fonksiyon uyumluluğu
function parseTurkishDateTime(rawStr) {
    const res = parseTurkishDateTimeAndDuration(rawStr);
    return { date: res.date, time: res.time };
}

async function handleExcelExamsFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const textObj = document.getElementById('excel-drop-text');
    const subObj = document.getElementById('excel-drop-subtext');
    const iconObj = document.getElementById('excel-drop-icon');
    
    if (textObj) textObj.innerHTML = "Yükleniyor ve Yapay Zeka Hesaplaniyor...";
    if (subObj) subObj.innerHTML = "Lütfen bekleyin, sinavlar ve gözetmenler adil katsayi puanlariyla hesaplaniyor...";
    if (iconObj) iconObj.innerHTML = "⏳";

    const reader = new FileReader();
    reader.onload = function(evt) {
        setTimeout(() => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                
                const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                
                let headerRowIndex = -1;
                let headers = [];
                for(let i = 0; i < Math.min(10, rawRows.length); i++) {
                    const r = rawRows[i];
                    if (!r) continue;
                    const rowStr = r.join(' ').toLowerCase();
                    if (rowStr.includes('dersin adi') || rowStr.includes('sinav adi') || rowStr.includes('ders') || rowStr.includes('kodu') || rowStr.includes('hocalar')) {
                        headerRowIndex = i;
                        headers = r.map(h => h ? String(h).trim().toLowerCase() : '');
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    showToast('Excel dosyasinda geçerli bir başlik satiri ("Dersin Kodu", "Dersin Adi", "Hocalar" vb.) bulunamadi!', 'error');
                    if (textObj) textObj.innerHTML = "Excel Dosyasini Sürükleyin";
                    if (iconObj) iconObj.innerHTML = "📥";
                    return;
                }

                const mappedRows = [];
                for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
                    const r = rawRows[i];
                    if (!r || r.length === 0 || !r.some(v => v !== "" && v !== undefined && v !== null)) continue;
                    
                    const obj = {};
                    const maxLen = Math.max(headers.length, r.length);
                    for (let idx = 0; idx < maxLen; idx++) {
                        const h = headers[idx] ? String(headers[idx]).trim().toLowerCase() : `__col_${idx}`;
                        if (r[idx] !== undefined && r[idx] !== null) {
                            obj[h] = r[idx];
                            obj[`__raw_col_${idx}`] = r[idx];
                        }
                    }
                    mappedRows.push(obj);
                }

                if (mappedRows.length === 0) {
                    showToast('Excel dosyasi veri içermiyor!', 'error');
                    if (textObj) textObj.innerHTML = "Excel Dosyasini Sürükleyin";
                    if (iconObj) iconObj.innerHTML = "📥";
                    return;
                }

                processExcelRows(mappedRows);
            } catch (err) {
                console.error(err);
                showToast('Excel okuma hatasi! Lütfen geçerli bir dosya yükleyin.', 'error');
                if (textObj) textObj.innerHTML = "Excel Dosyasini Sürükleyin";
                if (iconObj) iconObj.innerHTML = "❌";
            }
            
            const uploadModal = document.getElementById('modal-excel-upload');
            if (uploadModal) uploadModal.classList.add('hidden');
        }, 150);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
}

function processExcelRows(rows) {
    draftExams = [];
    
    // Geçici durum (state) kopyalari
    let tempStaff = JSON.parse(JSON.stringify(DB.staff || []));
    let tempExams = JSON.parse(JSON.stringify(DB.exams || []));

    let currentYearTag = "Genel";

    rows.forEach((row, index) => {
        const getVal = (possibleNames) => {
            for (let key of Object.keys(row)) {
                if (row[key] === undefined || row[key] === null) continue;
                const kLower = key.toLowerCase().trim();
                for (let p of possibleNames) {
                    if (kLower.includes(p.toLowerCase())) return row[key];
                }
            }
            return null;
        };

        // 1. Sinif / Yil Başliği Tespiti: "1. YIL", "2. YIL", "3. YIL", "4. YIL", "HAZIRLIK"
        const allVals = Object.values(row).map(v => String(v).trim()).filter(v => v !== "" && !v.startsWith("__"));
        const firstVal = allVals[0] || "";
        const isYearHeader = (/^(\d+)\.\s*y[ii]l/i.test(firstVal) || /^(haz[ii]rl[ii]k|dönem|sinif|sinif)/i.test(firstVal)) && allVals.length <= 2;
        if (isYearHeader) {
            currentYearTag = firstVal;
            return; // Sinav satiri değil, atla
        }

        // 2. Ders Kodu ve Ders Adi
        const courseCode = (getVal(["dersin kodu", "ders kodu", "kodu", "kod", "code"]) || "").toString().trim();
        let courseName = (getVal(["dersin adi", "sinav adi", "ders adi", "ders", "name", "course"]) || "").toString().trim();
        
        // Eğer dersin adi bulunamadiysa ama ilk sütunda ders kodu varsa
        if (!courseName && !courseCode) {
            courseName = firstVal || "Bilinmeyen Sinav";
        }

        let displayName = "";
        if (courseCode && courseName && !courseName.toLowerCase().includes(courseCode.toLowerCase())) {
            displayName = `${courseCode} - ${courseName}`;
        } else {
            displayName = courseName || courseCode || "Bilinmeyen Sinav";
        }

        // 3. Öğretim Üyesi / Dersi Veren Hocalar
        const lecturer = (getVal(["öğretim üyesi", "hocalar", "hoca", "lecturer", "öğr", "veren", "sorumlu"]) || "").toString().trim();

        // 4. Sinif Mevcudu ve Sinav Yerleri
        let locationRaw = getVal(["sinif mevcudu", "sinav yerleri", "derslik", "yer", "location", "sinif", "salon", "mevcut"]);
        if (!locationRaw) {
            // Sütun ismi eşleşmediyse hücre değerlerinden derslik ara
            for (let k of Object.keys(row)) {
                const val = String(row[k] || '');
                if (/amfi|derslik|salon|\bd\d+\b/i.test(val) && !/pazartesi|sali|çarşamba|perşembe|cuma|cumartesi|pazar|haziran|ocak|mayis/i.test(val)) {
                    locationRaw = val;
                    break;
                }
            }
        }

        let capacity = 0;
        let cleanLocation = "";
        if (locationRaw) {
            const strLoc = String(locationRaw).replace(/\r?\n/g, ' ').trim();
            // Örn: "73 - Amfi 2", "118-Amfi 2+D1+", "55/ Amfi 2", "12- D1"
            const capMatch = strLoc.match(/^(\d+)\s*[-\/\:]\s*(.*)$/);
            if (capMatch) {
                capacity = parseInt(capMatch[1], 10);
                cleanLocation = capMatch[2].replace(/\++$/, '').trim();
            } else {
                const onlyNum = strLoc.match(/\b(\d+)\b/);
                if (onlyNum) capacity = parseInt(onlyNum[1], 10);
                cleanLocation = strLoc.replace(/\b\d+\b/g, '').replace(/^[\s\-\/\:]+/, '').trim();
            }

            cleanLocation = cleanLocation
                .replace(/(amfi)(\d+)/gi, '$1 $2')
                .replace(/\s*\+\s*/g, ' + ')
                .trim();
            if (!cleanLocation) cleanLocation = strLoc;
        } else {
            // Havuz / Servis dersi kontrolü
            cleanLocation = "Ortak / Havuz Sinavi";
        }

        // 5. Tarih, Saat ve Süre
        let dateTimeRaw = getVal(["sinav tarihi", "tarih ve saat", "tarih", "saat", "date", "time"]);
        if (!dateTimeRaw) {
            for (let k of Object.keys(row)) {
                const val = String(row[k] || '');
                if (/\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}/.test(val) || /ocak|şubat|mart|nisan|mayis|haziran|temmuz|ağustos|eylül|ekim|kasim|aralik/i.test(val)) {
                    dateTimeRaw = val;
                    break;
                }
            }
        }

        const parsedDT = parseTurkishDateTimeAndDuration(dateTimeRaw, 60);
        const date = parsedDT.date;
        const time = parsedDT.time;
        const duration = parsedDT.duration;
        const endTime = parsedDT.endTime;

        // 6. Gözetmen İhtiyaci Hesabi (Kapasite + Çoklu Salon)
        let roomCount = 1;
        if (cleanLocation.includes('+')) {
            roomCount = cleanLocation.split('+').filter(Boolean).length;
        }

        let requiredProctors = 1;
        if (capacity > 100) {
            requiredProctors = Math.max(3, roomCount);
        } else if (capacity > 50) {
            requiredProctors = Math.max(2, roomCount);
        } else {
            requiredProctors = Math.max(1, roomCount);
        }

        // 7. Akilli Gözetmen Atama (Simülasyon)
        let assignedProctors = [];
        
        for (let i = 0; i < requiredProctors; i++) {
            let available = tempStaff.filter(s => {
                if (!isAvailable(s.name, date, time, duration)) return false;
                
                const start = getSafeDate(date, time);
                const end = new Date(start.getTime() + (duration + 15) * 60000); // 15dk tolerans
                
                const hasConflict = tempExams.some(ex => {
                    const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
                    if (!pIds.includes(s.id)) return false;
                    if (ex.date !== date) return false;
                    
                    const exStart = getSafeDate(ex.date, ex.time);
                    const exEnd = new Date(exStart.getTime() + (ex.duration + 15) * 60000);
                    return (start < exEnd && end > exStart);
                });
                
                if (hasConflict) return false;
                if (assignedProctors.find(p => p.id === s.id)) return false;
                
                return (s.taskCount || 0) < GLOBAL_LIMITS.MAX_TASKS;
            });
            
            if (available.length === 0) {
                available = tempStaff.filter(s => {
                    if (!isAvailable(s.name, date, time, duration)) return false;
                    const start = getSafeDate(date, time);
                    const end = new Date(start.getTime() + (duration + 15) * 60000);
                    const hasConflict = tempExams.some(ex => {
                        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
                        if (!pIds.includes(s.id)) return false;
                        if (ex.date !== date) return false;
                        const exStart = getSafeDate(ex.date, ex.time);
                        const exEnd = new Date(exStart.getTime() + (ex.duration + 15) * 60000);
                        return (start < exEnd && end > exStart);
                    });
                    if (hasConflict) return false;
                    if (assignedProctors.find(p => p.id === s.id)) return false;
                    return true;
                });
            }
            
            if (available.length > 0) {
                available.sort((a, b) => {
                    const aMin = (a.taskCount || 0) >= GLOBAL_LIMITS.MIN_TASKS;
                    const bMin = (b.taskCount || 0) >= GLOBAL_LIMITS.MIN_TASKS;
                    if (aMin !== bMin) return aMin ? 1 : -1;
                    return (a.totalScore || 0) - (b.totalScore || 0);
                });
                
                const chosen = available[0];
                assignedProctors.push(chosen);
                
                // Simülasyon Puanini Arttir
                const weight = typeof getRoleWeight === 'function' ? getRoleWeight(chosen.role) : 1.0;
                let scoreToAdd = parseFloat((duration * 1.5 * weight).toFixed(2));
                chosen.totalScore = parseFloat(((chosen.totalScore || 0) + scoreToAdd).toFixed(2));
                chosen.taskCount = (chosen.taskCount || 0) + 1;
            }
        }
        
        let pIds = assignedProctors.map(p => p.id);
        let pNames = assignedProctors.map(p => p.name);
        
        let pNamesDisplay;
        if (assignedProctors.length === 0) {
             pNamesDisplay = '<span style="color:#ef4444; font-weight:700;">⚠️ Atanmadi</span>';
        } else if (assignedProctors.length === 1) {
             pNamesDisplay = `<span class="badge" style="background:rgba(99,102,241,0.2); color:#818cf8; font-weight:600; padding:4px 8px; border-radius:6px;">👤 ${assignedProctors[0].name}</span>`;
        } else {
             pNamesDisplay = assignedProctors.map(p => `<span class="badge" style="background:rgba(99,102,241,0.2); color:#818cf8; font-weight:600; padding:4px 8px; border-radius:6px; margin:2px; display:inline-block;">👤 ${p.name}</span>`).join(' ');
        }

        const newEx = {
            id: Date.now() + index,
            type: getVal(["tür", "type"]) || "Vize",
            name: displayName,
            code: courseCode,
            title: courseName,
            yearTag: currentYearTag,
            lecturer: lecturer,
            location: cleanLocation,
            capacity: capacity,
            requiredProctors: requiredProctors,
            date: date,
            time: time,
            endTime: endTime,
            duration: duration,
            proctorIds: pIds,
            proctorId: pIds[0] || 0,
            proctorName: pNames.join(', ') || "Atanmadi",
            proctorDisplay: pNamesDisplay,
            proctors: assignedProctors
        };
        
        draftExams.push(newEx);
        tempExams.push(newEx);
    });

    renderExcelPreview();
}

function renderExcelPreview() {
    const modal = document.getElementById('modal-excel-preview');
    const tbody = document.querySelector('#table-excel-preview tbody');
    if (!modal || !tbody) return;

    const totalProctorsAssigned = draftExams.reduce((acc, e) => acc + (e.proctorIds ? e.proctorIds.length : 0), 0);
    const totalRequiredProctors = draftExams.reduce((acc, e) => acc + (e.requiredProctors || 1), 0);

    const subText = modal.querySelector('p');
    if (subText) {
        subText.innerHTML = `Toplam <strong>${draftExams.length}</strong> sinav Excel'den okundu. 🤖 <strong>Akilli Atama</strong> sistemi <strong>${totalProctorsAssigned} / ${totalRequiredProctors}</strong> gözetmen görevlendirmesini adil puan dengesine göre tamamladi.`;
    }

    tbody.innerHTML = '';
    draftExams.forEach(ex => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        
        const yearBadge = ex.yearTag && ex.yearTag !== "Genel" 
            ? `<span class="badge" style="background:rgba(245,158,11,0.2); color:#fbbf24; font-size:0.75rem; margin-right:4px;">${ex.yearTag}</span>` 
            : '';

        const durationBadge = `<span style="color:#38bdf8; font-weight:600;">${ex.time}${ex.endTime ? ' - ' + ex.endTime : ''}</span> <span style="font-size:0.8rem; color:var(--text-muted);">(${ex.duration} dk)</span>`;

        const locBadge = ex.capacity > 0 
            ? `<strong>${ex.location}</strong> <small style="color:#a5b4fc; display:block;">👥 ${ex.capacity} Kişi (${ex.requiredProctors} Gözetmen)</small>`
            : `<strong>${ex.location}</strong>`;

        tr.innerHTML = `
            <td>${yearBadge}<span class="badge" style="background: rgba(255,255,255,0.08); color:white;">${ex.type}</span></td>
            <td><strong>${ex.name}</strong><br><small style="color:var(--text-muted); font-size:0.8rem;">👨‍🏫 ${ex.lecturer || 'Belirtilmedi'}</small></td>
            <td>📅 ${ex.date}</td>
            <td>${durationBadge}</td>
            <td>📍 ${locBadge}</td>
            <td style="vertical-align:middle;">
                ${ex.proctorDisplay || ex.proctorName}
            </td>
        `;
        tbody.appendChild(tr);
    });

    modal.classList.remove('hidden');
}

window.exportExcelWithProctors = function() {
    if (!draftExams || draftExams.length === 0) {
        showToast('İndirilecek sinav verisi bulunamadi!', 'warning');
        return;
    }

    const headers = [
        "Dersin Kodu",
        "Dersin Adi",
        "Dersi veren Hocalar",
        "Sinif mevcudu ve Sinav yerleri",
        "Sinav Tarihi ve Saati",
        "GÖZETMEN"
    ];

    const data = [headers];

    let lastYear = "";
    draftExams.forEach(ex => {
        if (ex.yearTag && ex.yearTag !== "Genel" && ex.yearTag !== lastYear) {
            lastYear = ex.yearTag;
            data.push([`--- ${ex.yearTag.toUpperCase()} ---`, "", "", "", "", ""]);
        }

        const proctorStr = ex.proctors && ex.proctors.length > 0 
            ? ex.proctors.map(p => p.name).join(', ') 
            : (ex.proctorName ? ex.proctorName.replace(/<[^>]*>?/gm, '') : '');

        const locStr = ex.capacity > 0 ? `${ex.capacity} - ${ex.location}` : ex.location;
        const timeStr = `${ex.date} ${ex.time}${ex.endTime ? ' - ' + ex.endTime : ''}`;

        data.push([
            ex.code || (ex.name ? ex.name.split(' - ')[0] : ""),
            ex.title || (ex.name ? ex.name.split(' - ')[1] || ex.name : ""),
            ex.lecturer || "",
            locStr || "",
            timeStr || "",
            proctorStr || "Atanmadi"
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    ws['!cols'] = [
        { wch: 15 }, // Dersin Kodu
        { wch: 32 }, // Dersin Adi
        { wch: 30 }, // Dersi veren Hocalar
        { wch: 28 }, // Sinif mevcudu ve Sinav yerleri
        { wch: 30 }, // Sinav Tarihi ve Saati
        { wch: 40 }  // GÖZETMEN
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sinav Programi');
    XLSX.writeFile(wb, `Sinav_Programi_Gozetmenli_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Gözetmen sütunlari doldurulmuş Excel dosyasi indirildi!', 'success');
};

async function importAllExcelExams() {
    if (draftExams.length === 0) return;

    if (!confirm(`${draftExams.length} sinavi sisteme aktarmak istediğinize emin misiniz?`)) return;

    takeSnapshot("Excel İçe Aktarma");
    
    draftExams.forEach(ex => {
        const examData = {
            type: ex.type,
            name: ex.name,
            lecturer: ex.lecturer,
            location: ex.location,
            capacity: ex.capacity,
            date: ex.date,
            time: ex.time,
            duration: ex.duration,
            proctorId: ex.proctorId,
            proctorName: ex.proctorName,
            proctorIds: ex.proctorIds && ex.proctorIds.length > 0 ? ex.proctorIds : (ex.proctorId ? [ex.proctorId] : [])
        };
        addExam(examData);
    });

    document.getElementById('modal-excel-preview').classList.add('hidden');
    showToast(`${draftExams.length} sinav başariyla aktarildi!`);
    
    // UI Güncelle
    renderExams();
    renderSchedule();
    renderDashboard();
    
    await saveToBackend();
}





// --- BULK ACTIONS & AI AUTO RESOLVE LOGIC ---
function initBulkActions() {
    // 1. Check all listener
    const checkAllSchedule = document.getElementById('check-all-schedule');
    if (checkAllSchedule) {
        checkAllSchedule.addEventListener('change', (e) => {
            const checks = document.querySelectorAll('.bulk-check');
            checks.forEach(chk => chk.checked = e.target.checked);
            updateBulkActionBar();
        });
    }

    // 2. Individual checkboxes change listener using Event Delegation since rows are dynamic
    const scheduleTbody = document.querySelector('#table-schedule tbody');
    if (scheduleTbody) {
        scheduleTbody.addEventListener('change', (e) => {
            if (e.target.classList.contains('bulk-check')) {
                updateBulkActionBar();
            }
        });
    }

    // 3. Bulk Delete Button
    const btnBulkDelete = document.getElementById('btn-bulk-delete');
    if (btnBulkDelete) {
        btnBulkDelete.addEventListener('click', async () => {
            const selectedKeys = getSelectedGroupKeys();
            if (selectedKeys.length === 0) return;
            
            if (confirm(`Seçilen ${selectedKeys.length} sinavi silmek istediğinize emin misiniz?`)) {
                if (typeof takeSnapshot === 'function') {
                    takeSnapshot(`Toplu Sinav Silme (${selectedKeys.length} grup)`);
                }

                let initialCount = DB.exams.length;
                DB.exams = DB.exams.filter(ex => {
                    const key = btoa(encodeURIComponent(`${ex.type}|${ex.name}|${ex.date}|${ex.time}|${ex.location}`));
                    return !selectedKeys.includes(key);
                });
                const deleted = initialCount - DB.exams.length;

                // Puanlari yeniden hesapla (Silinen sinavlarin puanlari hocalardan düşer)
                if (typeof recalculateAllScores === 'function') {
                    recalculateAllScores();
                }

                saveToLocalStorage();
                renderAll();
                await saveToBackend();
                showToast(`${deleted} kayit başariyla silindi ve puanlar güncellendi!`, 'success');
            }
        });
    }

    // 4. Bulk AI Assign Button (Auto Resolve)
    const btnBulkAiAssign = document.getElementById('btn-bulk-ai-assign');
    if (btnBulkAiAssign) {
        btnBulkAiAssign.addEventListener('click', () => {
            const selectedKeys = getSelectedGroupKeys();
            if (selectedKeys.length === 0) return;
            
            if (confirm(`Seçilen ${selectedKeys.length} sinava yapay zeka ile baştan gözetmen atanacak. Daha önceki gözetmenler görevden alinacaktir! Emin misiniz?`)) {
                selectedKeys.forEach(b64Key => {
                    processAutoResolve(b64Key, false);
                });
                
                saveToLocalStorage();
                renderAll();
                showToast(`✨ ${selectedKeys.length} grup için yapay zeka atamalari başariyla gerçekleşti!`, 'success');
            }
        });
    }

    // 5. Bulk Mail Button
    const btnBulkMail = document.getElementById('btn-bulk-mail');
    if (btnBulkMail) {
        btnBulkMail.addEventListener('click', async () => {
            const selectedKeys = getSelectedGroupKeys();
            if (selectedKeys.length === 0) return;

            if (!DB.emailSettings || !DB.emailSettings.enabled) {
                alert("⚠️ E-posta gönderimi kapali! Önce 'Sistem Ayarlari > E-posta Ayarlari' kismindan sistemi aktif etmelisiniz.");
                return;
            }

            if (confirm(`Seçilen ${selectedKeys.length} sinavin tüm gözetmenlerine otomatik bilgilendirme maili gönderilecek. Onayliyor musunuz?`)) {
                let sentCount = 0;
                showToast("📧 Toplu gönderim başladi, lütfen bekleyin...", "info");

                for (const b64Key of selectedKeys) {
                    const key = decodeURIComponent(atob(b64Key));
                    const [type, name, date, time, location] = key.split('|');
                    
                    const matchingExams = DB.exams.filter(e => 
                        e.type === type && e.name === name && e.date === date && e.time === time && e.location === location
                    );
                    
                    for (const ex of matchingExams) {
                        const proctorIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
                        for (const pid of proctorIds) {
                            await sendAssignmentEmail(pid, ex, 'new');
                        }
                    }
                    sentCount++;
                }

                showToast(`✅ ${sentCount} grup sinav için gözetmenlere mailler başariyla iletildi!`, "success");
            }
        });
    }

    // 6. Bulk Outlook Announcement Button
    const btnBulkAnnouncement = document.getElementById('btn-bulk-announcement');
    if (btnBulkAnnouncement) {
        btnBulkAnnouncement.addEventListener('click', () => {
            const selectedKeys = getSelectedGroupKeys();
            if (selectedKeys.length === 0) return;

            // Seçilen tüm sinavlardaki benzersiz gözetmenleri topla
            const allEmails = new Set();
            const proctorNames = new Set();
            const missingEmailNames = [];

            selectedKeys.forEach(b64Key => {
                const key = decodeURIComponent(atob(b64Key));
                const [type, name, date, time, location] = key.split('|');
                const matchingExams = DB.exams.filter(e => e.type === type && e.name === name && e.date === date && e.time === time && e.location === location);
                
                matchingExams.forEach(ex => {
                    const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
                    pIds.forEach(pid => {
                        const s = DB.staff.find(x => String(x.id) === String(pid));
                        if (s) {
                            proctorNames.add(s.name);
                            if (s.email) allEmails.add(s.email);
                            else missingEmailNames.push(s.name);
                        }
                    });
                });
            });

            if (allEmails.size === 0) {
                alert("Seçilen sinavlarin gözetmenlerine ait hiçbir e-posta adresi bulunamadi.");
                return;
            }

            if (missingEmailNames.length > 0) {
                const uniqueMissing = [...new Set(missingEmailNames)];
                if (!confirm(`⚠️ Şu hocalarin e-posta adresi eksik: ${uniqueMissing.join(', ')}\n\nDiğer ${allEmails.size} kişiye mail hazirlansin mi?`)) return;
            }

            const siteUrl = (typeof window.getSystemUrl === 'function') ? window.getSystemUrl() : (window.location.origin + window.location.pathname);
            const emailList = Array.from(allEmails).join(';');
            const subject = "📢 Yeni Sinav Gözetmenlikleri Hakkinda Bilgilendirme";
            const body = `Sayin hocalarim,

Yeni sinav gözetmenlikleriniz verilmiştir. Sistemden ve ekteki pdf dosyasindan kontrol edebilirsiniz.

🌐 SİSTEME ERİŞİM VE SINAV PROGRAMI:
${siteUrl}

⚠️ GÖREV DEĞİŞİKLİKLERİ HAKKINDA:
Gözetmenliklerinizde değişiklik yapmak isterseniz yöneticiye gerek kalmadan sistem üzerinden (${siteUrl}) "Profilim" sekmesini kullanarak kendi aranizda değişiklik yapabilirsiniz.

İyi çalişmalar dileriz.
GTU Matematik Bölümü - Gözetmenlik Sistemi
${siteUrl}`;

            const mailtoLink = `mailto:${encodeURIComponent(emailList)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            
            const a = document.createElement('a');
            a.href = mailtoLink;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => document.body.removeChild(a), 100);

            logAction('admin', 'Toplu Duyuru', `${selectedKeys.length} grup sinav için ${allEmails.size} kişiye toplu duyuru hazirlandi.`);
        });
    }
}

function updateBulkActionBar() {
    const checks = document.querySelectorAll('.bulk-check:checked');
    const count = checks.length;
    const bar = document.getElementById('bulk-action-bar');
    const countSpan = document.getElementById('bulk-selected-count');
    
    if (count > 0) {
        countSpan.textContent = count;
        bar.classList.remove('hidden');
    } else {
        bar.classList.add('hidden');
        if(document.getElementById('check-all-schedule')) {
            document.getElementById('check-all-schedule').checked = false;
        }
    }
}

function getSelectedGroupKeys() {
    const checks = document.querySelectorAll('.bulk-check:checked');
    return Array.from(checks).map(c => c.value);
}

// 5. Individual Auto-Resolve AI Conflict Function (Called explicitly from the button)
window.autoResolveGroupConflict = function(b64Key) {
    if (confirm("Yapay Zeka bu çakişmayi düzeltmek için mevcut kişiyi çikarip, o an en uygun kişiyi bulacaktir. Onayliyor musunuz?")) {
        processAutoResolve(b64Key, true);
        saveToLocalStorage();
        renderAll();
        showToast("✨ Çakişma başariyla çözüldü ve uygun personel atandi!", "success");
    }
}

function processAutoResolve(b64Key, saveLocally = false) {
    const key = decodeURIComponent(atob(b64Key));
    const [type, name, date, time, location] = key.split('|');
    
    const matchingExams = DB.exams.filter(e => e.type === type && e.name === name && e.date === date && e.time === time && e.location === location);
    if(matchingExams.length === 0) return;
    
    const duration = matchingExams[0].duration;
    const capacity = matchingExams[0].capacity;
    const lecturer = matchingExams[0].lecturer;
    
    // Gözetmenlerin görev sayisini rollback yap (nonExam/exam ayrimi)
    matchingExams.forEach(ex => {
        const pIds = ex.proctorIds || [ex.proctorId];
        pIds.forEach(pid => {
            let st = DB.staff.find(s => s.id === pid);
            if(st) {
                 const score = calculateScore(getSafeDate(ex.date, ex.time), duration, ex.id);
                 if (shouldCountAsNonExam(ex)) {
                     st.nonExamScore = Math.max(0, parseFloat(((st.nonExamScore || 0) - score).toFixed(2)));
                     st.nonExamTaskCount = Math.max(0, (st.nonExamTaskCount || 0) - 1);
                 } else {
                     st.taskCount = Math.max(0, (st.taskCount || 0) - 1);
                     st.totalScore = parseFloat(Math.max(0, st.totalScore - score).toFixed(2));
                 }
            }
        });
    });

    // DB'den asil sinavlari komple çikar
    DB.exams = DB.exams.filter(e => !matchingExams.includes(e));
    
    // AI algoritmasindan tek tek alip yerleştir!
    const requiredProctors = matchingExams.length; 
    let assignedCount = 0;
    
    for(let i=0; i<requiredProctors; i++) {
        // En iyisini bul
        const best = findBestProctor(date, time, duration);
        if(best && best.id) {
            // Skoru hemen commitle ki bi sonrakinde tekrar önermesin
            let st = DB.staff.find(s => s.id === best.id);
            // processAutoResolve için yeni sinav bilgisi henüz yok, bu kisim simülasyon değil gerçek atama
            // isNonExam bilgisi matchingExams'den alinabilir
            const refExam = matchingExams[0] || {};
            if(st) {
                 const score = calculateScore(getSafeDate(date, time), duration);
                 if (shouldCountAsNonExam(refExam)) {
                     st.nonExamScore = parseFloat(((st.nonExamScore || 0) + score).toFixed(2));
                     st.nonExamTaskCount = (st.nonExamTaskCount || 0) + 1;
                 } else {
                     st.taskCount = (st.taskCount || 0) + 1;
                     st.totalScore = parseFloat((st.totalScore + score).toFixed(2));
                 }
            }
            
            DB.exams.push({
                 id: Date.now() + Math.random(),
                 type, name, date, time, location, duration, capacity, lecturer,
                 proctorId: best.id,
                 proctorIds: [best.id] // backwards compatibility
            });
            assignedCount++;
        }
    }
}

initBulkActions();

/**
 * =============================================================
 * DÖNEMLİK TASLAK ÜRETİCİ
 * Geçmiş dönem sinavlarindan desen çikarir, yeni dönem başlangiç
 * tarihine göre tüm programi taslak olarak üretir.
 * =============================================================
 */
window.showDonemlikTaslakModal = function() {
    const existing = document.getElementById('modal-donemlik-taslak');
    if (existing) { existing.classList.remove('hidden'); return; }

    const overlay = document.createElement('div');
    overlay.id = 'modal-donemlik-taslak';
    overlay.className = 'modal';
    overlay.style.cssText = 'z-index:9000;';

    // Mevcut sinavlardan benzersiz ders adlarini çek
    const courseSet = [...new Set(DB.exams.map(e => e.name).filter(Boolean))].sort();

    overlay.innerHTML = `
    <div class="modal-content card-large" style="max-width:640px; border:1px solid #10b981;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem;">
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-size:2rem; filter:drop-shadow(0 0 10px #10b981);">📅</span>
                <div>
                    <h2 style="margin:0; color:#10b981; font-size:1.1rem;">Dönemlik Taslak Üreticisi</h2>
                    <p style="margin:0; color:var(--text-muted); font-size:0.8rem;">Geçmiş dönem deseni → Yeni dönem taslak programi</p>
                </div>
            </div>
            <button onclick="document.getElementById('modal-donemlik-taslak').classList.add('hidden')"
                style="background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;">&times;</button>
        </div>

        <!-- ADIM 1: Kaynak Seçimi -->
        <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:12px; padding:1.25rem; margin-bottom:1rem;">
            <div style="font-weight:700; color:#34d399; margin-bottom:12px; font-size:0.9rem;">📊 Adim 1: Şablon Kaynaği</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                    <label style="font-size:0.8rem; color:var(--text-muted);">Yeni Dönem Başlangiç Tarihi</label>
                    <input type="date" id="tpl-start-date" style="width:100%; margin-top:4px;
                        background:rgba(0,0,0,0.3); border:1px solid var(--glass-border); padding:0.6rem;
                        border-radius:8px; color:white;">
                </div>
                <div>
                    <label style="font-size:0.8rem; color:var(--text-muted);">Dönem Süresi (hafta)</label>
                    <input type="number" id="tpl-week-count" value="8" min="1" max="20"
                        style="width:100%; margin-top:4px; background:rgba(0,0,0,0.3);
                        border:1px solid var(--glass-border); padding:0.6rem; border-radius:8px; color:white;">
                </div>
            </div>
        </div>

        <!-- ADIM 2: Ders Seçimi -->
        <div style="background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.25); border-radius:12px; padding:1.25rem; margin-bottom:1rem;">
            <div style="font-weight:700; color:#a78bfa; margin-bottom:12px; font-size:0.9rem;">📚 Adim 2: Sinava Girecek Dersler</div>
            <div id="tpl-course-list" style="max-height:200px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                ${courseSet.slice(0,30).map(c => `
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; padding:6px 8px;
                    background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                    <input type="checkbox" class="tpl-course-check" value="${c.replace(/"/g,'')}" checked
                        style="accent-color:#6366f1; width:16px; height:16px;">
                    <span style="font-size:0.85rem;">${c}</span>
                </label>`).join('')}
                ${courseSet.length === 0 ? '<p style="color:var(--text-muted); font-size:0.85rem;">Sistemde önceki dönem sinavi bulunamadi. Manuel ders ekleyebilirsiniz.</p>' : ''}
            </div>
            <div style="margin-top:10px; display:flex; gap:8px;">
                <input type="text" id="tpl-new-course" placeholder="Yeni ders ekle..."
                    style="flex:1; background:rgba(0,0,0,0.3); border:1px solid var(--glass-border); padding:0.5rem 0.75rem; border-radius:8px; color:white; font-size:0.85rem;">
                <button onclick="window.tplAddCourse()" class="btn-primary" style="padding:0.5rem 0.9rem; font-size:0.85rem;">+ Ekle</button>
            </div>
        </div>

        <!-- ADIM 3: Varsayilan Ayarlar -->
        <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:12px; padding:1.25rem; margin-bottom:1.5rem;">
            <div style="font-weight:700; color:#fcd34d; margin-bottom:12px; font-size:0.9rem;">⚙️ Adim 3: Varsayilan Değerler</div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                <div>
                    <label style="font-size:0.8rem; color:var(--text-muted);">Varsayilan Saat</label>
                    <input type="time" id="tpl-default-time" value="09:00"
                        style="width:100%; margin-top:4px; background:rgba(0,0,0,0.3);
                        border:1px solid var(--glass-border); padding:0.5rem; border-radius:8px; color:white;">
                </div>
                <div>
                    <label style="font-size:0.8rem; color:var(--text-muted);">Süre (dk)</label>
                    <input type="number" id="tpl-default-duration" value="90" min="30" max="300"
                        style="width:100%; margin-top:4px; background:rgba(0,0,0,0.3);
                        border:1px solid var(--glass-border); padding:0.5rem; border-radius:8px; color:white;">
                </div>
                <div>
                    <label style="font-size:0.8rem; color:var(--text-muted);">Sinav Türü</label>
                    <select id="tpl-default-type"
                        style="width:100%; margin-top:4px; background:rgba(0,0,0,0.3);
                        border:1px solid var(--glass-border); padding:0.5rem; border-radius:8px; color:white;">
                        ${(DB.examTypes || ['Vize','Final']).map(t => `<option>${t}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>

        <!-- Sonuç özeti -->
        <div id="tpl-preview-info" style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem; text-align:center;"></div>

        <div style="display:flex; gap:10px;">
            <button onclick="document.getElementById('modal-donemlik-taslak').classList.add('hidden')"
                style="flex:1; padding:0.9rem; background:rgba(255,255,255,0.05); border:1px solid var(--glass-border);
                border-radius:10px; color:var(--text-muted); cursor:pointer;">Vazgeç</button>
            <button id="btn-tpl-generate" onclick="window.generateDonemlikTaslak()"
                style="flex:2; padding:0.9rem; background:linear-gradient(135deg,#10b981,#059669);
                border:none; border-radius:10px; color:white; font-weight:700; cursor:pointer;
                font-size:0.95rem; box-shadow:0 0 20px rgba(16,185,129,0.3);">
                ✨ Taslak Programi Oluştur
            </button>
        </div>
    </div>`;

    document.body.appendChild(overlay);
};

window.tplAddCourse = function() {
    const inp = document.getElementById('tpl-new-course');
    const name = inp.value.trim();
    if (!name) return;
    const list = document.getElementById('tpl-course-list');
    const p = document.createElement('label');
    p.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:8px;border:1px solid rgba(255,255,255,0.05);';
    p.innerHTML = `<input type="checkbox" class="tpl-course-check" value="${name.replace(/"/g,'')}" checked
        style="accent-color:#6366f1;width:16px;height:16px;"> <span style="font-size:0.85rem;">${name}</span>`;
    list.appendChild(p);
    inp.value = '';
};

window.generateDonemlikTaslak = function() {
    const startDateVal = document.getElementById('tpl-start-date').value;
    const weekCount    = parseInt(document.getElementById('tpl-week-count').value) || 8;
    const defaultTime  = document.getElementById('tpl-default-time').value || '09:00';
    const defaultDur   = parseInt(document.getElementById('tpl-default-duration').value) || 90;
    const defaultType  = document.getElementById('tpl-default-type').value || 'Vize';

    if (!startDateVal) { alert('Lütfen dönem başlangiç tarihini seçin!'); return; }

    const selectedCourses = [...document.querySelectorAll('.tpl-course-check:checked')].map(c => c.value);
    if (selectedCourses.length === 0) { alert('En az bir ders seçin!'); return; }

    const startDate = new Date(startDateVal);
    let addedCount = 0;
    let skippedCount = 0;

    // Her ders için geçmiş döneme bakarak gün+saat deseni bul, yoksa haftalik dağit
    selectedCourses.forEach((courseName, courseIdx) => {
        const pastExams = DB.exams.filter(e => e.name === courseName).sort((a,b) => a.date.localeCompare(b.date));

        // Geçmiş deseni: gün haftasi (0=Pazar .. 6=Cumartesi) ve saat
        let prefDay  = (courseIdx % 5) + 1; // Pazartesi-Cuma arasi dağit
        let prefTime = defaultTime;
        let prefDur  = defaultDur;
        let prefLoc  = '';
        let prefLect = '';

        if (pastExams.length > 0) {
            const last = pastExams[pastExams.length - 1];
            const lastDate = new Date(last.date);
            prefDay  = lastDate.getDay() || 1;
            prefTime = last.time || defaultTime;
            prefDur  = last.duration || defaultDur;
            prefLoc  = last.location || '';
            prefLect = last.lecturer || '';
        }

        // Her hafta bu günü bul
        for (let w = 0; w < weekCount; w++) {
            const candidateDate = new Date(startDate);
            candidateDate.setDate(startDate.getDate() + w * 7);

            // O haftada seçilen gün kaçar ileri?
            let diff = prefDay - candidateDate.getDay();
            if (diff < 0) diff += 7;
            candidateDate.setDate(candidateDate.getDate() + diff);

            const dateStr = candidateDate.toISOString().split('T')[0];
            const isDuplicate = DB.exams.some(e => e.name === courseName && e.date === dateStr && e.time === prefTime);
            if (isDuplicate) { skippedCount++; continue; }

            const score = calculateScore(getSafeDate(dateStr, prefTime), prefDur);
            DB.exams.push({
                id: Date.now() + Math.random(),
                name: courseName,
                date: dateStr,
                time: prefTime,
                duration: prefDur,
                type: defaultType,
                location: prefLoc,
                lecturer: prefLect,
                score, katsayi: getKatsayi(getSafeDate(dateStr, prefTime), prefDur),
                proctorIds: [], proctorId: null, proctorName: '',
                isDraft: true,   // Her zaman taslak
                createdAt: new Date().toISOString()
            });
            addedCount++;
        }
    });

    saveToLocalStorage();
    if (typeof saveToBackend === 'function') saveToBackend();
    document.getElementById('modal-donemlik-taslak').classList.add('hidden');
    renderExams(); renderSchedule(); renderDashboard();

    if (typeof showToast === 'function') {
        showToast(`✅ ${addedCount} taslak sinav oluşturuldu!${skippedCount > 0 ? ` (${skippedCount} mükerrer atlandi)` : ''} Taslak Modu'nu açip inceleyebilirsiniz.`);
    }
};

/**
 * =============================================================
 * GERİ BİLDİRİM (ÖNERİ & ŞİKAYET) MODÜLÜ
 * =============================================================
 */

window.currentFeedbackFilter = 'all';

window.updateFeedbackBadge = function() {
    const badge = document.getElementById('feedback-badge');
    if (!badge) return;
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin || !DB.feedbacks) {
        badge.classList.add('hidden');
        return;
    }
    const pendingCount = DB.feedbacks.filter(f => f.status === 'Yeni').length;
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
};

window.renderFeedbackPage = function() {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const myStaffId = localStorage.getItem('myStaffId');
    const myStaff = DB.staff.find(s => String(s.id) === String(myStaffId));

    const adminView = document.getElementById('feedback-admin-view');
    const userView = document.getElementById('feedback-user-view');

    if (!adminView || !userView) return;

    if (isAdmin) {
        adminView.classList.remove('hidden');
        userView.classList.add('hidden');
        renderFeedbackAdmin();
    } else {
        adminView.classList.add('hidden');
        userView.classList.remove('hidden');
        renderFeedbackUser(myStaff);
    }
    
    // Badge güncelle
    window.updateFeedbackBadge();
};

function getCategoryColor(category) {
    if (category === 'Sistemsel') return '#8b5cf6'; // Indigo/Purple
    if (category === 'Sinav Düzeni') return '#f59e0b'; // Amber/Orange
    if (category === 'Fiziksel Koşullar') return '#ef4444'; // Red
    return '#94a3b8'; // Grey/Diğer
}

function getStatusBadge(status) {
    if (status === 'Yeni') return `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); font-size: 0.7rem; padding: 4px 8px;">Yeni</span>`;
    if (status === 'İnceleniyor') return `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); font-size: 0.7rem; padding: 4px 8px;">İnceleniyor</span>`;
    return `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); font-size: 0.7rem; padding: 4px 8px;">Çözüldü</span>`;
}

function renderFeedbackAdmin() {
    const listEl = document.getElementById('feedback-admin-list');
    if (!listEl) return;

    const feedbacks = DB.feedbacks || [];
    
    // İstatistikler
    document.getElementById('feedback-stat-total').textContent = feedbacks.length;
    document.getElementById('feedback-stat-pending').textContent = feedbacks.filter(f => f.status === 'Yeni').length;
    document.getElementById('feedback-stat-resolved').textContent = feedbacks.filter(f => f.status === 'Çözüldü').length;

    // Filtreleme
    let filtered = feedbacks;
    if (window.currentFeedbackFilter !== 'all') {
        filtered = feedbacks.filter(f => f.status === window.currentFeedbackFilter);
    }

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                Kriterlere uygun geri bildirim bulunamadi.
            </div>
        `;
        return;
    }

    // En yeni en üstte
    const sorted = [...filtered].sort((a, b) => b.id - a.id);

    listEl.innerHTML = sorted.map(f => {
        const categoryColor = getCategoryColor(f.category);
        const statusBadge = getStatusBadge(f.status);
        const senderText = f.isAnonymous ? '🔒 Anonim Kullanici' : (f.senderName || 'Bilinmeyen Kullanici');
        const dateStr = new Date(f.id).toLocaleString('tr-TR');

        return `
            <div class="card-large" style="margin-bottom: 0; padding: 1.5rem; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem;">
                    <div>
                        <span class="badge" style="background: ${categoryColor}22; color: ${categoryColor}; border: 1px solid ${categoryColor}44; font-size: 0.7rem; padding: 4px 8px; margin-right: 8px;">
                            ${f.category}
                        </span>
                        <strong style="color: white; font-size: 0.95rem;">${senderText}</strong>
                        <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 8px;">${dateStr}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${statusBadge}
                        <select onchange="window.updateFeedbackStatus(${f.id}, this.value)" style="background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; width: auto;">
                            <option value="Yeni" ${f.status === 'Yeni' ? 'selected' : ''}>Yeni</option>
                            <option value="İnceleniyor" ${f.status === 'İnceleniyor' ? 'selected' : ''}>İnceleniyor</option>
                            <option value="Çözüldü" ${f.status === 'Çözüldü' ? 'selected' : ''}>Çözüldü</option>
                        </select>
                    </div>
                </div>

                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem; white-space: pre-wrap; line-height: 1.5;">${f.message}</p>

                <!-- Yanit Alani -->
                <div id="response-container-${f.id}" style="background: rgba(99, 102, 241, 0.04); border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.1); padding: 1rem; margin-top: 1rem; ${!f.response ? 'display: none;' : ''}">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 0.8rem; color: var(--primary); font-weight: 700;">
                        <span>💬 Yönetici Yaniti:</span>
                    </div>
                    <p id="response-text-${f.id}" style="color: var(--text-secondary); font-size: 0.85rem; margin: 0; white-space: pre-wrap;">${f.response || ''}</p>
                </div>

                <!-- İşlem Butonlari -->
                <div style="margin-top: 1rem; display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="btn-primary" onclick="window.toggleFeedbackReply(${f.id})" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); box-shadow: none;">
                        ${f.response ? '✍️ Yaniti Düzenle' : '💬 Yanit Yaz'}
                    </button>
                </div>

                <div id="reply-form-${f.id}" class="hidden" style="margin-top: 1rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 10px; border: 1px solid var(--glass-border);">
                    <textarea id="reply-text-${f.id}" placeholder="Yanitinizi buraya yazin..." style="width: 100%; min-height: 80px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); color: white; padding: 8px; border-radius: 8px; font-size: 0.85rem; resize: vertical; outline: none; margin-bottom: 8px;"></textarea>
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button class="btn-secondary" onclick="window.toggleFeedbackReply(${f.id})" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">İptal</button>
                        <button class="btn-primary" onclick="window.submitFeedbackReply(${f.id})" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">Yaniti Kaydet</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderFeedbackUser(myStaff) {
    const listEl = document.getElementById('feedback-user-list');
    const formEl = document.getElementById('form-submit-feedback');

    if (!listEl) return;

    if (!myStaff) {
        listEl.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                ⚠️ Geri bildirimlerinizi görmek ve yeni bildirim iletmek için lütfen önce <b>Profilim</b> sayfasindan kimliğinizi seçin.
            </div>
        `;
        if (formEl) {
            formEl.style.opacity = '0.5';
            formEl.style.pointerEvents = 'none';
        }
        return;
    }

    if (formEl) {
        formEl.style.opacity = '1';
        formEl.style.pointerEvents = 'auto';
    }

    const feedbacks = DB.feedbacks || [];
    const userFeedbacks = feedbacks.filter(f => String(f.senderId) === String(myStaff.id));

    if (userFeedbacks.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                Kayitli geri bildiriminiz bulunmamaktadir.
            </div>
        `;
        return;
    }

    const sorted = [...userFeedbacks].sort((a, b) => b.id - a.id);

    listEl.innerHTML = sorted.map(f => {
        const categoryColor = getCategoryColor(f.category);
        const statusBadge = getStatusBadge(f.status);
        const dateStr = new Date(f.id).toLocaleString('tr-TR');
        const anonText = f.isAnonymous ? ' <span style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">(🔒 Anonim)</span>' : '';

        return `
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); padding: 1.25rem; border-radius: 14px; margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div>
                        <span class="badge" style="background: ${categoryColor}22; color: ${categoryColor}; border: 1px solid ${categoryColor}44; font-size: 0.65rem; padding: 2px 6px;">
                            ${f.category}
                        </span>
                        ${anonText}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${dateStr}</span>
                        ${statusBadge}
                    </div>
                </div>

                <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0 0 0.5rem 0; white-space: pre-wrap; line-height: 1.4;">${f.message}</p>

                <!-- Yanit -->
                ${f.response ? `
                    <div style="background: rgba(99, 102, 241, 0.05); border-left: 3px solid var(--primary); padding: 8px 12px; border-radius: 4px 8px 8px 4px; margin-top: 0.75rem;">
                        <div style="font-size: 0.75rem; color: var(--primary); font-weight: 700; margin-bottom: 4px;">💬 Yönetici Yaniti:</div>
                        <p style="color: var(--text-primary); font-size: 0.8rem; margin: 0; white-space: pre-wrap;">${f.response}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

window.submitFeedback = async function(e) {
    e.preventDefault();

    const myStaffId = localStorage.getItem('myStaffId');
    const myStaff = DB.staff.find(s => String(s.id) === String(myStaffId));
    
    if (!myStaff) {
        alert("Lütfen önce profilinizden kimliğinizi seçin!");
        return;
    }

    const category = document.getElementById('feedback-category').value;
    const message = document.getElementById('feedback-message').value.trim();
    const isAnonymous = document.getElementById('feedback-anonymous').checked;

    if (!message) {
        alert("Lütfen bir mesaj yazin!");
        return;
    }

    const newFeedback = {
        id: Date.now(),
        senderId: myStaff.id,
        senderName: myStaff.name,
        isAnonymous: isAnonymous,
        category: category,
        message: message,
        status: 'Yeni',
        response: '',
        createdAt: new Date().toISOString()
    };

    if (!DB.feedbacks) DB.feedbacks = [];
    DB.feedbacks.push(newFeedback);

    saveToLocalStorage();
    logAction('user', 'Geri Bildirim', `${isAnonymous ? 'Anonim' : myStaff.name} yeni bir öneri/şikayet iletti.`);

    // Formu sifirla
    document.getElementById('feedback-message').value = '';
    document.getElementById('feedback-anonymous').checked = false;

    if (typeof showToast === 'function') {
        showToast("Geri bildiriminiz başariyla iletildi. Teşekkür ederiz!", "success");
    }

    renderFeedbackPage();
    await saveToBackend();
};

window.updateFeedbackStatus = async function(id, newStatus) {
    const feedback = DB.feedbacks.find(f => String(f.id) === String(id));
    if (!feedback) return;

    feedback.status = newStatus;
    saveToLocalStorage();
    logAction('admin', 'Geri Bildirim Güncellemesi', `Bildirim (ID: ${id}) durumu '${newStatus}' olarak güncellendi.`);
    
    if (typeof showToast === 'function') {
        showToast(`Durum güncellendi: ${newStatus}`, "success");
    }
    renderFeedbackPage();
    await saveToBackend();
};

window.toggleFeedbackReply = function(id) {
    const replyForm = document.getElementById(`reply-form-${id}`);
    if (!replyForm) return;

    replyForm.classList.toggle('hidden');
    if (!replyForm.classList.contains('hidden')) {
        const textarea = document.getElementById(`reply-text-${id}`);
        const feedback = DB.feedbacks.find(f => String(f.id) === String(id));
        if (textarea && feedback) {
            textarea.value = feedback.response || '';
            textarea.focus();
        }
    }
};

window.submitFeedbackReply = async function(id) {
    const textarea = document.getElementById(`reply-text-${id}`);
    if (!textarea) return;

    const responseText = textarea.value.trim();
    const feedback = DB.feedbacks.find(f => String(f.id) === String(id));
    if (!feedback) return;

    feedback.response = responseText;
    
    if (feedback.status === 'Yeni') {
        feedback.status = 'İnceleniyor';
    }

    saveToLocalStorage();
    logAction('admin', 'Geri Bildirim Yanitlandi', `Bildirim (ID: ${id}) yanitlandi.`);

    const replyForm = document.getElementById(`reply-form-${id}`);
    if (replyForm) replyForm.classList.add('hidden');

    if (typeof showToast === 'function') {
        showToast("Yanitiniz kaydedildi.", "success");
    }

    renderFeedbackPage();
    await saveToBackend();
};

// --- PWA: Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('[PWA] Service Worker registered with scope:', registration.scope);
                
                // Eğer yeni bir service worker yüklenirse sayfayi yenile
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker) {
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    console.log('[PWA] Yeni güncelleme algilandi, sayfa yenileniyor...');
                                    window.location.reload();
                                }
                            }
                        };
                    }
                };
            })
            .catch(error => {
                console.error('[PWA] Service Worker registration failed:', error);
            });

        // Service Worker değiştiğinde sayfayi otomatik yenile
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    });
}

/**
 * Personel Karne Gösterimi
 */
window.showStaffReportModal = (id) => {
    const staff = DB.staff.find(s => String(s.id) === String(id));
    if (!staff) return;

    document.getElementById('report-staff-name').textContent = staff.name + " - Puan Karnesi";
    document.getElementById('report-base-score').textContent = (staff.baseScore || 0).toFixed(1);
    
    // Bağimsiz helper fonksiyonu: isStaffProctorById'ye erişilememesine karşi
    const sid = String(staff.id);
    const duties = DB.exams.filter(ex => {
        if (!ex || !sid) return false;
        if (String(ex.proctorId) === sid) return true;
        if (Array.isArray(ex.proctorIds) && ex.proctorIds.map(String).includes(sid)) return true;
        return false;
    });

    const tbody = document.getElementById('report-tbody');
    tbody.innerHTML = '';

    let earnedScore = 0;

    duties.forEach(ex => {
        let points = parseFloat(ex.score);
        if (isNaN(points)) {
            try {
                let timeStr = ex.time ? ex.time.split('-')[0].trim() : '09:00';
                if (timeStr.length === 4) timeStr = '0' + timeStr; // 9:00 -> 09:00
                const d = new Date(`${ex.date}T${timeStr}:00`);
                points = calculateScore(d, parseFloat(ex.duration) || 60, ex.id);
            } catch (err) {
                console.error('Puan hesaplama hatasi:', err);
                points = 0;
            }
        }
        if (isNaN(points)) points = 0;
        
        earnedScore += points;

        const isNonExam = shouldCountAsNonExam(ex);
        const typeStr = isNonExam ? `<span style="color:var(--accent-orange);">Sinav Dişi</span>` : `<span style="color:var(--primary);">Sinav</span>`;

        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
        tr.innerHTML = `
            <td style="padding: 0.75rem;">${ex.date} ${ex.time}</td>
            <td style="padding: 0.75rem; font-weight: 500;">${ex.name}</td>
            <td style="padding: 0.75rem;">${typeStr}</td>
            <td style="padding: 0.75rem; text-align: right; color: var(--accent-green); font-weight: bold;">+${points.toFixed(1)}</td>
        `;
        tbody.appendChild(tr);
    });

    if (duties.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 1rem; color: var(--text-muted);">Henüz bir görev bulunmuyor.</td></tr>`;
    }

    document.getElementById('report-earned-score').textContent = "+" + earnedScore.toFixed(1);
    
    const total = (staff.baseScore || 0) + earnedScore;
    document.getElementById('report-total-score').textContent = total.toFixed(1);

    document.getElementById('modal-staff-report').classList.remove('hidden');
};

/**
 * Tarihi Geçmiş Kisitlari Temizle
 */
window.cleanExpiredConstraints = (silent = false) => {
    if (!DB.constraints) return;

    if (!silent && !confirm("Tarihi geçmiş tüm kisitlar silinecek. Emin misiniz?")) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayYear = today.getFullYear();

    let deletedCount = 0;

    for (let staffName in DB.constraints) {
        const oldLength = DB.constraints[staffName].length;
        
        DB.constraints[staffName] = DB.constraints[staffName].filter(c => {
            // Eğer haftalik kisitsa silme (hiçbir zaman tarihi geçmez)
            if (c.day !== undefined) return true;

            if (c.endDate) {
                // Toplu tarih
                const ed = new Date(c.endDate);
                if (ed < today) return false; // süresi dolmuş
            } else if (c.date) {
                // Tekil tarih (MM-DD veya YYYY-MM-DD olabilir)
                let parts = c.date.split('-');
                let checkDate;
                if (parts.length === 2) {
                    checkDate = new Date(todayYear, parseInt(parts[0]) - 1, parseInt(parts[1]));
                } else if (parts.length === 3) {
                    checkDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                }
                if (checkDate && checkDate < today) return false;
            }
            return true;
        });

        deletedCount += (oldLength - DB.constraints[staffName].length);
    }

    if (deletedCount > 0) {
        saveToLocalStorage();
        if (typeof renderConstraintsPage === 'function') renderConstraintsPage();
        logAction('admin', 'Kisit Temizliği', `${deletedCount} adet tarihi geçmiş kisit silindi.`);
        if (!silent) showToast(`${deletedCount} adet tarihi geçmiş kisit başariyla temizlendi.`, "success");
    } else {
        if (!silent) showToast("Tarihi geçmiş kisit bulunamadi.", "info");
    }
};

// ===== KARNE (SCORECARD) MODÜLÜ =====
window.renderScorecard = function() {
    const myStaffId = localStorage.getItem('myStaffId');
    const baseEl = document.getElementById('sc-base-score');
    const examEl = document.getElementById('sc-exam-score');
    const nonExamEl = document.getElementById('sc-nonexam-score');
    const totalEl = document.getElementById('sc-total-score');
    const examHint = document.getElementById('sc-exam-hint');
    const nonExamHint = document.getElementById('sc-nonexam-hint');
    const listContainer = document.getElementById('scorecard-accordion-list');

    if (!myStaffId || !listContainer) return;

    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) {
        listContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:2rem;">Personel kaydi bulunamadi. Lütfen profilinizi tekrar seçin.</div>';
        return;
    }

    const baseScore = parseFloat(staff.baseScore || 0);
    const examTotal = parseFloat(staff.totalScore || 0); // Bu baseScore + gözetmenlik puanlarini içerir
    const examOnlyGained = parseFloat((examTotal - baseScore).toFixed(2));
    const nonExamScore = parseFloat(staff.nonExamScore || 0);
    const grandTotal = parseFloat((examTotal + nonExamScore).toFixed(2));

    if (baseEl) baseEl.textContent = baseScore.toFixed(1);
    if (examEl) examEl.textContent = examTotal.toFixed(1);
    if (nonExamEl) nonExamEl.textContent = `+${nonExamScore.toFixed(1)}`;
    if (totalEl) totalEl.textContent = grandTotal.toFixed(1);

    if (examHint) examHint.textContent = `Sinav Gözetmenliği: +${examOnlyGained.toFixed(1)} Puan`;
    if (nonExamHint) nonExamHint.textContent = `${staff.nonExamTaskCount || 0} Adet Sinav Dişi Görev`;

    // Personelin görevli olduğu tüm sinav ve görevleri topla
    const myExams = DB.exams.filter(e => {
        if (typeof isStaffProctorById === 'function') {
            return isStaffProctorById(e, myStaffId);
        }
        return (e.proctorIds || [e.proctorId]).map(String).includes(String(myStaffId));
    });

    // Sinav ve görevleri ay ve yila göre grupla
    const monthsMap = {};
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasim", "Aralik"];

    myExams.forEach(ex => {
        if (!ex.date) return;
        const d = new Date(ex.date.replace(/-/g, "/"));
        if (isNaN(d.getTime())) return;

        const year = d.getFullYear();
        const monthIdx = d.getMonth();
        const key = `${year}_${String(monthIdx).padStart(2, '0')}`; // Örn: "2026_07"

        if (!monthsMap[key]) {
            monthsMap[key] = {
                year: year,
                monthIdx: monthIdx,
                monthName: `${monthNames[monthIdx]} ${year}`,
                examTasks: [],
                nonExamTasks: [],
                examTotalScore: 0,
                nonExamTotalScore: 0
            };
        }

        const scoreVal = parseFloat(ex.score || 0);
        const isNonExam = (typeof shouldCountAsNonExam === 'function') ? shouldCountAsNonExam(ex) : Boolean(ex.isNonExam);

        const taskItem = {
            id: ex.id,
            name: ex.name,
            date: ex.date,
            time: ex.time || '-',
            location: ex.location || '-',
            type: ex.type || (isNonExam ? 'Sinav Dişi Görev' : 'Sinav Gözetmenliği'),
            score: scoreVal
        };

        if (isNonExam) {
            monthsMap[key].nonExamTasks.push(taskItem);
            monthsMap[key].nonExamTotalScore = parseFloat((monthsMap[key].nonExamTotalScore + scoreVal).toFixed(2));
        } else {
            monthsMap[key].examTasks.push(taskItem);
            monthsMap[key].examTotalScore = parseFloat((monthsMap[key].examTotalScore + scoreVal).toFixed(2));
        }
    });

    const sortedKeys = Object.keys(monthsMap).sort().reverse(); // En yeni ay en üstte
    listContainer.innerHTML = '';

    if (sortedKeys.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; padding: 2.5rem; color: #64748b; background: rgba(255,255,255,0.01); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">Dönem içinde puan kazanci sağladiğiniz kayitli bir görev bulunmamaktadir.</div>';
        return;
    }

    sortedKeys.forEach((key, index) => {
        const monthItem = monthsMap[key];
        const totalMonthScore = parseFloat((monthItem.examTotalScore + monthItem.nonExamTotalScore).toFixed(2));

        const itemDiv = document.createElement('div');
        itemDiv.className = 'accordion-item';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'accordion-header';

        let badgesHtml = '';
        if (monthItem.examTotalScore > 0 || monthItem.examTasks.length > 0) {
            badgesHtml += `<span class="month-badge" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); margin-right: 6px;">✍️ Gözetmenlik: +${monthItem.examTotalScore.toFixed(1)}</span>`;
        }
        if (monthItem.nonExamTotalScore > 0 || monthItem.nonExamTasks.length > 0) {
            badgesHtml += `<span class="month-badge" style="background: rgba(249, 115, 22, 0.15); color: #fdba74; border: 1px solid rgba(249, 115, 22, 0.3); margin-right: 6px;">🏢 Sinav Dişi: +${monthItem.nonExamTotalScore.toFixed(1)}</span>`;
        }
        badgesHtml += `<span class="month-badge badge-plus" style="font-size: 0.9rem;">Toplam: +${totalMonthScore.toFixed(1)} Puan</span>`;

        headerDiv.innerHTML = `
            <div class="month-info">
                <span class="month-title" style="min-width: 130px;">${monthItem.monthName}</span>
                <div>${badgesHtml}</div>
            </div>
            <span class="accordion-arrow">▼</span>
        `;

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'accordion-body';

        monthItem.examTasks.sort((a, b) => (a.date > b.date ? -1 : 1));
        monthItem.nonExamTasks.sort((a, b) => (a.date > b.date ? -1 : 1));

        let contentHtml = `<div style="padding: 1.2rem; display: flex; flex-direction: column; gap: 1.5rem;">`;

        // 1. Bölüm: Sinav Gözetmenlikleri
        if (monthItem.examTasks.length > 0) {
            contentHtml += `
                <div>
                    <div style="display:flex; align-items:center; gap: 8px; margin-bottom: 0.7rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(99,102,241,0.2);">
                        <span style="font-size: 1.1rem;">✍️</span>
                        <strong style="color: #818cf8; font-size: 0.95rem;">Sinav Gözetmenlikleri (${monthItem.examTasks.length} Görev)</strong>
                    </div>
                    <table class="task-list-table">
                        <thead>
                            <tr>
                                <th>Tarih & Saat</th>
                                <th>Sinav Adi</th>
                                <th>Konum</th>
                                <th style="text-align:right;">Puan</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthItem.examTasks.map(t => `
                                <tr>
                                    <td style="color:#cbd5e1; font-weight:600; white-space:nowrap;">${t.date} (${t.time})</td>
                                    <td><strong style="color:#fff;">${t.name}</strong></td>
                                    <td><span class="badge-location" style="font-size:0.75rem;">${t.location}</span></td>
                                    <td style="color:#818cf8; font-weight:700; text-align:right;">+${t.score.toFixed(1)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // 2. Bölüm: Sinav Dişi Görevler (Tercih Günleri vs.)
        if (monthItem.nonExamTasks.length > 0) {
            contentHtml += `
                <div>
                    <div style="display:flex; align-items:center; gap: 8px; margin-bottom: 0.7rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(249,115,22,0.2);">
                        <span style="font-size: 1.1rem;">🏢</span>
                        <strong style="color: #fb923c; font-size: 0.95rem;">Sinav Dişi Görevler (${monthItem.nonExamTasks.length} Görev)</strong>
                    </div>
                    <table class="task-list-table">
                        <thead>
                            <tr>
                                <th>Tarih & Saat</th>
                                <th>Görev Adi</th>
                                <th>Konum</th>
                                <th>Tür</th>
                                <th style="text-align:right;">Puan</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthItem.nonExamTasks.map(t => `
                                <tr>
                                    <td style="color:#cbd5e1; font-weight:600; white-space:nowrap;">${t.date} (${t.time})</td>
                                    <td><strong style="color:#fff;">${t.name}</strong></td>
                                    <td><span class="badge-location" style="font-size:0.75rem;">${t.location}</span></td>
                                    <td><span style="color:#fdba74; font-size:0.8rem; background:rgba(249,115,22,0.1); padding:2px 8px; border-radius:6px; border:1px solid rgba(249,115,22,0.25);">${t.type}</span></td>
                                    <td style="color:#fdba74; font-weight:700; text-align:right;">+${t.score.toFixed(1)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        contentHtml += `</div>`;
        bodyDiv.innerHTML = contentHtml;

        headerDiv.addEventListener('click', () => {
            const isActive = itemDiv.classList.contains('active');
            
            document.querySelectorAll('#scorecard-accordion-list .accordion-item.active').forEach(openEl => {
                if (openEl !== itemDiv) {
                    openEl.classList.remove('active');
                    const openBody = openEl.querySelector('.accordion-body');
                    if (openBody) openBody.style.maxHeight = null;
                }
            });

            if (isActive) {
                itemDiv.classList.remove('active');
                bodyDiv.style.maxHeight = null;
            } else {
                itemDiv.classList.add('active');
                bodyDiv.style.maxHeight = (bodyDiv.scrollHeight + 80) + "px";
            }
        });

        itemDiv.appendChild(headerDiv);
        itemDiv.appendChild(bodyDiv);
        listContainer.appendChild(itemDiv);

        // En güncel ayin detayini varsayilan olarak açik getir
        if (index === 0 && (monthItem.examTasks.length > 0 || monthItem.nonExamTasks.length > 0)) {
            setTimeout(() => {
                headerDiv.click();
            }, 150);
        }
    });
};




/* --- DYNAMIC GENDER THEME --- */
const FEMALE_NAMES = ['SIBEL','NURSEL','GULDEN','FERAY','ROGHAYEH','FATMA','AYTEN','ISIL','HULYA','AYSE','GULSEN','TUGBA','SAMIRE','SALIHA','ASLIHAN','CAGLA','EZGI','AYSEL','CANSU','SEYMA','BEGUM','SULTAN','YASEMIN','BUSRA','RUMEYSA','ZEYNEP'];
function applyGenderTheme() {
    const staffId = localStorage.getItem('myStaffId');
    if (!staffId || typeof DB === 'undefined' || !DB.staff) { document.body.classList.remove('theme-female'); return; }
    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff || !staff.name) { document.body.classList.remove('theme-female'); return; }
    const normalized = staff.name.toUpperCase().replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C').replace(/Ğ/g, 'G');
    const isFemale = FEMALE_NAMES.some(n => normalized.includes(n));
    if (isFemale) document.body.classList.add('theme-female');
    else document.body.classList.remove('theme-female');
}

// ===== SİSTEM SAĞLIĞI VE VERİ BÜTÜNLÜĞÜ MODÜLÜ =====

window.showDataHealthModal = function() {
    const modal = document.getElementById('modal-data-health');
    if (!modal) return;
    modal.classList.remove('hidden');
    runDataHealthCheck();
};

window.runDataHealthCheck = function() {
    const summaryCard = document.getElementById('data-health-summary-card');
    const detailsContainer = document.getElementById('data-health-details');
    if (!summaryCard || !detailsContainer) return;

    summaryCard.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Sistem taraniyor...</p>';
    detailsContainer.innerHTML = '';

    const report = (typeof validateDatabaseIntegrity === 'function')
        ? validateDatabaseIntegrity()
        : { isValid: true, healthScore: 100, doubleBookings: [], constraintClashes: [], scoreMismatches: [], unassignedExams: [], invalidProctorIds: [] };

    // Sağlik rozeti rengi
    let badgeColor = '#10b981';
    let badgeText = 'Mükemmel & Tutarli';
    if (report.healthScore < 80) { badgeColor = '#f59e0b'; badgeText = 'İnceleme Gerekli'; }
    if (report.healthScore < 50) { badgeColor = '#ef4444'; badgeText = 'Kritik Düzeltme Gerekli'; }

    summaryCard.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; width: 100%;">
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Sağlik Puani</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: ${badgeColor}; margin-top: 4px;">%${report.healthScore}</div>
                <div style="font-size: 0.75rem; color: ${badgeColor}; font-weight: 600;">${badgeText}</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Kayitli Sinav</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: #fff; margin-top: 4px;">${report.examCount || (DB.exams || []).length}</div>
                <div style="font-size: 0.75rem; color: #38bdf8;">0 Mükerrer Kayit</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Aktif Personel</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: #fff; margin-top: 4px;">${report.staffCount || (DB.staff || []).length}</div>
                <div style="font-size: 0.75rem; color: #a78bfa;">Puan & Görev Senkronize</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 10px; padding: 12px; text-align: center;">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Tespit Edilen Uyari</div>
                <div style="font-size: 1.8rem; font-weight: 800; color: ${report.isValid ? '#10b981' : '#f59e0b'}; margin-top: 4px;">${report.doubleBookings.length + report.scoreMismatches.length + report.constraintClashes.length}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Çakişma / İhlal</div>
            </div>
        </div>
    `;

    let html = '';

    // 1. Çifte Görev Çakişmasi
    if (report.doubleBookings.length > 0) {
        html += `<div style="margin-bottom: 14px;">
            <div style="font-weight: 700; color: #ef4444; font-size: 0.9rem; margin-bottom: 6px;">🚫 Çifte Görev Çakişmalari (${report.doubleBookings.length})</div>
            ${report.doubleBookings.map(d => `
                <div style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 8px 12px; border-radius: 4px; margin-bottom: 6px; font-size: 0.85rem;">
                    <strong>${d.staffName}</strong>: ${d.date} tarihinde hem <em>${d.exam1}</em> hem de <em>${d.exam2}</em> sinavinda görünüyor.
                </div>
            `).join('')}
        </div>`;
    }

    // 2. Kisit / Ders İhlali
    if (report.constraintClashes.length > 0) {
        html += `<div style="margin-bottom: 14px;">
            <div style="font-weight: 700; color: #f59e0b; font-size: 0.9rem; margin-bottom: 6px;">⚠️ Güz Dönemi Kisit / Ders Çakişmalari (${report.constraintClashes.length})</div>
            ${report.constraintClashes.map(c => `
                <div style="background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; padding: 8px 12px; border-radius: 4px; margin-bottom: 6px; font-size: 0.85rem;">
                    <strong>${c.staffName}</strong>: <em>${c.examName}</em> (${c.date} ${c.time}) sinavina atanmiş ancak <strong>${c.constraint}</strong> kisiti var.
                </div>
            `).join('')}
        </div>`;
    }

    // 3. Puan Uyuşmazliklari
    if (report.scoreMismatches.length > 0) {
        html += `<div style="margin-bottom: 14px;">
            <div style="font-weight: 700; color: #38bdf8; font-size: 0.9rem; margin-bottom: 6px;">📊 Puan Aritmetik Uyuşmazliklari (${report.scoreMismatches.length})</div>
            ${report.scoreMismatches.map(s => `
                <div style="background: rgba(56, 189, 248, 0.08); border-left: 3px solid #38bdf8; padding: 8px 12px; border-radius: 4px; margin-bottom: 6px; font-size: 0.85rem;">
                    <strong>${s.staffName}</strong>: Kayitli: ${s.recorded} P, Hesaplanan: ${s.computed} P (Fark: ${s.diff} P)
                </div>
            `).join('')}
        </div>`;
    }

    if (report.doubleBookings.length === 0 && report.constraintClashes.length === 0 && report.scoreMismatches.length === 0) {
        html = `
            <div style="text-align: center; padding: 2rem 1rem;">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
                <h4 style="color: #10b981; font-size: 1.1rem; margin-bottom: 0.5rem;">Veri Tabani %100 Sağlikli ve Kusursuz!</h4>
                <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 480px; margin: 0 auto; line-height: 1.5;">
                    Tüm puanlar matematiksel olarak doğrulanmiş, mükerrer sinav kaydi bulunmamiş ve çakişma tespit edilmemiştir.
                </p>
            </div>
        `;
    }

    detailsContainer.innerHTML = html;
};

window.handleAutoFixIntegrity = function() {
    const btn = document.getElementById('btn-fix-integrity');
    if (btn) { btn.disabled = true; btn.textContent = 'Onariliyor...'; }
    
    setTimeout(() => {
        if (typeof fixDatabaseIntegrity === 'function') {
            const result = fixDatabaseIntegrity();
            runDataHealthCheck();
            if (typeof renderStaff === 'function') renderStaff();
            if (typeof renderSchedule === 'function') renderSchedule();
            if (typeof showToast === 'function') {
                showToast(`✅ Sistem bütünlüğü başariyla onarildi (Sağlik: %${result.healthScore})`, 'success');
            }
        }
        if (btn) { btn.disabled = false; btn.textContent = '⚡ Otomatik Onar & Senkronize Et'; }
    }, 400);
};

// ==========================================
// 📅 GOOGLE / APPLE TAKVİM (.ICS) ENTEGRASYONU
// ==========================================

function generateICalContent(exams, calendarName = "Sinav Görevleri") {
    let ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//GTU//Gozetmenlik Katsayi Sistemi//TR",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-CALNAME:${calendarName}`,
        "X-WR-TIMEZONE:Europe/Istanbul"
    ];

    exams.forEach((ex, idx) => {
        if (!ex.date) return;
        const timeStr = ex.time || "09:00";
        const dateParts = ex.date.split('-');
        if (dateParts.length < 3) return;

        const y = dateParts[0];
        const m = dateParts[1].padStart(2, '0');
        const d = dateParts[2].padStart(2, '0');

        const timeParts = timeStr.split(':');
        const sh = (timeParts[0] || "09").padStart(2, '0');
        const sm = (timeParts[1] || "00").padStart(2, '0');

        const startStr = `${y}${m}${d}T${sh}${sm}00`;
        const dur = parseInt(ex.duration || 60, 10);

        const startDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), parseInt(sh, 10), parseInt(sm, 10));
        const endDate = new Date(startDate.getTime() + dur * 60000);

        const ey = endDate.getFullYear();
        const em = String(endDate.getMonth() + 1).padStart(2, '0');
        const ed = String(endDate.getDate()).padStart(2, '0');
        const eh = String(endDate.getHours()).padStart(2, '0');
        const emin = String(endDate.getMinutes()).padStart(2, '0');
        const endStr = `${ey}${em}${ed}T${eh}${emin}00`;

        const summary = `${ex.name || 'Sinav'} Gözetmenliği`;
        const location = ex.location || 'Belirtilmedi';
        const description = `Ders: ${ex.name}\\nÖğretim Üyesi: ${ex.lecturer || '-'}\\nDerslik: ${location}\\nSüre: ${dur} dk\\nMevcut: ${ex.capacity || '-'}`;
        const uid = `gtu-exam-${ex.id || idx}-${y}${m}${d}-${sh}${sm}@gtu.edu.tr`;

        ics.push(
            "BEGIN:VEVENT",
            `UID:${uid}`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
            `DTSTART;TZID=Europe/Istanbul:${startStr}`,
            `DTEND;TZID=Europe/Istanbul:${endStr}`,
            `SUMMARY:${summary.replace(/,/g,'\\,')}`,
            `LOCATION:${location.replace(/,/g,'\\,')}`,
            `DESCRIPTION:${description}`,
            "STATUS:CONFIRMED",
            "BEGIN:VALARM",
            "TRIGGER:-PT30M",
            "ACTION:DISPLAY",
            "DESCRIPTION:Sinav görevine 30 dakika kaldi",
            "END:VALARM",
            "END:VEVENT"
        );
    });

    ics.push("END:VCALENDAR");
    return ics.join("\r\n");
}

function downloadICalFile(icsContent, filename) {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

window.exportMyExamsToICal = function() {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) {
        showToast('Lütfen önce kimliğinizi seçin.', 'warning');
        return;
    }

    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    const myExams = DB.exams.filter(e => {
        if (typeof isStaffProctorById === 'function') return isStaffProctorById(e, myStaffId);
        return (e.proctorIds || [e.proctorId]).map(String).includes(String(myStaffId));
    });

    if (myExams.length === 0) {
        showToast('Takvime aktarilacak aktif sinav göreviniz bulunmuyor.', 'info');
        return;
    }

    const name = staff ? staff.name : 'Gozetmen';
    const icsData = generateICalContent(myExams, `${name} Sinav Görevleri`);
    downloadICalFile(icsData, `${name.replace(/\s+/g,'_')}_Sinav_Gorevleri.ics`);
    showToast(`📅 ${myExams.length} sinav görevi takvim (.ics) dosyasi olarak indirildi!`, 'success');
};

window.exportStaffExamsToICal = function(staffName) {
    const staff = DB.staff.find(s => s.name === staffName);
    if (!staff) return;

    const staffExams = DB.exams.filter(e => {
        if (typeof isStaffProctorById === 'function') return isStaffProctorById(e, staff.id);
        return (e.proctorIds || [e.proctorId]).map(String).includes(String(staff.id));
    });

    if (staffExams.length === 0) {
        showToast(`${staffName} için sinav görevi bulunamadi.`, 'info');
        return;
    }

    const icsData = generateICalContent(staffExams, `${staffName} Sinav Programi`);
    downloadICalFile(icsData, `${staffName.replace(/\s+/g,'_')}_Sinavlar.ics`);
    showToast(`📅 ${staffName} için takvim (.ics) dosyasi indirildi!`, 'success');
};

window.exportAllExamsToICal = function() {
    const allExams = DB.exams || [];
    if (allExams.length === 0) {
        showToast('İndirilecek sinav bulunamadi.', 'warning');
        return;
    }

    const icsData = generateICalContent(allExams, "GTÜ Bölüm Sinav Programi");
    downloadICalFile(icsData, `Genel_Sinav_Programi_${new Date().toISOString().split('T')[0]}.ics`);
    showToast(`📅 Toplam ${allExams.length} sinav takvim (.ics) dosyasi olarak indirildi!`, 'success');
};

// =======================================================
// 🏛️ DÖNEM SONU DEKANLIK & BÖLÜM İCMAL RAPORU MODÜLÜ
// =======================================================

window.openDekanlikReportModal = function() {
    const modal = document.getElementById('modal-dekanlik-report');
    if (!modal) return;
    renderDekanlikReportData();
    modal.classList.remove('hidden');
};

window.renderDekanlikReportData = function() {
    const tbody = document.querySelector('#table-dekanlik-report tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterType = document.getElementById('dekanlik-report-type-filter')?.value || 'all';

    let filteredExams = (DB.exams || []).slice();
    if (filterType !== 'all') {
        filteredExams = filteredExams.filter(e => {
            const t = (e.type || '').toLowerCase();
            return t.includes(filterType);
        });
    }

    let staffList = (DB.staff || []).slice().sort((a,b) => a.name.localeCompare(b.name, 'tr'));

    let totalStaffCount = staffList.length;
    let totalAssignments = 0;
    let totalDurationMins = 0;

    staffList.forEach((s, idx) => {
        const assignedExams = filteredExams.filter(e => {
            if (typeof isStaffProctorById === 'function') return isStaffProctorById(e, s.id);
            return (e.proctorIds || [e.proctorId]).map(String).includes(String(s.id));
        });

        const examCount = assignedExams.length;
        totalAssignments += examCount;

        const staffMins = assignedExams.reduce((acc, e) => acc + parseInt(e.duration || 60, 10), 0);
        totalDurationMins += staffMins;

        const hours = Math.floor(staffMins / 60);
        const mins = staffMins % 60;
        const durationStr = `${hours} sa ${mins > 0 ? mins + ' dk' : ''}`;

        const baseScore = parseFloat(s.baseScore || 0);
        const totalScore = parseFloat(s.totalScore || 0);
        const examScore = Math.max(0, parseFloat((totalScore - baseScore).toFixed(2)));
        const flexScore = calculateAvailabilityScore(s.id);

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        tr.innerHTML = `
            <td style="color:var(--text-muted); font-size:0.85rem;">${idx + 1}</td>
            <td>
                <div class="name-with-avatar">
                    ${getAvatarHtml(s.name)}
                    <strong style="color:white; font-size:0.9rem;">${s.name}</strong>
                </div>
            </td>
            <td><span class="email-text">${s.email || '-'}</span></td>
            <td style="text-align: center; font-weight: 700; color: #38bdf8;">${examCount}</td>
            <td style="text-align: center; color: var(--text-muted); font-size:0.85rem;">${durationStr}</td>
            <td style="text-align: center; color: #94a3b8;">${baseScore.toFixed(1)}</td>
            <td style="text-align: center; color: #f59e0b; font-weight: 600;">${examScore.toFixed(1)}</td>
            <td style="text-align: center; font-weight: 800; color: #10b981; font-size:0.95rem;">${totalScore.toFixed(1)}</td>
            <td style="text-align: center;">
                <span class="badge" style="background:${getScoreColor(flexScore)}22; color:${getScoreColor(flexScore)}; border:1px solid ${getScoreColor(flexScore)}44; font-weight:700;">
                    %${flexScore}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const totalHours = (totalDurationMins / 60).toFixed(1);
    const avgTasks = totalStaffCount > 0 ? (totalAssignments / totalStaffCount).toFixed(1) : '0';

    const elStaff = document.getElementById('dekanlik-stat-staff-count');
    const elExams = document.getElementById('dekanlik-stat-exam-count');
    const elHours = document.getElementById('dekanlik-stat-hours-count');
    const elAvg   = document.getElementById('dekanlik-stat-avg-tasks');

    if (elStaff) elStaff.textContent = totalStaffCount;
    if (elExams) elExams.textContent = totalAssignments;
    if (elHours) elHours.textContent = `${totalHours} Saat`;
    if (elAvg) elAvg.textContent = `${avgTasks} Sinav / Kişi`;
};

window.exportDekanlikReportExcel = function() {
    const filterType = document.getElementById('dekanlik-report-type-filter')?.value || 'all';
    let filteredExams = (DB.exams || []).slice();
    if (filterType !== 'all') {
        filteredExams = filteredExams.filter(e => (e.type || '').toLowerCase().includes(filterType));
    }

    const staffList = (DB.staff || []).slice().sort((a,b) => a.name.localeCompare(b.name, 'tr'));

    const headers = [
        "Sira No",
        "Personel Unvan & Ad Soyad",
        "E-posta",
        "Sinav Görevi Sayisi",
        "Toplam Görev Süresi (Saat)",
        "Taban Puan",
        "Sinav Katsayi Puani",
        "Genel Toplam Puan",
        "Müsaitlik Esneklik Skoru (%)"
    ];

    const data = [
        ["T.C. GEBZE TEKNİK ÜNİVERSİTESİ"],
        ["DÖNEM SONU SINAV GÖZETMENLİK VE ASİSTAN İŞ YÜKÜ İCMAL RAPORU"],
        [`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')} | Dönem Filtresi: ${filterType.toUpperCase()}`],
        [],
        headers
    ];

    let totalExamsAll = 0;
    let totalHoursAll = 0;

    staffList.forEach((s, idx) => {
        const assignedExams = filteredExams.filter(e => {
            if (typeof isStaffProctorById === 'function') return isStaffProctorById(e, s.id);
            return (e.proctorIds || [e.proctorId]).map(String).includes(String(s.id));
        });

        const examCount = assignedExams.length;
        totalExamsAll += examCount;

        const staffMins = assignedExams.reduce((acc, e) => acc + parseInt(e.duration || 60, 10), 0);
        const hoursNum = parseFloat((staffMins / 60).toFixed(1));
        totalHoursAll += hoursNum;

        const baseScore = parseFloat(s.baseScore || 0);
        const totalScore = parseFloat(s.totalScore || 0);
        const examScore = Math.max(0, parseFloat((totalScore - baseScore).toFixed(2)));
        const flexScore = calculateAvailabilityScore(s.id);

        data.push([
            idx + 1,
            s.name,
            s.email || '-',
            examCount,
            hoursNum,
            parseFloat(baseScore.toFixed(1)),
            parseFloat(examScore.toFixed(1)),
            parseFloat(totalScore.toFixed(1)),
            flexScore
        ]);
    });

    data.push([]);
    data.push([
        "GENEL TOPLAM / ORTALAMA",
        `Toplam ${staffList.length} Personel`,
        "",
        totalExamsAll,
        parseFloat(totalHoursAll.toFixed(1)),
        "",
        "",
        "",
        ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 8 },  // No
        { wch: 30 }, // Ad Soyad
        { wch: 28 }, // Eposta
        { wch: 20 }, // Sinav Sayisi
        { wch: 25 }, // Toplam Süre
        { wch: 14 }, // Taban Puan
        { wch: 18 }, // Sinav Puani
        { wch: 18 }, // Genel Toplam
        { wch: 25 }  // Esneklik
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dekanlik İcmal Raporu');
    XLSX.writeFile(wb, `Dekanlik_Donem_Sonu_Icmal_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('📊 Dekanlik İcmal Raporu Excel olarak indirildi!', 'success');
};

window.printDekanlikReportPDF = function() {
    const filterType = document.getElementById('dekanlik-report-type-filter')?.value || 'all';
    let filteredExams = (DB.exams || []).slice();
    if (filterType !== 'all') {
        filteredExams = filteredExams.filter(e => (e.type || '').toLowerCase().includes(filterType));
    }

    const staffList = (DB.staff || []).slice().sort((a,b) => a.name.localeCompare(b.name, 'tr'));

    let totalAssignments = 0;
    let totalDurationMins = 0;

    const rowsHtml = staffList.map((s, idx) => {
        const assignedExams = filteredExams.filter(e => {
            if (typeof isStaffProctorById === 'function') return isStaffProctorById(e, s.id);
            return (e.proctorIds || [e.proctorId]).map(String).includes(String(s.id));
        });

        const examCount = assignedExams.length;
        totalAssignments += examCount;
        const staffMins = assignedExams.reduce((acc, e) => acc + parseInt(e.duration || 60, 10), 0);
        totalDurationMins += staffMins;

        const hours = (staffMins / 60).toFixed(1);
        const baseScore = parseFloat(s.baseScore || 0).toFixed(1);
        const totalScore = parseFloat(s.totalScore || 0).toFixed(1);
        const examScore = Math.max(0, (totalScore - baseScore)).toFixed(1);
        const flexScore = calculateAvailabilityScore(s.id);

        return `
            <tr>
                <td style="text-align:center; padding:6px; border:1px solid #ccc;">${idx + 1}</td>
                <td style="padding:6px; border:1px solid #ccc; font-weight:600;">${s.name}</td>
                <td style="padding:6px; border:1px solid #ccc; font-size:12px;">${s.email || '-'}</td>
                <td style="text-align:center; padding:6px; border:1px solid #ccc; font-weight:bold;">${examCount}</td>
                <td style="text-align:center; padding:6px; border:1px solid #ccc;">${hours} Saat</td>
                <td style="text-align:center; padding:6px; border:1px solid #ccc;">${baseScore}</td>
                <td style="text-align:center; padding:6px; border:1px solid #ccc;">${examScore}</td>
                <td style="text-align:center; padding:6px; border:1px solid #ccc; font-weight:bold;">${totalScore}</td>
                <td style="text-align:center; padding:6px; border:1px solid #ccc;">%${flexScore}</td>
            </tr>
        `;
    }).join('');

    const totalHours = (totalDurationMins / 60).toFixed(1);
    const avgTasks = staffList.length > 0 ? (totalAssignments / staffList.length).toFixed(1) : '0';

    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Dönem Sonu Sinav İcmal Raporu - GTÜ</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #111; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 16px; }
                .header h2 { margin: 0; font-size: 18px; text-transform: uppercase; }
                .header h3 { margin: 4px 0; font-size: 15px; font-weight: 500; }
                .header p { margin: 4px 0 0 0; font-size: 12px; color: #555; }
                .stats-grid { display: flex; justify-content: space-around; background: #f4f4f5; padding: 10px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #e4e4e7; font-size: 13px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 25px; }
                th { background: #e2e8f0; padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; }
                .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 40px; }
                .sig-box { text-align: center; width: 220px; }
                .sig-line { border-bottom: 1px dashed #333; height: 50px; margin-bottom: 6px; }
                @media print {
                    @page { size: A4 landscape; margin: 12mm; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>T.C. GEBZE TEKNİK ÜNİVERSİTESİ</h2>
                <h3>DÖNEM SONU SINAV GÖZETMENLİK VE ASİSTAN İŞ YÜKÜ İCMAL RAPORU</h3>
                <p>Düzenleme Tarihi: ${new Date().toLocaleDateString('tr-TR')} | Kapsam: ${filterType.toUpperCase()} SINAVLARI</p>
            </div>

            <div class="stats-grid">
                <div><strong>Toplam Personel:</strong> ${staffList.length}</div>
                <div><strong>Toplam Görevlendirme:</strong> ${totalAssignments} Adet</div>
                <div><strong>Toplam Gözetmenlik Süresi:</strong> ${totalHours} Saat</div>
                <div><strong>Ortalama Görev / Asistan:</strong> ${avgTasks} Sinav</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width:30px;">No</th>
                        <th style="text-align:left;">Personel Unvan & Ad Soyad</th>
                        <th>E-posta</th>
                        <th>Sinav Sayisi</th>
                        <th>Toplam Süre</th>
                        <th>Taban Puan</th>
                        <th>Sinav Puani</th>
                        <th>Genel Toplam</th>
                        <th>Esneklik</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="signatures">
                <div class="sig-box">
                    <div style="font-weight:700;">Hazirlayan / Koordinatör</div>
                    <div class="sig-line"></div>
                    <div style="font-size:12px; color:#555;">İmza / Tarih</div>
                </div>
                <div class="sig-box">
                    <div style="font-weight:700;">Bölüm Başkani Onayi</div>
                    <div class="sig-line"></div>
                    <div style="font-size:12px; color:#555;">İmza / Mühür</div>
                </div>
                <div class="sig-box">
                    <div style="font-weight:700;">Dekanlik Tasdiki</div>
                    <div class="sig-line"></div>
                    <div style="font-size:12px; color:#555;">İmza / Mühür</div>
                </div>
            </div>
            <script>
                window.onload = function() { window.print(); };
            <\/script>
        </body>
        </html>
    `);
    printWin.document.close();
};

// ==========================================
// 1. SİSTEM URL VE ERİŞİM YARDIMCISI
// ==========================================
function getSystemUrl() {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return window.location.origin + window.location.pathname;
    }
    return 'https://sinav-gozetmenlik.gtu.edu.tr';
}
window.getSystemUrl = getSystemUrl;

// ==========================================
// 2. 24 SAAT ÖNCESİ SINAV HATIRLATICI (MODEL 2)
// ==========================================
window.openTomorrowReminderModal = function() {
    const modal = document.getElementById('modal-reminder-tomorrow');
    if (!modal) return;
    
    // Varsayilan: Yarinin tarihi
    const tomorrow = new Date(Date.now() + 86400000);
    const dateStr = tomorrow.toISOString().split('T')[0];
    const dateInput = document.getElementById('reminder-target-date');
    if (dateInput) {
        dateInput.value = dateStr;
    }
    
    window.renderTomorrowReminderData();
    modal.classList.remove('hidden');
};

window.setReminderDateOffset = function(daysOffset) {
    const target = new Date(Date.now() + daysOffset * 86400000);
    const dateStr = target.toISOString().split('T')[0];
    const dateInput = document.getElementById('reminder-target-date');
    if (dateInput) {
        dateInput.value = dateStr;
    }
    window.renderTomorrowReminderData();
};

window.renderTomorrowReminderData = function() {
    const targetDate = document.getElementById('reminder-target-date')?.value;
    const tbody = document.getElementById('reminder-staff-tbody');
    const badge = document.getElementById('reminder-stat-badge');
    const selectedCountSpan = document.getElementById('reminder-selected-count');
    const selectAllChk = document.getElementById('reminder-select-all');
    
    if (!targetDate || !tbody) return;

    // Seçilen tarihteki sinavlar
    const examsOnDate = (DB.exams || []).filter(e => e.date === targetDate);
    
    // Görevli bazli gruplama
    const staffDutyMap = new Map(); // staffId -> { staff, exams: [] }
    examsOnDate.forEach(exam => {
        const pIds = (exam.proctorIds && exam.proctorIds.length > 0) ? exam.proctorIds : (exam.proctorId ? [exam.proctorId] : []);
        pIds.forEach(pId => {
            const staff = (DB.staff || []).find(s => String(s.id) === String(pId));
            if (staff) {
                if (!staffDutyMap.has(staff.id)) {
                    staffDutyMap.set(staff.id, { staff, exams: [] });
                }
                staffDutyMap.get(staff.id).exams.push(exam);
            }
        });
    });

    const totalStaffCount = staffDutyMap.size;
    if (badge) {
        badge.innerHTML = `📋 <strong>${examsOnDate.length}</strong> Sinav &nbsp;|&nbsp; 👥 <strong>${totalStaffCount}</strong> Görevli Personel`;
    }

    if (totalStaffCount === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: #94a3b8; padding: 30px;">
                    📅 <strong>${targetDate}</strong> tarihinde planlanmiş herhangi bir gözetmenlik görevi bulunamadi.
                </td>
            </tr>
        `;
        if (selectedCountSpan) selectedCountSpan.textContent = '0 personel seçildi';
        if (selectAllChk) selectAllChk.checked = false;
        return;
    }

    const sortedEntries = Array.from(staffDutyMap.values()).sort((a,b) => a.staff.name.localeCompare(b.staff.name, 'tr'));

    let html = '';
    sortedEntries.forEach(entry => {
        const s = entry.staff;
        const examsHtml = entry.exams.map(e => `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 4px 8px; margin-bottom: 4px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                <span>🕐 <strong>${e.time}</strong> - ${e.name} ${e.location ? `(${e.location})` : ''}</span>
                <span style="color: #94a3b8; font-size: 0.75rem;">${e.duration || 60} dk</span>
            </div>
        `).join('');

        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="text-align: center; vertical-align: middle;">
                    <input type="checkbox" class="reminder-staff-check" data-staff-id="${s.id}" checked onchange="window.updateReminderSelectedCount()">
                </td>
                <td style="vertical-align: middle;">
                    <div style="font-weight: 600; font-size: 0.85rem; color: #f1f5f9;">${s.name}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8;">${entry.exams.length} Görev</div>
                </td>
                <td style="vertical-align: middle; font-size: 0.8rem; color: #cbd5e1;">
                    ${s.email || '<span style="color:#ef4444; font-size:0.75rem;">E-posta Yok</span>'}
                </td>
                <td style="vertical-align: middle;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        ${examsHtml}
                    </div>
                    <div style="margin-top: 4px; text-align: right;">
                        <button type="button" class="btn-secondary" style="font-size: 0.7rem; padding: 2px 8px; background: rgba(2,132,199,0.15); color: #38bdf8; border-color: rgba(2,132,199,0.3);" onclick="window.sendSingleStaffReminderOutlook(${s.id}, '${targetDate}')">
                            ✉️ Bireysel Outlook Taslaği Aç
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    if (selectAllChk) selectAllChk.checked = true;
    window.updateReminderSelectedCount();
};

window.toggleAllReminderStaff = function(checked) {
    document.querySelectorAll('.reminder-staff-check').forEach(chk => {
        chk.checked = checked;
    });
    window.updateReminderSelectedCount();
};

window.updateReminderSelectedCount = function() {
    const selected = document.querySelectorAll('.reminder-staff-check:checked').length;
    const total = document.querySelectorAll('.reminder-staff-check').length;
    const span = document.getElementById('reminder-selected-count');
    if (span) {
        span.textContent = `${selected} / ${total} personel seçildi`;
    }
};

window.sendSingleStaffReminderOutlook = function(staffId, targetDate) {
    const staff = (DB.staff || []).find(s => String(s.id) === String(staffId));
    if (!staff) return;

    const examsOnDate = (DB.exams || []).filter(e => {
        if (e.date !== targetDate) return false;
        if (typeof isStaffProctorById === 'function') return isStaffProctorById(e, staff.id);
        return (e.proctorIds || [e.proctorId]).map(String).includes(String(staff.id));
    });

    if (examsOnDate.length === 0) {
        alert("Bu personele ait seçilen tarihte görev bulunamadi.");
        return;
    }

    const siteUrl = getSystemUrl();
    const formattedDate = new Date(targetDate).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    let dutiesText = '';
    examsOnDate.forEach((e, idx) => {
        dutiesText += `${idx + 1}. Saat: ${e.time} | Ders: ${e.name} | Derslik: ${e.location || 'Derslik Belirtilmedi'} | Süre: ${e.duration || 60} dk\n`;
    });

    const subject = encodeURIComponent(`⏰ Sinav Görevi Hatirlatmasi (${formattedDate}) - Gebze Teknik Üniversitesi`);
    const body = encodeURIComponent(
`Sayin ${staff.name},

${formattedDate} tarihinde Üniversitemizde görevli olduğunuz sinav(lar) aşağida bilgilerinize sunulmuştur:

${dutiesText}
⚠️ ÖNEMLİ NOTLAR:
1. Sinav salonunda sinav başlama saatinden en az 15 dakika önce hazir bulunmaniz ve sinav tutanaklarini teslim almaniz rica olunur.
2. Kişisel sinav takviminize, mazeret bildirimlerinize ve gözetmenlik portalina aşağidaki bağlantidan doğrudan erişebilirsiniz:
👉 Sinav Sistemi: ${siteUrl}

İyi çalişmalar ve başarilar dileriz.

Gebze Teknik Üniversitesi
Sinav ve Gözetmenlik Koordinatörlüğü`
    );

    const mailtoUrl = `mailto:${staff.email || ''}?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
};

window.sendTomorrowRemindersViaOutlook = function() {
    const targetDate = document.getElementById('reminder-target-date')?.value;
    if (!targetDate) return;

    const checkedBoxes = Array.from(document.querySelectorAll('.reminder-staff-check:checked'));
    if (checkedBoxes.length === 0) {
        alert("Lütfen hatirlatma göndermek istediğiniz en az bir personeli seçin.");
        return;
    }

    const selectedStaffIds = checkedBoxes.map(chk => chk.dataset.staffId);
    const emails = [];
    selectedStaffIds.forEach(id => {
        const s = (DB.staff || []).find(st => String(st.id) === String(id));
        if (s && s.email && s.email.includes('@')) {
            emails.push(s.email.trim());
        }
    });

    const siteUrl = getSystemUrl();
    const formattedDate = new Date(targetDate).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const subject = encodeURIComponent(`⏰ Sinav Görevi Hatirlatmasi (${formattedDate}) - GTÜ`);
    const bodyText = 
`Sayin Hocalarimiz ve Araştirma Görevlilerimiz,

${formattedDate} tarihinde gerçekleştirilecek sinavlarda gözetmenlik göreviniz bulunmaktadir.

Lütfen sinav başlama saatinden en az 15 dakika önce ilgili sinav salonunda hazir bulunarak sinav tutanaklarini teslim aliniz.

Detayli kişisel sinav takviminize, görevli olduğunuz salonlara ve takas taleplerine aşağidaki bağlanti üzerinden erişebilirsiniz:
👉 Sinav Portali: ${siteUrl}

İyi çalişmalar dileriz.

Gebze Teknik Üniversitesi
Sinav Koordinatörlüğü`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(bodyText).catch(() => {});
    }

    const body = encodeURIComponent(bodyText);
    const bccList = emails.join(';');
    const mailtoUrl = `mailto:?bcc=${bccList}&subject=${subject}&body=${body}`;

    if (typeof showToast === 'function') {
        showToast(`📬 ${emails.length} personel için Outlook taslaği açiliyor... Metin panoya kopyalandi.`, 'success');
    }

    window.location.href = mailtoUrl;
};

window.sendTomorrowRemindersViaEmail = async function() {
    const targetDate = document.getElementById('reminder-target-date')?.value;
    if (!targetDate) return;

    const checkedBoxes = Array.from(document.querySelectorAll('.reminder-staff-check:checked'));
    if (checkedBoxes.length === 0) {
        alert("Lütfen hatirlatma göndermek istediğiniz en az bir personeli seçin.");
        return;
    }

    const emailSettings = DB.emailSettings || {};
    if (!emailSettings.enabled) {
        if (confirm("⚠️ Otomatik E-posta Servisi (EmailJS/SMTP) henüz aktif edilmemiş.\n\nOutlook üzerinden toplu mail taslaği açmak ister misiniz?")) {
            window.sendTomorrowRemindersViaOutlook();
        }
        return;
    }

    const siteUrl = getSystemUrl();
    const formattedDate = new Date(targetDate).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let successCount = 0;
    let failCount = 0;

    for (const chk of checkedBoxes) {
        const sId = chk.dataset.staffId;
        const staff = (DB.staff || []).find(st => String(st.id) === String(sId));
        if (!staff || !staff.email) {
            failCount++;
            continue;
        }

        const exams = (DB.exams || []).filter(e => {
            if (e.date !== targetDate) return false;
            if (typeof isStaffProctorById === 'function') return isStaffProctorById(e, staff.id);
            return (e.proctorIds || [e.proctorId]).map(String).includes(String(staff.id));
        });

        let dutyLines = exams.map(e => `• ${e.time} - ${e.name} (${e.location || 'Derslik Belirtilmedi'})`).join('\n');

        const message = 
`Sayin ${staff.name},

${formattedDate} tarihindeki sinav görevi hatirlatmaniz:
${dutyLines}

Sinav portalina erişmek ve takviminizi incelemek için: ${siteUrl}`;

        if (typeof sendSwapNotificationEmail === 'function') {
            const res = await sendSwapNotificationEmail({
                toStaffId: staff.id,
                toEmail: staff.email,
                subject: `⏰ Sinav Görevi Hatirlatmasi (${formattedDate})`,
                body: message,
                templateParams: {
                    to_name: staff.name,
                    site_url: siteUrl
                }
            });
            if (res.success) successCount++;
            else failCount++;
        }
    }

    if (typeof showToast === 'function') {
        showToast(`✅ ${successCount} personele hatirlatma gönderildi.${failCount > 0 ? ` (${failCount} e-posta iletilemedi)` : ''}`, 'success');
    } else {
        alert(`✅ ${successCount} personele hatirlatma e-postasi başariyla gönderildi.`);
    }
};

window.sendTomorrowRemindersViaWebhook = async function() {
    const targetDate = document.getElementById('reminder-target-date')?.value;
    if (!targetDate) return;

    const examsOnDate = (DB.exams || []).filter(e => e.date === targetDate);
    if (examsOnDate.length === 0) {
        alert("Seçilen tarihte duyurulacak herhangi bir sinav bulunamadi.");
        return;
    }

    const formattedDate = new Date(targetDate).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const siteUrl = getSystemUrl();

    const fields = examsOnDate.slice(0, 15).map(e => {
        const pNames = (e.proctorIds && e.proctorIds.length > 0)
            ? e.proctorIds.map(id => {
                const st = (DB.staff || []).find(s => String(s.id) === String(id));
                return st ? st.name : 'Bilinmeyen';
            }).join(', ')
            : (e.proctorName || 'Atanmadi');

        return {
            name: `📚 ${e.time} | ${e.name}`,
            value: `📍 **Yer:** ${e.location || 'Belirtilmedi'} | 🛡️ **Gözetmen:** ${pNames}`,
            inline: false
        };
    });

    if (typeof sendWebhookNotification === 'function') {
        const res = await sendWebhookNotification({
            title: `⏰ Sinav Hatirlatmasi: ${formattedDate}`,
            description: `Yarin gerçekleşecek olan toplam **${examsOnDate.length}** sinavin gözetmenlik ve salon görev dağilimi:`,
            fields: fields,
            color: 0xf59e0b,
            eventType: 'exam_reminder'
        });

        if (res.success) {
            if (typeof showToast === 'function') {
                showToast("📢 Webhook sinav hatirlatmasi başariyla paylaşildi!", "success");
            } else {
                alert("✓ Webhook bildirimi başariyla gönderildi!");
            }
        } else {
            alert("⚠️ Webhook gönderilemedi: " + (res.reason || res.error || 'Ayarlari kontrol edin'));
        }
    } else {
        alert("Webhook modülü bulunamadi.");
    }
};

// ==========================================
// 3. YAPAY ZEKA DAĞITIM & ADALET SİMÜLATÖRÜ (GİNİ)
// ==========================================
window._lastFairnessSimResult = null;

window.openFairnessSimulatorModal = function() {
    const modal = document.getElementById('modal-fairness-simulator');
    if (!modal) return;
    
    window.renderFairnessMetricsUI();
    
    // Simülasyon sonuç kutularini sifirla
    const resBox = document.getElementById('fairness-sim-results-box');
    const applyBtn = document.getElementById('btn-apply-fairness-sim');
    const applyNote = document.getElementById('sim-apply-note');
    const swapsCont = document.getElementById('fairness-swaps-container');
    
    if (resBox) resBox.classList.add('hidden');
    if (applyBtn) applyBtn.classList.add('hidden');
    if (applyNote) applyNote.classList.add('hidden');
    if (swapsCont) {
        swapsCont.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 30px 10px;">
                ⚡ <strong>"Simülasyon Çaliştir"</strong> butonuna basarak kisit, çakişma ve cuma kurallarini bozmadan adaleti en üst seviyeye çikaracak akilli görev transfer önerilerini görebilirsiniz.
            </div>
        `;
    }

    modal.classList.remove('hidden');
};

window.renderFairnessMetricsUI = function() {
    if (typeof calculateFairnessMetrics !== 'function') return;
    
    const stats = calculateFairnessMetrics(DB.staff || []);
    
    // Gini Karti
    const giniEl = document.getElementById('fairness-stat-gini');
    const giniLabel = document.getElementById('fairness-stat-gini-label');
    if (giniEl) giniEl.textContent = stats.gini.toFixed(4);
    if (giniLabel) {
        if (stats.gini < 0.15) giniLabel.textContent = "🌟 Mükemmele Yakin Eşit Dağilim";
        else if (stats.gini < 0.25) giniLabel.textContent = "👍 Çok İyi ve Dengeli Dağilim";
        else if (stats.gini < 0.35) giniLabel.textContent = "⚖️ Kabul Edilebilir Dağilim";
        else giniLabel.textContent = "⚠️ Eşitsizlik Var (Dengeleme Önerilir)";
    }

    // Skor Karti
    const scoreEl = document.getElementById('fairness-stat-score');
    if (scoreEl) {
        scoreEl.textContent = `%${stats.fairnessScore}`;
        if (stats.fairnessScore >= 85) scoreEl.style.color = '#10b981';
        else if (stats.fairnessScore >= 70) scoreEl.style.color = '#f59e0b';
        else scoreEl.style.color = '#ef4444';
    }

    // Standart Sapma Karti
    const stdEl = document.getElementById('fairness-stat-stddev');
    const avgEl = document.getElementById('fairness-stat-avg');
    if (stdEl) stdEl.textContent = `${stats.stdDev} P.`;
    if (avgEl) avgEl.textContent = `Ortalama: ${stats.avg} Puan`;

    // Makas Karti
    const rangeEl = document.getElementById('fairness-stat-range');
    const minmaxEl = document.getElementById('fairness-stat-minmax');
    if (rangeEl) rangeEl.textContent = `${stats.scoreRange} P.`;
    if (minmaxEl) minmaxEl.textContent = `Min: ${stats.minScore} | Max: ${stats.maxScore}`;

    // Benchmark
    const benchAvg = document.getElementById('fairness-benchmark-avg');
    if (benchAvg) benchAvg.textContent = `Hedef Ortalama: ${stats.avg} P.`;

    // Dağilim Çubuk Grafiği
    const barsContainer = document.getElementById('fairness-bars-container');
    if (!barsContainer) return;

    const staffList = (DB.staff || []).slice().sort((a,b) => (b.totalScore || 0) - (a.totalScore || 0));
    const maxScore = Math.max(...staffList.map(s => s.totalScore || 0), 1);

    let barsHtml = '';
    staffList.forEach(s => {
        const score = s.totalScore || 0;
        const diff = score - stats.avg;
        const pct = Math.min(100, Math.max(5, (score / maxScore) * 100));
        
        let barColor = 'linear-gradient(90deg, #0284c7, #38bdf8)';
        let badgeColor = '#38bdf8';
        let diffLabel = `±0.0`;

        if (diff > 1.5) {
            barColor = 'linear-gradient(90deg, #ea580c, #f97316)';
            badgeColor = '#fb923c';
            diffLabel = `+${diff.toFixed(1)} P.`;
        } else if (diff < -1.5) {
            barColor = 'linear-gradient(90deg, #6366f1, #818cf8)';
            badgeColor = '#a5b4fc';
            diffLabel = `${diff.toFixed(1)} P.`;
        } else {
            barColor = 'linear-gradient(90deg, #059669, #10b981)';
            badgeColor = '#34d399';
            diffLabel = diff >= 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;
        }

        barsHtml += `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 6px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 0.8rem;">
                    <span style="font-weight: 600; color: #f1f5f9;">${s.name} <span style="font-size:0.7rem; color:#94a3b8;">(${s.taskCount || 0} Görev)</span></span>
                    <span style="font-weight: 700; color: ${badgeColor};">${score.toFixed(1)} P. <small style="font-weight:normal; opacity:0.8;">(${diffLabel})</small></span>
                </div>
                <div style="height: 6px; background: rgba(0,0,0,0.4); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct}%; background: ${barColor}; border-radius: 3px; transition: width 0.4s ease;"></div>
                </div>
            </div>
        `;
    });

    barsContainer.innerHTML = barsHtml;
};

window.runFairnessRebalanceSimulation = function() {
    if (typeof simulateFairnessOptimization !== 'function') return;

    const simResult = simulateFairnessOptimization(10);
    window._lastFairnessSimResult = simResult;

    const resBox = document.getElementById('fairness-sim-results-box');
    const applyBtn = document.getElementById('btn-apply-fairness-sim');
    const applyNote = document.getElementById('sim-apply-note');
    const swapsCont = document.getElementById('fairness-swaps-container');

    if (resBox) {
        resBox.classList.remove('hidden');
        document.getElementById('sim-res-gini').textContent = `${simResult.before.gini.toFixed(4)} ➔ ${simResult.after.gini.toFixed(4)}`;
        document.getElementById('sim-res-score').textContent = `%${simResult.before.fairnessScore} ➔ %${simResult.after.fairnessScore}`;
        document.getElementById('sim-res-stddev').textContent = `±${simResult.before.stdDev} ➔ ±${simResult.after.stdDev} P.`;
    }

    if (!swapsCont) return;

    if (simResult.proposedSwaps.length === 0) {
        swapsCont.innerHTML = `
            <div style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; padding: 18px; text-align: center; color: #6ee7b7; font-size: 0.85rem;">
                🎉 <strong>Tebrikler!</strong><br>
                Mevcut kisit ve çakişma kurallari dahilinde sistem şu anda en adil ve optimal seviyededir. İlave transfer gerekmemektedir.
            </div>
        `;
        if (applyBtn) applyBtn.classList.add('hidden');
        if (applyNote) applyNote.classList.add('hidden');
        return;
    }

    let swapsHtml = `<div style="font-size: 0.8rem; color: #a5b4fc; font-weight: 600; margin-bottom: 8px;">💡 Yapay Zeka Tarafindan Önerilen ${simResult.proposedSwaps.length} Görev Transferi:</div>`;
    
    simResult.proposedSwaps.forEach((swap, idx) => {
        swapsHtml += `
            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; color: #f8fafc; margin-bottom: 4px;">
                    <span>${idx + 1}. 📚 ${swap.examName}</span>
                    <span style="color: #38bdf8;">+${swap.examScore} Puan</span>
                </div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 6px;">
                    📅 ${swap.examDate} | 🕐 ${swap.examTime}
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 6px; font-size: 0.8rem;">
                    <div style="color: #fca5a5;">
                        🛑 <strong>${swap.fromStaffName}</strong> <small>(${swap.fromStaffScoreBefore} P.)</small>
                    </div>
                    <div style="color: #10b981; font-size: 1rem; font-weight: bold;">➔</div>
                    <div style="color: #86efac;">
                        🟢 <strong>${swap.toStaffName}</strong> <small>(${swap.toStaffScoreBefore} P.)</small>
                    </div>
                </div>
            </div>
        `;
    });

    swapsCont.innerHTML = swapsHtml;

    if (applyBtn) {
        applyBtn.textContent = `🚀 ${simResult.proposedSwaps.length} Transferi Sisteme Uygula`;
        applyBtn.classList.remove('hidden');
    }
    if (applyNote) applyNote.classList.remove('hidden');
};

window.applyFairnessSimulationResults = async function() {
    const simResult = window._lastFairnessSimResult;
    if (!simResult || !simResult.proposedSwaps || simResult.proposedSwaps.length === 0) {
        alert("Uygulanacak transfer önerisi bulunmuyor.");
        return;
    }

    if (!confirm(`⚠️ Önerilen ${simResult.proposedSwaps.length} adet görev transferi onaylanarak sinav programina işlenecek ve sistem adalet skoru yükseltilecektir.\n\nOnayliyor musunuz?`)) {
        return;
    }

    // 1. Geri dönüş için Snapshot al
    if (typeof saveAutoSnapshot === 'function') {
        saveAutoSnapshot(DB, "Yapay Zeka Adalet Dengelemesi");
    }

    // 2. Transferleri DB.exams üzerinde uygula
    simResult.proposedSwaps.forEach(swap => {
        const exam = (DB.exams || []).find(e => e.id === swap.examId);
        if (exam) {
            exam.proctorIds = [swap.toStaffId];
            exam.proctorId = swap.toStaffId;
            exam.proctorName = swap.toStaffName;
        }
    });

    // 3. Personel puanlarini yeniden hesapla
    if (typeof calculateAllStaffScores === 'function') {
        calculateAllStaffScores();
    } else {
        (DB.staff || []).forEach(s => {
            const base = parseFloat(s.baseScore || 0);
            const myExams = (DB.exams || []).filter(e => {
                if (typeof isStaffProctorById === 'function') return isStaffProctorById(e, s.id);
                return (e.proctorIds || [e.proctorId]).map(String).includes(String(s.id));
            });
            const examScore = myExams.reduce((acc, e) => acc + (parseFloat(e.score) || 1), 0);
            s.totalScore = parseFloat((base + examScore).toFixed(2));
            s.taskCount = myExams.length;
        });
    }

    // 4. Kaydet
    saveToLocalStorage();
    if (sessionStorage.getItem('isAdmin') === 'true' && typeof saveToBackend === 'function') {
        try { await saveToBackend(); } catch(e) {}
    }

    // 5. Ekranlari tazele
    if (typeof renderExams === 'function') renderExams();
    if (typeof renderStaff === 'function') renderStaff();
    if (typeof renderSchedule === 'function') renderSchedule();
    if (typeof renderDashboard === 'function') renderDashboard();

    // 6. Simülatör UI tazele
    window.renderFairnessMetricsUI();
    
    const swapsCont = document.getElementById('fairness-swaps-container');
    if (swapsCont) {
        swapsCont.innerHTML = `
            <div style="background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; padding: 18px; text-align: center; color: #6ee7b7; font-size: 0.85rem;">
                ✅ <strong>Başarili!</strong><br>
                ${simResult.proposedSwaps.length} adet görev transferi programa işlendi. Adalet skoru <strong>%${simResult.after.fairnessScore}</strong> seviyesine yükseltildi.
            </div>
        `;
    }

    const applyBtn = document.getElementById('btn-apply-fairness-sim');
    const applyNote = document.getElementById('sim-apply-note');
    if (applyBtn) applyBtn.classList.add('hidden');
    if (applyNote) applyNote.classList.add('hidden');

    if (typeof showToast === 'function') {
        showToast(`🌟 ${simResult.proposedSwaps.length} görev transferiyle adalet puani %${simResult.after.fairnessScore}'a çikarildi!`, 'success');
    } else {
        alert(`✓ ${simResult.proposedSwaps.length} görev transferi başariyla uygulandi!`);
    }
};

// =============================================================
//  ⚡ VİZE / FİNAL SİHİRBAZI — Toplu Sinav Dönemi Planlayici
//  Katalogdaki 127 dersi filtreleyip toplu sinav oluşturur.
// =============================================================

window._batchPlannerFilter = 'all';
window._batchPlannerSearch = '';
window._batchPlannerData = []; // filtrelenmiş katalog

/**
 * Sihirbaz modalini açar ve listeyi başlangiç durumuna getirir.
 */
window.openBatchExamPlanner = function() {
    const modal = document.getElementById('modal-batch-exam-planner');
    if (!modal) return;

    window._batchPlannerFilter = 'all';
    window._batchPlannerSearch = '';

    // Filtre sekmelerini sifirla
    const tabs = document.querySelectorAll('#batch-planner-year-tabs .tab-btn');
    tabs.forEach((btn, i) => { btn.classList.toggle('active', i === 0); });

    // Arama kutusunu temizle
    const searchEl = document.getElementById('batch-planner-search');
    if (searchEl) searchEl.value = '';

    // Varsayilan sinav türünü katalog tipinden belirle (DB.examTypes varsa ilk siradaki)
    const typeSelect = document.getElementById('batch-default-type');
    if (typeSelect && DB.examTypes && DB.examTypes.length) {
        typeSelect.innerHTML = DB.examTypes.map(t => `<option>${t}</option>`).join('');
    }

    renderBatchPlannerList('all', '');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

/**
 * Sihirbaz modalini kapatir.
 */
window.closeBatchExamPlanner = function() {
    const modal = document.getElementById('modal-batch-exam-planner');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
};

/**
 * Yil / Düzey filtresi ve arama sorgusuna göre ders listesini render eder.
 */
window.renderBatchPlannerList = function(yearFilter, searchQuery) {
    const container = document.getElementById('batch-planner-list');
    const countEl = document.getElementById('batch-planner-course-count');
    const selectedCountEl = document.getElementById('batch-planner-selected-count');
    if (!container) return;

    const catalog = (typeof getCourseCatalog === 'function')
        ? getCourseCatalog()
        : (DB.courseCatalog || (typeof DEFAULT_COURSE_CATALOG !== 'undefined' ? DEFAULT_COURSE_CATALOG : []));

    const q = (searchQuery || '').trim().toLowerCase();

    const filtered = catalog.filter(c => {
        if (yearFilter !== 'all') {
            if (yearFilter === 'Servis') {
                if (c.year !== 'Servis') return false;
            } else if (yearFilter === 'Lisansüstü') {
                if (c.year !== 'Lisansüstü') return false;
            } else {
                if (parseInt(c.year) !== parseInt(yearFilter)) return false;
            }
        }
        if (q) {
            const hay = `${c.code} ${c.name} ${c.lecturer || ''} ${c.lang || ''} ${c.term || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    window._batchPlannerData = filtered;
    if (countEl) countEl.textContent = filtered.length;

    // Mevcut sinavlari referans al (mükerrerlik uyarisi için)
    const existingExamNames = new Set((DB.exams || []).map(e => (e.name || '').toLowerCase()));

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);">Filtreyle eşleşen ders bulunamadi.</div>`;
        if (selectedCountEl) selectedCountEl.textContent = '0';
        return;
    }

    container.innerHTML = filtered.map((c, idx) => {
        const courseKey = `${c.code} - ${c.name}`;
        const isDuplicate = [...existingExamNames].some(en => en.includes(c.code.toLowerCase()) || en.includes(c.name.toLowerCase()));
        const yearBadgeMap = { 1: '#3b82f6', 2: '#8b5cf6', 3: '#10b981', 4: '#f59e0b', 'Lisansüstü': '#ec4899', 'Servis': '#06b6d4' };
        const yearBadgeColor = yearBadgeMap[c.year] || '#94a3b8';
        const yearLabel = c.year === 'Lisansüstü' ? 'Lisansüstü' : c.year === 'Servis' ? 'Servis' : `${c.year}. Sinif`;

        return `<div class="batch-course-row" data-idx="${idx}" style="display:grid;grid-template-columns:auto 1fr auto auto auto auto auto auto;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);background:${idx % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent'};min-height:44px;transition:background 0.15s;" onmouseover="this.style.background='rgba(99,102,241,0.07)'" onmouseout="this.style.background='${idx % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent'}'">
            <input type="checkbox" class="batch-course-check" data-idx="${idx}" onchange="updateBatchSelectedCount()"
                style="width:16px;height:16px;accent-color:#7c3aed;cursor:pointer;flex-shrink:0;">
            <div style="min-width:0;">
                ${isDuplicate ? '<span title="Bu ders için sistemde zaten sinav mevcut" style="color:#f59e0b;margin-right:4px;font-size:0.9rem;">⚠️</span>' : ''}
                <span style="font-weight:600;font-size:0.85rem;color:white;">${c.code}</span>
                <span style="color:var(--text-muted);font-size:0.8rem;margin-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;display:inline-block;vertical-align:middle;">${c.name}</span>
                <span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:4px;font-size:0.7rem;font-weight:700;background:${yearBadgeColor}22;color:${yearBadgeColor};border:1px solid ${yearBadgeColor}44;">${yearLabel}</span>
            </div>
            <span style="font-size:0.75rem;color:#a5b4fc;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis;" title="${c.lecturer || ''}">${c.lecturer ? '👤 ' + c.lecturer.replace(/^(Prof\.|Doç\.|Dr\.|Araş\.\s*Gör\.|Öğr\.\s*Gör\.)\s*/i,'').split(' ').slice(-2).join(' ') : '—'}</span>
            <input type="date" class="batch-row-date" data-idx="${idx}"
                style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);padding:4px 6px;border-radius:6px;color:white;font-size:0.8rem;width:120px;">
            <input type="time" class="batch-row-time" data-idx="${idx}" value="09:00"
                style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);padding:4px 6px;border-radius:6px;color:white;font-size:0.8rem;width:85px;">
            <input type="number" class="batch-row-duration" data-idx="${idx}" value="90" min="30" max="300"
                style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);padding:4px 6px;border-radius:6px;color:white;font-size:0.8rem;width:65px;" placeholder="dk">
            <input type="text" class="batch-row-location" data-idx="${idx}" placeholder="Salon"
                style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);padding:4px 6px;border-radius:6px;color:white;font-size:0.8rem;width:90px;">
            <input type="number" class="batch-row-proctors" data-idx="${idx}" value="2" min="1" max="10"
                style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);padding:4px 6px;border-radius:6px;color:white;font-size:0.8rem;width:55px;" placeholder="Göz.">
        </div>`;
    }).join('');

    if (selectedCountEl) selectedCountEl.textContent = '0';
};

/**
 * Filtre sekmesi değiştirildiğinde çağrilir.
 */
window.filterBatchPlanner = function(yearFilter, btnEl, searchOverride) {
    window._batchPlannerFilter = yearFilter;

    if (btnEl) {
        const tabs = document.querySelectorAll('#batch-planner-year-tabs .tab-btn');
        tabs.forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
    }

    const q = searchOverride !== undefined ? searchOverride : (document.getElementById('batch-planner-search')?.value || '');
    window._batchPlannerSearch = q;
    renderBatchPlannerList(yearFilter, q);
};

/**
 * Tüm satirlarin checkbox durumunu değiştirir.
 */
window.selectAllBatchCourses = function(checked) {
    document.querySelectorAll('.batch-course-check').forEach(cb => { cb.checked = checked; });
    updateBatchSelectedCount();
};

/**
 * Seçili ders sayisini footer'da günceller.
 */
window.updateBatchSelectedCount = function() {
    const count = document.querySelectorAll('.batch-course-check:checked').length;
    const el = document.getElementById('batch-planner-selected-count');
    if (el) el.textContent = count;
};

/**
 * Global varsayilan değerleri seçili satirlara toplu olarak uygular.
 */
window.applyBatchPlannerDefaults = function() {
    const type = document.getElementById('batch-default-type')?.value || 'Vize';
    const date = document.getElementById('batch-default-date')?.value || '';
    const time = document.getElementById('batch-default-time')?.value || '09:00';
    const duration = document.getElementById('batch-default-duration')?.value || '90';
    const location = document.getElementById('batch-default-location')?.value || '';
    const proctors = document.getElementById('batch-default-proctors')?.value || '2';

    const checkedBoxes = document.querySelectorAll('.batch-course-check:checked');
    if (checkedBoxes.length === 0) {
        if (typeof showToast === 'function') showToast('⚠️ Önce uygulanacak dersleri seçin.', 'warning');
        else alert('Önce uygulanacak dersleri seçin.');
        return;
    }

    checkedBoxes.forEach(cb => {
        const idx = cb.dataset.idx;
        const row = document.querySelector(`[data-idx="${idx}"].batch-course-row`) || cb.closest('.batch-course-row');
        if (!row) return;
        const dateEl = row.querySelector('.batch-row-date');
        const timeEl = row.querySelector('.batch-row-time');
        const durationEl = row.querySelector('.batch-row-duration');
        const locationEl = row.querySelector('.batch-row-location');
        const proctorsEl = row.querySelector('.batch-row-proctors');
        if (date && dateEl) dateEl.value = date;
        if (time && timeEl) timeEl.value = time;
        if (duration && durationEl) durationEl.value = duration;
        if (location && locationEl) locationEl.value = location;
        if (proctors && proctorsEl) proctorsEl.value = proctors;
    });

    if (typeof showToast === 'function')
        showToast(`✅ ${checkedBoxes.length} derse varsayilan değerler uygulandi.`, 'success');
};

/**
 * Seçili dersler için DB.exams'a toplu sinav ekler.
 */
window.createBatchExams = async function() {
    const type = document.getElementById('batch-default-type')?.value || 'Vize';
    const checkedBoxes = document.querySelectorAll('.batch-course-check:checked');

    if (checkedBoxes.length === 0) {
        if (typeof showToast === 'function') showToast('⚠️ En az bir ders seçin.', 'warning');
        else alert('En az bir ders seçin.');
        return;
    }

    const catalog = window._batchPlannerData || [];
    const errors = [];
    const created = [];

    checkedBoxes.forEach(cb => {
        const idx = parseInt(cb.dataset.idx);
        const course = catalog[idx];
        if (!course) return;

        const row = cb.closest('.batch-course-row');
        if (!row) return;

        const date = row.querySelector('.batch-row-date')?.value || '';
        const time = row.querySelector('.batch-row-time')?.value || '09:00';
        const duration = parseInt(row.querySelector('.batch-row-duration')?.value || '90', 10);
        const location = row.querySelector('.batch-row-location')?.value || 'Belirsiz';
        const requiredProctors = parseInt(row.querySelector('.batch-row-proctors')?.value || '2', 10);

        if (!date) {
            errors.push(`${course.code}: Tarih girilmedi`);
            return;
        }

        // Bitiş saatini hesapla (HH:MM-HH:MM formati)
        let timeRange = time;
        try {
            const [h, m] = time.split(':').map(Number);
            const endTotalMins = h * 60 + m + duration;
            const endH = Math.floor(endTotalMins / 60) % 24;
            const endM = endTotalMins % 60;
            timeRange = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}-${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
        } catch(e) { timeRange = time; }

        // Katsayi hesapla
        const katsayi = (typeof calculateKatsayi === 'function')
            ? calculateKatsayi({ duration, location, requiredProctors, type })
            : parseFloat(((duration / 60) * 1.0).toFixed(2));

        const newExam = {
            id: Date.now() + Math.floor(Math.random() * 10000) + created.length,
            name: `${course.code} - ${course.name}`,
            lecturer: course.lecturer || '',
            date,
            time: timeRange,
            duration,
            location,
            capacity: 30,
            type,
            requiredProctors,
            proctors: [],
            proctorIds: [],
            isNonExam: false,
            katsayi: katsayi,
            isDraft: false
        };

        DB.exams.push(newExam);
        created.push(newExam);
    });

    if (created.length === 0 && errors.length > 0) {
        alert('Hiç sinav oluşturulamadi:\n' + errors.join('\n'));
        return;
    }

    // Kaydet ve UI'i güncelle
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    if (typeof saveToBackend === 'function') await saveToBackend();
    if (typeof renderExams === 'function') renderExams();
    if (typeof renderSchedule === 'function') renderSchedule();
    if (typeof renderDashboard === 'function') renderDashboard();

    closeBatchExamPlanner();

    const msg = `✅ ${created.length} sinav başariyla sisteme eklendi!${errors.length ? `\n⚠️ ${errors.length} ders atlandi (tarih girilmemiş).` : ''}`;
    if (typeof showToast === 'function') showToast(msg, 'success');
    else alert(msg);

    // Yapay zeka atamasi kisayolu
    if (created.length > 0 && typeof openAIAssignModal === 'function') {
        setTimeout(() => {
            if (confirm(`${created.length} yeni sinav eklendi.\nHemen yapay zeka ile gözetmen atamasi yapmak ister misiniz?`)) {
                openAIAssignModal();
            }
        }, 500);
    }
};

// ==========================================
// EXCEL (CSV) ÇIKTISI ALMA
// ==========================================
window.exportScheduleToExcel = function() {
    if (!DB || !DB.exams || DB.exams.length === 0) {
        alert("Dişa aktarilacak sinav bulunamadi.");
        return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM, Excel'de Türkçe karakterlerin düzgün görünmesi için
    csvContent += "Tür,Ders/Sinav,Dersi Veren,Derslik/Yer,Tarih,Saat,Sure (Dk),Atanan Gozetmenler\n";

    const sortedExams = [...DB.exams].sort((a, b) => {
        const dateA = new Date((a.date || '1970-01-01') + 'T' + (a.time || '00:00'));
        const dateB = new Date((b.date || '1970-01-01') + 'T' + (b.time || '00:00'));
        return dateA - dateB;
    });

    sortedExams.forEach(ex => {
        const type = (ex.type || '').toUpperCase();
        const name = (ex.name || '').replace(/,/g, ' ');
        const lecturer = (ex.lecturer || '').replace(/,/g, ' ');
        const location = (ex.location || '').replace(/,/g, ' ');
        const date = ex.date || '';
        const time = ex.time || '';
        const duration = ex.duration || '';
        
        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        let proctors = pIds.map(pid => {
            const s = DB.staff.find(staff => String(staff.id) === String(pid));
            return s ? s.name : '';
        }).filter(n => n).join(' & ');
        
        if (!proctors && ex.proctorName) proctors = ex.proctorName;
        proctors = proctors.replace(/,/g, ' '); // Virgülleri temizle ki sütunlar kaymasin

        const row = `${type},${name},${lecturer},${location},${date},${time},${duration},${proctors}`;
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const filename = `Sinav_Programi_${dateStr}.csv`;

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (typeof window.showToast === 'function') {
        window.showToast("Sinav programi başariyla Excel (CSV) formatinda indirildi.", "success");
    }
};









