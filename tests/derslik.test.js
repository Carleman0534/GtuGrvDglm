/**
 * Çok derslikli sınavlar: gözetmen–derslik eşleştirmesi ve süre ortaklığı;
 * işlem geçmişinde gerçek rolün belirlenmesi.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createApp, ROOT } = require('./harness');
const { NOW, buildFixture } = require('./fixture');
const K = require(path.join(ROOT, 'bildirim_kurallari.js'));

const satir = (o) => Object.assign({ id: 1, name: 'MATH 432 - Deneme', date: '2026-11-10', time: '13:30', duration: 120, location: 'Derslik 1 / Derslik 3', proctorIds: [] }, o);
const ids = (list) => list.map(m => `${m.ex.id}:${m.pid}`).sort();

test('derslikler: konum yazısı dersliklere ayrılır', () => {
    assert.deepEqual(K.derslikler('Derslik 1 / Derslik 3'), ['Derslik 1', 'Derslik 3']);
    assert.deepEqual(K.derslikler('Merkez Amfi 1 / Merkez Amfi 2 / Merkez Amfi 2'), ['Merkez Amfi 1', 'Merkez Amfi 2'], 'tekrar edilen derslik bir kez');
    assert.deepEqual(K.derslikler('Z-10, Z-11; Z-12'), ['Z-10', 'Z-11', 'Z-12']);
    assert.deepEqual(K.derslikler('Uçak Mühendisliği'), ['Uçak Mühendisliği']);
    assert.deepEqual(K.derslikler('Belirtilmedi'), []);
    assert.deepEqual(K.derslikler('-'), []);
    assert.deepEqual(K.derslikler(satir({})), ['Derslik 1', 'Derslik 3']);
});

test('gozetmenDersligi: atanmış derslik, tek derslik, bilinmeyen', () => {
    const ex = satir({ proctorIds: [1, 2], gozetmenDersligi_1: 'derslik 3' });
    assert.equal(K.gozetmenDersligi(ex, 1), 'Derslik 3', 'yazım farkı tolere edilir, konumdaki yazım döner');
    assert.equal(K.gozetmenDersligi(ex, 2), null, 'çok derslikli satırda atanmamış → bilinmiyor');
    assert.equal(K.gozetmenDersligi(satir({ location: 'Amfi 2' }), 5), 'Amfi 2', 'tek derslik → herkes orada');
    assert.equal(K.gozetmenDersligi(satir({ gozetmenDersligi_1: 'Derslik 9' }), 1), null, 'konumda olmayan derslik geçersiz');
});

test('Aynı derslikteki gözetmenler: aynı satırda yalnızca aynı derslikler', () => {
    const ex = satir({ proctorIds: [1, 2, 3, 4], gozetmenDersligi_1: 'Derslik 1', gozetmenDersligi_2: 'Derslik 1', gozetmenDersligi_3: 'Derslik 3' });
    assert.deepEqual(ids(K.ayniDerslikGozetmenleri(ex, 1, [ex])), ['1:2'], 'A ile B aynı derslikte');
    assert.deepEqual(ids(K.ayniDerslikGozetmenleri(ex, 3, [ex])), [], 'C tek başına Derslik 3\'te');
    assert.deepEqual(ids(K.ayniDerslikGozetmenleri(ex, 4, [ex])), [], 'dersliği bilinmeyen → yalnızca kendisi');
});

test('Tek derslikli satırda tüm gözetmenler aynı derslikte (birinin girmesi yeterli)', () => {
    const ex = satir({ location: 'Amfi 2', proctorIds: [1, 2, 3] });
    assert.deepEqual(ids(K.ayniDerslikGozetmenleri(ex, 2, [ex])), ['1:1', '1:3']);
});

test('Aynı sınavın aynı saatteki başka satırı da aynı derslik sayılır; başka sınav sayılmaz', () => {
    const a = satir({ id: 1, location: 'Derslik 1 / Derslik 3', proctorIds: [1, 2], gozetmenDersligi_1: 'Derslik 1', gozetmenDersligi_2: 'Derslik 3' });
    const b = satir({ id: 2, location: 'Derslik 1', proctorIds: [5] });                               // aynı sınav, aynı saat, Derslik 1
    const c = satir({ id: 3, name: 'PHYS 113 - Başka', location: 'Derslik 1', proctorIds: [6] });     // başka sınav
    const d = satir({ id: 4, time: '17:30', location: 'Derslik 1', proctorIds: [7] });               // başka saat
    assert.deepEqual(ids(K.ayniDerslikGozetmenleri(a, 1, [a, b, c, d])), ['2:5']);
    assert.deepEqual(ids(K.ayniDerslikGozetmenleri(a, 2, [a, b, c, d])), []);
    assert.deepEqual(ids(K.ayniDerslikGozetmenleri(b, 5, [a, b, c, d])), ['1:1']);
});

test('Süre bildirimi: aynı derslikteki gözetmene yazılan süre onu da onaylı yapar, farklı derslikteki beklemeye devam eder', () => {
    const now = Date.parse('2026-11-10T16:00:00+03:00');
    const ex = satir({ proctorIds: [1, 2, 3], gozetmenDersligi_1: 'Derslik 1', gozetmenDersligi_2: 'Derslik 1', gozetmenDersligi_3: 'Derslik 3' });
    // 1 süre girdi → aynı derslikteki 2'ye de yazıldı (uygulama bunu böyle kaydeder)
    for (const m of [{ pid: 1 }].concat(K.ayniDerslikGozetmenleri(ex, 1, [ex]))) ex[K.sureAlani(m.pid)] = { sure: 100, onaylayan: 'G1', ortakGiris: m.pid !== 1 };
    assert.equal(K.sureTeyidiBekliyor(ex, now, 1), false);
    assert.equal(K.sureTeyidiBekliyor(ex, now, 2), false, 'aynı derslik: birinin girmesi yeterli');
    assert.equal(K.sureTeyidiBekliyor(ex, now, 3), true, 'farklı derslik: kendisi girmeli');
    const plan = K.planla({ exams: [ex] }, now, { durum: {} }).filter(p => p.tur === K.TUR.SURE_SORU);
    assert.deepEqual(plan.map(p => p.pid), ['3']);
});

// ---------------------------------------------------------------- işlem geçmişi
function appWith(session) {
    const app = createApp({ now: NOW });
    app.setDB(buildFixture());
    Object.entries(session.ss || {}).forEach(([k, v]) => app.storage.session.setItem(k, v));
    Object.entries(session.ls || {}).forEach(([k, v]) => app.storage.local.setItem(k, v));
    return app;
}
const lastLog = (app, cat) => { app.raw(`logAction(${JSON.stringify(cat)}, 'Deneme', 'ayrıntı')`); return app.run('DB.auditLogs[0]'); };

test('İşlem geçmişi: rol, kaydı yazan kodun kategorisinden değil oturumdan belirlenir', () => {
    let l = lastLog(appWith({ ss: { isAdmin: 'true' } }), 'user');
    assert.equal(l.rol, 'admin'); assert.equal(l.kisi, 'Yönetici');

    l = lastLog(appWith({ ls: { myStaffId: '3' } }), 'admin');
    assert.equal(l.rol, 'gozetmen'); assert.match(l.kisi, /TestC/);

    l = lastLog(appWith({ ss: { isLecturer: 'true' }, ls: { myLecturerName: 'Prof. Dr. Hoca Bir' } }), 'user');
    assert.equal(l.rol, 'hoca'); assert.equal(l.kisi, 'Prof. Dr. Hoca Bir');

    l = lastLog(appWith({ ss: { isAdmin: 'true' } }), 'system');
    assert.equal(l.rol, 'sistem', 'açıkça sistem işlemi');

    l = lastLog(appWith({}), 'user');
    assert.equal(l.rol, 'sistem', 'oturumsuz → sistem');
    assert.equal(l.category, 'user', 'eski kategori alanı korunur');
});
