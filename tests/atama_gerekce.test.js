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
    assert.match(html, /dönem sonu beklenen puan/);
    assert.match(html, /önceliğiniz yükseldi/);
});

test('Kaydı olmayan eski görevde somut sayılar verilir, "bugünkü puanlara göre" diye etiketlenir', () => {
    const app = freshApp();
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /📌 Sıralamada <strong>\d+\.<\/strong> sıradaydınız \(bugünkü puanlara göre, 12 gözetmen\)/);
    assert.match(html, /Sıralama \(bugünkü puanlara göre\)/);
    assert.match(html, /atama anı kaydı yok/);
    assert.doesNotMatch(html, /Sistem otomatik atadı/, 'yöntem bilinmiyor: tahmin edilmez');
});

test('O saatteki durum takvimden somut olarak sayılır (toplam = diğer gözetmenler)', () => {
    const app = freshApp(fx => {
        fx.exams.push({ id: 9502, name: 'AYNI SAAT', date: '2026-11-20', time: '10:30', duration: 60, type: 'Vize', proctorIds: [5, 6], proctorId: 5 });
        fx.constraints[NAME(7)] = ALL_DAY([5]); // id 8: Cuma (20.11.2026) kısıtlı
    });
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /için diğer 11 gözetmen/);
    const n = (re) => { const m = html.match(re); return m ? Number(m[1]) : 0; };
    const cak = n(/<strong>(\d+) kişi<\/strong> aynı saatte başka bir sınavda görevli/);
    assert.ok(cak >= 2, 'AYNI SAAT sınavındaki 2 kişi çakışmalı sayılır');
    assert.equal(n(/<strong>(\d+) kişi<\/strong> o saatte kısıtlı/), 1);
    // Toplam = diğer gözetmen sayısı
    const toplam = [...html.matchAll(/<li><strong>(\d+) kişi<\/strong>/g)].slice(0, 7).reduce((a, m) => a + Number(m[1]), 0);
    assert.ok(toplam >= 11);
});

test('"Neden siz?": uygun olanların hepsi sıralamada sonra ise bunu ve en yakın farkı söyler', () => {
    const app = freshApp();
    // id 3'ü en düşük puanlı yap: uygun olanların hepsi ondan sonra gelir
    app.raw(`DB.staff.find(s => s.id === 3).totalScore = 100;`);
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /Neden siz\?/);
    assert.match(html, /kişinin hepsi<\/strong> sıralamada sizden sonra geliyor/);
    assert.match(html, /size en yakın kişinin .* <strong>[\d,]+ puan<\/strong> yüksek/);
});

test('"Neden siz?": bugünkü puanlarla önde olan uygun kişi varsa sayısını ve nedenini söyler', () => {
    const app = freshApp();
    app.raw(`DB.staff.find(s => s.id === 3).totalScore = 99999;`);   // en yüksek puanlı: uygun olanlar önde
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /kişiden <strong>\d+ kişi<\/strong> sıralamada sizden önde/);
    assert.match(html, /Görev atandığı gün puanlar farklıydı/);
    assert.match(html, /bugünkü puanlara göre/);
});

test('"Neden siz?": kayıtlı atamada atama anındaki sayı ve yöntem kullanılır', () => {
    const app = freshApp();
    app.raw(`const ex = DB.exams.find(e => e.id === 9500); ex.atamaGerekce = { '3': { y: 'otomatik', t: '2026-11-07T10:00:00Z', k: 'donem', p: 3000, r: 1, n: 12, d: 0, s: {} } };`);
    let html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /Atama anında o saatte uygun olup sıralamada sizden önde olan <strong>kimse yoktu<\/strong>/);
    app.raw(`DB.exams.find(e => e.id === 9500).atamaGerekce['3'] = { y: 'yonetici', t: '2026-11-07T10:00:00Z', k: 'donem', p: 3000, r: 4, n: 12, d: 3, s: { uygun: 2, kisit: 1 } };`);
    html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /sizden önde olan <strong>2 kişi<\/strong> vardı\. Görevi yönetici elle atadığı için sıra uygulanmadı/);
});

test('Herkes görev üst sınırını aşmışsa "üst sınırda" denmez (atama sınırı esnetir)', () => {
    const app = freshApp();
    const tasks = app.run('DB.staff.filter(s => s.id <= 12).map(s => s.taskCount)');
    assert.ok(tasks.every(t => t >= 6), 'fixture: herkes 6+ görevde');
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.doesNotMatch(html, /görev üst sınırında/);
    assert.doesNotMatch(html, /görev üst sınırına ulaşmıştı/);
});

test('Dönemdeki yer: puan, ortalama, görev sayısı ve "bu görev olmasaydı" verilir', () => {
    const app = freshApp();
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    const s = app.run('DB.staff.find(x => x.id === 3)');
    assert.match(html, /Genel durumunuz/);
    assert.match(html, new RegExp(`Toplam görev sayınız <strong>${s.taskCount}</strong>`));
    assert.match(html, /Bu görev olmasaydı: puanınız/);
    assert.match(html, /akşam \/ hafta sonu göreviniz/);
});

test('Kayıtlı görevde yöntem, kural ve "önünüzdeki kişiler" listesi gösterilir', () => {
    const app = freshApp();
    // id 12 (en yüksek taban puan) için kayıt: önünde başkaları olur
    app.raw(`const ex = DB.exams.find(e => e.id === 9500); ex.proctorIds = [12]; ex.proctorId = 12; ex.atamaGerekce = { '12': atamaGerekcesiFotografi(ex, 12, 'yonetici') };`);
    const snap = app.run(`DB.exams.find(e => e.id === 9500).atamaGerekce['12']`);
    assert.ok(snap.d > 0);
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 12)`);
    assert.match(html, /Yönetici bu görevi elle atadı/);
    assert.match(html, /Sıralama \(atama anında\)/);
    assert.match(html, new RegExp(`Önünüzdeki <strong>${snap.d}</strong> kişi`));
    assert.doesNotMatch(html, /atama anı kaydı yok/);
});

test('Eski biçimde (kural alanı olmayan) kayıt "toplam puan" kuralıyla açıklanır', () => {
    const app = freshApp();
    app.raw(`const ex = DB.exams.find(e => e.id === 9500); ex.atamaGerekce = { '3': { y: 'otomatik', t: '2026-11-12T10:00:00Z', p: 3000, r: 1, n: 12, d: 0, s: {} } };`);
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /<strong>toplam puan<\/strong>/);
    assert.match(html, /sizden önde kimse yoktu/);
});

test('Atama anındaki tablo: herkesin durumu, kısıt saatleri ve sistemin önerisi kaydedilir ve isimlerle gösterilir', () => {
    const app = freshApp(fx => {
        // 20.11.2026 Cuma; 4 numara o gün 09:00–12:00 kısıtlı, 5 numara aynı saatte başka sınavda
        fx.constraints[NAME(3)] = [{ day: 5, start: '09:00', end: '12:00' }];
        fx.exams.push({ id: 9510, name: 'AYNI SAAT', date: '2026-11-20', time: '10:30', duration: 60, type: 'Vize', proctorIds: [5], proctorId: 5 });
    });
    const snap = app.run(`atamaGerekcesiFotografi(DB.exams.find(e => e.id === 9500), 3, 'otomatik')`);
    assert.equal(snap.l.length, 11, 'kendisi dışındaki 11 aktif gözetmen');
    const row = (id) => snap.l.find(x => String(x[0]) === String(id));
    assert.equal(row(4)[1], 'k');
    assert.equal(row(4)[4], 'Cum (her hafta) 09:00–12:00', 'kısıtın saati kaydedilir');
    // Sınav gözetmenliğinde o anki puan sınav gözetmenliği puanıdır (sınav dışı puan katılmaz)
    const staff = app.run('DB.staff');
    snap.l.forEach(x => {
        const s = staff.find(y => String(y.id) === String(x[0]));
        assert.equal(x[3], Math.round((s.totalScore || 0) * 100) / 100, `${s.name}: sınav gözetmenliği puanı`);
    });
    assert.equal(row(5)[1], 'c');
    assert.ok(typeof snap.sk === 'number');
    // Sayılar tabloyla tutarlı: önündeki (değeri düşük) kişilerin durum dağılımı
    const once = snap.l.filter(x => x[1] !== 'b' && x[2] < snap.sk - 0.005);
    assert.equal(once.length, snap.d);
    assert.equal(once.filter(x => x[1] === 'u').length, snap.s.uygun || 0);

    app.raw(`const ex = DB.exams.find(e => e.id === 9500); ex.atamaGerekce = { '3': atamaGerekcesiFotografi(ex, 3, 'otomatik') };`);
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /Atama anındaki tablo/);
    assert.match(html, /<th>Sınav gözetmenliği puanı \(atama anında\)<\/th>/);
    assert.match(html, /karşılaştırma yalnızca <strong>sınav gözetmenliği puanlarıyla<\/strong>/);
    assert.match(html, new RegExp(NAME(3).replace(/\./g, '\\.') + '<\\/td><td>[\\d,]+(?:<small[^>]*>[^<]*<\\/small>)?<\\/td><td>🚫 Kısıtı vardı <span class="atama-gerekce-kisit">\\(Cum \\(her hafta\\) 09:00–12:00\\)'));
    assert.match(html, /👉 <strong>Siz — görev size verildi<\/strong>/);
    // Sistemin önerisi: uygun olanlar + atanan kişi arasında değeri en düşük olan
    const uygunlar = snap.l.filter(x => x[1] === 'u').map(x => x[2]);
    if (uygunlar.every(v => v >= snap.sk - 0.005)) assert.match(html, /önerdiği kişi <strong>sizdiniz<\/strong>/);
    else assert.match(html, /sistemin önerisi <strong>/);
});

test('Tablo kaydı olmayan eski atamada tablo bugünkü verilerle hesaplanır ve öyle etiketlenir', () => {
    const app = freshApp();
    app.raw(`const ex = DB.exams.find(e => e.id === 9500); const s = atamaGerekcesiFotografi(ex, 3, 'otomatik'); delete s.l; delete s.sk; ex.atamaGerekce = { '3': s };`);
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9500), 3)`);
    assert.match(html, /Tablo \(bugünkü verilerle — bu atamanın anlık kaydı yok\)/);
});
test('Sınav dışı görevde tablo sınav dışı görev puanlarını gösterir (sınav gözetmenliği puanı karışmaz)', () => {
    const app = freshApp();
    const snap = app.run(`atamaGerekcesiFotografi(DB.exams.find(e => e.id === 9501), 3, 'otomatik')`);
    assert.equal(snap.k, 'sinavdisi');
    const staff = app.run('DB.staff');
    snap.l.forEach(x => {
        const s = staff.find(y => String(y.id) === String(x[0]));
        assert.equal(x[3], Math.round((s.nonExamScore || 0) * 100) / 100, `${s.name}: sınav dışı puanı`);
        assert.equal(x[2], x[3], 'sınav dışında sıralama değeri = sınav dışı puanı');
    });
    app.raw(`const ex = DB.exams.find(e => e.id === 9501); ex.atamaGerekce = { '3': atamaGerekcesiFotografi(ex, 3, 'otomatik') };`);
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9501), 3)`);
    assert.match(html, /<th>Sınav dışı görev puanı \(atama anında\)<\/th>/);
    assert.match(html, /karşılaştırma yalnızca <strong>sınav dışı görev puanlarıyla<\/strong>/);
    assert.doesNotMatch(html, /beklenen pay [\d,]+ =/, 'sınav dışında beklenen pay eklenmez');
});
test('Tablo puanı en yüksekten en düşüğe sıralar; birlikte görevli olanlar en altta', () => {
    const app = freshApp(fx => {
        fx.exams.push({ id: 9520, name: 'ORTAK', date: '2026-11-25', time: '10:00', duration: 90, type: 'Vize', proctorIds: [3, 7], proctorId: 3 });
    });
    app.raw(`const ex = DB.exams.find(e => e.id === 9520); ex.atamaGerekce = { '3': atamaGerekcesiFotografi(ex, 3, 'otomatik') };`);
    const html = app.run(`atamaGerekcesiHtml(DB.exams.find(e => e.id === 9520), 3)`);
    const tbody = html.split('<tbody>')[1].split('</tbody>')[0];
    const rows = tbody.split('</tr>').filter(r => r.includes('<td>'));
    const deger = (r) => { const td = r.split('<td>')[3]; const m = td.match(/= ([\d.,]+)<\/small>/) || td.match(/^([\d.,]+)/); return parseFloat(m[1].replace(/\./g, '').replace(',', '.')); };
    const ana = rows.filter(r => !r.includes('Bu sınavda birlikte'));
    for (let i = 1; i < ana.length; i++) assert.ok(deger(ana[i - 1]) >= deger(ana[i]), 'en yüksekten en düşüğe');
    assert.ok(rows[rows.length - 1].includes('Bu sınavda birlikte'), 'birlikte görevli en altta');
    assert.match(rows[0], /<td>1<\/td>/);
    assert.match(html, /en yüksekten en düşüğe/);
});