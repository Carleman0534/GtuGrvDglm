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

    let deferredInstallPrompt = null;

    // --- PWA Kurulum Olayı (Android / Chrome / Edge) ---
    window.addEventListener('beforeinstallprompt', (e) => {
        // Tarayıcının varsayılan minik çubuğunu engelle
        e.preventDefault();
        deferredInstallPrompt = e;

        // Kurulum banner'ını veya butonunu göster
        const banner = document.getElementById('pwa-install-banner');
        if (banner && !sessionStorage.getItem('pwa_banner_dismissed')) {
            banner.classList.remove('hidden');
        }

        const installBtn = document.getElementById('btn-header-pwa-install');
        if (installBtn) installBtn.classList.remove('hidden');
    });

    // Kullanıcı Yükle Butonuna Bastığında
    window.triggerPwaInstall = async function () {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('Kullanıcı PWA kurulumunu kabul etti');
            }
            deferredInstallPrompt = null;
            dismissPwaBanner();
        } else if (isIosSafari()) {
            // iOS Safari için görsel rehberi aç
            const iosModal = document.getElementById('modal-ios-pwa-guide');
            if (iosModal) iosModal.classList.remove('hidden');
        } else {
            // Zaten kurulu veya doğrudan desteklenmiyor
            alert('Uygulama zaten yüklü veya tarayıcınızın menüsünden (⋮) "Uygulamayı Yükle / Ana Ekrana Ekle" seçeneğini kullanabilirsiniz.');
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
            showToast('🎉 Uygulama telefonunuza yüklendi! Ana ekranınızdan açabilirsiniz.', 'success');
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

    // --- Mobil Kart / Tablo Görünümü Yöneticisi ---
    window.toggleMobileExamViewMode = function () {
        const table = document.getElementById('table-exams');
        const btn = document.getElementById('btn-mobile-view-toggle');
        if (!table) return;

        const isCardMode = table.classList.toggle('mobile-card-mode');
        localStorage.setItem('gtu_exam_view_mode', isCardMode ? 'card' : 'table');

        if (btn) {
            btn.innerHTML = isCardMode ? '📋 Tablo Görünümü' : '📱 Kart Görünümü';
            btn.title = isCardMode ? 'Klasik geniş tabloya geç' : 'Mobil dokunmatik kartlara geç';
        }

        if (typeof showToast === 'function') {
            showToast(isCardMode ? '📱 Mobil Kart Görünümüne geçildi.' : '📋 Klasik Tablo Görünümüne geçildi.', 'info');
        }
    };

    function initMobileCardView() {
        const table = document.getElementById('table-exams');
        if (!table) return;

        const savedMode = localStorage.getItem('gtu_exam_view_mode');
        // Mobilde varsayılan kart modu olsun
        if (savedMode === 'table') {
            table.classList.remove('mobile-card-mode');
        } else {
            table.classList.add('mobile-card-mode');
        }

        // Toggle butonunu toolbar'a ekle (eğer yoksa)
        if (!document.getElementById('btn-mobile-view-toggle')) {
            const container = document.querySelector('#section-exams .section-header > div');
            if (container) {
                const btn = document.createElement('button');
                btn.id = 'btn-mobile-view-toggle';
                btn.type = 'button';
                btn.className = 'btn-secondary mobile-view-toggle-btn';
                const isCard = table.classList.contains('mobile-card-mode');
                btn.innerHTML = isCard ? '📋 Tablo' : '📱 Kart';
                btn.title = 'Görünüm Değiştir (Kart / Tablo)';
                btn.onclick = window.toggleMobileExamViewMode;
                container.insertBefore(btn, container.firstChild);
            }
        }
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
