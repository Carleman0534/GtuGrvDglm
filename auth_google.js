/**
 * =====================================================================
 *  GTU GÖZETMENLİK - GOOGLE OAUTH GİRİŞ MODÜLÜ (auth_google.js)
 * =====================================================================
 *  Yalnızca @gtu.edu.tr uzantılı kurumsal hesaplarla güvenli giriş sağlar.
 *  DB.staff tablosundaki e-postalarla eşleşen hocayı doğrudan kendi profiline alır.
 *
 *  GÜVENLİK VE YETKİLENDİRME:
 *  - Sadece tanımlı ADMIN_EMAILS listesindeki adresler yönetici yetkisi alabilir.
 *  - Gevşek "startsWith" kontrolleri tamamen kaldırılmıştır.
 *  - Öğretim elemanlarına teknik API anahtarı sorulmaz; anahtar doğrudan koda veya sisteme bağlanır.
 *
 *  ESKİ SİSTEME DÖNME / İPTAL GARANTİSİ:
 *  - Bu modül mevcut şifreli girişi asla bozmaz; hibrit çalışır.
 *  - İstenildiği an window.ENABLE_GOOGLE_AUTH = false yapılarak 1 saniyede devre dışı bırakılabilir.
 * =====================================================================
 */

(function () {
    'use strict';

    // Açma / Kapama Anahtarı
    window.ENABLE_GOOGLE_AUTH = true;

    // Firebase Auth Konfigürasyonu
    // Not: Web API Anahtarı gizli değildir (istemciye açıktır).
    const FIREBASE_AUTH_CONFIG = {
        apiKey: window.FIREBASE_WEB_API_KEY || localStorage.getItem('gtu_firebase_api_key') || "",
        authDomain: "gtumath-db.firebaseapp.com",
        projectId: "gtumath-db",
        databaseURL: "https://gtumath-db-default-rtdb.europe-west1.firebasedatabase.app"
    };

    // YETKİLİ YÖNETİCİ E-POSTALARI (Yalnızca tam eşleşen adresler yönetici olabilir)
    const ADMIN_EMAILS = [
        'carleman@gtu.edu.tr',
        'yasinturan@gtu.edu.tr'
    ];

    function initFirebaseApp() {
        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK henüz yüklenmedi.');
            return false;
        }
        if (!firebase.apps.length) {
            const key = FIREBASE_AUTH_CONFIG.apiKey;
            if (!key) return false;
            try {
                firebase.initializeApp(FIREBASE_AUTH_CONFIG);
                return true;
            } catch (err) {
                console.error('Firebase Auth başlatma hatası:', err);
                return false;
            }
        }
        return true;
    }

    async function handleGoogleLoginClick() {
        const btn = document.getElementById('btn-google-login');
        
        // Eğer Firebase API Key henüz tanımlanmamışsa
        if (!FIREBASE_AUTH_CONFIG.apiKey && (!firebase.apps || !firebase.apps.length)) {
            alert("ℹ️ Google ile Giriş entegrasyonu şu anda yapılandırma aşamasındadır.\n\nLütfen aşağıdaki 'Şifre ile Devam Et' alanından kişisel şifrenizle giriş yapınız.");
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span>⏳ Google ile bağlanılıyor...</span>`;
        }

        try {
            if (!initFirebaseApp()) {
                alert("Firebase Authentication başlatılamadı. Lütfen şifrenizle giriş yapınız.");
                return;
            }

            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({
                hd: 'gtu.edu.tr', // GTÜ kurumsal e-posta hesabını öncelikli önerir
                prompt: 'select_account'
            });

            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;
            const email = (user.email || '').toLowerCase().trim();

            // 1. Domain Kontrolü (@gtu.edu.tr zorunluluğu)
            if (!email.endsWith('@gtu.edu.tr')) {
                alert(`❌ Yetkisiz Hesap:\n\nSisteme yalnızca @gtu.edu.tr uzantılı kurumsal e-posta adresleri ile giriş yapılabilir.\nGiriş yapılan hesap: ${email}`);
                await firebase.auth().signOut();
                return;
            }

            // 2. DB Verilerini Sağlama Al
            if (typeof loadFromDataJSON === 'function' && (!DB || !DB.staff || DB.staff.length === 0)) {
                await loadFromDataJSON();
            }

            const staffList = (DB && DB.staff) ? DB.staff : [];
            const matchedStaff = staffList.find(s => s.email && s.email.toLowerCase().trim() === email);

            // 3. Yönetici / Koordinatör Girişi (Sadece kesin eşleşen yetkili adresler!)
            if (ADMIN_EMAILS.includes(email)) {
                sessionStorage.setItem('userEmail', email);
                sessionStorage.setItem('googleUser', JSON.stringify({ name: user.displayName, email: user.email }));
                if (typeof logAction === 'function') {
                    logAction('system', 'Google Girişi', `Yönetici (${email}) kurumsal Google hesabıyla giriş yaptı.`);
                }
                if (typeof window.finishLogin === 'function') {
                    await window.finishLogin(true, false);
                }
                if (typeof showToast === 'function') {
                    showToast(`👋 Hoş geldiniz, Yönetici (${user.displayName || email})`, 'success');
                }
                return;
            }

            // 4. Personel / Hoca Girişi
            if (matchedStaff) {
                localStorage.setItem('myStaffId', String(matchedStaff.id));
                sessionStorage.setItem('userEmail', email);
                sessionStorage.setItem('googleUser', JSON.stringify({ name: user.displayName, email: user.email }));
                if (typeof logAction === 'function') {
                    logAction('system', 'Google Girişi', `${matchedStaff.name} (${email}) kurumsal Google hesabıyla profiline bağlandı.`);
                }
                if (typeof window.finishLogin === 'function') {
                    await window.finishLogin(false, false);
                }
                if (typeof showToast === 'function') {
                    showToast(`👋 Hoş geldiniz, ${matchedStaff.name}`, 'success');
                }
                setTimeout(() => {
                    const btnProfile = document.getElementById('btn-profile');
                    if (btnProfile) btnProfile.click();
                    if (typeof renderProfile === 'function') renderProfile();
                }, 150);
                return;
            }

            // 5. Kurumsal e-posta doğru ama DB'de personel kaydı yoksa
            alert(`⚠️ E-posta adresiniz (${email}) doğrulandı fakat Matematik Bölümü gözetmen listesinde kayıtlı bir personel bulunamadı.\n\nLütfen bölüm koordinatörü ile iletişime geçiniz.`);
            await firebase.auth().signOut();

        } catch (err) {
            console.error("Google oturum açma hatası:", err);
            if (err.code === 'auth/popup-closed-by-user') {
                // Kullanıcı pencereyi bilerek kapattı
            } else if (err.code === 'auth/unauthorized-domain') {
                alert(`⚠️ Bu alan adı (${window.location.hostname}) Firebase Console'da yetkilendirilmemiş.\n\nLütfen Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized Domains bölümüne "${window.location.hostname}" adresini ekleyin.`);
            } else {
                alert(`Giriş yapılamadı: ${err.message || err}`);
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg><span>Google ile Giriş Yap (@gtu.edu.tr)</span>`;
            }
        }
    }

    // DOM Hazır Olduğunda Bağla
    function setupGoogleButton() {
        if (!window.ENABLE_GOOGLE_AUTH) {
            const btn = document.getElementById('btn-google-login');
            if (btn) btn.style.display = 'none';
            return;
        }
        const btn = document.getElementById('btn-google-login');
        if (btn) {
            btn.addEventListener('click', handleGoogleLoginClick);
        }
        initFirebaseApp();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupGoogleButton);
    } else {
        setupGoogleButton();
    }

    window.handleGoogleLoginClick = handleGoogleLoginClick;
    window.setFirebaseApiKey = function (key) {
        localStorage.setItem('gtu_firebase_api_key', key);
        FIREBASE_AUTH_CONFIG.apiKey = key;
        initFirebaseApp();
        console.log('Firebase API Key güncellendi.');
    };
})();
