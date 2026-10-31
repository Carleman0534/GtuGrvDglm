/**
 * =====================================================================
 *  GTU GÖZETMENLİK - GOOGLE OAUTH GİRİŞ MODÜLÜ (auth_google.js)
 * =====================================================================
 *  Yalnızca @gtu.edu.tr uzantılı kurumsal hesaplarla güvenli giriş sağlar.
 *  DB.staff tablosundaki e-postalarla eşleşen hocayı doğrudan kendi profiline alır.
 *
 *  ESKİ SİSTEME DÖNME / İPTAL GARANTİSİ:
 *  - Bu modül mevcut şifreli girişi (isim123 / admin) asla bozmaz; hibrit çalışır.
 *  - İstenildiği an window.ENABLE_GOOGLE_AUTH = false yapılarak veya bu script
 *    kaldırılarak 1 saniyede tamamen eski şifreli sisteme dönülebilir.
 * =====================================================================
 */

(function () {
    'use strict';

    // Açma / Kapama Anahtarı (İstenildiğinde false yapılarak devre dışı bırakılabilir)
    window.ENABLE_GOOGLE_AUTH = true;

    // Firebase Auth Konfigürasyonu
    const FIREBASE_AUTH_CONFIG = {
        apiKey: localStorage.getItem('gtu_firebase_api_key') || window.FIREBASE_WEB_API_KEY || "",
        authDomain: "gtumath-db-default.firebaseapp.com",
        projectId: "gtumath-db-default",
        databaseURL: "https://gtumath-db-default-rtdb.europe-west1.firebasedatabase.app"
    };

    // Tanımlı Yönetici / Koordinatör E-postaları
    const ADMIN_EMAILS = [
        'carleman@gtu.edu.tr',
        'admin@gtu.edu.tr',
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

    function showApiKeyModal(onSuccess) {
        let modal = document.getElementById('modal-google-auth-setup');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-google-auth-setup';
            modal.className = 'modal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); display:flex; align-items:center; justify-content:center; z-index:99999;';
            modal.innerHTML = `
                <div style="background:var(--bg-card, #1e293b); border:1px solid var(--primary, #6366f1); border-radius:16px; padding:2rem; max-width:480px; width:90%; color:white; box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h3 style="margin:0; font-size:1.2rem; display:flex; align-items:center; gap:8px;">
                            <span>🔐</span> Google ile Giriş Kurulumu
                        </h3>
                        <button id="btn-close-google-setup" style="background:none; border:none; color:#94a3b8; font-size:1.5rem; cursor:pointer;">&times;</button>
                    </div>
                    <p style="font-size:0.85rem; color:#cbd5e1; line-height:1.5; margin-bottom:1rem;">
                        Google ile Giriş özelliğinin çalışabilmesi için Firebase projenizin <strong>Web API Anahtarı</strong> gereklidir:
                    </p>
                    <ol style="font-size:0.8rem; color:#94a3b8; line-height:1.6; margin-bottom:1.25rem; padding-left:1.2rem;">
                        <li><strong><a href="https://console.firebase.google.com" target="_blank" style="color:#38bdf8;">Firebase Console</a></strong> &rarr; Proje Ayarları (Çark simgesi) &rarr; Genel sekmesine gidin.</li>
                        <li><strong>"Web API Anahtarı"</strong>nı kopyalayıp aşağıdaki alana yapıştırın.</li>
                        <li><em>(Not: Authentication &rarr; Sign-in method &rarr; Google'ın etkin olduğundan emin olun.)</em></li>
                    </ol>
                    <input type="text" id="input-firebase-api-key" placeholder="AIzaSy..." style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid #334155; background:rgba(0,0,0,0.3); color:white; font-size:0.9rem; margin-bottom:1rem; box-sizing:border-box;">
                    <div style="display:flex; justify-content:flex-end; gap:10px;">
                        <button id="btn-cancel-google-setup" class="btn-secondary" style="padding:0.6rem 1rem;">Vazgeç</button>
                        <button id="btn-save-google-setup" class="btn-primary" style="padding:0.6rem 1.25rem; background:#10b981;">Kaydet ve Giriş Yap</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('btn-close-google-setup').onclick = () => modal.remove();
            document.getElementById('btn-cancel-google-setup').onclick = () => modal.remove();
            document.getElementById('btn-save-google-setup').onclick = () => {
                const keyVal = document.getElementById('input-firebase-api-key').value.trim();
                if (!keyVal) {
                    alert('Lütfen geçerli bir Web API Anahtarı girin!');
                    return;
                }
                localStorage.setItem('gtu_firebase_api_key', keyVal);
                FIREBASE_AUTH_CONFIG.apiKey = keyVal;
                modal.remove();
                if (initFirebaseApp() && typeof onSuccess === 'function') {
                    onSuccess();
                }
            };
        }
    }

    async function handleGoogleLoginClick() {
        const btn = document.getElementById('btn-google-login');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span>⏳ Google ile bağlanılıyor...</span>`;
        }

        const proceedLogin = async () => {
            try {
                if (!initFirebaseApp()) {
                    showApiKeyModal(handleGoogleLoginClick);
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg><span>Google ile Giriş Yap (@gtu.edu.tr)</span>`;
                    }
                    return;
                }

                const provider = new firebase.auth.GoogleAuthProvider();
                provider.setCustomParameters({
                    hd: 'gtu.edu.tr' // Google Workspace kullanıcılarına GTÜ hesabını öncelikli önerir
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

                // 3. Yönetici / Koordinatör Girişi
                if (ADMIN_EMAILS.includes(email) || email.startsWith('carleman') || email.startsWith('admin')) {
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
                    // Kullanıcı pencereyi bilerek kapattı, hata basmaya gerek yok
                } else if (err.code === 'auth/api-key-not-valid' || err.code === 'auth/invalid-api-key') {
                    alert('Firebase Web API Anahtarı geçersiz görünüyor. Lütfen anahtarınızı kontrol edin.');
                    localStorage.removeItem('gtu_firebase_api_key');
                    showApiKeyModal(handleGoogleLoginClick);
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
        };

        if (!FIREBASE_AUTH_CONFIG.apiKey) {
            showApiKeyModal(proceedLogin);
        } else {
            await proceedLogin();
        }
    }

    // DOM Hazır Olduğunda Bağla
    function setupGoogleButton() {
        if (!window.ENABLE_GOOGLE_AUTH) return;
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

    // Global erişim
    window.handleGoogleLoginClick = handleGoogleLoginClick;
    window.setFirebaseApiKey = function (key) {
        localStorage.setItem('gtu_firebase_api_key', key);
        FIREBASE_AUTH_CONFIG.apiKey = key;
        initFirebaseApp();
        console.log('Firebase API Key kaydedildi.');
    };
})();
