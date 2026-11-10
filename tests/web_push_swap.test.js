/**
 * 📲 Web Push & Anlık Takas Bildirimleri Testleri
 *
 * 1. PWA ve kilit ekranı takas bildirim tıklama davranışları (sw.js & bildirim_kurallari.js)
 * 2. Takas talebi ve onayı anında Web Push planlama (.github/scripts/sure-hatirlatma.mjs)
 * 3. İstemci tarafı anlık cihaz bildirimi (notification_engine.js checkIncomingSwapNotifications)
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const ROOT = process.env.TEST_ROOT ? path.resolve(process.env.TEST_ROOT) : path.resolve(__dirname, '..');
const K = require(path.join(ROOT, 'bildirim_kurallari.js'));
const SCOPE = 'https://carleman0534.github.io/GtuGrvDglm/';

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
        location: { origin: 'https://carleman0534.github.io' },
        addEventListener: (type, fn) => { listeners[type] = fn; },
        skipWaiting: () => {}
    };
    let ctx = null;
    ctx = vm.createContext({
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

test('bildirim_kurallari.js: tiklamaHedefi takas talebi için swap-history ve requestId hedefler', () => {
    // 1. Takas teklif bildirimi
    const hedefTeklif = K.tiklamaHedefi({
        tur: K.TUR.TAKAS_TEKLIF,
        requestId: 998877,
        url: SCOPE + 'index.html'
    });
    assert.equal(hedefTeklif.sureEkrani, false, 'Takas bildirimi süre teyidi açmamalı');
    assert.equal(hedefTeklif.takasEkrani, true, 'Takas ekranı bayrağı aktif olmalı');
    assert.equal(hedefTeklif.requestId, 998877);
    assert.equal(hedefTeklif.tab, 'swap-history');
    assert.match(hedefTeklif.url, /tab=swap-history&requestId=998877/);

    // 2. Takas onay bildirimi
    const hedefOnay = K.tiklamaHedefi({
        tur: K.TUR.TAKAS_ONAY,
        requestId: 554433,
        url: SCOPE + 'index.html'
    });
    assert.equal(hedefOnay.sureEkrani, false);
    assert.equal(hedefOnay.takasEkrani, true);
    assert.match(hedefOnay.url, /tab=swap-history&requestId=554433/);
});

test('sw.js: Takas bildirimine dokunulduğunda pencere kapalıysa swap-history ile açılır', async () => {
    const sw = loadSW({ openClients: [] });
    await sw.click({
        tur: 'swap_offer',
        action: 'open_swap_request',
        requestId: 12345,
        tab: 'swap-history',
        url: SCOPE + 'index.html'
    });

    assert.equal(sw.opened.length, 1, 'Bir pencere açılmalı');
    assert.match(sw.opened[0], /tab=swap-history&requestId=12345/, 'Hedef URL takas ve talep ID içermeli');
});

test('sw.js: Takas bildirimine dokunulduğunda açık sekme varsa mesaj iletir ve odaklar', async () => {
    const sw = loadSW({ openClients: [SCOPE + 'index.html'] });
    await sw.click({
        tur: 'swap_offer',
        action: 'open_swap_request',
        requestId: 887766,
        tab: 'swap-history',
        url: SCOPE + 'index.html'
    });

    assert.equal(sw.opened.length, 0, 'Yeni sekme açılmamalı, var olan odaklanmalı');
    assert.equal(sw.posted.length, 1, 'Açık sekmeye NOTIFICATION_ACTION mesajı iletilmeli');
    assert.equal(sw.posted[0].type, 'NOTIFICATION_ACTION');
    assert.equal(sw.posted[0].action, 'open_swap_request');
    assert.equal(sw.posted[0].requestId, 887766);
    assert.equal(sw.posted[0].tab, 'swap-history');
});

test('sure-hatirlatma.mjs: Bekleyen takas talebi ve onaylanan takas Web Push olarak planlanır', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-test-'));
    const testDB = {
        staff: [
            { id: 10, name: 'Teklif Eden Gözetmen' },
            { id: 20, name: 'Hedef Gözetmen' }
        ],
        exams: [
            { id: 'E100', name: 'MATH 101 - Calculus I', date: '2026-11-12', time: '10:00', duration: 90, proctorIds: [10] }
        ],
        // Cihazı kayıtlı push abonelikleri
        pushAbonelikleri: {
            '10': [{ id: 'sub10', endpoint: 'https://push.example.com/sub10', keys: { p256dh: 'k1', auth: 'a1' } }],
            '20': [{ id: 'sub20', endpoint: 'https://push.example.com/sub20', keys: { p256dh: 'k2', auth: 'a2' } }]
        },
        requests: [
            {
                id: 7001,
                type: 'direct_swap',
                status: 'pending_peer',
                initiatorId: 10,
                initiatorName: 'Teklif Eden Gözetmen',
                initiatorExamId: 'E100',
                receiverId: 20,
                receiverName: 'Hedef Gözetmen',
                examName: 'MATH 101 - Calculus I',
                createdAt: new Date().toISOString()
            },
            {
                id: 7002,
                type: 'direct_swap',
                status: 'approved',
                initiatorId: 10,
                initiatorName: 'Teklif Eden Gözetmen',
                receiverId: 20,
                receiverName: 'Hedef Gözetmen',
                examName: 'MATH 215 - Discrete',
                createdAt: new Date(Date.now() - 3600000).toISOString(),
                completedAt: new Date().toISOString()
            }
        ]
    };

    fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify(testDB));
    const env = Object.assign({}, process.env, {
        DB_FILE: path.join(dir, 'db.json'),
        STATE_FILE: path.join(dir, 'durum.json'),
        NOW: new Date().toISOString(),
        SAAT_SINIRI_YOK: '1',   // test hangi saatte çalışırsa çalışsın planlama sınansın
        DRY_RUN: '1',
        VAPID_PUBLIC_KEY: '',
        VAPID_PRIVATE_KEY: ''
    });

    const out = execFileSync(process.execPath, [path.join(ROOT, '.github', 'scripts', 'sure-hatirlatma.mjs')], { env, cwd: ROOT }).toString();

    // Çıktıda hem bekleyen talep hem de onaylanan takas deneme bildirimleri bulunmalı
    assert.match(out, /\[Deneme\] Takas talebi: gözetmen #20, talep #7001/);
    assert.match(out, /\[Deneme\] Takas onay bildirimi: gözetmen #10, talep #7002/);
    assert.match(out, /takas bildirimi: 0/); // Dry run olduğu için gerçek gönderim 0
});
