/**
 * "Yapay Zeka Dağıtım & Adalet Simülatörü" (logic.js) testleri.
 * Çalıştırma:  node --test tests/
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');
const { NOW, buildFixture } = require('./fixture');

function freshApp(mutate) {
    const app = createApp({ now: NOW });
    const fx = buildFixture();
    if (mutate) mutate(fx);
    app.setDB(fx);
    return app;
}

/** Önerileri DB kopyasına uygular ve puanları bağımsız olarak baştan hesaplar. */
function applyAndRescore(app, actions, mode) {
    const db = app.getDB();
    const isNon = (e) => app.run(`shouldCountAsNonExam(${JSON.stringify(e)})`);
    const move = (exId, from, to) => {
        const e = db.exams.find(x => String(x.id) === String(exId));
        assert.ok(e, 'önerilen sınav bulunmalı');
        const ids = (e.proctorIds && e.proctorIds.length) ? e.proctorIds : [e.proctorId];
        assert.ok(ids.map(String).includes(String(from)), `devreden (${from}) sınavda olmalı`);
        assert.ok(!ids.map(String).includes(String(to)), `devralan (${to}) zaten sınavda olmamalı`);
        e.proctorIds = ids.map(p => (String(p) === String(from) ? to : p));
        if (String(e.proctorId) === String(from)) e.proctorId = to;
    };
    for (const a of actions) {
        if (a.type === 'transfer') move(a.examId, a.fromStaff.id, a.toStaff.id);
        else { move(a.examFromA.id, a.staffA.id, a.staffB.id); move(a.examFromB.id, a.staffB.id, a.staffA.id); }
    }
    const sc = {};
    db.staff.forEach(s => { sc[s.id] = { ex: s.baseScore || 0, non: 0 }; });
    db.exams.forEach(e => {
        const ids = new Set([...(e.proctorIds || []), e.proctorId].filter(x => x != null).map(String));
        ids.forEach(id => { if (sc[id]) { if (isNon(e)) sc[id].non += e.score || 0; else sc[id].ex += e.score || 0; } });
    });
    const pool = app.run('getActiveProctorStaff(DB.staff).map(s => s.id)');
    const vals = pool.map(id => (mode === 'exam' ? sc[id].ex : mode === 'non_exam' ? sc[id].non : sc[id].ex + sc[id].non));
    return { db, vals };
}

const range = (a) => Math.max(...a) - Math.min(...a);
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// ---------------------------------------------------------------- Temel fonksiyonlar
test('window.DB her zaman güncel DB\'yi gösterir (eski veri hatası regresyonu)', () => {
    const app = freshApp();
    assert.equal(app.run('window.DB === DB'), true);
    app.raw('DB = { staff: [{ id: 1, name: "X" }], exams: [] }');
    assert.equal(app.run('window.DB.staff.length'), 1);
    app.raw('window.DB = { staff: [], exams: [{ id: 5 }] }');
    assert.equal(app.run('DB.exams[0].id'), 5);
});

test('calculateGiniCoefficient: bilinen değerler', () => {
    const app = freshApp();
    assert.equal(app.run('calculateGiniCoefficient([5, 5, 5, 5])'), 0);
    assert.equal(app.run('calculateGiniCoefficient([0, 0, 1])'), 0.6667);
    assert.equal(app.run('calculateGiniCoefficient([])'), 0);
});

test('getActiveProctorStaff: "Arş. Gör." eşleşir, gözetmenlik almayan hocalar hariç', () => {
    const app = freshApp();
    assert.equal(app.run('getActiveProctorStaff([{ name: "Arş. Gör. Ali" }, { name: "Prof. Dr. Veli" }]).length'), 1);
    assert.equal(app.run('getActiveProctorStaff([{ name: "Araş.Gör. Ayşe" }, { name: "Doç. Dr. X" }]).length'), 1);
    const ids = app.run('getActiveProctorStaff(DB.staff).map(s => s.id)');
    assert.equal(ids.length, 12);
    assert.ok(!ids.includes(20) && !ids.includes(21));
});

test('calculateFairnessMetrics: modlar doğru puan alanını kullanır', () => {
    const app = freshApp();
    const db = app.getDB();
    const pool = db.staff.filter(s => s.id <= 12);
    const m = (mode) => app.run(`calculateFairnessMetrics(DB.staff, '${mode}')`);
    assert.ok(Math.abs(m('exam').avg - avg(pool.map(s => s.totalScore))) < 0.01);
    assert.ok(Math.abs(m('non_exam').avg - avg(pool.map(s => s.nonExamScore || 0))) < 0.01);
    assert.ok(Math.abs(m('all').avg - avg(pool.map(s => s.totalScore + (s.nonExamScore || 0)))) < 0.01);
});

// ---------------------------------------------------------------- Simülasyon
for (const mode of ['exam', 'non_exam', 'all']) {
    test(`Simülasyon (${mode}): iddia edilen sonuç, öneriler uygulanınca gerçekleşen sonuçla aynı`, () => {
        const app = freshApp();
        const r = app.run(`simulateFairnessOptimization(10, '${mode}')`);
        assert.ok(r.before.count > 0, 'simülatör gerçek veriyi görmeli (boş DB değil)');
        const { vals } = applyAndRescore(app, r.suggestedActions, mode);
        assert.ok(Math.abs(avg(vals) - r.before.avg) < 0.01, 'toplam puan korunmalı (ortalama değişmemeli)');
        assert.ok(Math.abs(r.after.avg - r.before.avg) < 0.01, 'simülatörün kendi ortalaması da değişmemeli');
        assert.ok(Math.abs(range(vals) - r.after.scoreRange) < 0.05, `makas: iddia ${r.after.scoreRange}, gerçek ${range(vals)}`);
        assert.equal(app.run(`calculateGiniCoefficient(${JSON.stringify(vals)})`), r.after.gini);
        assert.ok(r.after.gini <= r.before.gini, 'adalet kötüleşmemeli');
    });
}

test('Simülasyon (exam): test verisinde gerçekten öneri üretir ve makası daraltır', () => {
    const r = freshApp().run(`simulateFairnessOptimization(10, 'exam')`);
    assert.ok(r.suggestedActions.length > 0);
    assert.ok(r.after.scoreRange < r.before.scoreRange);
});

test('Simülasyon: geçmiş sınavlar devredilmez, yeni çakışma oluşmaz', () => {
    const app = freshApp();
    const today = '2026-11-08';
    for (const mode of ['exam', 'all']) {
        const r = app.run(`simulateFairnessOptimization(10, '${mode}')`);
        const { db } = applyAndRescore(app, r.suggestedActions, mode);
        const exIds = r.suggestedActions.flatMap(a => (a.type === 'transfer' ? [a.examId] : [a.examFromA.id, a.examFromB.id]));
        exIds.forEach(id => {
            const e = db.exams.find(x => String(x.id) === String(id));
            assert.ok(e.date >= today, `geçmiş sınav (${e.date}) devredilmemeli`);
        });
        // Etkilenen gözetmenlerin aynı gündeki sınavları 15 dk tamponla çakışmamalı
        const start = (e) => { const [h, m] = e.time.split(':').map(Number); const [y, mo, d] = e.date.split('-').map(Number); return new Date(y, mo - 1, d, h, m).getTime(); };
        const touched = new Set(r.suggestedActions.flatMap(a => (a.type === 'transfer' ? [a.toStaff.id] : [a.staffA.id, a.staffB.id])).map(String));
        touched.forEach(sid => {
            const mine = db.exams.filter(e => e.date >= today && new Set([...(e.proctorIds || []), e.proctorId].map(String)).has(sid)).sort((a, b) => start(a) - start(b));
            for (let i = 1; i < mine.length; i++) {
                const prevEnd = start(mine[i - 1]) + ((parseInt(mine[i - 1].duration, 10) || 60) + 15) * 60000;
                assert.ok(start(mine[i]) >= prevEnd, `gözetmen ${sid}: ${mine[i - 1].name} ile ${mine[i].name} çakışıyor`);
            }
        });
    }
});

test('Simülasyon: müsaitlik kısıtı olan kişiye görev önerilmez', () => {
    const app = freshApp();
    // Kısıtsız çalıştırmada görev ALAN ilk kişiyi bul
    const free = app.run(`simulateFairnessOptimization(10, 'exam').suggestedActions`);
    const receiverOf = (a) => (a.type === 'transfer' ? a.toStaff.id : a.staffB.id);
    assert.ok(free.length > 0);
    const target = receiverOf(free[0]);
    const name = app.run(`DB.staff.find(s => s.id === ${target}).name`);

    // Bu kişiye dönem sonuna kadar tam gün izin tanımla
    app.raw(`DB.constraints = ${JSON.stringify({ [name]: [{ startDate: '2026-11-01', endDate: '2027-02-28', allDay: true, reason: 'izin' }] })}`);
    assert.equal(app.run(`isAvailable(${JSON.stringify(name)}, '2026-11-20', '10:00', 90)`), false, 'kısıt tanınmalı');

    const r = app.run(`simulateFairnessOptimization(10, 'exam').suggestedActions`);
    const gotTask = r.some(a => (a.type === 'transfer' && a.toStaff.id === target)
        || (a.type === 'bilateral_swap' && (a.staffA.id === target || a.staffB.id === target)));
    assert.ok(!gotTask, `kısıtlı gözetmen (${target}) görev almamalı`);
});

test('Simülasyon: DB boşsa güvenli boş sonuç döner', () => {
    const app = freshApp();
    app.raw('DB = { staff: [], exams: [] }');
    const r = app.run(`simulateFairnessOptimization(10, 'exam')`);
    assert.equal(r.suggestedActions.length, 0);
    assert.equal(r.before.fairnessScore, 100);
});
