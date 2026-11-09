/**
 * Parça parça gelen sınavlar: dönem sonu hedefli atama ve taslak paket dengeleme.
 * Çalıştırma: node --test tests/paket.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');
const { NOW, buildFixture } = require('./fixture');

const ALL_DAY = (days) => days.map(day => ({ day, allDay: true }));
const NAME = (i) => `Arş. Gör. Test${String.fromCharCode(65 + i)} Kişi`; // id = i + 1

function freshApp(mutate) {
    const app = createApp({ now: NOW });
    const fx = buildFixture();
    // Öğretim üyeleri (id 20, 21) gözetmen havuzunda değil; atama testlerinde aday olmasınlar
    fx.constraints['Prof. Dr. Hoca Bir'] = ALL_DAY([0, 1, 2, 3, 4, 5, 6]);
    fx.constraints['Doç. Dr. Hoca İki'] = ALL_DAY([0, 1, 2, 3, 4, 5, 6]);
    if (mutate) mutate(fx);
    app.setDB(fx);
    app.raw('recalculateAllScores();');
    return app;
}

test('Beklenen pay: kısıtlar sınırlayıcı değilse herkese eşit; çok kısıtlı kişinin payı daha az', () => {
    // Hafif kısıt (yalnızca Pazartesi): kapasite yeterli → eşit pay, eski sıralama korunur
    const hafif = freshApp(fx => { fx.constraints[NAME(0)] = ALL_DAY([1]); }).run('getFutureBalanceMap()');
    assert.ok(hafif['2'].beklenen > 0, 'kalan dönem yükü (tahmini Güz finalleri) pozitif');
    assert.ok(Math.abs(hafif['1'].beklenen - hafif['2'].beklenen) < 1e-6, 'sınırlayıcı olmayan kısıt payı düşürmez');
    assert.equal(hafif['1'].kisitli, false);

    // Ağır kısıt (yalnızca Cumartesi müsait): kapasite adil payın altında
    const m = freshApp(fx => { fx.constraints[NAME(0)] = ALL_DAY([0, 1, 2, 3, 4, 5]); }).run('getFutureBalanceMap()');
    assert.equal(m['2'].oran, 1);
    assert.ok(Math.abs(m['2'].beklenen - m['3'].beklenen) < 1e-6, 'eşit müsait → eşit pay');
    assert.ok(m['1'].oran < 0.2);
    assert.ok(m['1'].beklenen < m['2'].beklenen);
    assert.equal(m['1'].kisitli, true);
    assert.equal(m['2'].kisitli, false);
});

test('Atama: kalan dönemde az müsait kişi, puanı biraz yüksek olsa da müsait olduğu sınavda öne geçer', () => {
    const app = freshApp(fx => {
        fx.constraints[NAME(0)] = ALL_DAY([0, 1, 2, 3, 4, 5]);           // A: yalnızca Cumartesi müsait
        for (let i = 2; i < 12; i++) fx.constraints[NAME(i)] = ALL_DAY([6]); // C..L: Cumartesi müsait değil
    });
    // A, B'den 50 puan önde; Cumartesi sınavında yalnızca A ve B müsait
    app.raw(`const A = DB.staff.find(s => s.id === 1), B = DB.staff.find(s => s.id === 2);
             A.totalScore = 2950; B.totalScore = 2900; A.taskCount = 3; B.taskCount = 3;`);
    const saturday = '2026-11-28';
    const best = app.run(`findBestProctor('${saturday}', '10:00', 90).id`);
    assert.equal(best, 1, 'bugünkü puana göre B seçilirdi; dönem sonu beklentisine göre A seçilir');

    // A kısıtsızken eski davranış: düşük puanlı seçilir
    const app2 = freshApp(fx => { for (let i = 2; i < 12; i++) fx.constraints[NAME(i)] = ALL_DAY([6]); });
    app2.raw(`const A = DB.staff.find(s => s.id === 1), B = DB.staff.find(s => s.id === 2);
              A.totalScore = 2950; B.totalScore = 2900; A.taskCount = 3; B.taskCount = 3;`);
    assert.equal(app2.run(`findBestProctor('${saturday}', '10:00', 90).id`), 2);
});

function withDrafts(app, list) {
    app.raw(`${JSON.stringify(list)}.forEach((d, i) => DB.exams.push(Object.assign({ id: 7000 + i, type: 'Final', duration: 120, location: 'D-101', isDraft: true }, d)));
             recalculateAllScores();`);
}

test('Paket özeti: paketin kimi hedefe yaklaştırıp uzaklaştırdığını ve yığılmayı gösterir', () => {
    const app = freshApp();
    // En yüksek puanlı kişiye (L, id 12, taban 1800) 3 hafta sonu sınavı
    const top = app.run('[...DB.staff].filter(s => s.id <= 12).sort((a, b) => b.totalScore - a.totalScore)[0].id');
    withDrafts(app, [
        { name: 'F1', date: '2026-12-05', time: '10:00', proctorIds: [top], proctorId: top },
        { name: 'F2', date: '2026-12-06', time: '10:00', proctorIds: [top], proctorId: top },
        { name: 'F3', date: '2026-12-12', time: '10:00', proctorIds: [top], proctorId: top },
        { name: 'F4', date: '2026-12-14', time: '10:00', proctorIds: [] }
    ]);
    const r = app.run('analyzeDraftBatch()');
    assert.equal(r.taslakSayisi, 4);
    assert.equal(r.atanmamis, 1);
    const row = r.rows.find(x => x.id === top);
    assert.equal(row.paketGorev, 3);
    assert.equal(row.yon, 'uzaklasti');
    assert.ok(r.farkSonra > r.farkOnce);
    assert.ok(r.yigilma.some(y => y.yuksek === 3), 'hafta sonu sınavları tek kişide yığıldı');
});

test('Paket dengeleme: yalnızca taslaklar değişir, fark küçülür, kısıtlar korunur, geri alınabilir', () => {
    const app = freshApp(fx => { fx.constraints[NAME(1)] = ALL_DAY([1, 2, 3, 4, 5, 6, 0]); }); // B hiç müsait değil
    const top = app.run('[...DB.staff].filter(s => s.id <= 12).sort((a, b) => b.totalScore - a.totalScore)[0].id');
    withDrafts(app, [
        { name: 'P1', date: '2026-12-07', time: '09:30', proctorIds: [top], proctorId: top },
        { name: 'P2', date: '2026-12-08', time: '09:30', proctorIds: [top], proctorId: top },
        { name: 'P3', date: '2026-12-09', time: '09:30', proctorIds: [top], proctorId: top },
        { name: 'P4', date: '2026-12-10', time: '09:30', proctorIds: [top], proctorId: top }
    ]);
    const published = app.run('JSON.stringify(DB.exams.filter(e => !e.isDraft).map(e => [e.id, e.proctorIds]))');
    const before = app.run('analyzeDraftBatch()');

    app.raw('window.__snap = createSimulationSnapshot({});');
    const res = app.run('balanceDraftBatch()');
    app.raw('markSimulationApplied(window.__snap, {});');

    assert.ok(res.steps.length > 0);
    assert.ok(res.farkSonra < res.farkOnce, 'en yüksek–en düşük fark küçülür');
    assert.equal(app.run('JSON.stringify(DB.exams.filter(e => !e.isDraft).map(e => [e.id, e.proctorIds]))'), published, 'yayınlanmış görevler değişmez');
    assert.equal(app.run("DB.exams.filter(e => e.isDraft && (e.proctorIds || []).map(String).includes('2')).length"), 0, 'müsait olmayan kişiye görev verilmez');
    const after = app.run('analyzeDraftBatch()');
    assert.ok(after.farkSonra < before.farkSonra);

    const roll = app.run('rollbackSimulationSnapshot()');
    assert.equal(roll.success, true);
    assert.equal(app.run(`DB.exams.filter(e => e.isDraft && (e.proctorIds || []).map(String).includes('${top}')).length`), 4, 'geri alma taslakları eski haline döndürür');
});

test('Paket: tarihi geçmiş taslaklar pakete girmez ve dengelemede oynatılmaz', () => {
    const app = freshApp();
    const top = app.run('[...DB.staff].filter(s => s.id <= 12).sort((a, b) => b.totalScore - a.totalScore)[0].id');
    withDrafts(app, [
        { name: 'Eski1', date: '2026-10-05', time: '10:00', proctorIds: [top], proctorId: top },
        { name: 'Eski2', date: '2026-10-06', time: '10:00', proctorIds: [top], proctorId: top },
        { name: 'Yeni1', date: '2026-12-07', time: '09:30', proctorIds: [top], proctorId: top }
    ]);
    const r = app.run('analyzeDraftBatch()');
    assert.equal(r.taslakSayisi, 1);
    assert.equal(r.eskiTaslak, 2);
    app.run('balanceDraftBatch()');
    assert.equal(app.run(`DB.exams.filter(e => e.name.startsWith('Eski') && (e.proctorIds || []).map(String).includes('${top}')).length`), 2, 'geçmiş taslaklar değişmez');
});

test('Paket dengeleme: taslak yoksa hiçbir şey yapmaz', () => {
    const app = freshApp();
    const res = app.run('balanceDraftBatch()');
    assert.deepEqual(res.steps, []);
    assert.equal(app.run('analyzeDraftBatch().taslakSayisi'), 0);
});
