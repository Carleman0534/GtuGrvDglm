/**
 * Adalet simülatörü: geçmiş/başlamış sınavları önermez; öneriler bugünkü takvime göre geçerli (net) olur.
 * Çalıştırma: node --test tests/simulator_net.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');
const { NOW, buildFixture } = require('./fixture'); // NOW: 8 Kasım 2026 12:00

function freshApp(mutate) {
    const app = createApp({ now: NOW });
    const fx = buildFixture();
    if (mutate) mutate(fx);
    app.setDB(fx);
    app.raw('recalculateAllScores();');
    return app;
}
const pidsOf = (ex) => (Array.isArray(ex.proctorIds) && ex.proctorIds.length ? ex.proctorIds : (ex.proctorId != null ? [ex.proctorId] : [])).map(String);

// Puanı en yüksek kişiye bugünün geçmiş saatinde ve gelecekte sınavlar ver: simülatör devir önermeye zorlanır
function withLoad(fx) {
    const top = 12; // taban puanı en yüksek kişi (fixture)
    fx.exams.push({ id: 9001, name: 'BUGÜN SABAH (bitti)', date: '2026-11-08', time: '09:00', duration: 90, type: 'Vize', proctorIds: [top], proctorId: top });
    fx.exams.push({ id: 9002, name: 'BUGÜN 11:30 (başladı)', date: '2026-11-08', time: '11:30', duration: 120, type: 'Vize', proctorIds: [top], proctorId: top });
    for (let k = 0; k < 6; k++) {
        fx.exams.push({ id: 9100 + k, name: `GELECEK ${k}`, date: `2026-11-${String(20 + k).padStart(2, '0')}`, time: '10:00', duration: 120, type: 'Final', proctorIds: [top], proctorId: top });
    }
}

test('Simülatör: tarihi geçmiş veya bugün başlamış sınavları önermez', () => {
    const app = freshApp(withLoad);
    for (const mode of ['exam', 'all']) {
        const sim = app.run(`simulateFairnessOptimization(10, '${mode}')`);
        assert.ok(sim.suggestedActions.length > 0, 'devir önerisi beklenir');
        const ids = sim.suggestedActions.flatMap(a => a.type === 'transfer' ? [a.examId] : [a.examFromA.id, a.examFromB.id]).map(String);
        const exams = app.run('DB.exams');
        for (const id of ids) {
            const ex = exams.find(e => String(e.id) === id);
            assert.ok(app.run(`getSafeDate('${ex.date}', '${ex.time}').getTime()`) > NOW.getTime(), `${ex.name} başlamış/geçmiş olamaz`);
        }
        assert.ok(!ids.includes('9001') && !ids.includes('9002'));
    }
});

test('Simülatör: her öneri bugünkü takvime göre geçerli; sırayla uygulanınca hiçbiri atlanmaz', () => {
    const app = freshApp(withLoad);
    const sim = app.run(`simulateFairnessOptimization(10, 'exam')`);
    const exams = app.run('DB.exams');
    const seen = new Set();
    for (const a of sim.suggestedActions) {
        const moves = a.type === 'transfer' ? [[a.examId, a.fromStaff.id, a.toStaff.id]]
            : [[a.examFromA.id, a.staffA.id, a.staffB.id], [a.examFromB.id, a.staffB.id, a.staffA.id]];
        for (const [exId, from, to] of moves) {
            const ex = exams.find(e => String(e.id) === String(exId));
            assert.ok(pidsOf(ex).includes(String(from)), `${from}, ${ex.name} sınavının (o adımda) gözetmeni olmalı`);
            assert.ok(!pidsOf(ex).includes(String(to)), `${to} zaten gözetmen olmamalı`);
            const key = `${exId}:${from}`;
            assert.ok(!seen.has(key), 'aynı kişi-sınav iki kez önerilmez');
            seen.add(key);
            ex.proctorIds = pidsOf(ex).map(p => p === String(from) ? String(to) : p);
        }
    }
    assert.ok(sim.suggestedActions.length > 0);
});

test('Her öneride kalan fark ve önerilen durma noktası', () => {
    const app = freshApp(withLoad);
    const sim = app.run(`simulateFairnessOptimization(10, 'exam')`);
    const acts = sim.suggestedActions;
    assert.ok(acts.length > 0);
    assert.ok(typeof sim.initialSpread === 'number');
    acts.forEach(a => assert.ok(typeof a.spreadAfter === 'number', 'her öneride kalan fark'));
    assert.ok(acts[acts.length - 1].spreadAfter < sim.initialSpread, 'öneriler farkı küçültür');
    assert.ok(sim.stopAt >= 1 && sim.stopAt <= acts.length);
    acts.forEach((a, i) => assert.equal(a.recommended, i < sim.stopAt));
    // Durma noktası: ulaşılabilir iyileşmenin en az %90'ı ya da fark tipik sınav puanının altında
    const atStop = acts[sim.stopAt - 1].spreadAfter, end = acts[acts.length - 1].spreadAfter;
    assert.ok(atStop - end <= (sim.initialSpread - end) * 0.1 + 1e-6 || atStop <= 200);
});

test('fairnessStopPoint: fark tipik sınav puanının altına inince durur', () => {
    const app = freshApp();
    const stop = app.run(`fairnessStopPoint([{ spreadAfter: 300 }, { spreadAfter: 80 }, { spreadAfter: 70 }, { spreadAfter: 65 }], 500, [{ date: '2026-12-01', time: '10:00', score: 120 }])`);
    assert.equal(stop, 2);
});

test('fairnessStopPoint: fark zaten bir sınav puanından küçükse değişiklik önerilmez; az kazançlı adımlarda durur', () => {
    const app = freshApp();
    const exams = `[{ date: '2026-12-01', time: '10:00', score: 120 }]`;
    assert.equal(app.run(`fairnessStopPoint([{ spreadAfter: 90, sdAfter: 20 }], 110, ${exams}, 30)`), 0, 'başlangıç farkı < tipik sınav puanı');
    // Sapma 100 → 60 → 59 → 58: ikinci adım neredeyse hiçbir şey katmıyor
    assert.equal(app.run(`fairnessStopPoint([{ spreadAfter: 400, sdAfter: 60 }, { spreadAfter: 390, sdAfter: 59.5 }, { spreadAfter: 380, sdAfter: 59 }], 500, ${exams}, 100)`), 1);
    // Toplam iyileşme %5'ten az: hiç önerilmez
    assert.equal(app.run(`fairnessStopPoint([{ spreadAfter: 490, sdAfter: 98 }], 500, ${exams}, 100)`), 0);
});

test('48 saatten yakın sınav içeren öneri işaretlenir', () => {
    const app = freshApp(fx => {
        withLoad(fx);
        // Yarın (24 saatten az sonra) sınavı olan yüksek puanlı kişi
        fx.exams.push({ id: 9200, name: 'YARIN', date: '2026-11-09', time: '10:00', duration: 120, type: 'Final', proctorIds: [12], proctorId: 12 });
    });
    const sim = app.run(`simulateFairnessOptimization(10, 'exam')`);
    const near = sim.suggestedActions.filter(a => (a.type === 'transfer' ? [a.examId] : [a.examFromA.id, a.examFromB.id]).map(String).includes('9200'));
    near.forEach(a => assert.equal(a.yakin, true));
    sim.suggestedActions.filter(a => !near.includes(a) && a.type === 'transfer' && String(a.examId).startsWith('91')).forEach(a => assert.equal(a.yakin, false));
});

test('fairnessCanReceive: başlamış sınavın görevlisi değiştirilemez', () => {
    const app = freshApp(withLoad);
    assert.equal(app.run(`fairnessCanReceive(DB, 1, DB.exams.find(e => e.id === 9002), null, 12)`), false);
    assert.equal(app.run(`fairnessCanReceive(DB, 1, DB.exams.find(e => e.id === 9100), null, 12)`), true);
});

test('Net öneriler: bir sınav eski sahibine dönmez, zincir yerine son durum verilir', () => {
    const app = freshApp(withLoad);
    const sim = app.run(`simulateFairnessOptimization(10, 'exam')`);
    const exams = app.run('DB.exams');
    for (const a of sim.suggestedActions.filter(x => x.type === 'transfer')) {
        const ex = exams.find(e => String(e.id) === String(a.examId));
        assert.notEqual(String(a.fromStaff.id), String(a.toStaff.id));
        assert.ok(pidsOf(ex).includes(String(a.fromStaff.id)), 'devreden, sınavı bugün tutan kişidir');
    }
    assert.ok(sim.searchSteps >= sim.suggestedActions.length || sim.suggestedActions.length > 0);
});
