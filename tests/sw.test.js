/**
 * Service worker bildirim tıklaması testleri (sw.js).
 * "Yarın göreviniz var" gibi hatırlatmalar süre teyidi penceresini AÇMAMALI.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.TEST_ROOT ? path.resolve(process.env.TEST_ROOT) : path.resolve(__dirname, '..');
const SCOPE = 'https://ornek.github.io/GtuGrvDglm/';

function loadSW({ openClients = [] } = {}) {
    const listeners = {};
    const opened = [];
    const posted = [];
    const clientsList = openClients.map(url => ({
        url,
        focus: async () => true,
        postMessage: (m) => posted.push(m)
    }));
    const self = {
        registration: { scope: SCOPE, showNotification: async () => {}, getNotifications: async () => [] },
        location: { origin: 'https://ornek.github.io' },
        addEventListener: (type, fn) => { listeners[type] = fn; },
        skipWaiting: () => {}
    };
    let ctx = null;
    ctx = vm.createContext({
        // sw.js ortak kuralları importScripts ile yükler; testte aynı dosyayı diskten çalıştır
        importScripts: (...urls) => urls.forEach(u => {
            const rel = String(u).replace(/^\.\//, '').split('?')[0];
            vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx);
        }),
        self,
        clients: { matchAll: async () => clientsList, openWindow: async (u) => { opened.push(u); }, claim: () => {} },
        caches: { open: async () => ({ addAll: async () => {} }), keys: async () => [], delete: async () => true, match: async () => null },
        fetch: async () => ({}),
        Request: function () {},
        console: { log() {}, warn() {}, error() {} },
        setTimeout
    });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), ctx);

    async function click(data) {
        let pending = null;
        listeners.notificationclick({
            notification: { data, close() {} },
            waitUntil: (p) => { pending = p; }
        });
        await pending;
    }
    return { click, opened, posted };
}

test('"Yarın göreviniz var" hatırlatması süre teyidi penceresini açmaz', async () => {
    const sw = loadSW();
    await sw.click({ url: SCOPE, examId: 123 });
    assert.equal(sw.opened.length, 1);
    assert.ok(!sw.opened[0].includes('verifyDurationExamId'), sw.opened[0]);
    assert.equal(sw.opened[0], SCOPE);
});

test('Süre teyidi bildirimi pencereyi açar (soru ve giriş adımı)', async () => {
    const sw = loadSW();
    await sw.click({ action: 'verify_duration', examId: 123, step: 'question' });
    await sw.click({ action: 'input_duration', examId: 456 });
    assert.match(sw.opened[0], /verifyDurationExamId=123&step=question/);
    assert.match(sw.opened[1], /verifyDurationExamId=456&step=input/);
});

test('Uygulama açıkken: hatırlatma yalnızca odaklar, süre teyidi mesaj gönderir', async () => {
    const sw = loadSW({ openClients: [SCOPE] });
    await sw.click({ url: SCOPE, examId: 123 });
    assert.equal(sw.posted.length, 0, 'hatırlatma mesaj göndermemeli');
    assert.equal(sw.opened.length, 0, 'yeni pencere açılmamalı');

    await sw.click({ action: 'verify_duration', examId: 123, step: 'question' });
    assert.equal(sw.posted.length, 1);
    assert.equal(sw.posted[0].action, 'verify_duration');
    assert.equal(sw.posted[0].examId, 123);
});

test('Ortak kurallar service worker\'a yükleniyor', async () => {
    const sw = loadSW();
    await sw.click({ tur: 'sure_teyidi', examId: 9, url: SCOPE });
    assert.match(sw.opened[0], /verifyDurationExamId=9&step=question/, 'tur alanıyla (action olmadan) da açılmalı');
    await sw.click({ tur: 'hatirlatma_gun', examId: 9, action: 'verify_duration', url: SCOPE });
    assert.equal(sw.opened[1], SCOPE, 'tür hatırlatma ise eski action alanı yok sayılır');
    await sw.click({ tur: 'bilinmeyen', examId: 9, url: SCOPE });
    assert.equal(sw.opened[2], SCOPE, 'tanınmayan tür → yalnızca uygulama');
});

test('Duyuru bildirimi kendi adresini açar', async () => {
    const sw = loadSW();
    await sw.click({ url: SCOPE + 'index.html', broadcastId: 'b1' });
    assert.equal(sw.opened[0], SCOPE + 'index.html');
});
