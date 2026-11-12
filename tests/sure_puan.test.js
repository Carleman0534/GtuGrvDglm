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
    // Planlananlar dahil: taban + sınav + eski sınav dışı = sistemdeki totalScore; sınav dışı − eski = nonExamScore
    const staff = app.run('DB.staff');
    for (const k of st.kisiler) {
        const s = staff.find(x => x.id === k.id);
        assert.ok(Math.abs((k.taban + k.sinav.puan + k.eskiDisi.puan) - s.totalScore) < 0.5, `${k.name}: taban + sınav + eski sınav dışı = sistem puanı`);
        assert.ok(Math.abs(k.disi.puan - k.eskiDisi.puan - (s.nonExamScore || 0)) < 0.5, `${k.name}: sınav dışı puan`);
        assert.ok(Math.abs(k.genel - (k.taban + k.sinav.puan + k.disi.puan)) < 0.05);
    }
});

test('Ayrım tarihinden önceki "Diğer" görevleri tabloda sınav dışı; sonraki işaretsiz görev sınav kalır', () => {
    const app = freshApp(fx => {
        fx.exams.push({ id: 9730, name: 'Festival', date: '2026-05-13', time: '09:30', duration: 450, type: 'Diğer', proctorIds: [3], proctorId: 3 });       // eski, işaretsiz
        fx.exams.push({ id: 9731, name: 'Ek Görev', date: '2026-06-12', time: '09:30', duration: 20, type: 'Diğer', isNonExam: true, proctorIds: [3], proctorId: 3 }); // eski, işaretli
        fx.exams.push({ id: 9732, name: 'Yeterlilik Sınavı', date: '2026-09-14', time: '10:00', duration: 180, type: 'Diğer', proctorIds: [3], proctorId: 3 }); // sonra, işaretsiz → sınav
    });
    const base = freshApp().run('computeTimeScoreStats()').kisiler.find(k => k.id === 3);
    const k = app.run('computeTimeScoreStats()').kisiler.find(x => x.id === 3);
    assert.equal(k.disi.dk - base.disi.dk, 470, 'festival + ek görev sınav dışında');
    assert.equal(k.sinav.dk - base.sinav.dk, 180, 'yeterlilik sınavı sınav gözetmenliğinde');
    assert.equal(k.eskiDisi.gorev - base.eskiDisi.gorev, 2);
    // Sıralamadaki puan dökümü yine tutar
    const s = app.run('DB.staff.find(x => x.id === 3)');
    assert.ok(Math.abs(k.taban + k.siralamaYapilan + k.siralamaEski + k.siralamaPlan - s.totalScore) < 0.5);
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

test('Sıralamadaki puan = taban + yapılan + planlanan sınavlar (her iki görünümde)', () => {
    const app = freshApp(fx => {
        fx.exams.push({ id: 9720, name: 'GELECEK', date: '2026-11-20', time: '10:00', duration: 90, type: 'Vize', proctorIds: [1], proctorId: 1 });
    });
    const staff = app.run('DB.staff');
    for (const planDahil of [false, true]) {
        const st = app.run(`computeTimeScoreStats({ planDahil: ${planDahil} })`);
        for (const k of st.kisiler) {
            const s = staff.find(x => x.id === k.id);
            assert.ok(Math.abs(k.siralamaPuan - s.totalScore) < 0.05, `${k.name}: sıralamadaki puan = sistem puanı`);
            assert.ok(Math.abs(k.taban + k.siralamaYapilan + k.siralamaEski + k.siralamaPlan - k.siralamaPuan) < 0.5, `${k.name}: döküm toplamı tutar`);
        }
        assert.ok(st.kisiler.find(k => k.id === 1).siralamaPlan > 0, 'gelecek sınav planlanan olarak görünür');
    }
});

test('Ay seçimi: yalnızca o ay sayılır; tüm ayların toplamı tüm zamanlara eşit', () => {
    const app = freshApp();
    const aylar = app.run('timeScoreMonths()');
    assert.ok(aylar.length > 3);
    assert.deepEqual(aylar.map(a => a.key), aylar.map(a => a.key).slice().sort().reverse(), 'en yeni ay önce');
    assert.match(aylar.find(a => a.key === '2026-11').ad, /Kasım 2026/);
    const tum = app.run('computeTimeScoreStats({ planDahil: true })');
    let sinavDk = 0, disiDk = 0, puan = 0;
    for (const a of aylar) {
        const st = app.run(`computeTimeScoreStats({ ay: '${a.key}', planDahil: true })`);
        assert.equal(st.ay, a.key);
        sinavDk += st.kisiler.reduce((x, k) => x + k.sinav.dk, 0);
        disiDk += st.kisiler.reduce((x, k) => x + k.disi.dk, 0);
        puan += st.toplamPuan;
    }
    assert.equal(sinavDk, tum.kisiler.reduce((x, k) => x + k.sinav.dk, 0));
    assert.equal(disiDk, tum.kisiler.reduce((x, k) => x + k.disi.dk, 0));
    assert.ok(Math.abs(puan - tum.toplamPuan) < 1);
    // Bir ayın sınavları yalnızca o ayın kapsamında
    const nisan = app.run(`computeTimeScoreStats({ ay: '2026-04', planDahil: true })`);
    const nisanDk = app.run(`DB.exams.filter(e => String(e.date).startsWith('2026-04') && !shouldCountAsNonExam(e)).reduce((a, e) => a + (Array.isArray(e.proctorIds) && e.proctorIds.length ? e.proctorIds : [e.proctorId]).filter(p => p >= 1 && p <= 12).length * (parseInt(e.duration, 10) || 60), 0)`);
    assert.equal(nisan.kisiler.reduce((x, k) => x + k.sinav.dk + k.disi.dk, 0), nisanDk);
});

test('Taban puan görev olarak: her 120 puan önceden yapıldığı varsayılan 1 görev', () => {
    const app = freshApp();
    const st = app.run('computeTimeScoreStats()');
    assert.equal(st.tabanGorevPuani, 120);
    for (const k of st.kisiler) {
        assert.equal(k.tabanGorev, Math.round(k.taban / 120 * 10) / 10);
        assert.equal(k.gorevTabanDahil, Math.round((k.toplam.gorev + k.tabanGorev) * 10) / 10);
    }
    // Fixture: taban 1800 → 15 görev, 600 → 5 görev
    assert.equal(st.kisiler.find(k => k.taban === 1800).tabanGorev, 15);
    assert.equal(st.kisiler.find(k => k.taban === 600).tabanGorev, 5);
    assert.ok(Math.abs(st.tabanGorev - st.taban / 120) < 0.5);
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
