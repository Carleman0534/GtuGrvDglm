/**
 * 🔔 GTÜ Gözetmenlik Sistemi - Kademeli & Şifresiz Bildirim Motoru (v33)
 * 
 * Özellikler:
 * 1. Şifresiz / Giriş Şartı Olmadan Bildirim:
 *    - Kullanıcı uygulamayı yüklediğinde veya webde açtığında 1 tıkla bildirim izni verir.
 *    - Yönetici "Herkese Bildirim Gönder" dediğinde kimliği olmasa bile kilit ekranına bildirim gider.
 * 2. Şifresiz 1-Tıkla İsim Bağlama (Passwordless Identity Binding):
 *    - Görevli asistan veya hoca şifre girmeden listeden kendi adını seçerek cihazını eşleştirir.
 * 3. 5 Kademeli Otomatik Sınav Hatırlatıcısı (24s, 18s, 12s, 6s, 3s önce).
 * 4. Web Notifications API ve Service Worker entegrasyonu (Titreşim, rozet, kilit ekranı).
 * 5. Mükerrer bildirim önleme (Deduplication hafızası).
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

    // Erken Önbellek Senkronizasyonu (Giriş yapılmasa bile veritabanını ve yayınları hazırla)
    function syncCachedDBEarly() {
        if (!window.DB || !Array.isArray(window.DB.staff) || window.DB.staff.length <= 2) {
            try {
                const saved = localStorage.getItem('gozetmenlik_db_v25');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed && Array.isArray(parsed.staff) && parsed.staff.length > 0) {
                        window.DB = parsed;
                    }
                }
            } catch (e) {
                console.warn('[NotifEngine] Early DB cache parse error:', e);
            }
        }
        // Eğer Firebase'den canlı veri çekilebiliyorsa arka planda güncelle
        if (typeof window.loadFromDataJSON === 'function' && !sessionStorage.getItem('isLoggedIn')) {
            window.loadFromDataJSON().then(() => {
                if (typeof window.populateQuickStaffDropdown === 'function') {
                    window.populateQuickStaffDropdown();
                }
                if (typeof window.checkIncomingBroadcastNotifications === 'function') {
                    window.checkIncomingBroadcastNotifications();
                }
            }).catch(() => {});
        }
    }

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
            window.updateAllNotificationUI();

            if (permission === 'granted') {
                if (typeof showToast === 'function') {
                    showToast('🔔 Bildirim izinleri başarıyla aktifleştirildi! Kilit ekranı bildirimleriniz hazır.', 'success');
                }
                // Başarı bildirimi gönder
                window.dispatchLocalNotification(
                    '🔔 GTÜ Gözetmenlik Bildirimleri Aktif!',
                    'Sınav duyuruları ve yönetici mesajları telefon kilit ekranınıza otomatik iletilecektir.',
                    'perm_granted'
                );
                // Hemen kontrolleri çalıştır
                checkAllExamNotifications();
                window.checkIncomingBroadcastNotifications();
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

    // 1 Tıkla Kilit Ekranı Bildirimini Aç ve Geri Bildirim Ver
    window.quickEnableNotificationWithFeedback = async function () {
        const granted = await window.requestExamNotificationPermission();
        window.updateAllNotificationUI();
        if (granted) {
            window.dismissProactiveNotifBanner();
        }
    };

    // Proaktif Banner'ı Kapat
    window.dismissProactiveNotifBanner = function () {
        const b = document.getElementById('proactive-notif-banner');
        if (b) b.classList.add('hidden');
        sessionStorage.setItem('proactive_notif_banner_dismissed', '1');
    };

    // Şifresiz 1 Tıkla İsim Seçme ve Cihazı Bağlama
    window.bindStaffIdentityWithoutPassword = async function (staffId) {
        if (!staffId) {
            localStorage.removeItem('myStaffId');
            const badge = document.getElementById('quick-staff-status-badge');
            if (badge) badge.style.display = 'none';
            return;
        }

        localStorage.setItem('myStaffId', String(staffId));
        const staff = (window.DB && Array.isArray(window.DB.staff)) ? window.DB.staff.find(s => String(s.id) === String(staffId)) : null;
        const staffName = staff ? staff.name : 'Gözetmen';

        const badge = document.getElementById('quick-staff-status-badge');
        if (badge) {
            badge.style.display = 'block';
            badge.innerHTML = `✓ <b>${staffName}</b> olarak bağlandı! Sınav hatırlatıcıları aktif.`;
        }

        // Bildirim izni açık değilse talep et
        if (getPermissionState() !== 'granted') {
            await window.requestExamNotificationPermission();
        } else {
            if (typeof showToast === 'function') {
                showToast(`✓ ${staffName} cihazı eşleştirildi. Görev bildirimleri hazır!`, 'success');
            }
            window.dispatchLocalNotification(
                `🎓 Sayın ${staffName},`,
                'Cihazınız başarıyla bağlandı. Sınav görevlerinizden 24, 18, 12, 6 ve 3 saat önce telefonunuza otomatik hatırlatma iletilecektir.',
                'identity_linked'
            );
        }

        // Hemen sınav bildirimlerini denetle
        checkAllExamNotifications();
    };

    // Şifresiz Hızlı Gözat / Misafir Modunda Programa Gir
    window.enterAsGuestWithSelectedStaff = function () {
        const selectEl = document.getElementById('quick-staff-select');
        if (selectEl && selectEl.value) {
            localStorage.setItem('myStaffId', String(selectEl.value));
        }
        if (typeof window.finishLogin === 'function') {
            window.finishLogin(false, false);
            if (typeof showToast === 'function') {
                showToast('Şifresiz hızlı görünüm açıldı.', 'info');
            }
        } else {
            const loginOverlay = document.getElementById('login-overlay');
            const appWrapper = document.getElementById('app-wrapper');
            if (loginOverlay) loginOverlay.classList.add('hidden');
            if (appWrapper) appWrapper.style.display = 'block';
            if (typeof initApp === 'function') initApp();
        }
    };

    // Hızlı Asistan İsim Listesini Doldur
    window.populateQuickStaffDropdown = function () {
        syncCachedDBEarly();
        const selectEl = document.getElementById('quick-staff-select');
        if (!selectEl) return;

        const staffList = (window.DB && Array.isArray(window.DB.staff)) ? window.DB.staff : [];
        if (staffList.length === 0) return;

        const currentStaffId = localStorage.getItem('myStaffId');

        // Mevcut seçenekleri kontrol et, boşsa doldur
        const existingOptions = selectEl.querySelectorAll('option:not([value=""])');
        if (existingOptions.length === 0) {
            const sorted = [...staffList].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
            sorted.forEach(s => {
                const opt = document.createElement('option');
                opt.value = String(s.id);
                opt.textContent = s.name;
                selectEl.appendChild(opt);
            });
        }

        if (currentStaffId) {
            selectEl.value = String(currentStaffId);
            const matched = staffList.find(s => String(s.id) === String(currentStaffId));
            const badge = document.getElementById('quick-staff-status-badge');
            if (badge && matched) {
                badge.style.display = 'block';
                badge.innerHTML = `✓ <b>${matched.name}</b> olarak bağlı. Görev hatırlatıcıları aktif.`;
            }
        }
    };

    // Bildirim Gönder (Cihaz / PWA Düzeyinde)
    window.dispatchLocalNotification = function (title, body, tag = 'general', extraData = {}) {
        // Titreşim deseni (200ms titre, 100ms dur, 200ms titre)
        if ('vibrate' in navigator) {
            try { navigator.vibrate([200, 100, 200]); } catch (e) {}
        }

        // 1. Service Worker ile Bildirim Gönder (PWA arka plandayken veya telefon kilitliyken çalışır)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(title, {
                    body: body,
                    icon: './icon-192.png',
                    badge: './icon-192.png',
                    vibrate: [200, 100, 200],
                    tag: `gtu_exam_${tag}`,
                    renotify: true,
                    requireInteraction: (tag.includes('3h') || tag.includes('6h') || tag.includes('bc_')),
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
        // Eğer kullanıcı henüz kimlik seçmemişse (anonim):
        // Kişisel sınav görevleri eşleşemeyeceği için yüzlerce sınavın bildirimini telefona yığmıyoruz.
        // Anonim kullanıcılar checkIncomingBroadcastNotifications() ile tüm yönetici genel duyurularını alır.
        if (!myStaffId) return;

        const now = new Date();

        // Asistanın veya yöneticinin sınavlarını belirle
        const targetExams = DB.exams.filter(ex => {
            if (!ex.date || !ex.time) return false;
            if (typeof isStaffProctorById === 'function') {
                return isStaffProctorById(ex, myStaffId);
            }
            const ids = (ex.proctorIds || [ex.proctorId]).map(String);
            return ids.includes(String(myStaffId));
        });

        targetExams.forEach(ex => {
            const examDateTimeStr = `${ex.date}T${ex.time.length === 5 ? ex.time : ex.time.padStart(5, '0')}:00`;
            const examDate = new Date(examDateTimeStr);
            if (isNaN(examDate.getTime())) return;

            const diffMs = examDate.getTime() - now.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            // Sınav geçmişte kaldıysa atla
            if (diffHours < 0) return;

            MILESTONES.forEach(m => {
                if (!isMilestoneEnabled(m.hours)) return;

                const storageKey = `gtu_notif_fired_${ex.id}_${m.hours}h`;
                const alreadySent = localStorage.getItem(storageKey);

                if (!alreadySent && diffHours <= m.hours && diffHours > (m.hours - 2.5)) {
                    localStorage.setItem(storageKey, new Date().toISOString());

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
            "Sınavınız saat 10:00'da Amfi 1 salonunda başlayacaktır. Kademeli bildirim sistemi sorunsuz çalışıyor!",
            'test_3h'
        );

        if (typeof showToast === 'function') {
            showToast('✅ Test bildirimi telefonunuza gönderildi! Kilit ekranınızı kontrol edebilirsiniz.', 'success');
        }
    };

    // Tüm Bildirim İzin Durumlarını UI'da Senkronize Et
    window.updateAllNotificationUI = function () {
        const state = getPermissionState();

        // 1. Modal içindeki buton & durum
        const btnModal = document.getElementById('btn-enable-notifications');
        const statusText = document.getElementById('notif-perm-status-text');

        if (btnModal) {
            if (state === 'granted') {
                btnModal.textContent = '✓ Bildirimler Aktif';
                btnModal.style.background = 'rgba(16, 185, 129, 0.2)';
                btnModal.style.borderColor = '#34d399';
                btnModal.style.color = '#34d399';
            } else if (state === 'denied') {
                btnModal.textContent = '❌ Bildirimler Engelli';
                btnModal.style.background = 'rgba(239, 68, 68, 0.2)';
                btnModal.style.borderColor = '#f87171';
                btnModal.style.color = '#f87171';
            } else {
                btnModal.textContent = '🔔 Bildirimleri Aç';
                btnModal.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
                btnModal.style.color = '#fff';
            }
        }

        if (statusText) {
            if (state === 'granted') {
                statusText.innerHTML = '<span style="color:#34d399;">✓ Aktif</span> (Sınav görevleri ve yönetici duyuruları kilit ekranında gösterilir)';
            } else if (state === 'denied') {
                statusText.innerHTML = '<span style="color:#f87171;">Tarayıcıda Engellendi</span> (Telefon ayarlarından açınız)';
            } else {
                statusText.innerHTML = '<span style="color:#fbbf24;">Henüz İzin Verilmedi</span> (Tıklayarak aktifleştirin)';
            }
        }

        // 2. Giriş ekranındaki hızlı buton
        const btnQuick = document.getElementById('btn-quick-notif-perm');
        if (btnQuick) {
            if (state === 'granted') {
                btnQuick.textContent = '✓ Kilit Ekranı Bildirimleri Açık';
                btnQuick.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                btnQuick.style.borderColor = '#34d399';
            } else if (state === 'denied') {
                btnQuick.textContent = '❌ Bildirimler Tarayıcıda Engelli';
                btnQuick.style.background = 'rgba(239, 68, 68, 0.2)';
                btnQuick.style.borderColor = '#f87171';
            } else {
                btnQuick.textContent = '🔔 Kilit Ekranı Bildirimlerini Aç';
                btnQuick.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
                btnQuick.style.borderColor = 'rgba(56, 189, 248, 0.4)';
            }
        }

        // 3. Uygulama içi proaktif banner
        const proactiveBanner = document.getElementById('proactive-notif-banner');
        if (proactiveBanner) {
            if (state === 'granted' || sessionStorage.getItem('proactive_notif_banner_dismissed') === '1') {
                proactiveBanner.classList.add('hidden');
            } else {
                proactiveBanner.classList.remove('hidden');
            }
        }
    };

    // Modal Açma: Bildirim Ayarları
    window.openNotificationSettingsModal = function () {
        const modal = document.getElementById('modal-notification-settings');
        if (!modal) return;
        window.updateAllNotificationUI();

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
                // GENEL DUYURU: Kullanıcı sisteme hiç giriş yapmamış veya isim seçmemiş olsa bile alır!
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
        syncCachedDBEarly();
        window.populateQuickStaffDropdown();

        // Sayfa açıldığında ve periyodik kontrol et
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
        setTimeout(window.updateAllNotificationUI, 800);
        setTimeout(window.populateQuickStaffDropdown, 1200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotificationEngine);
    } else {
        initNotificationEngine();
    }

})();
