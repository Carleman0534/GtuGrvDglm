/**
 * Takas teklifi onayını kolaylaştırma: bekleyen teklifler ve telefon hatırlatma kuralları (bildirim_kurallari.js).
 * Çalıştırma: node --test tests/takas_hatirlatma.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../bildirim_kurallari.js');

const NOW = Date.parse('2026-11-13T12:00:00+03:00');
const SAAT = 3600000;
const iso = (ms) => new Date(ms).toISOString();

function db(requests) {
    return {
        exams: [
            { id: 1, name: 'MAT 101', date: '2026-11-16', time: '09:30', duration: 90, proctorIds: [12] },
            { id: 2, name: 'MAT 202', date: '2026-11-18', time: '13:30', duration: 90, proctorIds: [4] },
            { id: 3, name: 'MAT 303', date: '2026-11-14', time: '10:00', duration: 90, proctorIds: [5] },   // yarın (22 saat sonra)
            { id: 4, name: 'GEÇMİŞ', date: '2026-11-10', time: '10:00', duration: 90, proctorIds: [5] }
        ],
        requests
    };
}
const adalet = (o) => Object.assign({ id: 'p1', type: 'p2p_fairness_swap', status: 'pending_peers', fromStaffId: 12, fromStaffName: 'Yasin', fromExamId: 1, toStaffId: 4, toStaffName: 'Aslı', toExamId: 2, fromApproved: false, toApproved: false, createdAt: iso(NOW - 2 * SAAT) }, o);

test('Adalet takasında onaylamayan her iki taraf da bekleyen olarak listelenir; vereceği / alacağı doğru', () => {
    const b = K.takasBekleyenleri(db([adalet()]), NOW);
    assert.equal(b.length, 2);
    const y = b.find(x => x.pid === '12');
    assert.equal(y.verilecek.name, 'MAT 101');
    assert.equal(y.alinacak.name, 'MAT 202');
    assert.equal(y.karsiAd, 'Aslı');
    assert.equal(y.karsiOnayladi, false);
    // Biri onaylayınca yalnızca diğeri kalır, "karşı taraf onayladı" bilgisiyle
    const b2 = K.takasBekleyenleri(db([adalet({ toApproved: true })]), NOW);
    assert.deepEqual(b2.map(x => x.pid), ['12']);
    assert.equal(b2[0].karsiOnayladi, true);
});

test('Tüm türler: doğrudan, akıllı, adalet devri, pazar yeri devri; sınavı geçmiş / sonuçlanmış teklif listelenmez', () => {
    const b = K.takasBekleyenleri(db([
        { id: 'd1', type: 'direct_swap', status: 'pending_peer', initiatorId: 4, initiatorName: 'Aslı', initiatorExamId: 2, receiverId: 12, receiverExamId: 1, createdAt: iso(NOW) },
        { id: 's1', type: 'smart_swap', status: 'pending', initiatorId: 4, initiatorName: 'Aslı', examId: 2, receiverId: 12, targetExamId: 1, createdAt: iso(NOW) },
        { id: 't1', type: 'p2p_fairness_transfer', status: 'pending_receiver', fromStaffId: 4, fromStaffName: 'Aslı', fromExamId: 2, toStaffId: 12, toApproved: false, createdAt: iso(NOW) },
        { id: 'm1', type: 'market', status: 'claim_pending', initiatorId: 12, examId: 1, receiverId: 4, receiverName: 'Aslı', createdAt: iso(NOW) },
        { id: 'x1', type: 'direct_swap', status: 'pending_peer', initiatorId: 4, initiatorExamId: 4, receiverId: 12, receiverExamId: 1, createdAt: iso(NOW) },   // geçmiş sınav
        { id: 'x2', type: 'direct_swap', status: 'approved', initiatorId: 4, initiatorExamId: 2, receiverId: 12, receiverExamId: 1, createdAt: iso(NOW) }
    ]), NOW).filter(x => x.pid === '12');
    assert.deepEqual(b.map(x => x.tip).sort(), ['adalet_devir', 'akilli', 'dogrudan', 'pazar_devir']);
    const devir = b.find(x => x.tip === 'adalet_devir');
    assert.equal(devir.verilecek, null);
    assert.equal(devir.alinacak.name, 'MAT 202');
});

test('Hatırlatma: 12 saat yanıtsız → bir kez; gönderildiyse tekrar etmez', () => {
    const veri = db([adalet({ createdAt: iso(NOW - 13 * SAAT) })]);
    const h = K.takasHatirlatmalari(veri, NOW, {}, 'https://site/GtuGrvDglm/');
    assert.equal(h.length, 2);
    assert.ok(h.every(x => x.tur === '12s'));
    assert.match(h[0].payload.body, /12 saattir onayınızı bekliyor/);
    assert.equal(h[0].payload.data.tur, K.TUR.TAKAS_TEKLIF);
    assert.match(h[0].payload.data.url, /^https:\/\/site\/GtuGrvDglm\/\?tab=swap-history&requestId=p1$/);
    const durum = Object.fromEntries(h.map(x => [x.anahtar, iso(NOW)]));
    assert.equal(K.takasHatirlatmalari(veri, NOW + SAAT, durum).length, 0);
    // 12 saat dolmadan hatırlatma yok
    assert.equal(K.takasHatirlatmalari(db([adalet()]), NOW, {}).length, 0);
});

test('Hatırlatma: karşı taraf onaylayınca "sizin onayınız bekleniyor"; sınava 24 saatten az kala "son" önceliklidir', () => {
    const h = K.takasHatirlatmalari(db([adalet({ toApproved: true })]), NOW, {});
    assert.deepEqual(h.map(x => [x.pid, x.tur]), [['12', 'karsi']]);
    assert.match(h[0].payload.body, /Aslı takası onayladı; yalnızca sizin onayınız bekleniyor/);

    const yakin = db([adalet({ fromExamId: 3, fromStaffId: 5, toApproved: true, createdAt: iso(NOW - 30 * SAAT) })]);
    const h2 = K.takasHatirlatmalari(yakin, NOW, {});
    assert.deepEqual(h2.map(x => [x.pid, x.tur]), [['5', 'son']]);
    // "son" gönderildikten sonra 12 saat hatırlatması ayrıca gönderilmez; karşı taraf bildirimi bir kez gider
    const sonrasi = K.takasHatirlatmalari(yakin, NOW + SAAT, { [h2[0].anahtar]: iso(NOW) });
    assert.deepEqual(sonrasi.map(x => x.tur), ['karsi']);
});

test('Akıllı takasın ilk bildirimi de gider (diğer türlerin ilk bildirimi zaten var)', () => {
    const h = K.takasHatirlatmalari(db([
        { id: 's1', type: 'smart_swap', status: 'pending', initiatorId: 4, initiatorName: 'Aslı', examId: 2, receiverId: 12, targetExamId: 1, createdAt: iso(NOW) },
        { id: 'd1', type: 'direct_swap', status: 'pending_peer', initiatorId: 4, initiatorName: 'Aslı', initiatorExamId: 2, receiverId: 12, receiverExamId: 1, createdAt: iso(NOW) }
    ]), NOW, {});
    assert.deepEqual(h.map(x => [x.payload.tag, x.tur]), [['gtu_takas_s1_12', 'ilk']]);
});
