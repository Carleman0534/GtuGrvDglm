/**
 * Giriş ekranında (oturum açılmamışken) veritabanı sayfa başına yalnızca bir kez erken yüklenir.
 * Eskiden populateQuickStaffDropdown ↔ syncCachedDBEarly ↔ loadFromDataJSON birbirini sonsuz döngüde çağırıyordu.
 * Çalıştırma: node --test tests/giris_yukleme.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createApp, ROOT } = require('./harness');
const { NOW, buildFixture } = require('./fixture');

const bekle = (ms) => new Promise(r => setTimeout(r, ms));

function yukle({ girisli }) {
    const app = createApp({ now: NOW, files: ['bildirim_kurallari.js', 'logic.js'] });
    app.setDB(buildFixture());
    if (girisli) app.storage.session.setItem('isLoggedIn', 'true');
    // Sunucu yüklemesini say (ağ yok; anında tamamlanır)
    app.raw(`window.__yuklemeSayisi = 0; window.loadFromDataJSON = function () { window.__yuklemeSayisi++; return Promise.resolve(); };`);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'notification_engine.js'), 'utf8'), app.ctx, { filename: 'notification_engine.js' });
    return app;
}

test('Oturum açılmamışken erken yükleme bir kez yapılır; açılır liste tekrar doldurulunca yeniden yüklenmez', async () => {
    const app = yukle({ girisli: false });
    await bekle(50);
    assert.equal(app.run('window.__yuklemeSayisi'), 1, 'sayfa açılışında tek yükleme');
    for (let i = 0; i < 5; i++) app.raw('window.populateQuickStaffDropdown()');
    await bekle(50);
    assert.equal(app.run('window.__yuklemeSayisi'), 1, 'döngü yok: yükleme tekrarlanmaz');
});

test('Oturum açıkken erken yükleme yapılmaz (eşitlemeyi veri koruma katmanı yapar)', async () => {
    const app = yukle({ girisli: true });
    await bekle(50);
    app.raw('window.populateQuickStaffDropdown()');
    await bekle(20);
    assert.equal(app.run('window.__yuklemeSayisi'), 0);
});
