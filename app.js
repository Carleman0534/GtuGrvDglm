/**
 * Gözetmenlik UI Kontrolcü
 */


document.addEventListener('DOMContentLoaded', () => {
    const loginOverlay = document.getElementById('login-overlay');
    const appWrapper = document.getElementById('app-wrapper');
    const loginPassInput = document.getElementById('login-password');
    const btnLogin = document.getElementById('btn-login');
    const loginError = document.getElementById('login-error');

    // Şifreler (frontend yerel kontrolü)
    const ADMIN_PASSWORD = 'GtuAdmın123';
    const GOZETMEN_PASSWORD = 'Gtu2026';

    const finishLogin = async (isAdmin) => {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');
        
        if (!isAdmin) document.body.classList.add('guest-mode');
        else document.body.classList.remove('guest-mode');

        if (isAdmin) document.body.classList.add('admin-mode');
        else document.body.classList.remove('admin-mode');
        
        loginOverlay.classList.add('hidden');
        appWrapper.style.display = 'block';
        await initApp();
    };

    // Oturum Kontrolü
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        finishLogin(sessionStorage.getItem('isAdmin') === 'true');
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
    
    if (loginPassInput) {
        loginPassInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
});

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

    initUI();
    applyTheme(); // Theme on load
    renderProfile();
    updateRequestBadge(); // Update badge on load
    updateAnnouncementBadge(); // New announcement badge
    updateMarketplaceBadge(); // Marketplace badge
    loadStaffSelects(); // Personel seçim dropdownlarını yükle
}

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


const navButtons = {
    dashboard: document.getElementById('btn-dashboard'),
    schedule: document.getElementById('btn-schedule'),
    exams: document.getElementById('btn-exams'),
    staff: document.getElementById('btn-staff'),
    availability: document.getElementById('btn-availability'),
    requests: document.getElementById('btn-requests'),
    profile: document.getElementById('btn-profile'),
    audit: document.getElementById('btn-audit'),
    announcements: document.getElementById('btn-announcements')
};

const sections = {
    dashboard: document.getElementById('section-dashboard'),
    schedule: document.getElementById('section-schedule'),
    exams: document.getElementById('section-exams'),
    staff: document.getElementById('section-staff'),
    availability: document.getElementById('section-availability'),
    requests: document.getElementById('section-requests'),
    profile: document.getElementById('section-profile'),
    audit: document.getElementById('section-audit'),
    announcements: document.getElementById('section-announcements')
};

// Navigation
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
            sections.dashboard.classList.remove('hidden');
            navButtons.dashboard.classList.add('active');
            btn.classList.remove('active');
            return;
        }

        Object.values(sections).forEach(s => { if(s) s.classList.add('hidden'); });
        if (sections[key]) sections[key].classList.remove('hidden');

        if (key === 'dashboard') renderDashboard();
        if (key === 'schedule') {
            switchGeneralScheduleTab('active');
            renderSchedule();
        }
        if (key === 'exams') renderExams();
        if (key === 'staff') renderStaff();
        if (key === 'availability') renderAvailability();
        if (key === 'constraints') renderConstraintsPage();
        if (key === 'requests') {
            loadFromDataJSON().then(() => renderSwapRequests());
        }
        if (key === 'profile') renderProfile();
        if (key === 'audit') renderAuditLogs();
        if (key === 'announcements') {
            renderAnnouncements();
            markAnnouncementsAsRead();
        }
    });
});

let currentSort = { key: 'date', dir: 'asc' };
let currentExamTab = 'active';

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
        const activeTab = document.getElementById('tab-gen-btn-active').classList.contains('active') ? 'table-schedule' : 'table-archive-general';
        const title = activeTab === 'table-schedule' ? 'Genel Sınav Programı' : 'Arşiv Sınav Programı';
        exportToPDF(activeTab, title);
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
        });
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

    // İndirme (Export) Butonları Dinleyicileri
    const btnExportScheduleExcel = document.getElementById('btn-export-schedule-excel');
    if (btnExportScheduleExcel) {
        btnExportScheduleExcel.addEventListener('click', () => {
             exportTableToExcel('table-schedule', 'Sinav_Programi.xlsx');
        });
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
        // ... (existing code)
    }

    // Announcement Listeners
    document.getElementById('btn-add-announcement')?.addEventListener('click', () => editAnnouncement(null));
    document.getElementById('form-edit-announcement')?.addEventListener('submit', handleAnnouncementSubmit);

    // --- Phase 3: Batch Assignment & Search ---
    document.getElementById('btn-batch-assign')?.addEventListener('click', window.batchAutoAssign);
    document.getElementById('exam-search')?.addEventListener('input', renderExams);
    document.getElementById('staff-search')?.addEventListener('input', renderStaff);
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
            <td>x${ex.katsayi.toFixed(1)}</td>
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

function renderSchedule() {
    const tbodyActive = document.querySelector('#table-schedule tbody');
    const tbodyArchive = document.querySelector('#table-archive-general tbody');
    if (!tbodyActive || !tbodyArchive) return;
    
    tbodyActive.innerHTML = '';
    tbodyArchive.innerHTML = '';

    const groups = {};
    DB.exams.forEach(ex => {
        const key = `${ex.type}_${ex.name}_${ex.date}_${ex.time}_${ex.location}`;
        if (!groups[key]) {
            groups[key] = {
                id: ex.id,
                type: ex.type,
                name: ex.name,
                date: ex.date,
                time: ex.time,
                duration: ex.duration,
                lecturer: ex.lecturer || "-",
                capacity: ex.capacity || "-",
                location: ex.location || "-",
                proctors: []
            };
        }
        const pNames = (ex.proctorIds || [ex.proctorId]).map(pid => {
            const s = DB.staff.find(staff => staff.id === pid);
            return s ? s.name : '???';
        });
        groups[key].proctors.push(...pNames);
    });

    const scheduleList = Object.values(groups);
    const conflicts = getConflicts();
    const locConflicts = getLocationConflicts();
    const now = new Date();

    function getYear(name) {
        const match = name.match(/\b(1|2|3|4)\d{2}\b/);
        if (match) return parseInt(match[1]);
        if (name.includes("101") || name.includes("102") || name.includes("106") || name.includes("112") || name.includes("114")) return 1;
        return 0;
    }

    scheduleList.sort((a, b) => {
        const ya = getYear(a.name);
        const yb = getYear(b.name);
        if (ya !== yb) return ya - yb;
        return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
    });

    let currentYearActive = -1;
    let currentYearArchive = -1;

    scheduleList.forEach(ex => {
        const y = getYear(ex.name);
        const examDate = new Date(`${ex.date}T${ex.time}`);
        const examEnd = new Date(examDate.getTime() + ex.duration * 60000);
        const isPast = examEnd < now;

        const targetTbody = isPast ? tbodyArchive : tbodyActive;
        let currentYear = isPast ? currentYearArchive : currentYearActive;
        
        if (y > 0 && y !== currentYear) {
            if (isPast) currentYearArchive = y; else currentYearActive = y;
            const trHead = document.createElement('tr');
            trHead.className = 'year-header';
            trHead.innerHTML = `<td colspan="10">${y}. YIL</td>`;
            targetTbody.appendChild(trHead);
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

        const dateObj = new Date(ex.date.replace(/-/g, "/"));
        const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const dayName = dayNames[dateObj.getDay()];
        const formatString = ex.date.split("-").reverse().join(".") + " " + dayName; 

        tr.innerHTML = `
            <td><span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #a78bfa; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(139, 92, 246, 0.3);">${ex.type || 'Vize'}</span></td>
            <td>
                <span class="clickable-name" onclick="showExamDetail('${ex.name}', '${ex.date}', '${ex.time}', '${ex.location}')"><strong>${ex.name}</strong></span>
                ${isConflict ? '<span class="conflict-warning">⚠️ Gözetmen Çakışması!</span>' : ''}
            </td>
            <td>${ex.lecturer || '-'}</td>
            <td>${ex.capacity || '-'}</td>
            <td class="${isLocConflict ? 'location-conflict' : ''}">
                ${ex.location}
                ${isLocConflict ? '<span class="location-warning">⚠️ Derslik Çakışması!</span>' : ''}
            </td>
            <td>${formatString}</td>
            <td>${ex.time}</td>
            <td>${ex.duration} dk</td>
            <td class="proctor-list">${ex.proctors.join(', ')}</td>
            <td>
                 <button class="btn-secondary admin-only" onclick="showEditScheduleModal('${ex.name}', '${ex.date}', '${ex.time}', '${ex.location}')" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; border-color: var(--primary); color: var(--primary);">Düzenle</button>
            </td>
        `;
        targetTbody.appendChild(tr);
    });

    if (tbodyActive.children.length === 0) {
        tbodyActive.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--text-muted); padding:2rem;">Gelecek sınav programı bulunmuyor.</td></tr>';
    }
    if (tbodyArchive.children.length === 0) {
        tbodyArchive.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--text-muted); padding:2rem;">Arşivlenmiş sınav programı bulunmuyor.</td></tr>';
    }
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

    // tempEditProctors boşsa mevcut sınavın gözetmenlerini koru
    const currentExam = DB.exams.find(ex => String(ex.id) === String(id));
    const proctorIds = (window.tempEditProctors && window.tempEditProctors.length > 0)
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
        proctorIds: proctorIds
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
        await saveToBackend();
    };
};

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
 * Profil Sayfasını Yönet
 */
window.renderProfile = function() {
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

        // Gelen Takas Tekliflerini Göster
        const incomingSwaps = (DB.requests || []).filter(r => r.type === 'direct_swap' && r.status === 'pending_peer' && String(r.receiverId) === String(staff.id));
        const validSwaps = incomingSwaps.filter(r => {
            return DB.exams.some(e => String(e.id) === String(r.receiverExamId)) && 
                   DB.exams.some(e => String(e.id) === String(r.initiatorExamId));
        });

        const swapNotice = document.getElementById('profile-swap-proposals');
        if (swapNotice) {
            if (validSwaps.length > 0) {
                swapNotice.classList.remove('hidden');
                swapNotice.innerHTML = `
                    <div style="background: rgba(139, 92, 246, 0.15); border: 1px solid var(--primary); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
                        <h4 style="color: var(--primary); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.2rem;">🔄</span> Yeni Takas Teklifi
                        </h4>
                        ${validSwaps.map(r => {
                            const myExam = DB.exams.find(e => String(e.id) === String(r.receiverExamId));
                            const hisExam = DB.exams.find(e => String(e.id) === String(r.initiatorExamId));
                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05);">
                                    <div style="font-size: 0.9rem;">
                                        <strong>${r.initiatorName}</strong> hoca, 
                                        <span style="color: var(--accent-orange);">${hisExam ? hisExam.name : '???'}</span> sınavı ile 
                                        sizin <span style="color: var(--primary);">${myExam ? myExam.name : '???'}</span> sınavınızı takas etmek istiyor.
                                    </div>
                                    <div style="display: flex; gap: 10px;">
                                        <button class="btn-primary" onclick="acceptDirectSwap(${r.id})" style="background: var(--accent-green); padding: 0.4rem 0.8rem; font-size: 0.8rem;">Kabul Et</button>
                                        <button class="btn-delete" onclick="rejectDirectSwap(${r.id})" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Reddet</button>
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
        document.getElementById('profile-name').textContent = staff.name;
        document.getElementById('profile-stat-score').textContent = staff.totalScore;
        document.getElementById('profile-stat-tasks').textContent = staff.taskCount;
        
        const initials = staff.name.split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('profile-avatar').textContent = initials;

        // Görevleri listele
        const myExams = DB.exams.filter(e => String(e.proctorId) === String(myStaffId));
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
                    <td><strong>${ex.name}</strong></td>
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
                                return `<button class="btn-delete" onclick="cancelSwapRequest(${hasRequest.id})" title="Talebi İptal Et" style="padding: 0.3rem 0.6rem; border-radius: 6px;"><span class="icon" style="margin:0;">🚫</span></button>`;
                            }
                            return `
                                <button class="btn-secondary" onclick="initiateDirectSwap(${ex.id})" title="Hoca ile Takas Et" style="padding: 0.3rem 0.6rem; border-radius: 6px;"><span class="icon" style="margin:0;">🔄</span></button>
                                <button class="btn-primary" onclick="initiateOpenSwap(${ex.id})" title="Pazar Yerine Bırak" style="padding: 0.3rem 0.6rem; border-radius: 6px;"><span class="icon" style="margin:0;">📢</span></button>
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
                    <td>${ex.name}</td>
                    <td>${ex.location || '-'}</td>
                    <td>${ex.lecturer || '-'}</td>
                    <td>${ex.date}</td>
                    <td>${ex.time}</td>
                    <td><span class="score-tag" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">+${ex.score}</span></td>
                </tr>
            `;
        });

        // Takvim ve diğer verileri güncelle
        renderProfileConstraints();
        renderMarketplace();
        updateMarketplaceBadge();
        updateProfileMarketplaceAnnouncement();

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

/**
 * Profilde Şifre Ayarlama Bölümü
 */
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
function exportToPDF(tableId, title) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Yatay format
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(title, 14, 22);
    
    // Date
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`, 14, 30);

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
            fontSize: 8,
            cellPadding: 3,
            valign: 'middle'
        },
        headStyles: {
            fillColor: [99, 102, 241], // Primary color
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250]
        },
        didParseCell: function (data) {
            // Remove emojis or icons if they cause issues in PDF
            if (data.section === 'body' && typeof data.cell.text === 'string') {
                data.cell.text = data.cell.text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
            }
        }
    });

    const filename = `${title.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;
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
