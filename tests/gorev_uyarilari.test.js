/**
 * Yönetici (adalet dengesi) kararıyla görevi değişenlere profil uyarısı ve telefon bildirimi.
 * Çalıştırma: node --test tests/gorev_uyarilari.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');
const { NOW, buildFixture } = require('./fixture');

function freshApp() {
    const app = createApp({ now: NOW });
    app.setDB(buildFixture());
    app.raw(`
        DB.exams.push({ id: 101, name: "Sınav A", date: "2026-12-10", time: "10:00", duration: 90, proctorId: 1, proctorIds: [1] });
        DB.exams.push({ id: 102, name: "Sınav B", date: "2026-12-11", time: "14:00", duration: 90, proctorId: 2, proctorIds: [2] });
        recalculateAllScores();
    `);
    return app;
}
const TAKAS = { type: 'bilateral_swap', staffA: { id: 1, name: 'Asistan A' }, staffB: { id: 2, name: 'Asistan B' },
    examFromA: { id: 101, name: 'Sınav A' }, examFromB: { id: 102, name: 'Sınav B' } };
const DEVIR = { type: 'transfer', fromStaff: { id: 1, name: 'Asistan A' }, toStaff: { id: 2, name: 'Asistan B' }, examId: 101, examName: 'Sınav A', points: 90 };
const uyarilar = (app, pid) => app.run(`(DB.gorevUyarilari || []).filter(u => u.pid === '${pid}')`);

test('Adalet takası: biri onaylayınca uyarı yok; ikisi de onaylayınca iki tarafa "takas gerçekleşti" uyarısı ve telefon bildirimi', () => {
    const app = freshApp();
    const prop = app.run(`createFairnessSwapProposal(${JSON.stringify(TAKAS)})`);
    app.run(`acceptFairnessProposal('${prop.id}', 1)`);
    assert.equal(app.run('(DB.gorevUyarilari || []).length'), 0, 'yalnızca bir onay: takas olmadı');
    assert.equal(app.run(`acceptFairnessProposal('${prop.id}', 2)`).status, 'completed');
    const a = uyarilar(app, 1), b = uyarilar(app, 2);
    assert.equal(a.length, 1); assert.equal(b.length, 1);
    assert.equal(a[0].tur, 'takas_tamam');
    assert.match(a[0].metin, /Yönetici tarafından adalet dengesi için önerilen takas iki tarafın onayıyla gerçekleşti \(Asistan B ile\)\. Verdiğiniz: "Sınav A" \(10\.12\.2026 10:00\) · Aldığınız: "Sınav B" \(11\.12\.2026 14:00\)/);
    assert.match(b[0].metin, /Verdiğiniz: "Sınav B".*Aldığınız: "Sınav A"/);
    const bc = app.run(`DB.adminBroadcasts.filter(x => x.kaynak === 'gorev_uyarisi')`);
    assert.deepEqual(bc.map(x => x.target[0]).sort(), ['1', '2'], 'iki tarafın telefonuna da');
    assert.ok(bc.every(x => x.pushToDevice));
});

test('Görev devri kabul edilince: alana "görev devri gerçekleşti", verene "görev devri sebebiyle sınavınız iptal edilmiştir"', () => {
    const app = freshApp();
    const prop = app.run(`createFairnessSwapProposal(${JSON.stringify(DEVIR)})`);
    assert.equal(app.run(`acceptFairnessProposal('${prop.id}', 2)`).status, 'completed');
    const alan = uyarilar(app, 2)[0], veren = uyarilar(app, 1)[0];
    assert.equal(alan.tur, 'devir_alan');
    assert.match(alan.metin, /^Yönetici tarafından görev devri gerçekleşti: "Sınav A" \(10\.12\.2026 10:00\) sınavı size verildi \(Asistan A yerine\)\.$/);
    assert.equal(veren.tur, 'devir_veren');
    assert.match(veren.metin, /^Yönetici tarafından görev devri sebebiyle "Sınav A" \(10\.12\.2026 10:00\) sınavındaki göreviniz iptal edilmiştir\. Görev Asistan B kişisine devredildi\.$/);
    assert.equal(veren.okundu, false, '"Tamam, gördüm" denene kadar durur');
});

test('Teklif reddedilince karşı tarafa uyarı: takas yapılmadı, görevler değişmedi', () => {
    const app = freshApp();
    const prop = app.run(`createFairnessSwapProposal(${JSON.stringify(TAKAS)})`);
    app.run(`rejectFairnessProposal('${prop.id}', 2)`);
    assert.equal(uyarilar(app, 2).length, 0, 'reddeden kişiye uyarı gitmez');
    const u = uyarilar(app, 1)[0];
    assert.equal(u.tur, 'takas_red');
    assert.match(u.metin, /Asistan B, yönetici tarafından adalet dengesi için önerilen "Sınav A" .* ⇄ "Sınav B" .* takasını kabul etmedi\. Görevleriniz değişmedi\./);
});

test('Yöneticinin doğrudan uyguladığı devir ve takas (adaletUyarilari) iki tarafa da uyarı bırakır', () => {
    const app = freshApp();
    app.run(`adaletUyarilari(DB, { tur: 'devir', sinav: DB.exams.find(e => e.id === 101), alanId: 2, alanAd: 'Asistan B', verenId: 1, verenAd: 'Asistan A' }, false)`);
    app.run(`adaletUyarilari(DB, { tur: 'takas', onayli: false, aId: 1, aAd: 'Asistan A', aSinav: DB.exams.find(e => e.id === 101), bId: 2, bAd: 'Asistan B', bSinav: DB.exams.find(e => e.id === 102) }, false)`);
    assert.deepEqual(uyarilar(app, 1).map(u => u.tur).sort(), ['devir_veren', 'takas_yapildi']);
    assert.deepEqual(uyarilar(app, 2).map(u => u.tur).sort(), ['devir_alan', 'takas_yapildi']);
    assert.match(uyarilar(app, 1).find(u => u.tur === 'takas_yapildi').metin, /^Yönetici tarafından adalet dengesi için takas yapıldı \(Asistan B ile\)/);
    assert.equal(app.run(`(DB.adminBroadcasts || []).filter(x => x.kaynak === 'gorev_uyarisi').length`), 0, 'push: false → ayrıca telefon bildirimi eklenmez');
});
