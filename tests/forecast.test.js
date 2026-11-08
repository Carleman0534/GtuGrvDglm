/**
 * "Final Dönemi Sonuna Kadar Tahmini Görev & Süre Analizi" motoru testleri.
 * Çalıştırma:  node --test tests/
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');
const { NOW, buildFixture } = require('./fixture');

const CURRENT_TERM = '2026-2027-guz';

function freshApp(mutate) {
    const app = createApp({ now: NOW });
    const fx = buildFixture();
    if (mutate) mutate(fx);
    app.setDB(fx);
    return app;
}
const forecast = (app) => app.run('FinalForecastEngine.calculateForecastData()');
const sum = (arr, f) => arr.reduce((a, x) => a + x[f], 0);

// ---------------------------------------------------------------- Yardımcılar
test('getAcademicTerm: ay → dönem eşlemesi', () => {
    const app = freshApp();
    const t = (d) => app.run(`FinalForecastEngine.getAcademicTerm('${d}').key`);
    assert.equal(t('2026-03-01'), '2025-2026-bahar');
    assert.equal(t('2026-07-31'), '2025-2026-bahar');
    assert.equal(t('2026-08-01'), '2025-2026-yaz');
    assert.equal(t('2026-09-30'), '2025-2026-yaz');
    assert.equal(t('2026-10-01'), '2026-2027-guz');
    assert.equal(t('2027-01-20'), '2026-2027-guz');
    assert.equal(t('2027-02-28'), '2026-2027-guz');
});

test('localDateStr: gece yarısından sonra UTC yüzünden önceki güne düşmez', () => {
    const app = freshApp();
    assert.equal(app.run('FinalForecastEngine.localDateStr(new Date(2026, 9, 1, 1, 30))'), '2026-10-01');
    assert.equal(app.run('FinalForecastEngine.getAcademicTerm(FinalForecastEngine.localDateStr(new Date(2026, 9, 1, 1, 30))).key'), CURRENT_TERM);
});

test('classifyExam: her sınav tek kategoriye girer', () => {
    const app = freshApp();
    const c = (type, name) => app.run(`FinalForecastEngine.classifyExam(${JSON.stringify({ type, name })})`);
    assert.equal(c('Mazeret', 'MATH 111 Final Mazeret'), 'mazeret');
    assert.equal(c('Final', 'MATH 111'), 'final');
    assert.equal(c('', 'MATH 111 Final'), 'final');
    assert.equal(c('II. Vize', 'MATH 111'), 'vize');
    assert.equal(c('Vize', 'MATH 111'), 'vize');
    assert.equal(c('D SINAVI', 'MATH 111'), 'dsinav');
    assert.equal(c('Bütünleme', 'MATH 111'), 'dsinav');
    assert.equal(c('Ek Sınav', 'MATH 111'), 'other');
    assert.equal(c('Diğer', 'Festival'), 'other');
});

test('courseKey: aynı dersin farklı yazımları tek ders sayılır', () => {
    const app = freshApp();
    const k = (name) => app.run(`FinalForecastEngine.courseKey(${JSON.stringify({ name })})`);
    assert.equal(k('MATH 211 - Analysis III'), 'MATH 211');
    assert.equal(k('MATH 211 Analysis III'), 'MATH 211');
    assert.equal(k('MAT 542  \tReel Analiz '), 'MAT 542');
    assert.equal(k('PHYS113 Physics'), 'PHYS 113');
});

// ---------------------------------------------------------------- Geçmiş dönem analizi
test('Geçmiş analiz: Yaz ve devam eden dönem orana katılmaz, finaller ders bazında sayılır', () => {
    const app = freshApp();
    const h = forecast(app).history;
    assert.equal(h.dataSufficiency.pastTermsCount, 1, 'yalnızca Bahar kullanılmalı');
    assert.equal(h.dataSufficiency.totalHistFinals, 24);
    assert.equal(h.dataSufficiency.totalHistMazerets, 11);
    assert.equal(h.overallRatio, 0.458);                   // 11 / 24
    assert.equal(h.finalPerVizeCourse, 0.889);             // 24 / 27
    assert.equal(h.dPerFinal, 0.583);                      // 14 / 24
    assert.equal(h.mazeretSlotsPerExam, 1);
    assert.match(h.dataSufficiency.sufficiencyNote, /%45\.8/);
    assert.match(h.dataSufficiency.sufficiencyNote, /Yaz/);
});

test('Geçmiş analiz: final gözetmen katsayısı bağımsız hesapla aynı', () => {
    const app = freshApp();
    const db = app.getDB();
    const E = (code) => app.run(code);
    const bahar = db.exams.filter(e => E(`FinalForecastEngine.getAcademicTerm('${e.date}').key`) === '2025-2026-bahar');
    const key = (e) => e.name.split(' - ')[0].trim();
    const vizeSess = {}, finalSlots = {};
    bahar.forEach(e => {
        const n = new Set([...(e.proctorIds || []), e.proctorId].map(String)).size;
        if (e.type === 'Vize') {
            vizeSess[key(e)] = vizeSess[key(e)] || {};
            const s = `${e.date}|${e.time}`;
            vizeSess[key(e)][s] = (vizeSess[key(e)][s] || 0) + n;
        } else if (e.type === 'Final') {
            finalSlots[key(e)] = (finalSlots[key(e)] || 0) + n;
        }
    });
    let f = 0, v = 0;
    Object.keys(finalSlots).forEach(c => { f += finalSlots[c]; v += Math.max(...Object.values(vizeSess[c])); });
    const expected = Math.round((f / v) * 1000) / 1000;
    assert.equal(forecast(app).history.finalSlotFactor, expected);
    assert.ok(expected < 1, 'test verisinde finaller vizeden az gözetmenle yapılıyor');
});

// ---------------------------------------------------------------- Projeksiyon
test('Projeksiyon: beklenen final/mazeret/D sayıları', () => {
    const s = forecast(freshApp()).forecastSummary;
    assert.equal(s.projectedTotalFinals, 23);     // round(26 × 0.889)
    assert.equal(s.projectedMazeretCount, 11);    // round(23 × 0.458)
    assert.equal(s.remainingFinalCourses, 23);
    assert.equal(s.remainingMazeretToDistribute, 11);
    assert.equal(s.projectedDCount, 13);          // round(23 × 0.583)
    assert.equal(s.remainingDToDistribute, 13);
    assert.equal(s.totalUnannouncedSlots, s.remainingFinalSlots + s.remainingMazeretSlots + s.remainingDSlots);
});

test('Projeksiyon: final gözetmen ihtiyacı vize oturumlarından doğru türetilir', () => {
    const app = freshApp();
    const d = forecast(app);
    const db = app.getDB();
    const guzVize = db.exams.filter(e => e.type === 'Vize' && e.date >= '2026-10-01');
    const sess = {};
    guzVize.forEach(e => {
        const c = app.run(`FinalForecastEngine.courseKey(${JSON.stringify(e)})`);
        sess[c] = sess[c] || {};
        const k = `${e.date}|${e.time}`;
        sess[c][k] = (sess[c][k] || 0) + new Set([...(e.proctorIds || []), e.proctorId].map(String)).size;
    });
    const courses = Object.keys(sess);
    assert.equal(courses.length, 26);
    const share = Math.min(1, d.forecastSummary.remainingFinalCourses / courses.length);
    const expected = Math.round(share * courses.reduce((a, c) => a + Math.max(...Object.values(sess[c])) * d.history.finalSlotFactor, 0));
    assert.equal(d.forecastSummary.remainingFinalSlots, expected);
});

// ---------------------------------------------------------------- Kişi bazında doğruluk
test('Kişi bazında: tüm sütunlar bağımsız hesapla birebir aynı', () => {
    const app = freshApp();
    const d = forecast(app);
    const db = app.getDB();
    const now = NOW.getTime();
    const start = (e) => { const [h, m] = e.time.split(':').map(Number); const [y, mo, da] = e.date.split('-').map(Number); return new Date(y, mo - 1, da, h, m).getTime(); };
    const cur = db.exams.filter(e => !e.isNonExam && e.date >= '2026-10-01');
    const pids = (e) => new Set([...(e.proctorIds || []), e.proctorId].filter(x => x != null).map(String));
    const dur = (a) => a.reduce((s, e) => s + (parseInt(e.duration, 10) || 60), 0);

    assert.equal(d.proctorForecasts.length, 12, 'öğretim üyeleri havuza girmemeli');
    for (const p of d.proctorForecasts) {
        const mine = cur.filter(e => pids(e).has(String(p.id)));
        const fut = mine.filter(e => start(e) >= now);
        const past = mine.filter(e => start(e) < now);
        const st = db.staff.find(s => s.id === p.id);
        assert.equal(p.pastExamCount, past.length, `${p.name} geçmiş`);
        assert.equal(p.remainingConfirmedCount, fut.length, `${p.name} kalan`);
        assert.equal(p.remainingConfirmedDuration, dur(fut), `${p.name} kalan süre`);
        assert.equal(p.estimatedCount, p.estFinalCount + p.estimatedMazeretCount + p.estOtherCount);
        assert.equal(p.estimatedDuration, p.estFinalDuration + p.estimatedMazeretDuration + p.estOtherDuration);
        assert.equal(p.totalEstimatedCount, fut.length + p.estimatedCount);
        assert.ok(Math.abs(p.totalEstimatedDuration - (dur(fut) + p.estimatedDuration)) <= 1);
        assert.equal(p.semesterProjectedCount, mine.length + p.estimatedCount);
        assert.equal(p.examTotalScore, st.totalScore);
        assert.equal(p.nonExamScore, st.nonExamScore || 0);
        assert.ok(Math.abs(p.generalTotalScore - (st.totalScore + (st.nonExamScore || 0))) < 0.01);
    }
});

test('Dağıtım: tüm muhtemel görevler eksiksiz paylaştırılır', () => {
    const d = forecast(freshApp());
    const s = d.forecastSummary, ps = d.proctorForecasts;
    assert.equal(sum(ps, 'estFinalCount'), s.remainingFinalSlots);
    assert.equal(sum(ps, 'estimatedMazeretCount'), s.remainingMazeretSlots);
    assert.equal(sum(ps, 'estOtherCount'), s.remainingDSlots);
});

test('KPI: kalan mevcut sınav sayısı bağımsız sayımla aynı', () => {
    const app = freshApp();
    const db = app.getDB();
    const start = (e) => { const [h, m] = e.time.split(':').map(Number); const [y, mo, da] = e.date.split('-').map(Number); return new Date(y, mo - 1, da, h, m).getTime(); };
    const expected = db.exams.filter(e => !e.isNonExam && e.date >= '2026-10-01' && start(e) >= NOW.getTime()).length;
    assert.ok(expected > 0);
    assert.equal(forecast(app).forecastSummary.remainingExamsCount, expected);
});

test('Dağıtım: puan makası daralır ve en düşük puanlı en az en yüksek kadar görev alır', () => {
    const ps = forecast(freshApp()).proctorForecasts;
    const before = ps.map(p => p.examTotalScore), after = ps.map(p => p.projectedExamScore);
    const range = (a) => Math.max(...a) - Math.min(...a);
    assert.ok(range(after) < range(before), `makas ${range(before)} → ${range(after)}`);
    const lowest = ps.reduce((a, b) => (a.examTotalScore <= b.examTotalScore ? a : b));
    const highest = ps.reduce((a, b) => (a.examTotalScore >= b.examTotalScore ? a : b));
    assert.ok(lowest.estimatedCount >= highest.estimatedCount);
});

test('Sınav dışı görevler tahmini değiştirmez', () => {
    const base = forecast(freshApp());
    const withMore = forecast(freshApp(fx => {
        for (let i = 0; i < 5; i++) fx.exams.push({ id: 9000 + i, date: '2026-12-0' + (i + 1), time: '10:00', duration: 300, type: 'Diğer', name: 'Etkinlik ' + i, isNonExam: true, proctorIds: [1], proctorId: 1 });
    }));
    assert.deepEqual(withMore.forecastSummary.totalUnannouncedSlots, base.forecastSummary.totalUnannouncedSlots);
    const pick = (d) => d.proctorForecasts.map(p => [p.id, p.estimatedCount]).sort((a, b) => a[0] - b[0]);
    assert.deepEqual(pick(withMore), pick(base));
});

// ---------------------------------------------------------------- Senaryolar (regresyon)
const finalFor = (c, i, n = 2) => ({ id: 7000 + i, date: `2027-01-${String(5 + (i % 20)).padStart(2, '0')}`, time: '10:00', duration: 120, type: 'Final', name: `MATH ${201 + c} - Güz Ders ${c}`, proctorIds: Array.from({ length: n }, (_, k) => ((i + k) % 12) + 1) });

test('Senaryo: ilk final girildiğinde tahmin çökmez', () => {
    const base = forecast(freshApp()).forecastSummary;
    const s = forecast(freshApp(fx => fx.exams.push(finalFor(0, 0)))).forecastSummary;
    assert.equal(s.projectedTotalFinals, base.projectedTotalFinals);
    assert.equal(s.projectedMazeretCount, base.projectedMazeretCount);
    assert.equal(s.remainingFinalCourses, base.remainingFinalCourses - 1);
    assert.ok(s.remainingFinalSlots < base.remainingFinalSlots && s.remainingFinalSlots > base.remainingFinalSlots * 0.8);
});

test('Senaryo: ikinci vizeler girilince tahmin şişmez', () => {
    const base = forecast(freshApp()).forecastSummary;
    const s = forecast(freshApp(fx => {
        fx.exams.filter(e => e.type === 'Vize' && e.date >= '2026-10-01').forEach((e, i) => {
            fx.exams.push(Object.assign({}, e, { id: 8000 + i, type: 'II. Vize', date: `2026-12-${String(10 + (i % 15)).padStart(2, '0')}` }));
        });
    })).forecastSummary;
    assert.equal(s.projectedTotalFinals, base.projectedTotalFinals);
    assert.equal(s.projectedMazeretCount, base.projectedMazeretCount);
    assert.equal(s.remainingFinalSlots, base.remainingFinalSlots);
});

test('Senaryo: "Final Mazeret" adlı sınav yalnızca mazeret sayılır', () => {
    const base = forecast(freshApp()).forecastSummary;
    const s = forecast(freshApp(fx => fx.exams.push({ id: 9100, date: '2027-01-25', time: '10:00', duration: 110, type: 'Mazeret', name: 'MATH 201 Final Mazeret', proctorIds: [3] }))).forecastSummary;
    assert.equal(s.projectedTotalFinals, base.projectedTotalFinals);
    assert.equal(s.enteredMazeretCount, 1);
    assert.equal(s.remainingMazeretToDistribute, base.remainingMazeretToDistribute - 1);
});

test('Senaryo: tüm finaller girilince muhtemel final kalmaz', () => {
    const s = forecast(freshApp(fx => { for (let c = 0; c < 26; c++) fx.exams.push(finalFor(c, c)); })).forecastSummary;
    assert.equal(s.remainingFinalCourses, 0);
    assert.equal(s.remainingFinalSlots, 0);
    assert.ok(s.remainingMazeretToDistribute > 0, 'mazeretler hâlâ beklenir');
});

test('Senaryo: tahminden fazla mazeret girilirse dağıtılacak mazeret 0 olur', () => {
    const d = forecast(freshApp(fx => {
        for (let k = 0; k < 20; k++) fx.exams.push({ id: 9200 + k, date: '2027-01-28', time: '10:00', duration: 110, type: 'Mazeret', name: `MATH ${201 + k} Mazeret`, proctorIds: [(k % 12) + 1] });
    }));
    assert.equal(d.forecastSummary.projectedMazeretCount, 20);
    assert.equal(d.forecastSummary.remainingMazeretToDistribute, 0);
    assert.equal(sum(d.proctorForecasts, 'estimatedMazeretCount'), 0);
});

test('Senaryo: geçmiş veri yokken kurumsal varsayılanlar kullanılır', () => {
    const d = forecast(freshApp(fx => { fx.exams = fx.exams.filter(e => e.date >= '2026-10-01'); }));
    assert.equal(d.history.overallRatio, 0.458);
    assert.equal(d.history.dataSufficiency.pastTermsCount, 0);
    assert.match(d.history.dataSufficiency.sufficiencyNote, /varsayılan/);
    assert.equal(d.forecastSummary.remainingDToDistribute, 0, 'D sınavı geçmişi yoksa tahmin edilmez');
});

// ---------------------------------------------------------------- Profil kartı
test('Profil kartı: kişi kendi kartını görür, başkasınınkini göremez', () => {
    const app = freshApp();
    const card = app.addElement('profile-final-forecast-card');
    card.classList.add('hidden');
    app.storage.local.setItem('myStaffId', '3');

    app.run('renderProfileFinalForecast(3)');
    assert.equal(card.classList.contains('hidden'), false);
    assert.match(card.innerHTML, /Muhtemel final sınavı görevi/);
    assert.match(card.innerHTML, /Muhtemel mazeret sınavı görevi/);
    assert.match(card.innerHTML, /Final dönemi sonuna kadar toplam/);
    assert.match(card.innerHTML, /<details class="forecast-details"/);

    app.run('renderProfileFinalForecast(5)');
    assert.equal(card.classList.contains('hidden'), true);
    assert.equal(card.innerHTML, '');
});

test('Profil kartı: isimdeki HTML kaçışlanır', () => {
    const app = freshApp(fx => { fx.exams.push({ id: 9300, date: '2026-11-30', time: '10:00', duration: 90, type: 'Vize', name: '<img src=x onerror=alert(1)>', proctorIds: [3] }); });
    const card = app.addElement('profile-final-forecast-card');
    app.storage.local.setItem('myStaffId', '3');
    app.run('renderProfileFinalForecast(3)');
    assert.ok(!card.innerHTML.includes('<img src=x'));
    assert.ok(card.innerHTML.includes('&lt;img src=x'));
});
