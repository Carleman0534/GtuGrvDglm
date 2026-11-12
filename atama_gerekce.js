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
        otomatik: '🤖 Sistem otomatik atadı: o saatte uygun olanlar arasından puanı en düşük gözetmen seçilir.',
        ice_aktarim: '📥 Sınav programı içe aktarılırken sistem otomatik atadı (o saatte uygun olanlar arasından en düşük puanlı).',
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

    // --- O anın fotoğrafı ---
    function snapshot(ex, pid, method) {
        if (!window.DB || !Array.isArray(DB.staff) || !ex || !ex.date || !ex.time) return null;
        const me = DB.staff.find(s => s && S(s.id) === S(pid));
        if (!me) return null;
        const onExam = proctorsOf(ex);
        const exScore = Number(ex.score) || 0;
        // Bu sınavın puanı atanan kişilerin toplamına zaten eklenmiş olabilir: atama öncesine göre karşılaştır
        const scoreBefore = (s) => round2((Number(s.totalScore) || 0) - (onExam.includes(S(s.id)) ? exScore : 0));

        const myScore = scoreBefore(me);
        const others = DB.staff.filter(s => s && S(s.id) !== S(pid) && !onExam.includes(S(s.id)));
        const lower = others.filter(s => scoreBefore(s) < myScore);
        const counts = { kisit: 0, cakisma: 0, cuma: 0, limit: 0, diger: 0, uygun: 0 };
        lower.forEach(s => { counts[blockReason(s, ex)]++; });
        Object.keys(counts).forEach(k => { if (!counts[k]) delete counts[k]; });

        return {
            y: method,
            t: new Date().toISOString(),
            p: myScore,
            r: lower.length + 1,
            n: others.length + 1,
            d: lower.length,
            s: counts
        };
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
        if (r.y && METHOD_TEXT[r.y]) html += `<p class="atama-gerekce-method">${METHOD_TEXT[r.y]}</p>`;

        html += `<p>${info.approx ? 'Bugünkü' : 'Atama anındaki'} puanınız: <strong>${String(r.p).replace('.', ',')}</strong>.
            Gözetmenler arasında puanı en düşük <strong>${r.r}.</strong> kişiydiniz (toplam ${r.n} kişi).</p>`;

        if (!r.d) {
            html += `<p>O sırada <strong>sizden düşük puanlı kimse yoktu</strong>; puan kuralına göre görev size gelir.</p>`;
        } else {
            const rows = [];
            if (s.kisit) rows.push(`<li><strong>${s.kisit}</strong> kişinin o saatte kısıtı vardı (ders, izin vb.)</li>`);
            if (s.cakisma) rows.push(`<li><strong>${s.cakisma}</strong> kişinin aynı saatte başka sınav görevi vardı</li>`);
            if (s.cuma) rows.push(`<li><strong>${s.cuma}</strong> kişi Cuma namazı saatine (12:30–14:00) denk geldiği için atanamazdı</li>`);
            if (s.diger) rows.push(`<li><strong>${s.diger}</strong> kişi başka bir kural nedeniyle uygun değildi</li>`);
            if (s.limit) rows.push(`<li><strong>${s.limit}</strong> kişi görev üst sınırına ulaşmıştı</li>`);
            if (s.uygun) rows.push(`<li><strong>${s.uygun}</strong> kişi o saatte uygun görünüyordu</li>`);
            html += `<p>Sizden düşük puanlı <strong>${r.d}</strong> kişi vardı:</p><ul class="atama-gerekce-list">${rows.join('')}</ul>`;

            if (s.uygun) {
                if (r.y === 'yonetici') html += `<p class="atama-gerekce-note">Görev yönetici tarafından elle atandığı için puan sırası uygulanmadı.</p>`;
                else if (r.y === 'dengeleme') html += `<p class="atama-gerekce-note">Dengeleme, toplam puanları birbirine yaklaştırmak için görevleri yeniden dağıtır.</p>`;
                else if (r.y === 'takas') html += `<p class="atama-gerekce-note">Görev takas ya da devirle geldiği için puan sırası uygulanmadı.</p>`;
                else if (info.approx) html += `<p class="atama-gerekce-note">Bu kişilerin bir kısmının puanı atamadan sonra değişmiş olabilir; dönem başındaki toplu atamada puanlar birbirine çok yakındı.</p>`;
                else html += `<p class="atama-gerekce-note">Toplu atamada görevler sırayla dağıtılır; bu kişilere aynı dağıtımda başka görevler verilmiş olabilir.</p>`;
            }
        }

        if (info.approx) {
            html += `<p class="atama-gerekce-note">ℹ️ Bu görev için atama anında kayıt tutulmamış (özellik yeni eklendi). Açıklama bugünkü puan ve kısıtlara göre yaklaşık hesaplandı.</p>`;
        }
        html += `<p class="atama-gerekce-foot">Puan tek başına belirleyici değildir: sistem önce o saatte uygun olanları ayırır, sonra aralarından puanı en düşük olanı seçer.
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
})();
