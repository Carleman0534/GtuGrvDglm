/**
 * Gözetmenin kendi aldığı sınavı bildirmesi → yönetici onayı.
 * Çalıştırma: node --test tests/sinav_bildirimi.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');
const { NOW, buildFixture } = require('./fixture');   // 8 Kasım 2026 12:00

const FILES = ['bildirim_kurallari.js', 'atama_destek.js', 'logic.js', 'final_forecast_engine.js', 'sinav_bildirimi.js'];

function freshApp(mutate) {
    const app = createApp({ now: NOW, files: FILES });
    const fx = buildFixture();
    if (mutate) mutate(fx);
    app.setDB(fx);
    // E-posta / anlık görüntü yan etkilerini etkisizleştir
    app.raw(`sendAssignmentEmail = async function() {}; window.sendAssignmentEmail = sendAssignmentEmail;`);
    return app;
}
const GECMIS = { name: 'MAT 999 Özel Sınav', type: 'Vize', date: '2026-11-04', time: '10:00', duration: 90, location: 'D-201', note: 'Hoca son anda istedi' };

test('Bildirim onay bekler; sınav listesine ve puana yansımaz', () => {
    const app = freshApp();
    const once = app.run('({ n: DB.exams.length, puan: DB.staff.find(s => s.id === 3).totalScore })');
    const r = app.run(`SinavBildirimi.olustur(3, ${JSON.stringify(GECMIS)})`);
    assert.equal(r.ok, true);
    assert.equal(r.kayit.status, 'pending');
    assert.equal(r.kayit.mevcutExamId, null);
    const sonra = app.run('({ n: DB.exams.length, puan: DB.staff.find(s => s.id === 3).totalScore, bek: SinavBildirimi.bekleyenler().length })');
    assert.equal(sonra.n, once.n, 'sınav eklenmez');
    assert.equal(sonra.puan, once.puan, 'puan değişmez');
    assert.equal(sonra.bek, 1);
    // Kayıt, diğer kayıt yollarıyla aynı işaretleri koyar (periyodik eşitleme yerel veriyi ezmesin)
    assert.equal(app.run('window._hasLocalEdits'), true);
    assert.ok(app.run('DB.lastUpdated'));
});

test('Onay: sınav gözetmen atanmış olarak eklenir, puana sayılır, süre onaylı kaydedilir, kişiye bildirim gider', () => {
    const app = freshApp();
    const once = app.run('DB.staff.find(s => s.id === 3).totalScore');
    const id = app.run(`SinavBildirimi.olustur(3, ${JSON.stringify(GECMIS)}).kayit.id`);
    const r = app.run(`SinavBildirimi.onayla('${id}', 'Yönetici')`);
    assert.equal(r.ok, true);
    assert.equal(r.yeni, true);
    const ex = app.run(`DB.exams.find(e => e.name === 'MAT 999 Özel Sınav')`);
    assert.deepEqual(ex.proctorIds.map(String), ['3']);
    assert.equal(ex.kaynak, 'gozetmen_bildirimi');
    assert.equal(ex.gozetmenSuresi_3.sure, 90, 'bitmiş sınavda gözetmenin süresi onaylı');
    const puan = app.run('DB.staff.find(s => s.id === 3).totalScore');
    assert.ok(Math.abs(puan - once - ex.score) < 0.05, 'puan sınav puanı kadar artar');
    const k = app.run(`SinavBildirimi.kisininkiler(3)[0]`);
    assert.equal(k.status, 'approved');
    assert.equal(String(k.examId), String(ex.id));
    const bild = app.run(`DB.notifications['3'][0]`);
    assert.match(bild.message, /onaylandı/);
    // Süre teyidi tekrar istenmez
    assert.equal(app.run(`BildirimKurallari.sureTeyidiBekliyor(DB.exams.find(e => e.name === 'MAT 999 Özel Sınav'), Date.now(), 3)`), false);
});

test('Sistemde aynı sınav varsa: bildirimde bulunur, onayda gözetmen o sınava eklenir (yeni sınav açılmaz)', () => {
    const app = freshApp(fx => {
        fx.exams.push({ id: 9800, name: 'MAT 555 Diferansiyel Denklemler', date: '2026-11-05', time: '13:30', duration: 120, type: 'Vize', proctorIds: [1], proctorId: 1 });
    });
    const r = app.run(`SinavBildirimi.olustur(4, { name: 'mat 555', date: '2026-11-05', time: '13:30', duration: 120 })`);
    assert.equal(r.ok, true);
    assert.equal(String(r.kayit.mevcutExamId), '9800');
    const n = app.run('DB.exams.length');
    const o = app.run(`SinavBildirimi.onayla('${r.kayit.id}', 'Yönetici')`);
    assert.equal(o.ok, true);
    assert.equal(o.yeni, false);
    assert.equal(app.run('DB.exams.length'), n, 'yeni sınav açılmaz');
    assert.deepEqual(app.run('DB.exams.find(e => e.id === 9800).proctorIds').map(String), ['1', '4']);
});

test('Hatalı ya da tekrarlanan bildirim kabul edilmez; zaten görevli olduğu sınav bildirilemez', () => {
    const app = freshApp(fx => {
        fx.exams.push({ id: 9801, name: 'MAT 556 Lineer Cebir', date: '2026-11-06', time: '09:30', duration: 90, type: 'Vize', proctorIds: [5], proctorId: 5 });
    });
    assert.equal(app.run(`SinavBildirimi.olustur(3, { name: '', date: '2026-11-04', time: '10:00', duration: 90 }).ok`), false);
    assert.equal(app.run(`SinavBildirimi.olustur(3, { name: 'X sınavı', date: '2026-11-04', time: '10:00', duration: 5 }).ok`), false, 'süre çok kısa');
    assert.equal(app.run(`SinavBildirimi.olustur(3, { name: 'X sınavı', date: '2024-01-01', time: '10:00', duration: 90 }).ok`), false, 'bir yıldan eski');
    assert.equal(app.run(`SinavBildirimi.olustur(99, ${JSON.stringify(GECMIS)}).ok`), false, 'personel yok');
    const zaten = app.run(`SinavBildirimi.olustur(5, { name: 'MAT 556 Lineer Cebir', date: '2026-11-06', time: '09:30', duration: 90 })`);
    assert.equal(zaten.ok, false);
    assert.match(zaten.hatalar.join(' '), /zaten görevlisiniz/);
    assert.equal(app.run(`SinavBildirimi.olustur(3, ${JSON.stringify(GECMIS)}).ok`), true);
    assert.equal(app.run(`SinavBildirimi.olustur(3, ${JSON.stringify(GECMIS)}).ok`), false, 'aynı saat için ikinci bekleyen bildirim');
});

test('Ret gerekçesi kişiye iletilir; geri çekme yalnızca sahibine ve bekleyen kayda açık', () => {
    const app = freshApp();
    const a = app.run(`SinavBildirimi.olustur(3, ${JSON.stringify(GECMIS)}).kayit.id`);
    const r = app.run(`SinavBildirimi.reddet('${a}', 'Yönetici', 'Bu sınav bölümümüze ait değil')`);
    assert.equal(r.ok, true);
    assert.match(app.run(`DB.notifications['3'][0].message`), /Gerekçe: Bu sınav bölümümüze ait değil/);
    assert.equal(app.run(`SinavBildirimi.onayla('${a}', 'Yönetici').ok`), false, 'reddedilen onaylanamaz');
    const b = app.run(`SinavBildirimi.olustur(3, { name: 'MAT 998 Başka', date: '2026-11-03', time: '14:00', duration: 60 }).kayit.id`);
    assert.equal(app.run(`SinavBildirimi.geriCek('${b}', 4).ok`), false, 'başkası geri çekemez');
    assert.equal(app.run(`SinavBildirimi.geriCek('${b}', 3).ok`), true);
    assert.equal(app.run(`SinavBildirimi.bekleyenler().length`), 0);
});

test('Gelecekteki sınav: onayda süre kaydı yazılmaz (sınav bitince normal teyit akışı)', () => {
    const app = freshApp();
    const id = app.run(`SinavBildirimi.olustur(2, { name: 'MAT 997 Gelecek', date: '2026-11-20', time: '10:00', duration: 120 }).kayit.id`);
    assert.equal(app.run(`SinavBildirimi.onayla('${id}', 'Yönetici').ok`), true);
    const ex = app.run(`DB.exams.find(e => e.name === 'MAT 997 Gelecek')`);
    assert.equal(ex.gozetmenSuresi_2, undefined);
    assert.deepEqual(ex.proctorIds.map(String), ['2']);
});

test('Yöneticiye haber: e-postası yönetici listesinde olan personele hedefli telefon bildirimi (duyuru) ve hazır e-posta', () => {
    const app = freshApp(fx => {
        fx.staff.find(s => s.id === 12).email = 'yonetici@ornek.edu.tr';
        fx.sinavBildirimiAyar = { eposta: ['Yonetici@ornek.edu.tr'] };
    });
    const r = app.run(`SinavBildirimi.olustur(3, ${JSON.stringify(GECMIS)})`);
    assert.equal(r.kayit.yoneticiyeBildirim, 1);
    const bc = app.run(`DB.adminBroadcasts[0]`);
    assert.deepEqual(bc.target, ['12'], 'yalnızca yöneticiye');
    assert.equal(bc.pushToDevice, true, 'telefonlara gönderilir');
    assert.equal(bc.kaynak, 'sinav_bildirimi');
    assert.match(bc.message, /MAT 999 Özel Sınav/);
    assert.equal(app.run(`BildirimKurallari.duyuruHedefMi(DB, DB.adminBroadcasts[0], '12')`), true);
    assert.equal(app.run(`BildirimKurallari.duyuruHedefMi(DB, DB.adminBroadcasts[0], '3')`), false, 'diğer gözetmenlere gitmez');
    const mail = app.run(`SinavBildirimi.epostaBaglantisi(SinavBildirimi.kisininkiler(3)[0])`);
    assert.match(mail, /^mailto:yonetici@ornek\.edu\.tr\?subject=/);
    assert.match(decodeURIComponent(mail), /MAT 999 Özel Sınav/);
});

test('Yönetici e-postası tanımlı değilse duyuru oluşturulmaz, e-posta bağlantısı boş', () => {
    const app = freshApp();
    const r = app.run(`SinavBildirimi.olustur(3, ${JSON.stringify(GECMIS)})`);
    assert.equal(r.kayit.yoneticiyeBildirim, 0);
    assert.equal(app.run(`(DB.adminBroadcasts || []).filter(b => b.kaynak === 'sinav_bildirimi').length`), 0);
    assert.equal(app.run(`SinavBildirimi.epostaBaglantisi(SinavBildirimi.kisininkiler(3)[0])`), '');
});