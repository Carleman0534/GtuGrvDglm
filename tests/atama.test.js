/**
 * Ek atama uygunluk kontrolleri (atama_destek.js) testleri.
 * Gerçek tanımlar yerine sahte isimlerle geçici tanım kullanılır (_testTanim).
 *   - TestA ve TestB aynı derslikte birlikte görevlendirilmez
 *   - TestC, ders sorumlusu "Hoca Üç" olan sınavlara önerilmez
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');
const { NOW, buildFixture } = require('./fixture');

const A = 1, B = 2, C = 3;   // fixture: TestA, TestB, TestC

function freshApp(mutate) {
    const app = createApp({ now: NOW });
    const fx = buildFixture();
    if (mutate) mutate(fx);
    app.setDB(fx);
    app.raw(`AtamaDestek._testTanim([['Arş. Gör. TestA Kişi', 'Arş. Gör. TestB Kişi']], [['TestC Kişi', 'Prof. Dr. Hoca Üç']])`);
    return app;
}
const uygun = (app, staffId, ctx, opts) => app.run(`AtamaDestek.uygunMu(${staffId}, ${JSON.stringify(ctx)}, ${JSON.stringify(opts || {})})`);
const ex = (o) => Object.assign({ id: 5000, date: '2026-12-10', time: '10:00', duration: 120, type: 'Vize', name: 'MATH 999 - Deneme', location: 'D-201', lecturer: 'Dr. Başka Hoca', proctorIds: [] }, o);

test('Gerçek tanımlar yüklü (isimler dosyada açık metin olarak yok)', () => {
    const app = createApp({ now: NOW });
    assert.deepEqual(app.run('AtamaDestek._sayi()'), { p: 1, l: 1 });
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'atama_destek.js'), 'utf8');
    assert.ok(!/[A-ZÇĞİÖŞÜ][a-zçğıöşü]+ [A-ZÇĞİÖŞÜ]{3,}/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'dosyada kişi adı geçmemeli');
});

test('İsim yazım farkları aynı sonucu verir', () => {
    const app = createApp({ now: NOW });
    const h = (s) => app.run(`AtamaDestek._h(${JSON.stringify(s)})`);
    assert.equal(h('Prof. Dr. Hoca Üç'), h('HOCA ÜÇ'));
    assert.equal(h('Prof.Dr. Hoca Üç'), h('ÜÇ Hoca'));
    assert.equal(h('Arş. Gör. TestA Kişi'), h('TestA KİŞİ'));
    assert.notEqual(h('TestA Kişi'), h('TestB Kişi'));
});

// ---------------------------------------------------------------- birlikte görevlendirme
test('Aynı sınav satırında (aynı derslik) eşleşen kişi varsa uygun değil', () => {
    const app = freshApp();
    assert.equal(uygun(app, A, ex({ proctorIds: [B] })), false);
    assert.equal(uygun(app, B, ex({ proctorIds: [A, 5] })), false);
    assert.equal(uygun(app, A, ex({ proctorIds: [5, 6] })), true);
});

test('Birlikte atanmakta olan kişiler (ekler) de hesaba katılır', () => {
    const app = freshApp();
    assert.equal(uygun(app, A, ex(), { ekler: [B] }), false);
    assert.equal(uygun(app, A, ex(), { ekler: [7] }), true);
});

test('Görevden ayrılacak eşleşen kişi engel olmaz', () => {
    const app = freshApp();
    assert.equal(uygun(app, A, ex({ proctorIds: [B, 5] }), { ayrilan: [B] }), true);
});

test('Aynı saatte aynı derslikteki başka satır engeller; farklı derslik veya saat engellemez', () => {
    const app = freshApp(fx => {
        fx.exams.push(ex({ id: 6001, location: 'D-201', proctorIds: [B] }));            // aynı derslik, aynı saat
        fx.exams.push(ex({ id: 6002, location: 'D-202', time: '10:00', proctorIds: [B] })); // farklı derslik
        fx.exams.push(ex({ id: 6003, date: '2026-12-11', location: 'D-301', time: '10:00', proctorIds: [B] }));
    });
    assert.equal(uygun(app, A, ex({ id: 7001, location: 'D-201' })), false, 'aynı derslik + çakışan saat');
    assert.equal(uygun(app, A, ex({ id: 7002, location: 'd 201' })), false, 'derslik yazım farkı');
    assert.equal(uygun(app, A, ex({ id: 7003, location: 'D-205' })), true, 'başka derslik');
    assert.equal(uygun(app, A, ex({ id: 7004, location: 'D-201', time: '14:00' })), true, 'başka saat');
    assert.equal(uygun(app, A, ex({ id: 7005, date: '2026-12-11', location: 'D-301', time: '13:00' })), true, 'saatler çakışmıyor');
    assert.equal(uygun(app, A, ex({ id: 7006, location: '-' })), true, 'derslik belirsizse yalnızca aynı satır kontrol edilir');
});

test('Eşleşmesi olmayan kişiler etkilenmez', () => {
    const app = freshApp();
    assert.equal(uygun(app, 5, ex({ proctorIds: [A, B] })), true);
});

// ---------------------------------------------------------------- ders sorumlusu
test('Ders sorumlusu eşleşirse uygun değil (unvan ve yazım farkıyla)', () => {
    const app = freshApp();
    assert.equal(uygun(app, C, ex({ lecturer: 'Prof. Dr. Hoca Üç' })), false);
    assert.equal(uygun(app, C, ex({ lecturer: 'HOCA ÜÇ' })), false);
    assert.equal(uygun(app, C, ex({ lecturer: 'Dr. Başka Hoca / Prof. Dr. Hoca Üç' })), false, 'çoklu sorumlu');
    assert.equal(uygun(app, C, ex({ lecturer: 'Dr. Başka Hoca' })), true);
    assert.equal(uygun(app, A, ex({ lecturer: 'Prof. Dr. Hoca Üç' })), true, 'kural yalnızca ilgili kişiye uygulanır');
});

// ---------------------------------------------------------------- atama akışları
test('findBestProctor: en düşük puanlı aday eşleşen kişiyse onu atlar', () => {
    const app = freshApp();
    // B'yi açık ara en düşük puanlı yap; A'nın bulunduğu sınava aday aranıyor
    app.raw(`DB.staff.forEach(s => { s.totalScore = 5000; s.taskCount = 1; }); DB.staff.find(s => s.id === ${B}).totalScore = 10;`);
    const ctx = ex({ id: 8001, proctorIds: [A] });
    const free = app.run(`findBestProctor('${ctx.date}', '${ctx.time}', ${ctx.duration}).id`);
    assert.equal(free, B, 'bilgi verilmeden (manuel akış) eski davranış aynen sürer');
    const best = app.run(`findBestProctor('${ctx.date}', '${ctx.time}', ${ctx.duration}, null, false, '', ${JSON.stringify(ctx)}).id`);
    assert.notEqual(best, B);
});

test('findBestProctor: kayıtlı sınav id\'si verilince bilgi kayıttan alınır', () => {
    const app = freshApp(fx => fx.exams.push(ex({ id: 8101, proctorIds: [A] })));
    app.raw(`DB.staff.forEach(s => { s.totalScore = 5000; s.taskCount = 1; }); DB.staff.find(s => s.id === ${B}).totalScore = 10;`);
    assert.notEqual(app.run(`findBestProctor('2026-12-10', '10:00', 120, 8101).id`), B);
});

test('getRecommendedProctors: ders sorumlusu kuralı öneri listesine uygulanır', () => {
    const app = freshApp();
    app.raw(`DB.staff.forEach(s => { s.totalScore = 5000; }); DB.staff.find(s => s.id === ${C}).totalScore = 1;`);
    const ctx = ex({ id: 8201, lecturer: 'Prof. Dr. Hoca Üç' });
    const recs = app.run(`getRecommendedProctors('${ctx.date}', '${ctx.time}', ${ctx.duration}, null, false, '', ${JSON.stringify(ctx)}).map(s => s.id)`);
    assert.ok(recs.length > 0);
    assert.ok(!recs.includes(C));
    const recsOther = app.run(`getRecommendedProctors('${ctx.date}', '${ctx.time}', ${ctx.duration}, null, false, '', ${JSON.stringify(ex({ id: 8202 }))}).map(s => s.id)`);
    assert.equal(recsOther[0], C, 'başka hocanın sınavında normal şekilde önerilir');
});

test('runGlobalOptimization: gözetmensiz sınava kural dışı kişi atanmaz', () => {
    const app = freshApp(fx => fx.exams.push(ex({ id: 8301, lecturer: 'Prof. Dr. Hoca Üç', proctorIds: [], proctorId: null })));
    app.raw(`DB.staff.forEach(s => { s.totalScore = 5000; }); DB.staff.find(s => s.id === ${C}).totalScore = 1;`);
    app.raw('runGlobalOptimization()');
    const got = app.run('DB.exams.find(e => e.id === 8301).proctorIds');
    assert.equal(got.length, 1);
    assert.notEqual(got[0], C);
});

test('addExam: otomatik seçilen gözetmen kurala uyar', () => {
    const app = freshApp();
    app.raw(`DB.staff.forEach(s => { s.totalScore = 5000; s.taskCount = 1; }); DB.staff.find(s => s.id === ${C}).totalScore = 1;`);
    const created = app.run(`addExam(${JSON.stringify({ date: '2026-12-15', time: '10:00', duration: 90, name: 'MATH 998', lecturer: 'Prof. Dr. Hoca Üç', location: 'D-110' })}, true, true)`);
    assert.ok(created && created.proctorIds.length === 1);
    assert.notEqual(created.proctorIds[0], C);
});

test('Adalet Simülatörü: öneriler eşleşen kişileri aynı satırda buluşturmaz', () => {
    // A ve B'yi aynı derslikteki gelecek sınavlara yakın yerleştir; simülatör ne önerirse önersin kural bozulmamalı
    const app = freshApp(fx => {
        fx.exams.push(ex({ id: 8401, date: '2026-12-01', proctorIds: [A, 9], location: 'D-401' }));
        fx.exams.push(ex({ id: 8402, date: '2026-12-02', proctorIds: [B, 10], location: 'D-402' }));
    });
    for (const mode of ['exam', 'all']) {
        const acts = app.run(`simulateFairnessOptimization(15, '${mode}').suggestedActions`);
        const db = app.getDB();
        const move = (id, from, to) => { const e = db.exams.find(x => String(x.id) === String(id)); e.proctorIds = (e.proctorIds && e.proctorIds.length ? e.proctorIds : [e.proctorId]).map(p => (String(p) === String(from) ? to : p)); };
        acts.forEach(a => { if (a.type === 'transfer') move(a.examId, a.fromStaff.id, a.toStaff.id); else { move(a.examFromA.id, a.staffA.id, a.staffB.id); move(a.examFromB.id, a.staffB.id, a.staffA.id); } });
        const touched = new Set(acts.flatMap(a => (a.type === 'transfer' ? [a.examId] : [a.examFromA.id, a.examFromB.id])).map(String));
        db.exams.filter(e => touched.has(String(e.id))).forEach(e => {
            const ids = (e.proctorIds || []).map(Number);
            assert.ok(!(ids.includes(A) && ids.includes(B)), `${mode}: ${e.name} satırında eşleşen iki kişi birlikte`);
        });
    }
});

test('Hata durumunda atamayı engellemez (güvenli varsayılan)', () => {
    const app = freshApp();
    assert.equal(app.run('AtamaDestek.uygunMu(null, {})'), true);
    assert.equal(app.run('AtamaDestek.uygunMu(1, null)'), true);
    assert.equal(app.run('AtamaDestek.uygunMu(99999, { proctorIds: [2] })'), true);
});
