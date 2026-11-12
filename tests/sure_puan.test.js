/**
 * 🧪 TASLAK: Süre ve puan analizi (puanlamayı değiştirmez).
 * Çalıştırma: node --test tests/sure_puan.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');
const { NOW, buildFixture } = require('./fixture'); // 8 Kasım 2026 12:00 → güncel dönem: 2026-2027 Güz

function freshApp(mutate) {
    const app = createApp({ now: NOW });
    const fx = buildFixture();
    if (mutate) mutate(fx);
    app.setDB(fx);
    app.raw('recalculateAllScores();');
    return app;
}

test('Yalnızca aktif gözetmenler; puanlar değişmez; planlananlar dahil edilince sistem puanıyla tutarlı', () => {
    const app = freshApp();
    const before = app.run('JSON.stringify(DB.staff.map(s => [s.id, s.totalScore, s.nonExamScore]))');
    const st = app.run('computeTimeScoreStats({ planDahil: true })');
    assert.equal(st.kisiler.length, 12, 'öğretim üyeleri dahil değil');
    assert.equal(app.run('JSON.stringify(DB.staff.map(s => [s.id, s.totalScore, s.nonExamScore]))'), before, 'yalnızca bilgi: puan değişmez');
    // Planlananlar dahil: taban + sınav = sistemdeki totalScore; sınav dışı = nonExamScore
    const staff = app.run('DB.staff');
    for (const k of st.kisiler) {
        const s = staff.find(x => x.id === k.id);
        assert.ok(Math.abs((k.taban + k.sinav.puan) - s.totalScore) < 0.5, `${k.name}: taban + sınav = sistem puanı`);
        assert.ok(Math.abs(k.disi.puan - (s.nonExamScore || 0)) < 0.5, `${k.name}: sınav dışı puan`);
        assert.ok(Math.abs(k.genel - (k.taban + k.sinav.puan + k.disi.puan)) < 0.05);
    }
});

test('Varsayılan: yalnızca şu ana kadar yapılan görevler; planlananlar ayrı sayılır', () => {
    const app = freshApp(fx => {
        fx.exams.push({ id: 9700, name: 'GEÇMİŞ', date: '2026-11-02', time: '10:00', duration: 120, type: 'Vize', proctorIds: [1, 2], proctorId: 1, gozetmenSuresi_1: { sure: 60, onaylayan: 'A' } });
        fx.exams.push({ id: 9701, name: 'GELECEK', date: '2026-11-20', time: '10:00', duration: 90, type: 'Vize', proctorIds: [1], proctorId: 1 });
    });
    const base = freshApp().run('computeTimeScoreStats()').kisiler;
    const st = app.run('computeTimeScoreStats()');
    const a0 = base.find(k => k.id === 1), a1 = st.kisiler.find(k => k.id === 1);
    const b0 = base.find(k => k.id === 2), b1 = st.kisiler.find(k => k.id === 2);
    assert.equal(a1.sinav.dk - a0.sinav.dk, 60, 'A kendi girdiği 60 dk ile');
    assert.equal(b1.sinav.dk - b0.sinav.dk, 120, 'B planlanan 120 dk ile');
    assert.equal(a1.sinav.gorev - a0.sinav.gorev, 1, 'gelecek görev sayılmaz');
    assert.equal(a1.sinav.planDk - a0.sinav.planDk, 90, 'gelecek görev planlanan olarak ayrı tutulur');
    const plan = app.run('computeTimeScoreStats({ planDahil: true })').kisiler.find(k => k.id === 1);
    assert.equal(plan.sinav.dk - a1.sinav.dk, a1.sinav.planDk, 'planlananlar dahil edilince eklenir');
});

test('Sınav gözetmenliği ve sınav dışı görevler ayrı; toplamlar doğru', () => {
    const app = freshApp(fx => {
        fx.exams.push({ id: 9710, name: 'Tanıtım', date: '2026-11-03', time: '10:00', duration: 180, type: 'Diğer', isNonExam: true, proctorIds: [4], proctorId: 4 });
    });
    const base = freshApp().run('computeTimeScoreStats()').kisiler.find(k => k.id === 4);
    const k = app.run('computeTimeScoreStats()').kisiler.find(x => x.id === 4);
    assert.equal(k.disi.dk - base.disi.dk, 180, 'sınav dışı süre');
    assert.equal(k.sinav.dk, base.sinav.dk, 'sınav süresi değişmez');
    assert.ok(k.disi.puan > base.disi.puan);
    assert.equal(k.toplam.saat, Math.round((k.sinav.dk + k.disi.dk) / 6) / 10);
    assert.ok(Math.abs(k.toplam.puan - (k.sinav.puan + k.disi.puan)) < 0.05);
});

test('Bölüm toplamları kişilerin toplamına eşit; dönem kapsamı daha dar', () => {
    const app = freshApp();
    const st = app.run('computeTimeScoreStats()');
    const sum = (f) => Math.round(st.kisiler.reduce((a, k) => a + f(k), 0) * 10) / 10;
    assert.equal(st.sinavGorev, st.kisiler.reduce((a, k) => a + k.sinav.gorev, 0));
    assert.ok(Math.abs(st.genel - sum(k => k.genel)) < 0.5);
    const donem = app.run('computeTimeScoreStats({ donem: true })');
    assert.match(donem.donem, /2026-2027-guz/);
    assert.ok(donem.toplamSaat < st.toplamSaat);
});
