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
 * NE ZAMAN / KİME / HANGİ METİN kararları sitedeki bildirimlerle ortak dosyadadır: bildirim_kurallari.js
 * (burada kopyası tutulmaz). Bu betik yalnızca veriyi okur, ortak planlayıcıyı çağırır ve gönderir.
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
 *   PLAN_JSON=1                          (test) Deneme modunda planı tek satır JSON olarak da yazdır
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const K = require('../../bildirim_kurallari.js');

const DB_URL = 'https://gtumath-db-default-rtdb.europe-west1.firebasedatabase.app/gizli_yol_gtu_admin_data.json';
const SITE_URL = 'https://carleman0534.github.io/GtuGrvDglm/';
const BROADCAST_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // sitedeki duyuru süre sınırıyla aynı

// Bildirim ömürleri (cihaz kapalıysa en fazla bu kadar bekletilir)
const TTL = {
    [K.TUR.SURE_SORU]: 24 * 60 * 60,
    [K.TUR.GUN]: 12 * 60 * 60,
    [K.TUR.SAAT]: K.AYAR.SAAT_ONCE * 60 * 60
};

const STATE_FILE = process.env.STATE_FILE || 'hatirlatma.json';
const vapidPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
const vapidPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
const pushEnabled = !!(vapidPublic && vapidPrivate);
const dryRun = process.env.DRY_RUN === '1' || !pushEnabled;
const now = process.env.NOW ? Date.parse(process.env.NOW) : Date.now();

// Duyurunun hedeflediği gözetmen kimlikleri (sitedeki checkIncomingBroadcastNotifications ile aynı kurallar)
function broadcastTargets(db, bc) {
    const hedef = K.duyuruHedefleri(db, bc);
    return hedef === null ? Object.keys(db.pushAbonelikleri || {}) : hedef;
}

async function loadDB() {
    if (process.env.DB_FILE) return JSON.parse(readFileSync(process.env.DB_FILE, 'utf8'));
    const res = await fetch(DB_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Firebase okunamadı: HTTP ' + res.status);
    return res.json();
}

const ETIKET = {
    [K.TUR.SURE_SORU]: 'Süre hatırlatması',
    [K.TUR.GUN]: 'Sıradaki görev',
    [K.TUR.SAAT]: `${K.AYAR.SAAT_ONCE} saat kala`
};

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

    // Ortak planlayıcı: süre teyidi, gün ve saat hatırlatmaları
    const plan = K.planla(db, now, { durum: state, siteUrl: SITE_URL });
    const pendingCount = db.exams.filter(ex => K.sureTeyidiBekliyor(ex, now)).length;

    // Panelden gönderilen yönetici duyuruları (son 3 gün, cihaz bildirimi açık, henüz gönderilmemiş)
    const sentBroadcasts = state._duyurular || {};
    const broadcastsDue = (Array.isArray(db.adminBroadcasts) ? db.adminBroadcasts : Object.values(db.adminBroadcasts || {}))
        .filter(bc => bc && bc.id && bc.message && bc.pushToDevice !== false && !sentBroadcasts[bc.id])
        .filter(bc => {
            const at = Date.parse(bc.createdAt) || bc.timestamp;
            return at && now - at <= BROADCAST_MAX_AGE_MS && at <= now;
        });

    if (process.env.PLAN_JSON === '1') {
        console.log('PLAN ' + JSON.stringify(plan.map(p => ({ tur: p.tur, pid: p.pid, sinavlar: p.sinavlar.map(e => e.id), tag: p.payload.tag, data: p.payload.data }))));
    }

    let webpush = null;
    if (!dryRun && (plan.length || broadcastsDue.length)) {
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

    // --- Süre teyidi, gün ve saat hatırlatmaları ---
    const sayac = { [K.TUR.SURE_SORU]: 0, [K.TUR.GUN]: 0, [K.TUR.SAAT]: 0 };
    let noDevice = 0;
    for (const item of plan) {
        const subs = staffIds.has(item.pid) ? subsOf(item.pid) : [];
        if (!subs.length) { if (item.tur === K.TUR.SURE_SORU) noDevice++; continue; }
        const gunBilgisi = item.tur === K.TUR.GUN ? `${item.gun} gün sonra (${item.sinavlar[0].date}), ` : '';
        const what = `${ETIKET[item.tur]}: gözetmen #${item.pid}, ${gunBilgisi}${item.sinavlar.length} sınav (${item.sinavlar.map(e => e.id).join(', ')}), ${subs.length} cihaz`;
        if (dryRun) { console.log(`[Deneme] ${what}`); continue; }
        const payload = JSON.stringify(item.payload);
        let delivered = false;
        for (const s of subs) {
            if (await send(item.pid, s, payload, { TTL: TTL[item.tur] })) { delivered = true; sayac[item.tur]++; }
        }
        if (delivered) K.kaydet(state, item, now);
        console.log(what);
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
        const payload = JSON.stringify(K.duyuru(bc, SITE_URL));
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

    const planSayisi = (tur) => plan.filter(p => p.tur === tur).length;
    console.log(`${dryRun ? '[Deneme modu] ' : ''}Onay bekleyen sınav: ${pendingCount}, ` +
        `planlanan → süre teyidi: ${planSayisi(K.TUR.SURE_SORU)} (kayıtlı cihazı olmayan: ${noDevice}), ` +
        `gün hatırlatması: ${planSayisi(K.TUR.GUN)}, ${K.AYAR.SAAT_ONCE} saat kala: ${planSayisi(K.TUR.SAAT)}; ` +
        `gönderilen bildirim → süre: ${sayac[K.TUR.SURE_SORU]}, gün: ${sayac[K.TUR.GUN]}, saat: ${sayac[K.TUR.SAAT]}; ` +
        `yeni duyuru: ${broadcastsDue.length} (${broadcastPushed} cihaza), hata: ${failed}`);
    if (!pushEnabled) console.log('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY tanımlı değil: telefon bildirimi gönderilmiyor (deneme modu).');
    if (failed) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exit(1); });
