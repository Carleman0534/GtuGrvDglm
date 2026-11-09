/**
 * 🔔 BİLDİRİM KURALLARI — tek kaynak
 *
 * Hangi bildirimin NE ZAMAN, KİME, HANGİ METİNLE gideceğini ve dokununca NEREYE gidileceğini belirler.
 * Aynı dosyayı kullananlar:
 *   - Site (notification_engine.js, app.js)      → window.BildirimKurallari
 *   - Service worker (sw.js)                     → importScripts ile self.BildirimKurallari
 *   - GitHub görevi (.github/scripts/sure-hatirlatma.mjs) → require ile
 * Kurallar burada değiştirilir; diğer dosyalarda kopyası tutulmaz.
 *
 * Saatler Türkiye saatidir (UTC+3, yaz saati uygulaması yok). Hesaplar cihazın saat diliminden bağımsızdır.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.BildirimKurallari = api;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis), function () {
    'use strict';

    // ------------------------------------------------------------------ Bildirim türleri
    // Her bildirim verisinde (data.tur) türü AÇIKÇA yazılır. Tanınmayan tür → yalnızca uygulama açılır.
    const TUR = Object.freeze({
        GUN: 'hatirlatma_gun',        // "Sıradaki göreviniz 3 gün sonra" / "Yarın göreviniz var"
        SAAT: 'hatirlatma_saat',      // "… 2 saat sonra başlıyor"
        SURE_SORU: 'sure_teyidi',     // "Sınav süreniz … sürdü, onaylıyor musunuz?"
        SURE_GIRIS: 'sure_girisi',    // "Gerçek süreyi girin"
        DUYURU: 'duyuru',             // yönetici duyurusu
        GENEL: 'genel'                // kimlik bağlandı vb.
    });

    // ------------------------------------------------------------------ Ayarlar
    const AYAR = Object.freeze({
        TR_OFSET_MS: 3 * 60 * 60 * 1000,
        // Bu tarihten önce başlayan sınavların süresi peşinen onaylıdır
        SURE_SINIRI: Date.parse('2026-10-31T21:48:45+03:00'),
        HATIRLATMA_GUNLERI: [3, 1],       // sınava 3 gün ve 1 gün (yarın) kala
        GUN_BASLANGIC_SAATI: 9,           // gün hatırlatmaları TR 09:00 - 21:00 arasında
        GUN_BITIS_SAATI: 21,
        SAAT_ONCE: 2,                     // sınavdan 2 saat önce son hatırlatma
        SURE_GECIKME_MS: 15 * 60 * 1000,  // sınav bittikten 15 dk sonra süre teyidi (sunucu)
        SURE_TEKRAR_MS: 24 * 60 * 60 * 1000,
        SURE_GERIYE_MS: 3 * 24 * 60 * 60 * 1000,
        SURE_EN_FAZLA: 2,
        VARSAYILAN_SURE_DK: 60
    });

    // ------------------------------------------------------------------ Zaman
    /** "09:30", "9:30", "09.30", "09:30-11:00", "0930" → { h, m } (geçersizse null) */
    function saatParcala(time) {
        const s = String(time == null ? '' : time).split(/[-–—]/)[0].trim();
        let m = s.match(/^(\d{1,2})[:.](\d{2})/);
        if (!m) m = s.match(/^(\d{2})(\d{2})$/);
        if (!m) m = s.match(/^(\d{1,2})$/) && [null, s, '00'];
        if (!m) return null;
        const h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
        if (h > 23 || mi > 59) return null;
        return { h, m: mi };
    }
    const pad = (n) => String(n).padStart(2, '0');

    /** Sınav başlangıcı (epoch ms, Türkiye saati). Geçersizse NaN. */
    function sinavBaslangic(ex) {
        if (!ex || !ex.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(ex.date))) return NaN;
        const t = saatParcala(ex.time);
        if (!t) return NaN;
        return Date.parse(`${ex.date}T${pad(t.h)}:${pad(t.m)}:00+03:00`);
    }
    function sinavSuresi(ex) { return parseInt(ex && ex.duration, 10) || AYAR.VARSAYILAN_SURE_DK; }
    function sinavBitis(ex) { const s = sinavBaslangic(ex); return isNaN(s) ? NaN : s + sinavSuresi(ex) * 60000; }
    /** Türkiye saatine göre "YYYY-AA-GG" */
    function trTarih(ms) { return new Date(ms + AYAR.TR_OFSET_MS).toISOString().slice(0, 10); }
    /** Türkiye saatine göre saat (0-23) */
    function trSaat(ms) { return new Date(ms + AYAR.TR_OFSET_MS).getUTCHours(); }
    /** Sınav gününe kaç takvim günü kaldı (Türkiye takvimi) */
    function gunFarki(ex, now) {
        if (!ex || !ex.date) return NaN;
        return Math.round((Date.parse(ex.date + 'T00:00:00Z') - Date.parse(trTarih(now) + 'T00:00:00Z')) / 86400000);
    }

    // ------------------------------------------------------------------ Sınav durumu
    /** Sınavın gözetmen kimlikleri (proctorIds + proctorId, metin olarak, tekrarsız) */
    function gozetmenler(ex) {
        const out = [];
        if (ex && Array.isArray(ex.proctorIds)) ex.proctorIds.forEach(p => { if (p != null && p !== '') out.push(String(p)); });
        if (ex && ex.proctorId != null && ex.proctorId !== '') out.push(String(ex.proctorId));
        return [...new Set(out)];
    }
    function gozetmeniMi(ex, staffId) { return staffId != null && gozetmenler(ex).includes(String(staffId)); }

    // ------------------------------------------------------------------ Gözetmen bazında süre
    // Aynı sınavda farklı dersliklerde görev yapan gözetmenlerin süreleri farklı olabilir; her gözetmen
    // kendi süresini girer. Kayıt sınavın üzerinde gözetmen başına AYRI bir alanda tutulur
    // (ör. ex.gozetmenSuresi_12) — veri birleştirme alan alan yapıldığı için iki gözetmenin aynı anda
    // farklı cihazlardan girdiği süreler birbirini ezmez.
    //   { sure: dakika, saat?: "HH:MM" (gerçek başlangıç), not?, onaylayan, onayZamani }
    const SURE_ALANI = 'gozetmenSuresi_';
    function sureAlani(pid) { return SURE_ALANI + String(pid); }
    function gozetmenSureKaydi(ex, pid) {
        if (!ex || pid == null || pid === '') return null;
        const k = ex[sureAlani(pid)];
        return (k && typeof k === 'object' && parseInt(k.sure, 10) > 0) ? k : null;
    }
    /** Sınav satırının tamamı için verilmiş onay (ders hocası / yönetici / eski kayıtlar) */
    function satirOnayli(ex) { return !!(ex && (ex.durationConfirmed || ex.lecturerVerified || ex.durationApproved || ex.actualDuration)); }
    /** Gözetmenin geçerli süresi: kendi kaydı → satırın gerçekleşen süresi → planlanan süre */
    function gozetmenSuresi(ex, pid) {
        const k = gozetmenSureKaydi(ex, pid);
        if (k) return parseInt(k.sure, 10);
        return parseInt(ex && (ex.actualDuration || ex.duration), 10) || AYAR.VARSAYILAN_SURE_DK;
    }
    /** Gözetmenin geçerli başlangıç saati (kendi kaydında farklı saat bildirdiyse o) */
    function gozetmenBaslangicSaati(ex, pid) {
        const k = gozetmenSureKaydi(ex, pid);
        return (k && k.saat) ? k.saat : (ex && ex.time);
    }

    // ------------------------------------------------------------------ Derslik eşleştirmesi
    // Bir sınav satırında birden çok derslik olabilir ("Derslik 1 / Derslik 3"). Gözetmenin hangi
    // derslikte olduğu ayrı bir alanda tutulur (ex.gozetmenDersligi_12 = "Derslik 3").
    // Aynı derslikteki gözetmenlerin süresi aynıdır: biri girince hepsine yazılır.
    // Farklı derslikteki gözetmenler bağımsızdır.
    const DERSLIK_ALANI = 'gozetmenDersligi_';
    function derslikAlani(pid) { return DERSLIK_ALANI + String(pid); }
    function derslikAnahtari(s) {
        return String(s == null ? '' : s).toLocaleUpperCase('tr-TR')
            .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
            .replace(/[^A-Z0-9]/g, '');
    }
    /** "Derslik 1 / Derslik 3" → ["Derslik 1", "Derslik 3"] (boş / "-" / "Belirtilmedi" yok sayılır) */
    function derslikler(exOrLocation) {
        const loc = (exOrLocation && typeof exOrLocation === 'object') ? exOrLocation.location : exOrLocation;
        const seen = new Set();
        return String(loc == null ? '' : loc).split(/\s*[\/;,|]\s*/).map(s => s.trim())
            .filter(s => { const k = derslikAnahtari(s); if (!k || k === 'BELIRTILMEDI' || seen.has(k)) return false; seen.add(k); return true; });
    }
    /** Gözetmenin dersliği: atanmışsa o; sınavda tek derslik varsa o; aksi halde bilinmiyor (null) */
    function gozetmenDersligi(ex, pid) {
        const list = derslikler(ex);
        const atanan = ex && pid != null ? ex[derslikAlani(pid)] : null;
        if (atanan) {
            const hit = list.find(d => derslikAnahtari(d) === derslikAnahtari(atanan));
            if (hit) return hit;
            if (list.length === 0) return String(atanan);
        }
        return list.length === 1 ? list[0] : null;
    }
    function ayniSinavOturumu(a, b) {
        if (!a || !b || a.date !== b.date) return false;
        const ta = saatParcala(a.time), tb = saatParcala(b.time);
        if (!ta || !tb || ta.h !== tb.h || ta.m !== tb.m) return false;
        return derslikAnahtari(a.name) === derslikAnahtari(b.name);
    }
    /**
     * Aynı derslikte görev yapan gözetmenler (aynı satırda ve aynı sınavın aynı saatteki diğer satırlarında).
     * Gözetmenin dersliği bilinmiyorsa boş döner (yalnızca kendisi için kaydedilir).
     * @returns [{ ex, pid }]  (gözetmenin kendisi hariç)
     */
    function ayniDerslikGozetmenleri(ex, pid, exams) {
        const oda = gozetmenDersligi(ex, pid);
        if (!oda) return [];
        const k = derslikAnahtari(oda);
        const out = [];
        const list = (exams && exams.length ? exams : [ex]).filter(Boolean);
        for (const e of list) {
            if (e !== ex && String(e.id) !== String(ex.id) && !ayniSinavOturumu(e, ex)) continue;
            for (const q of gozetmenler(e)) {
                if (String(e.id) === String(ex.id) && q === String(pid)) continue;
                const o = gozetmenDersligi(e, q);
                if (o && derslikAnahtari(o) === k) out.push({ ex: e, pid: q });
            }
        }
        return out;
    }

    /**
     * Süre onaylandı mı? pid verilirse o gözetmen için: kendi kaydı varsa ya da satır bütünüyle onaylıysa.
     * pid verilmezse yalnızca satır onayı (ders hocası görünümü).
     */
    function sureOnaylandi(ex, pid) {
        if (pid != null && pid !== '' && gozetmenSureKaydi(ex, pid)) return true;
        return satirOnayli(ex);
    }
    /** Sınav bitti mi? (henüz bitmemiş sınav için süre teyidi ASLA sorulmaz) */
    function bittiMi(ex, now) { const e = sinavBitis(ex); return !isNaN(e) && now >= e; }
    /** Süre teyidi bekleniyor mu? (bitmiş, sınırdan sonra, onaylanmamış; pid verilirse o gözetmen için) */
    function sureTeyidiBekliyor(ex, now, pid) {
        if (!ex || sureOnaylandi(ex, pid)) return false;
        const s = sinavBaslangic(ex);
        if (isNaN(s) || s < AYAR.SURE_SINIRI) return false;
        return bittiMi(ex, now);
    }
    function gunHatirlatmaSaatiMi(now) {
        const h = trSaat(now);
        return h >= AYAR.GUN_BASLANGIC_SAATI && h < AYAR.GUN_BITIS_SAATI;
    }
    /** Sınava SAAT_ONCE saatten az kaldı ve henüz başlamadı mı? */
    function saatHatirlatmasiZamani(ex, now) {
        const s = sinavBaslangic(ex);
        return !isNaN(s) && s > now && s - now <= AYAR.SAAT_ONCE * 3600000;
    }

    // ------------------------------------------------------------------ Bildirim içerikleri
    function gunAdi(date) {
        try {
            return new Date(date + 'T12:00:00+03:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });
        } catch (e) { return date; }
    }
    const saatSirasi = (a, b) => String(a.time).localeCompare(String(b.time));

    function gunHatirlatmasi({ pid, gun, tarih, sinavlar }, siteUrl) {
        const sorted = [...sinavlar].sort(saatSirasi);
        const ad = gunAdi(tarih);
        const title = gun === 1 ? '📅 Yarın göreviniz var' : `📅 Sıradaki göreviniz ${gun} gün sonra`;
        const body = sorted.length === 1
            ? `${sorted[0].name} — ${ad} ${sorted[0].time}, ${sorted[0].location || 'derslik belirtilmedi'} (${sinavSuresi(sorted[0])} dk)`
            : `${ad}: ${sorted.length} görev — ` + sorted.map(e => `${e.time} ${e.name}`).join(' · ');
        return {
            title, body: body.slice(0, 300),
            tag: `gtu_exam_gun_${pid}_${gun}_${tarih}`,
            data: { tur: TUR.GUN, url: siteUrl || './index.html', examId: sorted[0].id }
        };
    }
    function saatHatirlatmasi(ex, siteUrl) {
        const loc = ex.location ? `Salon: ${ex.location}` : 'Derslik henüz belirtilmedi';
        const dur = ex.duration ? `(${ex.duration} dk)` : '';
        return {
            title: `⏰ ${ex.name} ${AYAR.SAAT_ONCE} saat sonra başlıyor`,
            body: `Saat ${ex.time}'da başlayacak sınav görevi. ${loc} ${dur}`.trim().slice(0, 300),
            tag: `gtu_exam_${ex.id}_${AYAR.SAAT_ONCE}h`,
            data: { tur: TUR.SAAT, url: siteUrl || './index.html', examId: ex.id }
        };
    }
    /** Süre teyidi; action alanı eski service worker sürümleri için korunur */
    function sureTeyidi(sinavlar, siteUrl) {
        const first = sinavlar[0];
        return {
            title: '⏱️ Sınav sürenizi onaylayın',
            body: sinavlar.length === 1
                ? `${first.name} (${first.date} ${first.time}) — ${parseInt(first.scheduledDuration || first.duration, 10) || AYAR.VARSAYILAN_SURE_DK} dk sürdü mü?`
                : `${sinavlar.length} sınavın süresi onay bekliyor. Dokunun ve onaylayın.`,
            tag: 'sure_onay',
            data: { tur: TUR.SURE_SORU, action: 'verify_duration', url: siteUrl || './index.html', examId: first.id, step: 'question' }
        };
    }
    /**
     * Yönetici duyurusunun hedeflediği gözetmen kimlikleri.
     * null → herkes. 'tomorrow_only' gönderim anında dondurulan listeyi (hedefIdleri) kullanır;
     * eski kayıtlarda gönderim gününün ertesi günü sınavı olanlar hesaplanır (bakıldığı günün değil).
     * Site, servis çalışanı ve GitHub iş akışı aynı kuralı kullanır.
     */
    function duyuruHedefleri(db, bc) {
        if (!bc) return [];
        const t = bc.target;
        if (!t || t === 'all') return null;
        if (Array.isArray(bc.hedefIdleri)) return bc.hedefIdleri.map(String);
        if (t === 'tomorrow_only') {
            const at = Date.parse(bc.createdAt) || bc.timestamp || 0;
            if (!at) return [];
            const yarin = trTarih(at + 24 * 60 * 60 * 1000);
            const ids = new Set();
            for (const ex of (db && db.exams) || []) if (ex && ex.date === yarin) gozetmenler(ex).forEach(id => ids.add(id));
            return [...ids];
        }
        const list = Array.isArray(t) ? t : (typeof t === 'object' ? Object.values(t) : [t]);
        return list.filter(x => x !== null && x !== undefined && x !== '').map(String);
    }
    function duyuruHedefMi(db, bc, pid) {
        const hedef = duyuruHedefleri(db, bc);
        if (hedef === null) return true;
        return pid !== null && pid !== undefined && pid !== '' && hedef.includes(String(pid));
    }
    function duyuru(bc, siteUrl) {
        return {
            title: bc.title || '📢 GTÜ Gözetmenlik Yönetici Bildirimi',
            body: String(bc.message || '').slice(0, 300),
            tag: `gtu_exam_bc_${bc.id}`,
            data: { tur: TUR.DUYURU, url: siteUrl || './index.html', broadcastId: bc.id, priority: bc.priority || 'normal' }
        };
    }

    // ------------------------------------------------------------------ Dokunma davranışı
    /**
     * Bildirime dokununca ne yapılacak?
     * Süre teyidi penceresi YALNIZCA süre teyidi türlerinde açılır.
     * Eski bildirimler (tur alanı yok) için yalnızca açık action değerine bakılır; varsayılan YOKTUR.
     * @returns {{ sureEkrani: boolean, examId?, step?, url: string }}
     */
    function tiklamaHedefi(data) {
        const d = data || {};
        const url = d.url || './index.html';
        let sure = false;
        if (d.tur) sure = d.tur === TUR.SURE_SORU || d.tur === TUR.SURE_GIRIS;
        else sure = d.action === 'verify_duration' || d.action === 'input_duration';
        if (!sure || d.examId == null || d.examId === '') return { sureEkrani: false, url };
        const step = d.step || ((d.tur === TUR.SURE_GIRIS || d.action === 'input_duration') ? 'input' : 'question');
        return { sureEkrani: true, examId: d.examId, step, url };
    }

    // ------------------------------------------------------------------ Planlayıcı
    /**
     * Şu an gönderilmesi gereken bildirimleri hesaplar (yan etkisiz).
     * @param db    { exams: [...] }
     * @param now   epoch ms
     * @param opts  {
     *   kisiler:   null (herkes) veya [gözetmenId, ...],
     *   durum:     önceki gönderim kaydı: { [anahtar]: { count, last } } (salt okunur kullanılır),
     *   turler:    hesaplanacak türler (varsayılan: GUN, SAAT, SURE_SORU),
     *   siteUrl,
     *   sureGecikmeMs, sureTekrarMs, sureEnFazla, sureGeriyeMs  (sunucu varsayılanları AYAR'da)
     * }
     * @returns [{ tur, pid, anahtarlar: [..], sinavlar: [..], payload }]
     */
    function planla(db, now, opts) {
        const o = opts || {};
        const durum = o.durum || {};
        const turler = o.turler || [TUR.GUN, TUR.SAAT, TUR.SURE_SORU];
        const kisiler = o.kisiler ? new Set(o.kisiler.map(String)) : null;
        const gecikme = o.sureGecikmeMs != null ? o.sureGecikmeMs : AYAR.SURE_GECIKME_MS;
        const tekrar = o.sureTekrarMs != null ? o.sureTekrarMs : AYAR.SURE_TEKRAR_MS;
        const enFazla = o.sureEnFazla != null ? o.sureEnFazla : AYAR.SURE_EN_FAZLA;
        const geriye = o.sureGeriyeMs != null ? o.sureGeriyeMs : AYAR.SURE_GERIYE_MS;
        const exams = (db && Array.isArray(db.exams) ? db.exams : []).filter(Boolean);
        const kimin = (ex) => gozetmenler(ex).filter(pid => !kisiler || kisiler.has(pid));
        const out = [];

        // 1) Süre teyidi (sınav başına gözetmen anahtarı: `${examId}:${pid}`)
        if (turler.includes(TUR.SURE_SORU)) {
            const byPid = new Map();
            for (const ex of exams) {
                if (satirOnayli(ex)) continue;
                const s0 = sinavBaslangic(ex);
                if (isNaN(s0) || s0 < AYAR.SURE_SINIRI || !bittiMi(ex, now)) continue;
                const end = sinavBitis(ex);
                if (now < end + gecikme || now - end > geriye) continue;
                for (const pid of kimin(ex)) {
                    // Gözetmen kendi süresini girdiyse yalnızca ona sorulmaz; diğer gözetmenlere sorulmaya devam eder
                    if (gozetmenSureKaydi(ex, pid)) continue;
                    const key = `${ex.id}:${pid}`;
                    const s = durum[key];
                    if (s && ((s.count || 0) >= enFazla || now - Date.parse(s.last) < tekrar)) continue;
                    if (!byPid.has(pid)) byPid.set(pid, []);
                    byPid.get(pid).push(ex);
                }
            }
            for (const [pid, list] of byPid) {
                list.sort((a, b) => sinavBaslangic(a) - sinavBaslangic(b));
                out.push({ tur: TUR.SURE_SORU, pid, sinavlar: list, anahtarlar: list.map(ex => `${ex.id}:${pid}`), payload: sureTeyidi(list, o.siteUrl) });
            }
        }

        // 2) Gün hatırlatmaları (gözetmen + gün başına tek bildirim; aynı gündeki görevler birleşir)
        if (turler.includes(TUR.GUN) && gunHatirlatmaSaatiMi(now)) {
            const groups = new Map();
            for (const ex of exams) {
                if (isNaN(sinavBaslangic(ex))) continue;
                const gun = gunFarki(ex, now);
                if (!AYAR.HATIRLATMA_GUNLERI.includes(gun)) continue;
                for (const pid of kimin(ex)) {
                    const key = `gun:${pid}:${gun}:${ex.date}`;
                    if (durum[key]) continue;
                    if (!groups.has(key)) groups.set(key, { pid, gun, tarih: ex.date, sinavlar: [], key });
                    groups.get(key).sinavlar.push(ex);
                }
            }
            for (const g of groups.values()) {
                out.push({ tur: TUR.GUN, pid: g.pid, gun: g.gun, sinavlar: g.sinavlar, anahtarlar: [g.key], payload: gunHatirlatmasi(g, o.siteUrl) });
            }
        }

        // 3) Sınavdan SAAT_ONCE saat önce
        if (turler.includes(TUR.SAAT)) {
            for (const ex of exams) {
                if (!saatHatirlatmasiZamani(ex, now)) continue;
                for (const pid of kimin(ex)) {
                    const key = `saat${AYAR.SAAT_ONCE}:${pid}:${ex.id}`;
                    if (durum[key]) continue;
                    out.push({ tur: TUR.SAAT, pid, sinavlar: [ex], anahtarlar: [key], payload: saatHatirlatmasi(ex, o.siteUrl) });
                }
            }
        }
        return out;
    }

    /** Gönderilen bir planı kayda işler (durum nesnesini değiştirir) */
    function kaydet(durum, item, now) {
        const stamp = new Date(now).toISOString();
        for (const k of item.anahtarlar) {
            const prev = durum[k];
            durum[k] = { count: ((prev && prev.count) || 0) + 1, last: stamp };
        }
        return durum;
    }

    return {
        TUR, AYAR,
        saatParcala, sinavBaslangic, sinavSuresi, sinavBitis, trTarih, trSaat, gunFarki,
        gozetmenler, gozetmeniMi, sureOnaylandi, bittiMi, sureTeyidiBekliyor, gunHatirlatmaSaatiMi, saatHatirlatmasiZamani,
        SURE_ALANI, sureAlani, gozetmenSureKaydi, satirOnayli, gozetmenSuresi, gozetmenBaslangicSaati,
        DERSLIK_ALANI, derslikAlani, derslikAnahtari, derslikler, gozetmenDersligi, ayniDerslikGozetmenleri,
        gunHatirlatmasi, saatHatirlatmasi, sureTeyidi, duyuru, duyuruHedefleri, duyuruHedefMi,
        tiklamaHedefi, planla, kaydet
    };
});
