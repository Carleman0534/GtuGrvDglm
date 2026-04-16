/**
 * Gözetmenlik UI Kontrolcü
 */

/**
 * Puan rengine göre şık bir renk döndürür.
 */
window.getScoreColor = function(score) {
    if (score >= 80) return "#10b981"; // Yeşil (Çok Esnek)
    if (score >= 50) return "#f59e0b"; // Turuncu (Orta)
    return "#ef4444"; // Kırmızı (Kısıtlı)
};


document.addEventListener('DOMContentLoaded', () => {
    const loginOverlay = document.getElementById('login-overlay');
    const appWrapper = document.getElementById('app-wrapper');
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
        
        // Hoca modunda her şeyi gizle, sadece programı ve yeni portalı göster
        if (isLecturerMode) {
            document.body.classList.add('lecturer-mode');
            document.querySelectorAll('.lecturer-only').forEach(el => el.classList.remove('hidden'));
            
            // Başlangıçta Programı göster
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
            // Buton zaten navButtons içinde olduğu için ayrıca listener eklemeye gerek yok, 
            // yukarıdaki Object.entries(navButtons).forEach döngüsü bunu halledecek.
        }

        // Portal dropdown listeners moved to functions themselves or global scope for reliability
        
        if (isLecturer) {
            // Olası event listener asenkron gecikmelerini aşmak için kısa bir gecikme ve fallback
            setTimeout(() => {
                const btnSchedule = document.getElementById('btn-schedule');
                if (btnSchedule) btnSchedule.click();
                
                // Eğer click listener henüz bağlanmadıysa diye manuel çağır (fallback)
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
        const password = loginPassInput.value.trim();
        if (!password) return;

        // 1. Yönetici şifresi
        if (password === ADMIN_PASSWORD) {
            sessionStorage.setItem('userPassword', password);
            logAction('system', 'Giriş', 'Yönetici girişi yapıldı.');
            if (loginError) loginError.classList.add('hidden');
            finishLogin(true);
            return;
        }

        // 2. Genel gözetmen şifresi (kimlik seçimi manuel)
        if (password === GOZETMEN_PASSWORD) {
            logAction('system', 'Giriş', 'Gözetmen girişi yapıldı.');
            if (loginError) loginError.classList.add('hidden');
            finishLogin(false);
            return;
        }

        // 3. Bireysel gözetmen şifresi - DB'den kontrol et
        // Önce localStorage cache'e bak (hızlı)
        let staffList = [];
        const cached = localStorage.getItem(DB_KEY);
        if (cached) {
            try { staffList = JSON.parse(cached).staff || []; } catch(e) {}
        }
        // Cache yoksa backend'den yükle
        if (staffList.length === 0) {
            if (btnLogin) { btnLogin.textContent = 'Kontrol ediliyor...'; btnLogin.disabled = true; }
            await loadFromDataJSON();
            staffList = DB.staff || [];
            if (btnLogin) { btnLogin.textContent = 'Giriş Yap'; btnLogin.disabled = false; }
        }

        const matchedStaff = staffList.find(s => s.staffPassword && s.staffPassword === password);
        if (matchedStaff) {
            localStorage.setItem('myStaffId', String(matchedStaff.id));
            logAction('system', 'Giriş', `${matchedStaff.name} kişisel şifresiyle giriş yaptı.`);
            if (loginError) loginError.classList.add('hidden');
            finishLogin(false);
            return;
        }

        // 4. Hatalı şifre
        if (loginError) loginError.classList.remove('hidden');
        loginPassInput.value = '';
        loginPassInput.focus();
    };

    if (btnLogin) btnLogin.addEventListener('click', handleLogin);

    if (btnLoginLecturer) {
        btnLoginLecturer.addEventListener('click', () => {
            logAction('system', 'Giriş', 'Hoca girişi yapıldı (Sadece Program).');
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

// UI Bileşenleri ve Navigasyon Yapısı
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
        });
    });
}

async function initApp() {
    // Sitenin en güncel veriyi Backend API'den asenkron olarak okumasını bekliyoruz
    await loadFromDataJSON();

    // Tüm eski yamalar (v2-v20) kaldırıldı. Veriler artık backend'deki data.json'dan geliyor.
    // Eski yama kodları gereksizdir çünkü data.json zaten tüm düzeltmeleri içermektedir.

    // Initialize DB.requests if not present
    if (!DB.requests) DB.requests = [];
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
    
    // Varsayılan/Zorunlu duyuruları kontrol et ve eksikse ekle
    const defaultAnnouncements = [
        {
            id: 1,
            text: "### 📢 Rehber: Kısıt Ayarlarım Sistemi Ne Zaman Kullanılmalıdır?\n\nYeni eklenen **Kısıt Ayarlarım** özelliği ile sınav görevlendirmelerinizi daha düzenli hale getirebilirsiniz. Aşağıdaki durumlarda kısıt girmeniz önerilir:\n\n1. **Ders Saatleriniz:** Haftalık sabit ders saatlerinizi sisteme girerek sınavların derslerinizle çakışmasını engelleyebilirsiniz.\n2. **Toplantılar:** Sabit bölüm toplantıları veya araştırma saatleriniz için haftalık kısıt ekleyebilirsiniz.\n3. **Özel Randevular:** Sadece belirli bir tarihte (örn: hastane randevusu) özel bir işiniz varsa o günü kapatabilirsiniz.\n4. **Ulaşım:** Şehir dışına çıkacağınız tarihlerde sistemin size görev verilmesini önlemek için tarih bazlı kısıt ekleyebilirsiniz.\n\n[Kısıt Ayarlarınızı Hemen Güncelleyin]({{AVAIL_LINK}})",
            isImportant: true,
            updatedAt: new Date().toISOString()
        },
        {
            id: 2,
            text: "### 📢 DUYURU 2: Müsaitlik ve Kısıt Girişi\n\nSistemin doğru çalışabilmesi için müsait olmadığınız gün ve saatleri girmeniz önemlidir.\n\n👉 Kendi müsait olmadığınız saatleri sistem üzerinden girebilirsiniz.\n\nBu bilgiler:\n- Size uygun görevlerin belirlenmesinde\n- Yerine geçme önerilerinin doğru yapılmasında\n\naktif olarak kullanılacaktır.",
            isImportant: false,
            updatedAt: new Date().toISOString()
        },
        {
            id: 3,
            text: "### 📢 DUYURU 3: Akıllı Eşleştirme Sistemi\n\nSistem, yerine geçecek kişileri rastgele değil, belirli kriterlere göre akıllı şekilde önerir.\n\nDeğerlendirme kriterleri:\n- Müsaitlik durumu\n- Toplam görev sayısı (adaletli dağılım)\n- Aynı gün içindeki görev yoğunluğu\n\nBu sayede görev dağılımı daha dengeli ve adil hale getirilir.",
            isImportant: false,
            updatedAt: new Date().toISOString()
        },
        {
            id: 4,
            text: "### 📢 DUYURU 4: Bildirim ve Devralma Süreci\n\nPazar yeri süreci artık daha hızlı:\n1. Talep oluşturulur\n2. Uygun kişilere bildirim gider\n3. Bir kullanıcı talebi kabul eder\n4. İşlem anında gerçekleşir ve puanlar güncellenir\n\nTüm süreç profilinizden takip edilebilir.",
            isImportant: false,
            updatedAt: new Date().toISOString()
        },
        {
            id: 5,
            text: "### 📢 DUYURU 5: Önemli Bilgilendirme\n\n- Aynı görev için yalnızca bir aktif talep oluşturabilirsiniz\n- Pazar yerinden alınan görevler anında kesinleşir\n- Kendi oluşturduğunuz talepleri dilediğiniz zaman iptal edebilirsiniz",
            isImportant: true,
            updatedAt: new Date().toISOString()
        },
        {
            id: 6,
            text: "### 🛒 Pazar Yeri (Açık Görevler) Kullanım Kılavuzu\n\nSınav görevlendirme sisteminde yer alan **Pazar Yeri (Açık Görevler)** sekmesi, hocalarımızın kendi aralarında görev devri yapmalarını kolaylaştırmak için tasarlanmıştır.\n\n**Pazar Yeri Nasıl Çalışır?**\n1. **Görev Paylaşımı:** Bir hoca, \"Yerime Biri Lazım\" butonuna basarak görevini Pazar Yeri'ne bırakabilir.\n2. **Görev Almak:** Başka bir hoca, Pazar Yeri'nde listelenen bir görevi \"Görevi Al\" butonuna basarak anında üstlenebilir.\n3. **Gizleme:** İlgilenmediğiniz görevleri \"Reddet\" butonu ile listenizden gizleyebilirsiniz.\n\n[Açık Görevleri Şimdi İnceleyin]({{MARKET_LINK}})",
            isImportant: true,
            updatedAt: new Date().toISOString()
        },
        {
            id: 7,
            text: "### 📢 Manuel Yerine Atama Hakkında\n\nSistem üzerinden otomatik talep oluşturmanın yanı sıra, dilerseniz yerinize geçecek kişiyi manuel olarak da seçebilirsiniz.\n\nBunun için:\n\n**Personel listesi üzerinden**\nveya\n**Sistem içinde ilgili kişinin adına tıklayarak**\n\n“Yerine Ata” seçeneğini kullanabilirsiniz.\n\nSeçtiğiniz kişinin müsait olması durumunda atama işlemini başlatabilirsiniz.",
            isImportant: true,
            updatedAt: new Date().toISOString()
        },
        {
            id: 8,
            text: "### 🛒 Pazar Yeri Süreç Güncellemesi\n\nArtık pazar yerinden (\"Açık Görevler\") bir görev devralmak çok daha kolay! Bir görevi kabul ettiğinizde, devreden kişinin onayına gerek kalmadan işlem anında gerçekleşecek ve görev profilinize eklenecektir.\n\n[Açık Görevleri Şimdi İnceleyin]({{MARKET_LINK}})",
            isImportant: true,
            updatedAt: new Date().toISOString()
        },
        {
            id: 9,
            text: "### 🔄 Önemli: Takas ve Devir Süreci Güncellendi!\n\nArtık gözetmenler arasındaki görev takasları ve devirleri için **yönetici onayı gerekmemektedir.**\n\nİşleyiş:\n1. Diğer hoca ile anlaştığınızda (Direct Swap) veya Pazar Yeri'nden bir görev aldığınızda işlem **anında** gerçekleşir.\n2. Puanlar ve görev listeleri otomatik olarak güncellenir.\n3. Süreci hızlandırmak için yönetici bekleme aşaması tamamen kaldırılmıştır.\n\nİyi görevler dileriz.",
            isImportant: true,
            updatedAt: new Date().toISOString()
        }
    ];

    defaultAnnouncements.forEach(def => {
        const existingIdx = DB.announcements.findIndex(a => a.id === def.id);
        if (existingIdx !== -1) {
            // Mevcut duyuruyu güncelle (Örn: Onay süreci kısımları değiştiği için)
            DB.announcements[existingIdx] = def;
        } else {
            DB.announcements.push(def);
        }
    });

    // Sınav Türleri Başlatma
    if (!DB.examTypes || !Array.isArray(DB.examTypes) || DB.examTypes.length === 0) {
        DB.examTypes = ['Vize', 'Final', 'Bütünleme', 'Ek Sınav', 'Mazeret', 'Tercih Günü', 'Diğer'];
    }

    if (!DB.templates) {
        DB.templates = {
            swap_request: "Merhaba {alici_adi},\n\n{tarih} tarihindeki {sinav_adi} sınavımdaki görevimi seninle takas etmek istiyorum. Onay verirsen yöneticiye bildireceğim.\n\nİyi çalışmalar,\n{gonderen_adi}",
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

    initNavigation();
    initUI();
    applyTheme(); // Theme on load
    renderProfile();
    updateRequestBadge(); // Update badge on load
    updateAnnouncementBadge(); // New announcement badge
    updateMarketplaceBadge(); // Marketplace badge
    updateNotificationBadge(); // Notification badge
    updateMessageBadge(); // Hoca mesajı rozeti
    loadStaffSelects(); // Personel seçim dropdownlarını yükle
    updateDraftBanner(); // Taslak Modu Banner'ı Güncelle
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
                <div style="font-size:0.7rem; opacity:0.8; font-weight:500;">Yapılan atamalar hocalara bildirilmez.</div>
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <button onclick="handleAIButtonClick()" class="btn-primary" style="background:#8b5cf6; border:1px solid rgba(255,255,255,0.2); box-shadow:0 0 15px rgba(139, 92, 246, 0.4);">✨ AI Optimizasyon</button>
            <button onclick="handlePublishDraft()" class="btn-primary" style="background:#10b981; border:1px solid rgba(255,255,255,0.2); box-shadow:0 0 15px rgba(16, 185, 129, 0.4);">🚀 Taslağı Yayınla</button>
        </div>
    `;
}

window.handleAIButtonClick = function() {
    if (confirm("Atanmamış tüm sınavlar için AI destekli en adil dağıtım yapılacaktır. Onaylıyor musunuz?")) {
        const res = runGlobalOptimization();
        alert(`✅ Optimizasyon Tamamlandı!\n\n${res.assigned} sınav başarıyla atandı.\n${res.failed} sınav için uygun gözetmen bulunamadı.`);
        renderDashboard();
        renderExams();
        renderSchedule();
    }
};

window.handlePublishDraft = function() {
    const draftCount = DB.exams.filter(e => e.isDraft).length;
    if (draftCount === 0) {
        alert("Yayına alınacak taslak sınav bulunamadı.");
        return;
    }

    if (confirm(`${draftCount} adet sınav yayına alınacak ve ilgili gözetmenlere bildirim gönderilecektir. Devam edilsin mi?`)) {
        const res = publishDraft();
        alert(`🚀 Başarılı!\n\n${res.examCount} sınav yayına alındı.\n${res.proctorCount} gözetmene bildirim gönderildi.`);
        updateDraftBanner();
        renderDashboard();
        renderExams();
        renderSchedule();
    }
};


/**
 * Takas onayı için şifre doğrulama yardımcısı.
 * Gözetmenin staffPassword'ı varsa modal açar ve doğru şifre girilince resolve eder.
 * staffPassword yoksa doğrudan onay (confirm) alır.
 * @param {string} description - Modalde gösterilecek açıklama
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

        // Şifre modalını aç
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
            if (input.value === staff.staffPassword) {
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

function initUI() {
    document.getElementById('btn-add-exam').addEventListener('click', showAddExamModal);
    document.getElementById('btn-manage-types')?.addEventListener('click', () => {
        document.getElementById('modal-manage-types').classList.remove('hidden');
        renderExamTypesList();
    });
    document.getElementById('btn-add-staff').addEventListener('click', showAddStaffModal);
    document.getElementById('btn-modal-cancel').addEventListener('click', hideModal);

    // PDF Export Listeners
    document.getElementById('btn-export-dashboard-pdf')?.addEventListener('click', () => exportToPDF('table-duty-breakdown', 'Dashboard Puan Dağılımı'));
    document.getElementById('btn-export-staff-pdf')?.addEventListener('click', () => exportToPDF('table-staff', 'Personel Listesi'));
    document.getElementById('btn-export-exams-pdf')?.addEventListener('click', () => exportToPDF('table-exams', 'Sınav Listesi'));
    document.getElementById('btn-export-schedule-pdf')?.addEventListener('click', () => {
        let targetId = 'table-schedule';
        let pdfTitle = 'Genel Sınav Programı';
        if (currentScheduleView === 'calendar') {
             // Takvim görünümünde PDF yerine Resim öneriliyor ama opsiyonel olarak resim basarız
             exportElementAsImage(document.getElementById('calendar-grid'), 'Sinav_Programi_Takvim.png');
             return;
        }
        exportToPDF(targetId, pdfTitle);
    });

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
                errorEl.textContent = `🔒 "${selectedStaff.name}" profili şifre korumalı. Lütfen yukarıdaki şifre alanını kullanın.`;
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

        const matched = DB.staff.find(s => s.staffPassword && s.staffPassword === pass);
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
            if (tabId === 'responsible') {
                clearMessageBadge();
            }
        });
    });

    // Kişisel takvim ay nav butonları
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
                let msg = `✅ ${result.resolved} çakışma başarıyla giderildi!`;
                if (result.skipped > 0) {
                    msg += `\n⚠️ ${result.skipped} çakışma için uygun yedek gözetmen bulunamadı. Bu sınavları lütfen manuel olarak düzenleyin.`;
                }
                alert(msg);
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
            link.download = `data.json`;
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
                reader.onload = async (event) => {
                    try {
                        const importedDB = JSON.parse(event.target.result);
                        if (importedDB && importedDB.staff && importedDB.exams) {
                            if (confirm("Mevcut tüm veriler silinecek ve seçilen yedeğe dönülecek. Onaylıyor musunuz?")) {
                                DB = importedDB;
                                saveToLocalStorage();
                                
                                // Admin girişi ise reload öncesi sunucuya yazmayı BEKLE (reload işlemi fetch'i iptal etmesin diye)
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

    // Taslak Modu Toggle
    document.getElementById('btn-toggle-draft-mode')?.addEventListener('click', () => {
        DB.isDraftMode = !DB.isDraftMode;
        saveToLocalStorage();
        updateDraftBanner();
        if (DB.isDraftMode) {
            showToast("🛠️ Taslak Modu Açıldı. Atamalar gizli kalacak.", "success");
        } else {
            showToast("Taslak Modu Kapatıldı.", "success");
        }
    });

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
                ['MATH 101', 'Amfi 1', '2025-03-20', '09:00', '90', 'Gülay Mert']
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
        btnConfirm.addEventListener('click', async () => {
            const data = btnConfirm._importData;
            if (!data || !data.rows || data.rows.length < 2) return;

            const rows = data.rows;
            const headers = rows[0].map(h => String(h).trim().toLowerCase());
            
            // Sütun indekslerini bul
            const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k.toLowerCase())));

            // Import Türü Belirle
            const isStaffImport = getIdx(['isim', 'personel', 'ad soyad']) !== -1 && getIdx(['sınav', 'ders', 'tarih']) === -1;

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
                alert(`✅ ${addedCount} hoca sisteme eklendi.${skipCount > 0 ? ` (${skipCount} mükerrer kayıt atlandı.)` : ''}`);
            } else {
                // --- Sınav İçe Aktar ---
                const nameIdx = getIdx(['sınav', 'ders', 'name', 'exam']);
                const dateIdx = getIdx(['tarih', 'date']);
                const timeIdx = getIdx(['saat', 'time', 'vakit']);
                const durIdx = getIdx(['süre', 'duration']);
                const locIdx = getIdx(['yer', 'derslik', 'sınıf', 'location']);
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
                        const score = calculateScore(new Date(`${date}T${time}`), duration);
                        const katsayi = getKatsayi(new Date(`${date}T${time}`), duration);
                        
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
                alert(`✅ ${addedCount} sınav başarıyla eklendi.${skipCount > 0 ? ` (${skipCount} mükerrer kayıt atlandı.)` : ''}`);
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
    document.getElementById('exam-search')?.addEventListener('input', renderExams);
    document.getElementById('staff-search')?.addEventListener('input', renderStaff);
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

    // İlk kurulumda veya güncellemede bildirimleri sıfırla (User'ın isteği üzerine)
    const isReset = localStorage.getItem('notifReset_v2');
    if (!isReset) {
        localStorage.setItem('lastNotifCheck', Date.now());
        localStorage.setItem('notifReset_v2', 'true');
    }

    updateNotifBadge();
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
    const tbody = document.querySelector('#table-ranking tbody');
    const tbodyBreakdown = document.querySelector('#table-duty-breakdown tbody');
    tbody.innerHTML = '';
    if (tbodyBreakdown) tbodyBreakdown.innerHTML = '';

    // Görev dağılım istatistiklerini hazırla
    const stats = {};
    DB.staff.forEach(s => {
        stats[s.id] = { hiG: 0, hiA: 0, hsG: 0, hsA: 0, total: 0 };
    });

    DB.exams.forEach(ex => {
        if (!stats[ex.proctorId]) return;
        
        const k = ex.katsayi;
        if (k === 1.0) stats[ex.proctorId].hiG++;
        else if (k === 1.5) stats[ex.proctorId].hiA++;
        else if (k === 2.0) stats[ex.proctorId].hsG++;
        else if (k === 2.5) stats[ex.proctorId].hsA++;
        
        stats[ex.proctorId].total++;
    });

    // Sıralama (Puanı en çoktan aza)
    const sortedStaff = [...DB.staff].sort((a, b) => b.totalScore - a.totalScore);

    sortedStaff.forEach((s, idx) => {
        // Puan Sıralaması Tablosu
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><span class="clickable-name" onclick="showStaffSchedule('${s.name}')">${s.name}</span></td>
            <td>${s.totalScore.toFixed(1)}</td>
            <td>${s.taskCount}</td>
            <td><span class="badge ${s.totalScore === 0 ? 'idle' : 'active'}">${s.totalScore === 0 ? 'Beklemede' : 'Görevli'}</span></td>
        `;
        tbody.appendChild(tr);

        // Görev Dağılım Detay Tablosu
        if (tbodyBreakdown) {
            const trB = document.createElement('tr');
            const st = stats[s.id];
            trB.innerHTML = `
                <td><span class="clickable-name" onclick="showStaffSchedule('${s.name}')">${s.name}</span></td>
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

    // Çakışma sayısı
    const conflictElem = document.getElementById('stat-conflicts');
    if (conflictElem) {
        const conflicts = getConflicts();
        conflictElem.textContent = conflicts.size;
    }

    // Pazar Yeri (Açık Görevler) Panel Kartını Güncelle
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

    // Bu sinavla ilgili tum gozetmenleri bul
    const relatedExams = DB.exams.filter(e =>
        e.name === examName && e.date === date && e.time === time
    );

    title.textContent = examName;

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
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Gözetmen atanmamış.</td></tr>';
    } else {
        const now = new Date();
        // Tüm gözetmenleri (proctorIds içindeki her hoca için) tek tek listele
        let globalIdx = 1;
        relatedExams.forEach((ex) => {
            const currentProctorIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
            
            currentProctorIds.forEach(pid => {
                const staff = DB.staff.find(s => s.id === pid);
                if (!staff) return;

                const examDate = new Date(`${ex.date}T${ex.time}`);
                const examEnd = new Date(examDate.getTime() + ex.duration * 60000);
                const isPast = examEnd < now;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${globalIdx++}</td>
                    <td><span class="clickable-name" onclick="showStaffSchedule('${staff.name}')">${staff.name}</span></td>
                    <td>${staff.totalScore.toFixed(1)}</td>
                    <td>${staff.taskCount}</td>
                    <td style="text-align: right;">
                        ${!isPast ? `<button class="btn-swap" style="font-size:0.75rem; padding: 4px 10px;" onclick="takeOverDuty('${ex.id}', '${staff.id}')">Yerine Geç</button>` : ''}
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
        if (!exam) return alert("Sınav bulunamadı.");

        const oldProctor = DB.staff.find(s => String(s.id) === String(oldProctorId));
        if (!oldProctor) return alert("Hoca verisi bulunamadı.");

        let newProctorName = "";
        let newProctor = null;

        if (sessionStorage.getItem('isAdmin') === 'true') {
            // Admin ise kimi atayacağını seçsin
            newProctor = await showStaffSelectModal("Görevi devralacak hocayı seçin:");
            if (!newProctor) return;
        } else {
            // Misafir ise "Kimseniz?" diye soralım
            newProctor = await showStaffSelectModal("Lütfen kendi isminizi seçerek görevi devralın:");
            if (!newProctor) return;
        }

        if (!newProctor) return alert("Belirtilen isimde bir hoca bulunamadı! Lütfen tam ve doğru yazın.");
        if (newProctor.id === oldProctor.id) return alert("Zaten bu görev bu hocaya atanmış!");

        // Müsaitlik kontrolü
        if (!isProctorTrulyFree(newProctor.id, exam.date, exam.time, exam.duration, exam.id)) {
            if (!confirm("⚠️ Bu saatte başka bir göreviniz veya kısıtınız var! Yine de devam etmek istiyor musunuz?")) return;
        }

        if (!confirm(`${oldProctor.name} hocanın görevini ${newProctor.name} hocaya devretmek istediğinize emin misiniz?`)) return;

        // PUAN GÜNCELLEME
        // Eskiden düş
        oldProctor.totalScore = parseFloat((oldProctor.totalScore - exam.score).toFixed(2));
        oldProctor.taskCount = Math.max(0, (oldProctor.taskCount || 1) - 1);

        // Yeniye ekle
        newProctor.totalScore = parseFloat((newProctor.totalScore + exam.score).toFixed(2));
        newProctor.taskCount = (newProctor.taskCount || 0) + 1;

        // SINAV GÜNCELLEME
        exam.proctorId = newProctor.id;
        exam.proctorName = newProctor.name;

        // KAYDET VE YENİLE
        saveToLocalStorage();
        renderDashboard();
        renderExams();
        renderSchedule();
        renderStaff();
        
        console.log("Görev devralma başarılı, sunucuya kaydediliyor...");
        await saveToBackend();
        
        logAction('user', 'Görev Devralma', `${exam.name} görevi ${oldProctor.name}'dan ${newProctor.name}'a devredildi.`);
        alert(`✅ Başarılı!\n${exam.name} görevi ${newProctor.name} hocaya başarıyla devredildi.`);
        document.getElementById('modal-exam-detail').classList.add('hidden');

    } catch (err) {
        console.error("Görevi devralma hatası:", err);
        alert("Bir hata oluştu: " + err.message);
    }
};

/**
 * Personel Seçim Modalı (Promise tabanlı)
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

    const now = new Date();
    const conflicts = getConflicts();
    const locConflicts = getLocationConflicts();

    const filteredExams = sortedExams.filter(ex => {
        // Archiving filter
        const examDateStr = ex.date || "";
        const examTimeStr = ex.time || "00:00";
        const examDate = new Date(`${examDateStr}T${examTimeStr}`);
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
        const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const dayName = dayNames[dateObj.getDay()];
        const displayDate = ex.date.split("-").reverse().join(".") + " " + dayName;

        const pNames = (ex.proctorIds || [ex.proctorId]).map(pid => {
            const s = DB.staff.find(staff => staff.id === pid);
            return s ? s.name : '???';
        }).join(', ');

        tr.innerHTML = `
            <td><span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #a78bfa; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(139, 92, 246, 0.3);">${ex.type || 'Vize'}</span></td>
            <td>
                <span class="clickable-name" onclick="showExamDetail('${ex.name}', '${ex.date}', '${ex.time}', '${ex.location || ''}')"><strong>${ex.name}</strong></span>
                ${conflicts.has(ex.id) ? '<span class="conflict-warning">⚠️ Zaman Çakışması!</span>' : ''}
            </td>
            <td>${ex.lecturer || '-'}</td>
            <td class="${isLocConflict ? 'location-conflict' : ''}">
                ${ex.location || '-'}
                ${isLocConflict ? '<span class="location-warning">⚠️ Derslik Dolu!</span>' : ''}
            </td>
            <td>${displayDate}</td>
            <td>${ex.time}</td>
            <td>${ex.duration}</td>
            <td>x${parseFloat(ex.katsayi).toFixed(2)}</td>
            <td>${ex.score.toFixed(1)}</td>
            <td>${pNames}</td>
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
                            <button class="btn-primary" onclick="initiateOpenSwap(${ex.id})" title="Pazar Yerine Bırak" style="padding: 0.3rem 0.6rem; border-radius: 6px; background: #8b5cf6;"><span class="icon" style="margin:0;">📢</span></button>
                         `;
                     }
                     return '';
                 })()}
                 <button class="btn-secondary admin-only" onclick="showEditExamModal(${ex.id})" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; border-color: var(--primary); color: var(--primary);">Düzenle</button>
                 <button class="btn-delete admin-only" onclick="deleteExam(${ex.id})">Sil</button>
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
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    title.textContent = `${monthNames[month]} ${year}`;

    // Gruplama
    const groups = {};
    DB.exams.forEach(ex => {
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
            const s = DB.staff.find(staff => staff.id === pid);
            return s ? s.name : '';
        }).filter(n => n !== '');
        groups[key].proctors.push(...pNames);
    });

    // Tekilleştirme
    Object.keys(groups).forEach(k => {
        groups[k].proctors = [...new Set(groups[k].proctors)];
    });

    const scheduleList = Object.values(groups);
    const searchTerm = document.getElementById('schedule-search')?.value.toLowerCase() || '';

    // Filtreleme (Ay + Tür + Arama)
    const filteredSchedule = scheduleList.filter(ex => {
        if (!ex.date) return false;
        const d = new Date(ex.date.replace(/-/g, "/"));
        const matchesMonth = d.getMonth() === month && d.getFullYear() === year;
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

    // Sıralama
    function getYear(name) {
        const match = name.match(/\b(1|2|3|4)\d{2}\b/);
        if (match) return parseInt(match[1]);
        if (name.includes("101") || name.includes("102") || name.includes("106") || name.includes("112") || name.includes("114")) return 1;
        return 0;
    }

    filteredSchedule.sort((a, b) => {
        const ya = getYear(a.name);
        const yb = getYear(b.name);
        if (ya !== yb) return ya - yb;
        return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    });

    const conflicts = getConflicts();
    const locConflicts = getLocationConflicts();

    // 1. Liste Görünümü Render
    let curYearActive = -1;

    filteredSchedule.forEach(ex => {
        const y = getYear(ex.name);
        
        if (y > 0 && y !== curYearActive) {
            curYearActive = y;
            const trHead = document.createElement('tr');
            trHead.className = 'year-header';
            trHead.innerHTML = `<td colspan="10">${y}. YIL</td>`;
            tbodyActive.appendChild(trHead);
        }

        const tr = document.createElement('tr');
        if (ex.isDraft) tr.classList.add('exam-row-draft');
        const isConflict = DB.exams.some(e => e.name === ex.name && e.date === ex.date && e.time === ex.time && conflicts.has(e.id));
        if (isConflict) tr.classList.add('conflict-row');

        const isLocConflict = DB.exams.some(e => e.name === ex.name && e.date === ex.date && e.time === ex.time && locConflicts.has(e.id));

        const dateObj = new Date(ex.date.replace(/-/g, "/"));
        const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const dayName = dayNames[dateObj.getDay()];
        const formatString = ex.date.split("-").reverse().join(".") + " " + dayName; 

        tr.innerHTML = `
            <td><span class="badge-type type-${ex.type}">${ex.type.toUpperCase()}</span></td>
            <td>
                <span class="clickable-name" onclick="showExamDetail('${ex.name.replace(/'/g, "\\'")}', '${ex.date}', '${ex.time}', '${ex.location.replace(/'/g, "\\'")}')"><strong>${ex.name}</strong></span>
                ${isConflict ? '<span class="conflict-warning" style="display:block; font-size:0.7rem; color:#ef4444;">⚠️ Gözetmen Çakışması!</span>' : ''}
            </td>
            <td>${ex.lecturer}</td>
            <td>${ex.capacity}</td>
            <td class="${isLocConflict ? 'location-conflict' : ''}">
                ${ex.location}
                ${isLocConflict ? '<span class="location-warning" style="display:block; font-size:0.7rem; color:#f59e0b;">⚠️ Derslik Çakışması!</span>' : ''}
            </td>
            <td>${formatString}</td>
            <td>${ex.time}</td>
            <td>${ex.duration} dk</td>
            <td class="proctor-list">${ex.proctors.join(', ')}</td>
            <td class="admin-only">
                 <button class="btn-secondary" onclick="showEditScheduleModal('${ex.name.replace(/'/g, "\\'")}', '${ex.date}', '${ex.time}', '${ex.location.replace(/'/g, "\\'")}')" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; border-color: var(--primary); color: var(--primary);">Düzenle</button>
            </td>
        `;
        tbodyActive.appendChild(tr);
    });

    if (tbodyActive.children.length === 0) tbodyActive.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--text-muted); padding:2rem;">Bu ay için program bulunmuyor.</td></tr>';

    // 2. Takvim Görünümü Render
    if (currentScheduleView === 'calendar' && grid) {
        renderCalendarGrid(filteredSchedule, year, month);
    }
}

function renderCalendarGrid(exams, year, month) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    dayNames.forEach(d => {
        const div = document.createElement('div');
        div.className = 'calendar-day-head';
        div.textContent = d;
        grid.appendChild(div);
    });

    const firstDay = new Date(year, month, 1);
    let startDayIdx = (firstDay.getDay() + 6) % 7; // Pzt=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Önceki Ay
    for (let i = startDayIdx - 1; i >= 0; i--) {
        grid.appendChild(createScheduleDayCell(daysInPrevMonth - i, true));
    }

    // Bu Ay
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const dayExams = exams.filter(e => e.date === dateStr);
        grid.appendChild(createScheduleDayCell(d, false, isToday, dayExams));
    }

    // Gelecek Ay
    const totalCells = grid.children.length - 7;
    const remaining = 42 - totalCells;
    for (let i = 1; i <= remaining; i++) {
        grid.appendChild(createScheduleDayCell(i, true));
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
 * Genel Sınav Programında Sekme Değiştirme
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

function showAddExamModal() {
    const modal = document.getElementById('modal');
    const fields = document.getElementById('form-fields');
    document.getElementById('modal-title').textContent = "Yeni Sınav Ekle";

    // Eğer DB.lecturers bir şekilde boş kalmışsa, hardcoded değerleri geri getir (Güvenlik önlemi)
    if (!DB.lecturers || DB.lecturers.length === 0) {
        console.warn("DB.lecturers boş, varsayılanlar yükleniyor...");
        DB.lecturers = [
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
            { name: "Ayten KOÇ", title: "Doç. Dr." },
            { name: "Ayşe SÖNMEZ", title: "Doç. Dr." },
            { name: "Selçuk TOPAL", title: "Doç. Dr." },
            { name: "Gülşen ULUCAK", title: "Doç. Dr." },
            { name: "Hadi ALIZADEH", title: "Dr. Öğr. Üyesi" },
            { name: "Keremcan DOĞAN", title: "Dr. Öğr. Üyesi" },
            { name: "Tuğba MAHMUTÇEPOĞLU", title: "Dr. Öğr. Üyesi" },
            { name: "Samire YAZAR", title: "Dr. Öğr. Üyesi" }
        ];
    }
    
    // Eski seçimleri temizle
    window.selectedProctorId = null;
    
    fields.innerHTML = `
        <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label style="margin:0;">Sınav Türü</label>
                <button type="button" class="btn-icon" onclick="openTypeManager()" style="font-size:0.8rem; padding:2px 5px; opacity:0.7;">⚙️ Yönet</button>
            </div>
            <select id="exam-type" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: 8px; color: white;">
                ${(DB.examTypes || []).map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Sınav/Ders Adı</label>
            <input type="text" id="exam-name" placeholder="Örn: Matematik I" required>
        </div>
        <div class="form-group">
            <label>Dersi Veren Hoca</label>
            <select id="exam-lecturer" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 0.75rem; border-radius: 8px; color: white;">
                <option value="-">Seçin...</option>
                ${(DB.lecturers || []).map(l => `<option value="${l.title} ${l.name}">${l.title} ${l.name}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Sınıf Mevcudu / Yer Bilgisi</label>
            <input type="text" id="exam-capacity" placeholder="Örn: 55/ Amfi 2">
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
            <h4>🤖 Akıllı Öneriler</h4>
            <div id="add-suggestion-list" class="suggestion-list"></div>
        </div>
    `;
    modal.classList.remove('hidden');

    const updateAddSuggestions = () => {
        const d = document.getElementById('exam-date').value;
        const t = document.getElementById('exam-time').value;
        const dur = parseInt(document.getElementById('exam-duration').value) || 60;
        updateSuggestionsUI(d, t, dur, 'add-suggestions', 'add-suggestion-list', null);
    };

    document.getElementById('exam-date').addEventListener('change', updateAddSuggestions);
    document.getElementById('exam-time').addEventListener('change', updateAddSuggestions);
    document.getElementById('exam-duration').addEventListener('input', updateAddSuggestions);

    // --- LECTURER AUTO-SUGGESTION ---
    document.getElementById('exam-name').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const lecturerName = DB.courseLecturers[val];
        if (lecturerName) {
            const selectL = document.getElementById('exam-lecturer');
            if (selectL) selectL.value = lecturerName;
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
            const staff = DB.staff.find(s => s.id === id);
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

window.deleteExam = (id) => {
    const exIndex = DB.exams.findIndex(e => e.id === id);
    if (exIndex > -1) {
        const ex = DB.exams[exIndex];
        const staff = DB.staff.find(s => s.id === ex.proctorId);
        if (staff) {
            staff.totalScore -= ex.score;
            staff.taskCount -= 1;
        }
        DB.exams.splice(exIndex, 1);
        saveToLocalStorage();
        logAction('admin', 'Sınav Silme', `${ex.name} sınavı sistemden silindi.`);
        renderExams();
        renderSchedule();
        renderDashboard(); // Update dashboard scores
    }
};

window.showEditExamModal = (id) => {
    const ex = DB.exams.find(e => e.id === id);
    if (!ex) return;

    document.getElementById('edit-exam-id').value = ex.id;
    
    // Header'da yönetim butonu ekle (opsiyonel ama tutarlılık için)
    const typeLabelContainer = document.querySelector('#edit-modal .form-group:first-child');
    if (typeLabelContainer) {
         typeLabelContainer.style.position = 'relative';
         // Eğer zaten buton yoksa ekleyelim (burada select'in üstündeki label'ı bulup yanına koyuyoruz)
         // Not: Index.html'de sabit durabilir veya burada dinamik ekletebiliriz.
         // En iyisi index.html'de label yanına butonu koymak.
    }

    const typeSelect = document.getElementById('edit-exam-type');
    typeSelect.innerHTML = (DB.examTypes || []).map(t => 
        `<option value="${t}" ${t === ex.type ? 'selected' : ''}>${t}</option>`
    ).join('');
    
    document.getElementById('edit-exam-name').value = ex.name;
    
    // Eğer DB.lecturers bir şekilde boş kalmışsa, hardcoded değerleri geri getir (Güvenlik önlemi)
    if (!DB.lecturers || DB.lecturers.length === 0) {
        console.warn("DB.lecturers boş, varsayılanlar yükleniyor...");
        DB.lecturers = [
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
            { name: "Ayten KOÇ", title: "Doç. Dr." },
            { name: "Ayşe SÖNMEZ", title: "Doç. Dr." },
            { name: "Selçuk TOPAL", title: "Doç. Dr." },
            { name: "Gülşen ULUCAK", title: "Doç. Dr." },
            { name: "Hadi ALIZADEH", title: "Dr. Öğr. Üyesi" },
            { name: "Keremcan DOĞAN", title: "Dr. Öğr. Üyesi" },
            { name: "Tuğba MAHMUTÇEPOĞLU", title: "Dr. Öğr. Üyesi" },
            { name: "Samire YAZAR", title: "Dr. Öğr. Üyesi" }
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
    
    const updateEditProctorSelect = () => {
        const select = document.getElementById('edit-exam-proctor-select');
        select.innerHTML = `<option value="">Hoca Seçin...</option>` + DB.staff
            .filter(s => !window.tempEditProctors.includes(s.id))
            .sort((a,b) => a.name.localeCompare(b.name, 'tr'))
            .map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    };

    window.renderEditProctorList = () => {
        const list = document.getElementById('edit-proctor-list');
        list.innerHTML = window.tempEditProctors.map(id => {
            const staff = DB.staff.find(s => s.id === id);
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:6px 10px; border-radius:6px; border:1px solid var(--glass-border);">
                    <span style="font-size:0.85rem;">${staff ? staff.name : '???'}</span>
                    <button type="button" class="btn-icon" onclick="removeProctorFromEditList(${id})" style="color:var(--accent-red); font-size:1rem; filter:grayscale(1) brightness(2);">🗑️</button>
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
        }
    };

    window.removeProctorFromEditList = (id) => {
        window.tempEditProctors = window.tempEditProctors.filter(pid => pid !== id);
        renderEditProctorList();
        updateEditProctorSelect();
        updateEditSuggestions();
    };

    // Initial setup for proctor selection
    updateEditProctorSelect();
    renderEditProctorList();

    // Listener birikimini önlemek için flag kullan — cloneNode yerine
    const dateEl = document.getElementById('edit-exam-date');
    const timeEl = document.getElementById('edit-exam-time');
    const durEl  = document.getElementById('edit-exam-duration');
    const nameEl = document.getElementById('edit-exam-name');

    // Değerleri direkt set et (cloneNode ile kayıp yaşanmaz)
    dateEl.value = ex.date;
    timeEl.value = ex.time;
    durEl.value  = ex.duration;
    nameEl.value = ex.name;

    const updateEditSuggestions = () => {
        const d   = document.getElementById('edit-exam-date').value;
        const t   = document.getElementById('edit-exam-time').value;
        const dur = parseInt(document.getElementById('edit-exam-duration').value) || 60;
        updateSuggestionsUI(d, t, dur, 'edit-suggestions', 'edit-suggestion-list', ex.id, null);
    };

    // Her açılışta listener'ları temizle ve yeniden ekle (flag ile)
    if (dateEl._editHandler)  dateEl.removeEventListener('change', dateEl._editHandler);
    if (timeEl._editHandler)  timeEl.removeEventListener('change', timeEl._editHandler);
    if (durEl._editHandler)   durEl.removeEventListener('input',  durEl._editHandler);
    if (nameEl._editHandler)  nameEl.removeEventListener('input',  nameEl._editHandler);

    dateEl._editHandler = () => updateEditSuggestions();
    timeEl._editHandler = () => updateEditSuggestions();
    durEl._editHandler  = () => updateEditSuggestions();
    nameEl._editHandler = (e) => {
        const val = e.target.value.trim();
        const lecturerName = DB.courseLecturers[val];
        if (lecturerName) {
            const selectL = document.getElementById('edit-exam-lecturer');
            if (selectL) selectL.value = lecturerName;
            const staff = DB.staff.find(s => s.name.includes(lecturerName));
            if (staff && !window.tempEditProctors.includes(staff.id)) {
                if (confirm(`Bu dersin hocası ${staff.name} olarak görünüyor. Gözetmen olarak eklemek ister misiniz?`)) {
                    window.tempEditProctors.push(staff.id);
                    window.renderEditProctorList();
                    updateEditProctorSelect();
                    updateEditSuggestions();
                }
            }
        }
    };

    dateEl.addEventListener('change', dateEl._editHandler);
    timeEl.addEventListener('change', timeEl._editHandler);
    durEl.addEventListener('input',   durEl._editHandler);
    nameEl.addEventListener('input',  nameEl._editHandler);

    updateEditSuggestions();
    document.getElementById('edit-modal').classList.remove('hidden');
};

document.getElementById('edit-modal-form').onsubmit = async (e) => {
    e.preventDefault();
    // ID'yi string olarak al — parseInt büyük Date.now() değerlerinde precision kaybı yaratır
    const id = document.getElementById('edit-exam-id').value;

    // tempEditProctors atanmışsa doğrudan kullan (boş dizi de olsa, kullanıcı tümünü silmiş demektir)
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

        // O gruba ait tüm kayıtları güncelle
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
        logAction('admin', 'Sınav Programı Güncelleme', `${newName} grubundaki ${groupExams.length} sınav güncellendi.`);
        
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
                <td>
                    <span class="badge" style="background: ${getScoreColor(calculateAvailabilityScore(s.id))}22; color: ${getScoreColor(calculateAvailabilityScore(s.id))}; border: 1px solid ${getScoreColor(calculateAvailabilityScore(s.id))}44;">
                        %${calculateAvailabilityScore(s.id)}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Puan Dağılım Grafiğini de güncelle
    setTimeout(() => {
        if (typeof renderScoreChart === 'function') renderScoreChart();
    }, 100);
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
            <td><span class="clickable-name" onclick="showStaffSchedule('${s.name}')">${s.name}</span></td>
            <td>${s.totalScore.toFixed(1)}</td>
            <td>${s.taskCount}</td>
            <td>
                <div class="flex-score-container" title="Esneklik Puanı: %${calculateAvailabilityScore(s.id)}">
                    <div class="flex-score-bar" style="width: ${calculateAvailabilityScore(s.id)}%; background: ${getScoreColor(calculateAvailabilityScore(s.id))}"></div>
                    <span class="flex-score-text">%${calculateAvailabilityScore(s.id)}</span>
                </div>
            </td>
            <td class="admin-only"><button class="btn-delete" onclick="deleteStaff(${s.id})">Sil</button></td>
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
    `;
    modal.classList.remove('hidden');

    document.getElementById('modal-form').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('staff-name').value;
        const newStaff = {
            id: Date.now(),
            name: name,
            totalScore: 0,
            taskCount: 0
        };
        DB.staff.push(newStaff);
        saveToLocalStorage();
        logAction('admin', 'Personel Ekleme', `${newStaff.name} personel listesine eklendi.`);
        hideModal();
        renderStaff();
    };
}

window.deleteStaff = (id) => {
    const staff = DB.staff.find(s => s.id === id);
    if (staff && confirm(`${staff.name} kişisini silmek istediğinize emin misiniz?`)) {
        DB.staff = DB.staff.filter(s => s.id !== id);
        saveToLocalStorage();
        logAction('admin', 'Personel Silme', `${staff.name} sistemden silindi.`);
        renderStaff();
    }
};

window.showStaffSchedule = (staffName) => {
    const modal = document.getElementById('modal-staff-schedule');
    const title = document.getElementById('staff-name-title');
    const nameHeader = document.getElementById('individual-proctor-name');
    
    title.textContent = `${staffName} - Bireysel Program`;
    nameHeader.textContent = staffName;
    
    // Sekme sıfırlama
    switchIndividualTab('active');
    
    const tbodyActive = document.querySelector('#table-individual-schedule tbody');
    const tbodyArchive = document.querySelector('#table-archive-schedule tbody');
    tbodyActive.innerHTML = '';
    tbodyArchive.innerHTML = '';
    
    // Şimdiki zamanı al (Karşılaştırma için)
    const now = new Date();
    
    // Filtrele ve tarihe göre sırala
    const individualExams = DB.exams
        .filter(ex => ex.proctorName === staffName)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        
    individualExams.forEach(ex => {
        const tr = document.createElement('tr');
        const dateStr = ex.date.split("-").reverse().join(".");
        
        // Sınavın bitiş zamanını hesapla (yaklaşık)
        const examDate = new Date(`${ex.date}T${ex.time}`);
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

        // Eğer sınav bittiyse Arşiv'e, bitmediyse veya bugünse Aktif'e
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
                    'pending': '<span class="status-badge status-pending" style="font-size:0.6rem;">Açık Talep</span>',
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
                    ${isMe ? `<button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.7rem; background: var(--accent-orange); margin-right: 5px;" onclick="initiateOpenSwap(${ex.id})">Yerime Biri Lazım</button>` : ''}
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
            // Eğer ben receiver isem ve onaylamadıysam:
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
        const examDate = new Date(`${ex.date}T${ex.time}`);
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
        const choice = prompt(`Hangi görevi devretmek istiyorsunuz? (1-${myExams.length} arası rakam girin)\n\n${examOptions}`);
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

    if (confirm("Atama işlemini başlatıyorum. Onaylıyor musunuz?")) {
        const oldProctorIds = [...(selectedExam.proctorIds || [])];
        const newProctorIds = oldProctorIds.filter(id => id !== currentUser.id);
        newProctorIds.push(targetStaffId);
        
        const updateData = {
            ...selectedExam,
            proctorIds: newProctorIds
        };
        
        updateExam(selectedExam.id, updateData);
        alert("Görev başarıyla devredildi.");
        hideIndividualModal();
        renderExams();
        renderSchedule();
        renderDashboard();
    }
};

window.approveSwapPeer = async function(requestId, staffId) {
    const req = DB.requests.find(r => r.id === requestId);
    if (!req) return;

    // Direct swap desteği ekle (Eğer yanlışlıkla buradan gelirse)
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
            fromStaff.totalScore = Math.max(0, parseFloat((fromStaff.totalScore - exam.score).toFixed(2)));
            fromStaff.taskCount = Math.max(0, fromStaff.taskCount - 1);
            
            toStaff.totalScore = parseFloat((toStaff.totalScore + exam.score).toFixed(2));
            toStaff.taskCount = (toStaff.taskCount || 0) + 1;

            exam.proctorId = toStaff.id;
            exam.proctorName = toStaff.name;
            if (!exam.proctorIds) exam.proctorIds = [toStaff.id];
            else {
                const idx = exam.proctorIds.indexOf(fromStaff.id);
                if (idx !== -1) exam.proctorIds[idx] = toStaff.id;
            }

            req.status = 'approved';
            saveToLocalStorage();
            alert("✅ Görev devri işlemini onayladınız. Değişiklik anında kaydedildi.");
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
    alert("Takas talebini reddettiniz.");
    
    const receiver = DB.staff.find(s => s.id === req.receiverId);
    if (receiver) showStaffSchedule(receiver.name);

    await saveToBackend();
};

function hideIndividualModal() {
    document.getElementById('modal-staff-schedule').classList.add('hidden');
}

/**
 * Bireysel Program Modalında Sekme Değiştirme
 */
window.switchIndividualTab = function(tab) {
    // Butonları güncelle
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
    // Eğer düzenleme modalındaysak selectId bellidir, ekleme modalındaysak select yoktur (Çünkü henüz eklenmedi)
    // Ekleme modalında proctor seçimi için logic.js içindeki atama mantığını kullanıyoruz, 
    // ancak kullanıcı deneyimi için ekleme modalında da bir select olsaydı iyi olurdu.
    // Şimdilik ekleme modalında öneriye tıklayınca hoca adını saklayıp form submit'te kullanabiliriz veya ekleme modalına da select ekleyebiliriz.
    
    if (selectId && selectId !== 'null') {
        const select = document.getElementById(selectId);
        if (select) {
            select.value = staffId;
            // Görsel geribildirim için alanı gizle
            document.getElementById(areaId).classList.add('hidden');
        }
    } else {
        // Ekleme modalında "proctor" seçimi yok, algoritmaya bırakılıyor. 
        // Ancak kullanıcı "Ben bunu istiyorum" diyorsa, bir hoca ismi seçtirip Manuel atama gibi davranabiliriz.
        // Basitlik adına ekleme modalında öneriye tıklayınca otomatik atama yapacak bir gizli alan ekleyelim.
        window.selectedProctorId = staffId;
        alert(`${DB.staff.find(s=>s.id === staffId).name} seçildi. Kaydet'e bastığınızda bu hoca atanacaktır.`);
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
            const busyExam = dayExams.find(e => e.time === t && e.proctorId === s.id);

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


function showGitHubSyncModal() {
    const modal = document.getElementById('modal-github-sync');
    const textarea = document.getElementById('github-sync-code');
    
    // DB objesini logic.js formatında metne dönüştür
    const dbCode = `let DB = ${JSON.stringify(DB, null, 4)};`;
    
    textarea.value = dbCode;
    modal.classList.remove('hidden');
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

    // Çakışma kontrolü için dinleyici
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

    // Akıllı Önerileri Tetikle (Feature 4.1)
    updateSuggestionsUI(exam.date, exam.time, exam.duration, 'swap-suggestions', 'swap-suggestion-list', exam.id, 'swap-receiver-select');

    document.getElementById('modal-swap').classList.remove('hidden');
};

window.submitSwapForm = async function() {
    try {
        const examIdElem = document.getElementById('swap-exam-id');
        const initiatorElem = document.getElementById('swap-initiator-select');
        const receiverElem = document.getElementById('swap-receiver-select');

        if (!examIdElem || !initiatorElem || !receiverElem) {
            console.error("Form elemanları bulunamadı!");
            return;
        }

        const examId = examIdElem.value;
        const initiatorId = initiatorElem.value;
        const receiverId = receiverElem.value || null;

        if (!initiatorId) {
            alert("Lütfen görevi devredecek hocayı seçin.");
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
            console.error("Sınav bulunamadı. Aranan ID:", examId, "Mevcut ID'ler:", DB.exams.map(e => e.id));
            alert("Sınav verisi bulunamadı (ID: " + examId + "). Lütfen sayfayı yenileyip tekrar deneyin.");
            return;
        }
        if (!initiator) {
            alert("Devreden personel verisi bulunamadı (ID: " + initiatorId + ").");
            return;
        }

        if (receiver) {
            const hasConfirmed = await showChoiceModal(`${receiver.name} hocanın takas isteğinden haberi var mı?`);
            if (!hasConfirmed) {
                alert("Talep gönderilmedi.");
                return;
            }
        }

        if (createSwapRequest(examId, initiatorId, receiverId)) {
            alert("Takas talebiniz başarıyla oluşturuldu.");
            document.getElementById('modal-swap').classList.add('hidden');

            renderDashboard();
            await saveToBackend();
        } else {
            alert("Takas gerçekleştirilemedi: Sınav bulunamadı.");
        }
    } catch (err) {
        console.error("Takas gönderme hatası:", err);
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
            // Geçmiş sınavları gösterme
            const exam = DB.exams.find(e => String(e.id) === String(r.examId));
            if (!exam) return false;
            const examDate = new Date(`${exam.date}T${exam.time}`);
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
            // Geçmiş sınavları gösterme
            const exam = DB.exams.find(e => String(e.id) === String(r.examId));
            if (!exam) return false;
            const examDate = new Date(`${exam.date}T${exam.time}`);
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
    // Kullanıcının müsait olduğu açık talepleri bul
    const openRequests = (DB.requests || [])
        .filter(r => {
            if (r.status !== 'pending' || r.receiverId !== null || r.initiatorId === myStaffIdNum) return false;
            if (dismissedIds.includes(r.id)) return false;
            // Geçmiş sınavları gösterme
            const exam = DB.exams.find(e => String(e.id) === String(r.examId));
            if (!exam) return false;
            const examDate = new Date(`${exam.date}T${exam.time}`);
            const examEnd = new Date(examDate.getTime() + (exam.duration || 60) * 60000);
            return examEnd >= now;
        });

    // Müsaitlik kontrolü yapılmış olanları filtrele (renderMarketplace mantığı gibi)
    const availableRequests = openRequests.filter(req => {
        const exam = DB.exams.find(e => e.id == req.examId);
        return exam && isProctorTrulyFree(myStaffIdNum, req.examDate, req.examTime, exam.duration);
    });

    if (availableRequests.length === 0) {
        banner.classList.add('hidden');
        return;
    }

    // En yakın/güncel olanı göster
    const req = availableRequests[0];
    const exam = DB.exams.find(e => e.id == req.examId);
    const formattedDate = req.examDate.split('-').reverse().join('.');

    banner.innerHTML = `
        <div class="marketplace-notice-content">
            <div class="marketplace-notice-icon">🛒</div>
            <div class="marketplace-notice-text">
                <h4>Pazar Yeri Duyurusu</h4>
                <p><b>${req.examName}</b> (${formattedDate} - ${req.examTime}) görevi için yer aranıyor. Devralmak isterseniz <b>Açık Görevler</b> sekmesine göz atabilirsiniz.</p>
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
 * En Sık Beraber Görev Yaptığım Arkadaşlarımı Hesapla ve Render Et
 */
function renderCollaborators() {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) return;

    const collaboratorsMap = {}; // staffId -> count
    
    // Tüm sınavları tara (aktif + arşiv)
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
        
        if (c.count >= 5) { funTag = "🔥"; funTitle = "Ayrılmaz Parça"; }
        else if (c.count >= 3) { funTag = "⭐"; funTitle = "Yılmaz İkili"; }
        else if (c.count >= 2) { funTag = "💪"; funTitle = "Sıkı Dost"; }

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
 * Kişisel Mottoyu İşle
 */
function renderMotto(staff) {
    const mottoEl = document.getElementById('profile-motto');
    if (!mottoEl) return;
    mottoEl.textContent = staff.motto || "Gözetmenlik bir sanattır...";
}

window.editMotto = async function() {
    const myStaffId = localStorage.getItem('myStaffId');
    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) return;

    const newMotto = prompt("Yeni mottonuzu girin:", staff.motto || "");
    if (newMotto !== null) {
        staff.motto = newMotto.trim() || "";
        saveToLocalStorage();
        renderMotto(staff);
        await saveToBackend();
    }
};

window.suggestJoke = async function() {
    const joke = prompt("Gözetmenlik ile ilgili komik bir anınızı veya esprinizi paylaşın:\n(Bu şaka tüm hocalarla paylaşılacaktır)");
    if (!joke || joke.trim().length < 5) {
        if (joke !== null) alert("Lütfen biraz daha uzun bir şaka girin.");
        return;
    }

    if (!DB.customJokes) DB.customJokes = [];
    DB.customJokes.push(joke.trim());
    
    saveToLocalStorage();
    alert("✅ Teşekkürler! Şakanız başarıyla kaydedildi ve havuza eklendi.");
    renderDailyJoke(true); // Hemen göster
    await saveToBackend();
};

/**
 * Günün Motivasyonu ve Şakasını Render Et
 */
function renderDailyJoke(isNew = false) {
    const jokeEl = document.getElementById('profile-daily-joke');
    if (!jokeEl) return;

    const hardcodedJokes = [
        "Sessizlik en büyük silahtır (Ama öğrencilere karşı değil, kendimize karşı!)",
        "Gözetmenlikte 3S kuralı: Sev, Sabret, Sessiz ol.",
        "Eğer kalem sesi gelmiyorsa, ya herkes bitirmiştir ya da kimse bilmiyordur.",
        "Optik form doldurmanın meditasyon olduğunu keşfettim.",
        "Cebimde fazladan silgi taşımak, süper kahraman pelerini taşımak gibi.",
        "Gözetmenlik: Oturarak yorulmanın zirvesidir.",
        "Silgi tozundan küçük bir heykel yapmaya başladım, 3 vize sonra sergi açacağım.",
        "Sınavda gezmek, adım sayarımı en çok mutlu eden aktivite.",
        "Bir gözetmenin en büyük dramı: Kendi getirdiği suyun sınavın ortasında bitmesidir.",
        "Öğrenci: 'Hocam ek kağıt alabilir miyim?' - Ben: 'Tabii, ağaçlar bizim için var...'",
        "Sınav bitimine 5 dakika kala gelen o derin sessizlik ve ardından gelen kağıt hışırtısı senfonisi...",
        "Gözetmenlik yaparken kafamda kurduğum senaryolarla 3 sezonluk dizi çekerdim.",
        "Sınav salonuna girdiğimde kendimi bir orkestra şefi gibi hissediyorum ama tek enstrümanımız kalem sesleri.",
        "Gözetmenlikte en zor an: Sessizce hapşırmaya çalışmak.",
        "Gözetmenlikte sabır, optik formu yırtmayan öğrenciyi beklemektir.",
        "Sınavın bitmesine 30 saniye kala kalemini açan o umutlu öğrenci... Seni seviyoruz.",
        "Kendi kendine konuşan öğrenciye 'sessiz ol' demek istemek ama aslında ne dediğini merak etmek...",
        "Sınavda en çok yorulan yerimiz gözlerimiz (ve hayal gücümüz).",
        "Bir gözetmen atasözü der ki: 'Herkes kendi kağıdına!'",
        "Sınav süresi bittiğinde kağıdı vermeyen öğrenciyle bakışmak; batıda düello, doğuda dramdır.",
        "Ad-soyad yazmayı unutan öğrenci, gizli kahramanımızdır.",
        "Gözetmenlik: 60 dakikalık bir sessiz sinema performansıdır.",
        "Sınav salonuna girerken telefonunuzu kapatmayı unutmayın, yoksa zil sesiyle tüm motivasyon dağılır (Tecrübeyle sabit).",
        "Sınav kağıdındaki o tek boşluk... Oraya şiir yazasım geliyor bazen.",
        "Gözetmen arkadaşımla göz göze geldiğimizde kurduğumuz telepatik iletişim: 'Su istiyorlar mı?'",
        "Sınavda uyuyan öğrenciye kıyamayıp 2 dakika sonra uyandırmak: Bir gözetmen şefkati.",
        "Kopya çekmeye çalışan öğrencinin o kendine has boyun hareketleri... Koreografiye 10 puan!",
        "Silgi sesleri: Başarısızlığın değil, düzeltmenin ve umudun sesidir.",
        "Gözetmenlik, akademik sabrın en sah halidir.",
        "Sınav kağıdını verirken 'Hocam çok zordu' diyen öğrenciye 'Haklısın' deyip geçmek...",
        "Gözetmenlikte en büyük lüks: Rahat bir sandalyedir.",
        "Sınav çıkışında dağıtılan şekerlerin tadı, sadece gözetmenlere özel bir ödüldür.",
        "Sınavda kağıdını 10. dakikada teslim eden o dahi ya da umutsuz arkadaş...",
        "Gözetmenlik, bir sessizlik senfonisidir ve şefi sizsiniz."
    ];

    const jokes = [...hardcodedJokes, ...(DB.customJokes || [])];

    if (isNew) {
        let currentIdx = jokes.indexOf(jokeEl.textContent.trim());
        let nextIdx = Math.floor(Math.random() * jokes.length);
        while (nextIdx === currentIdx) nextIdx = Math.floor(Math.random() * jokes.length); 
        jokeEl.textContent = `"${jokes[nextIdx]}"`;
    } else {
        const rand = Math.floor(Math.random() * jokes.length);
        jokeEl.textContent = `"${jokes[rand]}"`;
    }
}

/**
 * Başarı Rozetlerini Hesapla
 */
function calculateAchievements(myStaffId) {
    const exams = DB.exams.filter(ex => {
        const pIds = ex.proctorIds || (ex.proctorId ? [ex.proctorId] : []);
        return pIds.map(id => String(id)).includes(String(myStaffId));
    });

    const now = new Date();
    const completedExams = exams.filter(ex => {
        const examEnd = new Date(`${ex.date}T${ex.time}`).getTime() + (ex.duration || 60) * 60000;
        return examEnd < now.getTime();
    });

    return [
        {
            id: 'early_bird',
            name: 'Erken Kalkan',
            icon: '🌅',
            desc: '3+ sabah sınavına (09:30 ve öncesi) katıldınız.',
            isUnlocked: completedExams.filter(ex => ex.time <= "09:30").length >= 3
        },
        {
            id: 'night_owl',
            name: 'Gece Kuşu',
            icon: '🦉',
            desc: '3+ akşam sınavına (17:00 ve sonrası) katıldınız.',
            isUnlocked: completedExams.filter(ex => ex.time >= "17:00").length >= 3
        },
        {
            id: 'helper',
            name: 'Yardımsever',
            icon: '🛡️',
            desc: 'Başkalarından gelen 3+ takas talebini kabul ettiniz.',
            isUnlocked: (DB.requests || []).filter(r => r.status === 'approved' && String(r.receiverId) === String(myStaffId)).length >= 3
        },
        {
            id: 'weekend',
            name: 'Hafta Sonu Savaşçısı',
            icon: '🏔️',
            desc: 'Hafta sonu 2+ sınav görevini başarıyla tamamladınız.',
            isUnlocked: completedExams.filter(ex => {
                const day = new Date(ex.date).getDay();
                return day === 0 || day === 6;
            }).length >= 2
        },
        {
            id: 'marathon',
            name: 'Maratoncu',
            icon: '📚',
            desc: 'Toplam gözetmenlik süreniz 500 dakikayı aştı.',
            isUnlocked: completedExams.reduce((sum, ex) => sum + (ex.duration || 60), 0) >= 500
        },
        {
            id: 'task_master',
            name: 'Görev Adamı',
            icon: '🎯',
            desc: 'Sistemde toplam 5+ görevi başarıyla tamamladınız.',
            isUnlocked: completedExams.length >= 5
        }
    ];
}

/**
 * Başarı Rozetlerini Render Et
 */
function renderAchievements() {
    const myStaffId = localStorage.getItem('myStaffId');
    const container = document.getElementById('profile-achievements-list');
    const countEl = document.getElementById('achievement-count');
    if (!container || !myStaffId) return;

    const achievements = calculateAchievements(myStaffId);
    const unlockedCount = achievements.filter(a => a.isUnlocked).length;

    if (countEl) countEl.textContent = `${unlockedCount}/${achievements.length} Rozet`;
    
    container.innerHTML = achievements.map(a => `
        <div class="achievement-badge ${a.isUnlocked ? 'unlocked' : 'locked'}">
            <span class="achievement-icon">${a.icon}</span>
            <span class="achievement-name">${a.name}</span>
            <div class="achievement-desc">
                <strong>${a.name}</strong>
                ${a.desc}
                ${a.isUnlocked ? '<br><span style="color:var(--accent-green); font-size:0.65rem; margin-top:5px; display:block;">✔️ Kazanıldı</span>' : ''}
            </div>
        </div>
    `).join('');
}

/**
 * Rütbe Detaylarını Al
 */
function getRankDetails(taskCount) {
    if (taskCount >= 50) return { name: "Efsane", color: "#f87171", threshold: "∞", next: 50 };
    if (taskCount >= 30) return { name: "Usta", color: "#fbbf24", threshold: 50, next: 30 };
    if (taskCount >= 15) return { name: "Kıdemli", color: "#34d399", threshold: 30, next: 15 };
    if (taskCount >= 5)  return { name: "Tecrübeli", color: "#60a5fa", threshold: 15, next: 5 };
    return { name: "Acemi", color: "#9ca3af", threshold: 5, next: 0 };
}

/**
 * Seviye ve İlerleme Çubuğunu Render Et
 */
function renderLevelSystem(staff) {
    const taskCount = staff.taskCount || 0;
    const rank = getRankDetails(taskCount);
    
    const badge = document.getElementById('profile-rank-badge');
    const levelLabel = document.getElementById('profile-level-label');
    const xpLabel = document.getElementById('profile-xp-label');
    const xpFill = document.getElementById('profile-xp-fill');
    
    if (badge) {
        badge.textContent = rank.name;
        badge.style.background = `linear-gradient(135deg, ${rank.color} 0%, #6366f1 100%)`;
    }
    
    if (levelLabel) {
        const level = taskCount < 5 ? 1 : 
                      taskCount < 15 ? 2 : 
                      taskCount < 30 ? 3 : 
                      taskCount < 50 ? 4 : 5;
        levelLabel.textContent = `Seviye ${level}`;
    }
    
    if (xpLabel && xpFill) {
        if (rank.threshold === "∞") {
            xpLabel.textContent = `${taskCount} Görev (Max)`;
            xpFill.style.width = "100%";
        } else {
            const currentXP = taskCount - rank.next;
            const targetXP = rank.threshold - rank.next;
            const percent = (currentXP / targetXP) * 100;
            xpLabel.textContent = `${taskCount}/${rank.threshold} Görev`;
            xpFill.style.width = `${percent}%`;
        }
    }
}

/**
 * Kişisel Notları Render Et
 */
function renderQuickNotes(staff) {
    const notesInput = document.getElementById('profile-notes-input');
    if (notesInput) {
        notesInput.value = staff.notes || "";
    }
}

/**
 * Kişisel Notları Kaydet
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
 * Profil Sayfasını Yönet
 */
window.renderProfile = function() {
    renderCollaborators();
    renderAchievements();
    renderSmartSwaps();
    const myStaffId = localStorage.getItem('myStaffId');
    const setupSection = document.getElementById('profile-identity-setup');
    const mainSection = document.getElementById('profile-main-content');
    
    if (!myStaffId) {
        setupSection.classList.remove('hidden');
        mainSection.classList.add('hidden');
        
        // Dropdown'ı doldur — şifreli profiller kilitli/disabled gösterilir
        const dropdown = document.getElementById('profile-setup-dropdown');
        dropdown.innerHTML = '<option value="">İsminizi Seçin...</option>';
        DB.staff.slice().sort((a,b) => a.name.localeCompare(b.name, 'tr')).forEach(s => {
            const isLocked = !!s.staffPassword;
            const opt = document.createElement('option');
            opt.value = isLocked ? '' : s.id; // kilitliyse value boş bırak
            opt.textContent = isLocked ? `🔒 ${s.name}` : s.name;
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
        renderQuickNotes(staff);
        renderMotto(staff);
        renderDailyJoke();
        
        // Şifre ayarlama bölümünü göster
        renderPasswordSettings(staff);

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
                                        <span style="color: var(--accent-orange);">${hisExam ? hisExam.name : '???'}</span> sınavı ile 
                                        sizin <span style="color: var(--primary);">${myExam ? myExam.name : '???'}</span> sınavınızı takas etmek istiyor.
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
        // Header Bilgileri (Yeni Premium Hero Tasarımı)
        const profileName = document.getElementById('profile-name');
        if (profileName) profileName.textContent = staff.name;
        
        const avatarLetters = document.getElementById('profile-avatar-letters');
        if (avatarLetters) {
            const initials = staff.name.split(' ').map(n => n[0]).join('').toUpperCase();
            avatarLetters.textContent = initials;
        }

        // Görevleri listele
        const myExams = DB.exams.filter(e => isStaffProctorById(e, myStaffId));
        const now = new Date();
        const activeExams = myExams.filter(e => {
            const examDate = new Date(`${e.date}T${e.time}`);
            const examEnd = new Date(examDate.getTime() + (e.duration || 60) * 60000);
            return examEnd >= now;
        }).sort((a,b) => a.date.localeCompare(b.date));

        const archiveExams = myExams.filter(e => {
            const examDate = new Date(`${e.date}T${e.time}`);
            const examEnd = new Date(examDate.getTime() + (e.duration || 60) * 60000);
            return examEnd < now;
        }).sort((a,b) => b.date.localeCompare(a.date));

        const activeBody = document.querySelector('#profile-table-active tbody');
        activeBody.innerHTML = '';
            activeExams.forEach(ex => {
                activeBody.innerHTML += `
                    <tr>
                        <td><span class="clickable-name" onclick="showExamDetail('${ex.name.replace(/'/g, "\\'")}', '${ex.date}', '${ex.time}', '${ex.location || ''}')"><strong>${ex.name}</strong></span></td>
                        <td><span class="badge-location">${ex.location || '-'}</span></td>
                        <td>${ex.lecturer || '-'}</td>
                        <td>${ex.date}</td>
                        <td>${ex.time}</td>
                        <td>${ex.duration} dk</td>
                        <td><span class="score-tag">+${ex.score}</span></td>
                        <td style="display: flex; gap: 5px;">
                            ${(() => {
                                const hasRequest = (DB.requests || []).find(r => 
                                    String(r.examId) === String(ex.id) && 
                                    String(r.initiatorId) === String(myStaffId) && 
                                    ['pending', 'pending_peer'].includes(r.status)
                                );
                                if (hasRequest) {
                                    return `<button class="btn-delete" onclick="cancelSwapRequest('${hasRequest.id}')" title="Talebi İptal Et" style="padding: 0.3rem 0.6rem; border-radius: 6px;"><span class="icon" style="margin:0;">🚫</span></button>`;
                                }
                                return `
                                    <button class="btn-secondary" onclick="initiateDirectSwap('${ex.id}')" title="Hoca ile Takas Et" style="padding: 0.3rem 0.6rem; border-radius: 6px;"><span class="icon" style="margin:0;">🔄</span></button>
                                    <button class="btn-primary" onclick="initiateOpenSwap('${ex.id}')" title="Pazar Yerine Bırak" style="padding: 0.3rem 0.6rem; border-radius: 6px;"><span class="icon" style="margin:0;">📢</span></button>
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
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        if (!isAdmin) {
            renderPasswordSection(staff);
        } else {
            const pwSection = document.getElementById('profile-password-section');
            if (pwSection) pwSection.innerHTML = '';
        }
    }
};

// ===== KİŞİSEL PORTAL YARDIMCI FONKSİYONLARI (Gözetmenlik'ten uyarlandı) =====

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
        html += `<div style="border-radius:10px; background:rgba(255,255,255,0.01); min-height:70px;"></div>`;
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
            ? 'border: 2px solid var(--primary); box-shadow: 0 0 12px rgba(99,102,241,0.3);'
            : 'border: 1px solid var(--glass-border);';

        const examsBadges = allDayExams.slice(0, 2).map(ex => {
            const isProc = dayProctored.some(e => e.id === ex.id);
            const isResp = dayResponsible.some(e => e.id === ex.id);
            let bg = isProc && isResp ? 'var(--accent-red)' : isProc ? 'rgba(99,102,241,0.7)' : 'rgba(245,158,11,0.7)';
            return `<div style="font-size:0.55rem; background:${bg}; color:white; padding:2px 4px; border-radius:4px; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${ex.name} ${ex.time}">${ex.time} ${ex.name.substring(0,8)}${ex.name.length>8?'..':''}</div>`;
        }).join('');

        const moreCount = allDayExams.length > 2 ? `<div style="font-size:0.55rem; color:var(--text-muted); margin-top:2px;">+${allDayExams.length - 2} daha</div>` : '';

        const clickAction = allDayExams.length > 0
            ? `onclick="showMyTimelineDayDetail('${dateStr}')"`
            : '';

        html += `
            <div ${clickAction} style="border-radius:10px; ${border} background:${allDayExams.length ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.02)'}; min-height:70px; padding:6px 5px; cursor:${allDayExams.length?'pointer':'default'}; transition: all 0.2s ease;" 
                onmouseenter="${allDayExams.length ? 'this.style.background=\'rgba(99,102,241,0.1)\';this.style.transform=\'translateY(-2px)\'' : ''}" 
                onmouseleave="${allDayExams.length ? 'this.style.background=\'rgba(99,102,241,0.04)\';this.style.transform=\'translateY(0)\'' : ''}">
                <div style="font-size:0.72rem; font-weight:${isToday?'800':'500'}; color:${isToday?'var(--primary)':'var(--text-secondary)'}; margin-bottom:2px;">${day}</div>
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

// Takvim filtre butonları
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

        let bgColor = 'rgba(255,255,255,0.02)';
        let indicator = '';

        if (isProctor && isResponsible) {
            bgColor = 'rgba(239, 68, 68, 0.08)'; // K\u0131rm\u0131z\u0131 (Her ikisi)
        } else if (isProctor) {
            bgColor = 'rgba(99,102,241,0.05)'; // Mor (G\u00f6zetmen)
        } else if (isResponsible) {
            bgColor = 'rgba(245, 158, 11, 0.08)'; // Turuncu (Sorumlu Hoca)
        }

        const examPreviews = combinedExamsOnDay.slice(0, 2).map(ex => {
            const isP = proctorExamsAtDate.some(e => e.id === ex.id);
            const isR = responsibleExamsAtDate.some(e => e.id === ex.id);
            let roleColor = 'var(--primary)';
            if (isP && isR) roleColor = 'var(--accent-red)';
            else if (isR) roleColor = 'var(--accent-orange)';
            
            return `<div style="font-size:0.52rem; background:${roleColor}; color:white; padding:1px 3px; border-radius:3px; margin:1px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ex.time} ${ex.name.substring(0,6)}..</div>`;
        }).join('');

        const todayStyle = isToday ? 'border: 1px solid var(--primary); box-shadow: 0 0 8px rgba(99,102,241,0.2);' : 'border: 1px solid rgba(255,255,255,0.05);';
        const hasClick = (combinedExamsOnDay.length > 0) ? `onclick="showProfileCalDayDetail('${dateStr}')" style="cursor:pointer; ${todayStyle} background:${bgColor};"` : `style="${todayStyle} background:${bgColor}; opacity:0.6;"`;

        html += `
            <div ${hasClick} class="profile-cal-day" style="display: flex; flex-direction: column; align-items: stretch; justify-content: start; min-height: 55px; padding: 4px 3px; border-radius: 8px; transition: all 0.2s;">
                <div style="font-size:0.65rem; font-weight: ${isToday ? '800' : '500'}; color: ${isToday ? 'var(--primary)' : 'white'}; margin-bottom: 2px; text-align:center;">${d}</div>
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
    titleEl.textContent = `📅 ${formattedDate} Programı`;
    
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

    // Puan
    const puanEl = document.getElementById('profile-dash-puan');
    if (puanEl) puanEl.textContent = staff.totalScore.toFixed(1);

    // Sıralama
    const sorted = [...DB.staff].sort((a, b) => b.totalScore - a.totalScore);
    const rank = sorted.findIndex(s => String(s.id) === String(staffId)) + 1;
    const rankEl = document.getElementById('profile-dash-rank');
    if (rankEl) rankEl.textContent = `#${rank}`;

    // Sık birlikte çalıştıklarım
    const matesCount = {};
    DB.exams.filter(e => isStaffProctorById(e, staffId)).forEach(ex => {
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
            ? sortedMates.map(([name, cnt]) => `<span style="display:block;">\u2022 ${name} <span style="color:var(--primary); font-weight:700;">(${cnt} kez)</span></span>`).join('')
            : '<span style="color:var(--text-muted);">Hen\u00fcz ortak g\u00f6rev yok</span>';
    }

    // Geri sayım
    startProfileCountdown(staffId);
}

function startProfileCountdown(staffId) {
    if (profileCountdownTimer) clearInterval(profileCountdownTimer);
    const countVal = document.getElementById('profile-countdown');
    const countTarget = document.getElementById('profile-countdown-target');
    if (!countVal || !countTarget) return;

    const now = new Date();
    const upcoming = DB.exams
        .filter(e => isStaffProctorById(e, staffId) && new Date(`${e.date}T${e.time}`) > now)
        .sort((a, b) => (a.date + 'T' + a.time).localeCompare(b.date + 'T' + b.time));

    if (upcoming.length === 0) {
        countVal.textContent = '-- : -- : --';
        countTarget.textContent = 'G\u00f6revde bulunmuyorsunuz.';
        return;
    }

    const next = upcoming[0];
    const targetDate = new Date(`${next.date}T${next.time}`);
    countTarget.textContent = `${next.name} (${next.date})`;

    const update = () => {
        const diff = targetDate - new Date();
        if (diff <= 0) { countVal.textContent = 'S\u0131nav Ba\u015flad\u0131!'; clearInterval(profileCountdownTimer); return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        countVal.textContent = `${h.toString().padStart(2, '0')} : ${m.toString().padStart(2, '0')} : ${s.toString().padStart(2, '0')}`;
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

    // Bu sekme artık "Proctor olarak atandığım sınavların hocalarından gelen mesajlar" olacak
    const now = new Date();
    const myMessages = DB.exams
        .filter(ex => {
            const pIds = ex.proctorIds || [ex.proctorId];
            const isMe = pIds.some(pid => String(pid) === String(staff.id));
            if (!isMe) return false;

            // Sınav bitmiş mi kontrolü (Sadece gelecek/aktif sınavları göster)
            const exDate = new Date(`${ex.date}T${ex.time}`);
            const exEnd = new Date(exDate.getTime() + (ex.duration || 60) * 60000);
            return exEnd > now;
        })
        .sort((a, b) => (a.date + 'T' + a.time).localeCompare(b.date + 'T' + b.time));

    if (myMessages.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">Henüz hocalardan gelen bir mesaj bulunmuyor.</td></tr>`;
        return;
    }

    myMessages.forEach(ex => {
        const msg = ex.lecturerNote || `${ex.name} sınavı içi bilgilendirme bekleniyor...`;
        
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
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">Henüz sorumlu olduğunuz ders sınavı bulunmuyor.</td></tr>`;
        return;
    }

    lecturerExams.forEach(ex => {
        const pNames = (ex.proctorIds || [ex.proctorId]).map(pid => {
            const s = DB.staff.find(st => String(st.id) === String(pid));
            return s ? s.name : '???';
        }).filter(n => n !== '???');
        
        const proctorsStr = pNames.length > 0 ? pNames.join(', ') : '<span style="color:var(--accent-orange);">Henüz atanmadı</span>';
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
    const ex = DB.exams.find(e => e.id === id);
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
    
    const ex = DB.exams.find(e => e.id === id);
    if (ex) {
        ex.lecturerNote = text;
        ex.lecturerNoteTimestamp = Date.now(); // Bildirim için zaman damgası
        
        // Kaydet
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
        if (typeof saveToBackend === 'function') saveToBackend();
        
        showToast('Mesajınız gözetmenlere iletildi.');
        if (document.getElementById('lecturer-message-text')) {
            document.getElementById('lecturer-message-text').value = '';
        }
        closeLecturerMessageModal();
        
        // Tabloları yenile
        const myStaffId = localStorage.getItem('myStaffId');
        const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
        renderLecturerExamsTab(myStaffId, staff);
        renderResponsibleExamsTab(myStaffId, staff);
        
        // Eğer portal açıksa orayı da yenile
        const portalSelect = document.getElementById('lecturer-portal-staff-select');
        if (portalSelect && portalSelect.value) {
            renderLecturerPortal(portalSelect.value);
        }
    }
};

/**
 * HOCA PORTALI (Şifresiz Login Tarafı)
 */
function loadLecturerPortalStaff() {
    const select = document.getElementById('lecturer-portal-staff-select');
    if (!select) return;
    
    if (select.options.length > 1) return;

    // DB.lecturers listesini kullan (Title + Name formatında)
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

    // Bu hocaya ait sınavları bul (Daha esnek bir isim eşleşmesi için trim ve toLocaleLowerCase('tr') kullanıyoruz)
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
        courseSelect.innerHTML = '<option value="">Adınıza kayıtlı ders bulunamadı.</option>';
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

        title.textContent = "🚀 Tüm Sınavlarım (Toplu Mesaj)";
        details.innerHTML = `<span style="color:var(--accent-orange);">Bu alana yazacağınız not, aşağıda listelenen tüm sınavlarınıza ve görevli gözetmenlere iletilecektir.</span>`;
        
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
                : '<span style="color:var(--accent-orange); opacity:0.7;">Atanmış gözetmen bulunamadı</span>';
        }
        
        // Eğer tüm sınavların notu aynıysa onu getir, farklıysa boş bırak veya ilkini getir
        const firstNote = myExams.length > 0 ? (myExams[0].lecturerNote || '') : '';
        const allSame = myExams.every(ex => (ex.lecturerNote || '') === firstNote);
        textarea.value = allSame ? firstNote : "";
        textarea.placeholder = "Tüm sınavlarınıza ortak bir not iletmek için buraya yazın...";

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
                : '<span style="color:var(--accent-orange); opacity:0.7;">Henüz atanmadı</span>';
        }

        textarea.value = exam.lecturerNote || '';
        textarea.placeholder = "Sınav gözetmenlerine iletmek istediğiniz notu buraya yazın...";
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
            showToast(`${myExams.length} sınava ortak mesajınız iletildi.`);
            if (textarea) textarea.value = '';
        } else {
            const exam = DB.exams.find(e => String(e.id) === String(examId));
            if (!exam) throw new Error("Sınav bulunamadı.");
            exam.lecturerNote = note;
            exam.lecturerNoteTimestamp = Date.now();
            showToast('Mesajınız gözetmenlere iletildi.');
            if (textarea) textarea.value = '';
        }

        // Yerel kaydet (Anında başarılı olsun)
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
        showToast('Kayıt sırasında bir hata oluştu: ' + err.message, 'error');
    }

    const myStaffId = localStorage.getItem('myStaffId');
    if (myStaffId) {
        const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
        if (typeof renderLecturerExamsTab === 'function') renderLecturerExamsTab(myStaffId, staff);
        if (typeof renderResponsibleExamsTab === 'function') renderResponsibleExamsTab(myStaffId, staff);
    }
};


/**
 * Gözetmenin Kendi Sınav Süresini Düzenlemesi
 */
window.updateExamDurationFromProfile = function(id) {
    try {
        const ex = DB.exams.find(e => String(e.id) === String(id));
        if (!ex) {
            console.error('Sınav bulunamadı:', id);
            return;
        }

        const newDur = prompt(`${ex.name} sınavı için yeni süreyi (dakika) girin:`, ex.duration || 60);
        if (newDur !== null) {
            const val = parseInt(newDur);
            if (!isNaN(val) && val > 0) {
                // Centralized update function (it handles score, proctor totals, and storage)
                updateExam(id, { duration: val });
                
                // Kayıt ve UI Yenileme
                if (typeof saveToBackend === 'function') saveToBackend();
                
                if (typeof showToast === 'function') showToast('Sınav süresi güncellendi.');
                else alert('Sınav süresi güncellendi.');

                renderProfile(); // Görüntüyü yenile
                
                // Eğer "Sorumlu Olduğum" sekmesi açıksa orayı da yenile
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
        console.error('Süre güncelleme hatası:', err);
        alert('Bir hata oluştu: ' + err.message);
    }
};

function renderPasswordSection(staff) {
    let container = document.getElementById('profile-password-section');
    if (!container) return;

    const hasPass = !!staff.staffPassword;
    container.innerHTML = `
        <div style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; background: rgba(99,102,241,0.07); border: 1px solid rgba(99,102,241,0.25); border-radius: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0; font-size: 0.9rem; color: var(--primary);">🔑 Kişisel Giriş Şifrem</h4>
                ${hasPass ? '<span style="font-size:0.75rem; color:var(--accent-green); background:rgba(34,197,94,0.1); padding:3px 10px; border-radius:20px;">✓ Şifre Ayarlı</span>' : '<span style="font-size:0.75rem; color:var(--text-muted);">Henüz şifre yok</span>'}
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
                Kişisel şifrenizi belirleyerek giriş ekranında doğrudan kendi profilinize geçiş yapabilirsiniz.
            </p>
            <div style="display: flex; gap: 10px; align-items: center;">
                <input type="password" id="profile-pass-input" placeholder="Yeni şifre girin" 
                    style="flex:1; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 0.6rem 0.9rem; border-radius: 9px; color:white; font-family:inherit;">
                <button onclick="saveProfilePassword(${staff.id})" class="btn-primary" style="white-space:nowrap; padding: 0.6rem 1.1rem; font-size:0.85rem;">Kaydet</button>
                ${hasPass ? `<button onclick="removeProfilePassword(${staff.id})" class="btn-secondary" style="white-space:nowrap; padding: 0.6rem 0.9rem; font-size:0.85rem; color:var(--accent-red);">Kaldır</button>` : ''}
            </div>
        </div>
    `;
}

window.saveProfilePassword = function(staffId) {
    const input = document.getElementById('profile-pass-input');
    const newPass = (input && input.value) ? input.value.trim() : '';
    if (!newPass) { alert('Şifre boş olamaz!'); return; }
    if (newPass.length < 4) { alert('Şifre en az 4 karakter olmalıdır!'); return; }

    // Aynı şifre başka birinde var mı?
    const ADMIN_PASSWORD = 'GtuAdmın123';
    const GOZETMEN_PASSWORD = 'Gtu2026';
    if (newPass === ADMIN_PASSWORD || newPass === GOZETMEN_PASSWORD) {
        alert('Bu şifre sisteme ayrılmış, lütfen farklı bir şifre seçin.'); return;
    }
    const conflict = DB.staff.find(s => s.staffPassword === newPass && String(s.id) !== String(staffId));
    if (conflict) { alert('Bu şifre zaten başka bir gözetmen tarafından kullanılıyor!'); return; }

    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff) return;
    staff.staffPassword = newPass;
    saveToLocalStorage();
    alert(`✓ Şifreniz başarıyla kaydedildi!\n\nArtık giriş ekranında "${newPass}" şifresiyle doğrudan profilinize girebilirsiniz.`);
    renderPasswordSection(staff);
};

window.removeProfilePassword = function(staffId) {
    if (!confirm('Kişisel şifreniz kaldırılacak. Emin misiniz?')) return;
    const staff = DB.staff.find(s => String(s.id) === String(staffId));
    if (!staff) return;
    delete staff.staffPassword;
    saveToLocalStorage();
    renderPasswordSection(staff);
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
    alert("✓ Duyuru başarıyla kaydedildi.");
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
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) return;

    const staff = DB.staff.find(s => String(s.id) === String(myStaffId));
    if (!staff) return;

    const container = document.querySelector('#profile-table-constraints tbody');
    if (!container) return;

    const userConstraints = DB.constraints[staff.name] || [];
    container.innerHTML = '';

    if (userConstraints.length === 0) {
        container.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:2rem;">Henüz bir kısıt girmediniz.</td></tr>';
        return;
    }

    const TurkishDays = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

    userConstraints.forEach((c, idx) => {
        let label = "";
        if (c.day !== undefined) {
            label = `Haftalık: ${TurkishDays[c.day]}`;
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

    renderMiniAvailabilityGrid(userConstraints);
}

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
    if (!staff) return;

    const type = document.getElementById('profile-constraint-type').value;
    const start = document.getElementById('profile-constraint-start').value;
    const end = document.getElementById('profile-constraint-end').value;

    const newConstraint = { start, end };
    if (type === 'day') {
        newConstraint.day = parseInt(document.getElementById('profile-constraint-day').value);
    } else {
        const dateVal = document.getElementById('profile-constraint-date').value; // YYYY-MM-DD
        if (!dateVal) { alert("Lütfen tarih seçin!"); return; }
        const parts = dateVal.split('-');
        newConstraint.date = `${parts[1]}-${parts[2]}`; // MM-DD formatı logic.js uyumlu
    }

    if (!DB.constraints[staff.name]) DB.constraints[staff.name] = [];
    DB.constraints[staff.name].push(newConstraint);

    saveToLocalStorage();
    renderProfileConstraints();
    alert("✓ Müsaitlik kısıtı profilinize eklendi.");
}

window.handleProfileConstraintDelete = function(name, idx) {
    if (confirm("Bu kısıtı silmek istediğinize emin misiniz?")) {
        if (DB.constraints[name]) {
            DB.constraints[name].splice(idx, 1);
            saveToLocalStorage();
            renderProfileConstraints();
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

    if (confirm(`${exam.name} sınavı için yerinize birini aramak istediğinize emin misiniz? Bu talep diğer hocalara görünecektir.`)) {
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
            receiverName: "Açık Talep",
            status: 'pending', // Spec: pending
            fromApproved: true,
            toApproved: false,
            createdAt: new Date().toISOString()
        };

        if (!DB.requests) DB.requests = [];
        DB.requests.push(newReq);
        logAction('SWAP_INITIATED', `${staff.name}, ${exam.name} için yer değiştirme talebi açtı.`, { examId });
        saveToLocalStorage();
        alert("Talebiniz oluşturuldu. Uygun gözetmenler 'Açık Görevler' sekmesinden kabul edebilir.");
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

    // Açık talepleri bul (pending ve receiverId null)
    // Filtreleme: Kullanıcı tarafından reddedilmiş (gizlenmiş) talepleri çıkar
    const dismissedKey = `dismissed_requests_${myStaffId}`;
    const dismissedIds = JSON.parse(localStorage.getItem(dismissedKey) || "[]");

    const now = new Date();
    const openRequests = (DB.requests || [])
        .filter(r => {
            if (r.status !== 'pending' || r.receiverId !== null || r.initiatorId === myStaffIdNum) return false;
            if (dismissedIds.includes(r.id)) return false;
            // Geçmiş sınavları gösterme
            const exam = DB.exams.find(e => String(e.id) === String(r.examId));
            if (!exam) return false;
            const examDate = new Date(`${exam.date}T${exam.time}`);
            const examEnd = new Date(examDate.getTime() + (exam.duration || 60) * 60000);
            return examEnd >= now;
        });

    if (openRequests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Şu an için uygun açık görev bulunmuyor.</td></tr>';
        return;
    }

    openRequests.forEach(req => {
        const exam = DB.exams.find(e => e.id == req.examId);
        if (!exam) return;

        // Kullanıcı bu saatte müsait mi?
        const isFree = isProctorTrulyFree(myStaffIdNum, req.examDate, req.examTime, exam.duration);
        
        if (isFree) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${req.examName}</strong><br><small>${req.initiatorName} tarafından bırakıldı</small></td>
                <td>${req.examDate.split("-").reverse().join(".")}</td>
                <td>${req.examTime}</td>
                <td>${exam.duration} dk</td>
                <td><span class="score-tag">+${exam.score || 0}</span></td>
                <td style="text-align:right; display: flex; gap: 5px; justify-content: flex-end;">
                    <button class="btn-primary" onclick="acceptOpenRequest(${req.id})" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; background: var(--accent-green);">Görevi Al</button>
                    <button class="btn-delete" onclick="dismissMarketplaceRequest(${req.id})" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">Reddet</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });

    if (tbody.children.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Müsait olduğunuz bir açık görev bulunmuyor.</td></tr>';
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
        alert("Üzgünüz, bu görev az önce başkası tarafından kabul edildi veya iptal edildi.");
        renderProfile();
        return;
    }

    const exam = DB.exams.find(e => e.id == req.examId);
    if (!exam) return;

    const confirmed = await confirmWithPassword(
        `"${req.examName}" görevini devralacağınızı onaylamak için lütfen kişisel şifrenizi girin.`,
        staff
    );
    if (confirmed) {
        const fromStaff = DB.staff.find(s => s.id == req.initiatorId);
        const toStaff = staff;

        // Puan ve Görev Sayısı Güncelleme
        if (fromStaff) {
            fromStaff.totalScore = Math.max(0, parseFloat((fromStaff.totalScore - exam.score).toFixed(2)));
            fromStaff.taskCount = Math.max(0, fromStaff.taskCount - 1);
        }
        
        toStaff.totalScore = parseFloat((toStaff.totalScore + exam.score).toFixed(2));
        toStaff.taskCount = (toStaff.taskCount || 0) + 1;

        // Sınavı Güncelle
        if (!exam.proctorIds) exam.proctorIds = [exam.proctorId];
        
        // Initiator'ı bul ve değiştir
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

        logAction('user', 'Açık Talep Kabulü', `${toStaff.name}, ${req.initiatorName}'in ${req.examName} görevini devraldı.`);
        
        saveToLocalStorage();
        
        // Admin modundaysa sunucuya kaydet
        await saveToBackend();
        
        alert("✓ Görev başarıyla devralındı ve puanlar güncellendi.");
        
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

    if (confirm(`${req.receiverName} hocaya görevi devretmek istediğinize emin misiniz? İşlem anında gerçekleşecektir.`)) {
        req.toApproved = true;
        
        const exam = DB.exams.find(e => e.id == req.examId);
        const fromStaff = DB.staff.find(s => s.id == req.initiatorId);
        const toStaff = DB.staff.find(s => s.id == req.receiverId);

        if (exam && fromStaff && toStaff) {
            fromStaff.totalScore = Math.max(0, parseFloat((fromStaff.totalScore - exam.score).toFixed(2)));
            fromStaff.taskCount = Math.max(0, fromStaff.taskCount - 1);
            
            toStaff.totalScore = parseFloat((toStaff.totalScore + exam.score).toFixed(2));
            toStaff.taskCount = (toStaff.taskCount || 0) + 1;

            exam.proctorId = toStaff.id;
            exam.proctorName = toStaff.name;
            if (!exam.proctorIds) exam.proctorIds = [toStaff.id];
            else {
                const idx = exam.proctorIds.indexOf(fromStaff.id);
                if (idx !== -1) exam.proctorIds[idx] = toStaff.id;
            }

            req.status = 'approved';
            logAction('SWAP_CONFIRMED', `${req.initiatorName}, ${req.receiverName}'i onayladı (Anında gerçekleşti).`, { requestId });
            saveToLocalStorage();
            alert("✓ Onaylandı. Görev devri anında gerçekleşti ve puanlar güncellendi.");
            renderProfile();
        }
    }
};

window.rejectOpenRequest = function(requestId) {
    const req = DB.requests.find(r => r.id === requestId);
    if (!req) return;

    if (confirm("Bu hocanın kabulünü reddetmek istediğinize emin misiniz? Talebiniz tekrar açık hale gelecektir.")) {
        req.receiverId = null;
        req.receiverName = "Açık Talep";
        req.status = 'pending';
        logAction('SWAP_REJECTED', `${req.initiatorName}, ${req.receiverName}'i reddetti (Talep tekrar açıldı).`, { requestId });
        saveToLocalStorage();
        renderProfile();
    }
};

window.goToProfileAvailability = function() {
    // 1. Profil sekmesine geç
    document.getElementById('btn-profile').click();
    
    // 2. Kısıt Ayarlarım tabına geç
    const availTabBtn = document.querySelector('#section-profile .tab-btn[data-tab="availability"]');
    if (availTabBtn) availTabBtn.click();
};

window.goToProfileMarketplace = function() {
    // 1. Profil sekmesine geç
    document.getElementById('btn-profile').click();
    
    // 2. Pazar Yeri tabına geç
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
            logAction('user', 'Talep İptali', `${req.initiatorName}, ${req.examName} için açtığı talebi iptal etti.`);
            saveToLocalStorage();
            renderExams();
            renderProfile();
            updateMarketplaceBadge();
            alert("✓ Talep başarıyla iptal edildi.");
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
    
    // Hocanın aktif sınavlarını bul
    const now = new Date();
    const targetExams = DB.exams.filter(e => String(e.proctorId) === String(targetStaffId) && new Date(e.date) >= now);

    if (targetExams.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem;">Bu hocanın aktif görevi bulunmuyor.</p>';
    } else {
        list.innerHTML = targetExams.map(ex => `
            <div class="suggestion-item" onclick="selectDirectSwapTargetExam(${ex.id}, \`${ex.name.replace(/`/g, '')}\`, '${ex.date}', this)">
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
            alert("Lütfen karşı tarafın sınavını seçiniz.");
            return;
        }

        const myStaff = DB.staff.find(s => String(s.id) === String(myStaffId));
        const targetStaff = DB.staff.find(s => String(s.id) === String(targetStaffId));
        const myExam = DB.exams.find(e => String(e.id) === String(myExamId));
        const targetExam = DB.exams.find(e => String(e.id) === String(targetExamId));

        if (!myStaff || !targetStaff || !myExam || !targetExam) {
            alert("Kayıt bulunamadı. Lütfen sayfayı yenileyin.");
            return;
        }

        if (confirm(`${targetStaff.name} hocaya birebir takas teklifi göndermek istediğinize emin misiniz?`)) {
            if (!DB.requests) DB.requests = [];
            
            DB.requests.push({
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
            });

            saveToLocalStorage();
            alert("Takas teklifiniz iletildi. Hocanın onaylaması bekleniyor.");
            document.getElementById('modal-direct-swap').classList.add('hidden');
            renderProfile();
        }
    } catch(err) {
        alert("Teklif Gönderilirken Hata: " + err.message);
        console.error("Direct swap error:", err);
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
        alert("Eski veri veya uyumsuz sınav hatası oluştu, bu hatalı talep iptal edildi.");
        renderProfile();
        return;
    }

    const confirmed = await confirmWithPassword(
        `${hisStaff.name} ile görevi takas etmeyi onaylamak için lütfen kişisel şifrenizi girin.`,
        myStaff
    );
    if (confirmed) {
        // PUAN GÜNCELLEME
        // Benim eski sınavımı ondan çıkar, onun sınavını bana ekle demiyoruz. 
        // Birebir değişim: MyExam onun oluyor, HisExam benim oluyor.
        
        // 1. Benim puanımdan benim eski sınavımı düş, onun sınavını ekle
        myStaff.totalScore = parseFloat((myStaff.totalScore - myExam.score + hisExam.score).toFixed(2));
        
        // 2. Onun puanından onun sınavını düş, benimkini ekle
        hisStaff.totalScore = parseFloat((hisStaff.totalScore - hisExam.score + myExam.score).toFixed(2));

        // 3. Görev sayıları değişmez (1 verildi 1 alındı)

        // 4. Sınavların Gözetmenlerini Değiştir
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

        saveToLocalStorage();
        logAction('user', 'Birebir Takas', `${hisStaff.name} ve ${myStaff.name} hocalar ${hisExam.name} ile ${myExam.name} sınavlarını takas etti.`);
        alert("✅ Takas işlemi başarıyla tamamlandı!");
        
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

    // Mevcut açık modal'lardaki dropdown'ları tazele
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
        alert("Atama yapılacak gözetmensiz sınav bulunamadı.");
        return;
    }

    if (confirm(`${unassignedExams.length} adet sınava otomatik gözetmen atansın mı?`)) {
        let assignedCount = 0;
        unassignedExams.forEach(ex => {
            const best = findBestProctor(ex.date, ex.time, ex.duration);
            if (best) {
                ex.proctorId = best.id;
                ex.proctorIds = [best.id];
                ex.proctorName = best.name;
                
                const score = calculateScore(new Date(`${ex.date}T${ex.time}`), ex.duration);
                ex.score = score;
                
                best.totalScore = parseFloat((best.totalScore + score).toFixed(2));
                best.taskCount = (best.taskCount || 0) + 1;
                assignedCount++;
            }
        });

        saveToLocalStorage();
        await saveToBackend();
        
        logAction('admin', 'Toplu Atama', `${assignedCount} unassigned sınava otomatik gözetmen atandı.`);
        
        renderExams();
        renderDashboard();
        renderStaff();
        alert(`✓ ${assignedCount} sınava başarıyla atama yapıldı.`);
    }
};

window.quickFixConflict = async function(examId) {
    const exam = DB.exams.find(e => e.id === examId);
    if (!exam) return;

    if (confirm(`${exam.name} sınavı için çakışmayı otomatik gidermek istiyor musunuz? Uygun en iyi gözetmen atanacaktır.`)) {
        // Eski gözetmen puanlarını düş (Multi-proctor desteğiyle)
        const oldPIds = exam.proctorIds || [exam.proctorId];
        oldPIds.forEach(pid => {
            const s = DB.staff.find(staff => staff.id === pid);
            if (s) {
                s.totalScore = Math.max(0, parseFloat((s.totalScore - exam.score).toFixed(2)));
                s.taskCount = Math.max(0, s.taskCount - 1);
            }
        });

        // Yeni gözetmen bul
        const best = findBestProctor(exam.date, exam.time, exam.duration, exam.id);
        if (best) {
            exam.proctorId = best.id;
            exam.proctorIds = [best.id];
            exam.proctorName = best.name;
            
            best.totalScore = parseFloat((best.totalScore + exam.score).toFixed(2));
            best.taskCount = (best.taskCount || 0) + 1;

            saveToLocalStorage();
            await saveToBackend();

            renderExams();
            renderDashboard();
            renderStaff();
            renderSchedule();
            alert(`✓ ${best.name} başarıyla atandı.`);
        } else {
            // Eski gözetmenleri geri al (yetersiz yedek)
            oldPIds.forEach(pid => {
                const s = DB.staff.find(staff => staff.id === pid);
                if (s) {
                    s.totalScore = parseFloat((s.totalScore + exam.score).toFixed(2));
                    s.taskCount = (s.taskCount || 0) + 1;
                }
            });
            alert("⚠️ Uygun yedek gözetmen bulunamadı!");
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
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">Henüz işlem kaydı bulunmuyor.</td></tr>';
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
 * PDF Olarak Dışa Aktar (jsPDF & AutoTable)
 */
async function exportToPDF(tableId, title) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Yatay format
    
    try {
        // Türkçe destekleyen Roboto fontlarını çekip sanal dosya sistemine ekliyoruz
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
        console.warn('Font yüklenemedi. Varsayılan font kullanılacak:', e);
    }

    // Emojileri temizleyen ama Türkçe karakterlere dokunmayan fonksiyon
    const cleanStr = (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
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
        alert('Tablo bulunamadı!');
        return;
    }

    // AutoTable
    doc.autoTable({
        html: `#${tableId}`,
        startY: 35,
        theme: 'grid',
        styles: {
            font: 'Roboto', // Dinamik fontumuz
            fontStyle: 'normal',
            fontSize: 8,
            cellPadding: 3,
            valign: 'middle'
        },
        headStyles: {
            fillColor: [99, 102, 241], // Primary color
            textColor: 255,
            fontSize: 9,
            font: 'Roboto',
            fontStyle: 'bold' // Roboto-Medium çekecek
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

    // Sadece Dosya ismi için güvenlik amacıyla Türkçe karakter değiştirelim (indirilirken hata olmasın)
    const replaceTRForFilename = (str) => {
        const trMap = {
            'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
            'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
        };
        return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, m => trMap[m]).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
    };

    const filename = `${replaceTRForFilename(title).toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    doc.save(filename);
}

/**
 * Tema Kontrolü
 */
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = isLight ? '☀️' : '🌓';
    }
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function applyTheme() {
    const savedTheme = localStorage.getItem('theme');
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (toggleBtn) toggleBtn.textContent = '☀️';
    } else {
        document.body.classList.remove('light-theme');
        if (toggleBtn) toggleBtn.textContent = '🌓';
    }
}

/**
 * GÖRSEL SINAV ÇİZELGESİ (TIMELINE) MANTIĞI
 */

function renderTimeline() {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    // Sınavları tarihe göre filtrele
    const exams = DB.exams.filter(ex => ex.date === currentTimelineDate);
    
    if (exams.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-muted);">
            <div style="font-size:3rem; margin-bottom:1rem;">📅</div>
            <p>Bu tarihte (${currentTimelineDate.split('-').reverse().join('.')}) kayıtlı sınav bulunmuyor.</p>
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
    
    // Saat Başlıkları
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

    // Satırlar (Derslikler)
    Object.entries(roomGroups).forEach(([room, roomExams]) => {
        html += `<div class="timeline-row">
            <div class="timeline-room-label">
                <div class="room-name">${room}</div>
                <div class="room-capacity">${roomExams.length} Sınav</div>
            </div>
            <div class="timeline-content-area">`;
        
        roomExams.forEach(ex => {
            const left = timeToPx(ex.time);
            const width = (ex.duration / (totalHours * 60)) * 100;
            
            // Sınav türüne göre renkler
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
        // Panel açıldığında tüm bildirimleri görülmüş say (Badge'i gizle ve süreyi kaydet)
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
        // Pazar Yerindeki Açık Görevler (Initiator ben değilsem ve sınav bitmediyse)
        const openMarketplace = (DB.requests || []).filter(r => 
            r.status === 'open' && 
            String(r.initiatorId) !== String(myStaffId)
        );

        openMarketplace.forEach(req => {
            notifs.push({
                type: 'marketplace',
                title: 'Açık Görev',
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
                msg = `"${req.examName}" takas talebi onaylandı!`;
                icon = "✅";
            } else if (req.status === 'rejected') {
                msg = `"${req.examName}" takas talebi reddedildi.`;
                icon = "❌";
            } else if (req.status === 'pending_peer' && !isInitiator) {
                msg = `Size yeni bir takas teklifi geldi: "${req.examName || 'Bilinmeyen Sınav'}"`;
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

        // 3. Yaklaşan Sınavlar (Sonraki 48 saat içindeki sınavlar)
        const now = Date.now();
        const futureLimit = now + (48 * 60 * 60 * 1000);
        DB.exams.filter(ex => String(ex.proctorId) === String(myStaffId)).forEach(ex => {
            const exDate = new Date(`${ex.date}T${ex.time}`).getTime();
            if (exDate > now && exDate < futureLimit) {
                notifs.push({
                    type: 'exam',
                    title: 'Yaklaşan Görev',
                    message: `Hatırlatma: "${ex.name}" sınavı yaklaşıyor (${ex.date} ${ex.time})`,
                    time: exDate - 1, // Sınavın tam vaktinden bir saniye önce olsun ki listede üstte görünsün
                    icon: '⏳'
                });
            }
        });
    }

    // Tarihe göre yeniden eskiye sırala
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
    // Sadece görülmemiş bildirimlerin sayısını al
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

    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    label.textContent = `${monthNames[month]} ${year}`;
    if (subLabel) subLabel.textContent = `${monthNames[month]} ayı genel sınav dağılımı`;

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
                    ${dayExams.length > 3 ? `<div style="font-size:0.6rem; color:var(--text-muted); margin-top:2px;">+${dayExams.length - 3} Sınav Daha</div>` : ''}
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
        title.innerHTML = `📅 ${dateStr.split('-').reverse().join('.')} Tarihli Detaylı Çizelge`;
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
    
    // Benim gözetmen olduğum ve yeni veya güncellenmiş notu olan sınavlar
    const hasNewMessage = DB.exams.some(ex => {
        const pIds = ex.proctorIds || [ex.proctorId];
        const isMe = pIds.some(pid => String(pid) === String(myStaffId));
        if (!isMe) return false;
        
        // Not var mı ve son kontrolümüzden sonra mı güncellenmiş?
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
                    🔄 <strong>${m.otherStaff.name}</strong> hocanın <strong>${m.otherExam.name}</strong> (${m.otherExam.date.split('-').reverse().join('.')} ${m.otherExam.time}) sınavı ile takas edebilirsiniz. Her iki tarafın da programı bu takas için uygundur.
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
        alert("✅ Başarılı!\n" + res.message);
        renderProfile();
        updateNotificationBadge();
        await saveToBackend();
    } else {
        alert("❌ Hata: " + res.message);
    }
};

/**
 * Şifre Ayarlarını Render Et (Profil Güvenliği)
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
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.25rem;">Hesabınızı güvene almak ve başkalarının profilinize erişmesini engellemek için bir giriş şifresi belirleyebilirsiniz.</p>
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
                    <h4 style="margin: 0; font-size: 0.9rem; color: #10b981; text-transform: uppercase;">Hesabınız Güvende</h4>
                </div>
                <p style="font-size: 0.8rem; color: var(--text-muted);">Sistem şifreniz aktif. Şifrenizi değiştirmek veya kaldırmak için yönetici ile iletişime geçebilirsiniz.</p>
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

    if (confirm("Profilinizi bu şifre ile korumak istediğinize emin misiniz? Bir sonraki girişte bu şifre sorulacaktır.")) {
        staff.staffPassword = pass;
        saveToLocalStorage();
        renderProfile();
        await saveToBackend();
        alert("✅ Şifreniz başarıyla kaydedildi.");
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
        alert("Hata: Sınav veya personel bilgisi bulunamadı!");
        return;
    }

    if (confirm("Bu akıllı takas teklifini kabul etmek istiyor musunuz? Sınav görevleriniz karşılıklı olarak değiştirilecektir.")) {
        // Puan ve görev sayılarını güncelle (Önce eskileri çıkar)
        me.totalScore = Math.max(0, parseFloat((me.totalScore - myExam.score).toFixed(2)));
        me.taskCount = Math.max(0, me.taskCount - 1);
        
        him.totalScore = Math.max(0, parseFloat((him.totalScore - hisExam.score).toFixed(2)));
        him.taskCount = Math.max(0, him.taskCount - 1);

        // Şimdi karşılıklı ata
        myExam.proctorId = him.id;
        myExam.proctorIds = [him.id];
        myExam.proctorName = him.name;
        
        hisExam.proctorId = me.id;
        hisExam.proctorIds = [me.id];
        hisExam.proctorName = me.name;

        // Yeni puanları ekle
        me.totalScore = parseFloat((me.totalScore + hisExam.score).toFixed(2));
        me.taskCount += 1;
        
        him.totalScore = parseFloat((him.totalScore + myExam.score).toFixed(2));
        him.taskCount += 1;

        // Talebi tamamlandı olarak işaretle ve kaldır
        DB.requests.splice(reqIndex, 1);
        
        // Bildirim gönder
        if (!DB.notifications) DB.notifications = {};
        if (!Array.isArray(DB.notifications[him.id])) DB.notifications[him.id] = [];
        DB.notifications[him.id].unshift({
            id: Date.now(),
            message: `✅ **Takas Onaylandı:** ${me.name}, gönderdiğin akıllı takas teklifini kabul etti!`,
            type: 'swap_approved',
            createdAt: new Date().toISOString(),
            isRead: false
        });

        saveToLocalStorage();
        renderProfile();
        updateNotifBadge();
        await saveToBackend();
        
        alert("✅ Takas başarıyla gerçekleştirildi!");
    }
};

window.rejectSmartSwap = async function(requestId) {
    const reqIndex = DB.requests.findIndex(r => String(r.id) === String(requestId));
    if (reqIndex === -1) return;
    const req = DB.requests[reqIndex];

    if (confirm("Bu takas teklifini reddetmek istediğinize emin misiniz?")) {
        // Talebi kaldır
        const removed = DB.requests.splice(reqIndex, 1)[0];
        
        saveToLocalStorage();
        renderProfile();
        updateNotifBadge();
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

    if (btnImport && fileInput) {
        btnImport.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleExcelExamsFile);
    }
    
    if (btnAllImport) {
        btnAllImport.addEventListener('click', importAllExcelExams);
    }
}

async function handleExcelExamsFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = evt.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet);

            if (rows.length === 0) {
                showToast('Excel dosyası boş görünüyor!', 'error');
                return;
            }

            processExcelRows(rows);
        } catch (err) {
            console.error(err);
            showToast('Excel okuma hatası!', 'error');
        }
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = '';
}

function processExcelRows(rows) {
    draftExams = [];
    rows.forEach((row, index) => {
        // Sütun isimlerini esnek hale getirelim (farklı diller/isimler için)
        const type = row["Tür"] || row["Type"] || "Vize";
        const name = row["Sınav Adı"] || row["Ders"] || row["Exam Name"] || "Bilinmeyen Sınav";
        const lecturer = row["Öğretim Üyesi"] || row["Hoca"] || row["Lecturer"] || "";
        const location = row["Derslik"] || row["Yer"] || row["Location"] || "";
        const capacity = row["Kapasite"] || row["Mevcut"] || row["Capacity"] || 0;
        const duration = parseInt(row["Süre"] || row["Süre (dk)"] || row["Duration"] || 60);
        
        let date = row["Tarih"] || row["Date"] || "";
        let time = row["Saat"] || row["Time"] || "09:00";

        // Excel tarih formatı bazen sayı gelebilir, kontrol et
        if (typeof date === 'number') {
            const excelDate = new Date((date - (25567 + 1)) * 86400 * 1000);
            date = excelDate.toISOString().split('T')[0];
        }

        // Akıllı Atama: En uygun gözetmeni bul
        const best = findBestProctor(date, time, duration);
        
        draftExams.push({
            id: Date.now() + index,
            type,
            name,
            lecturer,
            location,
            capacity,
            date,
            time,
            duration,
            proctorId: best ? best.id : 0,
            proctorName: best ? best.name : "🤖 Atanmadı"
        });
    });

    renderExcelPreview();
}

function renderExcelPreview() {
    const modal = document.getElementById('modal-excel-preview');
    const tbody = document.querySelector('#table-excel-preview tbody');
    if (!modal || !tbody) return;

    tbody.innerHTML = '';
    draftExams.forEach(ex => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge" style="background: rgba(255,255,255,0.05); color:white;">${ex.type}</span></td>
            <td><strong>${ex.name}</strong><br><small style="color:var(--text-muted)">${ex.lecturer}</small></td>
            <td>${ex.date}</td>
            <td>${ex.time}</td>
            <td>${ex.location}</td>
            <td>${ex.duration} dk</td>
            <td style="color:var(--primary); font-weight:700;">
                <span title="AI Önerisi">🤖</span> ${ex.proctorName}
            </td>
        `;
        tbody.appendChild(tr);
    });

    modal.classList.remove('hidden');
}

async function importAllExcelExams() {
    if (draftExams.length === 0) return;

    if (!confirm(`${draftExams.length} sınavı sisteme aktarmak istediğinize emin misiniz?`)) return;

    // Her birini DB'ye ekle
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
            proctorIds: ex.proctorId ? [ex.proctorId] : []
        };
        addExam(examData);
    });

    document.getElementById('modal-excel-preview').classList.add('hidden');
    showToast(`${draftExams.length} sınav başarıyla aktarıldı!`);
    
    // UI Güncelle
    renderExams();
    renderSchedule();
    renderDashboard();
    
    // Backend'e kaydet (addExam zaten saveToLocalStorage çağırıyor)
    await saveToBackend();
}



