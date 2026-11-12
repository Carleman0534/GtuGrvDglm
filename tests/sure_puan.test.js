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

test('Yalnızca aktif gözetmenler ve sınav görevleri; puanlar değişmez', () => {
    const app = freshApp();
    const before = app.run('JSON.stringify(DB.staff.map(s => [s.id, s.totalScore]))');
    const st = app.run('computeTimeScoreStats({ donem: false })');
    assert.equal(st.kisiler.length, 12, 'öğretim üyeleri dahil değil');
    assert.equal(app.run('JSON.stringify(DB.staff.map(s => [s.id, s.totalScore]))'), before, 'yalnızca bilgi: puan değişmez');
    // Toplam saat = tüm sınav görevlerinin (kişi başı) süreleri
    const dk = app.run(`DB.exams.filter(e => !shouldCountAsNonExam(e)).reduce((a, e) => a + (Array.isArray(e.proctorIds) && e.proctorIds.length ? e.proctorIds : [e.proctorId]).filter(p => p >= 1 && p <= 12).length * getProctorExamDuration(e, e.proctorIds[0]), 0)`);
    assert.ok(Math.abs(st.toplamSaat - dk / 60) < 1, `toplam saat ${st.toplamSaat} ≈ ${dk / 60}`);
});

test('Bu dönem kapsamı yalnızca güncel dönemi (Güz) sayar', () => {
    const app = freshApp();
    const tum = app.run('computeTimeScoreStats({ donem: false })');
    const donem = app.run('computeTimeScoreStats({ donem: true })');
    assert.ok(donem.toplamSaat < tum.toplamSaat);
    assert.match(donem.donem, /2026-2027-guz/);
    assert.equal(tum.donem, null);
});

test('Kişinin kendi girdiği süre kullanılır; yapılmamış görevler ayrı sayılır', () => {
    const app = freshApp(fx => {
        fx.exams.push({ id: 9700, name: 'GEÇMİŞ', date: '2026-11-02', time: '10:00', duration: 120, type: 'Vize', proctorIds: [1, 2], proctorId: 1, gozetmenSuresi_1: { sure: 60, onaylayan: 'A' } });
        fx.exams.push({ id: 9701, name: 'GELECEK', date: '2026-11-20', time: '10:00', duration: 90, type: 'Vize', proctorIds: [1], proctorId: 1 });
    });
    const base = freshApp().run('computeTimeScoreStats({ donem: true })').kisiler;
    const st = app.run('computeTimeScoreStats({ donem: true })').kisiler;
    const a0 = base.find(k => k.id === 1), a1 = st.find(k => k.id === 1);
    const b0 = base.find(k => k.id === 2), b1 = st.find(k => k.id === 2);
    assert.equal(a1.dkTamam - a0.dkTamam, 60, 'A kendi girdiği 60 dk ile');
    assert.equal(b1.dkTamam - b0.dkTamam, 120, 'B planlanan 120 dk ile');
    assert.equal(a1.dkPlan - a0.dkPlan, 90, 'yapılmamış görev planlanan olarak');
    assert.equal(a1.gorev - a0.gorev, 2);
});
