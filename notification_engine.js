/**
 * 🔔 GTÜ Gözetmenlik Sistemi - Kademeli Bildirim Motoru (24s, 18s, 12s, 6s, 3s)
 * 
 * Özellikler:
 * 1. Sınav saatine göre 5 kritik eşikte (24s, 18s, 12s, 6s, 3s önce) otomatik bildirim üretir.
 * 2. Web Notifications API ve Service Worker entegrasyonu ile telefon kilit ekranında gösterir.
 * 3. Her bildirim eşiği için tekil hafıza (deduplication) tutarak mükerrer bildirimleri önler.
 * 4. Sistem içi bildirim kutusunu (DB.notifications) ve okunmamış rozetini günceller.
 * 5. Kullanıcıya bildirim tercihlerini açma/kapama ve anlık test bildirimi gönderme imkanı sunar.
 */

(function () {
    'use strict';

    // 5 Kademeli Bildirim Eşikleri (Saat Cinsinden)
    const MILESTONES = [
        { hours: 24, label: '24 Saat Önce', icon: '🔔', tagPrefix: '24h' },
        { hours: 18, label: '18 Saat Önce', icon: '🔔', tagPrefix: '18h' },
        { hours: 12, label: '12 Saat Önce', icon: '🔔', tagPrefix: '12h' },
        { hours: 6,  label: '6 Saat Önce',  icon: '⏰', tagPrefix: '6h' },
        { hours: 3,  label: '3 Saat Önce (Son Hatırlatma)', icon: '🚨', tagPrefix: '3h' }
    ];

    // Bildirim İzni Durumu
    function getPermissionState() {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    }

    // Bildirim İzni Talep Et
    window.requestExamNotificationPermission = async function () {
        if (!('Notification' in window)) {
            alert('Tarayıcınız veya cihazınız Web Bildirimlerini desteklemiyor.');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            updateNotificationPermissionUI();

            if (permission === 'granted') {
                if (typeof showToast === 'function') {
                    showToast('🔔 Bildirim izinleri başarıyla aktifleştirildi! Sınavlardan 24s, 18s, 12s, 6s ve 3s önce uyarı alacaksınız.', 'success');
                }
                // Başarı bildirimi gönder
                window.dispatchLocalNotification(
                    '🔔 GTÜ Gözetmenlik Bildirimleri Aktif!',
                    'Sınav görevlerinizden 24, 18, 12, 6 ve 3 saat önce telefonunuza otomatik hatırlatma iletilecektir.',
                    'perm_granted'
                );
                // Hemen kontrol çalıştır
                checkAllExamNotifications();
                return true;
            } else if (permission === 'denied') {
                alert('Bildirim izni reddedildi. Telefon ayarlarından tarayıcınız için bildirimlere izin vermeniz gerekebilir.');
                return false;
            }
        } catch (err) {
            console.error('Bildirim izni hatası:', err);
        }
        return false;
    };

    // Bildirim Gönder (Cihaz / PWA Düzeyinde)
    window.dispatchLocalNotification = function (title, body, tag = 'general', extraData = {}) {
        // Titreşim deseni (200ms titre, 100ms dur, 200ms titre)
        if ('vibrate' in navigator) {
            try { navigator.vibrate([200, 100, 200]); } catch (e) {}
        }

        // 1. Service Worker ile Bildirim Gönder (PWA arka plandayken de çalışır)
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, {
                    body: body,
                    icon: './icon-192.png',
                    badge: './icon-192.png',
                    vibrate: [200, 100, 200],
                    tag: `gtu_exam_${tag}`,
                    renotify: true,
                    requireInteraction: (tag.includes('3h') || tag.includes('6h')), // Son saatlerde ekranda kalsın
                    data: Object.assign({ url: './index.html' }, extraData)
                });
            }).catch(err => {
                console.warn('SW bildirim hatası, normal bildirime dönülüyor:', err);
                fallbackNotification(title, body, tag);
            });
        } else {
            fallbackNotification(title, body, tag);
        }
    };

    function fallbackNotification(title, body, tag) {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body: body,
                    icon: './icon-192.png',
                    tag: `gtu_exam_${tag}`
                });
            } catch (e) {
                console.warn('Fallback bildirim hatası:', e);
            }
        }
    }

    // Kullanıcının Bildirim Tercihi Açık mı? (Varsayılan: true)
    function isMilestoneEnabled(hours) {
        const val = localStorage.getItem(`gtu_pref_notif_${hours}h`);
        return val === null ? true : (val === '1' || val === 'true');
    }

    window.toggleMilestonePref = function (hours, isEnabled) {
        localStorage.setItem(`gtu_pref_notif_${hours}h`, isEnabled ? '1' : '0');
        if (typeof showToast === 'function') {
            showToast(`${hours} saat öncesi bildirimler ${isEnabled ? 'açıldı' : 'kapatıldı'}.`, 'info');
        }
    };

    // --- Sınav Bildirimlerini Denetleyen Ana Döngü ---
    function checkAllExamNotifications() {
        if (!window.DB || !DB.exams || !Array.isArray(DB.exams)) return;

        const myStaffId = localStorage.getItem('myStaffId');
        const now = new Date();

        // Asistanın veya yöneticinin sınavlarını belirle
        const targetExams = DB.exams.filter(ex => {
            if (!ex.date || !ex.time) return false;
            if (myStaffId) {
                if (typeof isStaffProctorById === 'function') {
                    return isStaffProctorById(ex, myStaffId);
                }
                const ids = (ex.proctorIds || [ex.proctorId]).map(String);
                return ids.includes(String(myStaffId));
            }
            // Kimlik seçilmemişse bile genel sınavları denetle
            return true;
        });

        targetExams.forEach(ex => {
            // Sınavın tam başlama tarihi
            const examDateTimeStr = `${ex.date}T${ex.time.length === 5 ? ex.time : ex.time.padStart(5, '0')}:00`;
            const examDate = new Date(examDateTimeStr);
            if (isNaN(examDate.getTime())) return;

            // Kalan saat (ondalıklı)
            const diffMs = examDate.getTime() - now.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            // Sınav geçmişte kaldıysa atla
            if (diffHours < 0) return;

            MILESTONES.forEach(m => {
                // Bu eşik kullanıcı tarafından kapatılmış mı?
                if (!isMilestoneEnabled(m.hours)) return;

                // Eşik penceresi: Örneğin 24 saat eşiği için diffHours <= 24 && diffHours >= 22.5
                // Veya bildirim hiç atılmamış ve kalan süre o eşikten az ise (kaçırılmış bildirim yakalama)
                const storageKey = `gtu_notif_fired_${ex.id}_${m.hours}h`;
                const alreadySent = localStorage.getItem(storageKey);

                if (!alreadySent && diffHours <= m.hours && diffHours > (m.hours - 2.5)) {
                    // Bildirimi işaretle (asla mükerrer gitmez)
                    localStorage.setItem(storageKey, new Date().toISOString());

                    // Mesaj Metni Oluştur
                    let title = '';
                    let message = '';
                    const loc = ex.location ? `Salon: ${ex.location}` : 'Derslik henüz belirtilmedi';
                    const dur = ex.duration ? `(${ex.duration} dk)` : '';

                    if (m.hours === 24) {
                        title = `🔔 [Yarın Sınav Göreviniz Var] ${ex.name}`;
                        message = `Yarın saat ${ex.time}'da ${ex.name} sınavı gözetmenliğiniz var. ${loc} ${dur}.`;
                    } else if (m.hours === 18) {
                        title = `🔔 [18 Saat Kaldı] ${ex.name} Görevi`;
                        message = `${ex.name} sınavına 18 saat kaldı. Başlama: ${ex.time}, ${loc}.`;
                    } else if (m.hours === 12) {
                        title = `🔔 [12 Saat Kaldı] ${ex.name} Görevi`;
                        message = `Göreviniz yaklaşıyor. Saat ${ex.time}'da ${loc} salonunda olunuz.`;
                    } else if (m.hours === 6) {
                        title = `⏰ [6 Saat Kaldı] ${ex.name}`;
                        message = `Sınava 6 saat kaldı! Başlama: ${ex.time}, ${loc}.`;
                    } else if (m.hours === 3) {
                        title = `🚨 [Son 3 Saat!] ${ex.name} Başlıyor`;
                        message = `Saat ${ex.time}'da başlayacak ${ex.name} sınavı için lütfen hazırlığınızı yapıp salona geçiniz. ${loc}.`;
                    }

                    // 1. Cihaz / Push Bildirimi Gönder
                    if (getPermissionState() === 'granted') {
                        window.dispatchLocalNotification(title, message, `${ex.id}_${m.tagPrefix}`, { examId: ex.id });
                    }

                    // 2. Uygulama İçi Bildirim Kutusu (DB.notifications)
                    if (myStaffId && window.DB) {
                        if (!DB.notifications) DB.notifications = {};
                        if (!Array.isArray(DB.notifications[myStaffId])) DB.notifications[myStaffId] = [];

                        DB.notifications[myStaffId].unshift({
                            id: Date.now(),
                            title: title,
                            message: message,
                            date: new Date().toISOString(),
                            isRead: false,
                            type: 'exam_reminder',
                            examId: ex.id,
                            hoursBefore: m.hours
                        });

                        // Rozeti güncelle
                        if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
                        if (typeof renderNotifications === 'function') renderNotifications();
                        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
                    }

                    // 3. Ekranda açıksa Toast Bildirimi
                    if (typeof showToast === 'function') {
                        showToast(`${m.icon} ${title}: ${message}`, m.hours <= 6 ? 'warning' : 'info');
                    }
                }
            });
        });
    }

    // Anlık Test Bildirimi
    window.testExamNotification = function () {
        const state = getPermissionState();
        if (state !== 'granted') {
            window.requestExamNotificationPermission();
            return;
        }

        window.dispatchLocalNotification(
            '🚨 [Test Bildirimi] 3 Saat Kaldı: MAT 101 Sınavı',
            'Sınavınız saat 10:00\'da Amfi 1 salonunda başlayacaktır. Kademeli bildirim sistemi sorunsuz çalışıyor!',
            'test_3h'
        );

        if (typeof showToast === 'function') {
            showToast('✅ Test bildirimi telefonunuza gönderildi! Kilit ekranınızı kontrol edebilirsiniz.', 'success');
        }
    };

    // Bildirim İzin Durumunu UI'da Güncelle
    function updateNotificationPermissionUI() {
        const btn = document.getElementById('btn-enable-notifications');
        const statusText = document.getElementById('notif-perm-status-text');
        const state = getPermissionState();

        if (btn) {
            if (state === 'granted') {
                btn.textContent = '✓ Bildirimler Aktif';
                btn.style.background = 'rgba(16, 185, 129, 0.2)';
                btn.style.borderColor = '#34d399';
                btn.style.color = '#34d399';
            } else if (state === 'denied') {
                btn.textContent = '❌ Bildirimler Engelli';
                btn.style.background = 'rgba(239, 68, 68, 0.2)';
                btn.style.borderColor = '#f87171';
                btn.style.color = '#f87171';
            } else {
                btn.textContent = '🔔 Bildirimleri Aç';
                btn.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
                btn.style.color = '#fff';
            }
        }

        if (statusText) {
            if (state === 'granted') {
                statusText.innerHTML = '<span style="color:#34d399;">✓ Aktif</span> (Sınavlardan 24s, 18s, 12s, 6s ve 3s önce bildirim alıyorsunuz)';
            } else if (state === 'denied') {
                statusText.innerHTML = '<span style="color:#f87171;">Tarayıcıda Engellendi</span> (Telefon izinlerinden açınız)';
            } else {
                statusText.innerHTML = '<span style="color:#fbbf24;">Henüz İzin Verilmedi</span> (Tıklayarak aktifleştirin)';
            }
        }
    }

    // Modal Açma: Bildirim Ayarları
    window.openNotificationSettingsModal = function () {
        const modal = document.getElementById('modal-notification-settings');
        if (!modal) return;
        updateNotificationPermissionUI();

        // Tercih onay kutularını doldur
        MILESTONES.forEach(m => {
            const chk = document.getElementById(`notif-chk-${m.hours}h`);
            if (chk) chk.checked = isMilestoneEnabled(m.hours);
        });

        modal.classList.remove('hidden');
    };

    window.closeNotificationSettingsModal = function () {
        const modal = document.getElementById('modal-notification-settings');
        if (modal) modal.classList.add('hidden');
    };

    // --- 📢 Yönetici Tarafından Manuel Yayınlanan Bildirimleri Denetle ---
    window.checkIncomingBroadcastNotifications = function () {
        if (!window.DB || !Array.isArray(DB.adminBroadcasts) || DB.adminBroadcasts.length === 0) return;

        const myStaffId = localStorage.getItem('myStaffId');
        const now = Date.now();

        // Yarın sınavı olanların kimliklerini hesapla (tomorrow_only hedefi için)
        let tomorrowStaffIds = null;
        function getTomorrowProctorIds() {
            if (tomorrowStaffIds !== null) return tomorrowStaffIds;
            tomorrowStaffIds = new Set();
            if (Array.isArray(DB.exams)) {
                const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                DB.exams.forEach(ex => {
                    if (ex.date === tomorrowStr) {
                        const ids = (ex.proctorIds || [ex.proctorId]).map(String);
                        ids.forEach(id => tomorrowStaffIds.add(id));
                    }
                });
            }
            return tomorrowStaffIds;
        }

        DB.adminBroadcasts.forEach(bc => {
            if (!bc || !bc.id || !bc.message) return;

            // 1. Hedef Kontrolü
            let isTarget = false;
            if (!bc.target || bc.target === 'all') {
                isTarget = true;
            } else if (bc.target === 'tomorrow_only') {
                if (myStaffId && getTomorrowProctorIds().has(String(myStaffId))) {
                    isTarget = true;
                }
            } else if (typeof bc.target === 'string' && myStaffId && String(bc.target) === String(myStaffId)) {
                isTarget = true;
            } else if (Array.isArray(bc.target) && myStaffId && bc.target.map(String).includes(String(myStaffId))) {
                isTarget = true;
            }

            if (!isTarget) return;

            // 2. Bu cihaza daha önce teslim edildi mi?
            const deliveryKey = `gtu_bc_delivered_${bc.id}`;
            const alreadyDelivered = localStorage.getItem(deliveryKey);
            if (alreadyDelivered) return;

            // İlk kez karşılaşıyoruz! Hemen teslim edildi olarak mühürle
            localStorage.setItem(deliveryKey, now.toString());

            // 3. Cihaz / Push Bildirimi Gönder (İzin verilmişse ve bildirimde push açıksa)
            const title = bc.title || '📢 GTÜ Gözetmenlik Yönetici Bildirimi';
            const message = bc.message;
            const priority = bc.priority || 'normal';

            if (bc.pushToDevice !== false && getPermissionState() === 'granted') {
                if (priority === 'urgent' && 'vibrate' in navigator) {
                    try { navigator.vibrate([300, 100, 300, 100, 300]); } catch (e) {}
                }
                window.dispatchLocalNotification(
                    title,
                    message,
                    `bc_${bc.id}`,
                    { broadcastId: bc.id, priority: priority, url: './index.html' }
                );
            }

            // 4. Ekranda açıksa Toast Gösterimi
            if (typeof showToast === 'function') {
                const icon = priority === 'urgent' ? '🚨' : (priority === 'info' ? 'ℹ️' : '📢');
                showToast(`${icon} ${title}: ${message}`, priority === 'urgent' ? 'error' : (priority === 'info' ? 'info' : 'warning'));
            }

            // 5. Rozeti ve Bildirim Paneli Listesini Güncelle
            if (typeof updateNotifBadge === 'function') updateNotifBadge();
            if (typeof renderNotifications === 'function') renderNotifications();
        });
    };

    // --- Başlatıcı (Timer & Focus Listeners) ---
    function initNotificationEngine() {
        // Sayfa açıldığında ve her 60 saniyede bir kontrol et
        setTimeout(checkAllExamNotifications, 3000);
        setTimeout(window.checkIncomingBroadcastNotifications, 3500);
        setInterval(checkAllExamNotifications, 60000);
        setInterval(window.checkIncomingBroadcastNotifications, 30000);

        // Kullanıcı sekmeye veya uygulamaya geri döndüğünde anında kontrol et
        window.addEventListener('focus', () => {
            checkAllExamNotifications();
            window.checkIncomingBroadcastNotifications();
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkAllExamNotifications();
                window.checkIncomingBroadcastNotifications();
            }
        });

        // UI durumunu güncelle
        setTimeout(updateNotificationPermissionUI, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotificationEngine);
    } else {
        initNotificationEngine();
    }

})();
