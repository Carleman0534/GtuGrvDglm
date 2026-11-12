/**
 * "Bu görev neden bana geldi?" — atama gerekçesi
 *
 * Sistem bir görevi şöyle dağıtır: o saatte gerçekten müsait olanları ayırır (kısıt, aynı saatte
 * başka görev, Cuma namazı, görev üst sınırı), kalanlar arasından puanı en düşük olanı seçer.
 * Bu dosya her yeni atamada o anın fotoğrafını exam.atamaGerekce[gözetmenId] altına yazar:
 *   y: yöntem (otomatik / yonetici / takas / ice_aktarim)
 *   t: zaman, p: atama anındaki puan, r: puan sırası (1 = en düşük), n: gözetmen sayısı
 *   d: puanı daha düşük olan kişi sayısı, s: bu kişilerin neden seçilmediği (yalnızca sayılar)
 * İsim tutulmaz; kimsenin kısıtı başkasına görünmez.
 *
 * Yeni atamalar veri_koruma.js'deki kayıt anında, sunucudaki son kopyayla karşılaştırılarak bulunur.
 * Kaydı olmayan eski atamalar için açıklama bugünkü verilerden yaklaşık olarak hesaplanır.
 */
(function () {
    'use strict';

    const S = (v) => String(v);
    const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const proctorsOf = (ex) => (Array.isArray(ex.proctorIds) && ex.proctorIds.length ? ex.proctorIds : (ex.proctorId != null ? [ex.proctorId] : []))
        .filter(p => p !== null && p !== undefined && p !== '').map(S);

    const METHOD_TEXT = {
        otomatik: '🤖 Sistem otomatik atadı: o saatte uygun olanlar arasından sıralamada en önde olan gözetmen seçilir.',
        ice_aktarim: '📥 Sınav programı içe aktarılırken sistem otomatik atadı (o saatte uygun olanlar arasından sıralamada en önde olan).',
        yonetici: '👤 Yönetici bu görevi elle atadı.',
        takas: '🔄 Görev size takas ya da görev devri (Pazar Yeri) ile geçti.',
        dengeleme: '⚖️ Yöneticinin çalıştırdığı adalet dengelemesiyle görev, puanı daha yüksek bir gözetmenden size aktarıldı.'
    };

    // --- Kod içinden atama yöntemini bildirmek için (otomatik atama, takas vb.) ---
    const hints = new Map(); // examId -> { method, at }
    window.noteAtamaYontemi = function (examId, method) {
        if (examId === undefined || examId === null) return;
        hints.set(S(examId), { method, at: Date.now() });
    };
    function methodFor(examId) {
        const h = hints.get(S(examId));
        if (h && Date.now() - h.at < 10 * 60 * 1000) return h.method;
        // Toplu işlemler (programı içe aktarma vb.) tek bir genel ipucu bırakır
        const g = hints.get('*');
        if (g && Date.now() - g.at < 5 * 60 * 1000) return g.method;
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true' || localStorage.getItem('isAdmin') === 'true';
        // Yönetici olmayan kullanıcılar görevleri yalnızca takas / Pazar Yeri ile değiştirebilir
        return isAdmin ? 'yonetici' : 'takas';
    }

    // --- Bir gözetmen o saatte neden seçilemezdi? (logic.js isProctorTrulyFree ile aynı kurallar) ---
    function blockReason(staff, ex) {
        const date = ex.date, time = ex.time;
        const duration = parseInt(ex.duration, 10) || 60;
        try {
            if (typeof isAvailable === 'function' && !isAvailable(staff.name, date, time, duration)) return 'kisit';
        } catch (e) {}

        const start = getSafeDate(date, time);
        const end = new Date(start.getTime() + (duration + 15) * 60000);
        const busy = DB.exams.some(o => {
            if (!o || S(o.id) === S(ex.id) || o.date !== date) return false;
            if (!proctorsOf(o).includes(S(staff.id))) return false;
            const os = getSafeDate(o.date, o.time);
            const oe = new Date(os.getTime() + ((parseInt(o.duration, 10) || 60) + 15) * 60000);
            return start < oe && end > os;
        });
        if (busy) return 'cakisma';

        if (new Date(date).getDay() === 5 && typeof timeToMins === 'function') {
            const gender = staff.gender || (typeof predictGender === 'function' ? predictGender(staff.name) : '');
            const sm = timeToMins(time), em = sm + duration;
            if (gender === 'Erkek' && sm < timeToMins('14:00') && em > timeToMins('12:30')) return 'cuma';
        }

        try {
            if (typeof isProctorTrulyFree === 'function' &&
                !isProctorTrulyFree(staff.id, date, time, duration, ex.id, !!ex.isNonExam, ex.name || '')) return 'diger';
        } catch (e) {}

        // Görev üst sınırı yalnızca etkinse sayılır: herkes sınırın üstündeyse atama sınırı esnetir (findBestProctor)
        const max = gorevUstSiniri();
        if ((staff.taskCount || 0) >= max && limitEtkinMi()) return 'limit';
        return 'uygun';
    }
    function gorevUstSiniri() { return (typeof GLOBAL_LIMITS !== 'undefined' && GLOBAL_LIMITS.MAX_TASKS) || 6; }
    function limitEtkinMi() {
        const max = gorevUstSiniri();
        return proctorPool(null).some(s => (s.taskCount || 0) < max);
    }

    // --- Karşılaştırma havuzu: yalnızca aktif gözetmenler (gözetmenlik almayan öğretim üyeleri sayılmaz) ---
    function proctorPool(me) {
        const all = (DB.staff || []).filter(Boolean);
        const pool = typeof getActiveProctorStaff === 'function' ? getActiveProctorStaff(all) : all;
        return me && !pool.some(s => S(s.id) === S(me.id)) ? pool.concat([me]) : pool;
    }
    const isNonExamTask = (ex) => (typeof shouldCountAsNonExam === 'function' ? shouldCountAsNonExam(ex) : !!ex.isNonExam);

    // --- O anın fotoğrafı ---
    // Atama kuralı (logic.js findBestProctor ile aynı):
    //   sınav görevleri  → dönem sonu beklenen puan (bugünkü puan + kalan dönemde müsaitliğe göre beklenen pay)
    //   sınav dışı görev → sınav dışı puan
    function snapshot(ex, pid, method) {
        if (!window.DB || !Array.isArray(DB.staff) || !ex || !ex.date || !ex.time) return null;
        const me = DB.staff.find(s => s && S(s.id) === S(pid));
        if (!me) return null;
        const onExam = proctorsOf(ex);
        const exScore = Number(ex.score) || 0;
        const nonExam = isNonExamTask(ex);
        const field = nonExam ? 'nonExamScore' : 'totalScore';
        // Bu sınavın puanı atanan kişilerin toplamına zaten eklenmiş olabilir: atama öncesine göre karşılaştır
        const scoreBefore = (s) => round2((Number(s[field]) || 0) - (onExam.includes(S(s.id)) ? exScore : 0));
        let fut = null;
        if (!nonExam && typeof getFutureBalanceMap === 'function') { try { fut = getFutureBalanceMap(); } catch (e) { fut = null; } }
        const extra = (s) => (fut && fut[S(s.id)] ? fut[S(s.id)].beklenen || 0 : 0);
        const key = (s) => scoreBefore(s) + extra(s);

        const myKey = key(me);
        const others = proctorPool(me).filter(s => S(s.id) !== S(pid) && !onExam.includes(S(s.id)));
        const lower = others.filter(s => key(s) < myKey - 0.005);
        const counts = { kisit: 0, cakisma: 0, cuma: 0, limit: 0, diger: 0, uygun: 0 };
        lower.forEach(s => { counts[blockReason(s, ex)]++; });
        Object.keys(counts).forEach(k => { if (!counts[k]) delete counts[k]; });

        const snap = {
            y: method,
            t: new Date().toISOString(),
            k: nonExam ? 'sinavdisi' : (fut ? 'donem' : 'puan'),
            p: scoreBefore(me),
            r: lower.length + 1,
            n: others.length + 1,
            d: lower.length,
            s: counts
        };
        if (fut && fut[S(pid)]) {
            snap.bp = round2(fut[S(pid)].beklenen);       // kalan dönemde beklenen pay
            if (fut[S(pid)].kisitli) snap.kz = true;        // kalan dönemde az müsait
        }
        return snap;
    }

    // --- Kayıt anında yeni atamaları bul ve gerekçelerini yaz (veri_koruma.js çağırır) ---
    window.recordAssignmentReasons = function (base) {
        if (!window.DB || !Array.isArray(DB.exams) || !base || !Array.isArray(base.exams)) return;
        const before = new Map();
        base.exams.forEach(e => { if (e && e.id !== undefined) before.set(S(e.id), new Set(proctorsOf(e))); });

        DB.exams.forEach(ex => {
            if (!ex || ex.id === undefined) return;
            const now = proctorsOf(ex);
            const old = before.get(S(ex.id)) || new Set();
            const fresh = now.filter(pid => !old.has(pid));

            // Görevden ayrılanların gerekçesini ve yönetici açıklamasını temizle
            ['atamaGerekce', 'atamaNotu'].forEach(field => {
                if (!ex[field] || typeof ex[field] !== 'object') return;
                Object.keys(ex[field]).forEach(pid => { if (!now.includes(pid)) delete ex[field][pid]; });
                if (!Object.keys(ex[field]).length) delete ex[field];
            });
            if (!fresh.length) return;

            const method = methodFor(ex.id);
            fresh.forEach(pid => {
                const snap = snapshot(ex, pid, method);
                if (!snap) return;
                if (!ex.atamaGerekce || typeof ex.atamaGerekce !== 'object') ex.atamaGerekce = {};
                ex.atamaGerekce[pid] = snap;
            });
            hints.delete(S(ex.id));
        });
    };

    // --- Yöneticinin görevlendirme açıklaması (exam.atamaNotu[gözetmenId] = { m: metin, t: zaman }) ---
    // Gözetmen başına tutulur: görev takasla başka birine geçerse açıklama yeni kişiye taşınmaz.
    window.setAtamaNotu = function (ex, pids, metin) {
        if (!ex || !Array.isArray(pids)) return;
        const text = String(metin || '').trim().slice(0, 600);
        pids.map(S).forEach(pid => {
            if (text) {
                if (!ex.atamaNotu || typeof ex.atamaNotu !== 'object') ex.atamaNotu = {};
                ex.atamaNotu[pid] = { m: text, t: new Date().toISOString() };
            } else if (ex.atamaNotu && ex.atamaNotu[pid]) {
                delete ex.atamaNotu[pid];
            }
        });
        if (ex.atamaNotu && !Object.keys(ex.atamaNotu).length) delete ex.atamaNotu;
    };
    // Düzenleme penceresinde gösterilecek açıklama (gözetmenlerdeki ilk açıklama)
    window.getAtamaNotuOrtak = function (ex) {
        if (!ex || !ex.atamaNotu) return '';
        const n = proctorsOf(ex).map(pid => ex.atamaNotu[pid]).find(x => x && x.m);
        return n ? n.m : '';
    };

    // --- Açıklama metni ---
    function reasonFor(ex, pid) {
        const saved = ex.atamaGerekce && ex.atamaGerekce[S(pid)];
        if (saved) return { r: saved, approx: false };
        const snap = snapshot(ex, pid, null);
        return snap ? { r: snap, approx: true } : null;
    }

    // --- O saatteki durum: diğer gözetmenler o sınav saatinde ne yapıyor? (takvimden; eski görevlerde de geçerli) ---
    function slotDurumu(ex, pid) {
        const me = DB.staff.find(s => s && S(s.id) === S(pid));
        const onExam = proctorsOf(ex);
        const others = proctorPool(me).filter(s => S(s.id) !== S(pid));
        const c = { bu_sinav: 0, kisit: 0, cakisma: 0, cuma: 0, limit: 0, diger: 0, uygun: 0 };
        others.forEach(s => {
            if (onExam.includes(S(s.id))) { c.bu_sinav++; return; }
            c[blockReason(s, ex)]++;
        });
        return { toplam: others.length, c };
    }

    // --- Dönemdeki yeri: puan, görev sayısı, akşam/hafta sonu görevleri (aynı görev türünde) ---
    function donemYeri(ex, pid) {
        const me = DB.staff.find(s => s && S(s.id) === S(pid));
        if (!me) return null;
        const nonExam = isNonExamTask(ex);
        const field = nonExam ? 'nonExamScore' : 'totalScore';
        const tfield = nonExam ? 'nonExamTaskCount' : 'taskCount';
        const pool = proctorPool(me);
        const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const score = (s) => Number(s[field]) || 0;
        const myScore = score(me);
        const rankOf = (val, id) => 1 + pool.filter(s => S(s.id) !== S(id) && score(s) > val + 0.005).length;  // 1 = en yüksek puan
        const exScore = Number(ex.score) || 0;

        // Akşam / hafta sonu görevleri (katsayı ≥ 1,5), güncel dönemde
        let term = null;
        try { if (window.FinalForecastEngine && FinalForecastEngine.getAcademicTerm) term = (d) => FinalForecastEngine.getAcademicTerm(d).key; } catch (e) {}
        const curTerm = term ? term(ex.date) : null;
        const zorCount = (s) => (DB.exams || []).filter(e => e && proctorsOf(e).includes(S(s.id)) && isNonExamTask(e) === nonExam
            && (parseFloat(e.katsayi) || 1) >= 1.5 && (!term || term(e.date) === curTerm)).length;

        return {
            nonExam,
            puan: round2(myScore),
            ort: round2(avg(pool.map(score))),
            sira: rankOf(myScore, me.id),
            n: pool.length,
            gorev: Number(me[tfield]) || 0,
            gorevOrt: round2(avg(pool.map(s => Number(s[tfield]) || 0))),
            zor: zorCount(me),
            zorOrt: round2(avg(pool.map(zorCount))),
            olmasaydiPuan: round2(myScore - exScore),
            olmasaydiSira: rankOf(myScore - exScore, me.id)
        };
    }

    function buildHtml(ex, pid) {
        const info = reasonFor(ex, pid);
        const staff = DB.staff.find(s => S(s.id) === S(pid));
        const fmt = typeof formatTarih === 'function' ? formatTarih : (d) => d;
        const sayi = (v) => String(v).replace('.', ',');
        const BK = window.BildirimKurallari;
        const oda = BK && typeof BK.derslikler === 'function' && BK.derslikler(ex).length > 1 ? BK.gozetmenDersligi(ex, pid) : null;
        const birlikte = proctorsOf(ex).filter(p => p !== S(pid))
            .map(p => (DB.staff.find(s => s && S(s.id) === p) || {}).name).filter(Boolean);

        let html = `
            <div class="atama-gerekce-exam">
                <strong>${esc(ex.name)}</strong>
                <span>📅 ${esc(fmt(ex.date))} · ⏰ ${esc(ex.time)} · 📍 ${oda ? `<b>${esc(oda)}</b> (${esc(ex.location)})` : esc(ex.location || '-')}</span>
                ${staff ? `<span>👤 ${esc(staff.name)}${birlikte.length ? ` · 👥 Birlikte: ${esc(birlikte.join(', '))}` : ''}</span>` : ''}
            </div>`;
        const not = ex.atamaNotu && ex.atamaNotu[S(pid)];
        if (not && not.m) {
            const notTarih = not.t ? new Date(not.t).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
            html += `
            <div class="atama-gerekce-not">
                <div class="atama-gerekce-not-baslik">📝 Yöneticinin açıklaması${notTarih ? ` <span>(${esc(notTarih)})</span>` : ''}</div>
                <div class="atama-gerekce-not-metin">${esc(not.m).replace(/\n/g, '<br>')}</div>
            </div>`;
        }
        if (!info) return html + '<p>Bu görev için açıklama hesaplanamadı.</p>';

        const r = info.r, s = r.s || {};
        const zaman = info.approx ? 'bugünkü puanlara göre' : 'atama anında';
        const engelli = (s.kisit || 0) + (s.cakisma || 0) + (s.cuma || 0) + (s.limit || 0) + (s.diger || 0);

        // 📌 Kısaca
        let kisaca;
        if (!r.d) kisaca = `Sıralamada <strong>1.</strong> sıradaydınız (${zaman}, ${r.n} gözetmen): sizden önde kimse yoktu.`;
        else if (!s.uygun && r.d === 1) kisaca = `Sıralamada <strong>${r.r}.</strong> sıradaydınız (${zaman}, ${r.n} gözetmen). Önünüzdeki <strong>1 kişi</strong> o saatte uygun değildi.`;
        else if (!s.uygun) kisaca = `Sıralamada <strong>${r.r}.</strong> sıradaydınız (${zaman}, ${r.n} gözetmen). Önünüzdeki <strong>${r.d}</strong> kişinin <strong>hiçbiri</strong> o saatte uygun değildi.`;
        else kisaca = `Sıralamada <strong>${r.r}.</strong> sıradaydınız (${zaman}, ${r.n} gözetmen). Önünüzdeki ${r.d} kişiden <strong>${engelli} kişi</strong> o saatte uygun değildi, <strong>${s.uygun} kişi</strong> uygundu.`;
        html += `<div class="atama-gerekce-kisaca">📌 ${kisaca}</div>`;
        if (r.y && METHOD_TEXT[r.y] && !info.approx) html += `<p class="atama-gerekce-method">${METHOD_TEXT[r.y]}</p>`;

        // ⏰ O saatteki durum (takvimden; her zaman geçerli)
        const slot = slotDurumu(ex, pid);
        const c = slot.c, parcalar = [];
        if (c.bu_sinav) parcalar.push(`<li><strong>${c.bu_sinav} kişi</strong> bu sınavda sizinle birlikte görevli</li>`);
        if (c.cakisma) parcalar.push(`<li><strong>${c.cakisma} kişi</strong> aynı saatte başka bir sınavda görevli</li>`);
        if (c.kisit) parcalar.push(`<li><strong>${c.kisit} kişi</strong> o saatte kısıtlı (ders, izin vb.)</li>`);
        if (c.cuma) parcalar.push(`<li><strong>${c.cuma} kişi</strong> Cuma namazı saatine denk geliyor</li>`);
        if (c.limit) parcalar.push(`<li><strong>${c.limit} kişi</strong> görev üst sınırında</li>`);
        if (c.diger) parcalar.push(`<li><strong>${c.diger} kişi</strong> başka bir kural nedeniyle uygun değil</li>`);
        if (c.uygun) parcalar.push(`<li><strong>${c.uygun} kişi</strong> uygun</li>`);
        html += `<div class="atama-gerekce-blok"><div class="atama-gerekce-baslik">⏰ ${esc(fmt(ex.date))} ${esc(ex.time)} için diğer ${slot.toplam} gözetmen</div>
            <ul class="atama-gerekce-list">${parcalar.join('') || '<li>—</li>'}</ul></div>`;

        // ⚖️ Sıralama: önünüzdekiler neden seçilmedi
        const puanAdi = r.k === 'sinavdisi' ? 'Bu görev hariç sınav dışı puanınız' : 'Bu görev hariç puanınız';
        let sira = `<div class="atama-gerekce-blok"><div class="atama-gerekce-baslik">⚖️ Sıralama (${zaman})</div>
            <div>${puanAdi}: <strong>${sayi(r.p)}</strong>${r.bp != null ? ` + kalan dönemde beklenen pay <strong>${sayi(Math.round(r.bp))}</strong>` : ''} → <strong>${r.r}.</strong> sıra / ${r.n}</div>`;
        if (r.d) {
            const rows = [];
            if (s.kisit) rows.push(`<li><strong>${s.kisit}</strong> kişinin o saatte kısıtı vardı (ders, izin vb.)</li>`);
            if (s.cakisma) rows.push(`<li><strong>${s.cakisma}</strong> kişinin aynı saatte başka sınav görevi vardı</li>`);
            if (s.cuma) rows.push(`<li><strong>${s.cuma}</strong> kişi Cuma namazı saatine (12:30–14:00) denk geldiği için atanamazdı</li>`);
            if (s.diger) rows.push(`<li><strong>${s.diger}</strong> kişi başka bir kural nedeniyle uygun değildi</li>`);
            if (s.limit) rows.push(`<li><strong>${s.limit}</strong> kişi görev üst sınırına ulaşmıştı</li>`);
            if (s.uygun) rows.push(`<li><strong>${s.uygun}</strong> kişi o saatte uygundu</li>`);
            sira += `<div>Önünüzdeki <strong>${r.d}</strong> kişi:</div><ul class="atama-gerekce-list">${rows.join('')}</ul>`;
            if (s.uygun) {
                let neden;
                if (info.approx) neden = 'Bu kişilerin puanı atamadan sonra değişti; atama günü sizden yüksek olabilirler.';
                else if (r.y === 'yonetici') neden = 'Görevi yönetici elle atadığı için sıra uygulanmadı.';
                else if (r.y === 'dengeleme') neden = 'Adalet dengelemesi puanları birbirine yaklaştırmak için görevleri yeniden dağıtır.';
                else if (r.y === 'takas') neden = 'Görev size takas ya da devirle geçtiği için sıra uygulanmadı.';
                else neden = 'Toplu atamada görevler sırayla dağıtılır; bu kişilere aynı dağıtımda başka görevler verilmiş olabilir.';
                sira += `<div class="atama-gerekce-note">${neden}</div>`;
            }
        }
        if (r.kz) sira += `<div class="atama-gerekce-note">📅 Kısıtlarınız nedeniyle dönemin kalanında daha az sınava girebileceğiniz öngörüldü; müsait olduğunuz sınavlarda önceliğiniz yükseldi.</div>`;
        sira += '</div>';
        html += sira;

        // 📊 Dönemdeki yeriniz
        const y = donemYeri(ex, pid);
        if (y) {
            const fark = round2(y.puan - y.ort);
            html += `<div class="atama-gerekce-blok"><div class="atama-gerekce-baslik">📊 Genel durumunuz${y.nonExam ? ' (sınav dışı görevler)' : ''}</div>
                <ul class="atama-gerekce-list">
                    <li>Toplam puanınız <strong>${sayi(y.puan)}</strong> · gözetmen ortalaması ${sayi(y.ort)} (<strong>${fark >= 0 ? '+' : ''}${sayi(fark)}</strong>) · en yüksek puandan ${y.sira}. / ${y.n}</li>
                    <li>Toplam görev sayınız <strong>${y.gorev}</strong> · ortalama ${sayi(y.gorevOrt)}</li>
                    <li>Bu dönem akşam / hafta sonu göreviniz <strong>${y.zor}</strong> · ortalama ${sayi(y.zorOrt)}</li>
                    <li>Bu görev olmasaydı: puanınız ${sayi(y.olmasaydiPuan)}, sıranız ${y.olmasaydiSira}. / ${y.n}</li>
                </ul></div>`;
        }

        // 💡 Ne yapabilirsiniz: bugün o saatte uygun ve sıralamada önünüzde olan kişi varsa görevi devretmek dengeyi iyileştirir
        const bugun = info.approx ? r : snapshot(ex, pid, null);
        const ileride = getSafeDate(ex.date, ex.time).getTime() > Date.now();
        if (ileride && bugun && bugun.s && bugun.s.uygun) {
            html += `<div class="atama-gerekce-oneri">💡 Bugün o saatte uygun ve sıralamada sizden önde <strong>${bugun.s.uygun}</strong> kişi var. Görevi Pazar Yeri'ne bırakırsanız onlardan birine geçmesi dengeyi iyileştirir.
                ${typeof window.initiateOpenSwap === 'function' ? `<div><button type="button" class="atama-gerekce-aksiyon" onclick="closeAtamaGerekcesi(); initiateOpenSwap('${esc(ex.id)}')">🛒 Pazar Yeri'ne bırak</button></div>` : ''}
            </div>`;
        }

        const kuralKisa = { donem: 'dönem sonu beklenen puan (bugünkü puan + kalan dönemde müsaitliğinize göre beklenen pay)', puan: 'toplam puan', sinavdisi: 'sınav dışı puan' }[r.k || 'puan'];
        html += `<p class="atama-gerekce-foot">Kural: o saatte uygun olanlar arasından <strong>${kuralKisa}</strong> en düşük olan görev alır.${info.approx ? ' Bu görevin atama anı kaydı yok; sıralama bugünkü verilerle hesaplandı.' : ''} Yanlışlık olduğunu düşünüyorsanız yöneticiye bildirebilirsiniz.</p>`;
        return html;
    }

    // --- Pencere ---
    window.showAtamaGerekcesi = function (examId, staffId) {
        if (!window.DB || !Array.isArray(DB.exams)) return;
        const ex = DB.exams.find(e => e && S(e.id) === S(examId));
        if (!ex) return;
        const pid = staffId !== undefined && staffId !== null && staffId !== '' ? staffId
            : (typeof getDeviceStaffId === 'function' ? getDeviceStaffId() : null);
        if (pid === null || pid === undefined) return;

        let modal = document.getElementById('modal-atama-gerekce');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-atama-gerekce';
            modal.className = 'modal hidden';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 480px;">
                    <div class="modal-header">
                        <h3>ℹ️ Bu görev neden bana geldi?</h3>
                        <button class="close-modal" type="button" onclick="closeAtamaGerekcesi()">&times;</button>
                    </div>
                    <div class="modal-body atama-gerekce-body"></div>
                </div>`;
            modal.addEventListener('click', (e) => { if (e.target === modal) window.closeAtamaGerekcesi(); });
            document.body.appendChild(modal);
        }
        modal.querySelector('.atama-gerekce-body').innerHTML = buildHtml(ex, pid);
        modal.classList.remove('hidden');
    };
    window.closeAtamaGerekcesi = function () {
        const modal = document.getElementById('modal-atama-gerekce');
        if (modal) modal.classList.add('hidden');
    };

    // Test ve yönetici paneli için
    window.getAtamaGerekcesi = reasonFor;
    window.atamaGerekcesiHtml = buildHtml;
    window.atamaGerekcesiFotografi = snapshot;
})();
