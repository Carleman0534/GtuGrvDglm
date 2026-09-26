/**
 * =====================================================================
 *  GÖREV TAKASI & GÖREV PAZARI MODÜLÜ  (swap_market.js)
 * =====================================================================
 *  app.js ve logic.js'ten SONRA yüklenir. Mevcut global fonksiyonları
 *  (initiateDirectSwap, initiateOpenSwap, acceptOpenRequest, ...) aynı
 *  isimlerle tanımlar; böylece mevcut onclick'ler çalışmaya devam eder.
 *
 *  TEMEL İLKE:
 *   - E-posta oluşturmak görev atamasını DEĞİŞTİRMEZ.
 *   - Atama yalnızca ilgili hoca(lar) sistem içinden onay verdiğinde
 *     (ve ayar açıksa yönetici onayladığında) değişir.
 *   - Her değişiklikten hemen önce müsaitlik (kısıt), sınav çakışması
 *     (15 dk tampon), Cuma kuralı, sınav dışı görev tekrarı ve muafiyet
 *     kontrolleri yeniden yapılır. Puanlar mevcut kategori mantığıyla
 *     (sınav / sınav dışı) taşınır, geri alma (undo) anlık görüntüsü alınır.
 *
 *  Talep durumları (DB.requests[].status):
 *   pending        → Pazar ilanı (receiverId=null)  → "Pazara Çıkarıldı"
 *   claim_pending  → Pazardaki göreve talip var       → "Devir Talebi Var"
 *   pending_peer   → Birebir takas teklifi           → "Takas Talebi Oluşturuldu" / "Takas Bekliyor"
 *   awaiting_admin → Taraflar onayladı, yönetici onayı bekleniyor
 *   approved       → resultType: 'swapped' ("Takas Gerçekleşti") | 'transferred' ("Görev Devredildi")
 *   rejected | cancelled ("İptal Edildi") | expired
 * =====================================================================
 */
(function () {
    'use strict';

    // ------------------------------------------------------------------
    // 0) GENEL YARDIMCILAR
    // ------------------------------------------------------------------
    const ACTIVE_STATUSES = ['pending', 'pending_peer', 'claim_pending', 'awaiting_admin', 'accepted_waiting_approval'];
    const MAILTO_LIMIT = 1900;   // Çoğu istemcide güvenli mailto uzunluğu
    const WEBMAIL_LIMIT = 7000;  // Gmail / Outlook web URL sınırı için güvenli değer

    const S = v => String(v);
    const nowIso = () => new Date().toISOString();
    const myId = () => localStorage.getItem('myStaffId');
    const isAdmin = () => sessionStorage.getItem('isAdmin') === 'true';
    const staffById = id => (DB.staff || []).find(s => S(s.id) === S(id));
    const examById = id => (DB.exams || []).find(e => S(e.id) === S(id));
    const reqById = id => (DB.requests || []).find(r => S(r.id) === S(id));

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function toast(msg, type = 'success') {
        if (typeof window.showToast === 'function') window.showToast(msg, type);
        else alert(msg);
    }

    function proctorIdsOf(exam) {
        if (!exam) return [];
        if (Array.isArray(exam.proctorIds) && exam.proctorIds.length) return exam.proctorIds.slice();
        return (exam.proctorId !== undefined && exam.proctorId !== null && exam.proctorId !== '') ? [exam.proctorId] : [];
    }
    const holds = (exam, staffId) => proctorIdsOf(exam).map(S).includes(S(staffId));

    function parseLocalDate(d) {
        const p = String(d || '').split('-').map(Number);
        return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
    }
    function fmtDate(d) {
        if (!d) return '-';
        const dt = parseLocalDate(d);
        if (isNaN(dt.getTime())) return d;
        return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
    }
    function dayName(d) {
        const dt = parseLocalDate(d);
        return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('tr-TR', { weekday: 'long' });
    }
    const durationOf = exam => parseFloat(exam && exam.duration) || 60;
    function endTimeOf(exam) {
        const m = timeToMins(exam.time) + durationOf(exam);
        return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    }
    const examStart = exam => getSafeDate(exam.date, exam.time);
    const examEnd = exam => new Date(examStart(exam).getTime() + durationOf(exam) * 60000);
    const isUpcoming = exam => !!(exam && exam.date && exam.time && examEnd(exam) >= new Date());
    const taskTypeOf = exam => (exam && exam.isNonExam) ? 'Sınav dışı görev' : 'Sınav gözetmenliği';
    const dutyPhrase = exam => (exam && exam.isNonExam) ? `${exam.name} görevini` : `${exam.name} sınavı gözetmenlik görevini`;
    const validEmail = e => (typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) ? e.trim() : null;

    function settings() {
        if (!DB.swapSettings || typeof DB.swapSettings !== 'object') DB.swapSettings = {};
        const s = DB.swapSettings;
        if (s.marketplaceOwnerApproval === undefined) s.marketplaceOwnerApproval = true; // Pazardan alımda görev sahibinin onayı
        if (s.adminApproval === undefined) s.adminApproval = false;                       // Tüm değişikliklerde yönetici onayı
        return s;
    }

    function notify(staffId, message, type, requestId) {
        if (staffId === undefined || staffId === null || staffId === '') return;
        if (!DB.notifications) DB.notifications = {};
        if (!Array.isArray(DB.notifications[staffId])) DB.notifications[staffId] = [];
        DB.notifications[staffId].unshift({
            id: Date.now() + Math.random(),
            message, type,
            requestId: requestId || null,
            createdAt: nowIso(),
            isRead: false
        });
    }

    function safeDispatch(eventType, data) {
        try { if (typeof dispatchNotificationEvent === 'function') dispatchNotificationEvent(eventType, data); }
        catch (e) { console.warn('[SwapMarket] bildirim hatası', e); }
    }

    function persist() {
        // saveToLocalStorage → saveToBackend zincirini zaten tetikler
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    }

    function refreshUI() {
        ['renderProfile', 'renderExams', 'renderSchedule', 'renderDashboard', 'updateMarketplaceBadge',
         'renderMarketplaceDashboard', 'updateNotifBadge', 'updateNotificationBadge'].forEach(fn => {
            try { if (typeof window[fn] === 'function') window[fn](); } catch (e) { console.warn('[SwapMarket] ' + fn, e); }
        });
        try { renderMyRequests(); } catch (e) { console.warn(e); }
    }

    // ------------------------------------------------------------------
    // 1) TALEP MODELİ
    // ------------------------------------------------------------------
    const isSwapReq = r => r && (r.type === 'direct_swap' || r.type === 'smart_swap');
    const initExamIdOf = r => r.type === 'direct_swap' ? r.initiatorExamId : r.examId;
    const recvExamIdOf = r => r.type === 'direct_swap' ? r.receiverExamId : r.targetExamId;
    const isMarketReq = r => r && !isSwapReq(r) && (r.type === 'market' || r.receiverId === null || r.status === 'claim_pending');

    function reqExamIds(r) {
        if (isSwapReq(r)) return [initExamIdOf(r), recvExamIdOf(r)].filter(v => v !== undefined && v !== null);
        return r.examId !== undefined && r.examId !== null ? [r.examId] : [];
    }
    const isActiveReq = r => r && ACTIVE_STATUSES.includes(r.status);
    const activeRequestsForExam = examId =>
        (DB.requests || []).filter(r => isActiveReq(r) && reqExamIds(r).map(S).includes(S(examId)));

    function historyLabel(r) {
        switch (r.status) {
            case 'approved':
                if (r.resultType === 'swapped' || isSwapReq(r)) return { label: 'Takas Gerçekleşti', cls: 'st-done' };
                return { label: 'Görev Devredildi', cls: 'st-done' };
            case 'rejected': return { label: 'Reddedildi', cls: 'st-rejected' };
            case 'cancelled': return { label: 'İptal Edildi', cls: 'st-cancelled' };
            case 'expired': return { label: 'Süresi Doldu', cls: 'st-cancelled' };
            case 'awaiting_admin': return { label: 'Yönetici Onayı Bekliyor', cls: 'st-admin' };
            case 'claim_pending': return { label: 'Devir Talebi Var', cls: 'st-claim' };
            case 'pending_peer': return { label: 'Takas Bekliyor', cls: 'st-swap-wait' };
            case 'pending': return r.receiverId == null ? { label: 'Pazara Çıkarıldı', cls: 'st-market' } : { label: 'Devir Bekliyor', cls: 'st-swap-wait' };
            default: return { label: r.status, cls: 'st-normal' };
        }
    }

    /** Bir görevin, belirli bir hoca açısından güncel durumu */
    function getTaskStatus(exam, staffId) {
        for (const r of activeRequestsForExam(exam.id)) {
            const imInit = S(r.initiatorId) === S(staffId);
            const imRecv = S(r.receiverId) === S(staffId);
            if (r.status === 'awaiting_admin' && (imInit || imRecv)) return { key: 'awaiting_admin', label: 'Yönetici Onayı Bekliyor', cls: 'st-admin', req: r };
            if (isSwapReq(r)) {
                if (imInit && S(initExamIdOf(r)) === S(exam.id)) return { key: 'swap_requested', label: 'Takas Talebi Oluşturuldu', cls: 'st-swap-sent', req: r };
                if (imRecv && S(recvExamIdOf(r)) === S(exam.id)) return { key: 'swap_pending', label: 'Takas Bekliyor', cls: 'st-swap-wait', req: r };
            } else if (imInit) {
                if (r.status === 'claim_pending' || r.status === 'accepted_waiting_approval') return { key: 'claim_pending', label: 'Devir Talebi Var', cls: 'st-claim', req: r };
                if (r.status === 'pending' && r.receiverId == null) return { key: 'on_market', label: 'Pazara Çıkarıldı', cls: 'st-market', req: r };
                if (r.status === 'pending') return { key: 'transfer_sent', label: 'Devir Talebi Gönderildi', cls: 'st-swap-sent', req: r };
            }
        }
        return { key: 'normal', label: 'Normal', cls: 'st-normal', req: null };
    }

    // ------------------------------------------------------------------
    // 2) KURAL KONTROLLERİ (mevcut atama kurallarıyla birebir uyumlu)
    // ------------------------------------------------------------------
    function isExempt(staff, exam) {
        if (!staff) return false;
        if (staff.isExempt === true || staff.exempt === true || staff.isActive === false || staff.passive === true) return true;
        if (Array.isArray(staff.exemptTypes) && exam && staff.exemptTypes.includes(exam.type)) return true;
        if (exam && exam.isNonExam && staff.nonExamExempt === true) return true;
        return false;
    }

    /**
     * staffId bu görevi alabilir mi?
     * ignoreExamIds: takas sırasında hocanın zaten bırakacağı görev(ler) — çakışma hesabına katılmaz.
     */
    function candidateIssues(exam, staffId, ignoreExamIds = [], opts = {}) {
        const errors = [], warnings = [];
        const st = staffById(staffId);
        if (!st) { errors.push('Personel kaydı bulunamadı'); return { errors, warnings }; }
        if (!exam) { errors.push('Sınav kaydı bulunamadı'); return { errors, warnings }; }
        const dur = durationOf(exam);

        if (holds(exam, staffId)) errors.push(`${st.name} bu görevde zaten görevli`);

        // Kısıt / müsaitlik
        if (typeof isAvailable === 'function' && !isAvailable(st.name, exam.date, exam.time, dur)) {
            errors.push(`${st.name} bu saat için müsait değil (tanımlı kısıt)`);
        }

        // Sınav çakışması (15 dk tampon – isProctorTrulyFree ile aynı mantık)
        const ignore = ignoreExamIds.map(S).concat([S(exam.id)]);
        const start = examStart(exam);
        const end = new Date(start.getTime() + (dur + 15) * 60000);
        const conflict = (DB.exams || []).find(ex => {
            if (ignore.includes(S(ex.id)) || ex.date !== exam.date || !holds(ex, staffId)) return false;
            const s = getSafeDate(ex.date, ex.time);
            const e = new Date(s.getTime() + (durationOf(ex) + 15) * 60000);
            return start < e && end > s;
        });
        if (conflict) errors.push(`${st.name} aynı saatlerde "${conflict.name}" (${conflict.time}) görevinde`);

        // Cuma 12:30–14:00 kuralı
        if (parseLocalDate(exam.date).getDay() === 5) {
            const gender = st.gender || (typeof predictGender === 'function' ? predictGender(st.name) : '');
            if (gender === 'Erkek') {
                const sm = timeToMins(exam.time), em = sm + dur;
                if (sm < timeToMins('14:00') && em > timeToMins('12:30')) errors.push(`Cuma 12:30–14:00 kuralı (${st.name})`);
            }
        }

        // Aynı sınav dışı görevin tekrarı
        if (typeof shouldCountAsNonExam === 'function' && shouldCountAsNonExam(exam)) {
            const dup = (DB.exams || []).find(ex => !ignore.includes(S(ex.id)) && shouldCountAsNonExam(ex) && ex.name === exam.name && holds(ex, staffId));
            if (dup) errors.push(`${st.name} aynı sınav dışı görevi ("${exam.name}") zaten üstlenmiş`);
        }

        // Muafiyet
        if (isExempt(st, exam)) errors.push(`${st.name} bu görev türünden muaf / pasif`);

        // Görev limiti (sadece devirde görev sayısı artar)
        if (!opts.swap && typeof GLOBAL_LIMITS !== 'undefined' && !(typeof shouldCountAsNonExam === 'function' && shouldCountAsNonExam(exam))) {
            const cnt = st.taskCount || 0;
            if (cnt + 1 > GLOBAL_LIMITS.MAX_TASKS) warnings.push(`${st.name} için görev sayısı ${cnt + 1} olacak (önerilen üst sınır ${GLOBAL_LIMITS.MAX_TASKS})`);
        }
        return { errors, warnings };
    }

    function validateTransfer(exam, fromId, toId) {
        const errors = [], warnings = [];
        if (!exam) return { errors: ['Sınav kaydı bulunamadı (silinmiş olabilir)'], warnings };
        if (!isUpcoming(exam)) errors.push('Sınav tarihi geçmiş');
        if (!holds(exam, fromId)) errors.push('Görevi devreden hoca artık bu görevde kayıtlı değil');
        if (S(fromId) === S(toId)) errors.push('Görev aynı kişiye devredilemez');
        const c = candidateIssues(exam, toId);
        return { errors: errors.concat(c.errors), warnings: warnings.concat(c.warnings) };
    }

    function validateSwap(examA, aId, examB, bId) {
        const errors = [], warnings = [];
        if (!examA || !examB) return { errors: ['Takastaki sınavlardan biri bulunamadı (silinmiş olabilir)'], warnings };
        if (S(examA.id) === S(examB.id)) errors.push('Aynı sınav kendisiyle takas edilemez');
        if (S(aId) === S(bId)) errors.push('Kişi kendisiyle takas yapamaz');
        if (!isUpcoming(examA) || !isUpcoming(examB)) errors.push('Takastaki sınavlardan birinin tarihi geçmiş');
        if (!holds(examA, aId)) errors.push(`"${examA.name}" görevi artık teklif eden hocada değil`);
        if (!holds(examB, bId)) errors.push(`"${examB.name}" görevi artık karşı tarafta değil`);
        const c1 = candidateIssues(examA, bId, [examB.id], { swap: true });
        const c2 = candidateIssues(examB, aId, [examA.id], { swap: true });
        return { errors: errors.concat(c1.errors, c2.errors), warnings: warnings.concat(c1.warnings, c2.warnings) };
    }

    function validateRequest(r) {
        if (isSwapReq(r)) return validateSwap(examById(initExamIdOf(r)), r.initiatorId, examById(recvExamIdOf(r)), r.receiverId);
        return validateTransfer(examById(r.examId), r.initiatorId, r.receiverId);
    }

    /** Pazar e-postası için alıcı listesi (uygun / hariç tutulan) */
    function getMarketRecipients(exam, ownerId) {
        const eligible = [], excluded = [], all = [];
        (DB.staff || []).forEach(s => {
            if (S(s.id) === S(ownerId)) return;
            const email = validEmail(s.email);
            const reasons = candidateIssues(exam, s.id).errors.slice();
            if (!email) reasons.push('E-posta adresi kayıtlı değil');
            if (email) all.push(s);
            if (reasons.length) excluded.push({ staff: s, reasons });
            else eligible.push(s);
        });
        const byName = (a, b) => (a.name || a.staff.name).localeCompare(b.name || b.staff.name, 'tr');
        eligible.sort(byName); all.sort(byName);
        excluded.sort((a, b) => a.staff.name.localeCompare(b.staff.name, 'tr'));
        return { eligible, excluded, all };
    }

    // ------------------------------------------------------------------
    // 3) ATAMA DEĞİŞİKLİĞİ (yalnızca onay sonrası çağrılır)
    // ------------------------------------------------------------------
    function replaceProctor(exam, fromId, toStaff) {
        const list = proctorIdsOf(exam);
        const idx = list.map(S).indexOf(S(fromId));
        if (idx === -1) throw new Error(`"${exam.name}" görevinde devreden hoca bulunamadı`);
        list[idx] = toStaff.id;
        exam.proctorIds = list;
        if (exam.proctorId === undefined || exam.proctorId === null || S(exam.proctorId) === S(fromId)) exam.proctorId = list[0];
        exam.proctorName = list.map(id => (staffById(id) || {}).name).filter(Boolean).join(', ');
    }

    function moveScore(exam, fromStaff, toStaff) {
        const sc = parseFloat(exam.score) || 0;
        const r2 = v => parseFloat((v).toFixed(2));
        if (typeof shouldCountAsNonExam === 'function' && shouldCountAsNonExam(exam)) {
            fromStaff.nonExamScore = Math.max(0, r2((fromStaff.nonExamScore || 0) - sc));
            fromStaff.nonExamTaskCount = Math.max(0, (fromStaff.nonExamTaskCount || 0) - 1);
            toStaff.nonExamScore = r2((toStaff.nonExamScore || 0) + sc);
            toStaff.nonExamTaskCount = (toStaff.nonExamTaskCount || 0) + 1;
        } else {
            fromStaff.totalScore = Math.max(0, r2((parseFloat(fromStaff.totalScore) || 0) - sc));
            fromStaff.taskCount = Math.max(0, (fromStaff.taskCount || 0) - 1);
            toStaff.totalScore = r2((parseFloat(toStaff.totalScore) || 0) + sc);
            toStaff.taskCount = (toStaff.taskCount || 0) + 1;
        }
    }

    function executeRequest(r) {
        if (typeof takeSnapshot === 'function') takeSnapshot(isSwapReq(r) ? 'Görev Takası' : 'Görev Devri');
        if (isSwapReq(r)) {
            const examA = examById(initExamIdOf(r)), examB = examById(recvExamIdOf(r));
            const A = staffById(r.initiatorId), B = staffById(r.receiverId);
            replaceProctor(examA, A.id, B);
            replaceProctor(examB, B.id, A);
            moveScore(examA, A, B);
            moveScore(examB, B, A);
            return { examIds: [examA.id, examB.id], text: `${A.name} ⇄ ${B.name}: "${examA.name}" ile "${examB.name}" takas edildi.` };
        }
        const exam = examById(r.examId), from = staffById(r.initiatorId), to = staffById(r.receiverId);
        replaceProctor(exam, from.id, to);
        moveScore(exam, from, to);
        return { examIds: [exam.id], text: `${from.name} → ${to.name}: "${exam.name}" görevi devredildi.` };
    }

    /** Değişen görevlere bağlı diğer aktif talepleri kapat (tutarlılık) */
    function closeRelatedRequests(examIds, exceptId) {
        (DB.requests || []).forEach(o => {
            if (S(o.id) === S(exceptId) || !isActiveReq(o)) return;
            if (!reqExamIds(o).map(S).some(id => examIds.map(S).includes(id))) return;
            o.status = 'cancelled';
            o.cancelledAt = nowIso();
            o.cancelReason = 'Görev başka bir takas/devir ile el değiştirdi';
            const who = [o.initiatorId, o.receiverId].filter(v => v !== null && v !== undefined);
            who.forEach(id => notify(id, `ℹ️ "${o.examName || (examById(reqExamIds(o)[0]) || {}).name || 'Görev'}" ile ilgili talep, görev başka bir işlemle el değiştirdiği için iptal edildi.`, 'request_cancelled', o.id));
        });
    }

    /**
     * Tarafların onayı sonrası talebi sonuçlandırır.
     * Yönetici onayı açıksa ve işlemi yönetici yapmıyorsa → 'awaiting_admin'.
     */
    function finalizeRequest(r, opts = {}) {
        const v = validateRequest(r);
        if (v.errors.length) return { ok: false, errors: v.errors, warnings: v.warnings };

        if (settings().adminApproval && !opts.byAdmin) {
            r.status = 'awaiting_admin';
            r.peerApprovedAt = nowIso();
            r.updatedAt = nowIso();
            [r.initiatorId, r.receiverId].forEach(id => notify(id, `🛡️ "${reqTitle(r)}" talebi taraflarca onaylandı, yönetici onayı bekleniyor. Görev ataması henüz değişmedi.`, 'swap_awaiting_admin', r.id));
            if (typeof logAction === 'function') logAction('user', 'Yönetici Onayına Gönderildi', `${reqTitle(r)} (${r.initiatorName} / ${r.receiverName})`);
            persist();
            return { ok: true, awaitingAdmin: true };
        }

        let res;
        try { res = executeRequest(r); }
        catch (e) { console.error(e); return { ok: false, errors: [e.message] }; }

        r.status = 'approved';
        r.resultType = isSwapReq(r) ? 'swapped' : 'transferred';
        r.toApproved = true;
        r.completedAt = nowIso();
        r.updatedAt = r.completedAt;
        if (opts.byAdmin) r.adminApprovedAt = r.completedAt;
        closeRelatedRequests(res.examIds, r.id);

        const label = isSwapReq(r) ? 'Takas Gerçekleşti' : 'Görev Devredildi';
        notify(r.initiatorId, `✅ ${label}: ${res.text}`, 'swap_approved', r.id);
        notify(r.receiverId, `✅ ${label}: ${res.text}`, 'swap_approved', r.id);
        if (typeof logAction === 'function') logAction(opts.byAdmin ? 'admin' : 'user', isSwapReq(r) ? 'Görev Takası' : 'Görev Devri', res.text);

        const eA = examById(isSwapReq(r) ? initExamIdOf(r) : r.examId);
        const eB = isSwapReq(r) ? examById(recvExamIdOf(r)) : null;
        safeDispatch('swap_accepted', {
            initiatorName: r.initiatorName, initiatorId: r.initiatorId,
            receiverName: r.receiverName, receiverId: r.receiverId,
            examName: eA ? eA.name : r.examName, secondExamName: eB ? eB.name : undefined,
            swapType: r.type || 'marketplace_claim'
        });
        persist();
        return { ok: true };
    }

    function reqTitle(r) {
        if (isSwapReq(r)) {
            const a = examById(initExamIdOf(r)), b = examById(recvExamIdOf(r));
            return `${a ? a.name : '?'} ⇄ ${b ? b.name : '?'}`;
        }
        const e = examById(r.examId);
        return e ? e.name : (r.examName || 'Görev');
    }

    function showResultError(res, prefix) {
        alert(`${prefix || '⛔ İşlem yapılamadı'}\n\n• ${(res.errors || []).join('\n• ')}\n\nGörev ataması değiştirilmedi.`);
    }

    // ------------------------------------------------------------------
    // 4) E-POSTA TASLAĞI (mailto öncelikli, servis eklentisine hazır)
    // ------------------------------------------------------------------
    const mailProviders = []; // { id, label, available(): bool, send: async(mail) => {sent, failed} }

    /**
     * İleride gerçek bir e-posta servisi eklemek için:
     *   SwapMarket.mail.registerProvider({ id:'api', label:'🚀 Sunucu üzerinden gönder',
     *       available: () => true, send: async (mail) => { await fetch(...); return { sent: n, failed: 0 }; } });
     */
    function registerProvider(p) { if (p && p.id && typeof p.send === 'function') { const i = mailProviders.findIndex(x => x.id === p.id); if (i > -1) mailProviders.splice(i, 1); mailProviders.push(p); } }

    // Mevcut e-posta altyapısı (EmailJS/SMTPJS) yöneticide açıksa kullanılabilir
    registerProvider({
        id: 'system',
        label: '🚀 Sistem e-posta servisi ile gönder',
        available: () => !!(DB.emailSettings && DB.emailSettings.enabled && typeof sendSwapNotificationEmail === 'function'),
        send: async (mail) => {
            let sent = 0, failed = 0;
            for (const addr of mail.to.concat(mail.bcc)) {
                try {
                    const r = await sendSwapNotificationEmail({ toEmail: addr, subject: mail.subject, body: mail.body, eventType: mail.eventType || 'swap_mail' });
                    if (r && r.success !== false) sent++; else failed++;
                } catch (e) { failed++; }
            }
            return { sent, failed };
        }
    });

    async function copyText(text) {
        try { await navigator.clipboard.writeText(text); return true; }
        catch (e) {
            try {
                const ta = document.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                const ok = document.execCommand('copy');
                ta.remove(); return ok;
            } catch (e2) { return false; }
        }
    }

    function openUrl(url) {
        if (url.startsWith('mailto:')) {
            const a = document.createElement('a');
            a.href = url; a.style.display = 'none';
            document.body.appendChild(a); a.click(); a.remove();
        } else {
            window.open(url, '_blank', 'noopener');
        }
    }

    function composeUrl(client, to, bcc, subject, body) {
        const enc = encodeURIComponent;
        if (client === 'gmail') {
            return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to.join(','))}${bcc.length ? '&bcc=' + enc(bcc.join(',')) : ''}&su=${enc(subject)}&body=${enc(body)}`;
        }
        if (client === 'outlook') {
            // Outlook web derin bağlantısı BCC'yi güvenilir desteklemez → BCC panoya kopyalanır
            return `https://outlook.office.com/mail/deeplink/compose?to=${enc(to.join(','))}&subject=${enc(subject)}&body=${enc(body)}`;
        }
        const params = [];
        if (bcc.length) params.push('bcc=' + bcc.join(','));
        params.push('subject=' + enc(subject));
        params.push('body=' + enc(body));
        return `mailto:${to.join(',')}?${params.join('&')}`;
    }

    /** Alıcıları URL sınırına sığacak gruplara böler. */
    function planBatches(client, mail) {
        const limit = client === 'mailto' ? MAILTO_LIMIT : WEBMAIL_LIMIT;
        let body = mail.body, bodyCopied = false;
        const shortBody = 'Mesaj metni panoya kopyalandı. Lütfen buraya yapıştırın (Ctrl+V / ⌘V).';
        const bccList = client === 'outlook' ? [] : mail.bcc.slice(); // Outlook: BCC ayrı kopyalanır
        const tooLong = b => composeUrl(client, mail.to, [], mail.subject, b).length > limit - 120;
        if (tooLong(body)) {
            // Önce kısa sürüm (kullanıcı metni düzenlemediyse), o da sığmazsa metni panoya kopyala
            if (mail.compactBody && mail.body === mail.originalBody && !tooLong(mail.compactBody)) body = mail.compactBody;
            else { body = shortBody; bodyCopied = true; }
        }
        const batches = [];
        let cur = [];
        const fits = list => composeUrl(client, mail.to, list, mail.subject, body).length <= limit;
        bccList.forEach(addr => {
            if (fits(cur.concat(addr)) || cur.length === 0) cur.push(addr);
            else { batches.push(cur); cur = [addr]; }
        });
        if (cur.length || batches.length === 0) batches.push(cur);
        return { batches, body, bodyCopied };
    }

    let currentMail = null;

    /**
     * Mail taslağını açar. mail = { to:[], bcc:[], subject, body, title, info, eventType }
     * Atamayı DEĞİŞTİRMEZ; yalnızca taslak oluşturur.
     */
    function openMailDraft(mail) {
        currentMail = {
            to: (mail.to || []).map(validEmail).filter(Boolean),
            bcc: [...new Set((mail.bcc || []).map(validEmail).filter(Boolean))],
            subject: mail.subject || '',
            body: mail.body || '',
            originalBody: mail.body || '',
            compactBody: mail.compactBody || '',
            title: mail.title || '✉️ E-posta Taslağı',
            info: mail.info || '',
            skipped: mail.skipped || [],
            eventType: mail.eventType
        };
        currentMail.bcc = currentMail.bcc.filter(e => !currentMail.to.includes(e));
        const modal = document.getElementById('modal-mail-draft');
        if (!modal) { // Yedek: doğrudan mailto
            const plan = planBatches('mailto', currentMail);
            if (plan.bodyCopied) copyText(currentMail.body);
            openUrl(composeUrl('mailto', currentMail.to, plan.batches[0], currentMail.subject, plan.body));
            return;
        }
        document.getElementById('mail-draft-title').textContent = currentMail.title;
        document.getElementById('mail-draft-info').innerHTML = currentMail.info || '';
        document.getElementById('mail-draft-info').classList.toggle('hidden', !currentMail.info);
        const rec = [];
        if (currentMail.to.length) rec.push(`<div><b>Kime:</b> ${currentMail.to.map(esc).join(', ')}</div>`);
        if (currentMail.bcc.length) rec.push(`<details><summary><b>Gizli (BCC):</b> ${currentMail.bcc.length} alıcı</summary><div class="mail-draft-bcc">${currentMail.bcc.map(esc).join(', ')}</div></details>`);
        if (currentMail.skipped.length) rec.push(`<details><summary style="color:#fbbf24;">⚠️ ${currentMail.skipped.length} kişi e-posta adresi olmadığı için eklenmedi</summary><div class="mail-draft-bcc">${currentMail.skipped.map(esc).join(', ')}</div></details>`);
        if (!currentMail.to.length && !currentMail.bcc.length) rec.push('<div style="color:#f87171;">Geçerli e-posta adresi bulunamadı. Metni kopyalayıp manuel gönderebilirsiniz.</div>');
        document.getElementById('mail-draft-recipients').innerHTML = rec.join('');
        document.getElementById('mail-draft-subject').value = currentMail.subject;
        document.getElementById('mail-draft-body').value = currentMail.body;
        document.getElementById('mail-draft-batches').innerHTML = '';

        const provBox = document.getElementById('mail-draft-providers');
        const avail = mailProviders.filter(p => { try { return p.available(); } catch (e) { return false; } });
        provBox.innerHTML = avail.map(p => `<button type="button" class="btn-secondary mail-client-btn" onclick="SwapMarket.mail.sendVia('${p.id}')">${esc(p.label)}</button>`).join('');

        const last = (() => { try { return localStorage.getItem('swapMailClient'); } catch (e) { return null; } })();
        document.querySelectorAll('#modal-mail-draft [data-mail-client]').forEach(b => b.classList.toggle('preferred', b.getAttribute('data-mail-client') === last));
        modal.classList.remove('hidden');
    }

    function syncDraftEdits() {
        if (!currentMail) return;
        currentMail.subject = document.getElementById('mail-draft-subject').value;
        currentMail.body = document.getElementById('mail-draft-body').value;
    }

    async function openWithClient(client) {
        syncDraftEdits();
        if (!currentMail) return;
        try { localStorage.setItem('swapMailClient', client); } catch (e) { /* yoksay */ }
        const plan = planBatches(client, currentMail);
        const notes = [];
        if (plan.bodyCopied) { await copyText(currentMail.body); notes.push('📋 Mesaj metni uzun olduğu için panoya kopyalandı — taslakta gövdeye yapıştırın.'); }
        if (client === 'outlook' && currentMail.bcc.length) {
            await copyText(currentMail.bcc.join('; '));
            notes.push('📋 Alıcı listesi panoya kopyalandı — Outlook\'ta <b>Gizli (BCC)</b> alanına yapıştırın.');
            if (plan.bodyCopied) notes.push('⚠️ Hem metin hem alıcılar kopyalandı; son kopyalanan alıcı listesidir. Metni "Metni Kopyala" ile tekrar alabilirsiniz.');
        }
        const box = document.getElementById('mail-draft-batches');
        if (plan.batches.length > 1) {
            notes.push(`Alıcı sayısı fazla olduğu için e-posta ${plan.batches.length} gruba bölündü. Her grubu sırayla açın:`);
            box.innerHTML = `<div class="mail-draft-note">${notes.join('<br>')}</div>` + plan.batches.map((b, i) =>
                `<button type="button" class="btn-secondary mail-batch-btn" data-batch="${i}">📨 Grup ${i + 1} (${b.length} kişi)</button>`).join('');
            box.querySelectorAll('.mail-batch-btn').forEach(btn => {
                btn.onclick = () => {
                    const b = plan.batches[+btn.getAttribute('data-batch')];
                    openUrl(composeUrl(client, currentMail.to, b, currentMail.subject, plan.body));
                    btn.classList.add('done'); btn.textContent = '✓ ' + btn.textContent.replace(/^✓ /, '');
                };
            });
            return;
        }
        box.innerHTML = notes.length ? `<div class="mail-draft-note">${notes.join('<br>')}</div>` : '';
        openUrl(composeUrl(client, currentMail.to, plan.batches[0] || [], currentMail.subject, plan.body));
        if (!notes.length) toast('E-posta taslağı açıldı. Göndermeden önce kontrol edebilirsiniz.', 'info');
    }

    async function copyDraft() {
        syncDraftEdits();
        if (!currentMail) return;
        const lines = [];
        if (currentMail.to.length) lines.push('Kime: ' + currentMail.to.join('; '));
        if (currentMail.bcc.length) lines.push('Gizli (BCC): ' + currentMail.bcc.join('; '));
        lines.push('Konu: ' + currentMail.subject, '', currentMail.body);
        const ok = await copyText(lines.join('\n'));
        toast(ok ? '📋 Alıcılar, konu ve metin panoya kopyalandı.' : 'Kopyalama başarısız oldu.', ok ? 'success' : 'error');
    }

    async function sendVia(providerId) {
        syncDraftEdits();
        const p = mailProviders.find(x => x.id === providerId);
        if (!p || !currentMail) return;
        const total = currentMail.to.length + currentMail.bcc.length;
        if (!total) return alert('Geçerli alıcı yok.');
        if (!confirm(`${total} alıcıya "${currentMail.subject}" konulu e-posta ${p.label.replace(/^[^\wÇĞİÖŞÜçğıöşü]+/, '')} üzerinden gönderilecek. Onaylıyor musunuz?`)) return;
        try {
            const r = await p.send(currentMail);
            toast(`E-posta gönderimi: ${r.sent || 0} başarılı${r.failed ? ', ' + r.failed + ' başarısız' : ''}.`, r.failed ? 'warning' : 'success');
            if (!r.failed) closeModal('modal-mail-draft');
        } catch (e) { alert('Gönderim hatası: ' + e.message); }
    }

    // ---- Mail içerik şablonları ----
    function dutyBlock(exam, ownerName) {
        const lines = [
            `• Ders            : ${exam.name}`,
            `• Sınav türü      : ${exam.type || '-'}`,
            `• Tarih           : ${fmtDate(exam.date)} ${dayName(exam.date)}`,
            `• Saat            : ${exam.time} – ${endTimeOf(exam)} (${durationOf(exam)} dk)`,
            `• Salon           : ${exam.location || '-'}`,
            `• Görev türü      : ${taskTypeOf(exam)}`,
            `• Öğretim elemanı : ${exam.lecturer || '-'}`
        ];
        if (ownerName) lines.push(`• Mevcut görevli  : ${ownerName}`);
        return lines.join('\n');
    }

    function signature(staff) {
        const url = (typeof getSystemUrl === 'function') ? getSystemUrl() : '';
        return `${url ? 'Gözetmenlik Sistemi: ' + url + '\n\n' : ''}İyi çalışmalar.\n${staff ? staff.name : ''}`;
    }

    function buildSwapMail(r) {
        const A = staffById(r.initiatorId), B = staffById(r.receiverId);
        const eA = examById(initExamIdOf(r)), eB = examById(recvExamIdOf(r));
        if (!A || !B || !eA || !eB) return null;
        const row = (k, a, b) => `${k.padEnd(6)}: ${a}  ⇄  ${b}`;
        const body =
`Merhaba Hocam,

Bende bulunan ${dutyPhrase(eA)}, sizde bulunan ${dutyPhrase(eB).replace(/görevini$/, 'göreviyle')} takas etmek istiyorum.

BENDEKİ GÖREV (size geçecek)
${dutyBlock(eA)}

SİZDEKİ GÖREV (bana geçecek)
${dutyBlock(eB)}

TAKAS ÖZETİ  (bendeki ⇄ sizdeki)
${row('Ders', eA.name, eB.name)}
${row('Tarih', fmtDate(eA.date) + ' ' + dayName(eA.date), fmtDate(eB.date) + ' ' + dayName(eB.date))}
${row('Saat', eA.time + '–' + endTimeOf(eA), eB.time + '–' + endTimeOf(eB))}
${row('Salon', eA.location || '-', eB.location || '-')}
${r.note ? '\nNot: ' + r.note + '\n' : ''}
Uygun olmanız halinde görev değişimini gerçekleştirebiliriz. Talebi gözetmenlik sisteminde "Profil › Taleplerim" bölümünden onaylayabilir veya reddedebilirsiniz; siz onaylayana kadar görevlerde herhangi bir değişiklik yapılmaz.

${signature(A)}`;
        const compactBody =
`Merhaba Hocam,

Bende bulunan ${dutyPhrase(eA)}, sizde bulunan ${dutyPhrase(eB).replace(/görevini$/, 'göreviyle')} takas etmek istiyorum.

TAKAS ÖZETİ (bendeki ⇄ sizdeki)
${row('Ders', eA.name, eB.name)}
${row('Tarih', fmtDate(eA.date), fmtDate(eB.date))}
${row('Saat', eA.time + '–' + endTimeOf(eA), eB.time + '–' + endTimeOf(eB))}
${row('Salon', eA.location || '-', eB.location || '-')}
${r.note ? '\nNot: ' + r.note + '\n' : ''}
Uygun olmanız halinde görev değişimini gerçekleştirebiliriz. Onay: Sistem › Profil › Taleplerim.

İyi çalışmalar.
${A.name}`;
        const to = validEmail(B.email);
        return {
            to: to ? [to] : [], bcc: [],
            subject: 'Sınav Görev Takası Talebi',
            body, compactBody, eventType: 'swap_offer',
            title: '🔄 Takas E-postası',
            skipped: to ? [] : [B.name],
            info: `<b>${esc(A.name)}</b> → <b>${esc(B.name)}</b> takas talebi sisteme kaydedildi. Bu e-posta bilgilendirme amaçlıdır.`
        };
    }

    function buildMarketMail(r, recipients, mode) {
        const exam = examById(r.examId), owner = staffById(r.initiatorId);
        if (!exam || !owner) return null;
        const body =
`Merhaba Hocam,

${fmtDate(exam.date)} ${dayName(exam.date)} günü ${exam.time} – ${endTimeOf(exam)} saatleri arasında yapılacak ${dutyPhrase(exam)} devretmek istiyorum. Görevi almak isteyen bir hocanın benimle iletişime geçmesi rica olunur.

GÖREV BİLGİLERİ
${dutyBlock(exam, owner.name)}
• Süre            : ${durationOf(exam)} dk
${r.note ? '\nNot: ' + r.note + '\n' : ''}
Görevi almak isteyen hocalarımız gözetmenlik sisteminde "Profil › Pazar Yeri" bölümünden "Görevi Al" seçeneğiyle talep oluşturabilir. Bu e-posta yalnızca bilgilendirme amaçlıdır; görev, talep sistem üzerinden onaylanana kadar kimseye otomatik olarak atanmaz.

${signature(owner)}`;
        const compactBody =
`Merhaba Hocam,

${fmtDate(exam.date)} ${dayName(exam.date)} ${exam.time}–${endTimeOf(exam)} saatlerindeki ${dutyPhrase(exam)} devretmek istiyorum. Görevi almak isteyen bir hocanın benimle iletişime geçmesi rica olunur.

• Ders: ${exam.name} (${exam.type || '-'})
• Salon: ${exam.location || '-'} · Süre: ${durationOf(exam)} dk
• Görev türü: ${taskTypeOf(exam)} · Mevcut görevli: ${owner.name}
${r.note ? '\nNot: ' + r.note + '\n' : ''}
Talep için: Sistem › Profil › Pazar Yeri › "Görevi Al". Bu e-posta bilgilendirme amaçlıdır; görev otomatik atanmaz.

İyi çalışmalar.
${owner.name}`;
        const ownerMail = validEmail(owner.email);
        return {
            compactBody,
            to: ownerMail ? [ownerMail] : [],
            bcc: recipients.map(s => s.email),
            subject: `Görev Devri – ${exam.name} ${exam.isNonExam ? 'Görevi' : 'Sınav Gözetmenliği'}`,
            body, eventType: 'marketplace_drop',
            title: mode === 'all' ? '📢 Tüm Hocalara Görev Devri E-postası' : '📢 Uygun Hocalara Görev Devri E-postası',
            info: `${recipients.length} alıcı <b>Gizli (BCC)</b> alanına eklendi; alıcılar birbirinin adresini görmez.${ownerMail ? ' Kendi adresiniz "Kime" alanındadır.' : ''}`
        };
    }

    function buildClaimMail(r) {
        const exam = examById(r.examId), owner = staffById(r.initiatorId), claimer = staffById(r.receiverId);
        if (!exam || !owner || !claimer) return null;
        const to = validEmail(owner.email);
        return {
            to: to ? [to] : [], bcc: [], skipped: to ? [] : [owner.name],
            subject: `Görev Devri Talebi – ${exam.name}`,
            eventType: 'marketplace_claim',
            title: '🙋 Görev Sahibine Bilgilendirme',
            body:
`Merhaba Hocam,

Görev Pazarı'na çıkardığınız ${dutyPhrase(exam)} almak istiyorum.

${dutyBlock(exam, owner.name)}

Talebimi gözetmenlik sisteminde "Profil › Taleplerim" bölümünden onaylayabilirsiniz. Onayınızın ardından görev sistem üzerinden devredilecektir.

${signature(claimer)}`
        };
    }

    // ------------------------------------------------------------------
    // 5) GÖREV KARTI / TABLO İŞLEM HÜCRESİ
    // ------------------------------------------------------------------
    function statusBadge(st) {
        return st.key === 'normal' ? '' : `<span class="swap-status ${st.cls}">${esc(st.label)}</span>`;
    }

    /** Aktif görev satırındaki işlem düğmeleri (profil, sınav listesi, bireysel program) */
    function taskActionCell(exam, variant) {
        const me = myId();
        if (!me || !exam || !holds(exam, me) || !isUpcoming(exam)) return '';
        const st = getTaskStatus(exam, me);
        const id = esc(S(exam.id));
        const compact = variant === 'compact';
        if (st.key === 'normal') {
            return `<span class="swap-actions">
                <button type="button" class="btn-swap-action swap" onclick="initiateDirectSwap('${id}')" title="Başka bir hocanın göreviyle takas et">🔄${compact ? '' : ' Takas Yap'}</button>
                <button type="button" class="btn-swap-action market" onclick="initiateOpenSwap('${id}')" title="Görevi Görev Pazarı'na çıkar">📤${compact ? '' : ' Pazara Çıkar'}</button>
            </span>`;
        }
        const rid = esc(S(st.req.id));
        let btns = '';
        if (['swap_requested', 'on_market', 'transfer_sent'].includes(st.key)) {
            btns += `<button type="button" class="btn-swap-action mail" onclick="SwapMarket.resendMail('${rid}')" title="E-postayı yeniden oluştur">📧</button>`;
            btns += `<button type="button" class="btn-swap-action cancel" onclick="cancelSwapRequest('${rid}')" title="Talebi iptal et">🚫</button>`;
        } else if (['swap_pending', 'claim_pending'].includes(st.key)) {
            btns += `<button type="button" class="btn-swap-action review" onclick="SwapMarket.openRequestsTab()" title="Talebi incele">👀 İncele</button>`;
        }
        return `<span class="swap-actions">${statusBadge(st)}${btns}</span>`;
    }

    // ------------------------------------------------------------------
    // 6) TAKAS AKIŞI
    // ------------------------------------------------------------------
    function examCardHTML(exam, extra = '') {
        return `<div class="swap-exam-card">
            <div class="swap-exam-title">${esc(exam.name)} ${exam.type ? `<span class="swap-type">${esc(exam.type)}</span>` : ''}</div>
            <div class="swap-exam-meta">📅 ${fmtDate(exam.date)} ${esc(dayName(exam.date))} · 🕒 ${esc(exam.time)}–${endTimeOf(exam)} · 📍 ${esc(exam.location || '-')} · ⭐ ${parseFloat(exam.score || 0).toFixed(1)}</div>
            ${extra}
        </div>`;
    }

    function summaryTableHTML(eA, eB, leftTitle, rightTitle) {
        const row = (k, a, b) => `<tr><th>${k}</th><td>${a}</td><td>${b}</td></tr>`;
        const diff = (parseFloat(eB.score) || 0) - (parseFloat(eA.score) || 0);
        return `<table class="swap-summary-table">
            <thead><tr><th></th><th>${leftTitle}</th><th>${rightTitle}</th></tr></thead>
            <tbody>
                ${row('Ders', esc(eA.name), esc(eB.name))}
                ${row('Tarih', fmtDate(eA.date) + ' ' + esc(dayName(eA.date)), fmtDate(eB.date) + ' ' + esc(dayName(eB.date)))}
                ${row('Saat', esc(eA.time) + '–' + endTimeOf(eA), esc(eB.time) + '–' + endTimeOf(eB))}
                ${row('Salon', esc(eA.location || '-'), esc(eB.location || '-'))}
                ${row('Puan', parseFloat(eA.score || 0).toFixed(1), parseFloat(eB.score || 0).toFixed(1))}
            </tbody>
        </table>
        <div class="swap-score-note">Puan etkisi (size): <b style="color:${diff >= 0 ? '#34d399' : '#f87171'}">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}</b></div>`;
    }

    const directSwapState = { myExamId: null, targetStaffId: null, targetExamId: null };

    function initiateDirectSwap(myExamId) {
        const me = myId();
        if (!me) return alert('Lütfen önce profilinizden kimliğinizi seçin.');
        const myExam = examById(myExamId);
        if (!myExam) return alert('Sınav bulunamadı.');
        if (!holds(myExam, me)) return alert('Bu görev size ait görünmüyor.');
        if (!isUpcoming(myExam)) return alert('Geçmiş bir görev takas edilemez.');
        const active = activeRequestsForExam(myExam.id);
        if (active.length) {
            return alert(`Bu görev için zaten aktif bir talep var (${historyLabel(active[0]).label}). Yeni talep oluşturmadan önce mevcut talebi iptal edin veya sonuçlanmasını bekleyin.`);
        }

        directSwapState.myExamId = myExam.id;
        directSwapState.targetStaffId = null;
        directSwapState.targetExamId = null;

        document.getElementById('direct-swap-my-exam-id').value = myExam.id;
        document.getElementById('direct-swap-my-exam-card').innerHTML = examCardHTML(myExam);

        const sel = document.getElementById('direct-swap-target-proctor');
        const counts = {};
        (DB.exams || []).forEach(e => { if (isUpcoming(e)) proctorIdsOf(e).forEach(p => { counts[S(p)] = (counts[S(p)] || 0) + 1; }); });
        sel.innerHTML = '<option value="">Hoca seçin...</option>' + (DB.staff || [])
            .filter(s => S(s.id) !== S(me))
            .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
            .map(s => `<option value="${esc(S(s.id))}" ${counts[S(s.id)] ? '' : 'disabled'}>${esc(s.name)} (${counts[S(s.id)] || 0} aktif görev)</option>`).join('');
        sel.onchange = () => {
            directSwapState.targetStaffId = sel.value || null;
            directSwapState.targetExamId = null;
            updateDirectSwapSummary();
            renderDirectSwapTargetExams(sel.value);
        };

        document.getElementById('direct-swap-target-exams-container').classList.add('hidden');
        document.getElementById('direct-swap-note').value = '';
        document.getElementById('direct-swap-create-mail').checked = true;
        updateDirectSwapSummary();
        document.getElementById('modal-direct-swap').classList.remove('hidden');
    }

    function renderDirectSwapTargetExams(targetStaffId) {
        const container = document.getElementById('direct-swap-target-exams-container');
        const list = document.getElementById('direct-swap-exam-list');
        if (!targetStaffId) { container.classList.add('hidden'); return; }
        const me = myId();
        const myExam = examById(directSwapState.myExamId);
        const exams = (DB.exams || [])
            .filter(e => holds(e, targetStaffId) && isUpcoming(e) && S(e.id) !== S(myExam.id))
            .sort((a, b) => examStart(a) - examStart(b));

        if (!exams.length) {
            list.innerHTML = '<p class="swap-empty">Bu hocanın aktif görevi bulunmuyor.</p>';
        } else {
            list.innerHTML = exams.map(ex => {
                const busy = activeRequestsForExam(ex.id).length > 0;
                const v = validateSwap(myExam, me, ex, targetStaffId);
                const ok = !busy && v.errors.length === 0;
                const reason = busy ? 'Bu görev için başka aktif bir talep var' : v.errors.join(' · ');
                return `<div class="swap-exam-option ${ok ? '' : 'disabled'}" data-exam-id="${esc(S(ex.id))}">
                    ${examCardHTML(ex, `<div class="swap-check-line ${ok ? 'ok' : 'bad'}">${ok ? '✅ Takasa uygun' + (v.warnings.length ? ' · ⚠️ ' + esc(v.warnings.join(' · ')) : '') : '⛔ ' + esc(reason)}</div>`)}
                </div>`;
            }).join('');
            list.querySelectorAll('.swap-exam-option:not(.disabled)').forEach(el => {
                el.onclick = () => selectDirectSwapTargetExam(el.getAttribute('data-exam-id'), el);
            });
        }
        container.classList.remove('hidden');
    }

    function selectDirectSwapTargetExam(examId, element) {
        directSwapState.targetExamId = examId;
        document.querySelectorAll('#direct-swap-exam-list .swap-exam-option').forEach(el => el.classList.remove('active'));
        if (element && element.classList) element.classList.add('active');
        updateDirectSwapSummary();
    }

    function updateDirectSwapSummary() {
        const box = document.getElementById('direct-swap-summary');
        const btn = document.getElementById('btn-confirm-direct-swap');
        const eA = examById(directSwapState.myExamId), eB = examById(directSwapState.targetExamId);
        const B = staffById(directSwapState.targetStaffId);
        if (!eA || !eB || !B) { box.classList.add('hidden'); btn.disabled = true; return; }
        box.innerHTML = `<div class="swap-summary-head">Takas Özeti</div>${summaryTableHTML(eA, eB, 'Sizdeki (verilecek)', esc(B.name) + ' (alınacak)')}
            <div class="swap-mail-preview-to">Alıcı: ${validEmail(B.email) ? esc(B.email) : '<span style="color:#fbbf24">e-posta adresi kayıtlı değil (talep yine de sisteme kaydedilir)</span>'}</div>`;
        box.classList.remove('hidden');
        btn.disabled = false;
    }

    async function confirmDirectSwap() {
        const me = myId();
        const myStaff = staffById(me);
        const eA = examById(directSwapState.myExamId), eB = examById(directSwapState.targetExamId);
        const B = staffById(directSwapState.targetStaffId);
        if (!myStaff || !eA || !eB || !B) return alert('Lütfen hoca ve takas edilecek görevi seçin.');

        if (activeRequestsForExam(eA.id).length || activeRequestsForExam(eB.id).length) {
            return alert('Seçilen görevlerden biri için başka bir aktif talep oluştu. Lütfen listeyi yenileyin.');
        }
        const v = validateSwap(eA, myStaff.id, eB, B.id);
        if (v.errors.length) return showResultError(v, '⛔ Bu takas mevcut kurallara uymuyor:');

        const note = document.getElementById('direct-swap-note').value.trim();
        const wantMail = document.getElementById('direct-swap-create-mail').checked;

        const req = {
            id: Date.now(),
            type: 'direct_swap',
            initiatorId: myStaff.id, initiatorName: myStaff.name, initiatorExamId: eA.id,
            receiverId: B.id, receiverName: B.name, receiverExamId: eB.id,
            examName: eA.name, targetExamName: eB.name,
            examDate: eA.date, examTime: eA.time,
            note, status: 'pending_peer', createdAt: nowIso()
        };
        if (!DB.requests) DB.requests = [];
        DB.requests.push(req);
        notify(B.id, `🔄 Takas Talebi: ${myStaff.name}, "${eA.name}" görevini sizin "${eB.name}" görevinizle takas etmek istiyor. Profil › Taleplerim'den yanıtlayabilirsiniz.`, 'swap_request', req.id);
        if (typeof logAction === 'function') logAction('user', 'Takas Talebi', `${myStaff.name} → ${B.name}: ${eA.name} ⇄ ${eB.name}`);
        safeDispatch('swap_offer', {
            initiatorName: myStaff.name, receiverName: B.name, receiverId: B.id,
            initiatorExamName: eA.name, receiverExamName: eB.name, examDate: eA.date, examTime: eA.time
        });
        persist();
        closeModal('modal-direct-swap');
        refreshUI();
        toast('✓ Takas talebi oluşturuldu. Görevler, karşı taraf onaylayana kadar değişmez.', 'success');
        if (wantMail) { const m = buildSwapMail(req); if (m) openMailDraft(m); }
    }

    // ---- Pazar ilanına takas teklifi ----
    const offerState = { marketReqId: null, myExamId: null };

    function openOfferSwapModal(requestId) {
        const me = myId();
        if (!me) return alert('Lütfen önce profilinizden kimliğinizi seçin.');
        const mr = reqById(requestId);
        if (!mr || mr.status !== 'pending' || mr.receiverId != null) return alert('Bu ilan artık aktif değil.');
        const target = examById(mr.examId);
        if (!target) return alert('Sınav bulunamadı.');
        offerState.marketReqId = mr.id; offerState.myExamId = null;

        document.getElementById('offer-swap-request-id').value = mr.id;
        document.getElementById('offer-swap-target-card').innerHTML = examCardHTML(target, `<div class="swap-check-line">Görev sahibi: <b>${esc(mr.initiatorName || '')}</b></div>`);
        const myExams = (DB.exams || []).filter(e => holds(e, me) && isUpcoming(e)).sort((a, b) => examStart(a) - examStart(b));
        const list = document.getElementById('offer-swap-exam-list');
        if (!myExams.length) list.innerHTML = '<p class="swap-empty">Aktif göreviniz bulunmuyor; takas teklif edemezsiniz. "Görevi Al" seçeneğini kullanabilirsiniz.</p>';
        else {
            list.innerHTML = myExams.map(ex => {
                const busy = activeRequestsForExam(ex.id).length > 0;
                const v = validateSwap(ex, me, target, mr.initiatorId);
                const ok = !busy && !v.errors.length;
                return `<div class="swap-exam-option ${ok ? '' : 'disabled'}" data-exam-id="${esc(S(ex.id))}">
                    ${examCardHTML(ex, `<div class="swap-check-line ${ok ? 'ok' : 'bad'}">${ok ? '✅ Teklif edilebilir' : '⛔ ' + esc(busy ? 'Bu görev için aktif bir talebiniz var' : v.errors.join(' · '))}</div>`)}
                </div>`;
            }).join('');
            list.querySelectorAll('.swap-exam-option:not(.disabled)').forEach(el => {
                el.onclick = () => {
                    offerState.myExamId = el.getAttribute('data-exam-id');
                    list.querySelectorAll('.swap-exam-option').forEach(x => x.classList.remove('active'));
                    el.classList.add('active');
                    const box = document.getElementById('offer-swap-summary');
                    box.innerHTML = `<div class="swap-summary-head">Teklif Özeti</div>${summaryTableHTML(examById(offerState.myExamId), target, 'Sizdeki (verilecek)', esc(mr.initiatorName || '') + ' (alınacak)')}`;
                    box.classList.remove('hidden');
                    document.getElementById('btn-confirm-offer-swap').disabled = false;
                };
            });
        }
        document.getElementById('offer-swap-summary').classList.add('hidden');
        document.getElementById('offer-swap-note').value = '';
        document.getElementById('offer-swap-create-mail').checked = true;
        document.getElementById('btn-confirm-offer-swap').disabled = true;
        document.getElementById('modal-offer-swap').classList.remove('hidden');
    }

    async function confirmOfferSwap() {
        const me = myId();
        const myStaff = staffById(me);
        const mr = reqById(offerState.marketReqId);
        const eA = examById(offerState.myExamId);
        const eB = mr ? examById(mr.examId) : null;
        const owner = mr ? staffById(mr.initiatorId) : null;
        if (!myStaff || !mr || !eA || !eB || !owner) return alert('Kayıt bulunamadı. Lütfen sayfayı yenileyin.');
        if (mr.status !== 'pending') return alert('Bu ilan artık aktif değil.');
        const v = validateSwap(eA, myStaff.id, eB, owner.id);
        if (v.errors.length) return showResultError(v, '⛔ Bu takas mevcut kurallara uymuyor:');
        if ((DB.requests || []).some(r => isActiveReq(r) && isSwapReq(r) && S(r.initiatorId) === S(myStaff.id) && S(recvExamIdOf(r)) === S(eB.id))) {
            return alert('Bu ilan için zaten bir takas teklifiniz var.');
        }
        const req = {
            id: Date.now(), type: 'direct_swap',
            initiatorId: myStaff.id, initiatorName: myStaff.name, initiatorExamId: eA.id,
            receiverId: owner.id, receiverName: owner.name, receiverExamId: eB.id,
            examName: eA.name, targetExamName: eB.name, examDate: eA.date, examTime: eA.time,
            marketRequestId: mr.id,
            note: document.getElementById('offer-swap-note').value.trim(),
            status: 'pending_peer', createdAt: nowIso()
        };
        DB.requests.push(req);
        notify(owner.id, `🔄 Pazardaki "${eB.name}" göreviniz için ${myStaff.name} takas teklif etti ("${eA.name}"). Profil › Taleplerim'den yanıtlayabilirsiniz.`, 'swap_request', req.id);
        if (typeof logAction === 'function') logAction('user', 'Pazar Takas Teklifi', `${myStaff.name} → ${owner.name}: ${eA.name} ⇄ ${eB.name}`);
        safeDispatch('swap_offer', { initiatorName: myStaff.name, receiverName: owner.name, receiverId: owner.id, initiatorExamName: eA.name, receiverExamName: eB.name, examDate: eA.date, examTime: eA.time });
        persist();
        closeModal('modal-offer-swap');
        refreshUI();
        toast('✓ Takas teklifiniz görev sahibine iletildi.', 'success');
        if (document.getElementById('offer-swap-create-mail').checked) { const m = buildSwapMail(req); if (m) openMailDraft(m); }
    }

    async function acceptSwap(requestId) {
        const r = reqById(requestId);
        if (!r) return;
        const me = staffById(r.receiverId);
        if (!isAdmin() && S(r.receiverId) !== S(myId())) return alert('Bu talebi yalnızca teklif yapılan hoca onaylayabilir.');
        const okStatus = r.type === 'direct_swap' ? r.status === 'pending_peer' : r.status === 'pending';
        if (!okStatus) { alert('Bu talep artık aktif değil.'); refreshUI(); return; }
        const v = validateRequest(r);
        if (v.errors.length) {
            showResultError(v, '⛔ Takas şu an gerçekleştirilemiyor:');
            return;
        }
        const warn = v.warnings.length ? `\n\n⚠️ Uyarılar:\n• ${v.warnings.join('\n• ')}` : '';
        const confirmed = await (typeof confirmWithPassword === 'function'
            ? confirmWithPassword(`"${reqTitle(r)}" takasını onaylıyor musunuz?${warn}`, me)
            : Promise.resolve(confirm(`"${reqTitle(r)}" takasını onaylıyor musunuz?${warn}`)));
        if (!confirmed) return;
        const res = finalizeRequest(r);
        if (!res.ok) return showResultError(res);
        refreshUI();
        alert(res.awaitingAdmin ? '✓ Onayınız alındı. Değişiklik yönetici onayından sonra uygulanacak.' : '✅ Takas gerçekleşti. Görevler ve puanlar güncellendi.');
    }

    function rejectSwap(requestId) {
        const r = reqById(requestId);
        if (!r || !isActiveReq(r)) return;
        if (!confirm('Bu takas teklifini reddetmek istediğinize emin misiniz?')) return;
        r.status = 'rejected'; r.rejectedAt = nowIso(); r.updatedAt = r.rejectedAt;
        notify(r.initiatorId, `❌ ${r.receiverName || 'Karşı taraf'}, "${reqTitle(r)}" takas teklifinizi reddetti.`, 'swap_rejected', r.id);
        if (typeof logAction === 'function') logAction('user', 'Takas Reddi', `${r.receiverName}, ${r.initiatorName} teklifini reddetti (${reqTitle(r)}).`);
        safeDispatch('swap_rejected', { initiatorName: r.initiatorName, initiatorId: r.initiatorId, receiverName: r.receiverName, examName: reqTitle(r) });
        persist();
        refreshUI();
    }

    // ------------------------------------------------------------------
    // 7) GÖREV PAZARI AKIŞI
    // ------------------------------------------------------------------
    const marketState = { examId: null, reqId: null };

    function initiateOpenSwap(examId) {
        const me = myId();
        if (!me) return alert('Lütfen önce profilinizden kimliğinizi seçin.');
        const exam = examById(examId);
        if (!exam) return alert('Sınav bulunamadı.');
        if (!holds(exam, me)) return alert('Bu görev size ait görünmüyor.');
        if (!isUpcoming(exam)) return alert('Geçmiş bir görev pazara çıkarılamaz.');
        const active = activeRequestsForExam(exam.id);
        if (active.length) return alert(`Bu görev için zaten aktif bir talep var (${historyLabel(active[0]).label}).`);

        marketState.examId = exam.id; marketState.reqId = null;
        document.getElementById('market-drop-exam-card').innerHTML = examCardHTML(exam);
        document.getElementById('market-drop-note').value = '';
        document.getElementById('market-drop-step1').classList.remove('hidden');
        document.getElementById('market-drop-step2').classList.add('hidden');
        document.getElementById('market-drop-title').textContent = '📤 Görevi Pazara Çıkar';
        document.getElementById('modal-market-drop').classList.remove('hidden');
    }

    function confirmMarketDrop() {
        const me = myId();
        const staff = staffById(me);
        const exam = examById(marketState.examId);
        if (!staff || !exam) return;
        if (activeRequestsForExam(exam.id).length) return alert('Bu görev için zaten aktif bir talep var.');
        const req = {
            id: Date.now(), type: 'market',
            examId: exam.id, examName: exam.name, examDate: exam.date, examTime: exam.time,
            initiatorId: staff.id, initiatorName: staff.name,
            receiverId: null, receiverName: 'Açık Talep',
            note: document.getElementById('market-drop-note').value.trim(),
            status: 'pending', fromApproved: true, toApproved: false,
            createdAt: nowIso()
        };
        if (!DB.requests) DB.requests = [];
        DB.requests.push(req);
        if (typeof logAction === 'function') logAction('user', 'Görev Pazara Çıkarıldı', `${staff.name}, "${exam.name}" görevini Görev Pazarı'na çıkardı.`);
        safeDispatch('marketplace_drop', {
            initiatorName: staff.name, initiatorId: staff.id, examName: exam.name,
            examDate: exam.date, examTime: exam.time, duration: exam.duration, score: exam.score, requestId: req.id
        });
        persist();
        marketState.reqId = req.id;
        showMarketMailStep(req);
        refreshUI();
    }

    function showMarketMailStep(req) {
        const exam = examById(req.examId);
        if (!exam) return;
        marketState.reqId = req.id;
        const rec = getMarketRecipients(exam, req.initiatorId);
        document.getElementById('market-drop-title').textContent = '✅ Görev Pazara Çıkarıldı';
        document.getElementById('market-drop-step1').classList.add('hidden');
        document.getElementById('market-drop-step2').classList.remove('hidden');
        document.getElementById('market-drop-exam-card-2').innerHTML = examCardHTML(exam, '<div class="swap-check-line"><span class="swap-status st-market">Pazara Çıkarıldı</span> Görev, bir hoca talep edip onaylanana kadar sizde kalır.</div>');
        document.getElementById('market-drop-counts').innerHTML = `
            <div><b>${rec.eligible.length}</b> uygun hoca (müsait, çakışması yok, kurallara uygun, e-postası kayıtlı)</div>
            <div><b>${rec.all.length}</b> hoca e-posta adresi kayıtlı (siz hariç)</div>`;
        document.getElementById('market-drop-excluded').innerHTML = rec.excluded.length ? `
            <details><summary>Hariç tutulan ${rec.excluded.length} hoca ve nedenleri</summary>
            <ul>${rec.excluded.map(x => `<li><b>${esc(x.staff.name)}</b>: ${esc(x.reasons.join(' · '))}</li>`).join('')}</ul></details>` : '';
        const btnE = document.getElementById('btn-market-mail-eligible');
        const btnA = document.getElementById('btn-market-mail-all');
        btnE.textContent = `📧 Uygun Hocalara Gönder (${rec.eligible.length})`;
        btnA.textContent = `📧 Tüm Hocalara Gönder (${rec.all.length})`;
        btnE.disabled = !rec.eligible.length;
        btnA.disabled = !rec.all.length;
        document.getElementById('modal-market-drop').classList.remove('hidden');
    }

    function sendMarketMail(mode) {
        const req = reqById(marketState.reqId);
        if (!req) return;
        const exam = examById(req.examId);
        const rec = getMarketRecipients(exam, req.initiatorId);
        const list = mode === 'all' ? rec.all : rec.eligible;
        const m = buildMarketMail(req, list, mode);
        if (!m) return;
        m.skipped = (DB.staff || []).filter(s => S(s.id) !== S(req.initiatorId) && !validEmail(s.email)).map(s => s.name);
        req.mailSentAt = nowIso(); req.mailMode = mode; req.mailRecipientCount = list.length;
        persist();
        closeModal('modal-market-drop');
        openMailDraft(m);
    }

    function renderMarketplace() {
        const me = myId();
        const tbody = document.querySelector('#profile-table-marketplace tbody');
        if (!tbody || !me) return;
        let dismissed = [];
        try { dismissed = JSON.parse(localStorage.getItem(`dismissed_requests_${me}`) || '[]').map(S); } catch (e) { /* yoksay */ }

        const open = (DB.requests || []).filter(r => {
            if (r.status !== 'pending' || r.receiverId != null || isSwapReq(r)) return false;
            const ex = examById(r.examId);
            return ex && isUpcoming(ex);
        }).sort((a, b) => examStart(examById(a.examId)) - examStart(examById(b.examId)));

        const mine = open.filter(r => S(r.initiatorId) === S(me));
        const others = open.filter(r => S(r.initiatorId) !== S(me) && !dismissed.includes(S(r.id)));
        const rows = [];

        others.map(r => ({ r, ex: examById(r.examId), v: validateTransfer(examById(r.examId), r.initiatorId, me) }))
            .sort((a, b) => (a.v.errors.length ? 1 : 0) - (b.v.errors.length ? 1 : 0))
            .forEach(({ r, ex, v }) => {
                const ok = !v.errors.length;
                const rid = esc(S(r.id));
                rows.push(`<tr class="${ok ? '' : 'market-row-disabled'}">
                    <td><strong>${esc(ex.name)}</strong> ${ex.type ? `<span class="swap-type">${esc(ex.type)}</span>` : ''}<br>
                        <small>${esc(r.initiatorName)} · 📍 ${esc(ex.location || '-')}</small>
                        ${r.note ? `<br><small class="market-note">💬 ${esc(r.note)}</small>` : ''}
                        ${ok ? (v.warnings.length ? `<br><small style="color:#fbbf24">⚠️ ${esc(v.warnings.join(' · '))}</small>` : '') : `<br><small style="color:#f87171">⛔ ${esc(v.errors.join(' · '))}</small>`}
                    </td>
                    <td>${fmtDate(ex.date)}<br><small>${esc(dayName(ex.date))}</small></td>
                    <td>${esc(ex.time)}–${endTimeOf(ex)}</td>
                    <td>${durationOf(ex)} dk</td>
                    <td><span class="score-tag">+${parseFloat(ex.score || 0).toFixed(1)}</span></td>
                    <td style="text-align:right;"><div class="market-actions">
                        <button class="btn-primary" ${ok ? '' : 'disabled'} onclick="acceptOpenRequest('${rid}')" style="background: var(--accent-green);">🙋 Görevi Al</button>
                        <button class="btn-secondary" onclick="openOfferSwapModal('${rid}')">🔄 Takas Teklif Et</button>
                        <button class="btn-delete" onclick="dismissMarketplaceRequest('${rid}')" title="Bu ilanı listemden gizle">Gizle</button>
                    </div></td>
                </tr>`);
            });

        if (mine.length) {
            rows.push(`<tr class="market-section-row"><td colspan="6">📤 Pazardaki görevleriniz</td></tr>`);
            mine.forEach(r => {
                const ex = examById(r.examId), rid = esc(S(r.id));
                rows.push(`<tr class="market-row-mine">
                    <td><strong>${esc(ex.name)}</strong><br><small><span class="swap-status st-market">Pazara Çıkarıldı</span> ${r.mailSentAt ? '· 📧 e-posta taslağı oluşturuldu' : ''}</small></td>
                    <td>${fmtDate(ex.date)}</td><td>${esc(ex.time)}–${endTimeOf(ex)}</td><td>${durationOf(ex)} dk</td>
                    <td><span class="score-tag">+${parseFloat(ex.score || 0).toFixed(1)}</span></td>
                    <td style="text-align:right;"><div class="market-actions">
                        <button class="btn-secondary" onclick="SwapMarket.resendMail('${rid}')">📧 Hocalara E-posta</button>
                        <button class="btn-delete" onclick="cancelSwapRequest('${rid}')">Pazardan Kaldır</button>
                    </div></td>
                </tr>`);
            });
        }

        tbody.innerHTML = rows.length ? rows.join('')
            : '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Şu an Görev Pazarı\'nda açık görev bulunmuyor.</td></tr>';
    }

    async function claimMarketTask(requestId) {
        const me = myId();
        const staff = staffById(me);
        const r = reqById(requestId);
        if (!staff || !r) return;
        if (r.status !== 'pending' || r.receiverId != null) {
            alert('Üzgünüz, bu görev az önce başka biri tarafından talep edildi veya ilan kaldırıldı.');
            return refreshUI();
        }
        if (S(r.initiatorId) === S(me)) return alert('Kendi görevinizi talep edemezsiniz.');
        const exam = examById(r.examId);
        const v = validateTransfer(exam, r.initiatorId, me);
        if (v.errors.length) return showResultError(v, '⛔ Bu görevi şu an alamazsınız:');
        const needOwner = settings().marketplaceOwnerApproval;
        const warn = v.warnings.length ? `\n\n⚠️ Uyarılar:\n• ${v.warnings.join('\n• ')}` : '';
        const msg = needOwner
            ? `"${exam.name}" görevi için devir talebi oluşturulacak. Görev, ${r.initiatorName} onayladıktan sonra size geçecek.${warn}\n\nOnaylamak için şifrenizi girin.`
            : `"${exam.name}" görevini devralmayı onaylıyor musunuz?${warn}`;
        const ok = await (typeof confirmWithPassword === 'function' ? confirmWithPassword(msg, staff) : Promise.resolve(confirm(msg)));
        if (!ok) return;
        if (r.status !== 'pending' || r.receiverId != null) { alert('Bu görev az önce başka biri tarafından talep edildi.'); return refreshUI(); }

        r.receiverId = staff.id;
        r.receiverName = staff.name;
        r.claimedAt = nowIso();
        r.updatedAt = r.claimedAt;

        if (needOwner) {
            r.status = 'claim_pending';
            notify(r.initiatorId, `🙋 Devir Talebi: ${staff.name}, pazardaki "${exam.name}" görevinizi almak istiyor. Profil › Taleplerim'den onaylayabilirsiniz.`, 'swap_request', r.id);
            if (typeof logAction === 'function') logAction('user', 'Devir Talebi', `${staff.name}, ${r.initiatorName} hocanın "${exam.name}" görevine talip oldu.`);
            safeDispatch('swap_offer', { initiatorName: staff.name, receiverName: r.initiatorName, receiverId: r.initiatorId, initiatorExamName: exam.name, receiverExamName: 'Görev Pazarı', examDate: exam.date, examTime: exam.time });
            persist();
            refreshUI();
            if (confirm(`✓ Devir talebiniz ${r.initiatorName} hocaya iletildi. Görev, onay verilene kadar değişmeyecek.\n\nGörev sahibine bilgilendirme e-postası oluşturmak ister misiniz?`)) {
                const m = buildClaimMail(r); if (m) openMailDraft(m);
            }
            return;
        }
        const res = finalizeRequest(r);
        if (!res.ok) {
            r.receiverId = null; r.receiverName = 'Açık Talep'; r.status = 'pending';
            persist();
            return showResultError(res);
        }
        refreshUI();
        alert(res.awaitingAdmin ? '✓ Talebiniz alındı. Görev devri yönetici onayından sonra gerçekleşecek.' : '✅ Görev devralındı; görev listeleri ve puanlar güncellendi.');
    }

    async function confirmClaim(requestId) {
        const r = reqById(requestId);
        if (!r || !['claim_pending', 'accepted_waiting_approval', 'pending'].includes(r.status) || r.receiverId == null) return alert('Bu talep artık aktif değil.');
        if (!isAdmin() && S(r.initiatorId) !== S(myId())) return alert('Bu talebi yalnızca görevin sahibi onaylayabilir.');
        const owner = staffById(r.initiatorId);
        const v = validateRequest(r);
        if (v.errors.length) {
            showResultError(v, '⛔ Devir şu an gerçekleştirilemiyor:');
            if (confirm('Bu devir talebini reddedip görevi tekrar pazara açmak ister misiniz?')) rejectClaim(requestId, true);
            return;
        }
        const warn = v.warnings.length ? `\n\n⚠️ Uyarılar:\n• ${v.warnings.join('\n• ')}` : '';
        const ok = await (typeof confirmWithPassword === 'function'
            ? confirmWithPassword(`"${reqTitle(r)}" görevini ${r.receiverName} hocaya devretmeyi onaylıyor musunuz?${warn}`, owner)
            : Promise.resolve(confirm(`Devri onaylıyor musunuz?${warn}`)));
        if (!ok) return;
        const res = finalizeRequest(r);
        if (!res.ok) return showResultError(res);
        refreshUI();
        alert(res.awaitingAdmin ? '✓ Onayınız alındı. Devir yönetici onayından sonra uygulanacak.' : '✅ Görev devredildi; görev listeleri ve puanlar güncellendi.');
    }

    function rejectClaim(requestId, silent) {
        const r = reqById(requestId);
        if (!r || r.receiverId == null) return;
        if (!silent && !confirm(`${r.receiverName} hocanın devir talebini reddetmek istiyor musunuz? Görev pazarda açık kalmaya devam eder.`)) return;
        const claimerId = r.receiverId, claimerName = r.receiverName;
        if (!Array.isArray(r.rejectedClaims)) r.rejectedClaims = [];
        r.rejectedClaims.push({ staffId: claimerId, name: claimerName, at: nowIso() });
        if (isMarketReq(r)) {
            r.receiverId = null; r.receiverName = 'Açık Talep'; r.status = 'pending';
        } else {
            r.status = 'rejected'; r.rejectedAt = nowIso();
        }
        r.updatedAt = nowIso();
        notify(claimerId, `❌ ${r.initiatorName}, "${reqTitle(r)}" görevi için devir talebinizi onaylamadı.`, 'swap_rejected', r.id);
        if (typeof logAction === 'function') logAction('user', 'Devir Talebi Reddedildi', `${r.initiatorName}, ${claimerName} talebini reddetti (${reqTitle(r)}).`);
        safeDispatch('swap_rejected', { initiatorName: r.initiatorName, initiatorId: r.initiatorId, receiverName: claimerName, examName: reqTitle(r) });
        persist();
        refreshUI();
    }

    function withdrawClaim(requestId) {
        const r = reqById(requestId);
        if (!r || r.status !== 'claim_pending' || S(r.receiverId) !== S(myId())) return;
        if (!confirm('Devir talebinizi geri çekmek istiyor musunuz?')) return;
        notify(r.initiatorId, `ℹ️ ${r.receiverName}, "${reqTitle(r)}" için devir talebini geri çekti. Göreviniz pazarda açık.`, 'request_cancelled', r.id);
        r.receiverId = null; r.receiverName = 'Açık Talep'; r.status = 'pending'; r.updatedAt = nowIso();
        persist();
        refreshUI();
    }

    function cancelRequest(requestId) {
        const r = reqById(requestId);
        if (!r || !isActiveReq(r)) return;
        if (!isAdmin() && S(r.initiatorId) !== S(myId())) return alert('Talebi yalnızca oluşturan kişi iptal edebilir.');
        const q = r.status === 'claim_pending'
            ? `Bu görev için ${r.receiverName} hocanın devir talebi var. İlanı kaldırırsanız talep de iptal edilir. Devam edilsin mi?`
            : 'Bu talebi iptal etmek istediğinize emin misiniz? Görev ataması değişmez.';
        if (!confirm(q)) return;
        r.status = 'cancelled'; r.cancelledAt = nowIso(); r.updatedAt = r.cancelledAt;
        if (r.receiverId != null) notify(r.receiverId, `ℹ️ ${r.initiatorName}, "${reqTitle(r)}" talebini iptal etti.`, 'request_cancelled', r.id);
        if (typeof logAction === 'function') logAction('user', 'Talep İptali', `${r.initiatorName}, "${reqTitle(r)}" talebini iptal etti.`);
        safeDispatch('swap_cancelled', { initiatorName: r.initiatorName, examName: reqTitle(r) });
        persist();
        refreshUI();
        toast('✓ Talep iptal edildi.', 'info');
    }

    function resendMail(requestId) {
        const r = reqById(requestId);
        if (!r) return;
        if (isSwapReq(r)) { const m = buildSwapMail(r); if (m) openMailDraft(m); return; }
        if (r.status === 'claim_pending' && S(r.receiverId) === S(myId())) { const m = buildClaimMail(r); if (m) openMailDraft(m); return; }
        if (r.status === 'pending' && r.receiverId == null) {
            marketState.reqId = r.id; marketState.examId = r.examId;
            showMarketMailStep(r);
        }
    }

    // ------------------------------------------------------------------
    // 8) "TALEPLERİM" SEKMESİ
    // ------------------------------------------------------------------
    function incomingFor(staffId) {
        return (DB.requests || []).filter(r => {
            if (isSwapReq(r)) {
                const pend = r.type === 'direct_swap' ? r.status === 'pending_peer' : r.status === 'pending';
                return pend && S(r.receiverId) === S(staffId);
            }
            if (r.status === 'claim_pending' && S(r.initiatorId) === S(staffId)) return true;              // pazardaki görevime talip var
            if (r.status === 'pending' && r.receiverId != null && S(r.receiverId) === S(staffId)) return true; // eski tip yönlendirilmiş devir
            return false;
        });
    }

    function requestRowHTML(r, role) {
        const rid = esc(S(r.id));
        const st = historyLabel(r);
        let desc = '', actions = '', extra = '';
        if (isSwapReq(r)) {
            const eA = examById(initExamIdOf(r)), eB = examById(recvExamIdOf(r));
            if (eA && eB) extra = summaryTableHTML(role === 'incoming' ? eB : eA, role === 'incoming' ? eA : eB,
                role === 'incoming' ? 'Sizdeki (verilecek)' : 'Sizdeki (verilecek)', role === 'incoming' ? esc(r.initiatorName) + ' (alınacak)' : esc(r.receiverName) + ' (alınacak)');
            desc = role === 'incoming'
                ? `<b>${esc(r.initiatorName)}</b> takas teklif ediyor${r.type === 'smart_swap' ? ' <span class="swap-type">AI önerisi</span>' : ''}`
                : `<b>${esc(r.receiverName)}</b> hocaya takas teklifi`;
            if (role === 'incoming') {
                const acc = r.type === 'smart_swap' ? `acceptSmartSwap('${rid}')` : `acceptDirectSwap('${rid}')`;
                const rej = r.type === 'smart_swap' ? `rejectSmartSwap('${rid}')` : `rejectDirectSwap('${rid}')`;
                actions = `<button class="btn-primary" style="background:var(--accent-green)" onclick="${acc}">✓ Kabul Et</button><button class="btn-delete" onclick="${rej}">Reddet</button>`;
            } else if (isActiveReq(r) && r.status !== 'awaiting_admin') {
                actions = `<button class="btn-secondary" onclick="SwapMarket.resendMail('${rid}')">📧 Maili Tekrar Oluştur</button><button class="btn-delete" onclick="cancelSwapRequest('${rid}')">İptal Et</button>`;
            }
        } else {
            const ex = examById(r.examId);
            if (ex) extra = examCardHTML(ex);
            if (role === 'incoming') {
                desc = r.status === 'claim_pending'
                    ? `<b>${esc(r.receiverName)}</b> pazardaki görevinizi almak istiyor`
                    : `<b>${esc(r.initiatorName)}</b> görevini size devretmek istiyor`;
                actions = r.status === 'claim_pending'
                    ? `<button class="btn-primary" style="background:var(--accent-green)" onclick="confirmOpenRequest('${rid}')">✓ Devri Onayla</button><button class="btn-delete" onclick="rejectOpenRequest('${rid}')">Reddet</button>`
                    : `<button class="btn-primary" style="background:var(--accent-green)" onclick="approveSwapPeer('${rid}')">✓ Kabul Et</button><button class="btn-delete" onclick="rejectSwapPeer('${rid}')">Reddet</button>`;
            } else if (role === 'claim') {
                desc = `<b>${esc(r.initiatorName)}</b> hocanın görevine devir talebiniz`;
                actions = `<button class="btn-secondary" onclick="SwapMarket.resendMail('${rid}')">📧 Bilgi Maili</button><button class="btn-delete" onclick="SwapMarket.withdrawClaim('${rid}')">Talebi Geri Çek</button>`;
            } else {
                desc = r.receiverId == null ? 'Görev Pazarı ilanınız' : `<b>${esc(r.receiverName)}</b> devir talebi`;
                if (isActiveReq(r) && r.status !== 'awaiting_admin') actions = `<button class="btn-secondary" onclick="SwapMarket.resendMail('${rid}')">📧 E-posta</button><button class="btn-delete" onclick="cancelSwapRequest('${rid}')">İptal Et</button>`;
                if (r.status === 'claim_pending') actions = `<button class="btn-primary" style="background:var(--accent-green)" onclick="confirmOpenRequest('${rid}')">✓ Devri Onayla</button><button class="btn-delete" onclick="rejectOpenRequest('${rid}')">Reddet</button>`;
            }
        }
        const when = r.completedAt || r.cancelledAt || r.rejectedAt || r.expiredAt || r.updatedAt || r.createdAt;
        return `<div class="request-card">
            <div class="request-card-head">
                <div>${desc}</div>
                <span class="swap-status ${st.cls}">${esc(st.label)}</span>
            </div>
            ${extra}
            ${r.note ? `<div class="market-note">💬 ${esc(r.note)}</div>` : ''}
            ${r.cancelReason ? `<div class="market-note">ℹ️ ${esc(r.cancelReason)}</div>` : ''}
            <div class="request-card-foot"><small>${when ? new Date(when).toLocaleString('tr-TR') : ''}</small><div class="market-actions">${actions}</div></div>
        </div>`;
    }

    function renderMyRequests() {
        const pane = document.getElementById('my-requests-content');
        const me = myId();
        const badge = document.getElementById('requests-tab-badge');
        if (!pane || !me) { if (badge) badge.classList.add('hidden'); return; }

        const incoming = incomingFor(me);
        const reqs = DB.requests || [];
        const sent = reqs.filter(r => isActiveReq(r) && r.status !== 'awaiting_admin' && S(r.initiatorId) === S(me) && !(r.status === 'claim_pending'));
        const myClaims = reqs.filter(r => r.status === 'claim_pending' && S(r.receiverId) === S(me));
        const waitingAdmin = reqs.filter(r => r.status === 'awaiting_admin' && (S(r.initiatorId) === S(me) || S(r.receiverId) === S(me)));
        const history = reqs.filter(r => !isActiveReq(r) && (S(r.initiatorId) === S(me) || S(r.receiverId) === S(me)))
            .sort((a, b) => new Date(b.completedAt || b.cancelledAt || b.rejectedAt || b.updatedAt || b.createdAt || 0) - new Date(a.completedAt || a.cancelledAt || a.rejectedAt || a.updatedAt || a.createdAt || 0))
            .slice(0, 20);

        const section = (title, items, role, empty) => `
            <div class="requests-section">
                <h4>${title} <span class="requests-count">${items.length}</span></h4>
                ${items.length ? items.map(r => requestRowHTML(r, typeof role === 'function' ? role(r) : role)).join('') : `<p class="swap-empty">${empty}</p>`}
            </div>`;

        pane.innerHTML =
            section('📥 Onayınızı Bekleyenler', incoming, 'incoming', 'Onay bekleyen talep yok.') +
            section('📤 Gönderdiğiniz Talepler', sent.concat(myClaims), r => (r.status === 'claim_pending' && S(r.receiverId) === S(me)) ? 'claim' : 'sent', 'Aktif talebiniz yok. Aktif Görevler sekmesinden 🔄 Takas Yap veya 📤 Pazara Çıkar ile başlayabilirsiniz.') +
            (waitingAdmin.length ? section('🛡️ Yönetici Onayı Bekleyenler', waitingAdmin, 'history', '') : '') +
            section('🗂️ Geçmiş', history, 'history', 'Henüz sonuçlanmış talep yok.');

        if (badge) {
            badge.textContent = incoming.length;
            badge.classList.toggle('hidden', incoming.length === 0);
        }
    }

    /** Profil üstündeki "Yeni Takas Teklifleri" kutusu */
    function renderProfileProposals() {
        const box = document.getElementById('profile-swap-proposals');
        const me = myId();
        if (!box || !me) return;
        const incoming = incomingFor(me);
        if (!incoming.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
        box.classList.remove('hidden');
        box.innerHTML = `<div class="swap-proposals-banner">
            <div><span style="font-size:1.3rem">🔔</span> <b>${incoming.length}</b> talep onayınızı bekliyor:
            ${incoming.slice(0, 3).map(r => `<span class="swap-proposal-chip">${esc(isSwapReq(r) ? r.initiatorName + ' · ' + reqTitle(r) : (r.status === 'claim_pending' ? r.receiverName : r.initiatorName) + ' · ' + reqTitle(r))}</span>`).join('')}
            ${incoming.length > 3 ? '…' : ''}</div>
            <button class="btn-primary" onclick="SwapMarket.openRequestsTab()">Taleplerim'e Git</button>
        </div>`;
    }

    function openRequestsTab() {
        const btnProfile = document.getElementById('btn-profile');
        const section = document.getElementById('section-profile');
        if (btnProfile && section && section.classList.contains('hidden')) btnProfile.click();
        const tab = document.querySelector('#section-profile .tab-btn[data-tab="requests"]');
        if (tab) tab.click();
        renderMyRequests();
    }

    // ------------------------------------------------------------------
    // 9) YÖNETİCİ ONAY PANELİ
    // ------------------------------------------------------------------
    function renderAdminPanel() {
        const card = document.getElementById('card-swap-admin');
        if (!card) return;
        if (!isAdmin()) { card.classList.add('hidden'); return; }
        const s = settings();
        const pending = (DB.requests || []).filter(r => r.status === 'awaiting_admin');
        card.classList.remove('hidden');
        card.innerHTML = `
            <div class="swap-admin-head">
                <h3>🛡️ Görev Takası / Devir Onayları <span class="requests-count">${pending.length}</span></h3>
                <div class="swap-admin-settings">
                    <label><input type="checkbox" ${s.adminApproval ? 'checked' : ''} onchange="SwapMarket.setSetting('adminApproval', this.checked)"> Değişiklikler yönetici onayı gerektirsin</label>
                    <label><input type="checkbox" ${s.marketplaceOwnerApproval ? 'checked' : ''} onchange="SwapMarket.setSetting('marketplaceOwnerApproval', this.checked)"> Pazardan alımda görev sahibinin onayı gereksin</label>
                </div>
            </div>
            ${pending.length ? pending.map(r => {
                const v = validateRequest(r);
                const rid = esc(S(r.id));
                return `<div class="request-card">
                    <div class="request-card-head"><div><b>${esc(r.initiatorName)}</b> ${isSwapReq(r) ? '⇄' : '→'} <b>${esc(r.receiverName)}</b> · ${esc(reqTitle(r))}</div>
                    <span class="swap-status st-admin">${isSwapReq(r) ? 'Takas' : 'Devir'}</span></div>
                    ${v.errors.length ? `<div class="swap-check-line bad">⛔ ${esc(v.errors.join(' · '))}</div>` : `<div class="swap-check-line ok">✅ Kurallara uygun${v.warnings.length ? ' · ⚠️ ' + esc(v.warnings.join(' · ')) : ''}</div>`}
                    <div class="request-card-foot"><small>${new Date(r.peerApprovedAt || r.createdAt).toLocaleString('tr-TR')}</small>
                    <div class="market-actions"><button class="btn-primary" style="background:var(--accent-green)" ${v.errors.length ? 'disabled' : ''} onclick="SwapMarket.adminApprove('${rid}')">✓ Onayla ve Uygula</button><button class="btn-delete" onclick="SwapMarket.adminReject('${rid}')">Reddet</button></div></div>
                </div>`;
            }).join('') : '<p class="swap-empty">Yönetici onayı bekleyen görev değişikliği yok.</p>'}`;
    }

    function adminApprove(requestId) {
        if (!isAdmin()) return;
        const r = reqById(requestId);
        if (!r || r.status !== 'awaiting_admin') return;
        if (!confirm(`"${reqTitle(r)}" değişikliği uygulanacak. Onaylıyor musunuz?`)) return;
        const res = finalizeRequest(r, { byAdmin: true });
        if (!res.ok) return showResultError(res);
        refreshUI();
        toast('✅ Değişiklik uygulandı; puanlar güncellendi.', 'success');
    }

    function adminReject(requestId) {
        if (!isAdmin()) return;
        const r = reqById(requestId);
        if (!r || r.status !== 'awaiting_admin') return;
        const reason = prompt('Ret gerekçesi (isteğe bağlı):', '') ;
        if (reason === null) return;
        r.status = 'rejected'; r.rejectedAt = nowIso(); r.rejectedBy = 'admin'; r.cancelReason = reason ? 'Yönetici: ' + reason : 'Yönetici tarafından reddedildi';
        [r.initiatorId, r.receiverId].forEach(id => notify(id, `❌ "${reqTitle(r)}" talebi yönetici tarafından reddedildi.${reason ? ' Gerekçe: ' + reason : ''}`, 'swap_rejected', r.id));
        if (typeof logAction === 'function') logAction('admin', 'Takas/Devir Reddi', `${reqTitle(r)} — ${reason || '-'}`);
        persist();
        refreshUI();
    }

    function setSetting(key, val) {
        if (!isAdmin()) return;
        settings()[key] = !!val;
        if (typeof logAction === 'function') logAction('admin', 'Takas Ayarı', `${key} = ${!!val}`);
        persist();
        toast('Ayar kaydedildi.', 'success');
    }

    function closeModal(id) {
        const m = document.getElementById(id);
        if (m) m.classList.add('hidden');
    }

    // ------------------------------------------------------------------
    // 10) GLOBAL KAYITLAR (mevcut onclick'lerle uyumlu isimler)
    // ------------------------------------------------------------------
    window.SwapMarket = {
        settings, getTaskStatus, taskActionCell, validateTransfer, validateSwap, validateRequest,
        getMarketRecipients, finalizeRequest, renderMyRequests, openRequestsTab, resendMail,
        withdrawClaim, adminApprove, adminReject, setSetting, closeModal, renderAdminPanel,
        confirmDirectSwap, confirmMarketDrop, sendMarketMail, historyLabel, activeRequestsForExam,
        buildSwapMail, buildMarketMail, buildClaimMail,
        mail: { open: openMailDraft, openWith: openWithClient, copy: copyDraft, sendVia, registerProvider }
    };

    window.initiateDirectSwap = initiateDirectSwap;
    window.renderDirectSwapTargetExams = renderDirectSwapTargetExams;
    window.selectDirectSwapTargetExam = (examId, _n, _d, el) => selectDirectSwapTargetExam(examId, el);
    window.openOfferSwapModal = openOfferSwapModal;
    window.confirmOfferSwap = confirmOfferSwap;
    window.acceptDirectSwap = acceptSwap;
    window.rejectDirectSwap = rejectSwap;
    window.acceptSmartSwap = acceptSwap;
    window.rejectSmartSwap = rejectSwap;
    window.initiateOpenSwap = initiateOpenSwap;
    window.renderMarketplace = renderMarketplace;
    window.acceptOpenRequest = claimMarketTask;
    window.confirmOpenRequest = confirmClaim;
    window.rejectOpenRequest = id => rejectClaim(id, false);
    window.cancelSwapRequest = cancelRequest;
    window.renderMyRequests = renderMyRequests;

    // Eski tip yönlendirilmiş devir (showSwapModal ile oluşturulan) → aynı doğrulama/onay zinciri
    window.approveSwapPeer = async function (requestId) {
        const r = reqById(requestId);
        if (!r) return;
        if (isSwapReq(r)) return acceptSwap(requestId);
        if (r.status === 'claim_pending') return confirmClaim(requestId);
        if (!isAdmin() && S(r.receiverId) !== S(myId())) return alert('Bu talebi yalnızca devralacak hoca onaylayabilir.');
        const v = validateRequest(r);
        if (v.errors.length) return showResultError(v, '⛔ Devir şu an gerçekleştirilemiyor:');
        const warn = v.warnings.length ? `\n\n⚠️ Uyarılar:\n• ${v.warnings.join('\n• ')}` : '';
        const ok = await (typeof confirmWithPassword === 'function'
            ? confirmWithPassword(`"${reqTitle(r)}" görevini devralmayı onaylıyor musunuz?${warn}`, staffById(r.receiverId))
            : Promise.resolve(confirm(`Devri onaylıyor musunuz?${warn}`)));
        if (!ok) return;
        const res = finalizeRequest(r);
        if (!res.ok) return showResultError(res);
        refreshUI();
        alert(res.awaitingAdmin ? '✓ Onayınız alındı; devir yönetici onayından sonra uygulanacak.' : '✅ Görev devri tamamlandı.');
    };
    window.rejectSwapPeer = function (requestId) {
        const r = reqById(requestId);
        if (!r) return;
        if (r.status === 'claim_pending') return rejectClaim(requestId, false);
        return rejectSwap(requestId);
    };

    // ------------------------------------------------------------------
    // 11) MEVCUT RENDER FONKSİYONLARINA KANCALAR
    // ------------------------------------------------------------------
    function wrap(name, after) {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__swapWrapped) return;
        const w = function () {
            try { return orig.apply(this, arguments); }
            finally { try { after(); } catch (e) { console.warn('[SwapMarket] ' + name + ' kancası', e); } }
        };
        w.__swapWrapped = true;
        window[name] = w;
    }
    wrap('renderProfile', () => { renderProfileProposals(); renderMyRequests(); });
    wrap('renderDashboard', renderAdminPanel);

    function bindStatic() {
        const btn = document.getElementById('btn-confirm-direct-swap');
        if (btn) btn.onclick = confirmDirectSwap;
        const tab = document.querySelector('#section-profile .tab-btn[data-tab="requests"]');
        if (tab && !tab.__swapBound) { tab.__swapBound = true; tab.addEventListener('click', renderMyRequests); }
        settings();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindStatic);
    else bindStatic();
})();
