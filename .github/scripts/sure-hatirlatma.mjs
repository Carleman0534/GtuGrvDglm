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

const STATE_FILE = process.env.STATE_FILE || 'hatirlatma.json';
const user = process.env.GMAIL_USER || '';
const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const dryRun = process.env.DRY_RUN === '1' || !user || !pass;
const now = process.env.NOW ? Date.parse(process.env.NOW) : Date.now();

const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// Sınav saatleri Türkiye saatidir (UTC+3, yaz saati yok)
function examStart(ex) {
    if (!ex.date || !ex.time) return NaN;
    const [h, m] = String(ex.time).split(':');
    return Date.parse(`${ex.date}T${String(h).padStart(2, '0')}:${String(m || '0').padStart(2, '0')}:00+03:00`);
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

    let transporter = null;
    if (!dryRun && due.size) {
        const nodemailer = (await import('nodemailer')).default;
        transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    }

    let sent = 0, skipped = 0, failed = 0;
    for (const [pid, exams] of due) {
        const staff = staffById.get(pid);
        if (!staff || !isEmail(staff.email)) { skipped++; console.log(`Atlandı: gözetmen #${pid} için geçerli e-posta yok (${exams.length} sınav)`); continue; }
        const mail = buildEmail(staff, exams);
        if (dryRun) {
            console.log(`[Deneme] gözetmen #${pid} → ${exams.length} sınav: ${exams.map(e => e.id).join(', ')}`);
            continue;
        }
        try {
            await transporter.sendMail({
                from: `"GTÜ Gözetmenlik Sistemi" <${user}>`,
                to: staff.email.trim(),
                subject: mail.subject,
                text: mail.text,
                html: mail.html
            });
            const stamp = new Date(now).toISOString();
            for (const ex of exams) {
                const key = `${ex.id}:${pid}`;
                state[key] = { count: ((state[key] && state[key].count) || 0) + 1, last: stamp };
            }
            sent++;
            console.log(`Gönderildi: gözetmen #${pid} (${exams.length} sınav)`);
        } catch (e) {
            failed++;
            console.error(`Gönderilemedi: gözetmen #${pid}: ${e.message}`);
        }
    }

    // 30 günden eski kayıtları temizle
    for (const [k, v] of Object.entries(state)) {
        if (now - Date.parse(v.last) > 30 * 24 * 60 * 60 * 1000) delete state[k];
    }
    if (!dryRun) writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');

    console.log(`${dryRun ? '[Deneme modu] ' : ''}Onay bekleyen sınav: ${pendingCount}, e-posta alacak gözetmen: ${due.size}, gönderilen: ${sent}, atlanan: ${skipped}, hata: ${failed}`);
    if (dryRun && (!user || !pass)) console.log('GMAIL_USER / GMAIL_APP_PASSWORD tanımlı olmadığı için e-posta gönderilmedi.');
    if (failed) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exit(1); });
