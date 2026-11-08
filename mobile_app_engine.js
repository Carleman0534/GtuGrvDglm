/**
 * 📱 GTÜ Gözetmenlik Sistemi - Mobil Uygulama & PWA Yönetim Motoru
 * 
 * Özellikler:
 * 1. PWA "Telefona Yükle" (Add to Home Screen) olayını yakalar ve şık bir kurulum banner'ı gösterir.
 * 2. iPhone (iOS Safari) kullanıcıları için görsel "Ana Ekrana Ekle" yönlendirmesi sunar.
 * 3. Cep telefonlarında başparmakla kolay kontrol sağlayan Mobil Alt Menü (Bottom Navigation) kontrolü.
 * 4. Masaüstü ve mobil sekmeleri çift yönlü senkronize eder.
 * 5. Mobil bildirim rozetlerini (unread badge) otomatik senkronize tutar.
 */

(function () {
    'use strict';

    // Global yakalanan eventi senkronize et
    window.deferredInstallPrompt = window.deferredInstallPrompt || null;

    // Head'deki erken yakalayıcıdan gelen eventi işle
    window.onBeforeInstallPromptReady = function (e) {
        window.deferredInstallPrompt = e;
        const banner = document.getElementById('pwa-install-banner');
        if (banner && !sessionStorage.getItem('pwa_banner_dismissed')) {
            banner.classList.remove('hidden');
        }
        const installBtn = document.getElementById('btn-header-pwa-install');
        if (installBtn) installBtn.classList.remove('hidden');
    };

    // Eğer sonradan tetiklenirse de yakala
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.deferredInstallPrompt = e;
        if (typeof window.onBeforeInstallPromptReady === 'function') {
            window.onBeforeInstallPromptReady(e);
        }
    });

    // Kullanıcı "Telefona Yükle" Butonuna Bastığında DOĞRUDAN YÜKLE
    window.triggerPwaInstall = async function () {
        console.log('[PWA] triggerPwaInstall tetiklendi. Hazır prompt:', !!window.deferredInstallPrompt);

        // 1. Zaten yüklü modda (PWA standalone) çalışıyorsa
        if (isRunningStandalone()) {
            if (typeof showToast === 'function') {
                showToast('✓ Uygulama zaten telefonunuzda yüklü! Ana ekranınızdan doğrudan açabilirsiniz.', 'info');
            } else {
                alert('✓ Uygulama zaten telefonunuzda yüklü! Ana ekranınızdan açabilirsiniz.');
            }
            return;
        }

        // 2. iPhone / iPad: Apple otomatik kurulum penceresine izin vermez, "Ana Ekrana Ekle" rehberini aç.
        // (Eskiden yalnızca Safari tanınıyordu; iPhone'da Chrome veya WhatsApp/Instagram içi tarayıcıdakiler
        // Android talimatlarını görüyordu.)
        if (isIosDevice()) {
            openIosInstallGuide();
            return;
        }

        // 3. Android / Chrome: Eğer prompt hazırsa DOĞRUDAN NATIVE YÜKLEME PENCERESİNİ AÇ
        let promptEvent = window.deferredInstallPrompt;

        if (!promptEvent) {
            // Eğer henüz event düşmediyse (kullanıcı sayfayı açar açmaz bastıysa) 1.5 saniye bekle
            const pwaText = document.getElementById('btn-login-pwa-text');
            const oldText = pwaText ? pwaText.textContent : '';
            if (pwaText) pwaText.textContent = '⏳ Kurulum Başlatılıyor...';

            const waitPromise = new Promise((resolve) => {
                const handler = (e) => {
                    e.preventDefault();
                    window.deferredInstallPrompt = e;
                    window.removeEventListener('beforeinstallprompt', handler);
                    resolve(e);
                };
                window.addEventListener('beforeinstallprompt', handler);
                setTimeout(() => resolve(window.deferredInstallPrompt), 1800);
            });

            promptEvent = await waitPromise;
            if (pwaText && oldText) pwaText.textContent = oldText;
        }

        if (promptEvent) {
            try {
                await promptEvent.prompt();
                const { outcome } = await promptEvent.userChoice;
                console.log('[PWA] Kullanıcı kurulum tercihi:', outcome);
                if (outcome === 'accepted') {
                    if (typeof showToast === 'function') {
                        showToast('🎉 Harika! Uygulama telefonunuza yükleniyor...', 'success');
                    }
                }
                window.deferredInstallPrompt = null;
                dismissPwaBanner();
                return;
            } catch (err) {
                console.warn('[PWA] prompt() çağrısı sırasında hata:', err);
            }
        }

        // 4. Tarayıcı prompt vermediyse (örneğin engellenmiş veya doğrudan desteklenmeyen tarayıcı):
        const generalModal = document.getElementById('modal-pwa-general-guide');
        if (generalModal) {
            generalModal.classList.remove('hidden');
        } else {
            alert('Tarayıcınızın sağ üst köşesindeki menüden (⋮) "Uygulamayı Yükle / Ana Ekrana Ekle" seçeneğine dokunarak yükleyebilirsiniz.');
        }
    };

    window.dismissPwaBanner = function () {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.classList.add('hidden');
        sessionStorage.setItem('pwa_banner_dismissed', '1');
    };

    // Uygulama Kurulduğunda
    window.addEventListener('appinstalled', () => {
        console.log('GTÜ Gözetmenlik PWA başarıyla kuruldu.');
        dismissPwaBanner();
        if (typeof showToast === 'function') {
            showToast('🎉 Uygulama telefonunuza yüklendi! Bildirimleri açmayı unutmayın.', 'success');
        }
        if ('Notification' in window && Notification.permission === 'default') {
            setTimeout(() => {
                const pBanner = document.getElementById('proactive-notif-banner');
                if (pBanner) pBanner.classList.remove('hidden');
            }, 1000);
        }
    });

    // iPhone / iPad tespiti (iPadOS 13+ kendini Mac olarak tanıtır; dokunmatik ekrandan ayırt edilir)
    function isIosDevice() {
        const ua = window.navigator.userAgent;
        return (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) ||
            (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    }

    // iOS Safari Tespiti
    function isIosSafari() {
        const ua = window.navigator.userAgent;
        const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|FBAN|FBAV|Instagram|WhatsApp|GSA\//.test(ua);
        return isIosDevice() && isSafari;
    }

    // Tarayıcıya göre doğru talimatı göster
    function openIosInstallGuide() {
        const iosModal = document.getElementById('modal-ios-pwa-guide');
        if (!iosModal) {
            alert('Safari\'de alttaki Paylaş simgesine dokunup "Ana Ekrana Ekle"yi seçin.');
            return;
        }
        const ua = window.navigator.userAgent;
        const note = document.getElementById('ios-pwa-browser-note');
        if (note) {
            let text = '';
            if (/FBAN|FBAV|Instagram|WhatsApp|GSA\/|Line\//.test(ua)) {
                text = 'Siteyi bir uygulamanın içinden açtınız. Önce sağ üstteki menüden (⋯) <b>"Safari\'de Aç"</b> seçeneğine dokunun, sonra aşağıdaki adımları uygulayın.';
            } else if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) {
                text = 'Chrome / Firefox / Edge kullanıyorsunuz: Paylaş simgesi adres çubuğunun yanındadır. Menüde "Ana Ekrana Ekle" yoksa siteyi <b>Safari</b> ile açın.';
            }
            note.innerHTML = text;
            note.style.display = text ? 'block' : 'none';
        }
        iosModal.classList.remove('hidden');
    }

    // Bağımsız (Standalone) modda mı çalışıyor? (Yüklü PWA)
    function isRunningStandalone() {
        return (window.matchMedia('(display-mode: standalone)').matches) || (window.navigator.standalone === true);
    }

    // --- Mobil Alt Menü Sekme Değiştirici ---
    window.switchMobileTab = function (tabKey) {
        // Alt menü butonlarının aktifliğini güncelle
        const items = document.querySelectorAll('#mobile-bottom-nav .mobile-nav-item');
        items.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabKey) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Masaüstü sekmelerini tetikleyerek içerik bölümünü değiştir
        if (tabKey === 'dashboard') {
            const btn = document.getElementById('btn-dashboard');
            if (btn) btn.click();
        } else if (tabKey === 'exams') {
            if (sessionStorage.getItem('isAdmin') === 'true') {
                const btn = document.getElementById('btn-exams');
                if (btn) btn.click();
            } else {
                // Gözetmen için "Görevlerim": tüm sınav listesi ve yönetici düğmeleri yerine kendi aktif görevleri
                const btn = document.getElementById('btn-profile');
                if (btn) btn.click();
                setTimeout(() => {
                    if (typeof window.switchProfileTab === 'function') window.switchProfileTab('active');
                    const pane = document.getElementById('tab-active') || document.getElementById('profile-table-active');
                    if (pane) pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 150);
            }
        } else if (tabKey === 'profile') {
            const btn = document.getElementById('btn-profile');
            if (btn) btn.click();
        } else if (tabKey === 'swap') {
            // Profil sekmesine git ve Takas / Pazar Yeri görünümünü aç
            const btn = document.getElementById('btn-profile');
            if (btn) btn.click();
            setTimeout(() => {
                if (typeof window.switchProfileTab === 'function') {
                    window.switchProfileTab('marketplace');
                }
                const pane = document.getElementById('tab-marketplace');
                if (pane) pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } else if (tabKey === 'notifs') {
            // Bildirim Ayarları & Bildirimler Penceresini Aç
            if (typeof openNotificationSettingsModal === 'function') {
                openNotificationSettingsModal();
            } else {
                const btn = document.getElementById('btn-profile');
                if (btn) btn.click();
            }
        }
    };

    // Masaüstü sekmesi değiştiğinde mobil alt menüyü senkronize et
    function syncMobileNavWithDesktop() {
        const map = {
            'btn-dashboard': 'dashboard',
            'btn-exams': 'exams',
            'btn-profile': 'profile',
            'btn-schedule': 'exams'
        };

        document.querySelectorAll('.main-nav-tabs button').forEach(btn => {
            btn.addEventListener('click', () => {
                const mobileKey = map[btn.id];
                if (mobileKey) {
                    document.querySelectorAll('#mobile-bottom-nav .mobile-nav-item').forEach(mBtn => {
                        if (mBtn.getAttribute('data-tab') === mobileKey) {
                            mBtn.classList.add('active');
                        } else {
                            mBtn.classList.remove('active');
                        }
                    });
                }
            });
        });
    }

    // Mobil Rozet Senkronizasyonu
    function syncMobileBadges() {
        // Alt menü: gözetmen için "Sınavlar" yerine "Görevlerim"
        const examsNav = document.querySelector('.mobile-nav-item[data-tab="exams"]');
        if (examsNav) {
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            const label = examsNav.querySelector('.mobile-nav-label');
            const icon = examsNav.querySelector('.mobile-nav-icon');
            if (label) label.textContent = isAdmin ? 'Sınavlar' : 'Görevlerim';
            if (icon) icon.textContent = isAdmin ? '📝' : '📋';
        }

        const profileBadge = document.getElementById('notif-badge-profile');
        const mobileBadge = document.getElementById('mobile-notif-badge');
        if (profileBadge && mobileBadge) {
            const count = profileBadge.textContent || '0';
            mobileBadge.textContent = count;
            if (profileBadge.classList.contains('hidden') || count === '0') {
                mobileBadge.classList.add('hidden');
            } else {
                mobileBadge.classList.remove('hidden');
            }
        }
    }

    // --- 🗂️ / 📋 Kart ve Tablo Görünümü Yöneticisi (Masaüstü ve Mobil Tam Uyumlu) ---
    window.toggleMobileExamViewMode = function () {
        const isMobile = window.innerWidth <= 768;
        const currentMode = localStorage.getItem('gtu_exam_view_mode') || (isMobile ? 'card' : 'table');
        const newMode = (currentMode === 'table') ? 'card' : 'table';
        localStorage.setItem('gtu_exam_view_mode', newMode);

        window.applyExamViewMode(newMode);

        if (typeof showToast === 'function') {
            showToast(newMode === 'table' ? '📋 Klasik Tablo Görünümüne geçildi.' : '🗂️ Kart Görünümüne geçildi.', 'info');
        }
    };

    window.applyExamViewMode = function (mode) {
        if (!mode) {
            const isMobile = window.innerWidth <= 768;
            const saved = localStorage.getItem('gtu_exam_view_mode');
            mode = saved || (isMobile ? 'card' : 'table');
        }

        const tables = [
            document.getElementById('table-exams'),
            document.getElementById('profile-table-active'),
            document.getElementById('profile-table-marketplace'),
            document.getElementById('profile-table-archive')
        ];

        tables.forEach(t => {
            if (!t) return;
            if (mode === 'card') {
                t.classList.add('exam-card-mode');
                t.classList.add('mobile-card-mode');
            } else {
                t.classList.remove('exam-card-mode');
                t.classList.remove('mobile-card-mode');
            }
        });

        // Butonların metinlerini güncelle
        const toggleButtons = document.querySelectorAll('.mobile-view-toggle-btn');
        toggleButtons.forEach(btn => {
            if (mode === 'table') {
                btn.innerHTML = '🗂️ Kart Görünümü';
                btn.title = 'Kart görünümüne geç';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            } else {
                btn.innerHTML = '📋 Tablo Görünümü';
                btn.title = 'Klasik tablo görünümüne geç';
                btn.style.borderColor = 'rgba(56, 189, 248, 0.6)';
            }
        });
    };

    function initMobileCardView() {
        const isMobile = window.innerWidth <= 768;
        const savedMode = localStorage.getItem('gtu_exam_view_mode');
        // Bilgisayarda varsayılan kesinlikle 'table', mobilde 'card'
        const initialMode = savedMode || (isMobile ? 'card' : 'table');

        // Toggle butonunu Sınavlar sekmesi toolbar'ına ekle (eğer yoksa)
        if (!document.getElementById('btn-mobile-view-toggle')) {
            const container = document.querySelector('#section-exams .section-header > div');
            if (container) {
                const btn = document.createElement('button');
                btn.id = 'btn-mobile-view-toggle';
                btn.type = 'button';
                btn.className = 'btn-secondary mobile-view-toggle-btn';
                btn.style.whiteSpace = 'nowrap';
                btn.style.display = 'inline-flex';
                btn.style.alignItems = 'center';
                btn.style.gap = '6px';
                btn.onclick = window.toggleMobileExamViewMode;
                container.insertBefore(btn, container.firstChild);
            }
        }

        // Profil sekmesine de görünüm değiştirici buton ekle (eğer yoksa)
        const profileActions = document.querySelector('.profile-hero-actions');
        if (profileActions && !document.getElementById('btn-profile-view-toggle')) {
            const pBtn = document.createElement('button');
            pBtn.id = 'btn-profile-view-toggle';
            pBtn.type = 'button';
            pBtn.className = 'btn-secondary mobile-view-toggle-btn';
            pBtn.style.whiteSpace = 'nowrap';
            pBtn.style.display = 'inline-flex';
            pBtn.style.alignItems = 'center';
            pBtn.style.gap = '6px';
            pBtn.onclick = window.toggleMobileExamViewMode;
            profileActions.appendChild(pBtn);
        }

        window.applyExamViewMode(initialMode);
    }

    // Başlatıcı
    function initMobileEngine() {
        initMobileCardView();
        syncMobileNavWithDesktop();

        // Rozetleri periyodik senkronize et
        setInterval(syncMobileBadges, 2000);

        // iOS Safari ise ve henüz standalone kurulmamışsa banner'ı hazırla
        if (isIosDevice() && !isRunningStandalone() && !sessionStorage.getItem('pwa_banner_dismissed')) {
            const banner = document.getElementById('pwa-install-banner');
            if (banner) {
                const textSpan = banner.querySelector('.pwa-install-text span');
                if (textSpan) textSpan.textContent = "iPhone'a ekleyin, tam ekran uygulama olarak kullanın";
                banner.classList.remove('hidden');
            }
        }

        // Standalone çalışıyorsa kurulum butonlarını gizle
        if (isRunningStandalone()) {
            const banner = document.getElementById('pwa-install-banner');
            if (banner) banner.classList.add('hidden');
            const installBtn = document.getElementById('btn-header-pwa-install');
            if (installBtn) installBtn.classList.add('hidden');
        }
    }

    // --- Profil: "Sıradaki Görevim" kartı ve kapatılabilir bilgi kutuları ---
    const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function examStartMs(ex) {
        const d = (typeof getSafeDate === 'function') ? getSafeDate(ex.date, ex.time) : new Date(`${ex.date}T${ex.time}`);
        return d.getTime();
    }

    function countdownText(startMs, endMs) {
        const now = Date.now();
        if (now >= startMs && now < endMs) return '🟢 Şu an devam ediyor';
        const mins = Math.max(0, Math.round((startMs - now) / 60000));
        if (mins < 60) return `⏳ ${mins} dakika sonra`;
        const hours = Math.floor(mins / 60), rest = mins % 60;
        if (hours < 24) return `⏳ ${hours} saat${rest ? ' ' + rest + ' dk' : ''} sonra`;
        const days = Math.floor(hours / 24), h = hours % 24;
        return `⏳ ${days} gün${h ? ' ' + h + ' saat' : ''} sonra`;
    }

    // Profilin en üstünde, kimlik kartının hemen altında bir sonraki görev; telefonda aktif görevlere
    // ulaşmak için birkaç ekran kaydırmak gerekiyordu
    function renderNextDutyCard() {
        const hero = document.querySelector('#profile-main-content .profile-hero');
        const staffId = localStorage.getItem('myStaffId');
        let card = document.getElementById('profile-next-duty-card');
        if (!hero || !staffId || !window.DB || !Array.isArray(DB.exams)) { if (card) card.remove(); return; }

        const isMine = (typeof isStaffProctorById === 'function')
            ? (e) => isStaffProctorById(e, staffId)
            : (e) => (e.proctorIds || [e.proctorId]).map(String).includes(String(staffId));
        const now = Date.now();
        const next = DB.exams
            .filter(e => e && e.date && e.time && isMine(e))
            .map(e => ({ e, start: examStartMs(e), end: examStartMs(e) + (parseInt(e.duration, 10) || 60) * 60000 }))
            .filter(x => !isNaN(x.start) && x.end > now)
            .sort((a, b) => a.start - b.start)[0];

        if (!card) {
            card = document.createElement('div');
            card.id = 'profile-next-duty-card';
            card.className = 'next-duty-card';
            hero.insertAdjacentElement('afterend', card);
        }

        if (!next) {
            card.innerHTML = `<div class="next-duty-empty">📭 Yaklaşan gözetmenlik göreviniz yok.</div>`;
            return;
        }

        const ex = next.e;
        const id = escapeHtml(ex.id);
        const ongoing = now >= next.start;
        const dayName = new Date(next.start).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
        const others = DB.exams.filter(e => e && isMine(e) && examStartMs(e) + (parseInt(e.duration, 10) || 60) * 60000 > now).length - 1;
        card.innerHTML = `
            <div class="next-duty-head">
                <span class="next-duty-label">Sıradaki Görevim</span>
                <span class="next-duty-countdown" data-start="${next.start}" data-end="${next.end}">${countdownText(next.start, next.end)}</span>
            </div>
            <div class="next-duty-title">${escapeHtml(ex.name)}</div>
            <div class="next-duty-meta">
                <span>📅 ${escapeHtml(dayName)}</span>
                <span>⏰ ${escapeHtml(ex.time)}</span>
                <span>⏱️ ${parseInt(ex.duration, 10) || 60} dk</span>
                <span>📍 ${escapeHtml(ex.location || '-')}</span>
            </div>
            <div class="next-duty-actions">
                <button type="button" onclick="openUpdateDurationModal('${id}')">⏱️ Saat / Süre</button>
                <button type="button" onclick="exportSingleExamToICal('${id}')">📅 Takvime ekle</button>
                ${ongoing ? '' : `<button type="button" onclick="initiateOpenSwap('${id}')">🛒 Yerime biri lazım</button>`}
            </div>
            ${others > 0 ? `<button type="button" class="next-duty-all" onclick="exportMyExamsToICal()">📅 Yaklaşan ${others + 1} görevimin hepsini takvime ekle</button>` : ''}`;
    }

    // Geri sayımı dakikada bir tazele
    setInterval(() => {
        const el = document.querySelector('#profile-next-duty-card .next-duty-countdown');
        if (el) el.textContent = countdownText(parseInt(el.dataset.start, 10), parseInt(el.dataset.end, 10));
    }, 60000);

    // Şifre bilgilendirmesi bir kez kapatılınca o cihazda bir daha çıkmaz
    function applyDismissedInfoBoxes() {
        const pwd = document.getElementById('profile-password-announcement-banner');
        if (!pwd) return;
        if (localStorage.getItem('pwd_banner_dismissed') === '1') { pwd.style.display = 'none'; return; }
        if (!pwd.querySelector('.info-box-close')) {
            const x = document.createElement('button');
            x.type = 'button';
            x.className = 'info-box-close';
            x.setAttribute('aria-label', 'Kapat');
            x.textContent = '✕';
            x.onclick = () => { localStorage.setItem('pwd_banner_dismissed', '1'); pwd.style.display = 'none'; };
            pwd.style.position = 'relative';
            pwd.appendChild(x);
        }
    }

    // Başlıktaki etiketsiz simgeler için kısa etiketler (mobilde simgenin altında görünür)
    function labelHeaderIcons() {
        const labels = { 'btn-header-admin-broadcast': 'Duyuru', 'btn-header-bulk-email': 'Kısıt', 'btn-header-pwa-install': 'Yükle', 'btn-theme-toggle': 'Tema', 'btn-logout': 'Çıkış', 'btn-notifications': 'Bildirim' };
        Object.entries(labels).forEach(([id, text]) => {
            const b = document.getElementById(id);
            if (b && !b.dataset.label) b.dataset.label = text;
        });
    }

    // --- Küçültülebilir profil panelleri ---
    // Her panelin başlığına −/+ düğmesi; küçültülen panelde yalnızca başlık kalır.
    // Tercih cihazda saklanır (localStorage), sayfa yenilense de öyle kalır.
    const COLLAPSIBLE_PANELS = [
        { key: 'next_duty', selector: '#profile-next-duty-card', header: '.next-duty-head' },
        { key: 'final_forecast', selector: '#profile-final-forecast-card', header: ':scope > .forecast-card-head' },
        { key: 'smart_swaps', selector: '#profile-smart-swaps', header: ':scope > div:first-child' },
        { key: 'kpi', selector: '#profile-main-content .profile-bento-kpi-grid', label: '📊 Puan ve Görev Özeti' },
        { key: 'task_hub', selector: '#profile-main-content .profile-main-column', label: '📋 Görevlerim, Takvim ve Puan Karnesi' },
        { key: 'password', find: () => document.querySelector('#profile-password-section > div'), header: ':scope > div:first-child' },
        { key: 'calendar', selector: '.sidebar-widget.personal-calendar-card', header: ':scope > .sidebar-widget-header' },
        { key: 'checklist', find: () => { const c = document.getElementById('profile-checklist-container'); return c && c.closest('.sidebar-widget'); }, header: ':scope > .sidebar-widget-header' },
        { key: 'journal', selector: '#profile-joke-section', header: ':scope > .sidebar-widget-header' }
    ];

    const isPanelCollapsed = (key) => localStorage.getItem('panel_collapsed_' + key) === '1';

    function setPanelState(panel, btn, key, collapsed) {
        panel.classList.toggle('panel-collapsed', collapsed);
        btn.textContent = collapsed ? '+' : '−';
        btn.title = collapsed ? 'Paneli aç' : 'Paneli küçült';
        btn.setAttribute('aria-expanded', String(!collapsed));
    }

    function applyCollapsiblePanels() {
        COLLAPSIBLE_PANELS.forEach(cfg => {
            let panel = null;
            try { panel = cfg.find ? cfg.find() : document.querySelector(cfg.selector); } catch (e) {}
            if (!panel) return;

            let header = null;
            if (cfg.header) {
                try { header = panel.querySelector(cfg.header); } catch (e) {}
            } else {
                // Başlığı olmayan panel (ör. puan kutuları): ince bir başlık satırı eklenir
                header = panel.querySelector(':scope > .panel-collapse-header');
                if (!header) {
                    header = document.createElement('div');
                    header.className = 'panel-collapse-header';
                    header.innerHTML = `<span class="panel-collapse-title">${cfg.label}</span>`;
                    panel.insertBefore(header, panel.firstChild);
                }
            }
            if (!header) return;
            header.classList.add('panel-collapse-keep');

            let btn = header.querySelector(':scope > .panel-collapse-btn');
            if (!btn) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'panel-collapse-btn';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const collapsed = !panel.classList.contains('panel-collapsed');
                    localStorage.setItem('panel_collapsed_' + cfg.key, collapsed ? '1' : '0');
                    setPanelState(panel, btn, cfg.key, collapsed);
                });
                header.appendChild(btn);
            }
            setPanelState(panel, btn, cfg.key, isPanelCollapsed(cfg.key));
        });
    }

    // Kendi içeriğini yeniden çizen paneller (ör. tahmin kartı) düğmeyi yeniden bağlayabilsin
    window.applyProfileCollapsiblePanels = applyCollapsiblePanels;

    function hookProfileRender() {
        if (typeof window.renderProfile !== 'function' || window.renderProfile.__nextDutyHooked) return;
        const original = window.renderProfile;
        const wrapped = function () {
            try { return original.apply(this, arguments); }
            finally {
                try { renderNextDutyCard(); applyDismissedInfoBoxes(); applyCollapsiblePanels(); } catch (e) { console.warn('profile panels:', e); }
            }
        };
        wrapped.__nextDutyHooked = true;
        window.renderProfile = wrapped;
    }

    function initProfileComfort() {
        hookProfileRender();
        labelHeaderIcons();
        applyDismissedInfoBoxes();
        try { renderNextDutyCard(); } catch (e) {}
        try { applyCollapsiblePanels(); } catch (e) {}
    }

    // --- Yeni Sürüm Uyarısı ---
    // GitHub Pages her yayında tüm dosyaların Last-Modified değerini yeniler. Açılıştaki değer
    // saklanır; 5 dakikada bir ve uygulamaya geri dönüldüğünde karşılaştırılır. Değiştiyse
    // (telefona kurulu uygulama günlerce açık kalabildiği için) "Yeni sürüm var" uyarısı çıkar.
    let loadedVersion = null;
    let lastVersionCheck = 0;

    async function fetchDeployedVersion() {
        const res = await fetch('./index.html?surum=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
        if (!res.ok) return null;
        return res.headers.get('Last-Modified') || res.headers.get('ETag');
    }

    async function checkForNewVersion() {
        if (!navigator.onLine || Date.now() - lastVersionCheck < 60000) return;
        lastVersionCheck = Date.now();
        try {
            const v = await fetchDeployedVersion();
            if (!v) return;
            if (!loadedVersion) loadedVersion = v;
            else if (v !== loadedVersion) window.showUpdateBanner();
        } catch (e) { /* çevrimdışı vb. */ }
    }

    window.showUpdateBanner = function () {
        if (document.getElementById('app-update-banner')) return;
        const bar = document.createElement('div');
        bar.id = 'app-update-banner';
        bar.setAttribute('role', 'status');
        bar.style.cssText = 'position:fixed; left:50%; transform:translateX(-50%); top:calc(10px + env(safe-area-inset-top, 0px)); z-index:10100;' +
            'display:flex; align-items:center; gap:10px; max-width:calc(100vw - 20px); padding:10px 12px 10px 14px;' +
            'background:#0f172a; color:#f8fafc; border:1px solid rgba(56,189,248,0.5); border-radius:12px;' +
            'box-shadow:0 10px 30px rgba(0,0,0,0.45); font-size:0.88rem;';
        bar.innerHTML = '<span>🔄 Sitenin yeni sürümü yayınlandı.</span>' +
            '<button type="button" id="app-update-reload" style="background:#0284c7; color:#fff; border:none; border-radius:8px; padding:6px 12px; font-weight:700; cursor:pointer;">Yenile</button>' +
            '<button type="button" id="app-update-later" aria-label="Kapat" style="background:none; border:none; color:#94a3b8; font-size:1.1rem; cursor:pointer;">✕</button>';
        document.body.appendChild(bar);
        document.getElementById('app-update-reload').onclick = () => window.location.reload();
        document.getElementById('app-update-later').onclick = () => bar.remove();
    };

    function initVersionCheck() {
        checkForNewVersion();
        setInterval(checkForNewVersion, 5 * 60 * 1000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForNewVersion(); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileEngine);
        document.addEventListener('DOMContentLoaded', initVersionCheck);
        document.addEventListener('DOMContentLoaded', initProfileComfort);
    } else {
        initMobileEngine();
        initVersionCheck();
        initProfileComfort();
    }

})();
