/**
 * "Neden ben?" açıklaması: doğru havuz, güncel atama kuralı, eski görevlerde yanıltıcı sayı yok.
 * Çalıştırma: node --test tests/atama_gerekce.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');
const { NOW, buildFixture } = require('./fixture');

const FILES = ['bildirim_kurallari.js', 'atama_destek.js', 'logic.js', 'final_forecast_engine.js', 'atama_gerekce.js'];
const ALL_DAY = (days) => days.map(day => ({ day, allDay: true }));
const NAME = (i) => `Arş. Gör. Test${String.fromCharCode(65 + i)} Kişi`;

function freshApp(mutate) {
    const app = createApp({ now: NOW, files: FILES });
    const fx = buildFixture();
    fx.exams.push({ id: 9500, name: 'GELECEK SINAV', date: '2026-11-20', time: '10:00', duration: 120, type: 'Final', proctorIds: [3], proctorId: 3 });
    fx.exams.push({ id: 9501, name: 'Tanıtım Günü', date: '2026-11-21', time: '10:00', duration: 180, type: 'Diğer', isNonExam: true, proctorIds: [3], proctorId: 3 });
    if (mutate) mutate(fx);
    app.setDB(fx);
    app.raw('recalculateAllScores();');
    return app;
}

test('Karşılaştırma yalnızca aktif gözetmenlerle (gözetmenlik almayan öğretim üyeleri sayılmaz)', () => {
    const app = freshApp();
    const snap = app.run(`atamaGerekcesiFotografi(DB.exams.find(e => e.id === 9500), 3, 'otomatik')`);
    assert.equal(snap.n, 12, 'fixture: 12 asistan + 2 öğretim üyesi → yalnızca 12 asistan');
    // Puanı 0 olan öğretim üyeleri "sıralamada önde" sayılmamalı
    assert.ok(snap.d < 12);
});

test('Sınav görevinde kural "dönem sonu beklenen puan", sınav dışı görevde "sınav dışı puan"', () => {
    const app = freshApp();
    const sinav = app.run(`atamaGerekcesiFotografi(DB.exams.find(e => e.id === 9500), 3, 'otomatik')`);
    assert.equal(sinav.k, 'donem');
    assert.ok(typeof sinav.bp === 'number' && sinav.bp > 0, 'kalan dönemde beklenen pay kaydedilir');
    const disi = app.run(`atamaGerekcesiFotografi(DB.exams.find(e => e.id === 9501), 3, 'otomatik')`);
    assert.equal(disi.k, 'sinavdisi');
    assert.equal(disi.bp, undefined);
    // Sınav dışı görevde karşılaştırılan puan sınav dışı puandır (bu görev hariç)
    const staff = app.run('DB.staff.find(s => s.id === 3)');
    const ex = app.run('DB.exams.find(e => e.id === 9501)');
    assert.equal(disi.p, Math.round(((staff.nonExamScore || 0) - ex.score) * 100) / 100);
});

test('Kalan dönemde az müsait kişide öncelik gerekçesi kaydedilir ve gösterilir', () => {
    const app = freshApp(fx => { fx.constraints[NAME(2)] = ALL_DAY([0, 1, 2, 3, 4, 5]); }); // id 3: yalnızca Cumartesi
    const snap = app.run(`atamaGerekcesiFotografi(DB.exams.find(e => e.id === 9500), 3, 'otomatik')`);
    assert.equal(snap.kz, true);
    app.raw(`const ex = DB.exams.find(e => e.id === 9500); ex.atamaGerekce = { '3': atamaGerekcesiFotografi(ex, 3, 'otomatik') };`);
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /dönem sonu beklenen puana/);
    assert.match(html, /önceliğiniz yükseldi/);
});

test('Kaydı olmayan eski görevde o güne ait yanıltıcı karşılaştırma gösterilmez', () => {
    const app = freshApp();
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /tutulmaya başlamadan önce/);
    assert.doesNotMatch(html, /sizden önde <strong>\d+<\/strong> kişi vardı/);
    assert.doesNotMatch(html, /uygun görünüyordu/);
    assert.match(html, /bugün<\/strong>/);
});

test('Kayıtlı görevde kural ve "sıralamada sizden önde" listesi gösterilir', () => {
    const app = freshApp();
    // id 12 (en yüksek taban puan) için kayıt: önünde başkaları olur
    app.raw(`const ex = DB.exams.find(e => e.id === 9500); ex.proctorIds = [12]; ex.proctorId = 12; ex.atamaGerekce = { '12': atamaGerekcesiFotografi(ex, 12, 'yonetici') };`);
    const snap = app.run(`DB.exams.find(e => e.id === 9500).atamaGerekce['12']`);
    assert.ok(snap.d > 0);
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 12)`);
    assert.match(html, /Yönetici bu görevi elle atadı/);
    assert.match(html, new RegExp(`sizden önde <strong>${snap.d}</strong> kişi vardı`));
    assert.doesNotMatch(html, /tutulmaya başlamadan önce/);
});

test('Eski biçimde (kural alanı olmayan) kayıt "toplam puan" kuralıyla açıklanır', () => {
    const app = freshApp();
    app.raw(`const ex = DB.exams.find(e => e.id === 9500); ex.atamaGerekce = { '3': { y: 'otomatik', t: '2026-11-12T10:00:00Z', p: 3000, r: 1, n: 12, d: 0, s: {} } };`);
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /toplam puana/);
    assert.match(html, /sıralamada sizden önde kimse yoktu/);
});
