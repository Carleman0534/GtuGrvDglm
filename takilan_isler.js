/**
 * 🧭 TAKILAN İŞLER (yönetici, Ana Sayfa)
 *
 * Uzun süredir bekleyen işleri tek kutuda toplar; her satırda "📱 Hatırlat" (ilgili kişilerin
 * telefonuna ve site bildirimine hedefli duyuru, kişi + iş başına günde bir) ya da "Aç" vardır:
 *   - 24 saattir yanıtlanmayan takas / devir teklifleri (kimin onayı bekleniyor)
 *   - onay bekleyen gözetmen sınav bildirimleri
 *   - bitişinden 24 saat sonra hâlâ süresi onaylanmamış sınavlar (hangi gözetmenler)
 *   - 24 saattir "Tamam, gördüm" denmemiş görev uyarıları (görev iptali, devir vb.)
 * Hesap (takilanIsler) yan etkisizdir; Node testlerinde de kullanılır.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.TakilanIsler = Object.assign(root.TakilanIsler || {}, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const SAAT = 3600000;
    const ESIK = { TAKAS_MS: 24 * SAAT, SURE_MS: 24 * SAAT, UYARI_MS: 24 * SAAT };
    const S = (v) => String(v);
    const dizi = (x) => (Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : [])).filter(Boolean);
    const sureMetni = (ms) => ms >= 48 * SAAT ? `${Math.floor(ms / (24 * SAAT))} gündür` : `${Math.max(1, Math.floor(ms / SAAT))} saattir`;
    const kisaTarih = (ex) => ex ? `${String(ex.date || '').split('-').reverse().slice(0, 2).join('.')} ${ex.time || ''}`.trim() : '';

    /**
     * @param db  veritabanı
     * @param now epoch ms
     * @param K   BildirimKurallari
     * @returns [{ tur: 'takas'|'bildirim'|'sure'|'uyari', anahtar, metin, ayrinti, pids: [..], yasMs, hatirlatma: {baslik, mesaj} | null }]
     */
    function takilanIsler(db, now, K) {
        const out = [];
        if (!db || !K) return out;
        const ad = (id) => ((dizi(db.staff).find(s => S(s.id) === S(id)) || {}).name) || `#${id}`;

        // 1) Takas / devir teklifleri (kişi bazlı kayıtlar teklif başına birleştirilir)
        const teklifler = new Map();
        (K.takasBekleyenleri ? K.takasBekleyenleri(db, now) : []).forEach(b => {
            const k = S(b.r.id);
            if (!teklifler.has(k)) teklifler.set(k, { r: b.r, b, pids: [] });
            teklifler.get(k).pids.push(b.pid);
        });
        teklifler.forEach(({ r, b, pids }) => {
            const yas = now - b.olusturmaMs;
            if (yas < ESIK.TAKAS_MS) return;
            const sinavlar = [b.verilecek, b.alinacak].filter(Boolean).map(e => `${e.name} (${kisaTarih(e)})`).join(' ⇄ ');
            const tipAdi = { adalet_takas: 'Adalet takası', adalet_devir: 'Adalet görev devri', dogrudan: 'Takas', akilli: 'Akıllı takas', pazar_devir: 'Pazar yeri devri' }[b.tip] || 'Takas';
            out.push({
                tur: 'takas', anahtar: `takas_${r.id}`, yasMs: yas, pids,
                metin: `${tipAdi}: ${sinavlar} — ${sureMetni(yas)} yanıtsız`,
                ayrinti: `Onayı beklenen: ${pids.map(ad).join(', ')}`,
                hatirlatma: { baslik: '⏳ Takas teklifi onayınızı bekliyor', mesaj: `${tipAdi} teklifi (${sinavlar}) onayınızı bekliyor. Siteyi açtığınızda çıkan pencereden onaylayın ya da reddedin.` }
            });
        });

        // 2) Gözetmen sınav bildirimleri (yönetici onayı bekliyor)
        dizi(db.examSubmissions).filter(k => k.status === 'pending').forEach(k => {
            const yas = now - (Date.parse(k.createdAt) || now);
            out.push({
                tur: 'bildirim', anahtar: `bildirim_${k.id}`, yasMs: yas, pids: [],
                metin: `${k.staffName}: "${k.name}" (${kisaTarih(k)}) sınav bildirimi onayınızı bekliyor`,
                ayrinti: `${sureMetni(yas)} bekliyor`, hatirlatma: null
            });
        });

        // 3) Süresi onaylanmamış bitmiş sınavlar (bitişinden 24 saat sonra)
        dizi(db.exams).forEach(ex => {
            if (!K.sureTeyidiBekliyor || !K.sureTeyidiBekliyor(ex, now)) return;
            const bitis = K.sinavBitis(ex);
            if (isNaN(bitis) || now - bitis < ESIK.SURE_MS) return;
            const pids = K.gozetmenler(ex).filter(pid => K.sureTeyidiBekliyor(ex, now, pid));
            if (!pids.length) return;
            out.push({
                tur: 'sure', anahtar: `sure_${ex.id}`, yasMs: now - bitis, pids,
                metin: `"${ex.name}" (${kisaTarih(ex)}) süresi onaylanmadı — ${sureMetni(now - bitis)}`,
                ayrinti: `Onayı beklenen: ${pids.map(ad).join(', ')}`,
                hatirlatma: { baslik: '⏱️ Sınav sürenizi onaylayın', mesaj: `"${ex.name}" (${kisaTarih(ex)}) sınavının başlangıç saatini ve süresini onaylamanız bekleniyor. Siteye girince çıkan pencereden onaylayabilirsiniz.` }
            });
        });

        // 4) Görülmemiş görev uyarıları
        dizi(db.gorevUyarilari).filter(u => !u.okundu).forEach(u => {
            const yas = now - (Date.parse(u.createdAt) || now);
            if (yas < ESIK.UYARI_MS) return;
            out.push({
                tur: 'uyari', anahtar: `uyari_${u.id}`, yasMs: yas, pids: [S(u.pid)],
                metin: `${ad(u.pid)} "${u.baslik}" uyarısını ${sureMetni(yas)} görmedi`,
                ayrinti: u.metin || '',
                hatirlatma: { baslik: '🔔 Görevinizde değişiklik var', mesaj: `${u.baslik}: ${u.metin || ''} Siteye girip "Tamam, gördüm" deyin.`.slice(0, 300) }
            });
        });

        const sira = { takas: 0, uyari: 1, bildirim: 2, sure: 3 };
        return out.sort((a, b) => sira[a.tur] - sira[b.tur] || b.yasMs - a.yasMs);
    }

    /** Bugün bu iş için hatırlatma gönderildi mi? (duyuru kimliği iş + gün başına sabittir) */
    const gunAnahtari = (now) => new Date(now + 3 * SAAT).toISOString().slice(0, 10);
    const hatirlatmaKimligi = (is, now) => `bc_hatirlat_${is.anahtar}_${gunAnahtari(now)}`;
    function bugunHatirlatildiMi(db, is, now) {
        const id = hatirlatmaKimligi(is, now);
        return dizi(db && db.adminBroadcasts).some(b => b.id === id);
    }
    /** Hatırlatmayı hedefli duyuru olarak ekler (telefona da gider). Eklenirse duyuruyu döndürür. */
    function hatirlat(db, is, now) {
        if (!is || !is.hatirlatma || !is.pids.length || bugunHatirlatildiMi(db, is, now)) return null;
        if (!Array.isArray(db.adminBroadcasts)) db.adminBroadcasts = dizi(db.adminBroadcasts);
        const bc = {
            id: hatirlatmaKimligi(is, now), title: is.hatirlatma.baslik, message: is.hatirlatma.mesaj, priority: 'normal',
            target: is.pids.map(S), pushToDevice: true, senderName: 'Yönetici', senderRole: 'admin', kaynak: 'takilan_is_hatirlatma',
            createdAt: new Date(now).toISOString(), timestamp: now
        };
        db.adminBroadcasts.unshift(bc);
        return bc;
    }

    return { takilanIsler, hatirlat, bugunHatirlatildiMi, ESIK };
});

// ================================================================== Arayüz (yalnızca tarayıcı)
(function () {
    'use strict';
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const T = window.TakilanIsler;
    const getDB = () => (typeof DB !== 'undefined' ? DB : window.DB);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const isAdmin = () => { try { return sessionStorage.getItem('isAdmin') === 'true'; } catch (e) { return false; } };
    const BOLUM = { takas: '🔄 Yanıtlanmayan takas / devir teklifleri', uyari: '🔔 Görülmemiş görev uyarıları', bildirim: '📝 Onay bekleyen sınav bildirimleri', sure: '⏱️ Süresi onaylanmamış sınavlar' };
    let sonListe = [];

    function kart() {
        let c = document.getElementById('card-takilan-isler');
        if (c) return c;
        const host = document.getElementById('dashboard-export-container');
        if (!host) return null;
        c = document.createElement('div');
        c.id = 'card-takilan-isler';
        c.className = 'card card-large admin-only hidden';
        host.insertBefore(c, host.firstChild);
        return c;
    }

    function render() {
        const c = kart();
        if (!c) return;
        const db = getDB();
        sonListe = isAdmin() && db && window.BildirimKurallari ? T.takilanIsler(db, Date.now(), window.BildirimKurallari) : [];
        c.classList.toggle('hidden', !sonListe.length);
        if (!sonListe.length) { c.innerHTML = ''; return; }
        const now = Date.now();
        let html = `<h3 class="ti-baslik">🧭 Takılan işler <span class="ti-sayi">${sonListe.length}</span></h3>
            <p class="ti-not">Uzun süredir bekleyen işler. "📱 Hatırlat" ilgili kişilerin telefonuna ve site bildirimine gider (iş başına günde bir kez).</p>`;
        Object.keys(BOLUM).forEach(tur => {
            const list = sonListe.filter(x => x.tur === tur);
            if (!list.length) return;
            html += `<div class="ti-bolum">${BOLUM[tur]} <span>(${list.length})</span></div>` + list.map((x, i) => {
                const idx = sonListe.indexOf(x);
                const hatir = x.hatirlatma ? (T.bugunHatirlatildiMi(db, x, now)
                    ? `<span class="ti-gonderildi">✓ Bugün hatırlatıldı</span>`
                    : `<button type="button" class="ti-btn" onclick="TakilanIsler.hatirlatUI(${idx})">📱 Hatırlat</button>`)
                    : `<button type="button" class="ti-btn" onclick="TakilanIsler.acUI('${esc(x.tur)}')">Aç</button>`;
                return `<div class="ti-satir"><div><div class="ti-metin">${esc(x.metin)}</div>${x.ayrinti ? `<div class="ti-ayrinti">${esc(x.ayrinti)}</div>` : ''}</div><div class="ti-sag">${hatir}</div></div>`;
            }).join('');
        });
        c.innerHTML = html;
    }

    function hatirlatUI(idx) {
        const is = sonListe[idx];
        if (!is) return;
        const db = getDB();
        const bc = T.hatirlat(db, is, Date.now());
        if (bc) {
            window._hasLocalEdits = true; db.lastUpdated = new Date().toISOString();
            if (typeof logAction === 'function') logAction('admin', 'Takılan İş Hatırlatması', `${is.metin} → ${is.pids.length} kişiye hatırlatma`);
            if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
            if (typeof window.showToast === 'function') window.showToast(`📱 ${is.pids.length} kişiye hatırlatma gönderildi.`, 'success');
        }
        render();
    }
    function acUI(tur) {
        if (tur === 'bildirim') {
            const el = document.getElementById('card-sinav-bildirim-admin');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    window.TakilanIsler.render = render;
    window.TakilanIsler.hatirlatUI = hatirlatUI;
    window.TakilanIsler.acUI = acUI;

    function init() {
        const orig = window.renderDashboard;
        if (typeof orig === 'function' && !orig.__ti) {
            const w = function () { try { return orig.apply(this, arguments); } finally { try { render(); } catch (e) { /* kutu isteğe bağlı */ } } };
            w.__ti = true;
            Object.keys(orig).forEach(k => { w[k] = orig[k]; });
            window.renderDashboard = w;
        }
        render();
        setInterval(() => { try { if (isAdmin() && !document.hidden) render(); } catch (e) { /* yok say */ } }, 60000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
    else setTimeout(init, 0);
})();
