// ============================================================
//  Görev Takası & Pazar E-posta Sistemi | swap_email.js
//  Takas talebi ve görev devri için otomatik mailto: e-posta
//  taslağı oluşturur. Sistem onayından bağımsız çalışır.
// ============================================================

/* ─────────────────────────────────────────
   1. GÖREV DURUM SİSTEMİ
   DB.taskStatuses = { 'examId_staffId': 'durum' }
   ───────────────────────────────────────── */

/**
 * Görev durumu türetir. Önce DB.requests'e bakar, sonra DB.taskStatuses override'ına.
 * @param {string|number} examId
 * @param {string|number} staffId
 * @returns {string} durum kodu
 */
window.getTaskStatus = function(examId, staffId) {
    if (typeof DB === 'undefined') return 'normal';

    // 1. DB.requests'ten otomatik türet
    const requests = DB.requests || [];
    const sExamId = String(examId);
    const sStaffId = String(staffId);

    // Birebir takas (direct_swap) teklifi bekliyor mu?
    const directSwapPending = requests.find(r =>
        r.type === 'direct_swap' &&
        String(r.initiatorId) === sStaffId &&
        (String(r.initiatorExamId) === sExamId) &&
        r.status === 'pending_peer'
    );
    if (directSwapPending) return 'swap_pending';

    // Açık pazar talebi var mı?
    const openMarket = requests.find(r =>
        String(r.examId) === sExamId &&
        String(r.initiatorId) === sStaffId &&
        r.receiverId === null &&
        r.status === 'pending'
    );
    if (openMarket) return 'market_listed';

    // Takas teklifi yapıldı mı (pending_peer, receiver)?
    const swapRequested = requests.find(r =>
        r.type === 'direct_swap' &&
        String(r.initiatorId) === sStaffId &&
        (String(r.initiatorExamId) === sExamId || String(r.examId) === sExamId) &&
        ['pending_peer', 'pending'].includes(r.status)
    );
    if (swapRequested) return 'swap_requested';

    // 2. DB.taskStatuses override
    if (DB.taskStatuses) {
        const override = DB.taskStatuses[`${examId}_${staffId}`];
        if (override) return override;
    }

    return 'normal';
};

/**
 * Durum için renkli HTML badge döndürür.
 * @param {string|number} examId
 * @param {string|number} staffId
 * @returns {string} HTML string
 */
window.getTaskStatusBadge = function(examId, staffId) {
    const status = window.getTaskStatus(examId, staffId);
    const badges = {
        'normal': '',
        'swap_requested': '<span style="background:rgba(245,158,11,0.2);color:#fbbf24;border:1px solid rgba(245,158,11,0.4);padding:2px 7px;border-radius:12px;font-size:0.65rem;font-weight:600;white-space:nowrap;">🔄 Takas Talep Edildi</span>',
        'swap_pending': '<span style="background:rgba(99,102,241,0.2);color:#a78bfa;border:1px solid rgba(99,102,241,0.4);padding:2px 7px;border-radius:12px;font-size:0.65rem;font-weight:600;white-space:nowrap;">⏳ Takas Onay Bekliyor</span>',
        'market_listed': '<span style="background:rgba(14,165,233,0.2);color:#38bdf8;border:1px solid rgba(14,165,233,0.4);padding:2px 7px;border-radius:12px;font-size:0.65rem;font-weight:600;white-space:nowrap;">🛒 Pazara Çıkarıldı</span>',
        'transfer_requested': '<span style="background:rgba(239,68,68,0.2);color:#f87171;border:1px solid rgba(239,68,68,0.4);padding:2px 7px;border-radius:12px;font-size:0.65rem;font-weight:600;white-space:nowrap;">📤 Devir Talebi Var</span>',
        'swap_completed': '<span style="background:rgba(16,185,129,0.2);color:#34d399;border:1px solid rgba(16,185,129,0.4);padding:2px 7px;border-radius:12px;font-size:0.65rem;font-weight:600;white-space:nowrap;">✅ Takas Tamamlandı</span>',
        'transferred': '<span style="background:rgba(107,114,128,0.2);color:#9ca3af;border:1px solid rgba(107,114,128,0.4);padding:2px 7px;border-radius:12px;font-size:0.65rem;font-weight:600;white-space:nowrap;">📦 Devredildi</span>',
        'cancelled': '<span style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);padding:2px 7px;border-radius:12px;font-size:0.65rem;font-weight:600;white-space:nowrap;">❌ İptal Edildi</span>'
    };
    return badges[status] || '';
};

/* ─────────────────────────────────────────
   2. TARİH FORMATLAMA YARDIMCISI
   ───────────────────────────────────────── */

/**
 * '2026-10-15' → '15 Ekim 2026'
 */
window.formatDateTR = function(dateStr) {
    if (!dateStr) return '-';
    const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                    'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parseInt(parts[2]);
    const month = parseInt(parts[1]) - 1;
    const year = parts[0];
    return `${day} ${months[month]} ${year}`;
};

/* ─────────────────────────────────────────
   3. HOCANın E-POSTA ADRESİ TAHMINI
   ───────────────────────────────────────── */

window.guessStaffEmail = function(staff) {
    if (!staff) return '';
    if (staff.email && staff.email.includes('@')) return staff.email.trim();
    // 'Yasin TURAN' → 'yasin.turan@gtu.edu.tr'
    const nameParts = (staff.name || '')
        .toLowerCase()
        .replace(/ç/g,'c').replace(/ş/g,'s').replace(/ğ/g,'g')
        .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ı/g,'i').replace(/â/g,'a')
        .split(' ').filter(Boolean);
    if (nameParts.length >= 2) {
        return `${nameParts[0]}.${nameParts[nameParts.length - 1]}@gtu.edu.tr`;
    }
    return `${nameParts[0]}@gtu.edu.tr`;
};

function guessEmail(staff) {
    return window.guessStaffEmail(staff);
}

/* ─────────────────────────────────────────
   4. TAKAS MAİL MODALI
   ───────────────────────────────────────── */

/**
 * Takas maili oluşturma modalını açar.
 * @param {string|number} myExamId - Kullanıcının kendi sınavı
 */
window.openSwapEmailModal = function(myExamId) {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) {
        alert('Lütfen önce profilinizden kimliğinizi seçin.');
        return;
    }
    const myStaff = (DB.staff || []).find(s => String(s.id) === String(myStaffId));
    const myExam  = (DB.exams  || []).find(e => String(e.id) === String(myExamId));
    if (!myStaff || !myExam) {
        alert('Görev veya personel bilgisi bulunamadı.');
        return;
    }

    const modal = document.getElementById('modal-swap-email');
    const body  = document.getElementById('swap-email-body');
    if (!modal || !body) return;

    // Diğer hocaları doldur (kendisi hariç)
    const otherStaff = (DB.staff || [])
        .filter(s => String(s.id) !== String(myStaffId))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

    const staffOptions = otherStaff.map(s =>
        `<option value="${s.id}">${s.name}</option>`
    ).join('');

    body.innerHTML = `
        <!-- Kendi sınavım -->
        <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:1rem;margin-bottom:1.25rem;">
            <div style="font-size:0.72rem;color:#a78bfa;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;">📋 Benim Görevim</div>
            <div style="font-weight:700;font-size:1rem;margin-bottom:.25rem;">${myExam.name}</div>
            <div style="font-size:0.82rem;color:var(--text-muted);">
                📅 ${window.formatDateTR(myExam.date)} &nbsp;|&nbsp; 🕐 ${myExam.time || '-'} &nbsp;|&nbsp; 🏫 ${myExam.location || '-'} &nbsp;|&nbsp; ⏱️ ${myExam.duration || '-'} dk
            </div>
        </div>

        <!-- Karşı hoca seçimi -->
        <div style="margin-bottom:1rem;">
            <label style="display:block;font-size:0.8rem;color:var(--text-muted);margin-bottom:.4rem;font-weight:600;">👤 Takas Yapmak İstediğiniz Hoca</label>
            <select id="se-target-staff" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid var(--glass-border);padding:.7rem;border-radius:10px;color:white;font-family:inherit;font-size:.9rem;">
                <option value="">Hoca seçin...</option>
                ${staffOptions}
            </select>
        </div>

        <!-- Karşı sınav listesi -->
        <div id="se-target-exams-wrap" class="hidden" style="margin-bottom:1rem;">
            <label style="display:block;font-size:0.8rem;color:var(--text-muted);margin-bottom:.4rem;font-weight:600;">📝 Takas Edilecek Sınav (Karşı Tarafın Görevi)</label>
            <div id="se-target-exams-list" style="display:grid;gap:6px;"></div>
        </div>

        <!-- İsteğe bağlı not -->
        <div style="margin-bottom:1rem;">
            <label style="display:block;font-size:0.8rem;color:var(--text-muted);margin-bottom:.4rem;font-weight:600;">💬 İsteğe Bağlı Açıklama</label>
            <textarea id="se-note" placeholder="Örn: İzinli olduğum için bu değişimi talep ediyorum..." 
                style="width:100%;background:rgba(0,0,0,0.25);border:1px solid var(--glass-border);border-radius:10px;padding:.7rem;color:white;font-family:inherit;font-size:.85rem;min-height:80px;resize:vertical;box-sizing:border-box;"></textarea>
        </div>

        <!-- E-posta önizleme -->
        <div id="se-preview-wrap" class="hidden" style="margin-bottom:1.25rem;">
            <label style="display:block;font-size:0.8rem;color:var(--text-muted);margin-bottom:.4rem;font-weight:600;">📧 E-posta Önizlemesi</label>
            <div id="se-preview" style="background:rgba(0,0,0,0.3);border:1px solid var(--glass-border);border-radius:10px;padding:1rem;font-size:0.8rem;font-family:monospace;white-space:pre-wrap;line-height:1.6;color:#e2e8f0;max-height:260px;overflow-y:auto;"></div>
        </div>

        <!-- Butonlar -->
        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
            <button onclick="document.getElementById('modal-swap-email').classList.add('hidden')"
                style="padding:.65rem 1.25rem;border-radius:10px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.05);color:var(--text-muted);cursor:pointer;font-size:.85rem;">
                Vazgeç
            </button>
            <button id="se-open-btn" disabled onclick="seOpenMailto()"
                style="padding:.65rem 1.5rem;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);border:none;color:white;font-weight:700;cursor:pointer;font-size:.9rem;opacity:.5;">
                📧 E-Posta Uygulamasında Aç
            </button>
        </div>
    `;

    modal.classList.remove('hidden');

    // Karşı hoca değişince sınavlarını listele
    document.getElementById('se-target-staff').addEventListener('change', function() {
        const targetId = this.value;
        if (!targetId) {
            document.getElementById('se-target-exams-wrap').classList.add('hidden');
            document.getElementById('se-preview-wrap').classList.add('hidden');
            document.getElementById('se-open-btn').disabled = true;
            document.getElementById('se-open-btn').style.opacity = '.5';
            window._seSelectedTargetExamId = null;
            return;
        }
        seRenderTargetExams(targetId, myExam, myStaff);
    });
};

function seRenderTargetExams(targetStaffId, myExam, myStaff) {
    const wrap = document.getElementById('se-target-exams-wrap');
    const list = document.getElementById('se-target-exams-list');
    if (!wrap || !list) return;

    const now = new Date();
    const targetExams = (DB.exams || []).filter(e => {
        const pIds = e.proctorIds || (e.proctorId ? [e.proctorId] : []);
        if (!pIds.map(String).includes(String(targetStaffId))) return false;
        const examDate = getSafeDate(e.date, e.time);
        const examEnd  = new Date(examDate.getTime() + (e.duration || 60) * 60000);
        return examEnd >= now;
    });

    if (targetExams.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:.82rem;padding:.5rem;">Bu hocanın aktif görevi bulunmuyor.</p>';
    } else {
        list.innerHTML = targetExams.map(ex => `
            <div onclick="seSelectTargetExam('${ex.id}', this)"
                style="cursor:pointer;padding:.7rem 1rem;border-radius:10px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.03);transition:all .15s;"
                onmouseenter="this.style.borderColor='rgba(99,102,241,.5)'"
                onmouseleave="this.style.borderColor='var(--glass-border)'">
                <div style="font-weight:600;font-size:.88rem;">${ex.name}</div>
                <div style="font-size:.76rem;color:var(--text-muted);margin-top:2px;">
                    📅 ${window.formatDateTR(ex.date)} &nbsp;|&nbsp; 🕐 ${ex.time || '-'} &nbsp;|&nbsp; 🏫 ${ex.location || '-'} &nbsp;|&nbsp; ⏱️ ${ex.duration || '-'} dk
                </div>
            </div>
        `).join('');
    }

    wrap.classList.remove('hidden');
    window._seMyExam = myExam;
    window._seMyStaff = myStaff;
    window._seTargetStaffId = targetStaffId;
    window._seSelectedTargetExamId = null;
}

window.seSelectTargetExam = function(examId, el) {
    window._seSelectedTargetExamId = examId;

    // Highlight seçimi
    document.querySelectorAll('#se-target-exams-list > div').forEach(d => {
        d.style.borderColor = 'var(--glass-border)';
        d.style.background  = 'rgba(255,255,255,0.03)';
    });
    if (el) {
        el.style.borderColor = 'rgba(99,102,241,.6)';
        el.style.background  = 'rgba(99,102,241,.1)';
    }

    // Önizlemeyi güncelle
    seUpdatePreview();
};

function seUpdatePreview() {
    const myExam    = window._seMyExam;
    const myStaff   = window._seMyStaff;
    const targetId  = window._seTargetStaffId;
    const targetExamId = window._seSelectedTargetExamId;
    if (!myExam || !myStaff || !targetId || !targetExamId) return;

    const targetStaff = (DB.staff || []).find(s => String(s.id) === String(targetId));
    const targetExam  = (DB.exams  || []).find(e => String(e.id) === String(targetExamId));
    if (!targetStaff || !targetExam) return;

    const note = (document.getElementById('se-note') || {}).value || '';

    const preview = seBuildEmailText(myExam, myStaff, targetExam, targetStaff, note);

    const previewDiv = document.getElementById('se-preview');
    const previewWrap = document.getElementById('se-preview-wrap');
    const btn = document.getElementById('se-open-btn');

    if (previewDiv) previewDiv.textContent = preview;
    if (previewWrap) previewWrap.classList.remove('hidden');
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
}

// Textarea değişince önizlemeyi güncelle
document.addEventListener('input', function(e) {
    if (e.target && e.target.id === 'se-note') {
        seUpdatePreview();
    }
});

function seBuildEmailText(myExam, myStaff, targetExam, targetStaff, note) {
    // Önce özel şablon var mı kontrol et
    if (DB.swapTemplates && DB.swapTemplates.swap_request) {
        const fromTemplate = window.applySwapTemplate(myExam, myStaff, targetExam, targetStaff, note);
        if (fromTemplate) return fromTemplate;
    }

    // Varsayılan metin
    const myDate  = window.formatDateTR ? window.formatDateTR(myExam.date) : myExam.date;
    const tgtDate = window.formatDateTR ? window.formatDateTR(targetExam.date) : targetExam.date;

    let text = `Merhaba ${targetStaff.name} Hocam,\n\n`;
    text += `Bende bulunan ${myExam.name} (${myDate} ${myExam.time || ''} - ${myExam.location || '-'}) sinav gozetmenlik gorevini, `;
    text += `sizde bulunan ${targetExam.name} (${tgtDate} ${targetExam.time || ''} - ${targetExam.location || '-'}) sinav gozetmenlik goreviyle takas etmek istiyorum.\n\n`;
    text += `Uygun olmaniz halinde sistem uzerinden onay verebilirsiniz.\n\n`;
    text += `---\nGorev Karsilastirmasi:\n\n`;
    text += `Benim Gorevim:\n`;
    text += `  Ders/Sinav : ${myExam.name}\n`;
    text += `  Tarih      : ${myDate}\n`;
    text += `  Saat       : ${myExam.time || '-'}\n`;
    text += `  Salon      : ${myExam.location || '-'}\n`;
    text += `  Sure       : ${myExam.duration || '-'} dakika\n\n`;
    text += `Sizin Goreviniiz:\n`;
    text += `  Ders/Sinav : ${targetExam.name}\n`;
    text += `  Tarih      : ${tgtDate}\n`;
    text += `  Saat       : ${targetExam.time || '-'}\n`;
    text += `  Salon      : ${targetExam.location || '-'}\n`;
    text += `  Sure       : ${targetExam.duration || '-'} dakika\n`;
    text += `---\n\n`;
    if (note && note.trim()) text += `Not: ${note.trim()}\n\n`;
    text += `Bu e-posta yalnizca talep amaclidir. Gercek gorev degisimi sistem onayi gerektirir.\n\n`;
    text += `Iyi calismalar,\n${myStaff.name}`;
    return text;
}

window.seOpenMailto = function() {
    const myExam      = window._seMyExam;
    const myStaff     = window._seMyStaff;
    const targetId    = window._seTargetStaffId;
    const targetExamId = window._seSelectedTargetExamId;
    if (!myExam || !myStaff || !targetId || !targetExamId) {
        alert('Lütfen karşı tarafın sınavını seçiniz.');
        return;
    }

    const targetStaff = (DB.staff || []).find(s => String(s.id) === String(targetId));
    const targetExam  = (DB.exams  || []).find(e => String(e.id) === String(targetExamId));
    if (!targetStaff || !targetExam) return;

    const note = (document.getElementById('se-note') || {}).value || '';
    const emailBody = seBuildEmailText(myExam, myStaff, targetExam, targetStaff, note);
    const subject   = `Sinav Gorev Takasi Talebi - ${myExam.name}`;
    const toEmail   = guessEmail(targetStaff);

    const mailto = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailto;

    // Görev durumunu güncelle
    if (typeof DB !== 'undefined' && DB.taskStatuses) {
        const myStaffId = localStorage.getItem('myStaffId');
        if (myStaffId) {
            DB.taskStatuses[`${myExam.id}_${myStaffId}`] = 'swap_requested';
            if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
        }
    }
};

/* ─────────────────────────────────────────
   5. PAZAR / BİLDİRİM MAİL MODALI
   ───────────────────────────────────────── */

/**
 * Hocalara e-posta bildirim modalını açar.
 * @param {string|number} examId
 */
window.openMarketEmailModal = function(examId) {
    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) {
        alert('Lütfen önce profilinizden kimliğinizi seçin.');
        return;
    }
    const myStaff = (DB.staff || []).find(s => String(s.id) === String(myStaffId));
    const exam    = (DB.exams  || []).find(e => String(e.id) === String(examId));
    if (!myStaff || !exam) {
        alert('Görev veya personel bilgisi bulunamadı.');
        return;
    }

    const modal = document.getElementById('modal-market-email');
    const body  = document.getElementById('market-email-body');
    if (!modal || !body) return;

    // Uygun / uygun olmayan hocaları ayır
    const allOtherStaff = (DB.staff || []).filter(s => String(s.id) !== String(myStaffId));
    const eligible = [], ineligible = [];

    allOtherStaff.forEach(s => {
        let reason = null;
        // Çakışan sınav kontrolü
        const hasConflict = (DB.exams || []).some(e => {
            if (e.date !== exam.date) return false;
            const pIds = e.proctorIds || (e.proctorId ? [e.proctorId] : []);
            if (!pIds.map(String).includes(String(s.id))) return false;
            // Saat çakışması
            const [hA, mA] = (exam.time || '00:00').split(':').map(Number);
            const [hB, mB] = (e.time || '00:00').split(':').map(Number);
            const startA = hA * 60 + mA, endA = startA + (exam.duration || 60);
            const startB = hB * 60 + mB, endB = startB + (e.duration || 60);
            return startA < endB && startB < endA;
        });
        if (hasConflict) { reason = 'Sınavı çakışıyor'; }
        // Kısıt kontrolü
        else if (typeof isAvailable === 'function' && !isAvailable(s.name, exam.date, exam.time, exam.duration)) {
            reason = 'Müsait değil / kısıtlı';
        }

        if (reason) {
            ineligible.push({ staff: s, reason });
        } else {
            eligible.push(s);
        }
    });

    // Önizleme metni
    const previewText = meBuildEmailText(exam, myStaff);

    body.innerHTML = `
        <!-- Görev Özet Kartı -->
        <div style="background:rgba(14,165,233,0.1);border:1px solid rgba(14,165,233,0.3);border-radius:12px;padding:1rem;margin-bottom:1.25rem;">
            <div style="font-size:0.72rem;color:#38bdf8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;">📤 Devredilecek Görev</div>
            <div style="font-weight:700;font-size:1rem;margin-bottom:.25rem;">${exam.name}</div>
            <div style="font-size:0.82rem;color:var(--text-muted);">
                📅 ${window.formatDateTR(exam.date)} &nbsp;|&nbsp; 🕐 ${exam.time || '-'} &nbsp;|&nbsp; 🏫 ${exam.location || '-'} &nbsp;|&nbsp; ⏱️ ${exam.duration || '-'} dk &nbsp;|&nbsp; ⭐ ${exam.score || 0} puan
            </div>
        </div>

        <!-- Hoca listesi -->
        <div style="margin-bottom:1.25rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;">
                <label style="font-size:.8rem;color:var(--text-muted);font-weight:600;">👥 Bildirim Gönderilecek Hocalar</label>
                <div style="display:flex;gap:8px;">
                    <button onclick="meSelectAll(true)" style="font-size:.7rem;padding:3px 10px;border-radius:8px;border:1px solid rgba(16,185,129,.4);background:rgba(16,185,129,.1);color:#34d399;cursor:pointer;">Tümünü Seç</button>
                    <button onclick="meSelectAll(false)" style="font-size:.7rem;padding:3px 10px;border-radius:8px;border:1px solid var(--glass-border);background:transparent;color:var(--text-muted);cursor:pointer;">Temizle</button>
                </div>
            </div>

            <!-- Uygun hocalar -->
            ${eligible.length > 0 ? `
            <div style="margin-bottom:.75rem;">
                <div style="font-size:.72rem;color:#34d399;font-weight:700;margin-bottom:.4rem;">✅ Uygun Hocalar (${eligible.length})</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;">
                    ${eligible.map(s => `
                        <label style="display:flex;align-items:center;gap:8px;padding:.55rem .8rem;border-radius:8px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.03);cursor:pointer;font-size:.82rem;">
                            <input type="checkbox" class="me-staff-cb" data-staff-id="${s.id}" data-email="${guessEmail(s)}" checked
                                style="accent-color:#6366f1;width:14px;height:14px;">
                            <span style="flex:1;">${s.name}</span>
                            <span style="font-size:.68rem;color:var(--text-muted);">${s.totalScore ? s.totalScore.toFixed(1)+'p' : ''}</span>
                        </label>
                    `).join('')}
                </div>
            </div>` : '<p style="color:var(--text-muted);font-size:.82rem;margin-bottom:.75rem;">Bu zaman diliminde uygun hoca bulunamadı.</p>'}

            <!-- Uygun olmayan hocalar -->
            ${ineligible.length > 0 ? `
            <details style="margin-top:.25rem;">
                <summary style="font-size:.72rem;color:var(--text-muted);cursor:pointer;user-select:none;">⚠️ Uygun Olmayan Hocalar (${ineligible.length}) — tıklayarak göster</summary>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;margin-top:.5rem;">
                    ${ineligible.map(({ staff: s, reason }) => `
                        <label style="display:flex;align-items:center;gap:8px;padding:.55rem .8rem;border-radius:8px;border:1px solid rgba(239,68,68,.2);background:rgba(239,68,68,.05);cursor:not-allowed;font-size:.82rem;opacity:.6;">
                            <input type="checkbox" disabled style="width:14px;height:14px;">
                            <span style="flex:1;">${s.name}</span>
                            <span style="font-size:.65rem;color:#f87171;">${reason}</span>
                        </label>
                    `).join('')}
                </div>
            </details>` : ''}
        </div>

        <!-- E-posta önizleme -->
        <div style="margin-bottom:1.25rem;">
            <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:.4rem;font-weight:600;">📧 E-posta Önizlemesi</label>
            <div style="background:rgba(0,0,0,0.3);border:1px solid var(--glass-border);border-radius:10px;padding:1rem;font-size:0.78rem;font-family:monospace;white-space:pre-wrap;line-height:1.6;color:#e2e8f0;max-height:220px;overflow-y:auto;">${escapeHtml(previewText)}</div>
        </div>

        <!-- Bilgi notu -->
        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,.3);border-radius:10px;padding:.75rem 1rem;font-size:.78rem;color:#fbbf24;margin-bottom:1.25rem;">
            ⚠️ Bu e-posta yalnızca bilgilendirme amaçlıdır. Görevi alan kişi sistem üzerinden "Görevi Al" seçeneğini kullanmak zorundadır.
        </div>

        <!-- Butonlar -->
        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
            <button onclick="document.getElementById('modal-market-email').classList.add('hidden')"
                style="padding:.65rem 1.25rem;border-radius:10px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.05);color:var(--text-muted);cursor:pointer;font-size:.85rem;">
                Vazgeç
            </button>
            <button onclick="meOpenMailto('${exam.id}')"
                style="padding:.65rem 1.5rem;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#0284c7);border:none;color:white;font-weight:700;cursor:pointer;font-size:.9rem;">
                📤 Seçili Hocalara E-posta Hazırla
            </button>
        </div>
    `;

    modal.classList.remove('hidden');
    window._meExam = exam;
    window._meMyStaff = myStaff;
};

function meBuildEmailText(exam, myStaff) {
    // Önce özel şablon kontrol et
    if (DB.swapTemplates && DB.swapTemplates.market_notify) {
        const fromTemplate = window.applyMarketTemplate(exam, myStaff);
        if (fromTemplate) return fromTemplate;
    }

    // Varsayılan metin
    const dateStr = window.formatDateTR ? window.formatDateTR(exam.date) : exam.date;
    let text = `Merhaba,\n\n`;
    text += `${dateStr} tarihinde saat ${exam.time || '-'}'de ${exam.name} sinavi icin gozetmenlik gorevimi devretmek istiyorum.\n\n`;
    text += `Gorevi almak isteyen bir hocanin sistem uzerinden ilgili sinavi profil sayfasindaki 'Pazar Yeri' sekmesinden incelemesi ve 'Gorevi Al' secenegini kullanmasi yeterlidir.\n\n`;
    text += `Gorev Bilgileri:\n`;
    text += `  Ders/Sinav   : ${exam.name}\n`;
    text += `  Sinav Turu   : ${exam.type || '-'}\n`;
    text += `  Tarih        : ${dateStr}\n`;
    text += `  Saat         : ${exam.time || '-'}\n`;
    text += `  Salon        : ${exam.location || '-'}\n`;
    text += `  Gorev Suresi : ${exam.duration || '-'} dakika\n`;
    text += `  Puan Degeri  : ${exam.score || 0}\n`;
    text += `  Mevcut Gorevli: ${myStaff.name}\n\n`;
    text += `Not: Bu e-posta yalnizca bilgilendirme amaclidir. Gorevi alan kisi sistem uzerinden onay vermek zorundadir.\n\n`;
    text += `Iyi calismalar,\n${myStaff.name}`;
    return text;
}

window.meSelectAll = function(val) {
    document.querySelectorAll('.me-staff-cb').forEach(cb => { cb.checked = val; });
};

window.meOpenMailto = function(examId) {
    const exam    = window._meExam;
    const myStaff = window._meMyStaff;
    if (!exam || !myStaff) return;

    const selected = Array.from(document.querySelectorAll('.me-staff-cb:checked'));
    if (selected.length === 0) {
        alert('Lütfen en az bir hoca seçiniz.');
        return;
    }

    const emails = selected.map(cb => cb.dataset.email).filter(Boolean).join(',');
    const subject = `Gorev Devri - ${exam.name} Sinav Gozetmenligi`;
    const emailBody = meBuildEmailText(exam, myStaff);

    if (selected.length > 10) {
        const cont = confirm(`${selected.length} hocaya e-posta gönderilecek.\nBazı e-posta istemcileri çok sayıda alıcıyı desteklemeyebilir.\n\nDevam etmek istiyor musunuz?`);
        if (!cont) return;
    }

    const mailto = `mailto:${encodeURIComponent(emails)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailto;

    document.getElementById('modal-market-email').classList.add('hidden');
    if (typeof showToast === 'function') showToast('✅ E-posta uygulaması açılıyor...', 'success');
};

/* ─────────────────────────────────────────
   6. YARDIMCI: HTML ESCAPE
   ───────────────────────────────────────── */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

/* ─────────────────────────────────────────
   7. MODAL HTML'LERİNİ DOM'A EKLE
   ───────────────────────────────────────── */
function injectSwapEmailModals() {
    // Daha önce eklendiyse tekrar ekleme
    if (document.getElementById('modal-swap-email')) return;

    const tpl = document.createElement('div');
    tpl.innerHTML = `
        <!-- Modal 1: Takas Mail -->
        <div id="modal-swap-email" class="modal hidden" style="z-index:10100;">
            <div class="modal-content" style="max-width:700px;max-height:90vh;overflow-y:auto;padding:0;border-radius:18px;">
                <div class="modal-header" style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--glass-border);display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:1.1rem;display:flex;align-items:center;gap:8px;">
                        🔄 <span>Takas Maili Oluştur</span>
                    </h3>
                    <button onclick="document.getElementById('modal-swap-email').classList.add('hidden')"
                        style="background:none;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer;line-height:1;padding:0 4px;">✕</button>
                </div>
                <div id="swap-email-body" style="padding:1.5rem;"></div>
            </div>
        </div>

        <!-- Modal 2: Pazar/Bildirim Mail -->
        <div id="modal-market-email" class="modal hidden" style="z-index:10100;">
            <div class="modal-content" style="max-width:700px;max-height:90vh;overflow-y:auto;padding:0;border-radius:18px;">
                <div class="modal-header" style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--glass-border);display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:1.1rem;display:flex;align-items:center;gap:8px;">
                        📤 <span>Hocalara E-posta Bildir</span>
                    </h3>
                    <button onclick="document.getElementById('modal-market-email').classList.add('hidden')"
                        style="background:none;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer;line-height:1;padding:0 4px;">✕</button>
                </div>
                <div id="market-email-body" style="padding:1.5rem;"></div>
            </div>
        </div>
    `;

    while (tpl.firstChild) {
        document.body.appendChild(tpl.firstChild);
    }
}

// DOM hazır olduğunda modal'ları ekle
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSwapEmailModals);
} else {
    injectSwapEmailModals();
}

/* ─────────────────────────────────────────
   8. GÖREV PAZARI RENDER (opsiyonel sayfa)
   ───────────────────────────────────────── */

/**
 * Pazardaki tüm açık görevleri listeler.
 * Mevcut profil pazar sekmesi zaten app.js'deki renderMarketplace ile çalışıyor.
 * Bu fonksiyon ek/bağımsız kullanım için oluşturulmuştur.
 */
window.renderTaskMarket = function(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const now = new Date();
    const openRequests = (DB.requests || []).filter(r => {
        if (r.status !== 'pending' || r.receiverId !== null) return false;
        const exam = (DB.exams || []).find(e => String(e.id) === String(r.examId));
        if (!exam) return false;
        const examDate = typeof getSafeDate === 'function' ? getSafeDate(exam.date, exam.time) : new Date(exam.date + 'T' + (exam.time || '00:00'));
        const examEnd  = new Date(examDate.getTime() + (exam.duration || 60) * 60000);
        return examEnd >= now;
    });

    if (openRequests.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">Şu an için açık görev bulunmuyor.</p>';
        return;
    }

    container.innerHTML = openRequests.map(req => {
        const exam = (DB.exams || []).find(e => String(e.id) === String(req.examId));
        if (!exam) return '';
        return `
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:14px;padding:1rem 1.25rem;margin-bottom:.75rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;">
                <div>
                    <div style="font-weight:700;font-size:.95rem;margin-bottom:.25rem;">${exam.name}</div>
                    <div style="font-size:.78rem;color:var(--text-muted);">
                        📅 ${window.formatDateTR(exam.date)} &nbsp;|&nbsp; 🕐 ${exam.time || '-'} &nbsp;|&nbsp; 🏫 ${exam.location || '-'} &nbsp;|&nbsp; ⏱️ ${exam.duration || '-'} dk &nbsp;|&nbsp; ⭐ ${exam.score || 0}p
                    </div>
                    <div style="font-size:.74rem;color:var(--text-muted);margin-top:.25rem;">👤 Devreden: ${req.initiatorName}</div>
                </div>
                <div style="display:flex;gap:8px;flex-shrink:0;">
                    <button onclick="typeof acceptOpenRequest==='function'&&acceptOpenRequest(${req.id})"
                        style="padding:.5rem 1rem;border-radius:8px;background:rgba(16,185,129,.2);border:1px solid rgba(16,185,129,.4);color:#34d399;cursor:pointer;font-size:.8rem;font-weight:600;">
                        ✅ Görevi Al
                    </button>
                    <button onclick="typeof openOfferSwapModal==='function'&&openOfferSwapModal(${req.id})"
                        style="padding:.5rem 1rem;border-radius:8px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.35);color:#fbbf24;cursor:pointer;font-size:.8rem;font-weight:600;">
                        🔄 Takas Teklif Et
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

console.log('✅ swap_email.js yüklendi — Görev Takası & Pazar E-posta Sistemi hazır.');

/* ─────────────────────────────────────────
   9. TAKAS GEÇMİŞİM SEKMESİ
   ───────────────────────────────────────── */

window.renderSwapHistory = function() {
    const list  = document.getElementById('swap-history-list');
    const empty = document.getElementById('swap-history-empty');
    const stats = document.getElementById('swap-history-stats');
    if (!list) return;

    const myStaffId = localStorage.getItem('myStaffId');
    if (!myStaffId) {
        list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Geçmişi görmek için profilinizi kurun.</p>';
        return;
    }

    const filterVal = (document.getElementById('swap-history-filter') || {}).value || 'all';

    let myRequests = (DB.requests || []).filter(r => {
        const isMine = String(r.initiatorId) === String(myStaffId) ||
                       String(r.receiverId)  === String(myStaffId);
        if (!isMine) return false;
        if (filterVal === 'direct_swap' && r.type !== 'direct_swap') return false;
        if (filterVal === 'marketplace' && r.type === 'direct_swap') return false;
        return true;
    }).sort((a, b) => {
        const da = a.createdAt || a.updatedAt || '';
        const db_ = b.createdAt || b.updatedAt || '';
        return db_.localeCompare(da);
    });

    if (myRequests.length === 0) {
        list.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        if (stats) stats.innerHTML = '';
        return;
    }
    if (empty) empty.classList.add('hidden');

    const statusConfig = {
        'pending':                   { label: '🟡 Açık Talep',      color: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
        'pending_peer':              { label: '⏳ Onay Bekliyor',    color: '#a78bfa', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)'  },
        'accepted_waiting_approval': { label: '📋 Onay Sürecinde',   color: '#38bdf8', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.3)'  },
        'approved':                  { label: '✅ Tamamlandı',       color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)'  },
        'rejected':                  { label: '❌ Reddedildi',       color: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'   },
        'cancelled':                 { label: '🚫 İptal Edildi',     color: '#9ca3af', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
        'expired':                   { label: '⌛ Süresi Doldu',     color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)' }
    };

    list.innerHTML = myRequests.map(r => {
        const cfg = statusConfig[r.status] || { label: r.status, color: '#94a3b8', bg: 'rgba(255,255,255,0.04)', border: 'var(--glass-border)' };
        const isInitiator = String(r.initiatorId) === String(myStaffId);
        const role      = isInitiator ? '📤 Talep Eden' : '📥 Talep Alınan';
        const roleColor = isInitiator ? '#38bdf8' : '#a78bfa';
        const typeLabel = r.type === 'direct_swap' ? '🔄 Birebir Takas' : r.receiverId === null ? '🛒 Açık Pazar' : '📤 Devir';
        const counterpartName = isInitiator ? (r.receiverName || 'Açık Talep') : r.initiatorName;

        let examInfo = '';
        if (r.type === 'direct_swap') {
            const myE  = (DB.exams || []).find(e => String(e.id) === String(isInitiator ? r.initiatorExamId : r.receiverExamId));
            const hisE = (DB.exams || []).find(e => String(e.id) === String(isInitiator ? r.receiverExamId  : r.initiatorExamId));
            examInfo = `
                <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:.5rem;align-items:center;margin-top:.6rem;font-size:.78rem;">
                    <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:8px;padding:.5rem .75rem;">
                        <div style="color:#a78bfa;font-size:.65rem;font-weight:700;margin-bottom:2px;">BENİM GÖREVİM</div>
                        <div style="font-weight:600;">${myE ? myE.name : '(Silinmiş)'}</div>
                        ${myE ? `<div style="color:var(--text-muted);font-size:.7rem;">${window.formatDateTR ? window.formatDateTR(myE.date) : myE.date} ${myE.time||''}</div>` : ''}
                    </div>
                    <div style="color:var(--text-muted);font-size:1.1rem;text-align:center;">⇄</div>
                    <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:.5rem .75rem;">
                        <div style="color:#34d399;font-size:.65rem;font-weight:700;margin-bottom:2px;">${counterpartName.toUpperCase()} HOCANIN GÖREVİ</div>
                        <div style="font-weight:600;">${hisE ? hisE.name : '(Silinmiş)'}</div>
                        ${hisE ? `<div style="color:var(--text-muted);font-size:.7rem;">${window.formatDateTR ? window.formatDateTR(hisE.date) : hisE.date} ${hisE.time||''}</div>` : ''}
                    </div>
                </div>`;
        } else {
            const exam = (DB.exams || []).find(e => String(e.id) === String(r.examId));
            examInfo = `
                <div style="margin-top:.5rem;font-size:.82rem;">
                    <strong>${exam ? exam.name : (r.examName || '(Silinmiş)')}</strong>
                    ${exam ? `<span style="color:var(--text-muted);"> — ${window.formatDateTR ? window.formatDateTR(exam.date) : exam.date} ${exam.time||''}</span>` : ''}
                </div>`;
        }

        const dateStr = r.createdAt
            ? new Date(r.createdAt).toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
            : '-';

        return `
            <div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:14px;padding:1rem 1.25rem;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;margin-bottom:.35rem;">
                    <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
                        <span style="font-size:.7rem;background:rgba(255,255,255,0.07);border:1px solid var(--glass-border);padding:2px 8px;border-radius:20px;color:var(--text-muted);">${typeLabel}</span>
                        <span style="font-size:.7rem;color:${roleColor};font-weight:700;">${role}</span>
                        ${counterpartName && counterpartName !== 'Açık Talep'
                            ? `<span style="font-size:.75rem;color:var(--text-muted);">↔ <strong style="color:#e2e8f0;">${counterpartName}</strong></span>`
                            : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:.6rem;">
                        <span style="font-size:.65rem;color:var(--text-muted);">${dateStr}</span>
                        <span style="font-size:.7rem;background:${cfg.bg};border:1px solid ${cfg.border};color:${cfg.color};padding:2px 10px;border-radius:20px;font-weight:700;">${cfg.label}</span>
                    </div>
                </div>
                ${examInfo}
            </div>`;
    }).join('');

    // İstatistikler
    if (stats) {
        const approved  = myRequests.filter(r => r.status === 'approved').length;
        const pending   = myRequests.filter(r => ['pending','pending_peer'].includes(r.status)).length;
        const rejected  = myRequests.filter(r => ['rejected','cancelled'].includes(r.status)).length;
        const initiated = myRequests.filter(r => String(r.initiatorId) === String(myStaffId)).length;

        stats.innerHTML = [
            { icon: '✅', label: 'Tamamlanan',    val: approved,  color: '#34d399' },
            { icon: '⏳', label: 'Bekleyen',       val: pending,   color: '#fbbf24' },
            { icon: '❌', label: 'Red / İptal',    val: rejected,  color: '#f87171' },
            { icon: '📤', label: 'Benim Taleplerim', val: initiated, color: '#38bdf8' },
        ].map(s => `
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:12px;padding:.75rem;text-align:center;">
                <div style="font-size:1.2rem;">${s.icon}</div>
                <div style="font-size:1.5rem;font-weight:800;color:${s.color};">${s.val}</div>
                <div style="font-size:.7rem;color:var(--text-muted);">${s.label}</div>
            </div>`).join('');
    }
};

/* ─────────────────────────────────────────
   10. PERSONEL E-POSTA ADRESİ YÖNETİMİ
   ───────────────────────────────────────── */

window.showStaffEmailManagerModal = function() {
    let modal = document.getElementById('modal-staff-email-mgr');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-staff-email-mgr';
        modal.className = 'modal hidden';
        modal.style.zIndex = '10200';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:750px;max-height:90vh;overflow-y:auto;padding:0;border-radius:18px;">
                <div class="modal-header" style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--glass-border);display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:1.1rem;">📧 Personel E-posta Adresleri</h3>
                    <button onclick="document.getElementById('modal-staff-email-mgr').classList.add('hidden')"
                        style="background:none;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer;">✕</button>
                </div>
                <div id="staff-email-mgr-body" style="padding:1.5rem;"></div>
            </div>`;
        document.body.appendChild(modal);
    }
    semRender();
    modal.classList.remove('hidden');
};

function semRender() {
    const body = document.getElementById('staff-email-mgr-body');
    if (!body) return;

    const staffList = (DB.staff || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'tr'));

    body.innerHTML = `
        <div style="margin-bottom:1rem;">
            <p style="color:var(--text-muted);font-size:.82rem;margin:0 0 .75rem 0;">
                Hocaların e-posta adresleri burada yönetilir. Boş bırakılan alanlar için sistem
                <code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;">ad.soyad@gtu.edu.tr</code> formatını kullanır.
                Değişkenlere tıklayarak kopyalayabilirsiniz.
            </p>
            <div style="display:flex;gap:8px;margin-bottom:.75rem;">
                <input id="sem-search" type="text" placeholder="🔍 Hoca ara..." oninput="semFilterList()"
                    style="flex:1;background:rgba(0,0,0,0.3);border:1px solid var(--glass-border);padding:.6rem .9rem;border-radius:10px;color:white;font-size:.85rem;">
                <button onclick="semSaveAll()"
                    style="padding:.6rem 1.25rem;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);border:none;color:white;font-weight:700;cursor:pointer;font-size:.85rem;white-space:nowrap;">
                    💾 Tümünü Kaydet
                </button>
            </div>
        </div>
        <div id="sem-list" style="display:flex;flex-direction:column;gap:.5rem;">
            ${staffList.map(s => {
                const guessed = window.guessStaffEmail ? window.guessStaffEmail(s) : '';
                const current = s.email || '';
                const initials = s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
                return `
                    <div class="sem-row" data-name="${s.name.toLowerCase()}"
                        style="display:flex;align-items:center;gap:.75rem;padding:.6rem .9rem;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:10px;">
                        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;flex-shrink:0;">
                            ${initials}
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
                            <div style="font-size:.7rem;color:var(--text-muted);">Tahmin: ${guessed}</div>
                        </div>
                        <input type="email" data-staff-id="${s.id}" value="${current}" placeholder="${guessed}"
                            style="width:215px;background:rgba(0,0,0,0.25);border:1px solid ${current ? 'rgba(16,185,129,.4)' : 'var(--glass-border)'};padding:.45rem .75rem;border-radius:8px;color:white;font-size:.82rem;font-family:monospace;"
                            oninput="this.style.borderColor=this.value?'rgba(16,185,129,.5)':'var(--glass-border)'">
                    </div>`;
            }).join('')}
        </div>
        <div id="sem-save-msg" class="hidden"
            style="margin-top:.75rem;padding:.6rem 1rem;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.35);border-radius:10px;color:#34d399;font-size:.82rem;text-align:center;">
        </div>`;
}

window.semFilterList = function() {
    const q = ((document.getElementById('sem-search') || {}).value || '').toLowerCase();
    document.querySelectorAll('#sem-list .sem-row').forEach(row => {
        row.style.display = (!q || row.dataset.name.includes(q)) ? '' : 'none';
    });
};

window.semSaveAll = function() {
    const inputs = document.querySelectorAll('#sem-list input[data-staff-id]');
    let changed = 0;
    inputs.forEach(inp => {
        const staff = (DB.staff || []).find(s => String(s.id) === String(inp.dataset.staffId));
        if (!staff) return;
        const newEmail = inp.value.trim();
        if (newEmail !== (staff.email || '')) {
            staff.email = newEmail || undefined;
            changed++;
        }
    });
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    if (typeof saveToBackend    === 'function') saveToBackend();
    const msg = document.getElementById('sem-save-msg');
    if (msg) {
        msg.textContent = `✅ ${changed} adres güncellendi ve kaydedildi.`;
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 3000);
    }
};

/* ─────────────────────────────────────────
   11. E-POSTA ŞABLON EDİTÖRÜ
   ───────────────────────────────────────── */

window.showSwapTemplateEditorModal = function() {
    let modal = document.getElementById('modal-swap-template-editor');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-swap-template-editor';
        modal.className = 'modal hidden';
        modal.style.zIndex = '10200';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:780px;max-height:90vh;overflow-y:auto;padding:0;border-radius:18px;">
                <div class="modal-header" style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--glass-border);display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:1.1rem;">✏️ Takas & Devir E-posta Şablonları</h3>
                    <button onclick="document.getElementById('modal-swap-template-editor').classList.add('hidden')"
                        style="background:none;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer;">✕</button>
                </div>
                <div id="swap-template-body" style="padding:1.5rem;"></div>
            </div>`;
        document.body.appendChild(modal);
    }
    steRender();
    modal.classList.remove('hidden');
};

// Varsayılan şablon metinleri
const _STE_DEFAULT_SWAP = `Merhaba {KARSI_HOCANın_ADI} Hocam,

Bende bulunan {BENIM_SINAVIM} ({BENIM_TARIH} {BENIM_SAAT} - {BENIM_SALON}) sinav gozetmenlik gorevini, sizde bulunan {KARSI_SINAV} ({KARSI_TARIH} {KARSI_SAAT} - {KARSI_SALON}) sinav gozetmenlik goreviyle takas etmek istiyorum.

Uygun olmaniz halinde sistem uzerinden onay verebilirsiniz.

Benim Gorevim   : {BENIM_SINAVIM} / {BENIM_TARIH} {BENIM_SAAT} / {BENIM_SALON} / {BENIM_SURE} dk
Sizin Goreviniiz : {KARSI_SINAV} / {KARSI_TARIH} {KARSI_SAAT} / {KARSI_SALON} / {KARSI_SURE} dk

Not: Bu e-posta yalnizca talep amaclidir. Gercek gorev degisimi sistem onayi gerektirir.

Iyi calismalar,
{BENIM_ADIM}`;

const _STE_DEFAULT_MARKET = `Merhaba,

{TARIH} tarihinde saat {SAAT}'de {EXAM_NAME} sinavi icin gozetmenlik gorevimi devretmek istiyorum.

Gorevi almak isteyen bir hocanin profil sayfasindaki 'Pazar Yeri' sekmesinden 'Gorevi Al' secenegini kullanmasi yeterlidir.

Gorev Bilgileri:
  Ders/Sinav  : {EXAM_NAME}
  Tarih       : {TARIH}
  Saat        : {SAAT}
  Salon       : {SALON}
  Sure        : {SURE} dakika
  Puan Degeri : {PUAN}

Not: Bu e-posta yalnizca bilgilendirme amaclidir. Gorevi alan kisi sistem uzerinden onay vermek zorundadir.

Iyi calismalar,
{BENIM_ADIM}`;

function steRender() {
    const body = document.getElementById('swap-template-body');
    if (!body) return;
    if (!DB.swapTemplates) DB.swapTemplates = {};
    const t = DB.swapTemplates;

    const swapVars   = ['{KARSI_HOCANın_ADI}','{BENIM_SINAVIM}','{BENIM_TARIH}','{BENIM_SAAT}','{BENIM_SALON}','{BENIM_SURE}','{KARSI_SINAV}','{KARSI_TARIH}','{KARSI_SAAT}','{KARSI_SALON}','{KARSI_SURE}','{BENIM_ADIM}'];
    const marketVars = ['{EXAM_NAME}','{TARIH}','{SAAT}','{SALON}','{SURE}','{PUAN}','{BENIM_ADIM}'];

    const renderVarBadges = (vars, color, bgColor) => vars.map(v =>
        `<code onclick="try{navigator.clipboard.writeText('${v}')}catch(e){}" title="Kopyalamak için tıkla"
            style="background:${bgColor};border:1px solid ${color};padding:2px 7px;border-radius:6px;font-size:.68rem;cursor:pointer;color:${color.replace('0.3','0.9')};">${v}</code>`
    ).join(' ');

    body.innerHTML = `
        <p style="color:var(--text-muted);font-size:.82rem;margin:0 0 1.25rem 0;">
            E-posta şablonlarını özelleştirin. Süslü parantezli değişkenler gönderim sırasında otomatik doldurulur. Badge'e tıklayarak kopyalayabilirsiniz.
        </p>

        <!-- Takas Şablonu -->
        <div style="margin-bottom:1.5rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;flex-wrap:wrap;gap:.4rem;">
                <label style="font-weight:700;font-size:.9rem;">🔄 Takas Talebi Şablonu</label>
                <button onclick="document.getElementById('ste-swap').value=window._STE_DEFAULT_SWAP"
                    style="font-size:.7rem;padding:3px 10px;border-radius:8px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.05);color:var(--text-muted);cursor:pointer;">
                    ↺ Varsayılana Dön
                </button>
            </div>
            <div style="margin-bottom:.5rem;display:flex;flex-wrap:wrap;gap:4px;">
                ${renderVarBadges(swapVars, 'rgba(99,102,241,0.5)', 'rgba(99,102,241,0.1)')}
            </div>
            <textarea id="ste-swap"
                style="width:100%;min-height:200px;background:rgba(0,0,0,0.3);border:1px solid var(--glass-border);border-radius:10px;padding:.9rem;color:#e2e8f0;font-family:monospace;font-size:.8rem;line-height:1.6;resize:vertical;box-sizing:border-box;"
            >${t.swap_request || _STE_DEFAULT_SWAP}</textarea>
        </div>

        <!-- Pazar Şablonu -->
        <div style="margin-bottom:1.5rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;flex-wrap:wrap;gap:.4rem;">
                <label style="font-weight:700;font-size:.9rem;">📤 Görev Pazarı Bildirim Şablonu</label>
                <button onclick="document.getElementById('ste-market').value=window._STE_DEFAULT_MARKET"
                    style="font-size:.7rem;padding:3px 10px;border-radius:8px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.05);color:var(--text-muted);cursor:pointer;">
                    ↺ Varsayılana Dön
                </button>
            </div>
            <div style="margin-bottom:.5rem;display:flex;flex-wrap:wrap;gap:4px;">
                ${renderVarBadges(marketVars, 'rgba(14,165,233,0.5)', 'rgba(14,165,233,0.1)')}
            </div>
            <textarea id="ste-market"
                style="width:100%;min-height:180px;background:rgba(0,0,0,0.3);border:1px solid var(--glass-border);border-radius:10px;padding:.9rem;color:#e2e8f0;font-family:monospace;font-size:.8rem;line-height:1.6;resize:vertical;box-sizing:border-box;"
            >${t.market_notify || _STE_DEFAULT_MARKET}</textarea>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
            <button onclick="document.getElementById('modal-swap-template-editor').classList.add('hidden')"
                style="padding:.65rem 1.25rem;border-radius:10px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.05);color:var(--text-muted);cursor:pointer;font-size:.85rem;">
                Vazgeç
            </button>
            <button onclick="steSave()"
                style="padding:.65rem 1.5rem;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:white;font-weight:700;cursor:pointer;font-size:.9rem;">
                💾 Şablonları Kaydet
            </button>
        </div>
        <div id="ste-save-msg" class="hidden"
            style="margin-top:.75rem;padding:.6rem 1rem;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.35);border-radius:10px;color:#34d399;font-size:.82rem;text-align:center;">
            ✅ Şablonlar kaydedildi!
        </div>`;
}

// Varsayılan şablonları global'e aç (textarea onchange'de kullanmak için)
window._STE_DEFAULT_SWAP   = _STE_DEFAULT_SWAP;
window._STE_DEFAULT_MARKET = _STE_DEFAULT_MARKET;

window.steSave = function() {
    if (!DB.swapTemplates) DB.swapTemplates = {};
    const swapTxt   = ((document.getElementById('ste-swap')   || {}).value || '').trim();
    const marketTxt = ((document.getElementById('ste-market') || {}).value || '').trim();
    if (swapTxt)   DB.swapTemplates.swap_request  = swapTxt;
    if (marketTxt) DB.swapTemplates.market_notify = marketTxt;
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    if (typeof saveToBackend      === 'function') saveToBackend();
    const msg = document.getElementById('ste-save-msg');
    if (msg) { msg.classList.remove('hidden'); setTimeout(() => msg.classList.add('hidden'), 2500); }
};

/* Şablon değişkenlerini gerçek verilerle değiştirir — seBuildEmailText için fallback */
window.applySwapTemplate = function(myExam, myStaff, targetExam, targetStaff, note) {
    const tmpl = (DB.swapTemplates || {}).swap_request;
    if (!tmpl) return null;
    const dtFn = window.formatDateTR || (d => d);
    let txt = tmpl
        .replace(/{KARSI_HOCANın_ADI}/g, targetStaff.name)
        .replace(/{BENIM_SINAVIM}/g,     myExam.name)
        .replace(/{BENIM_TARIH}/g,       dtFn(myExam.date))
        .replace(/{BENIM_SAAT}/g,        myExam.time || '-')
        .replace(/{BENIM_SALON}/g,       myExam.location || '-')
        .replace(/{BENIM_SURE}/g,        myExam.duration || '-')
        .replace(/{KARSI_SINAV}/g,       targetExam.name)
        .replace(/{KARSI_TARIH}/g,       dtFn(targetExam.date))
        .replace(/{KARSI_SAAT}/g,        targetExam.time || '-')
        .replace(/{KARSI_SALON}/g,       targetExam.location || '-')
        .replace(/{KARSI_SURE}/g,        targetExam.duration || '-')
        .replace(/{BENIM_ADIM}/g,        myStaff.name);
    if (note && note.trim()) txt += `\n\nNot: ${note.trim()}`;
    return txt;
};

window.applyMarketTemplate = function(exam, myStaff) {
    const tmpl = (DB.swapTemplates || {}).market_notify;
    if (!tmpl) return null;
    const dtFn = window.formatDateTR || (d => d);
    return tmpl
        .replace(/{EXAM_NAME}/g,  exam.name)
        .replace(/{TARIH}/g,      dtFn(exam.date))
        .replace(/{SAAT}/g,       exam.time || '-')
        .replace(/{SALON}/g,      exam.location || '-')
        .replace(/{SURE}/g,       exam.duration || '-')
        .replace(/{PUAN}/g,       exam.score || 0)
        .replace(/{BENIM_ADIM}/g, myStaff.name);
};

