/**
 * Yönetici "Takılan işler" kutusu: uzun süredir bekleyen işler ve günde bir hatırlatma.
 * Çalıştırma: node --test tests/takilan_isler.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../bildirim_kurallari.js');
const T = require('../takilan_isler.js');

const NOW = Date.parse('2026-11-13T12:00:00+03:00');
const SAAT = 3600000;
const iso = (ms) => new Date(ms).toISOString();

function db() {
    return {
        staff: [{ id: 4, name: 'Aslı' }, { id: 5, name: 'Şeyma' }, { id: 12, name: 'Yasin' }],
        exams: [
            { id: 1, name: 'MAT 101', date: '2026-11-16', time: '09:30', duration: 90, proctorIds: [12] },
            { id: 2, name: 'MAT 202', date: '2026-11-18', time: '13:30', duration: 90, proctorIds: [4] },
            // 11.11 bitti, iki gözetmen; 5 kendi süresini girdi → yalnızca 4 bekleniyor
            { id: 3, name: 'MAT 303', date: '2026-11-11', time: '10:00', duration: 90, proctorIds: [4, 5], gozetmenSuresi_5: { sure: 90 } },
            // Bugün bitti (24 saat dolmadı) → listelenmez
            { id: 4, name: 'MAT 404', date: '2026-11-13', time: '09:00', duration: 60, proctorIds: [4] }
        ],
        requests: [
            { id: 'p1', type: 'p2p_fairness_swap', status: 'pending_peers', fromStaffId: 12, fromStaffName: 'Yasin', fromExamId: 1, toStaffId: 4, toStaffName: 'Aslı', toExamId: 2, fromApproved: false, toApproved: true, createdAt: iso(NOW - 30 * SAAT) },
            { id: 'p2', type: 'p2p_fairness_swap', status: 'pending_peers', fromStaffId: 12, fromStaffName: 'Yasin', fromExamId: 1, toStaffId: 4, toStaffName: 'Aslı', toExamId: 2, fromApproved: false, toApproved: false, createdAt: iso(NOW - 2 * SAAT) }
        ],
        examSubmissions: [{ id: 'sb1', staffId: 5, staffName: 'Şeyma', name: 'MAT 214', date: '2026-11-10', time: '15:30', duration: 90, status: 'pending', createdAt: iso(NOW - 3 * SAAT) }],
        gorevUyarilari: [
            { id: 'g1', pid: '12', baslik: '🚫 Sınav göreviniz iptal edildi', metin: 'X', okundu: false, createdAt: iso(NOW - 50 * SAAT) },
            { id: 'g2', pid: '4', baslik: 'Y', metin: 'Y', okundu: true, createdAt: iso(NOW - 50 * SAAT) },
            { id: 'g3', pid: '4', baslik: 'Z', metin: 'Z', okundu: false, createdAt: iso(NOW - 2 * SAAT) }
        ]
    };
}

test('Takılan işler: yalnızca eşiği aşanlar; kimin beklendiği doğru', () => {
    const l = T.takilanIsler(db(), NOW, K);
    const turler = l.map(x => x.tur + ':' + x.anahtar);
    assert.deepEqual(turler, ['takas:takas_p1', 'uyari:uyari_g1', 'bildirim:bildirim_sb1', 'sure:sure_3']);
    const takas = l[0];
    assert.deepEqual(takas.pids, ['12'], 'yalnızca onaylamayan taraf');
    assert.match(takas.metin, /Adalet takası: MAT 101 \(16\.11 09:30\) ⇄ MAT 202 \(18\.11 13:30\) — 30 saattir yanıtsız/);
    assert.equal(takas.ayrinti, 'Onayı beklenen: Yasin');
    const sure = l.find(x => x.tur === 'sure');
    assert.deepEqual(sure.pids, ['4'], 'süresini giren gözetmen beklenmez');
    assert.match(l.find(x => x.tur === 'uyari').metin, /^Yasin "🚫 Sınav göreviniz iptal edildi" uyarısını 2 gündür görmedi$/);
    assert.equal(l.find(x => x.tur === 'bildirim').hatirlatma, null, 'sınav bildiriminde hatırlatma yok, "Aç" var');
});

test('Hatırlat: hedefli telefon bildirimi; aynı iş için günde bir kez', () => {
    const d = db();
    const is = T.takilanIsler(d, NOW, K).find(x => x.tur === 'sure');
    const bc = T.hatirlat(d, is, NOW);
    assert.ok(bc);
    assert.deepEqual(bc.target, ['4']);
    assert.equal(bc.pushToDevice, true);
    assert.match(bc.message, /"MAT 303" \(11\.11 10:00\) sınavının başlangıç saatini ve süresini onaylamanız bekleniyor/);
    assert.equal(K.duyuruHedefMi(d, bc, '4'), true);
    assert.equal(K.duyuruHedefMi(d, bc, '5'), false);
    assert.equal(T.bugunHatirlatildiMi(d, is, NOW + SAAT), true);
    assert.equal(T.hatirlat(d, is, NOW + SAAT), null, 'aynı gün ikinci kez gönderilmez');
    assert.ok(T.hatirlat(d, is, NOW + 24 * SAAT), 'ertesi gün yeniden gönderilebilir');
});
