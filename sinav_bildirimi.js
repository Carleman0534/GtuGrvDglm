/**
 * 📝 SINAV BİLDİRİMİ: Gözetmenin yöneticiden habersiz aldığı bir sınavı kendisinin bildirmesi.
 *
 * Akış:
 *   1) Gözetmen Profilim › Görevlerim › Sınav Bildir'den sınav bilgilerini girer → "onay bekliyor".
 *      Bu aşamada sınav listesine eklenmez, puana sayılmaz.
 *   2) Yönetici Ana Sayfa'daki "Gözetmen sınav bildirimleri" kartında onaylar ya da gerekçeyle reddeder.
 *      Onayda: sistemde aynı sınav (aynı tarih + saat + ders adı) varsa gözetmen o sınava eklenir,
 *      yoksa sınav gözetmen atanmış olarak oluşturulur; puan normal kurallarla hesaplanır.
 *      Sınav bitmişse gözetmenin girdiği süre onaylı süre olarak kaydedilir (tekrar teyit istenmez).
 *   3) Gözetmene sonuç bildirilir. Bekleyen bildirimi gözetmen geri çekebilir.
 *
 * Veri: DB.examSubmissions = [{ id, staffId, staffName, name, type, isNonExam, date, time, duration,
 *        location, lecturer, note, mevcutExamId, status: pending|approved|rejected|withdrawn,
 *        createdAt, decidedAt, decidedBy, rejectReason, examId }]
 */
(function () {
    'use strict';

    const S = (v) => String(v);
    const getDB = () => (typeof DB !== 'undefined' ? DB : window.DB);
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const tarih = (d) => (typeof formatTarih === 'function' ? formatTarih(d) : d);
    const dk = (t) => { const [h, m] = String(t || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const normAd = (s) => String(s || '').toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/gi, ' ').replace(/\s+/g, ' ').trim();
    const pidsOf = (ex) => (Array.isArray(ex.proctorIds) && ex.proctorIds.length ? ex.proctorIds : (ex.proctorId != null ? [ex.proctorId] : [])).map(S);
    const GUN_MS = 86400000;
    const AYAR = { MIN_SURE: 15, MAX_SURE: 600, GECMIS_GUN: 365, GELECEK_GUN: 365 };

    function liste() {
        const db = getDB();
        if (!Array.isArray(db.examSubmissions)) db.examSubmissions = db.examSubmissions ? Object.values(db.examSubmissions).filter(Boolean) : [];
        return db.examSubmissions;
    }
    const staffOf = (id) => (getDB().staff || []).find(s => s && S(s.id) === S(id)) || null;
    const bul = (id) => liste().find(k => k && S(k.id) === S(id)) || null;

    function sinavBaslangic(date, time) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !/^\d{2}:\d{2}$/.test(String(time))) return NaN;
        const [y, m, d] = date.split('-').map(Number);
        const [h, mi] = time.split(':').map(Number);
        return new Date(y, m - 1, d, h, mi).getTime();
    }

    /** Aynı sınav sistemde var mı? (aynı tarih + saat; ders adı aynı ya da biri diğerini içeriyor) */
    function mevcutSinav(v) {
        const ad = normAd(v.name);
        if (!ad) return null;
        return (getDB().exams || []).find(ex => {
            if (!ex || ex.date !== v.date || ex.time !== v.time) return false;
            const a = normAd(ex.name);
            return a && (a === ad || a.includes(ad) || ad.includes(a));
        }) || null;
    }

    /** Girilen bilgileri denetler. hatalar → kayıt yapılmaz; uyarılar → kayıt yapılır, yöneticiye gösterilir. */
    function dogrula(staffId, v) {
        const hatalar = [], uyarilar = [];
        const st = staffOf(staffId);
        if (!st) hatalar.push('Personel kaydınız bulunamadı. Profilinizi tekrar seçin.');
        const name = String(v.name || '').trim();
        if (name.length < 2) hatalar.push('Ders / sınav adını yazın.');
        const bas = sinavBaslangic(v.date, v.time);
        if (isNaN(bas)) hatalar.push('Geçerli bir tarih ve başlangıç saati girin.');
        const sure = parseInt(v.duration, 10);
        if (!(sure >= AYAR.MIN_SURE && sure <= AYAR.MAX_SURE)) hatalar.push(`Süre ${AYAR.MIN_SURE}–${AYAR.MAX_SURE} dakika arasında olmalı.`);
        if (!isNaN(bas)) {
            const now = Date.now();
            if (bas < now - AYAR.GECMIS_GUN * GUN_MS) hatalar.push('Bir yıldan eski sınavlar bildirilemez; yöneticiyle görüşün.');
            if (bas > now + AYAR.GELECEK_GUN * GUN_MS) hatalar.push('Bir yıldan ileri bir tarih girilemez.');
        }
        let mevcut = null;
        if (!hatalar.length) {
            mevcut = mevcutSinav({ name, date: v.date, time: v.time });
            if (mevcut && pidsOf(mevcut).includes(S(staffId))) hatalar.push(`Bu sınavda zaten görevlisiniz: "${mevcut.name}" (${tarih(mevcut.date)} ${mevcut.time}).`);
            const ayni = liste().find(k => k && k.status === 'pending' && S(k.staffId) === S(staffId) && k.date === v.date && k.time === v.time);
            if (ayni) hatalar.push('Bu tarih ve saat için onay bekleyen bir bildiriminiz zaten var.');
        }
        if (!hatalar.length && st) {
            // Kendi görevleriyle çakışma
            const s1 = dk(v.time), e1 = s1 + sure;
            (getDB().exams || []).forEach(ex => {
                if (!ex || ex.date !== v.date || (mevcut && S(ex.id) === S(mevcut.id)) || !pidsOf(ex).includes(S(staffId))) return;
                const s2 = dk(ex.time), e2 = s2 + (parseInt(ex.duration, 10) || 60);
                if (s1 < e2 && s2 < e1) uyarilar.push(`Aynı saatte sistemde başka bir görevi var: "${ex.name}" (${ex.time}).`);
            });
            // Kendi kısıtıyla çakışma
            if (typeof isAvailable === 'function' && !isAvailable(st.name, v.date, v.time, sure)) uyarilar.push('Bu saat, girilmiş kısıtlarla çakışıyor.');
        }
        return { hatalar, uyarilar, mevcut, staff: st, name, sure };
    }

    function bildirimGonder(staffId, mesaj, tip) {
        const db = getDB();
        if (!db.notifications || typeof db.notifications !== 'object') db.notifications = {};
        const k = S(staffId);
        if (!Array.isArray(db.notifications[k])) db.notifications[k] = [];
        db.notifications[k].unshift({ id: Date.now() + Math.floor(Math.random() * 100000), message: mesaj, type: tip, createdAt: new Date().toISOString(), isRead: false });
    }
    // Diğer kayıt yollarıyla aynı: "yerelde kaydedilmemiş değişiklik var" işareti ve zaman damgası
    // (yoksa periyodik eşitleme, değişiklik sunucuya ulaşmadan yerel veriyi sunucudakiyle ezebilir)
    const kaydet = () => {
        if (typeof window !== 'undefined') window._hasLocalEdits = true;
        getDB().lastUpdated = new Date().toISOString();
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    };
    const gunluk = (kat, baslik, detay) => { if (typeof logAction === 'function') logAction(kat, baslik, detay); };
    const sinavMetni = (k) => `"${k.name}" (${tarih(k.date)} ${k.time}, ${k.duration} dk)`;

    // ---------------------------------------------------------------- yöneticiye haber
    /** Bildirimlerin gideceği yönetici e-postaları: ayar (DB.sinavBildirimiAyar.eposta) → yönetici listesi */
    function yoneticiEpostalari() {
        const ayar = getDB().sinavBildirimiAyar;
        const liste_ = ayar && Array.isArray(ayar.eposta) && ayar.eposta.length ? ayar.eposta
            : ((typeof window !== 'undefined' && Array.isArray(window.GTU_ADMIN_EMAILS)) ? window.GTU_ADMIN_EMAILS : []);
        return liste_.map(e => String(e || '').trim().toLowerCase()).filter(e => /.+@.+\..+/.test(e));
    }
    /** Telefon bildirimi alacak yöneticiler: e-postası yönetici listesinde olan personel kayıtları */
    function yoneticiPersonelleri() {
        const ep = yoneticiEpostalari();
        return (getDB().staff || []).filter(s => s && s.email && ep.includes(String(s.email).trim().toLowerCase()));
    }
    /**
     * Yöneticinin telefonuna bildirim: hedefli yönetici duyurusu olarak eklenir.
     * Sitedeki bildirim zili ve GitHub'daki bildirim gönderici (kayıtlı cihazlara Web Push,
     * 09:00–19:00 arası) duyuruları zaten işlediği için ek bir altyapı gerekmez.
     */
    function yoneticiyeHaberVer(k) {
        const hedef = yoneticiPersonelleri().map(s => S(s.id)).filter(id => id !== S(k.staffId));
        if (!hedef.length) return 0;
        const db = getDB();
        if (!Array.isArray(db.adminBroadcasts)) db.adminBroadcasts = db.adminBroadcasts ? Object.values(db.adminBroadcasts).filter(Boolean) : [];
        db.adminBroadcasts.unshift({
            id: `bc_sinavbildirimi_${k.id}`,
            title: '📝 Yeni sınav bildirimi (onay bekliyor)',
            message: `${k.staffName}, ${sinavMetni(k)} sınavında gözetmenlik yaptığını bildirdi.${k.note ? ' Not: ' + k.note.replace(/[.!?]*$/, '.') : ''} Onaylamak için: Ana Sayfa › Gözetmen sınav bildirimleri.`,
            priority: 'normal',
            target: hedef,
            pushToDevice: true,
            senderName: k.staffName,
            senderRole: 'staff',
            kaynak: 'sinav_bildirimi',
            createdAt: new Date().toISOString(),
            timestamp: Date.now()
        });
        return hedef.length;
    }
    /** Gözetmenin kendi e-posta uygulamasında açılacak hazır mesaj (mailto) */
    function epostaBaglantisi(k) {
        const alici = yoneticiEpostalari();
        if (!alici.length) return '';
        const konu = `Sınav bildirimi: ${k.name} (${tarih(k.date)} ${k.time})`;
        const govde = [
            'Merhaba,', '',
            `Aşağıdaki sınavda gözetmenlik yaptığımı sisteme bildirdim; onayınızı rica ederim.`, '',
            `Sınav: ${k.name} (${k.type})`,
            `Tarih / saat: ${tarih(k.date)} ${k.time}, ${k.duration} dk`,
            k.location ? `Derslik: ${k.location}` : '',
            k.lecturer ? `Ders hocası: ${k.lecturer}` : '',
            k.note ? `Açıklama: ${k.note}` : '', '',
            'Onay için: Ana Sayfa › Gözetmen sınav bildirimleri', '',
            k.staffName
        ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
        return `mailto:${alici.join(',')}?subject=${encodeURIComponent(konu)}&body=${encodeURIComponent(govde)}`;
    }

    /** Gözetmenin bildirimi: onay bekleyen kayıt oluşturur. */
    function olustur(staffId, v) {
        const d = dogrula(staffId, v || {});
        if (d.hatalar.length) return { ok: false, hatalar: d.hatalar, uyarilar: d.uyarilar };
        const kayit = {
            id: 'sb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            staffId: d.staff.id, staffName: d.staff.name,
            name: d.name, type: v.isNonExam ? 'Diğer' : (v.type || 'Vize'), isNonExam: !!v.isNonExam,
            date: v.date, time: v.time, duration: d.sure,
            location: String(v.location || '').trim(), lecturer: String(v.lecturer || '').trim(), note: String(v.note || '').trim(),
            mevcutExamId: d.mevcut ? d.mevcut.id : null,
            uyarilar: d.uyarilar,
            status: 'pending', createdAt: new Date().toISOString()
        };
        liste().unshift(kayit);
        kayit.yoneticiyeBildirim = yoneticiyeHaberVer(kayit);
        gunluk('user', 'Sınav Bildirimi', `${kayit.staffName}: ${sinavMetni(kayit)} sınavını aldığını bildirdi (yönetici onayı bekliyor).`);
        kaydet();
        return { ok: true, kayit, uyarilar: d.uyarilar };
    }

    /** Gözetmen bekleyen bildirimini geri çeker. */
    function geriCek(id, staffId) {
        const k = bul(id);
        if (!k || S(k.staffId) !== S(staffId)) return { ok: false, hata: 'Bildirim bulunamadı.' };
        if (k.status !== 'pending') return { ok: false, hata: 'Yalnızca onay bekleyen bildirim geri çekilebilir.' };
        k.status = 'withdrawn'; k.decidedAt = new Date().toISOString(); k.decidedBy = k.staffName;
        gunluk('user', 'Sınav Bildirimi Geri Çekildi', `${k.staffName}: ${sinavMetni(k)}`);
        kaydet();
        return { ok: true };
    }

    function sureKaydiYaz(ex, pid, k, onaylayan) {
        const bitis = sinavBaslangic(k.date, k.time) + k.duration * 60000;
        if (isNaN(bitis) || Date.now() < bitis) return;   // henüz bitmemiş: süre teyidi normal akışta
        const BK = window.BildirimKurallari;
        const alan = BK && BK.sureAlani ? BK.sureAlani(pid) : 'gozetmenSuresi_' + pid;
        ex[alan] = { sure: k.duration, onaylayan, onayZamani: new Date().toISOString(), kaynak: 'sinav_bildirimi' };
        if (k.time !== ex.time) ex[alan].saat = k.time;
    }

    /** Yönetici onayı: gözetmeni mevcut sınava ekler ya da sınavı oluşturur; puanlar yeniden hesaplanır. */
    function onayla(id, yoneticiAdi) {
        const k = bul(id);
        if (!k) return { ok: false, hata: 'Bildirim bulunamadı.' };
        if (k.status !== 'pending') return { ok: false, hata: 'Bu bildirim zaten sonuçlanmış.' };
        const st = staffOf(k.staffId);
        if (!st) return { ok: false, hata: 'Bildiren personel artık sistemde yok.' };
        const db = getDB();
        const onaylayan = yoneticiAdi || 'Yönetici';
        let ex = k.mevcutExamId != null ? (db.exams || []).find(e => e && S(e.id) === S(k.mevcutExamId)) : null;
        if (!ex) ex = mevcutSinav(k);
        let yeni = false;
        if (ex) {
            if (!pidsOf(ex).includes(S(st.id))) {
                const ids = Array.isArray(ex.proctorIds) ? ex.proctorIds.slice() : (ex.proctorId != null ? [ex.proctorId] : []);
                ids.push(st.id);
                ex.proctorIds = ids;
                if (ex.proctorId == null) ex.proctorId = st.id;
                ex.proctorName = ids.map(p => (staffOf(p) || {}).name).filter(Boolean).join(', ');
            }
        } else {
            if (typeof addExam !== 'function') return { ok: false, hata: 'Sınav eklenemedi.' };
            ex = addExam({
                name: k.name, type: k.type, isNonExam: k.isNonExam || undefined, date: k.date, time: k.time, duration: k.duration,
                location: k.location || 'Belirtilmedi', lecturer: k.lecturer || '-', proctorIds: [st.id], isDraft: false,
                kaynak: 'gozetmen_bildirimi', bildirimId: k.id
            }, true, false);
            if (!ex) return { ok: false, hata: 'Sınav eklenemedi.' };
            if (!k.isNonExam) delete ex.isNonExam;
            yeni = true;
        }
        sureKaydiYaz(ex, st.id, k, `${st.name} (bildirim, ${onaylayan} onayı)`);
        if (typeof recalculateAllScores === 'function') recalculateAllScores();
        k.status = 'approved'; k.decidedAt = new Date().toISOString(); k.decidedBy = onaylayan; k.examId = ex.id; k.yeniSinav = yeni;
        const puan = typeof getProctorExamScore === 'function' ? getProctorExamScore(ex, st.id) : ex.score;
        bildirimGonder(st.id, `✅ Sınav bildiriminiz onaylandı: ${sinavMetni(k)}. Görev listenize eklendi (${Math.round((Number(puan) || 0) * 10) / 10} puan).`, 'exam_submission_approved');
        gunluk('admin', 'Sınav Bildirimi Onaylandı', `${onaylayan}: ${k.staffName} — ${sinavMetni(k)} ${yeni ? 'sınav olarak eklendi' : 'mevcut sınava gözetmen olarak eklendi'}.`);
        kaydet();
        return { ok: true, exam: ex, yeni };
    }

    /** Yönetici reddi (gerekçe gözetmene iletilir). */
    function reddet(id, yoneticiAdi, gerekce) {
        const k = bul(id);
        if (!k) return { ok: false, hata: 'Bildirim bulunamadı.' };
        if (k.status !== 'pending') return { ok: false, hata: 'Bu bildirim zaten sonuçlanmış.' };
        k.status = 'rejected'; k.decidedAt = new Date().toISOString(); k.decidedBy = yoneticiAdi || 'Yönetici';
        k.rejectReason = String(gerekce || '').trim();
        bildirimGonder(k.staffId, `❌ Sınav bildiriminiz onaylanmadı: ${sinavMetni(k)}.${k.rejectReason ? ' Gerekçe: ' + k.rejectReason : ''}`, 'exam_submission_rejected');
        gunluk('admin', 'Sınav Bildirimi Reddedildi', `${k.decidedBy}: ${k.staffName} — ${sinavMetni(k)}${k.rejectReason ? ' (' + k.rejectReason + ')' : ''}`);
        kaydet();
        return { ok: true };
    }

    const bekleyenler = () => liste().filter(k => k && k.status === 'pending');
    const kisininkiler = (staffId) => liste().filter(k => k && S(k.staffId) === S(staffId));

    // ================================================================== Arayüz
    const DURUM = {
        pending: { ad: '⏳ Onay bekliyor', renk: '#f59e0b' },
        approved: { ad: '✅ Onaylandı', renk: '#22c55e' },
        rejected: { ad: '❌ Reddedildi', renk: '#ef4444' },
        withdrawn: { ad: '↩️ Geri çekildi', renk: '#94a3b8' }
    };
    const toast = (m, t) => { if (typeof window.showToast === 'function') window.showToast(m, t); else alert(m); };
    const myId = () => { try { return localStorage.getItem('myStaffId'); } catch (e) { return null; } };
    const isAdmin = () => { try { return sessionStorage.getItem('isAdmin') === 'true'; } catch (e) { return false; } };
    const tipler = () => {
        const t = (getDB().examTypes || ['Vize', 'Final', 'Bütünleme', 'Ek Sınav', 'Mazeret']).filter(x => x && x !== 'Diğer' && x !== 'Tercih Günü');
        return t.length ? t : ['Vize', 'Final', 'Bütünleme'];
    };

    function paneOlustur() {
        if (document.getElementById('tab-sinav-bildir')) return;
        const host = document.getElementById('profile-tab-content');
        if (!host) return;
        const pane = document.createElement('div');
        pane.id = 'tab-sinav-bildir';
        pane.className = 'tab-pane hidden';
        host.appendChild(pane);
    }

    function renderProfil() {
        paneOlustur();
        const pane = document.getElementById('tab-sinav-bildir');
        if (!pane) return;
        const pid = myId();
        const st = pid ? staffOf(pid) : null;
        if (!st) { pane.innerHTML = '<div class="sb-kart"><p class="sb-not">Sınav bildirmek için önce profilinizden kimliğinizi seçin.</p></div>'; return; }
        const bugun = new Date();
        const iso = `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, '0')}-${String(bugun.getDate()).padStart(2, '0')}`;
        const kayitlar = kisininkiler(st.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        pane.innerHTML = `
            <div class="sb-kart">
                <h4 class="sb-baslik">📝 Aldığım bir sınavı bildir</h4>
                <p class="sb-not">Yöneticinin bilgisi dışında bir sınavda gözetmenlik yaptıysanız ya da yapacaksanız buradan bildirin.
                    Bildirim <b>yönetici onayından sonra</b> görev listenize eklenir ve puanınıza sayılır.</p>
                <form id="sb-form" class="sb-form" onsubmit="return false;">
                    <label class="sb-genis">Ders / sınav adı<input id="sb-name" type="text" maxlength="120" placeholder="Ör. MAT 101 Analiz I" required></label>
                    <label>Tür<select id="sb-type">${tipler().map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
                    <label>Tarih<input id="sb-date" type="date" value="${iso}" required></label>
                    <label>Başlangıç saati<input id="sb-time" type="time" required></label>
                    <label>Süre (dk)<input id="sb-duration" type="number" min="${AYAR.MIN_SURE}" max="${AYAR.MAX_SURE}" step="5" value="120" required></label>
                    <label>Derslik<input id="sb-location" type="text" maxlength="60" placeholder="İsteğe bağlı"></label>
                    <label>Ders hocası<input id="sb-lecturer" type="text" maxlength="80" placeholder="İsteğe bağlı"></label>
                    <label class="sb-genis">Açıklama<textarea id="sb-note" rows="2" maxlength="300" placeholder="Ör. Hocanın isteğiyle son anda girdim (isteğe bağlı)"></textarea></label>
                    <label class="sb-onay sb-genis"><input id="sb-nonexam" type="checkbox"> Bu bir sınav değil, sınav dışı görev (tanıtım, etkinlik vb.)</label>
                    <div class="sb-genis sb-eylem"><button type="button" class="btn-primary" onclick="SinavBildirimi.gonder()">📨 Onaya gönder</button></div>
                </form>
                <div id="sb-sonuc"></div>
            </div>
            <div class="sb-kart">
                <h4 class="sb-baslik">📋 Bildirimlerim</h4>
                ${kayitlar.length ? `<div class="sb-liste">${kayitlar.map(k => {
                    const d = DURUM[k.status] || DURUM.pending;
                    return `<div class="sb-satir">
                        <div><b>${esc(k.name)}</b> <small>${esc(k.type)}${k.isNonExam ? ' · sınav dışı' : ''}</small>
                            <div class="sb-alt">${esc(tarih(k.date))} ${esc(k.time)} · ${k.duration} dk${k.location ? ' · ' + esc(k.location) : ''}</div>
                            ${k.status === 'rejected' && k.rejectReason ? `<div class="sb-alt">Gerekçe: ${esc(k.rejectReason)}</div>` : ''}
                        </div>
                        <div class="sb-sag"><span class="sb-durum" style="color:${d.renk}; border-color:${d.renk}">${d.ad}</span>
                            ${k.status === 'pending' && epostaBaglantisi(k) ? `<a class="sb-link" href="${esc(epostaBaglantisi(k))}">✉️ E-posta ile hatırlat</a>` : ''}
                            ${k.status === 'pending' ? `<button type="button" class="sb-link" onclick="SinavBildirimi.geriCekUI('${esc(k.id)}')">Geri çek</button>` : ''}</div>
                    </div>`;
                }).join('')}</div>` : '<p class="sb-not">Henüz bildiriminiz yok.</p>'}
            </div>`;
    }

    function gonder() {
        const pid = myId();
        const val = (id) => (document.getElementById(id) || {}).value;
        const v = {
            name: val('sb-name'), type: val('sb-type'), date: val('sb-date'), time: val('sb-time'), duration: val('sb-duration'),
            location: val('sb-location'), lecturer: val('sb-lecturer'), note: val('sb-note'),
            isNonExam: !!(document.getElementById('sb-nonexam') || {}).checked
        };
        const r = olustur(pid, v);
        const out = document.getElementById('sb-sonuc');
        if (!r.ok) {
            if (out) out.innerHTML = `<div class="sb-hata">${r.hatalar.map(esc).join('<br>')}</div>`;
            return;
        }
        toast('📨 Bildiriminiz yönetici onayına gönderildi.', 'success');
        renderProfil();
        const o2 = document.getElementById('sb-sonuc');
        const mail = epostaBaglantisi(r.kayit);
        if (o2) o2.innerHTML = `<div class="sb-tamam">Bildiriminiz yönetici onayına gönderildi${r.kayit.yoneticiyeBildirim ? ' ve yöneticinin telefonuna bildirim olarak iletilecek' : ''}.${r.kayit.mevcutExamId != null ? ' Sistemde aynı sınav bulundu; onaylanınca o sınava gözetmen olarak eklenirsiniz.' : ''}${r.uyarilar.length ? '<br>⚠️ ' + r.uyarilar.map(esc).join('<br>⚠️ ') : ''}
            ${mail ? `<div class="sb-eposta"><a class="btn-secondary" href="${esc(mail)}">✉️ Yöneticiye e-posta ile de bildir</a><small>E-posta uygulamanızda hazır bir mesaj açılır; göndermek size kalmış.</small></div>` : ''}</div>`;
        renderAdmin();
    }

    function geriCekUI(id) {
        if (!confirm('Bu bildirimi geri çekmek istiyor musunuz?')) return;
        const r = geriCek(id, myId());
        if (!r.ok) { toast(r.hata, 'error'); return; }
        toast('Bildirim geri çekildi.', 'info');
        renderProfil();
        renderAdmin();
    }

    // ---------------------------------------------------------------- yönetici kartı
    function adminKartOlustur() {
        let card = document.getElementById('card-sinav-bildirim-admin');
        if (card) return card;
        const anchor = document.getElementById('card-swap-admin') || document.getElementById('dashboard-export-container');
        if (!anchor) return null;
        card = document.createElement('div');
        card.id = 'card-sinav-bildirim-admin';
        card.className = 'card card-large admin-only hidden';
        if (anchor.id === 'card-swap-admin') anchor.insertAdjacentElement('beforebegin', card);
        else anchor.insertBefore(card, anchor.firstChild);
        return card;
    }

    function renderAdmin() {
        const card = adminKartOlustur();
        if (!card) return;
        const list = isAdmin() ? bekleyenler() : [];
        card.classList.toggle('hidden', !list.length);
        if (!list.length) { card.innerHTML = ''; return; }
        const yon = yoneticiPersonelleri();
        const cihazli = (s) => { const p = getDB().pushAbonelikleri; const a = p && p[S(s.id)]; return !!(a && (Array.isArray(a) ? a.length : Object.keys(a).length)); };
        const ayarSatiri = `<div class="sb-ayar">📱 Yeni bildirimler telefonuna gider: ${yon.length ? yon.map(s => `<b>${esc(s.name)}</b>${cihazli(s) ? '' : ' <small>(kayıtlı cihaz yok — Profilim › Ayarlarım › Bildirim Ayarları’ndan açın)</small>'}`).join(', ') : '<b>kimse</b> <small>(e-postası aşağıdaki listede olan personel yok)</small>'}
            · ✉️ E-posta: ${yoneticiEpostalari().map(esc).join(', ') || '—'}
            <button type="button" class="sb-link" onclick="SinavBildirimi.ayarUI()">Değiştir</button></div>`;
        card.innerHTML = `
            <h3 class="sb-admin-baslik">📝 Gözetmen sınav bildirimleri <span class="sb-sayi">${list.length}</span></h3>
            <p class="sb-not">Gözetmenlerin kendi bildirdiği sınavlar. Onaylanınca sınav gözetmen atanmış olarak eklenir (aynı sınav sistemde varsa gözetmen ona eklenir) ve puan normal kurallarla hesaplanır.</p>
            <div class="sb-liste">${list.map(k => {
                const ex = k.mevcutExamId != null ? (getDB().exams || []).find(e => e && S(e.id) === S(k.mevcutExamId)) : null;
                const uyar = (k.uyarilar || []).concat(ex ? [`Sistemde aynı sınav var: "${ex.name}" (gözetmen: ${ex.proctorName || '-'}). Onayda bu sınava eklenir.`] : []);
                return `<div class="sb-satir">
                    <div><b>${esc(k.staffName)}</b> → <b>${esc(k.name)}</b> <small>${esc(k.type)}${k.isNonExam ? ' · sınav dışı' : ''}</small>
                        <div class="sb-alt">${esc(tarih(k.date))} ${esc(k.time)} · ${k.duration} dk${k.location ? ' · ' + esc(k.location) : ''}${k.lecturer ? ' · ' + esc(k.lecturer) : ''}</div>
                        ${k.note ? `<div class="sb-alt">“${esc(k.note)}”</div>` : ''}
                        ${uyar.length ? `<div class="sb-uyari">⚠️ ${uyar.map(esc).join('<br>⚠️ ')}</div>` : ''}
                        <div class="sb-alt">Bildirim: ${esc(new Date(k.createdAt).toLocaleString('tr-TR'))}</div>
                    </div>
                    <div class="sb-sag">
                        <button type="button" class="btn-primary sb-onayla" onclick="SinavBildirimi.onaylaUI('${esc(k.id)}')">✅ Onayla</button>
                        <button type="button" class="btn-secondary sb-reddet" onclick="SinavBildirimi.reddetUI('${esc(k.id)}')">❌ Reddet</button>
                    </div>
                </div>`;
            }).join('')}</div>${ayarSatiri}`;
    }

    function ayarUI() {
        const simdiki = yoneticiEpostalari().join(', ');
        const g = prompt('Sınav bildirimleri hangi yönetici e-postalarına gitsin? (virgülle ayırın)\nBu e-postaya sahip personelin kayıtlı telefonlarına da bildirim gönderilir.', simdiki);
        if (g === null) return;
        const ep = g.split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => /.+@.+\..+/.test(x));
        const db = getDB();
        db.sinavBildirimiAyar = Object.assign({}, db.sinavBildirimiAyar || {}, { eposta: ep });
        gunluk('admin', 'Sınav Bildirimi Ayarı', `Bildirim alıcıları: ${ep.join(', ') || '(varsayılan yönetici listesi)'}`);
        kaydet();
        renderAdmin();
    }

    const yoneticiAdi = () => { try { return sessionStorage.getItem('adminName') || localStorage.getItem('adminName') || 'Yönetici'; } catch (e) { return 'Yönetici'; } };
    function sonra() {
        renderAdmin();
        if (document.getElementById('tab-sinav-bildir')) renderProfil();
        ['renderExams', 'renderSchedule', 'renderProfile'].forEach(f => { try { if (typeof window[f] === 'function') window[f](); } catch (e) { /* görünüm yenilemesi isteğe bağlı */ } });
    }
    function onaylaUI(id) {
        const k = bul(id);
        if (!k || !confirm(`${k.staffName} — ${sinavMetni(k)} onaylansın mı?\nSınav görev listesine eklenir ve puana sayılır.`)) return;
        const r = onayla(id, yoneticiAdi());
        if (!r.ok) { toast(r.hata, 'error'); return; }
        toast(r.yeni ? '✅ Onaylandı; sınav eklendi.' : '✅ Onaylandı; gözetmen mevcut sınava eklendi.', 'success');
        sonra();
    }
    function reddetUI(id) {
        const k = bul(id);
        if (!k) return;
        const g = prompt(`${k.staffName} — ${sinavMetni(k)} reddedilecek.\nGerekçe (gözetmene iletilir, isteğe bağlı):`, '');
        if (g === null) return;
        const r = reddet(id, yoneticiAdi(), g);
        if (!r.ok) { toast(r.hata, 'error'); return; }
        toast('Bildirim reddedildi.', 'info');
        sonra();
    }

    function init() {
        paneOlustur();
        const orig = window.renderDashboard;
        if (typeof orig === 'function' && !orig.__sb) {
            const w = function () { try { return orig.apply(this, arguments); } finally { try { renderAdmin(); } catch (e) { /* kart isteğe bağlı */ } } };
            w.__sb = true;
            window.renderDashboard = w;
        }
        renderAdmin();
        // Senkronizasyonla gelen yeni bildirimler için kart kendi kendine güncellensin
        setInterval(() => { try { if (isAdmin()) renderAdmin(); } catch (e) { /* yok say */ } }, 5000);
    }

    window.SinavBildirimi = { dogrula, olustur, geriCek, onayla, reddet, bekleyenler, kisininkiler, mevcutSinav, renderProfil, renderAdmin, gonder, geriCekUI, onaylaUI, reddetUI, ayarUI,
        yoneticiEpostalari, yoneticiPersonelleri, epostaBaglantisi, AYAR };

    if (typeof document !== 'undefined' && document.addEventListener) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
        else setTimeout(init, 0);
    }
})();
