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
    /** Türkçe ilgi eki: "Aslıhan Gür" → "Aslıhan Gür'ün", "Yasin Turan" → "Yasin Turan'ın" */
    function iyelik(ad) {
        const s = String(ad || '').trim();
        const unluler = s.toLocaleLowerCase('tr').match(/[aeıioöuü]/g);
        const son = unluler ? unluler[unluler.length - 1] : 'e';
        const ek = { a: 'ın', ı: 'ın', e: 'in', i: 'in', o: 'un', u: 'un', ö: 'ün', ü: 'ün' }[son];
        const unluyleBiter = /[aeıioöuü]$/i.test(s.toLocaleLowerCase('tr'));
        return `${s}'${unluyleBiter ? 'n' : ''}${ek}`;
    }
    const BASLIK = {
        adalet_takas: '⚖️ Yönetici tarafından adalet dengesi için takas teklif edildi',
        adalet_devir: '➡️ Yönetici tarafından görev devri teklif edildi',
        dogrudan: '🔄 Takas teklifi',
        akilli: '🤖 Akıllı takas teklifi',
        pazar_devir: '🛒 Pazar yeri: görevinizi almak isteyen var'
    };
    function aciklama(b) {
        if (b.tip === 'adalet_devir') return `Puan dengesi için <b>${esc(b.karsiAd)}</b> kişisinin görevinin size devri önerildi. Onaylarsanız görev size geçer.`;
        if (b.tip === 'pazar_devir') return `<b>${esc(b.karsiAd)}</b> pazar yerine bıraktığınız görevi almak istiyor. Onaylarsanız görev ona geçer.`;
        if (b.tip === 'adalet_takas') return `<b>${esc(b.karsiAd)}</b> ile karşılıklı görev takası. Bu teklif ikinize de gönderildi; <b>ikiniz de onaylarsanız takas gerçekleşir</b>.${b.karsiOnayladi
            ? ` <span class="to-onayli">✓ ${esc(b.karsiAd)} onayladı; yalnızca sizin onayınız bekleniyor.</span>`
            : ` <span class="to-bekliyor">${esc(iyelik(b.karsiAd))} onayı da bekleniyor.</span>`}`;
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

    // ---------------------------------------------------------------- onayladım, karşı taraf bekleniyor
    /** Benim onayladığım, karşı tarafın henüz onaylamadığı adalet takasları */
    function onayladiklarim(pid) {
        const K = window.BildirimKurallari;
        if (!K || typeof K.takasBekleyenleri !== 'function' || pid == null) return [];
        return K.takasBekleyenleri(getDB(), Date.now()).filter(b => b.tip === 'adalet_takas' && b.pid !== S(pid) && b.karsiOnayladi
            && (S(b.r.fromStaffId) === S(pid) || S(b.r.toStaffId) === S(pid)));
    }
    function beklemeKartHtml(b) {
        // b, karşı tarafın bekleyen kaydıdır: onun vereceği = benim alacağım
        const karsi = S(b.r.fromStaffId) === b.pid ? b.r.fromStaffName : b.r.toStaffName;
        return `<div class="to-kart to-bekleme">
            <div class="to-tur">⚖️ Yönetici tarafından adalet dengesi için takas teklif edildi</div>
            <div class="to-aciklama">✓ Onayınız alındı. <b>${esc(iyelik(karsi))} onayı bekleniyor</b>; o da onaylayınca takas gerçekleşir.</div>
            <div class="to-sinavlar">
                ${b.alinacak ? `<div>📤 Vereceğiniz: ${sinavSatiri(b.alinacak, '#f87171')}</div>` : ''}
                ${b.verilecek ? `<div>📥 Alacağınız: ${sinavSatiri(b.verilecek, '#4ade80')}</div>` : ''}
            </div>
            <div class="to-alt">${kalanMetni(b)}</div>
        </div>`;
    }

    // ---------------------------------------------------------------- görev uyarıları ("Tamam, gördüm")
    function uyarilar(pid) {
        const db = getDB();
        const l = db && db.gorevUyarilari ? (Array.isArray(db.gorevUyarilari) ? db.gorevUyarilari : Object.values(db.gorevUyarilari)) : [];
        return l.filter(u => u && !u.okundu && pid != null && S(u.pid) === S(pid)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }
    function uyariKartHtml(u) {
        const olumsuz = u.tur === 'devir_veren' || u.tur === 'takas_red';
        const zaman = u.createdAt ? new Date(u.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
        return `<div class="to-kart to-uyari${olumsuz ? ' to-uyari-olumsuz' : ''}">
            <div class="to-uyari-baslik">${esc(u.baslik || 'Görev bildirimi')}</div>
            <div class="to-aciklama">${esc(u.metin || '')}</div>
            <div class="to-eylem"><span class="to-alt">${esc(zaman)}</span>
                <button type="button" class="to-gordum" onclick="TakasOnay.gordum('${esc(u.id)}')">Tamam, gördüm</button></div>
        </div>`;
    }
    function gordum(id) {
        const db = getDB();
        const u = (Array.isArray(db.gorevUyarilari) ? db.gorevUyarilari : []).find(x => x && S(x.id) === S(id));
        if (u) {
            u.okundu = true; u.okunduAt = new Date().toISOString();
            window._hasLocalEdits = true; db.lastUpdated = new Date().toISOString();
            if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
        }
        kapatVeYenile(true);
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
    // Onay / ret / "gördüm" sonrası: pencere açıksa güncel içerikle kalır (onaylanan takas için
    // "… onayı bekleniyor" kartı görünür); gösterilecek bir şey kalmayınca kapanır.
    function kapatVeYenile(sessiz) {
        setTimeout(() => {
            renderListe();
            if (!pencereAcik()) return;
            const c = icerik(benimId());
            if (c.uyari.length || c.aksiyon.length || (!sessiz && c.bekleme.length)) pencereGoster(c); else pencereKapat();
        }, 300);
    }
    const sonraAnahtari = (id, pid) => `takas_sonra_${id}_${pid}`;
    function ertelendiMi(b) { const t = parseInt(lsGet(sonraAnahtari(b.r.id, b.pid)), 10); return t > 0 && Date.now() - t < SONRA_MS; }
    function sonra(id) {
        const pid = benimId();
        lsSet(sonraAnahtari(id, pid), String(Date.now()));
        const c = icerik(pid);
        if (c.uyari.length || c.aksiyon.length) pencereGoster(c); else pencereKapat();
    }
    /** Pencerede / listede gösterilecekler: okunmamış uyarılar, onayımı bekleyenler, karşı tarafı bekleyenler */
    function icerik(pid, ertelenenlerDahil) {
        return {
            uyari: uyarilar(pid),
            aksiyon: bekleyenler(pid).filter(b => ertelenenlerDahil || !ertelendiMi(b)),
            bekleme: onayladiklarim(pid)
        };
    }

    // ---------------------------------------------------------------- 1) açılış penceresi
    const pencereAcik = () => { const m = document.getElementById('modal-takas-onay'); return !!(m && !m.classList.contains('hidden')); };
    function pencereKapat() { const m = document.getElementById('modal-takas-onay'); if (m) m.classList.add('hidden'); }
    function pencereGoster(c) {
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
        const n = c.aksiyon.length;
        m.querySelector('h3').textContent = n > 1 ? `🔄 Onayınızı bekleyen ${n} teklif` : n === 1 ? '🔄 Onayınızı bekleyen teklif'
            : c.uyari.length ? '🔔 Görevinizde değişiklik' : '🔄 Takas durumu';
        m.querySelector('.to-govde').innerHTML = c.uyari.map(uyariKartHtml).join('') + c.aksiyon.map(b => kartHtml(b, 'pencere')).join('') +
            c.bekleme.map(beklemeKartHtml).join('') +
            (n ? `<p class="to-not">Bu teklifleri Profilim › Takas › Taleplerim'de de görebilirsiniz. "Sonra" derseniz 4 saat sonra tekrar sorulur.</p>` : '');
        m.classList.remove('hidden');
    }
    /** Giriş yapılmış ve kişi belliyse, ertelenmemiş bekleyen teklifleri pencerede gösterir. */
    function kontrolEt(zorlaId) {
        try {
            if (!sessionStorage.getItem('isLoggedIn')) return false;
            const pid = benimId();
            if (!pid) return false;
            if (zorlaId != null) {
                const hedef = bekleyenler(pid).filter(b => S(b.r.id) === S(zorlaId));
                if (hedef.length) { pencereGoster({ uyari: uyarilar(pid), aksiyon: hedef, bekleme: [] }); return true; }
            }
            const c = icerik(pid);
            // Pencere yalnızca yapılacak bir şey (onay ya da okunmamış uyarı) varsa açılır
            if (!c.aksiyon.length && !c.uyari.length) return false;
            if (!pencereAcik()) pencereGoster(c);
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
        const c = icerik(benimId(), true);
        const var_ = c.uyari.length || c.aksiyon.length || c.bekleme.length;
        kutu.classList.toggle('hidden', !var_);
        kutu.innerHTML = var_ ? `<div class="to-liste-kart">
            <h4 class="to-liste-baslik">⏳ Onayınızı bekleyen teklifler ${c.aksiyon.length ? `<span class="to-sayi">${c.aksiyon.length}</span>` : ''}</h4>
            ${c.uyari.map(uyariKartHtml).join('')}${c.aksiyon.map(b => kartHtml(b, 'liste')).join('')}${c.bekleme.map(beklemeKartHtml).join('')}</div>` : '';
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

    window.TakasOnay = { bekleyenler, onayladiklarim, uyarilar, icerik, iyelik, kontrolEt, renderListe, gordum,
        onayla: (id) => islem(id, true), reddet: (id) => islem(id, false), sonra, kapat: pencereKapat, kartHtml, beklemeKartHtml, uyariKartHtml };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
