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

    // Sınav saatinden önceki son hatırlatma: 2 saat kala, sınav başına bir kez.
    // (3 gün önce ve "yarın" hatırlatmaları checkUpcomingDayReminders içinde; toplam 3 bildirim)
    const MILESTONES = [
        { hours: 2, label: '2 Saat Önce', icon: '⏰', tagPrefix: '2h' }
    ];

    // Yönetici duyurularının cihaz bildirimi olarak gösterileceği en uzun süre (zamanlanmış görevle aynı)
    const BROADCAST_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

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
                // Uygulama kapalıyken de bildirim alabilmek için cihazı kaydet
                window.ensurePushSubscription();
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
        localStorage.setItem('proactive_notif_banner_dismissed', '1'); // kalıcı: bir kez kapatılınca bu cihazda bir daha çıkmaz
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
        window.setDeviceStaffId(staffId);
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
            window.setDeviceStaffId(selectEl.value);
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

    // --- "Sıradaki göreviniz 3 gün sonra / yarın" hatırlatmaları ---
    // Zamanlanmış görev (.github/scripts/sure-hatirlatma.mjs) uygulama kapalıyken aynısını gönderir;
    // metin ve etiket aynı olduğu için aynı cihazda ikisi birden gelirse biri diğerinin yerini alır.
    const REMINDER_DAYS = [3, 1]; // 3 gün önce ve yarın
    const REMINDER_FROM_HOUR = 9, REMINDER_UNTIL_HOUR = 21; // Türkiye saati

    function checkUpcomingDayReminders(staffId, exams) {
        const trNow = new Date(Date.now() + 3 * 3600000);
        const hour = trNow.getUTCHours();
        if (hour < REMINDER_FROM_HOUR || hour >= REMINDER_UNTIL_HOUR) return;
        const today = trNow.toISOString().slice(0, 10);

        const groups = new Map(); // `${days}|${date}` -> exams
        exams.forEach(ex => {
            const days = Math.round((Date.parse(ex.date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
            if (!REMINDER_DAYS.includes(days)) return;
            const k = `${days}|${ex.date}`;
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(ex);
        });

        groups.forEach((list, k) => {
            const [days, date] = [parseInt(k.split('|')[0], 10), k.split('|')[1]];
            const storageKey = `gtu_gun_${staffId}_${days}_${date}`;
            if (localStorage.getItem(storageKey)) return;
            localStorage.setItem(storageKey, new Date().toISOString());

            const sorted = list.slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));
            const dayName = new Date(date + 'T12:00:00+03:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });
            const title = days === 1 ? '📅 Yarın göreviniz var' : `📅 Sıradaki göreviniz ${days} gün sonra`;
            const body = sorted.length === 1
                ? `${sorted[0].name} — ${dayName} ${sorted[0].time}, ${sorted[0].location || 'derslik belirtilmedi'} (${parseInt(sorted[0].duration, 10) || 60} dk)`
                : `${dayName}: ${sorted.length} görev — ` + sorted.map(e => `${e.time} ${e.name}`).join(' · ');

            if (getPermissionState() === 'granted') {
                // dispatchLocalNotification etikete "gtu_exam_" ekler: zamanlanmış görevdeki etiketle aynı olur
                window.dispatchLocalNotification(title, body, `gun_${staffId}_${days}_${date}`, { examId: sorted[0].id });
            }
            if (typeof showToast === 'function') showToast(`${title}: ${body}`, days === 1 ? 'warning' : 'info');
        });
    }

    // --- Sınav Bildirimlerini Denetleyen Ana Döngü ---
    function checkAllExamNotifications() {
        if (!window.DB || !DB.exams || !Array.isArray(DB.exams)) return;

        const myStaffId = window.getDeviceStaffId();
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

        checkUpcomingDayReminders(myStaffId, targetExams);

        targetExams.forEach(ex => {
            const examDateTimeStr = `${ex.date}T${ex.time.length === 5 ? ex.time : ex.time.padStart(5, '0')}:00`;
            const examDate = new Date(examDateTimeStr);
            if (isNaN(examDate.getTime())) return;

            const diffMs = examDate.getTime() - now.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            // Sınav geçmişte kaldıysa atla
            if (diffHours < 0) return;

            MILESTONES.forEach(m => {
                const storageKey = `gtu_notif_fired_${ex.id}_${m.hours}h`;
                const alreadySent = localStorage.getItem(storageKey);

                if (!alreadySent && diffHours <= m.hours && diffHours > 0) {
                    localStorage.setItem(storageKey, new Date().toISOString());

                    const loc = ex.location ? `Salon: ${ex.location}` : 'Derslik henüz belirtilmedi';
                    const dur = ex.duration ? `(${ex.duration} dk)` : '';

                    const title = `⏰ ${ex.name} 2 saat sonra başlıyor`;
                    const message = `Saat ${ex.time}'da başlayacak sınav görevi. ${loc} ${dur}`.trim();

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

    // --- Sınav Bitimi Hoca Süre Onayı Kontrol Motoru ---
    window.checkPostExamDurationVerifications = function () {
        if (!window.DB || !DB.exams || !Array.isArray(DB.exams)) return;

        const now = new Date();
        const myStaffId = window.getDeviceStaffId();
        const isLecturerMode = sessionStorage.getItem('isLecturer') === 'true';
        const portalSelect = document.getElementById('lecturer-portal-staff-select');
        const portalSelectVal = (portalSelect && portalSelect.value) ? portalSelect.value.trim().toLowerCase() : '';
        const storedLecturer = (localStorage.getItem('myLecturerName') || '').trim().toLowerCase();

        // Bu cihazdaki kişinin sınavı mı? (gözetmeni ya da ders hocası)
        // Eskiden siteyi açan herkesin cihazına, sınavla ilgisi olmasa da bildirim gidiyordu.
        const isMine = (ex) => {
            if (myStaffId && isMyProctorExam(ex, myStaffId)) return true;
            const exLecturer = (ex.lecturer || '').toLowerCase();
            if (!exLecturer || exLecturer === '-') return false;
            return (portalSelectVal && exLecturer.includes(portalSelectVal)) ||
                (storedLecturer && exLecturer.includes(storedLecturer));
        };

        // Biten ve henüz süresi onaylanmamış sınavları kontrol et
        DB.exams.forEach(ex => {
            if (!ex.date || !ex.time) return;
            // Zaten onaylanmış veya hoca tarafından teyit edilmişse atla
            if (ex.durationConfirmed || ex.lecturerVerified || ex.durationApproved) return;
            if (!isMine(ex)) return;

            let safeStart = null;
            if (typeof getSafeDate === 'function') {
                safeStart = getSafeDate(ex.date, ex.time);
            } else {
                const tClean = ex.time.length === 5 ? ex.time : ex.time.padStart(5, '0');
                safeStart = new Date(`${ex.date}T${tClean}:00`);
            }
            if (!safeStart || isNaN(safeStart.getTime())) return;

            const durMins = parseInt(ex.duration, 10) || 60;
            const examEnd = new Date(safeStart.getTime() + durMins * 60000);

            // Sınav henüz bitmediyse atla
            if (now.getTime() < examEnd.getTime()) return;

            // Bu sınavın bitiş bildirimi bu cihazda daha önce gönderildi mi?
            const storageKey = `gtu_post_exam_dur_notif_${ex.id}`;
            const alreadySent = localStorage.getItem(storageKey);

            if (!alreadySent) {
                localStorage.setItem(storageKey, new Date().toISOString());

                const title = `⏱️ [Sınav Sona Erdi] ${ex.name}`;
                const message = `Sınav süreniz ${durMins} dakika sürdü, onaylıyor musunuz?`;

                // 1. Cihaz / Push Bildirimi Gönder (Kilit ekranı / PWA)
                if (getPermissionState() === 'granted') {
                    window.dispatchLocalNotification(
                        title,
                        message,
                        `post_exam_${ex.id}`,
                        {
                            action: 'verify_duration',
                            examId: ex.id,
                            step: 'question',
                            url: `./index.html?verifyDurationExamId=${encodeURIComponent(ex.id)}&step=question`
                        }
                    );
                }

                // 2. Uygulama İçi Bildirim Kutusuna (DB.notifications) Ekle
                const notifStaffKey = myStaffId || 'lecturer';
                if (window.DB) {
                    if (!DB.notifications) DB.notifications = {};
                    if (!Array.isArray(DB.notifications[notifStaffKey])) DB.notifications[notifStaffKey] = [];

                    DB.notifications[notifStaffKey].unshift({
                        id: Date.now(),
                        title: title,
                        message: message,
                        date: new Date().toISOString(),
                        isRead: false,
                        type: 'exam_duration_prompt',
                        examId: ex.id,
                        duration: durMins,
                        step: 'question'
                    });

                    if (typeof updateNotifBadge === 'function') updateNotifBadge();
                    if (typeof renderNotifications === 'function') renderNotifications();
                    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
                }

                // 3. Ekranda açıksa Toast Bildirimi
                if (typeof showToast === 'function') {
                    showToast(`⏱️ ${ex.name} sınavı bitti. Süre teyidi bekleniyor (${durMins} dk).`, 'info');
                }

                // 4. Eğer kullanıcı Hoca Modunda ise veya portalda bu dersin hocası seçiliyse otomatik modal aç
                const exLecturerClean = (ex.lecturer || '').toLowerCase();
                const isMatchingLecturer = isLecturerMode || 
                    (portalSelectVal && exLecturerClean.includes(portalSelectVal)) ||
                    (storedLecturer && exLecturerClean.includes(storedLecturer));

                if (isMatchingLecturer) {
                    const promptModal = document.getElementById('modal-lecturer-duration-prompt');
                    if (promptModal && promptModal.classList.contains('hidden')) {
                        setTimeout(() => {
                            if (typeof window.openLecturerDurationPromptModal === 'function') {
                                window.openLecturerDurationPromptModal(ex.id, 'question');
                            }
                        }, 1000);
                    }
                }
            }
        });

        // Bildirim kaçırılmış olsa bile siteye girişte "Sürenizi onaylayın" penceresi
        window.showPendingDurationPrompt();
    };

    function isMyProctorExam(ex, staffId) {
        const sid = String(staffId);
        if (String(ex.proctorId) === sid) return true;
        return Array.isArray(ex.proctorIds) && ex.proctorIds.map(String).includes(sid);
    }

    // 31 Ekim 2026 öncesi sınavlar peşinen kabul edildi (app.js ile aynı sınır)
    const DURATION_CUTOFF = new Date('2026-10-31T21:48:45+03:00');

    // Gözetmenin bitmiş ve süresi onaylanmamış sınavları
    function getMyPendingDurationExams() {
        const myStaffId = window.getDeviceStaffId();
        if (!myStaffId || !window.DB || !Array.isArray(DB.exams)) return [];
        const now = Date.now();
        return DB.exams.filter(ex => {
            if (!ex.date || !ex.time || !isMyProctorExam(ex, myStaffId)) return false;
            if (ex.durationConfirmed || ex.lecturerVerified || ex.durationApproved || ex.actualDuration) return false;
            const start = typeof getSafeDate === 'function' ? getSafeDate(ex.date, ex.time) : new Date(`${ex.date}T${ex.time}:00`);
            if (!start || isNaN(start.getTime()) || start < DURATION_CUTOFF) return false;
            const end = start.getTime() + (parseInt(ex.duration, 10) || 60) * 60000;
            return now >= end;
        }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Siteye girişte, hangi sayfada olursa olsun, süresi onaylanmamış sınavları listeleyen pencere.
    // "Daha Sonra" denirse bu oturumda yeni bir sınav eklenmedikçe tekrar açılmaz.
    window.showPendingDurationPrompt = function (force) {
        if (sessionStorage.getItem('isLoggedIn') !== 'true') return;
        const pending = getMyPendingDurationExams();
        let modal = document.getElementById('modal-pending-duration');

        if (pending.length === 0) {
            if (modal) modal.classList.add('hidden');
            return;
        }

        const key = pending.map(e => e.id).join(',');
        const isOpen = modal && !modal.classList.contains('hidden');
        if (!force && (isOpen || sessionStorage.getItem('pending_duration_prompt_seen') === key)) return;
        // Başka bir pencere açıksa (ör. düzenleme) araya girme; bir sonraki kontrolde açılır
        if (!isOpen && document.querySelector('.modal:not(.hidden)')) return;

        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-pending-duration';
            modal.className = 'modal hidden';
            modal.style.zIndex = '9000';
            document.body.appendChild(modal);
        }

        const rows = pending.map(ex => {
            const mins = parseInt(ex.scheduledDuration || ex.duration, 10) || 60;
            const id = escapeHtml(ex.id);
            return `
                <div style="border:1px solid rgba(245,158,11,0.45); background:rgba(245,158,11,0.08); border-radius:12px; padding:0.7rem 0.8rem; margin-bottom:0.6rem;">
                    <div style="font-weight:700; color:#f8fafc; font-size:0.92rem;">${escapeHtml(ex.name)}</div>
                    <div style="font-size:0.76rem; color:#cbd5e1; margin:3px 0 8px;">📅 ${escapeHtml(ex.date)} · ⏰ ${escapeHtml(ex.time)} · 📍 ${escapeHtml(ex.location || '-')} · Planlanan <b>${mins} dk</b></div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                        <button type="button" class="btn-primary" style="background:linear-gradient(135deg,#10b981,#059669); border:none; padding:0.55rem 0.4rem; border-radius:8px; font-weight:700; font-size:0.8rem;"
                            onclick="window.confirmPendingDuration('${id}', ${mins})">✓ ${escapeHtml(ex.time)}'da başladı, ${mins} dk sürdü</button>
                        <button type="button" class="btn-secondary" style="background:rgba(249,115,22,0.15); border:1.5px solid #f97316; color:#fb923c; padding:0.55rem 0.4rem; border-radius:8px; font-weight:700; font-size:0.8rem;"
                            onclick="window.openPendingDurationEdit('${id}')">⏱️ Saat veya süre farklı</button>
                    </div>
                </div>`;
        }).join('');

        modal.innerHTML = `
            <div class="modal-content" style="max-width:480px;">
                <h2 style="margin:0 0 0.3rem; color:#fbbf24;">⏱️ Sınav Saatini ve Sürenizi Onaylayın</h2>
                <p style="margin:0 0 0.9rem; font-size:0.84rem; color:#cbd5e1;">
                    Gözetmenlik yaptığınız ${pending.length > 1 ? pending.length + ' sınavın' : 'sınavın'} başlangıç saati ve süresi henüz onaylanmadı.
                    Sınav farklı saatte başladıysa ya da farklı sürdüyse düzeltin; puanlar buna göre hesaplanır.
                </p>
                ${rows}
                <button type="button" class="btn-secondary" style="width:100%; margin-top:0.3rem; padding:0.55rem;" onclick="window.dismissPendingDurationPrompt()">Daha Sonra</button>
            </div>`;
        modal.classList.remove('hidden');
        sessionStorage.setItem('pending_duration_prompt_seen', key);
    };

    window.confirmPendingDuration = function (examId, mins) {
        if (typeof window.confirmScheduledDuration === 'function') window.confirmScheduledDuration(examId, mins);
        window.showPendingDurationPrompt(true);
    };

    window.openPendingDurationEdit = function (examId) {
        window.dismissPendingDurationPrompt();
        if (typeof window.openUpdateDurationModal === 'function') window.openUpdateDurationModal(examId);
    };

    window.dismissPendingDurationPrompt = function () {
        const modal = document.getElementById('modal-pending-duration');
        if (modal) modal.classList.add('hidden');
    };

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

        // 2. Giriş ekranındaki teşvik butonları (Yükle & Bildirim Aç)
        const btnQuick = document.getElementById('btn-quick-notif-perm');
        const notifText = document.getElementById('btn-login-notif-text');
        const notifChip = document.getElementById('btn-login-notif-chip');

        if (btnQuick) {
            if (state === 'granted') {
                btnQuick.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                btnQuick.style.borderColor = '#34d399';
                if (notifText) notifText.textContent = '✓ 2. Adım: Kilit Ekranı Bildirimleri Açık';
                if (notifChip) { notifChip.textContent = 'Aktif ✓'; notifChip.style.background = 'rgba(255,255,255,0.3)'; }
            } else if (state === 'denied') {
                btnQuick.style.background = 'rgba(239, 68, 68, 0.25)';
                btnQuick.style.borderColor = '#f87171';
                if (notifText) notifText.textContent = '❌ 2. Adım: Bildirimler Engellendi';
                if (notifChip) { notifChip.textContent = 'Ayarlardan Aç'; notifChip.style.background = 'rgba(239,68,68,0.4)'; }
            } else {
                btnQuick.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
                btnQuick.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                if (notifText) notifText.textContent = '2. Adım: Kilit Ekranı Bildirimlerini Aç';
                if (notifChip) { notifChip.textContent = 'İzin Ver'; notifChip.style.background = 'rgba(255,255,255,0.22)'; }
            }
        }

        // PWA Kurulum Durumu Kontrolü
        const btnPwa = document.getElementById('btn-login-pwa-install');
        const pwaText = document.getElementById('btn-login-pwa-text');
        const pwaChip = document.getElementById('btn-login-pwa-chip');
        const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator && window.navigator.standalone === true);

        if (btnPwa) {
            if (isStandalone) {
                btnPwa.style.background = 'rgba(16, 185, 129, 0.2)';
                btnPwa.style.border = '1px solid #34d399';
                btnPwa.style.color = '#34d399';
                if (pwaText) pwaText.textContent = '✓ 1. Adım: Uygulama Telefonda Kurulu';
                if (pwaChip) { pwaChip.textContent = 'Kurulu ✓'; pwaChip.style.background = 'rgba(16, 185, 129, 0.3)'; }
            } else {
                btnPwa.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
                btnPwa.style.border = 'none';
                btnPwa.style.color = '#ffffff';
                if (pwaText) pwaText.textContent = '1. Adım: Telefona Uygulama Olarak Yükle';
                if (pwaChip) { pwaChip.textContent = 'Hızlı'; pwaChip.style.background = 'rgba(255,255,255,0.22)'; }
            }
        }

        // 3. Uygulama içi proaktif banner: duruma göre doğru yönlendirme
        const proactiveBanner = document.getElementById('proactive-notif-banner');
        if (proactiveBanner) {
            const pTitle = document.getElementById('proactive-notif-title');
            const pText = document.getElementById('proactive-notif-text');
            const pBtn = document.getElementById('proactive-notif-btn');
            const iosNotInstalled = isIosDevice() && !isStandalone;
            let show = state !== 'granted' && localStorage.getItem('proactive_notif_banner_dismissed') !== '1';

            if (iosNotInstalled) {
                // iPhone'da bildirim yalnızca ana ekrana eklenen uygulamada çalışır; izin istemek işe yaramaz
                if (pTitle) pTitle.textContent = 'Bildirimler için uygulamayı ana ekrana ekleyin';
                if (pText) pText.textContent = 'iPhone\'da sınav ve süre onayı bildirimleri yalnızca ana ekrana eklenen uygulamada çalışır.';
                if (pBtn) { pBtn.style.display = ''; pBtn.textContent = '📲 Nasıl Eklenir?'; pBtn.onclick = () => window.triggerPwaInstall && window.triggerPwaInstall(); }
            } else if (state === 'denied') {
                if (pTitle) pTitle.textContent = 'Bildirimler kapalı';
                if (pText) pText.textContent = 'Telefon veya tarayıcı ayarlarından bu site için bildirimlere izin verirseniz sınav ve süre onayı hatırlatmaları gelir.';
                if (pBtn) pBtn.style.display = 'none';
            } else if (state === 'unsupported') {
                show = false;
            } else {
                if (pTitle) pTitle.textContent = 'Sınav ve Duyuru Bildirimlerini Kaçırmayın';
                if (pText) pText.textContent = 'Uygulama kapalıyken bile sınav hatırlatmaları ve süre onayı bildirimleri telefonunuza gelsin.';
                if (pBtn) { pBtn.style.display = ''; pBtn.textContent = '🔔 Bildirimleri Aç'; pBtn.onclick = () => window.quickEnableNotificationWithFeedback(); }
            }
            proactiveBanner.classList.toggle('hidden', !show);
        }
    };

    function isIosDevice() {
        const ua = navigator.userAgent;
        return (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    }

    // --- Telefona kurulu uygulamada doğru anda izin isteği ---
    // Uygulama ana ekrana eklenip giriş yapıldıktan sonra, ekranın ortasında bir kez açıklamalı
    // izin penceresi gösterilir (reddedilirse 24 saat sorulmaz). İzin bir dokunuşla istenir;
    // tarayıcılar (özellikle iPhone) yalnızca kullanıcı dokunuşuyla izin penceresi açar.
    function maybeShowPermissionPrompt() {
        if (getPermissionState() !== 'default') return;
        const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        if (!standalone || sessionStorage.getItem('isLoggedIn') !== 'true' || !window.getDeviceStaffId()) return;
        const last = parseInt(localStorage.getItem('notif_permission_prompt_at') || '0', 10);
        if (Date.now() - last < 24 * 60 * 60 * 1000) return;
        if (document.querySelector('.modal:not(.hidden)')) return;

        localStorage.setItem('notif_permission_prompt_at', String(Date.now()));
        let modal = document.getElementById('modal-notif-permission');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-notif-permission';
            modal.className = 'modal hidden';
            modal.style.zIndex = '9000';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:420px; text-align:center;">
                    <div style="font-size:2.4rem;">🔔</div>
                    <h2 style="margin:0.3rem 0 0.5rem;">Bildirimlere izin verin</h2>
                    <p style="font-size:0.86rem; color:#cbd5e1; margin:0 0 1rem;">
                        Sınavlarınızdan önce hatırlatma ve sınav bitince <b>süre onayı</b> bildirimi alırsınız —
                        uygulama kapalıyken bile.
                    </p>
                    <button type="button" class="btn-primary" id="notif-permission-allow" style="width:100%; padding:0.7rem; font-weight:700;">🔔 İzin Ver</button>
                    <button type="button" class="btn-secondary" id="notif-permission-later" style="width:100%; margin-top:0.5rem; padding:0.55rem;">Şimdi Değil</button>
                </div>`;
            document.body.appendChild(modal);
            modal.querySelector('#notif-permission-allow').onclick = async () => {
                modal.classList.add('hidden');
                await window.requestExamNotificationPermission();
            };
            modal.querySelector('#notif-permission-later').onclick = () => modal.classList.add('hidden');
        }
        modal.classList.remove('hidden');
    }

    // --- Web Push: uygulama kapalıyken bildirim için cihaz aboneliği ---
    // Abonelik DB.pushAbonelikleri[gözetmenId] altında saklanır; zamanlanmış GitHub iş akışı
    // (.github/scripts/sure-hatirlatma.mjs) bu aboneliklere bildirim gönderir. Abonelik bilgisi
    // tek başına bildirim göndermeye yetmez (gizli VAPID anahtarı gerekir).
    const VAPID_PUBLIC_KEY = 'BPwOOdXIKbMCjEK107ygO3JgtASY5gU5fT2B_KBk6BGPafuWWQx6lEE6E0tRxPdUohZS2alTsmpPKIfNH72NdDo';
    let pushSyncDone = false;

    function base64UrlToUint8Array(s) {
        const raw = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
        return Uint8Array.from(raw, c => c.charCodeAt(0));
    }

    function endpointId(endpoint) {
        let h = 5381;
        for (let i = 0; i < endpoint.length; i++) h = ((h << 5) + h + endpoint.charCodeAt(i)) >>> 0;
        return 'p' + h.toString(16) + endpoint.length.toString(16);
    }

    window.ensurePushSubscription = async function () {
        const myStaffId = window.getDeviceStaffId();
        if (getPermissionState() !== 'granted' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
        if (!window.DB || !Array.isArray(DB.staff) || DB.staff.length === 0) return;
        if (!myStaffId) {
            // Cihazın sahibi yok (ör. yönetici profillere bakıyor): bu cihaz daha önce baktığı bir
            // gözetmen adına kaydedildiyse o kaydı kaldır, yoksa onun bildirimleri bu telefona gelir
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (sub && DB.pushAbonelikleri && typeof DB.pushAbonelikleri === 'object') {
                    const id = endpointId(sub.endpoint);
                    let removed = false;
                    Object.keys(DB.pushAbonelikleri).forEach(k => {
                        const list = DB.pushAbonelikleri[k];
                        if (!Array.isArray(list)) return;
                        const kept = list.filter(s => s && s.id !== id && s.endpoint !== sub.endpoint);
                        if (kept.length !== list.length) { DB.pushAbonelikleri[k] = kept; removed = true; }
                    });
                    if (removed && typeof saveToLocalStorage === 'function') saveToLocalStorage();
                }
                pushSyncDone = true;
            } catch (e) { /* önemsiz */ }
            return;
        }
        try {
            const reg = await navigator.serviceWorker.ready;
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY) });
            }
            const json = sub.toJSON();
            if (!json.endpoint || !json.keys) return;
            const id = endpointId(json.endpoint);
            if (!DB.pushAbonelikleri || typeof DB.pushAbonelikleri !== 'object') DB.pushAbonelikleri = {};

            const mine = Array.isArray(DB.pushAbonelikleri[myStaffId]) ? DB.pushAbonelikleri[myStaffId] : [];
            const already = mine.some(s => s && s.id === id && s.endpoint === json.endpoint);
            // Aynı cihaz başka bir kişiye kayıtlıysa (profil değiştirildi) oradan kaldır
            let changed = false;
            Object.keys(DB.pushAbonelikleri).forEach(k => {
                if (k === myStaffId || !Array.isArray(DB.pushAbonelikleri[k])) return;
                const before = DB.pushAbonelikleri[k].length;
                DB.pushAbonelikleri[k] = DB.pushAbonelikleri[k].filter(s => s && s.id !== id && s.endpoint !== json.endpoint);
                if (DB.pushAbonelikleri[k].length !== before) changed = true;
            });
            if (!already) {
                const entry = { id, endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, cihaz: /iPhone|iPad/.test(navigator.userAgent) ? 'iOS' : (/Android/.test(navigator.userAgent) ? 'Android' : 'Masaüstü'), eklendi: new Date().toISOString() };
                DB.pushAbonelikleri[myStaffId] = mine.filter(s => s && s.id !== id).concat(entry).slice(-5);
                changed = true;
            }
            if (changed && typeof saveToLocalStorage === 'function') saveToLocalStorage();
            pushSyncDone = true;
        } catch (e) {
            console.warn('[Push] Abonelik oluşturulamadı:', e.message);
        }
    };

    let lastPushAttempt = 0;
    function pushAndPromptTick() {
        maybeShowPermissionPrompt();
        if (!pushSyncDone && sessionStorage.getItem('isLoggedIn') === 'true' && Date.now() - lastPushAttempt > 60000) {
            lastPushAttempt = Date.now();
            window.ensurePushSubscription();
        }
    }

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

        const myStaffId = window.getDeviceStaffId();
        const now = Date.now();

        // Yarın sınavı olanların kimliklerini hesapla (tomorrow_only hedefi için)
        // Tarih Türkiye saatine göre alınır; toISOString UTC olduğundan gece 00:00-03:00 arası "yarın" yanlış çıkıyordu.
        let tomorrowStaffIds = null;
        function getTomorrowProctorIds() {
            if (tomorrowStaffIds !== null) return tomorrowStaffIds;
            tomorrowStaffIds = new Set();
            if (Array.isArray(DB.exams)) {
                const tomorrowStr = new Date(Date.now() + 86400000 + 3 * 3600000).toISOString().split('T')[0];
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

            // 3 günden eski duyurular yeni açılan cihazda topluca bildirim olarak yığılmasın
            const createdAt = Date.parse(bc.createdAt) || bc.timestamp || 0;
            if (createdAt && now - createdAt > BROADCAST_MAX_AGE_MS) return;

            // 3. Cihaz / Push Bildirimi Gönder (İzin verilmişse ve bildirimde push açıksa)
            const title = bc.title || '📢 GTÜ Gözetmenlik Yönetici Bildirimi';
            const message = bc.message;
            const priority = bc.priority || 'normal';

            if (bc.pushToDevice !== false && getPermissionState() === 'granted') {
                const show = () => {
                    if (priority === 'urgent' && 'vibrate' in navigator) {
                        try { navigator.vibrate([300, 100, 300, 100, 300]); } catch (e) {}
                    }
                    window.dispatchLocalNotification(
                        title,
                        message,
                        `bc_${bc.id}`,
                        { broadcastId: bc.id, priority: priority, url: './index.html' }
                    );
                };
                // Duyuru telefon bildirimiyle (Web Push) zaten geldiyse ve hâlâ duruyorsa ikinci kez gösterme
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.ready
                        .then(reg => reg.getNotifications({ tag: `gtu_exam_bc_${bc.id}` }))
                        .then(list => { if (!list.length) show(); })
                        .catch(show);
                } else {
                    show();
                }
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
        setTimeout(window.checkPostExamDurationVerifications, 4000);

        setInterval(checkAllExamNotifications, 60000);
        setInterval(window.checkIncomingBroadcastNotifications, 30000);
        // Sınav biter bitmez (en geç 5 sn içinde) bildirim + onay penceresi; giriş yapılınca da hemen
        setInterval(window.checkPostExamDurationVerifications, 5000);
        setInterval(pushAndPromptTick, 5000);

        // Kullanıcı sekmeye veya uygulamaya geri döndüğünde anında kontrol et
        window.addEventListener('focus', () => {
            checkAllExamNotifications();
            window.checkIncomingBroadcastNotifications();
            if (typeof window.checkPostExamDurationVerifications === 'function') window.checkPostExamDurationVerifications();
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkAllExamNotifications();
                window.checkIncomingBroadcastNotifications();
                if (typeof window.checkPostExamDurationVerifications === 'function') window.checkPostExamDurationVerifications();
            }
        });

        // Service Worker Bildirim Tıklama Dinleyicisi
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', event => {
                // Yalnızca süre teyidi bildirimleri pencereyi açar (eski service worker hatırlatmalarda da
                // NOTIFICATION_ACTION gönderiyordu; action alanı yoksa yok sayılır)
                if (event.data && event.data.type === 'NOTIFICATION_ACTION' &&
                    (event.data.action === 'verify_duration' || event.data.action === 'input_duration')) {
                    const examId = event.data.examId;
                    const step = event.data.step || (event.data.action === 'input_duration' ? 'input' : 'question');
                    if (examId && typeof window.openLecturerDurationPromptModal === 'function') {
                        window.openLecturerDurationPromptModal(examId, step);
                    }
                }
            });
        }

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
