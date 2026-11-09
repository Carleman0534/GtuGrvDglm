/**
 * Yönetici duyuruları: yalnızca seçilen kişilere gitmeli.
 * Site (panel + açılışta gösterim), GitHub iş akışı aynı kuralı (BildirimKurallari.duyuruHedefleri) kullanır.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createApp, ROOT } = require('./harness');
const { NOW, buildFixture } = require('./fixture');
const K = require(path.join(ROOT, 'bildirim_kurallari.js'));

const bc = (o) => Object.assign({ id: 'bc_1', title: 'Başlık', message: 'Mesaj metni', createdAt: '2026-11-09T08:00:00.000Z' }, o);

test('duyuruHedefleri: herkes / tek kişi / çoklu seçim', () => {
    assert.equal(K.duyuruHedefleri({}, bc({ target: 'all' })), null);
    assert.equal(K.duyuruHedefleri({}, bc({})), null, 'hedefsiz eski kayıt → herkes');
    assert.deepEqual(K.duyuruHedefleri({}, bc({ target: '9' })), ['9']);
    assert.deepEqual(K.duyuruHedefleri({}, bc({ target: ['4', 5] })), ['4', '5']);
    assert.deepEqual(K.duyuruHedefleri({}, bc({ target: { 0: '4', 1: '5' } })), ['4', '5'], 'Firebase diziyi nesneye çevirse de');
});

test('duyuruHedefMi: seçilmeyen kişi ve kimliği olmayan cihaz almaz', () => {
    const b = bc({ target: ['4', '5'] });
    assert.equal(K.duyuruHedefMi({}, b, '4'), true);
    assert.equal(K.duyuruHedefMi({}, b, 5), true);
    assert.equal(K.duyuruHedefMi({}, b, '9'), false);
    assert.equal(K.duyuruHedefMi({}, b, null), false, 'kimliği olmayan cihaz');
    assert.equal(K.duyuruHedefMi({}, bc({ target: 'all' }), null), true, 'genel duyuru herkese');
});

test('Yarın sınavı olanlar: gönderim gününe göre, bakıldığı güne göre değil', () => {
    const db = { exams: [
        { id: 1, date: '2026-11-10', time: '10:00', proctorIds: [1, 2] },
        { id: 2, date: '2026-11-12', time: '10:00', proctorIds: [3] }
    ] };
    // 9 Kasım'da gönderildi → 10 Kasım'da sınavı olanlar
    assert.deepEqual(K.duyuruHedefleri(db, bc({ target: 'tomorrow_only' })).sort(), ['1', '2']);
    // Günler sonra bakılsa da kişi 3'e geçmez
    assert.equal(K.duyuruHedefMi(db, bc({ target: 'tomorrow_only' }), '3'), false);
    // Gönderimde dondurulmuş liste önceliklidir
    assert.deepEqual(K.duyuruHedefleri(db, bc({ target: 'tomorrow_only', hedefIdleri: ['7'] })), ['7']);
});

function adminApp(deviceStaffId) {
    const app = createApp({ now: NOW });
    const fx = buildFixture();
    fx.adminBroadcasts = [
        bc({ id: 'bc_secili', target: ['1'] }),
        bc({ id: 'bc_herkes', target: 'all' })
    ];
    app.setDB(fx);
    if (deviceStaffId) app.storage.local.setItem('myDeviceStaffId', String(deviceStaffId));
    return app;
}

test('Bildirim paneli: seçilmeyen kişi kişiye özel duyuruyu görmez', () => {
    const app = adminApp(3);
    // Yalnızca DB üzerinde süzme mantığını sınar (BildirimKurallari site paketinde)
    const ids = app.run(`DB.adminBroadcasts.filter(b => BildirimKurallari.duyuruHedefMi(DB, b, getDeviceStaffId())).map(b => b.id)`);
    assert.deepEqual(ids, ['bc_herkes']);
    const app1 = adminApp(1);
    assert.deepEqual(app1.run(`DB.adminBroadcasts.filter(b => BildirimKurallari.duyuruHedefMi(DB, b, getDeviceStaffId())).map(b => b.id)`), ['bc_secili', 'bc_herkes']);
});

test('Yönetici profil gezerken başkasına özel duyuru onun cihazına düşmez', () => {
    const app = adminApp(null);
    app.storage.session.setItem('isAdmin', 'true');
    app.storage.local.setItem('myStaffId', '1'); // yönetici kişi 1'in profiline bakıyor
    assert.equal(app.run('getDeviceStaffId()'), null);
    assert.deepEqual(app.run(`DB.adminBroadcasts.filter(b => BildirimKurallari.duyuruHedefMi(DB, b, getDeviceStaffId())).map(b => b.id)`), ['bc_herkes']);
});
