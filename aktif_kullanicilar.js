/**
 * 👥 Kim çevrimiçi? (yönetici için)
 *
 * Giriş yapmış her açık sekme dakikada bir küçük bir "buradayım" kaydı yazar:
 *   DB yolu: gizli_yol_gtu_admin_data/aktifOturumlar/{oturumKimliği}
 *   { ad, staffId, rol, sayfa, cihaz, gorunur, ilk, son }   (son = sunucu saati)
 * Kayıt doğrudan bu alt yola yazılır; ana veri kaydı (veri_koruma.js) bu alanı yalnızca taşır,
 * periyodik eşitleme de yalnızca bu alan değiştiğinde ekranı yenilemez.
 *
 * Yönetici üst menüdeki "🟢 Aktif" düğmesinden kimin şu an sitede olduğunu, kimin sekmesinin
 * arka planda açık kaldığını ve son 24 saatte kimlerin girdiğini görür. 24 saatten eski kayıtları
 * yöneticinin penceresi temizler.
 */
(function () {
    'use strict';

    // Veritabanı adresi logic.js'teki ortak ayardan (API_BASE_URL) alınır
    const API = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : 'https://gtumath-db-default-rtdb.europe-west1.firebasedatabase.app';
    const BASE = `${API}/gizli_yol_gtu_admin_data/aktifOturumlar`;
    const HEARTBEAT_MS = 60 * 1000;          // açık ve görünür sekmede dakikada bir
    const AKTIF_MS = 3 * 60 * 1000;          // son 3 dakikada görünür sekmeden sinyal → şu an aktif
    const BOSTA_MS = 15 * 60 * 1000;         // 15 dakikaya kadar → açık ama arka planda / boşta
    const SAKLA_MS = 24 * 60 * 60 * 1000;    // 24 saatten eski kayıtlar silinir

    const S = (v) => String(v);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const isLoggedIn = () => sessionStorage.getItem('isLoggedIn') === 'true' || localStorage.getItem('isLoggedIn') === 'true';
    const isAdmin = () => sessionStorage.getItem('isAdmin') === 'true' || localStorage.getItem('isAdmin') === 'true';
    const isLecturer = () => sessionStorage.getItem('isLecturer') === 'true' || localStorage.getItem('isLecturer') === 'true';

    // Bu sekmenin oturum kimliği (cihaz başına kalıcı; Firebase anahtarında geçersiz karakter yok)
    function oturumKimligi() {
        let id = null;
        try { id = localStorage.getItem('gtu_oturum_kimligi'); } catch (e) {}
        if (!id || !/^[a-z0-9]{8,40}$/.test(id)) {
            id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toLowerCase();
            try { localStorage.setItem('gtu_oturum_kimligi', id); } catch (e) {}
        }
        return id;
    }

    const NAV_IDS = ['btn-dashboard', 'btn-schedule', 'btn-exams', 'btn-staff', 'btn-availability', 'btn-requests',
        'btn-profile', 'btn-announcements', 'btn-timeline'];
    function aktifSayfa() {
        for (const id of NAV_IDS) {
            const b = document.getElementById(id);
            if (b && b.classList.contains('active')) return (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        }
        const mob = document.querySelector('.mobile-tab.active, .mobile-nav-item.active, [data-mobile-tab].active');
        return mob ? (mob.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    }

    function cihaz() {
        const ua = navigator.userAgent || '';
        const tur = /iPhone|iPad|iPod/i.test(ua) ? 'iPhone/iPad' : /Android/i.test(ua) ? 'Android' : /Mobi/i.test(ua) ? 'Telefon' : 'Bilgisayar';
        const uygulama = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
        return tur + (uygulama ? ' · uygulama' : '');
    }

    function kimlik() {
        const db = window.DB || {};
        const staffId = typeof getDeviceStaffId === 'function' ? getDeviceStaffId() : null;
        const staff = staffId != null ? (db.staff || []).find(s => s && S(s.id) === S(staffId)) : null;
        if (isAdmin()) {
            return { rol: 'yonetici', staffId: staff ? staff.id : null, ad: staff ? staff.name : (sessionStorage.getItem('userEmail') || 'Yönetici') };
        }
        if (isLecturer()) {
            let ad = '';
            try { ad = localStorage.getItem('myLecturerName') || ''; } catch (e) {}
            return { rol: 'hoca', staffId: null, ad: ad || 'Ders sorumlusu' };
        }
        return { rol: 'gozetmen', staffId: staff ? staff.id : null, ad: staff ? staff.name : 'Gözetmen (profil seçilmemiş)' };
    }

    const ilkGiris = (() => {
        let t = null;
        try { t = parseInt(sessionStorage.getItem('gtu_oturum_ilk') || '', 10); } catch (e) {}
        if (!t) { t = Date.now(); try { sessionStorage.setItem('gtu_oturum_ilk', String(t)); } catch (e) {} }
        return t;
    })();

    let sonGonderim = 0;
    async function sinyalGonder(zorla) {
        if (!isLoggedIn()) return;
        // Görünür olmayan sekme dakikada bir yazmaz; yalnızca görünürlük değişince bir kez yazar
        if (!zorla && document.hidden) return;
        if (!zorla && Date.now() - sonGonderim < HEARTBEAT_MS - 5000) return;
        sonGonderim = Date.now();
        const k = kimlik();
        const kayit = {
            ad: String(k.ad || '').slice(0, 80),
            staffId: k.staffId != null ? k.staffId : null,
            rol: k.rol,
            sayfa: aktifSayfa(),
            cihaz: cihaz(),
            gorunur: !document.hidden,
            ilk: ilkGiris,
            son: { '.sv': 'timestamp' }
        };
        try {
            await fetch(`${BASE}/${oturumKimligi()}.json`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kayit), keepalive: true
            });
        } catch (e) { /* çevrimdışı: bir sonraki sinyalde yeniden denenir */ }
    }

    function sinyalBaslat() {
        setTimeout(() => sinyalGonder(true), 4000);        // girişten / açılıştan hemen sonra
        setInterval(() => sinyalGonder(false), 15 * 1000); // görünürken dakikada bir yazar (15 sn'de bir kontrol)
        document.addEventListener('visibilitychange', () => sinyalGonder(true));
        window.addEventListener('pagehide', () => {
            if (!isLoggedIn()) return;
            try {
                fetch(`${BASE}/${oturumKimligi()}.json`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gorunur: false, son: { '.sv': 'timestamp' } }), keepalive: true
                });
            } catch (e) {}
        });
        // Çıkış yapınca kayıt silinir (yönetici listede "çıktı" görür)
        const eskiCikis = window.logoutUser;
        if (typeof eskiCikis === 'function' && !eskiCikis.__oturumKaydi) {
            const sar = function () {
                try { fetch(`${BASE}/${oturumKimligi()}.json`, { method: 'DELETE', keepalive: true }); } catch (e) {}
                return eskiCikis.apply(this, arguments);
            };
            sar.__oturumKaydi = true;
            window.logoutUser = sar;
        }
    }

    // ---------------- Yönetici görünümü ----------------
    async function kayitlariGetir() {
        const res = await fetch(`${BASE}.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = (await res.json()) || {};
        // Sunucu saati (cihaz saati yanlış olabilir): yanıttaki Date başlığı
        const tarihBasligi = Date.parse(res.headers.get('date') || '');
        const simdi = isNaN(tarihBasligi) ? Date.now() : Math.max(tarihBasligi, Date.now() - 60000);
        return { data, simdi };
    }

    function grupla(data, simdi) {
        const liste = Object.entries(data || {})
            .filter(([, v]) => v && typeof v === 'object' && typeof v.son === 'number')
            .map(([id, v]) => Object.assign({ id, gecen: simdi - v.son }, v));
        const aktif = liste.filter(x => x.gorunur !== false && x.gecen <= AKTIF_MS);
        const bosta = liste.filter(x => !aktif.includes(x) && x.gecen <= BOSTA_MS);
        const bugun = liste.filter(x => !aktif.includes(x) && !bosta.includes(x) && x.gecen <= SAKLA_MS);
        const eski = liste.filter(x => x.gecen > SAKLA_MS).map(x => x.id);
        const sirala = (a, b) => a.gecen - b.gecen;
        return { aktif: aktif.sort(sirala), bosta: bosta.sort(sirala), bugun: bugun.sort(sirala), eski };
    }

    async function eskileriTemizle(ids) {
        if (!ids.length || !isAdmin()) return;
        const yama = {};
        ids.forEach(id => { yama[id] = null; });
        try { await fetch(`${BASE}.json`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(yama) }); } catch (e) {}
    }

    const ROL = { yonetici: '👑 Yönetici', gozetmen: '👤 Gözetmen', hoca: '🎓 Hoca' };
    function sureMetni(ms) {
        const dk = Math.max(0, Math.round(ms / 60000));
        if (dk < 1) return 'şimdi';
        if (dk < 60) return `${dk} dk önce`;
        const sa = Math.floor(dk / 60);
        return `${sa} sa ${dk % 60 ? (dk % 60) + ' dk ' : ''}önce`;
    }
    function satir(x, simdi) {
        const sure = x.ilk ? Math.max(0, Math.round((simdi - x.ilk) / 60000)) : null;
        return `<div class="aktif-kullanici-satir">
            <div class="aktif-kullanici-ad"><strong>${esc(x.ad || 'Bilinmiyor')}</strong> <span class="aktif-kullanici-rol">${esc(ROL[x.rol] || x.rol || '')}</span></div>
            <div class="aktif-kullanici-detay">
                ${x.cihaz ? `<span>📱 ${esc(x.cihaz)}</span>` : ''}
                ${x.sayfa ? `<span>📄 ${esc(x.sayfa)}</span>` : ''}
                <span>🕒 ${esc(sureMetni(x.gecen))}</span>
                ${sure != null && sure > 0 && x.gecen <= AKTIF_MS ? `<span>⏱️ ${sure < 60 ? sure + ' dk' : Math.floor(sure / 60) + ' sa ' + (sure % 60) + ' dk'} süredir açık</span>` : ''}
            </div>
        </div>`;
    }
    function bolum(baslik, aciklama, liste, simdi) {
        return `<div class="aktif-kullanici-bolum">
            <div class="aktif-kullanici-baslik">${baslik} <span class="aktif-kullanici-sayi">${liste.length}</span></div>
            <div class="aktif-kullanici-aciklama">${aciklama}</div>
            ${liste.length ? liste.map(x => satir(x, simdi)).join('') : '<div class="aktif-kullanici-bos">Kimse yok</div>'}
        </div>`;
    }

    async function pencereyiDoldur() {
        const govde = document.querySelector('#modal-aktif-kullanicilar .aktif-kullanici-govde');
        if (!govde) return;
        try {
            const { data, simdi } = await kayitlariGetir();
            const g = grupla(data, simdi);
            eskileriTemizle(g.eski);
            sayaciGuncelle(g.aktif.length);
            govde.innerHTML =
                bolum('🟢 Şu an sitede', 'Son 3 dakikada siteyi açık ve önünde tutanlar.', g.aktif, simdi) +
                bolum('🟡 Açık ama arka planda', 'Sekmesi açık ama başka bir şeye geçmiş ya da 3–15 dakikadır hareketsiz olanlar.', g.bosta, simdi) +
                bolum('⚪ Son 24 saatte girenler', 'Bugün siteye girip çıkmış olanlar (son görülme zamanıyla).', g.bugun, simdi) +
                `<div class="aktif-kullanici-not">Liste 20 saniyede bir kendiliğinden yenilenir. Yalnızca giriş yapmış kullanıcılar görünür.</div>`;
        } catch (e) {
            govde.innerHTML = `<p style="color:#ef4444;">Liste alınamadı: ${esc(e.message)}</p>`;
        }
    }

    let yenileZamanlayici = null;
    window.openAktifKullanicilar = function () {
        let modal = document.getElementById('modal-aktif-kullanicilar');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-aktif-kullanicilar';
            modal.className = 'modal hidden';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 560px;">
                    <div class="modal-header">
                        <h3>👥 Kimler sitede?</h3>
                        <button class="close-modal" type="button" onclick="closeAktifKullanicilar()">&times;</button>
                    </div>
                    <div class="modal-body aktif-kullanici-govde"><p>Yükleniyor…</p></div>
                </div>`;
            modal.addEventListener('click', (e) => { if (e.target === modal) window.closeAktifKullanicilar(); });
            document.body.appendChild(modal);
        }
        modal.classList.remove('hidden');
        sinyalGonder(true);
        pencereyiDoldur();
        clearInterval(yenileZamanlayici);
        yenileZamanlayici = setInterval(pencereyiDoldur, 20 * 1000);
    };
    window.closeAktifKullanicilar = function () {
        const modal = document.getElementById('modal-aktif-kullanicilar');
        if (modal) modal.classList.add('hidden');
        clearInterval(yenileZamanlayici);
    };

    function sayaciGuncelle(n) {
        const el = document.getElementById('aktif-kullanici-sayac');
        if (el) el.textContent = String(n);
    }
    async function sayaciYenile() {
        if (!isAdmin() || document.hidden) return;
        try {
            const { data, simdi } = await kayitlariGetir();
            sayaciGuncelle(grupla(data, simdi).aktif.length);
        } catch (e) {}
    }

    function baslat() {
        sinyalBaslat();
        setTimeout(sayaciYenile, 6000);
        setInterval(sayaciYenile, 60 * 1000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
    else baslat();

    // Test için
    window.AktifKullanicilar = { grupla, sinyalGonder, oturumKimligi, AKTIF_MS, BOSTA_MS, SAKLA_MS };
})();
