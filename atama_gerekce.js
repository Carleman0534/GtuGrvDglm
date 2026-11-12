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

        const max = (typeof GLOBAL_LIMITS !== 'undefined' && GLOBAL_LIMITS.MAX_TASKS) || 6;
        if ((staff.taskCount || 0) >= max) return 'limit';
        return 'uygun';
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

    function buildHtml(ex, pid) {
        const info = reasonFor(ex, pid);
        const staff = DB.staff.find(s => S(s.id) === S(pid));
        const fmt = typeof formatTarih === 'function' ? formatTarih : (d) => d;
        let html = `
            <div class="atama-gerekce-exam">
                <strong>${esc(ex.name)}</strong>
                <span>📅 ${esc(fmt(ex.date))} · ⏰ ${esc(ex.time)} · 📍 ${esc(ex.location || '-')}</span>
                ${staff ? `<span>👤 ${esc(staff.name)}</span>` : ''}
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
        const sayi = (v) => String(v).replace('.', ',');
        const kural = r.k || 'puan';   // eski kayıtlarda kural alanı yok: o zamanki kural puandı
        const kuralMetni = {
            donem: 'Sınav görevlerinde sıralama <strong>dönem sonu beklenen puana</strong> göre yapılır: bugünkü puan + dönemin kalanında (tahmini finaller, mazeretler) müsaitliğinize göre almanız beklenen pay. Kalan dönemde az müsait olan kişi, müsait olduğu sınavlarda öne geçer.',
            puan: 'Sıralama o sırada <strong>toplam puana</strong> göre yapılıyordu: puanı en düşük olan önce görev alır.',
            sinavdisi: 'Sınav dışı görevlerde sıralama <strong>sınav dışı puana</strong> göre yapılır: bu puanı en düşük olan önce görev alır.'
        }[kural];

        // Eski (kaydı tutulmamış) atamalar: atama anındaki puanlar bilinmediği için "sizden düşük puanlı kim vardı"
        // listesi gösterilmez. Bugünkü puanlarla hesaplamak yanıltıcı olurdu (o kişiler o gün sizden düşük olmayabilir).
        if (info.approx) {
            html += `<p class="atama-gerekce-note">ℹ️ Bu görev, açıklama kaydı tutulmaya başlamadan önce atanmış. Atama anındaki puanlar ve kimlerin uygun olduğu kayıtlı olmadığı için o güne ait bir karşılaştırma gösterilemiyor.</p>`;
            html += `<p>${kuralMetni}</p>`;
            html += `<p>Bilgi için, <strong>bugün</strong> ${kural === 'sinavdisi' ? 'sınav dışı puanınız' : 'puanınız'} <strong>${sayi(r.p)}</strong>${r.bp != null ? ` (kalan dönemde beklenen pay +${sayi(Math.round(r.bp))})` : ''}; gözetmenler arasında sıralamada <strong>${r.r}.</strong> sıradasınız (toplam ${r.n} kişi, 1 = sıradaki göreve en yakın).</p>`;
            html += `<p class="atama-gerekce-foot">Bir yanlışlık olduğunu düşünüyorsanız yöneticiye bildirebilir ya da görevinizi Pazar Yeri'ne koyabilirsiniz.</p>`;
            return html;
        }

        if (r.y && METHOD_TEXT[r.y]) html += `<p class="atama-gerekce-method">${METHOD_TEXT[r.y]}</p>`;
        html += `<p>${kuralMetni}</p>`;

        const puanAdi = kural === 'sinavdisi' ? 'sınav dışı puanınız' : 'puanınız';
        html += `<p>Atama anındaki ${puanAdi}: <strong>${sayi(r.p)}</strong>${r.bp != null ? ` · kalan dönemde beklenen pay: <strong>+${sayi(Math.round(r.bp))}</strong>` : ''}.
            Gözetmenler arasında sıralamada <strong>${r.r}.</strong> sıradaydınız (toplam ${r.n} kişi, 1 = göreve en yakın).</p>`;
        if (r.kz) html += `<p class="atama-gerekce-note">📅 Kısıtlarınız nedeniyle dönemin kalanında daha az sınava girebileceğiniz öngörüldü; bu yüzden müsait olduğunuz sınavlarda önceliğiniz yükseldi.</p>`;

        if (!r.d) {
            html += `<p>O sırada <strong>sıralamada sizden önde kimse yoktu</strong>; kurala göre görev size gelir.</p>`;
        } else {
            const rows = [];
            if (s.kisit) rows.push(`<li><strong>${s.kisit}</strong> kişinin o saatte kısıtı vardı (ders, izin vb.)</li>`);
            if (s.cakisma) rows.push(`<li><strong>${s.cakisma}</strong> kişinin aynı saatte başka sınav görevi vardı</li>`);
            if (s.cuma) rows.push(`<li><strong>${s.cuma}</strong> kişi Cuma namazı saatine (12:30–14:00) denk geldiği için atanamazdı</li>`);
            if (s.diger) rows.push(`<li><strong>${s.diger}</strong> kişi başka bir kural nedeniyle uygun değildi</li>`);
            if (s.limit) rows.push(`<li><strong>${s.limit}</strong> kişi görev üst sınırına ulaşmıştı</li>`);
            if (s.uygun) rows.push(`<li><strong>${s.uygun}</strong> kişi o saatte uygun görünüyordu</li>`);
            html += `<p>Sıralamada sizden önde <strong>${r.d}</strong> kişi vardı:</p><ul class="atama-gerekce-list">${rows.join('')}</ul>`;

            if (s.uygun) {
                if (r.y === 'yonetici') html += `<p class="atama-gerekce-note">Görev yönetici tarafından elle atandığı için puan sırası uygulanmadı.</p>`;
                else if (r.y === 'dengeleme') html += `<p class="atama-gerekce-note">Dengeleme, toplam puanları birbirine yaklaştırmak için görevleri yeniden dağıtır.</p>`;
                else if (r.y === 'takas') html += `<p class="atama-gerekce-note">Görev takas ya da devirle geldiği için puan sırası uygulanmadı.</p>`;
                else html += `<p class="atama-gerekce-note">Toplu atamada görevler sırayla dağıtılır; bu kişilere aynı dağıtımda başka görevler verilmiş olabilir.</p>`;
            }
        }

        html += `<p class="atama-gerekce-foot">Sistem önce o saatte gerçekten uygun olanları ayırır (kısıt, aynı saatte başka görev, Cuma namazı, görev üst sınırı), sonra aralarından sıralamada en önde olanı seçer.
            Bir yanlışlık olduğunu düşünüyorsanız yöneticiye bildirebilir ya da görevinizi Pazar Yeri'ne koyabilirsiniz.</p>`;
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
