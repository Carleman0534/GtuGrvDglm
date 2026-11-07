/**
 * ⏱️ Sınav Süresi Onay Hatırlatıcısı ve duyuru gönderici (GitHub Actions; cron-job.org ile 5 dakikada bir)
 *
 * Site kapalıyken de çalışır ve yalnızca TELEFON BİLDİRİMİ (Web Push) gönderir:
 *  1. Bitmiş ve süresi onaylanmamış sınavın YALNIZCA kendi gözetmenlerinin kayıtlı cihazlarına
 *     "Sınav sürenizi onaylayın" bildirimi: sınav bittikten 15 dk sonra, hâlâ onaylanmadıysa
 *     24 saat sonra bir kez daha (sınav başına en fazla 2). Son 3 günde biten sınavlara bakılır;
 *     31 Ekim 2026 öncesi sınavlar peşinen onaylıdır.
 *  2. Panelden gönderilen yönetici duyurularını (son 3 gün, cihaz bildirimi açık) duyurunun
 *     hedefindeki kişilerin cihazlarına; her duyuru her cihaza bir kez.
 *  3. Görev hatırlatmaları, gözetmen başına toplam 3 bildirim, her biri bir kez:
 *     "Sıradaki göreviniz 3 gün sonra" ve "Yarın göreviniz var" (o günün sabahı, TR 09:00-21:00 arası;
 *     aynı gündeki görevler tek bildirimde birleşir) ve sınav saatinden 2 saat önce "2 saat sonra başlıyor".
 *
 * Neyin gönderildiği STATE_FILE'da tutulur (iş akışı bunu "durum" dalında saklar).
 * Depo herkese açık olduğu için kayıtlara isim / e-posta / cihaz adresi yazılmaz.
 *
 * Ortam değişkenleri:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  Telefon bildirimi anahtarları (yoksa deneme modu)
 *   STATE_FILE                           Gönderim kaydı (varsayılan: hatirlatma.json)
 *   DRY_RUN=1                            Göndermeden yalnızca neler gönderileceğini say
 *   DB_FILE                              (test) Firebase yerine bu JSON dosyasını oku
 *   NOW                                  (test) Şimdiki zamanı değiştir, ör. 2026-11-03T12:00:00+03:00
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
// "Sıradaki göreviniz 3 gün sonra / yarın" hatırlatmaları (notification_engine.js ile aynı)
const REMINDER_DAYS = [3, 1];
const REMINDER_HOURS_BEFORE = 2; // sınav saatinden 2 saat önce son hatırlatma (sitedeki MILESTONES ile aynı)
const REMINDER_FROM_HOUR = 9;   // Türkiye saatiyle 09:00'dan önce gönderme
const REMINDER_UNTIL_HOUR = 21; // 21:00'den sonra gönderme (ertesi sabaha kalırsa bir sonraki gün aşamasına geçer)

const STATE_FILE = process.env.STATE_FILE || 'hatirlatma.json';
const vapidPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
const vapidPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
const pushEnabled = !!(vapidPublic && vapidPrivate);
const dryRun = process.env.DRY_RUN === '1' || !pushEnabled;
const now = process.env.NOW ? Date.parse(process.env.NOW) : Date.now();

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

function proctorIds(ex) {
    if (Array.isArray(ex.proctorIds) && ex.proctorIds.length) return ex.proctorIds.filter(p => p != null).map(String);
    return ex.proctorId ? [String(ex.proctorId)] : [];
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

// Sitedeki bildirimle aynı metin ve etiket (aynı cihazda ikisi birden gelirse biri diğerinin yerini alır)
function upcomingPayload({ pid, days, date, exams }) {
    const dayName = new Date(date + 'T12:00:00+03:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });
    const sorted = [...exams].sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const title = days === 1 ? '📅 Yarın göreviniz var' : `📅 Sıradaki göreviniz ${days} gün sonra`;
    const body = sorted.length === 1
        ? `${sorted[0].name} — ${dayName} ${sorted[0].time}, ${sorted[0].location || 'derslik belirtilmedi'} (${parseInt(sorted[0].duration, 10) || 60} dk)`
        : `${dayName}: ${sorted.length} görev — ` + sorted.map(e => `${e.time} ${e.name}`).join(' · ');
    return {
        title,
        body: body.slice(0, 300),
        tag: `gtu_exam_gun_${pid}_${days}_${date}`,
        data: { url: SITE_URL, examId: sorted[0].id }
    };
}

async function loadDB() {
    if (process.env.DB_FILE) return JSON.parse(readFileSync(process.env.DB_FILE, 'utf8'));
    const res = await fetch(DB_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Firebase okunamadı: HTTP ' + res.status);
    return res.json();
}

async function main() {
    const db = await loadDB();
    if (!db || !Array.isArray(db.exams) || !Array.isArray(db.staff)) throw new Error('Beklenmeyen veri biçimi');

    const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8') || '{}') : {};
    const staffIds = new Set(db.staff.filter(Boolean).map(s => String(s.id)));

    // Telefona kayıtlı cihazlar (site, izin verilince DB.pushAbonelikleri[gözetmenId] altına yazar)
    const subsOf = (pid) => {
        const all = db.pushAbonelikleri && db.pushAbonelikleri[pid];
        const list = Array.isArray(all) ? all : (all && typeof all === 'object' ? Object.values(all) : []);
        const dead = state._oluAbonelikler || {};
        return list.filter(s => s && s.endpoint && s.keys && s.keys.p256dh && s.keys.auth && !dead[s.id]);
    };

    // Gözetmen başına hatırlatılacak sınavlar: yalnızca sınavın kendi gözetmenleri
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

    // Yaklaşan görev hatırlatmaları: sınava 3 gün ve 1 gün (yarın) kala, o günün sabahı.
    // Gözetmen başına ve gün başına tek bildirim (aynı gün birden fazla görevi varsa birleşir).
    const upcomingDue = new Map(); // `${pid}|${days}|${date}` -> { pid, days, date, exams }
    const trHour = new Date(now + 3 * 60 * 60 * 1000).getUTCHours();
    if (trHour >= REMINDER_FROM_HOUR && trHour < REMINDER_UNTIL_HOUR) {
        const today = trDate(now);
        for (const ex of db.exams) {
            if (!ex || !ex.date || !ex.time) continue;
            const days = Math.round((Date.parse(ex.date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
            if (!REMINDER_DAYS.includes(days)) continue;
            for (const pid of proctorIds(ex)) {
                const key = `gun:${pid}:${days}:${ex.date}`;
                if (state[key]) continue;
                const k = `${pid}|${days}|${ex.date}`;
                if (!upcomingDue.has(k)) upcomingDue.set(k, { pid, days, date: ex.date, key, exams: [] });
                upcomingDue.get(k).exams.push(ex);
            }
        }
    }

    // Sınava 2 saat kala son hatırlatma (gözetmen ve sınav başına bir kez; saat kısıtı yok)
    const hourDue = [];
    for (const ex of db.exams) {
        if (!ex) continue;
        const start = examStart(ex);
        if (isNaN(start) || start <= now || start - now > REMINDER_HOURS_BEFORE * 3600000) continue;
        for (const pid of proctorIds(ex)) {
            const key = `saat${REMINDER_HOURS_BEFORE}:${pid}:${ex.id}`;
            if (!state[key]) hourDue.push({ pid, ex, key });
        }
    }

    let webpush = null;
    if (!dryRun && (due.size || broadcastsDue.length || upcomingDue.size || hourDue.length)) {
        webpush = (await import('web-push')).default;
        webpush.setVapidDetails(process.env.VAPID_SUBJECT || SITE_URL.replace(/\/GtuGrvDglm\/$/, ''), vapidPublic, vapidPrivate);
    }

    let failed = 0;
    const send = async (pid, s, payload, options) => {
        try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, options);
            return true;
        } catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410) {
                // Cihaz aboneliği iptal olmuş (uygulama silindi / izin kaldırıldı): bir daha deneme
                state._oluAbonelikler = Object.assign(state._oluAbonelikler || {}, { [s.id]: new Date(now).toISOString() });
                console.log(`Cihaz aboneliği geçersiz, atlanacak: gözetmen #${pid}`);
            } else {
                failed++;
                console.error(`Bildirim gönderilemedi: gözetmen #${pid}: ${e.statusCode || ''} ${e.message}`);
            }
            return false;
        }
    };

    // --- Süre onayı hatırlatmaları ---
    let pushed = 0, noDevice = 0;
    for (const [pid, exams] of due) {
        const subs = staffIds.has(pid) ? subsOf(pid) : [];
        if (!subs.length) { noDevice++; continue; }
        if (dryRun) {
            console.log(`[Deneme] gözetmen #${pid} → ${exams.length} sınav (${exams.map(e => e.id).join(', ')}), ${subs.length} cihaz`);
            continue;
        }
        const first = exams[0];
        const payload = JSON.stringify({
            title: '⏱️ Sınav sürenizi onaylayın',
            body: exams.length === 1
                ? `${first.name} (${first.date} ${first.time}) — ${parseInt(first.scheduledDuration || first.duration, 10) || 60} dk sürdü mü?`
                : `${exams.length} sınavın süresi onay bekliyor. Dokunun ve onaylayın.`,
            tag: 'sure_onay',
            data: { url: SITE_URL, action: 'verify_duration', examId: first.id, step: 'question' }
        });
        let delivered = false;
        for (const s of subs) {
            if (await send(pid, s, payload, { TTL: 24 * 60 * 60 })) { delivered = true; pushed++; }
        }
        if (delivered) {
            const stamp = new Date(now).toISOString();
            for (const ex of exams) {
                const key = `${ex.id}:${pid}`;
                state[key] = { count: ((state[key] && state[key].count) || 0) + 1, last: stamp };
            }
        }
        console.log(`Süre hatırlatması: gözetmen #${pid}, ${exams.length} sınav, ${subs.length} cihaz`);
    }

    // --- Yaklaşan görev hatırlatmaları ---
    let upcomingPushed = 0;
    for (const item of upcomingDue.values()) {
        const subs = staffIds.has(item.pid) ? subsOf(item.pid) : [];
        if (!subs.length) continue;
        if (dryRun) {
            console.log(`[Deneme] Sıradaki görev: gözetmen #${item.pid}, ${item.days} gün sonra (${item.date}), ${item.exams.length} sınav, ${subs.length} cihaz`);
            continue;
        }
        const payload = JSON.stringify(upcomingPayload(item));
        let delivered = false;
        for (const s of subs) {
            if (await send(item.pid, s, payload, { TTL: 12 * 60 * 60 })) { delivered = true; upcomingPushed++; }
        }
        if (delivered) state[item.key] = { count: 1, last: new Date(now).toISOString() };
        console.log(`Sıradaki görev: gözetmen #${item.pid}, ${item.days} gün sonra, ${subs.length} cihaz`);
    }

    // --- 2 saat kala hatırlatmaları ---
    for (const item of hourDue) {
        const subs = staffIds.has(item.pid) ? subsOf(item.pid) : [];
        if (!subs.length) continue;
        if (dryRun) {
            console.log(`[Deneme] ${REMINDER_HOURS_BEFORE} saat kala: gözetmen #${item.pid}, sınav ${item.ex.id} (${item.ex.date} ${item.ex.time}), ${subs.length} cihaz`);
            continue;
        }
        const ex = item.ex;
        const loc = ex.location ? `Salon: ${ex.location}` : 'Derslik henüz belirtilmedi';
        const dur = ex.duration ? `(${ex.duration} dk)` : '';
        // Sitedeki bildirimle aynı metin ve etiket (aynı cihazda ikisi birden gelirse biri diğerinin yerini alır)
        const payload = JSON.stringify({
            title: `⏰ ${ex.name} 2 saat sonra başlıyor`,
            body: `Saat ${ex.time}'da başlayacak sınav görevi. ${loc} ${dur}`.trim().slice(0, 300),
            tag: `gtu_exam_${ex.id}_2h`,
            data: { url: SITE_URL, examId: ex.id }
        });
        let delivered = false;
        for (const s of subs) {
            if (await send(item.pid, s, payload, { TTL: 2 * 60 * 60 })) { delivered = true; upcomingPushed++; }
        }
        if (delivered) state[item.key] = { count: 1, last: new Date(now).toISOString() };
        console.log(`${REMINDER_HOURS_BEFORE} saat kala: gözetmen #${item.pid}, ${subs.length} cihaz`);
    }

    // --- Yönetici duyuruları ---
    let broadcastPushed = 0;
    for (const bc of broadcastsDue) {
        const targetIds = broadcastTargets(db, bc);
        const subs = new Map();
        for (const pid of targetIds) for (const s of subsOf(pid)) subs.set(s.id, { pid, s });
        if (dryRun) {
            console.log(`[Deneme] Duyuru ${bc.id} → hedef ${targetIds.length} kişi, ${subs.size} cihaz`);
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
        for (const { pid, s } of subs.values()) {
            if (await send(pid, s, payload, { TTL: 24 * 60 * 60, urgency: bc.priority === 'urgent' ? 'high' : 'normal' })) ok++;
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

    console.log(`${dryRun ? '[Deneme modu] ' : ''}Onay bekleyen sınav: ${pendingCount}, hatırlatılacak gözetmen: ${due.size} (kayıtlı cihazı olmayan: ${noDevice}), telefon bildirimi: ${pushed}, sıradaki görev hatırlatması: ${upcomingPushed}, yeni duyuru: ${broadcastsDue.length} (${broadcastPushed} cihaza), hata: ${failed}`);
    if (!pushEnabled) console.log('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY tanımlı değil: telefon bildirimi gönderilmiyor (deneme modu).');
    if (failed) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exit(1); });
