/**
 * Test altyapısı: tarayıcı dosyalarını (logic.js, final_forecast_engine.js) Node içinde,
 * sahte window/document/localStorage ve SABİT bir saatle çalıştırır.
 *
 * Kullanım:
 *   const app = createApp({ now: new Date(2026, 10, 8, 12, 0) });
 *   app.setDB(fixture);          // DB'yi yükler ve puanları yeniden hesaplar
 *   app.run('FinalForecastEngine.calculateForecastData()');
 */
'use strict';

const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// TEST_ROOT ortam değişkeniyle başka bir klasördeki (ör. yedek) dosyalar test edilebilir
const ROOT = process.env.TEST_ROOT ? path.resolve(process.env.TEST_ROOT) : path.resolve(__dirname, '..');
const DEFAULT_FILES = ['bildirim_kurallari.js', 'atama_destek.js', 'logic.js', 'final_forecast_engine.js'];

function makeStorage() {
    const m = new Map();
    return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: (k) => { m.delete(k); },
        clear: () => m.clear(),
        key: (i) => [...m.keys()][i] ?? null,
        get length() { return m.size; }
    };
}

function makeElement(id) {
    const classes = new Set();
    return {
        id,
        innerHTML: '',
        textContent: '',
        value: '',
        style: {},
        dataset: {},
        children: [],
        classList: {
            add: (...c) => c.forEach(x => classes.add(x)),
            remove: (...c) => c.forEach(x => classes.delete(x)),
            toggle: (c, force) => {
                const on = force === undefined ? !classes.has(c) : !!force;
                if (on) classes.add(c); else classes.delete(c);
                return on;
            },
            contains: (c) => classes.has(c)
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        appendChild: () => {},
        insertAdjacentElement: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        addEventListener: () => {},
        closest: () => null
    };
}

/**
 * Yeni ve yalıtılmış bir uygulama örneği oluşturur.
 * @param {{ now?: Date, files?: string[] }} opts
 */
function createApp(opts = {}) {
    const fixedMs = (opts.now || new Date()).getTime();
    const RealDate = Date;
    // Argümansız new Date() ve Date.now() sabit saati döndürür; diğer kullanım normal Date gibidir.
    class FakeDate extends RealDate {
        constructor(...args) {
            if (args.length === 0) super(fixedMs);
            else super(...args);
        }
        static now() { return fixedMs; }
    }

    const elements = new Map();
    const document = {
        readyState: 'complete',
        getElementById: (id) => elements.get(id) || null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => makeElement(''),
        addEventListener: () => {},
        body: makeElement('body'),
        documentElement: makeElement('html')
    };

    const sandbox = {
        Date: FakeDate,
        console: { log() {}, info() {}, warn() {}, error: console.error, debug() {} },
        setTimeout, clearTimeout,
        setInterval: () => 0, clearInterval: () => {},
        localStorage: makeStorage(),
        sessionStorage: makeStorage(),
        document,
        navigator: { onLine: true, userAgent: 'node-test' },
        location: { href: 'http://localhost/index.html', origin: 'http://localhost' },
        fetch: () => Promise.reject(new Error('Testlerde ağ erişimi yok')),
        addEventListener: () => {},
        removeEventListener: () => {},
        alert: () => {},
        confirm: () => true
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;

    const ctx = vm.createContext(sandbox);

    // app.js'teki gözetmen kontrolünün aynısı (motor bu fonksiyon varsa onu kullanır)
    vm.runInContext(`
        function isStaffProctorById(exam, staffId) {
            if (!exam || !staffId) return false;
            const sid = String(staffId);
            if (String(exam.proctorId) === sid) return true;
            if (Array.isArray(exam.proctorIds) && exam.proctorIds.map(String).includes(sid)) return true;
            return false;
        }
    `, ctx);

    for (const f of (opts.files || DEFAULT_FILES)) {
        const file = path.join(ROOT, f);
        vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
    }

    const api = {
        ctx,
        /** Bağlamda ifade çalıştırır; sonucu düz JSON nesnesi olarak döndürür (realm farkı olmasın). */
        run(code) {
            const out = vm.runInContext(code, ctx);
            return out === undefined ? undefined : JSON.parse(JSON.stringify(out));
        },
        /** Ham (JSON'a çevrilmemiş) sonuç */
        raw(code) { return vm.runInContext(code, ctx); },
        /** DB'yi yükler; puanları uygulamanın kendi formülüyle yeniden hesaplar. */
        setDB(db, { recalc = true } = {}) {
            ctx.__dbJson = JSON.stringify(db);
            vm.runInContext(`DB = JSON.parse(__dbJson); ${recalc ? 'recalculateAllScores();' : ''}`, ctx);
        },
        getDB() { return api.run('DB'); },
        /** Sahte bir DOM öğesi ekler (ör. profil kartı) */
        addElement(id) { const e = makeElement(id); elements.set(id, e); return e; },
        storage: { local: sandbox.localStorage, session: sandbox.sessionStorage }
    };
    return api;
}

module.exports = { createApp, ROOT };
