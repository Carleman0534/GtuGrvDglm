/**
 * Bildirim kuralları (bildirim_kurallari.js) — ZAMAN YOLCULUĞU testleri.
 *
 * Bir haftalık takvim 15'er dakika ilerletilir; her adımda ortak planlayıcı (sitede ve GitHub görevinde
 * kullanılan) çağrılır ve "gönderilen" bildirimler kaydedilir. Ardından şunlar doğrulanır:
 *   - süre teyidi hiçbir zaman sınav bitmeden gönderilmez
 *   - hatırlatmalara dokununca süre teyidi penceresi AÇILMAZ, süre teyidine dokununca açılır
 *   - 3 gün / 1 gün / 2 saat hatırlatmaları doğru anda ve bir kez gider
 *   - GitHub görevinin kendisi (deneme modunda) aynı kararları verir
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const ROOT = process.env.TEST_ROOT ? path.resolve(process.env.TEST_ROOT) : path.resolve(__dirname, '..');
const K = require(path.join(ROOT, 'bildirim_kurallari.js'));
const T = (s) => Date.parse(s);                // ISO (+03:00) → ms
const tr = (ms) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' '); // okunur TR saati

function buildDB() {
    return {
        staff: [1, 2, 3, 4].map(id => ({ id, name: 'Gözetmen ' + id })),
        exams: [
            // Bu sabahki olay: 10 Kasım 13:30, 120 dk
            { id: 'E1', name: 'MATH 432 - Deneme', date: '2026-11-10', time: '13:30', duration: 120, location: 'Derslik 1', proctorIds: [1, 2], proctorId: 1 },
            // Aynı gün, saati aralık olarak yazılmış
            { id: 'E2', name: 'MATH 101 - Deneme', date: '2026-11-10', time: '09:00-11:00', duration: 90, location: 'Derslik 2', proctorIds: [1] },
            // 31 Ekim sınırından önce: süre teyidi asla sorulmaz
            { id: 'E3', name: 'Eski Sınav', date: '2026-10-30', time: '10:00', duration: 60, proctorIds: [3] },
            // Zaten onaylanmış
            { id: 'E4', name: 'Onaylı Sınav', date: '2026-11-08', time: '10:00', duration: 60, proctorIds: [3], durationConfirmed: true },
            // Arada onaylanacak
            { id: 'E5', name: 'MATH 301 - Deneme', date: '2026-11-12', time: '17:30', duration: 90, proctorIds: [4] }
        ]
    };
}

/** Sunucu gibi: 15 dakikada bir planla → gönder → kaydet */
function simulate({ from, to, stepMin = 15, opts = {}, onTick } = {}) {
    const db = buildDB();
    const durum = {};
    const olaylar = [];
    for (let now = T(from); now <= T(to); now += stepMin * 60000) {
        if (onTick) onTick(db, now);
        for (const item of K.planla(db, now, Object.assign({ durum, siteUrl: 'https://site/' }, opts))) {
            olaylar.push({ now, tur: item.tur, pid: String(item.pid), sinavlar: item.sinavlar.map(e => e.id), payload: item.payload, gun: item.gun });
            K.kaydet(durum, item, now);
        }
    }
    return olaylar;
}

const HAFTA = { from: '2026-11-06T00:00:00+03:00', to: '2026-11-16T00:00:00+03:00' };
const onayE5 = (db, now) => { if (now >= T('2026-11-13T00:00:00+03:00')) db.exams.find(e => e.id === 'E5').durationConfirmed = true; };

// ---------------------------------------------------------------- yardımcılar
test('saatParcala: farklı saat yazımları', () => {
    assert.deepEqual(K.saatParcala('09:30'), { h: 9, m: 30 });
    assert.deepEqual(K.saatParcala('9:30'), { h: 9, m: 30 });
    assert.deepEqual(K.saatParcala('09.30'), { h: 9, m: 30 });
    assert.deepEqual(K.saatParcala('09:00-11:00'), { h: 9, m: 0 });
    assert.deepEqual(K.saatParcala('0930'), { h: 9, m: 30 });
    assert.deepEqual(K.saatParcala('9'), { h: 9, m: 0 });
    assert.equal(K.saatParcala(''), null);
    assert.equal(K.saatParcala('25:00'), null);
    assert.equal(K.saatParcala('öğlen'), null);
});

test('Saat hesapları cihazın saat diliminden bağımsız (UTC, İstanbul, New York)', () => {
    const script = `const K=require(${JSON.stringify(path.join(ROOT, 'bildirim_kurallari.js'))});
        const e={date:'2026-11-10',time:'13:30',duration:120};
        process.stdout.write(JSON.stringify([K.sinavBaslangic(e),K.sinavBitis(e),K.trTarih(Date.parse('2026-11-09T22:30:00Z')),K.trSaat(Date.parse('2026-11-09T06:03:00Z'))]));`;
    const results = ['UTC', 'Europe/Istanbul', 'America/New_York'].map(TZ =>
        execFileSync(process.execPath, ['-e', script], { env: Object.assign({}, process.env, { TZ }) }).toString());
    assert.equal(new Set(results).size, 1, results.join(' | '));
    const [s, e, d, h] = JSON.parse(results[0]);
    assert.equal(s, T('2026-11-10T13:30:00+03:00'));
    assert.equal(e, T('2026-11-10T15:30:00+03:00'));
    assert.equal(d, '2026-11-10', 'UTC 22:30 = TR 01:30 ertesi gün');
    assert.equal(h, 9, 'UTC 06:03 = TR 09:03');
});

// ---------------------------------------------------------------- dokunma davranışı
test('tiklamaHedefi: yalnızca süre türleri pencere açar; varsayılan yoktur', () => {
    assert.equal(K.tiklamaHedefi({ tur: K.TUR.GUN, examId: 'E1' }).sureEkrani, false);
    assert.equal(K.tiklamaHedefi({ tur: K.TUR.SAAT, examId: 'E1' }).sureEkrani, false);
    assert.equal(K.tiklamaHedefi({ tur: K.TUR.DUYURU }).sureEkrani, false);
    assert.equal(K.tiklamaHedefi({ tur: 'bilinmeyen_tur', examId: 'E1', action: 'verify_duration' }).sureEkrani, false, 'tanınmayan tür → yalnızca uygulama');
    assert.deepEqual(K.tiklamaHedefi({ tur: K.TUR.SURE_SORU, examId: 'E1' }), { sureEkrani: true, examId: 'E1', step: 'question', url: './index.html' });
    assert.equal(K.tiklamaHedefi({ tur: K.TUR.SURE_GIRIS, examId: 'E1' }).step, 'input');
    // Eski (türsüz) bildirimler: yalnızca açık action pencere açar; bu sabahki hatırlatma biçimi açmaz
    assert.equal(K.tiklamaHedefi({ url: 'https://site/', examId: 'E1' }).sureEkrani, false);
    assert.equal(K.tiklamaHedefi({ action: 'verify_duration', examId: 'E1' }).sureEkrani, true);
    assert.equal(K.tiklamaHedefi({ action: 'input_duration', examId: 'E1' }).step, 'input');
    assert.equal(K.tiklamaHedefi(null).sureEkrani, false);
});

// ---------------------------------------------------------------- zaman yolculuğu
test('Zaman yolculuğu: süre teyidi HİÇBİR ZAMAN sınav bitmeden gönderilmez', () => {
    const db = buildDB();
    const olaylar = simulate(Object.assign({ onTick: onayE5 }, HAFTA));
    const sure = olaylar.filter(o => o.tur === K.TUR.SURE_SORU);
    assert.ok(sure.length > 0);
    for (const o of sure) {
        for (const id of o.sinavlar) {
            const ex = db.exams.find(e => e.id === id);
            assert.ok(o.now >= K.sinavBitis(ex) + K.AYAR.SURE_GECIKME_MS, `${id} için süre teyidi ${tr(o.now)}'da, sınav bitişi ${tr(K.sinavBitis(ex))}`);
        }
    }
});

test('Zaman yolculuğu: her bildirimin dokunma davranışı türüyle tutarlı', () => {
    const olaylar = simulate(Object.assign({ onTick: onayE5 }, HAFTA));
    assert.ok(olaylar.length > 10);
    for (const o of olaylar) {
        assert.ok(Object.values(K.TUR).includes(o.payload.data.tur), `türü açıkça yazılmalı: ${JSON.stringify(o.payload.data)}`);
        const hedef = K.tiklamaHedefi(o.payload.data);
        assert.equal(hedef.sureEkrani, o.tur === K.TUR.SURE_SORU, `${o.tur} (${tr(o.now)}) dokununca süre penceresi ${hedef.sureEkrani ? 'açıyor' : 'açmıyor'}`);
    }
});

test('Zaman yolculuğu: bu sabahki an (9 Kasım 09:03) yalnızca "Yarın göreviniz var" gönderir', () => {
    const db = buildDB();
    const plan = K.planla(db, T('2026-11-09T09:03:00+03:00'), { durum: {} });
    // 10 Kasım sınavları için "yarın", 12 Kasım sınavı için "3 gün sonra"; süre teyidi yok
    assert.deepEqual(plan.map(p => `${p.tur}:${p.pid}:${p.gun}`).sort(), ['hatirlatma_gun:1:1', 'hatirlatma_gun:2:1', 'hatirlatma_gun:4:3']);
    for (const p of plan) assert.equal(K.tiklamaHedefi(p.payload.data).sureEkrani, false);
});

test('Zaman yolculuğu: 3 gün ve 1 gün hatırlatmaları sabah 09:00\'da, bir kez, aynı gün birleşik', () => {
    const olaylar = simulate(HAFTA).filter(o => o.tur === K.TUR.GUN);
    const p1 = olaylar.filter(o => o.pid === '1');
    assert.deepEqual(p1.map(o => [tr(o.now), o.gun, o.sinavlar.sort().join('+')]), [
        ['2026-11-07 09:00', 3, 'E1+E2'],
        ['2026-11-09 09:00', 1, 'E1+E2']
    ]);
    assert.match(p1[1].payload.body, /2 görev — 09:00-11:00 MATH 101 - Deneme · 13:30 MATH 432 - Deneme/);
    assert.equal(p1[1].payload.title, '📅 Yarın göreviniz var');
    const p2 = olaylar.filter(o => o.pid === '2');
    assert.deepEqual(p2.map(o => [tr(o.now), o.gun, o.sinavlar.join('+')]), [['2026-11-07 09:00', 3, 'E1'], ['2026-11-09 09:00', 1, 'E1']]);
    for (const o of olaylar) {
        const h = K.trSaat(o.now);
        assert.ok(h >= 9 && h < 21, `sessiz saatte gün hatırlatması: ${tr(o.now)}`);
    }
});

test('Zaman yolculuğu: 2 saat kala hatırlatması doğru anda (aralık yazılmış saat dahil), bir kez', () => {
    const olaylar = simulate(HAFTA).filter(o => o.tur === K.TUR.SAAT);
    const ozet = olaylar.map(o => `${o.pid}:${o.sinavlar[0]}@${tr(o.now)}`).sort();
    assert.deepEqual(ozet, [
        '1:E1@2026-11-10 11:30',
        '1:E2@2026-11-10 07:00',
        '2:E1@2026-11-10 11:30',
        '3:E4@2026-11-08 08:00',     // süre onayı, sınav öncesi hatırlatmayı etkilemez
        '4:E5@2026-11-12 15:30'
    ]);
    assert.equal(olaylar.find(o => o.sinavlar[0] === 'E2').payload.title, '⏰ MATH 101 - Deneme 2 saat sonra başlıyor');
});

test('Zaman yolculuğu: süre teyidi bitişten 15 dk sonra, 24 saat sonra en fazla bir kez daha', () => {
    const olaylar = simulate(Object.assign({ onTick: onayE5 }, HAFTA)).filter(o => o.tur === K.TUR.SURE_SORU);
    const ozet = olaylar.map(o => `${o.pid}:${o.sinavlar.join('+')}@${tr(o.now)}`);
    assert.deepEqual(ozet, [
        '1:E2@2026-11-10 10:45',
        '1:E1@2026-11-10 15:45',
        '2:E1@2026-11-10 15:45',
        '1:E2@2026-11-11 10:45',
        '1:E1@2026-11-11 15:45',
        '2:E1@2026-11-11 15:45',
        '4:E5@2026-11-12 19:15'      // E5 13 Kasım 00:00'da onaylandı → ikinci hatırlatma yok
    ]);
});

test('Zaman yolculuğu: sınır öncesi ve onaylı sınavlar için süre teyidi yok', () => {
    const olaylar = simulate({ from: '2026-10-29T00:00:00+03:00', to: '2026-11-12T00:00:00+03:00' });
    const ids = new Set(olaylar.filter(o => o.tur === K.TUR.SURE_SORU).flatMap(o => o.sinavlar));
    assert.ok(!ids.has('E3'));
    assert.ok(!ids.has('E4'));
});

test('Site ve sunucu aynı etiketi üretir (aynı cihazda iki kez çıkmaz)', () => {
    const sunucu = simulate(HAFTA).filter(o => o.tur !== K.TUR.SURE_SORU && o.pid === '1');
    const site = simulate(Object.assign({ opts: { kisiler: ['1'], turler: [K.TUR.GUN, K.TUR.SAAT], siteUrl: './index.html' } }, HAFTA));
    assert.deepEqual(site.map(o => [o.now, o.payload.tag, o.payload.title, o.payload.body]), sunucu.map(o => [o.now, o.payload.tag, o.payload.title, o.payload.body]));
});

// ---------------------------------------------------------------- GitHub görevi (gerçek betik, deneme modu)
function runServer(nowIso, extraDb) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bildirim-'));
    const db = Object.assign(buildDB(), extraDb || {});
    fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(db));
    const env = Object.assign({}, process.env, {
        DB_FILE: path.join(dir, 'db.json'), STATE_FILE: path.join(dir, 'durum.json'),
        NOW: nowIso, PLAN_JSON: '1', VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', DRY_RUN: '1'
    });
    const out = execFileSync(process.execPath, [path.join(ROOT, '.github', 'scripts', 'sure-hatirlatma.mjs')], { env, cwd: ROOT }).toString();
    const line = out.split('\n').find(l => l.startsWith('PLAN '));
    return { out, plan: JSON.parse(line.slice(5)), stateWritten: fs.existsSync(path.join(dir, 'durum.json')) };
}

test('GitHub görevi: bu sabah 09:03\'te yalnızca gün hatırlatması planlar, süre teyidi yok', () => {
    const r = runServer('2026-11-09T09:03:00+03:00');
    assert.deepEqual(r.plan.map(p => `${p.tur}:${p.pid}:${p.sinavlar.slice().sort().join('+')}`).sort(),
        ['hatirlatma_gun:1:E1+E2', 'hatirlatma_gun:2:E1', 'hatirlatma_gun:4:E5']);
    for (const p of r.plan) {
        assert.equal(p.data.tur, 'hatirlatma_gun');
        assert.equal(K.tiklamaHedefi(p.data).sureEkrani, false);
    }
    assert.equal(r.stateWritten, false, 'deneme modunda kayıt yazılmaz');
    assert.match(r.out, /\[Deneme modu\]/);
});

test('GitHub görevi: sınav bittikten sonra süre teyidi planlar ve dokununca pencere açılır', () => {
    const r = runServer('2026-11-10T15:50:00+03:00');
    const sure = r.plan.filter(p => p.tur === 'sure_teyidi');
    assert.deepEqual(sure.map(p => `${p.pid}:${p.sinavlar.join('+')}`).sort(), ['1:E2+E1', '2:E1']);
    for (const p of sure) {
        const h = K.tiklamaHedefi(p.data);
        assert.equal(h.sureEkrani, true);
        assert.equal(h.step, 'question');
        assert.equal(p.data.action, 'verify_duration', 'eski service worker uyumluluğu');
    }
});

test('GitHub görevi: sınav sürerken (14:00) süre teyidi yok', () => {
    const r = runServer('2026-11-10T14:00:00+03:00');
    assert.ok(!r.plan.some(p => p.tur === 'sure_teyidi' && p.sinavlar.includes('E1')));
});
