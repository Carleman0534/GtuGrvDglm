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
test('Geri al: yalnızca simülasyonun değiştirdiği görevler döner; sonradan girilen süreler ve yeni sınavlar korunur', () => {
    const app = freshApp(fx => {
        fx.exams.push({ id: 801, name: 'Sim A', date: '2026-12-10', time: '10:00', duration: 90, location: 'Derslik 1 / Derslik 3', proctorIds: [1, 2], proctorId: 1, gozetmenDersligi_1: 'Derslik 1', gozetmenDersligi_2: 'Derslik 3' });
        fx.exams.push({ id: 802, name: 'Sim B', date: '2026-12-11', time: '10:00', duration: 90, proctorIds: [4], proctorId: 4 });
    });
    const examCount = app.run('DB.exams.length');

    // Simülasyon: 801'de 1 → 3 devri
    app.raw(`window.__snap = createSimulationSnapshot({ mode: 'exam', stepCount: 1 });
             moveExamProctor(DB, DB.exams.find(e => e.id === 801), 1, 3);
             markSimulationApplied(window.__snap, { stepCount: 1 });`);
    assert.equal(app.run('DB.exams.find(e => e.id === 801).gozetmenDersligi_3'), 'Derslik 1', 'derslik yeni gözetmene geçer');
    assert.equal(app.run('DB.exams.find(e => e.id === 801).gozetmenDersligi_1'), null);

    // Simülasyondan sonra: başka sınava süre girildi, yeni sınav eklendi
    app.raw(`DB.exams.find(e => e.id === 802).gozetmenSuresi_4 = { sure: 75, onaylayan: 'G4' };
             DB.exams.push({ id: 803, name: 'Yeni', date: '2026-12-12', time: '10:00', duration: 60, proctorIds: [5] });`);

    const roll = app.run('rollbackSimulationSnapshot()');
    assert.equal(roll.success, true);
    assert.deepEqual(roll.restoredExams, ['Sim A']);
    const a = app.run('DB.exams.find(e => e.id === 801)');
    assert.deepEqual(a.proctorIds.map(String), ['1', '2']);
    assert.equal(a.gozetmenDersligi_1, 'Derslik 1');
    assert.equal(a.gozetmenDersligi_3, null);
    assert.equal(app.run('DB.exams.find(e => e.id === 802).gozetmenSuresi_4.sure'), 75, 'sonradan girilen süre korunur');
    assert.equal(app.run('DB.exams.length'), examCount + 1, 'yeni eklenen sınav silinmez');
});

test('Geri al: simülasyondan sonra yeniden değiştirilmiş sınav atlanır', () => {
    const app = freshApp(fx => {
        fx.exams.push({ id: 811, name: 'Sim C', date: '2026-12-10', time: '10:00', duration: 90, proctorIds: [1], proctorId: 1 });
    });
    app.raw(`window.__snap = createSimulationSnapshot({});
             moveExamProctor(DB, DB.exams.find(e => e.id === 811), 1, 2);
             markSimulationApplied(window.__snap, { stepCount: 1 });
             moveExamProctor(DB, DB.exams.find(e => e.id === 811), 2, 5);`); // başka yönetici sonradan değiştirdi
    const roll = app.run('rollbackSimulationSnapshot()');
    assert.deepEqual(roll.skippedExams, ['Sim C']);
    assert.deepEqual(app.run('DB.exams.find(e => e.id === 811).proctorIds').map(String), ['5'], 'sonraki değişiklik ezilmez');
});

test('Geri al: hiçbir adım uygulanmadıysa önceki geri alma kaydı korunur', () => {
    const app = freshApp(fx => { fx.exams.push({ id: 821, name: 'Sim D', date: '2026-12-10', time: '10:00', duration: 90, proctorIds: [1], proctorId: 1 }); });
    app.raw(`const s = createSimulationSnapshot({}); moveExamProctor(DB, DB.exams.find(e => e.id === 821), 1, 2); markSimulationApplied(s, { stepCount: 1 });
             createSimulationSnapshot({});`); // ikinci simülasyon hiçbir adım uygulayamadı
    const roll = app.run('rollbackSimulationSnapshot()');
    assert.deepEqual(roll.restoredExams, ['Sim D']);
});

// ---------------------------------------------------------------- Onay anında yeniden doğrulama
function p2pApp(extra) {
    return freshApp(fx => {
        fx.exams.push({ id: 901, name: 'Takas A', date: '2026-12-10', time: '10:00', duration: 90, proctorIds: [1], proctorId: 1, location: 'Derslik 1 / Derslik 3', gozetmenDersligi_1: 'Derslik 3' });
        fx.exams.push({ id: 902, name: 'Takas B', date: '2026-12-11', time: '14:00', duration: 90, proctorIds: [2], proctorId: 2 });
        if (extra) extra(fx);
    });
}
const swapAction = { type: 'bilateral_swap', staffA: { id: 1, name: 'A' }, staffB: { id: 2, name: 'B' }, examFromA: { id: 901, name: 'Takas A' }, examFromB: { id: 902, name: 'Takas B' } };

test('P2P: derslik eşleştirmesi takasla yeni gözetmene geçer', () => {
    const app = p2pApp();
    const prop = app.run(`createFairnessSwapProposal(${JSON.stringify(swapAction)})`);
    app.run(`acceptFairnessProposal('${prop.id}', 1)`);
    assert.equal(app.run(`acceptFairnessProposal('${prop.id}', 2)`).status, 'completed');
    const ex = app.run('DB.exams.find(e => e.id === 901)');
    assert.equal(ex.gozetmenDersligi_2, 'Derslik 3');
    assert.equal(ex.gozetmenDersligi_1, null);
});

test('P2P: onay beklerken görev başkasına geçtiyse takas uygulanmaz', () => {
    const app = p2pApp();
    const prop = app.run(`createFairnessSwapProposal(${JSON.stringify(swapAction)})`);
    app.run(`acceptFairnessProposal('${prop.id}', 1)`);
    app.raw(`moveExamProctor(DB, DB.exams.find(e => e.id === 901), 1, 7);`);
    const res = app.run(`acceptFairnessProposal('${prop.id}', 2)`);
    assert.equal(res.success, false);
    assert.equal(app.run(`DB.requests.find(r => r.id === '${prop.id}').status`), 'invalid');
    assert.deepEqual(app.run('DB.exams.find(e => e.id === 902).proctorIds').map(String), ['2'], 'karşı sınav değişmez');
});

test('P2P: onay anında çakışma oluşuyorsa takas uygulanmaz', () => {
    // B, Takas A ile aynı saatte yeni bir görev aldı
    const app = p2pApp(fx => fx.exams.push({ id: 903, name: 'Çakışan', date: '2026-12-10', time: '10:30', duration: 60, proctorIds: [2], proctorId: 2 }));
    const prop = app.run(`createFairnessSwapProposal(${JSON.stringify(swapAction)})`);
    app.run(`acceptFairnessProposal('${prop.id}', 1)`);
    const res = app.run(`acceptFairnessProposal('${prop.id}', 2)`);
    assert.equal(res.success, false);
    assert.deepEqual(app.run('DB.exams.find(e => e.id === 901).proctorIds').map(String), ['1']);
});

test('P2P: sınav geçtiyse teklifin süresi dolar; taraf olmayan onay veremez', () => {
    const app = p2pApp(fx => { fx.exams.find(e => e.id === 901).date = '2026-01-05'; });
    const prop = app.run(`createFairnessSwapProposal(${JSON.stringify(swapAction)})`);
    assert.equal(app.run(`acceptFairnessProposal('${prop.id}', 9)`).success, false, 'taraf olmayan');
    const res = app.run(`acceptFairnessProposal('${prop.id}', 1)`);
    assert.equal(res.success, false);
    assert.equal(app.run(`DB.requests.find(r => r.id === '${prop.id}').status`), 'expired');
    assert.equal(app.run(`fairnessProposalExpired(DB.requests.find(r => r.id === '${prop.id}'), DB)`), true);
});
