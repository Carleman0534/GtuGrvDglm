/**
 * Gözetmen bazında sınav süresi testleri.
 * Aynı sınavda farklı dersliklerde görev yapan gözetmenlerin süreleri farklı olabilir:
 * bir gözetmenin girdiği süre diğerini değiştirmez.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createApp, ROOT } = require('./harness');
const { NOW, buildFixture } = require('./fixture');
const K = require(path.join(ROOT, 'bildirim_kurallari.js'));

const A = 1, B = 2;
// 6 Kasım 13:30, 120 dk, iki gözetmen, iki derslik (ekran görüntüsündeki durum)
const ORTAK = { id: 9900, name: 'MATH 432 - Deneme', date: '2026-11-06', time: '13:30', duration: 120, type: 'Vize', location: 'Derslik 1 / Derslik 3', proctorIds: [A, B], proctorId: A };

function freshApp(mutate) {
    const app = createApp({ now: NOW });
    const fx = buildFixture();
    fx.exams.push(JSON.parse(JSON.stringify(ORTAK)));
    if (mutate) mutate(fx);
    app.setDB(fx);
    return app;
}
const exOf = (app) => app.run('DB.exams.find(e => e.id === 9900)');
const staffOf = (app, id) => app.run(`DB.staff.find(s => s.id === ${id})`);
const score = (app, dateTime, dur) => app.run(`calculateScore(getSafeDate('${dateTime[0]}', '${dateTime[1]}'), ${dur}, 9900)`);

test('Gözetmenin puanı kendi süresinden hesaplanır; diğer gözetmen etkilenmez', () => {
    const app = freshApp();
    const aBefore = staffOf(app, A).totalScore, bBefore = staffOf(app, B).totalScore;
    const row = exOf(app).score;

    app.raw(`DB.exams.find(e => e.id === 9900).gozetmenSuresi_${A} = { sure: 90, onaylayan: 'A', onayZamani: '2026-11-06T16:00:00Z' }; recalculateAllScores();`);
    const s90 = score(app, ['2026-11-06', '13:30'], 90);
    assert.ok(s90 < row, 'kısa süre daha az puan');
    assert.ok(Math.abs(staffOf(app, A).totalScore - (aBefore - row + s90)) < 0.01, 'A kendi süresinden puan alır');
    assert.equal(staffOf(app, B).totalScore, bBefore, 'B değişmez');
    assert.equal(exOf(app).duration, 120, 'sınavın kendi süresi değişmez');
});

test('Gözetmen farklı başlangıç saati bildirirse puan o saate göre hesaplanır', () => {
    const app = freshApp();
    app.raw(`DB.exams.find(e => e.id === 9900).gozetmenSuresi_${B} = { sure: 120, saat: '17:30', onaylayan: 'B' }; recalculateAllScores();`);
    const ex = exOf(app);
    assert.equal(app.run(`getProctorExamTime(DB.exams.find(e => e.id === 9900), ${B})`), '17:30');
    assert.equal(app.run(`getProctorExamTime(DB.exams.find(e => e.id === 9900), ${A})`), '13:30');
    assert.equal(app.run(`getProctorExamScore(DB.exams.find(e => e.id === 9900), ${B})`), score(app, ['2026-11-06', '17:30'], 120));
    assert.equal(app.run(`getProctorExamScore(DB.exams.find(e => e.id === 9900), ${A})`), ex.score);
});

test('Biri onaylayınca diğerine süre teyidi sorulmaya devam edilir', () => {
    const now = Date.parse('2026-11-06T18:00:00+03:00');
    const ex = JSON.parse(JSON.stringify(ORTAK));
    assert.equal(K.sureTeyidiBekliyor(ex, now, A), true);
    assert.equal(K.sureTeyidiBekliyor(ex, now, B), true);
    ex[K.sureAlani(A)] = { sure: 120, onaylayan: 'A' };
    assert.equal(K.sureTeyidiBekliyor(ex, now, A), false, 'A onayladı');
    assert.equal(K.sureTeyidiBekliyor(ex, now, B), true, 'B hâlâ bekleniyor');
    // Sunucu planlayıcısı da yalnızca B'ye hatırlatır
    const plan = K.planla({ exams: [ex] }, now, { durum: {} }).filter(p => p.tur === K.TUR.SURE_SORU);
    assert.deepEqual(plan.map(p => p.pid), [String(B)]);
});

test('Ders hocası sınavı onaylarsa herkes onaylı sayılır; gözetmenin kendi süresi korunur', () => {
    const app = freshApp();
    app.raw(`const e = DB.exams.find(x => x.id === 9900); e.gozetmenSuresi_${A} = { sure: 90, onaylayan: 'A' };
             e.duration = 100; e.actualDuration = 100; e.lecturerVerified = true; e.durationConfirmed = true; recalculateAllScores();`);
    const ex = exOf(app);
    const now = Date.parse('2026-11-06T18:00:00+03:00');
    assert.equal(K.sureTeyidiBekliyor(ex, now, A), false);
    assert.equal(K.sureTeyidiBekliyor(ex, now, B), false);
    assert.equal(K.gozetmenSuresi(ex, A), 90, 'A kendi girdiği 90 dk');
    assert.equal(K.gozetmenSuresi(ex, B), 100, 'B hocanın onayladığı 100 dk');
});

test('Kayıt, sınav üzerinde gözetmen başına AYRI alanda tutulur', () => {
    assert.equal(K.sureAlani(12), 'gozetmenSuresi_12');
    const ex = { [K.sureAlani(12)]: { sure: 0 } };
    assert.equal(K.gozetmenSureKaydi(ex, 12), null, 'geçersiz süre yok sayılır');
    assert.equal(K.gozetmenSureKaydi({}, 12), null);
});

test('Veri birleştirme: iki gözetmenin farklı cihazlardan aynı anda girdiği süreler birbirini ezmez', () => {
    // veri_koruma.js'deki gerçek birleştirme fonksiyonları
    const src = fs.readFileSync(path.join(ROOT, 'veri_koruma.js'), 'utf8');
    const pick = (re) => { const m = src.match(re); assert.ok(m, 'bulunamadı: ' + re); return m[0]; };
    const code = [
        pick(/const same = [^\n]+/), pick(/const clone = [^\n]+/), pick(/const isPlainObj = [^\n]+/), pick(/const hasIds = [^\n]+/),
        pick(/function mergeObject\([\s\S]*?\n    }\n/), pick(/function mergeArray\([\s\S]*?\n    }\n/), pick(/function mergeDB\([\s\S]*?\n    }\n/),
        'this.mergeDB = mergeDB;'
    ].join('\n');
    const ctx = vm.createContext({});
    vm.runInContext(code, ctx);

    const base = { exams: [JSON.parse(JSON.stringify(ORTAK))] };
    // A'nın cihazı: kendi süresini girdi
    const local = JSON.parse(JSON.stringify(base));
    local.exams[0][K.sureAlani(A)] = { sure: 110, onaylayan: 'A' };
    // Bu arada sunucuya B'nin girdiği süre yazıldı
    const remote = JSON.parse(JSON.stringify(base));
    remote.exams[0][K.sureAlani(B)] = { sure: 95, onaylayan: 'B' };

    const merged = JSON.parse(JSON.stringify(ctx.mergeDB(base, local, remote)));
    const ex = merged.exams[0];
    assert.equal(K.gozetmenSuresi(ex, A), 110, 'A korunur');
    assert.equal(K.gozetmenSuresi(ex, B), 95, 'B korunur');
    assert.equal(ex.duration, 120, 'sınavın planlanan süresi değişmez');
});

test('Tahmin motoru tamamlanan görevlerde gözetmenin kendi süresini kullanır', () => {
    const app = freshApp();
    const before = app.run(`FinalForecastEngine.calculateForecastData().proctorForecasts.find(p => p.id === ${A}).pastExamDuration`);
    app.raw(`DB.exams.find(e => e.id === 9900).gozetmenSuresi_${A} = { sure: 60, onaylayan: 'A' }; recalculateAllScores();`);
    const after = app.run(`FinalForecastEngine.calculateForecastData().proctorForecasts.find(p => p.id === ${A}).pastExamDuration`);
    assert.equal(before - after, 60, '120 → 60 dk');
    const bDur = app.run(`FinalForecastEngine.calculateForecastData().proctorForecasts.find(p => p.id === ${B}).pastExamDuration`);
    const bDurFresh = freshApp().run(`FinalForecastEngine.calculateForecastData().proctorForecasts.find(p => p.id === ${B}).pastExamDuration`);
    assert.equal(bDur, bDurFresh, 'B etkilenmez');
});
