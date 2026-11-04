/**
 * ⏱️ Sınav Süresi Onay Hatırlatıcısı (GitHub Actions ile her 15 dakikada bir çalışır)
 *
 * Site kapalıyken de çalışır: Firebase'deki sınavları okur, bitmiş ve süresi henüz
 * onaylanmamış sınavların gözetmenlerine e-posta gönderir.
 *  - İlk e-posta: sınav bittikten 15 dk sonra
 *  - Hatırlatma: hâlâ onaylanmadıysa 24 saat sonra (sınav başına en fazla 2 e-posta)
 *  - Son 3 günde biten sınavlara bakılır; 31 Ekim 2026 öncesi sınavlar peşinen onaylıdır.
 *
 * Hangi e-postanın gönderildiği STATE_FILE'da tutulur (iş akışı bunu "durum" dalında saklar).
 * Depo herkese açık olduğu için kayıtlara isim / e-posta adresi yazılmaz.
 *
 * Ortam değişkenleri:
 *   GMAIL_USER, GMAIL_APP_PASSWORD  Gönderen Gmail hesabı ve uygulama şifresi (yoksa deneme modu)
 *   STATE_FILE                      Gönderim kaydı (varsayılan: hatirlatma.json)
 *   DRY_RUN=1                       E-posta göndermeden yalnızca neler gönderileceğini say
 *   DB_FILE                         (test) Firebase yerine bu JSON dosyasını oku
 *   NOW                             (test) Şimdiki zamanı değiştir, ör. 2026-11-03T12:00:00+03:00
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DB_URL = 'https://gtumath-db-default-rtdb.europe-west1.firebasedatabase.app/gizli_yol_gtu_admin_data.json';
const SITE_URL = 'https://carleman0534.github.io/GtuGrvDglm/';
const CUTOFF = Date.parse('2026-10-31T21:48:45+03:00'); // app.js ile aynı sınır
const GRACE_MS = 15 * 60 * 1000;
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_SENDS = 2;
const BROADCAST_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // sitedeki duyuru süre sınırıyla aynı

const STATE_FILE = process.env.STATE_FILE || 'hatirlatma.json';
const user = process.env.GMAIL_USER || '';
const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const vapidPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
const vapidPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
const emailEnabled = !!(user && pass);
const pushEnabled = !!(vapidPublic && vapidPrivate);
const dryRun = process.env.DRY_RUN === '1' || (!emailEnabled && !pushEnabled);
const now = process.env.NOW ? Date.parse(process.env.NOW) : Date.now();

const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// Sınav saatleri Türkiye saatidir (UTC+3, yaz saati yok)
function examStart(ex) {
    if (!ex.date || !ex.time) return NaN;
    const [h, m] = String(ex.time).split(':');
    return Date.parse(`${ex.date}T${String(h).padStart(2, '0')}:${String(m || '0').padStart(2, '0')}:00+03:00`);
}

// Türkiye saatine göre YYYY-MM-DD
function trDate(ms) {
    return new Date(ms + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Duyurunun hedeflediği gözetmen kimlikleri (sitedeki checkIncomingBroadcastNotifications ile aynı kurallar)
function broadcastTargets(db, bc) {
    const t = bc.target;
    if (!t || t === 'all') return Object.keys(db.pushAbonelikleri || {});
    if (t === 'tomorrow_only') {
        const tomorrow = trDate((Date.parse(bc.createdAt) || bc.timestamp) + 24 * 60 * 60 * 1000);
        const ids = new Set();
        for (const ex of db.exams || []) if (ex && ex.date === tomorrow) proctorIds(ex).forEach(id => ids.add(id));
        return [...ids];
    }
    return (Array.isArray(t) ? t : [t]).map(String);
}

function proctorIds(ex) {
    if (Array.isArray(ex.proctorIds) && ex.proctorIds.length) return ex.proctorIds.filter(p => p != null).map(String);
    return ex.proctorId ? [String(ex.proctorId)] : [];
}

async function loadDB() {
    if (process.env.DB_FILE) return JSON.parse(readFileSync(process.env.DB_FILE, 'utf8'));
    const res = await fetch(DB_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Firebase okunamadı: HTTP ' + res.status);
    return res.json();
}

function buildEmail(staff, exams) {
    const subject = exams.length === 1
        ? `⏱️ Sınav sürenizi onaylayın: ${exams[0].name}`
        : `⏱️ ${exams.length} sınavın süresini onaylamanız bekleniyor`;
    const rows = exams.map(ex => {
        const mins = parseInt(ex.scheduledDuration || ex.duration, 10) || 60;
        return {
            text: `- ${ex.name} | ${ex.date} ${ex.time} | ${ex.location || '-'} | Planlanan: ${mins} dk`,
            html: `<tr>
                <td style="padding:8px 10px; border-bottom:1px solid #e5e7eb;"><strong>${escapeHtml(ex.name)}</strong><br>
                    <span style="color:#6b7280; font-size:13px;">${escapeHtml(ex.date)} · ${escapeHtml(ex.time)} · ${escapeHtml(ex.location || '-')}</span></td>
                <td style="padding:8px 10px; border-bottom:1px solid #e5e7eb; white-space:nowrap; text-align:right;">${mins} dk</td>
            </tr>`
        };
    });
    const text = `Sayın ${staff.name} Hocam,

Gözetmenlik yaptığınız aşağıdaki ${exams.length > 1 ? 'sınavların' : 'sınavın'} süresi henüz onaylanmadı:

${rows.map(r => r.text).join('\n')}

Puanlar onayladığınız süreye göre hesaplanır. Siteye girdiğinizde onay penceresi otomatik açılır;
tek dokunuşla "planlandığı gibi sürdü" diyebilir ya da gerçek süreyi girebilirsiniz.

${SITE_URL}

GTÜ Matematik Bölümü - Gözetmenlik Sistemi (otomatik e-posta)`;
    const html = `<div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto; color:#111827;">
  <div style="background:linear-gradient(135deg,#d97706,#f59e0b); color:#fff; padding:18px 20px; border-radius:10px 10px 0 0;">
    <div style="font-size:18px; font-weight:bold;">⏱️ Sınav Sürenizi Onaylayın</div>
    <div style="font-size:13px; opacity:0.9;">GTÜ Matematik Bölümü - Gözetmenlik Sistemi</div>
  </div>
  <div style="background:#fff; border:1px solid #e5e7eb; border-top:none; padding:18px 20px; border-radius:0 0 10px 10px;">
    <p>Sayın <strong>${escapeHtml(staff.name)} Hocam</strong>,</p>
    <p>Gözetmenlik yaptığınız aşağıdaki ${exams.length > 1 ? 'sınavların' : 'sınavın'} süresi henüz onaylanmadı:</p>
    <table style="width:100%; border-collapse:collapse; font-size:14px; margin:10px 0 16px;">${rows.map(r => r.html).join('')}</table>
    <p style="font-size:14px;">Puanlar onayladığınız süreye göre hesaplanır. Siteye girdiğinizde onay penceresi otomatik açılır; tek dokunuşla onaylayabilir ya da gerçek süreyi girebilirsiniz.</p>
    <p style="text-align:center; margin:22px 0;">
      <a href="${SITE_URL}" style="background:#059669; color:#fff; text-decoration:none; padding:12px 26px; border-radius:8px; font-weight:bold; display:inline-block;">Süremi Onayla</a>
    </p>
    <p style="font-size:12px; color:#9ca3af;">Bu e-posta otomatik gönderilmiştir. Süreyi onayladığınızda hatırlatmalar durur.</p>
  </div>
</div>`;
    return { subject, text, html };
}

async function main() {
    const db = await loadDB();
    if (!db || !Array.isArray(db.exams) || !Array.isArray(db.staff)) throw new Error('Beklenmeyen veri biçimi');

    const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8') || '{}') : {};
    const staffById = new Map(db.staff.filter(Boolean).map(s => [String(s.id), s]));

    // Gözetmen başına gönderilecek sınavlar
    const due = new Map();
    let pendingCount = 0;
    for (const ex of db.exams) {
        if (!ex || ex.durationConfirmed || ex.lecturerVerified || ex.durationApproved || ex.actualDuration) continue;
        const start = examStart(ex);
        if (isNaN(start) || start < CUTOFF) continue;
        const end = start + (parseInt(ex.duration, 10) || 60) * 60000;
        if (now < end + GRACE_MS || now - end > LOOKBACK_MS) continue;
        pendingCount++;
        for (const pid of proctorIds(ex)) {
            const key = `${ex.id}:${pid}`;
            const sent = state[key];
            if (sent && (sent.count >= MAX_SENDS || now - Date.parse(sent.last) < REMIND_AFTER_MS)) continue;
            if (!due.has(pid)) due.set(pid, []);
            due.get(pid).push(ex);
        }
    }

    // Panelden gönderilen yönetici duyuruları (son 3 gün, cihaz bildirimi açık, henüz gönderilmemiş)
    const sentBroadcasts = state._duyurular || {};
    const broadcastsDue = (Array.isArray(db.adminBroadcasts) ? db.adminBroadcasts : Object.values(db.adminBroadcasts || {}))
        .filter(bc => bc && bc.id && bc.message && bc.pushToDevice !== false && !sentBroadcasts[bc.id])
        .filter(bc => {
            const at = Date.parse(bc.createdAt) || bc.timestamp;
            return at && now - at <= BROADCAST_MAX_AGE_MS && at <= now;
        });

    let transporter = null, webpush = null;
    if (!dryRun && (due.size || (broadcastsDue.length && pushEnabled))) {
        if (emailEnabled) {
            const nodemailer = (await import('nodemailer')).default;
            transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
        }
        if (pushEnabled) {
            webpush = (await import('web-push')).default;
            webpush.setVapidDetails(process.env.VAPID_SUBJECT || SITE_URL.replace(/\/GtuGrvDglm\/$/, ''), vapidPublic, vapidPrivate);
        }
    }

    // Telefona kayıtlı cihazlar (site, izin verilince DB.pushAbonelikleri[gözetmenId] altına yazar)
    const subsOf = (pid) => {
        const all = db.pushAbonelikleri && db.pushAbonelikleri[pid];
        const list = Array.isArray(all) ? all : (all && typeof all === 'object' ? Object.values(all) : []);
        const dead = state._oluAbonelikler || {};
        return list.filter(s => s && s.endpoint && s.keys && s.keys.p256dh && s.keys.auth && !dead[s.id]);
    };

    let sent = 0, pushed = 0, skipped = 0, failed = 0;
    for (const [pid, exams] of due) {
        const staff = staffById.get(pid);
        if (!staff) { skipped++; console.log(`Atlandı: gözetmen #${pid} personel listesinde yok (${exams.length} sınav)`); continue; }
        const subs = subsOf(pid);
        const hasEmail = isEmail(staff.email);
        if (!hasEmail && !subs.length) { skipped++; console.log(`Atlandı: gözetmen #${pid} için e-posta veya kayıtlı cihaz yok`); continue; }
        if (dryRun) {
            console.log(`[Deneme] gözetmen #${pid} → ${exams.length} sınav (${exams.map(e => e.id).join(', ')}), e-posta: ${hasEmail ? 'var' : 'yok'}, cihaz: ${subs.length}`);
            continue;
        }

        let delivered = false;
        if (transporter && hasEmail) {
            const mail = buildEmail(staff, exams);
            try {
                await transporter.sendMail({ from: `"GTÜ Gözetmenlik Sistemi" <${user}>`, to: staff.email.trim(), subject: mail.subject, text: mail.text, html: mail.html });
                delivered = true; sent++;
                console.log(`E-posta gönderildi: gözetmen #${pid} (${exams.length} sınav)`);
            } catch (e) {
                failed++;
                console.error(`E-posta gönderilemedi: gözetmen #${pid}: ${e.message}`);
            }
        }
        if (webpush && subs.length) {
            const first = exams[0];
            const payload = JSON.stringify({
                title: '⏱️ Sınav sürenizi onaylayın',
                body: exams.length === 1
                    ? `${first.name} (${first.date} ${first.time}) — ${parseInt(first.scheduledDuration || first.duration, 10) || 60} dk sürdü mü?`
                    : `${exams.length} sınavın süresi onay bekliyor. Dokunun ve onaylayın.`,
                tag: 'sure_onay',
                data: { url: SITE_URL, action: 'verify_duration', examId: first.id, step: 'question' }
            });
            for (const s of subs) {
                try {
                    await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 24 * 60 * 60 });
                    delivered = true; pushed++;
                } catch (e) {
                    if (e.statusCode === 404 || e.statusCode === 410) {
                        // Cihaz aboneliği iptal olmuş (uygulama silindi / izin kaldırıldı): bir daha deneme
                        state._oluAbonelikler = Object.assign(state._oluAbonelikler || {}, { [s.id]: new Date(now).toISOString() });
                        console.log(`Cihaz aboneliği geçersiz, atlanacak: gözetmen #${pid}`);
                    } else {
                        failed++;
                        console.error(`Bildirim gönderilemedi: gözetmen #${pid}: ${e.statusCode || ''} ${e.message}`);
                    }
                }
            }
            console.log(`Telefon bildirimi: gözetmen #${pid}, ${subs.length} cihaz`);
        }

        if (delivered) {
            const stamp = new Date(now).toISOString();
            for (const ex of exams) {
                const key = `${ex.id}:${pid}`;
                state[key] = { count: ((state[key] && state[key].count) || 0) + 1, last: stamp };
            }
        }
    }

    // --- Yönetici duyurularını telefonlara gönder ---
    let broadcastPushed = 0;
    for (const bc of broadcastsDue) {
        const targetIds = broadcastTargets(db, bc);
        const subs = new Map();
        for (const pid of targetIds) for (const s of subsOf(pid)) subs.set(s.id, s);
        if (dryRun || !webpush) {
            console.log(`${dryRun ? '[Deneme] ' : ''}Duyuru ${bc.id} → hedef ${targetIds.length} kişi, ${subs.size} cihaz${webpush ? '' : ' (telefon anahtarları tanımlı değil, gönderilmedi)'}`);
            continue;
        }
        const payload = JSON.stringify({
            title: bc.title || '📢 GTÜ Gözetmenlik Yönetici Bildirimi',
            body: String(bc.message).slice(0, 300),
            // Uygulama açıkken sitenin gösterdiği bildirimle aynı etiket: aynı cihazda ikinci kez çıkmaz, yerini alır
            tag: `gtu_exam_bc_${bc.id}`,
            data: { url: SITE_URL, broadcastId: bc.id, priority: bc.priority || 'normal' }
        });
        let ok = 0;
        for (const s of subs.values()) {
            try {
                await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 24 * 60 * 60, urgency: bc.priority === 'urgent' ? 'high' : 'normal' });
                ok++;
            } catch (e) {
                if (e.statusCode === 404 || e.statusCode === 410) {
                    state._oluAbonelikler = Object.assign(state._oluAbonelikler || {}, { [s.id]: new Date(now).toISOString() });
                } else {
                    failed++;
                    console.error(`Duyuru gönderilemedi (${bc.id}): ${e.statusCode || ''} ${e.message}`);
                }
            }
        }
        state._duyurular = Object.assign(state._duyurular || {}, { [bc.id]: new Date(now).toISOString() });
        broadcastPushed += ok;
        console.log(`Duyuru ${bc.id}: hedef ${targetIds.length} kişi, ${ok}/${subs.size} cihaza gönderildi`);
    }

    // 30 günden eski kayıtları temizle
    const MONTH = 30 * 24 * 60 * 60 * 1000;
    for (const [k, v] of Object.entries(state)) {
        if (k.startsWith('_')) continue;
        if (now - Date.parse(v.last) > MONTH) delete state[k];
    }
    for (const [k, v] of Object.entries(state._duyurular || {})) {
        if (now - Date.parse(v) > MONTH) delete state._duyurular[k];
    }
    if (!dryRun) writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

    console.log(`${dryRun ? '[Deneme modu] ' : ''}Onay bekleyen sınav: ${pendingCount}, hatırlatılacak gözetmen: ${due.size}, e-posta: ${sent}, telefon bildirimi: ${pushed}, yeni duyuru: ${broadcastsDue.length} (${broadcastPushed} cihaza), atlanan: ${skipped}, hata: ${failed}`);
    if (!emailEnabled) console.log('GMAIL_USER / GMAIL_APP_PASSWORD tanımlı değil: e-posta gönderilmiyor.');
    if (!pushEnabled) console.log('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY tanımlı değil: telefon bildirimi gönderilmiyor.');
    if (failed) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exit(1); });
