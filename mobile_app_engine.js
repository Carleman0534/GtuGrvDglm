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

        // 2. iOS Safari ise Apple kuralları gereği görsel Safari rehberini aç
        if (isIosSafari()) {
            const iosModal = document.getElementById('modal-ios-pwa-guide');
            if (iosModal) iosModal.classList.remove('hidden');
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

    // iOS Safari Tespiti
    function isIosSafari() {
        const ua = window.navigator.userAgent;
        const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua);
        return isIos && isSafari;
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
            const btn = document.getElementById('btn-exams');
            if (btn) btn.click();
        } else if (tabKey === 'profile') {
            const btn = document.getElementById('btn-profile');
            if (btn) btn.click();
        } else if (tabKey === 'swap') {
            // Profil sekmesine git ve Takas pazarını göster
            const btn = document.getElementById('btn-profile');
            if (btn) btn.click();
            setTimeout(() => {
                const swapCard = document.getElementById('card-swap-market') || document.getElementById('profile-marketplace-announcement');
                if (swapCard) swapCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        if (isIosSafari() && !isRunningStandalone() && !sessionStorage.getItem('pwa_banner_dismissed')) {
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileEngine);
    } else {
        initMobileEngine();
    }

})();
