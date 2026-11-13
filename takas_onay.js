/**
 * 🔄 TAKAS ONAYI KOLAYLIĞI
 *
 * Onayı beklenen takas / devir tekliflerini (adalet önerileri, doğrudan ve akıllı takaslar, pazar yeri devirleri)
 * kişinin önüne getirir:
 *   1) Site açılınca (ya da bildirime dokununca) tek dokunuşla onay penceresi: ✅ Onayla · ❌ Reddet · Sonra.
 *      "Sonra" denirse aynı teklif bu cihazda 4 saat sorulmaz.
 *   2) Profilim › Takas › Taleplerim'in en üstünde "Onayınızı bekleyen teklifler" listesi.
 * Hangi tekliflerin beklediği BildirimKurallari.takasBekleyenleri ile hesaplanır (telefon hatırlatmalarıyla ortak).
 * Onay / ret mevcut işlevlerle yapılır (doğrulama ve kayıt kuralları değişmez).
 */
(function () {
    'use strict';

    const S = (v) => String(v);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const getDB = () => (typeof DB !== 'undefined' ? DB : window.DB);
    const SONRA_MS = 4 * 60 * 60 * 1000;
    const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* özel mod */ } };
    const tarih = (d) => (typeof formatTarih === 'function' ? formatTarih(d) : d);

    /** Bu cihazın kişisi (yönetici oturumunda cihaz kimliği yoksa kimse) */
    function benimId() {
        if (typeof getDeviceStaffId === 'function') { const id = getDeviceStaffId(); if (id) return S(id); }
        return null;
    }
    function bekleyenler(pid) {
        const K = window.BildirimKurallari;
        if (!K || typeof K.takasBekleyenleri !== 'function' || pid == null) return [];
        return K.takasBekleyenleri(getDB(), Date.now()).filter(b => b.pid === S(pid));
    }

    const sinavSatiri = (ex, renk) => ex
        ? `<b style="color:${renk}">${esc(ex.name)}</b> <span class="to-alt">${esc(tarih(ex.date))} ${esc(ex.time || '')}${ex.location ? ' · ' + esc(ex.location) : ''}</span>`
        : '—';
    const BASLIK = {
        adalet_takas: '⚖️ Adalet sistemi önerisi: karşılıklı takas',
        adalet_devir: '➡️ Görev devri önerisi',
        dogrudan: '🔄 Takas teklifi',
        akilli: '🤖 Akıllı takas teklifi',
        pazar_devir: '🛒 Pazar yeri: görevinizi almak isteyen var'
    };
    function aciklama(b) {
        if (b.tip === 'adalet_devir') return `<b>${esc(b.karsiAd)}</b>, puan dengesi için bu görevi size devretmek istiyor.`;
        if (b.tip === 'pazar_devir') return `<b>${esc(b.karsiAd)}</b> pazar yerine bıraktığınız görevi almak istiyor. Onaylarsanız görev ona geçer.`;
        if (b.tip === 'adalet_takas') return `<b>${esc(b.karsiAd)}</b> ile karşılıklı görev takası önerildi.${b.karsiOnayladi ? ' <span class="to-onayli">✓ Karşı taraf onayladı; yalnızca sizin onayınız bekleniyor.</span>' : ' İki tarafın da onayı gerekir.'}`;
        return `<b>${esc(b.karsiAd)}</b> sizinle görev takası yapmak istiyor.`;
    }
    function kalanMetni(b) {
        const sa = Math.max(0, Math.round((b.ilkSinavMs - Date.now()) / 3600000));
        return sa < 48 ? `⏰ İlk sınava ${sa} saat kaldı` : `⏰ İlk sınava ${Math.round(sa / 24)} gün kaldı`;
    }
    function kartHtml(b, yer) {
        const id = esc(b.r.id);
        return `<div class="to-kart" data-id="${id}">
            <div class="to-tur">${BASLIK[b.tip] || '🔄 Takas teklifi'}</div>
            <div class="to-aciklama">${aciklama(b)}</div>
            <div class="to-sinavlar">
                ${b.verilecek ? `<div>📤 Vereceğiniz: ${sinavSatiri(b.verilecek, '#f87171')}</div>` : ''}
                ${b.alinacak ? `<div>📥 Alacağınız: ${sinavSatiri(b.alinacak, '#4ade80')}</div>` : ''}
            </div>
            <div class="to-alt">${kalanMetni(b)}</div>
            <div class="to-eylem">
                <button type="button" class="btn-primary to-onayla" onclick="TakasOnay.onayla('${id}', '${yer}')">✅ Onayla</button>
                <button type="button" class="btn-delete to-reddet" onclick="TakasOnay.reddet('${id}', '${yer}')">❌ Reddet</button>
                ${yer === 'pencere' ? `<button type="button" class="to-sonra" onclick="TakasOnay.sonra('${id}')">Sonra</button>` : ''}
            </div>
        </div>`;
    }

    // ---------------------------------------------------------------- işlemler (mevcut işlevlere yönlendirir)
    async function islem(id, kabul) {
        const pid = benimId();
        const b = bekleyenler(pid).find(x => S(x.r.id) === S(id));
        if (!b) { kapatVeYenile(); return; }
        const rid = b.r.id;
        const fn = {
            adalet_takas: kabul ? () => window.acceptP2PFairnessSwap(rid, pid) : () => window.rejectP2PFairnessSwap(rid, pid),
            adalet_devir: kabul ? () => window.acceptP2PFairnessSwap(rid, pid) : () => window.rejectP2PFairnessSwap(rid, pid),
            dogrudan: kabul ? () => window.acceptDirectSwap(rid) : () => window.rejectDirectSwap(rid),
            akilli: kabul ? () => window.acceptSmartSwap(rid) : () => window.rejectSmartSwap(rid),
            pazar_devir: kabul ? () => window.confirmOpenRequest(rid) : () => window.rejectOpenRequest(rid)
        }[b.tip];
        try { if (fn) await fn(); } catch (e) { console.warn('[TakasOnay]', e); }
        kapatVeYenile();
    }
    function kapatVeYenile() {
        setTimeout(() => {
            renderListe();
            const kalan = bekleyenler(benimId()).filter(b => !ertelendiMi(b));
            if (kalan.length && pencereAcik()) pencereGoster(kalan); else pencereKapat();
        }, 300);
    }
    const sonraAnahtari = (id, pid) => `takas_sonra_${id}_${pid}`;
    function ertelendiMi(b) { const t = parseInt(lsGet(sonraAnahtari(b.r.id, b.pid)), 10); return t > 0 && Date.now() - t < SONRA_MS; }
    function sonra(id) {
        const pid = benimId();
        lsSet(sonraAnahtari(id, pid), String(Date.now()));
        const kalan = bekleyenler(pid).filter(b => !ertelendiMi(b));
        if (kalan.length) pencereGoster(kalan); else pencereKapat();
    }

    // ---------------------------------------------------------------- 1) açılış penceresi
    const pencereAcik = () => { const m = document.getElementById('modal-takas-onay'); return !!(m && !m.classList.contains('hidden')); };
    function pencereKapat() { const m = document.getElementById('modal-takas-onay'); if (m) m.classList.add('hidden'); }
    function pencereGoster(liste) {
        let m = document.getElementById('modal-takas-onay');
        if (!m) {
            m = document.createElement('div');
            m.id = 'modal-takas-onay';
            m.className = 'modal hidden';
            m.innerHTML = `<div class="modal-content to-modal">
                <div class="modal-header"><h3>🔄 Onayınızı bekleyen teklif</h3>
                    <button class="close-modal" type="button" onclick="TakasOnay.kapat()">&times;</button></div>
                <div class="modal-body to-govde"></div></div>`;
            m.addEventListener('click', (e) => { if (e.target === m) pencereKapat(); });
            document.body.appendChild(m);
        }
        m.querySelector('h3').textContent = liste.length > 1 ? `🔄 Onayınızı bekleyen ${liste.length} teklif` : '🔄 Onayınızı bekleyen teklif';
        m.querySelector('.to-govde').innerHTML = liste.map(b => kartHtml(b, 'pencere')).join('') +
            `<p class="to-not">Bu teklifleri Profilim › Takas › Taleplerim'de de görebilirsiniz. "Sonra" derseniz 4 saat sonra tekrar sorulur.</p>`;
        m.classList.remove('hidden');
    }
    /** Giriş yapılmış ve kişi belliyse, ertelenmemiş bekleyen teklifleri pencerede gösterir. */
    function kontrolEt(zorlaId) {
        try {
            if (!sessionStorage.getItem('isLoggedIn')) return false;
            const pid = benimId();
            if (!pid) return false;
            let liste = bekleyenler(pid);
            if (zorlaId != null) {
                const hedef = liste.filter(b => S(b.r.id) === S(zorlaId));
                if (hedef.length) { pencereGoster(hedef); return true; }
            }
            liste = liste.filter(b => !ertelendiMi(b));
            if (!liste.length) return false;
            if (!pencereAcik()) pencereGoster(liste);
            return true;
        } catch (e) { console.warn('[TakasOnay]', e); return false; }
    }

    // ---------------------------------------------------------------- 2) Takas › Taleplerim listesi
    function renderListe() {
        const pane = document.getElementById('tab-swap-history');
        if (!pane) return;
        let kutu = document.getElementById('takas-onay-liste');
        if (!kutu) {
            kutu = document.createElement('div');
            kutu.id = 'takas-onay-liste';
            pane.insertBefore(kutu, pane.firstChild);
        }
        const liste = bekleyenler(benimId());
        kutu.classList.toggle('hidden', !liste.length);
        kutu.innerHTML = liste.length ? `<div class="to-liste-kart">
            <h4 class="to-liste-baslik">⏳ Onayınızı bekleyen teklifler <span class="to-sayi">${liste.length}</span></h4>
            ${liste.map(b => kartHtml(b, 'liste')).join('')}</div>` : '';
    }

    // ---------------------------------------------------------------- başlatma
    function init() {
        // Bildirime dokunarak gelindiyse ilgili teklif doğrudan açılsın
        let hedef = null;
        try { const p = new URLSearchParams(location.search); if (p.get('requestId')) hedef = p.get('requestId'); } catch (e) { /* yok say */ }
        // Veri yüklenip oturum açılınca (giriş sonradan yapılsa da) bir kez kontrol et
        const bekle = setInterval(() => {
            const db = getDB();
            const hazir = db && Array.isArray(db.staff) && db.staff.length && Array.isArray(db.exams) && db.exams.length && sessionStorage.getItem('isLoggedIn');
            if (hazir) { clearInterval(bekle); setTimeout(() => kontrolEt(hedef), 1500); }
        }, 2000);
        // Senkronizasyonla gelen yeni teklifler için: sayfa öne geldiğinde ve 10 dakikada bir
        document.addEventListener('visibilitychange', () => { if (!document.hidden) kontrolEt(); });
        setInterval(() => { if (!document.hidden) kontrolEt(); }, 10 * 60 * 1000);
    }

    window.TakasOnay = { bekleyenler, kontrolEt, renderListe, onayla: (id) => islem(id, true), reddet: (id) => islem(id, false), sonra, kapat: pencereKapat, kartHtml };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
