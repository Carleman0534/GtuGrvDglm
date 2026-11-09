/**
 * Hibrit Tahmin Motoru, P2P Takas Teklifleri ve Simülasyon Anlık Görüntü (Snapshot/Rollback) Testleri
 * Çalıştırma: node --test tests/hybrid_p2p.test.js
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

// ---------------------------------------------------------------- Hibrit Tahmin & Adil Ön-Atama
test('simulateHybridFairnessWithForecast: kalan finalleri ve mazeretleri dengeli kotalandırır', () => {
    const app = freshApp();
    const res = app.run("simulateHybridFairnessWithForecast('exam')");

    assert.ok(res, 'Hibrit sonuç dönmeli');
    assert.equal(res.mode, 'exam');
    assert.ok(res.hybridTargetAverage > 0, 'Hedef ortalama pozitif olmalı');
    assert.ok(res.totalUpcomingSlots > 0, 'Kalan sınav toplamı pozitif olmalı');
    assert.ok(Array.isArray(res.staffPlans) && res.staffPlans.length >= 12, '12 asistanın planı olmalı');

    // Dağıtılan toplam kota kalan görev sayısına eşit olmalı
    const totalAllocated = res.staffPlans.reduce((sum, s) => sum + s.totalUpcomingQuota, 0);
    assert.equal(totalAllocated, res.totalUpcomingSlots, 'Tüm slotlar paylaştırılmalı');

    // En düşük puanlı asistanlar en az en yüksek puanlı kadar ya da daha fazla kota almalı
    const sorted = res.staffPlans.slice().sort((a, b) => a.currentScore - b.currentScore);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    assert.ok(lowest.totalUpcomingQuota >= highest.totalUpcomingQuota, 'Düşük puanlıya daha çok kota verilmeli');

    // Projeksiyon sonrası Gini katsayısı adil seviyede olmalı
    assert.ok(res.projectedFinalGini < 0.05, 'Dönem sonu Gini mükemmel eşitliğe yaklaşmalı');
});

test('simulateHybridFairnessWithForecast: boş veritabanında güvenli boş sonuç döner', () => {
    const app = freshApp();
    app.raw('DB.staff = []; DB.exams = [];');
    const res = app.run("simulateHybridFairnessWithForecast('exam')");
    assert.ok(res);
    assert.equal(res.staffPlans.length, 0);
});

// ---------------------------------------------------------------- P2P Takas Pazarı & Karşılıklı Onay
test('createFairnessSwapProposal & acceptFairnessProposal: iki taraflı onay takası yürütür', () => {
    const app = freshApp();
    
    // İki asistan ve iki sınav tanımla
    const staffA = 1, staffB = 2;
    const examA = 101, examB = 102;
    
    app.raw(`
        DB.exams.push({ id: ${examA}, name: "Sınav A", date: "2026-12-10", time: "10:00", duration: 90, score: 100, proctorId: ${staffA}, proctorIds: [${staffA}] });
        DB.exams.push({ id: ${examB}, name: "Sınav B", date: "2026-12-11", time: "14:00", duration: 90, score: 90, proctorId: ${staffB}, proctorIds: [${staffB}] });
        recalculateAllScores();
    `);

    const action = {
        type: 'bilateral_swap',
        staffA: { id: staffA, name: 'Asistan A' },
        staffB: { id: staffB, name: 'Asistan B' },
        examFromA: { id: examA, name: 'Sınav A', score: 100 },
        examFromB: { id: examB, name: 'Sınav B', score: 90 },
        netShift: 10,
        gapBefore: 50,
        gapAfter: 30,
        gapReduction: 20
    };

    // 1. Teklif oluştur
    const prop = app.run(`createFairnessSwapProposal(${JSON.stringify(action)})`);
    assert.ok(prop && prop.id);
    assert.equal(prop.status, 'pending_peers');

    // 2. Yalnızca A onayladığında henüz yürütülmemeli
    const step1 = app.run(`acceptFairnessProposal('${prop.id}', ${staffA})`);
    assert.equal(step1.status, 'pending_other');
    assert.equal(app.run(`DB.exams.find(e => e.id === ${examA}).proctorId`), staffA, 'Henüz takas gerçekleşmemeli');

    // 3. B de onayladığında takas otomatik gerçekleşmeli
    const step2 = app.run(`acceptFairnessProposal('${prop.id}', ${staffB})`);
    assert.equal(step2.status, 'completed');

    // Sınavların gözetmenleri karşılıklı değişmiş olmalı
    const updatedExamA = app.run(`DB.exams.find(e => e.id === ${examA})`);
    const updatedExamB = app.run(`DB.exams.find(e => e.id === ${examB})`);
    assert.equal(updatedExamA.proctorId, staffB, 'Sınav A artık B gözetmeninde olmalı');
    assert.equal(updatedExamB.proctorId, staffA, 'Sınav B artık A gözetmeninde olmalı');
});

test('rejectFairnessProposal: teklif reddedildiğinde sınavlar değişmez', () => {
    const app = freshApp();
    const action = {
        type: 'transfer',
        fromStaff: { id: 1, name: 'Asistan 1' },
        toStaff: { id: 2, name: 'Asistan 2' },
        examId: 999,
        examName: 'Deneme Sınav',
        points: 50
    };
    app.raw(`DB.exams.push({ id: 999, name: "Deneme Sınav", score: 50, proctorId: 1, proctorIds: [1] });`);

    const prop = app.run(`createFairnessSwapProposal(${JSON.stringify(action)})`);
    const rej = app.run(`rejectFairnessProposal('${prop.id}', 2, 'Müsait değilim')`);
    assert.equal(rej.status, 'rejected');

    const ex = app.run('DB.exams.find(e => e.id === 999)');
    assert.equal(ex.proctorId, 1, 'Reddedilen sınav eski gözetmende kalmalı');
});

// ---------------------------------------------------------------- Karar Güvencesi: Snapshot & Rollback
test('createSimulationSnapshot & rollbackSimulationSnapshot: simülasyon tek tıkla geri alınır', () => {
    const app = freshApp();
    const originalExamCount = app.run('DB.exams.length');
    const firstExamBefore = app.run('DB.exams[0]');

    // Snapshot al
    const snap = app.run("createSimulationSnapshot({ mode: 'exam', stepCount: 5 })");
    assert.ok(snap && snap.id);

    // Takvimi değiştir (ör. gözetmenini 999 yap veya bir sınav sil)
    app.raw('DB.exams[0].proctorId = 9999; DB.exams.pop(); recalculateAllScores();');
    assert.notEqual(app.run('DB.exams.length'), originalExamCount);

    // Geri al
    const roll = app.run(`rollbackSimulationSnapshot(${JSON.stringify(snap)})`);
    assert.equal(roll.success, true);
    assert.equal(app.run('DB.exams.length'), originalExamCount, 'Sınav sayısı geri gelmeli');
    assert.equal(app.run('DB.exams[0].proctorId'), firstExamBefore.proctorId, 'İlk sınav gözetmeni orijinal haline dönmeli');
});
