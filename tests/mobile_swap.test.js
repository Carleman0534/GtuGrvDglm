/**
 * Mobil Takas Talepleri: Talebime git ve mobil sekme entegrasyonu testleri
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./harness');

test('index.html: Mobil Takas Taleplerim & Geçmiş yapısı eksiksiz mevcut', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    // 1. Sekme içinde ayrılmış Taleplerim kartı ve container'ı
    assert.match(html, /id="card-my-swap-requests"/, 'Taleplerim için ayrılmış öncelikli kart mevcut olmalı');
    assert.match(html, /id="my-requests-content"/, 'renderMyRequests için hedef container bulunmalı');
    assert.match(html, /id="card-swap-history-archive"/, 'Geçmiş takaslar için arşiv kartı mevcut olmalı');
    assert.match(html, /id="swap-history-list"/, 'swap-history-list container bulunmalı');

    // 2. Mobil tab picker ve masaüstü pill sekmelerinde Takas Taleplerim adı yer almalı
    assert.match(html, /<option value="swap-history">.*?Takas.*?Taleplerim.*?<\/option>/, 'Mobil dropdown Takas Taleplerim metnini içermeli');
    assert.match(html, /<button class="tab-btn" data-tab="swap-history">.*?Takas.*?Taleplerim.*?<\/button>/, 'Masaüstü sekme Takas Taleplerim metnini içermeli');
});

test('swap_market.js: openRequestsTab tanımlı ve doğrudan taleplerime yönlendiriyor', () => {
    const code = fs.readFileSync(path.join(ROOT, 'swap_market.js'), 'utf8');

    assert.match(code, /function openRequestsTab\(/, 'openRequestsTab fonksiyonu tanımlı olmalı');
    assert.match(code, /window\.openRequestsTab = openRequestsTab/, 'openRequestsTab global erişilebilir olmalı');
    assert.match(code, /scrollIntoView\(\{ behavior: 'smooth'/, 'Taleplerim kartına yumuşak kaydırma yapılmalı');
    assert.match(code, /switchProfileTab\('swap-history'\)/, 'swap-history sekmesi açılmalı');
});

test('mobile_app_engine.js: swap sekmesine basıldığında bekleyen talep varsa Taleplerim açılır', () => {
    const code = fs.readFileSync(path.join(ROOT, 'mobile_app_engine.js'), 'utf8');

    assert.match(code, /tabKey === 'swap'/, 'Mobil alt menüde swap sekmesi yakalanmalı');
    assert.match(code, /openRequestsTab/, 'Bekleyen talep durumunda openRequestsTab çağrılmalı');
});

test('app.js: switchProfileTab(swap-history) hem renderMyRequests hem renderSwapHistory çalıştırır', () => {
    const code = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

    assert.match(code, /tabId === 'swap-history'/, 'switchProfileTab içinde swap-history yakalanmalı');
    assert.match(code, /SwapMarket\.renderMyRequests/, 'renderMyRequests tetiklenmeli');
    assert.match(code, /renderSwapHistory/, 'renderSwapHistory tetiklenmeli');
});

test('swap_market.js & sw.js: Sürüm önbellek tazeleme ve banner butonları tam uyumlu', () => {
    const swapMarketCode = fs.readFileSync(path.join(ROOT, 'swap_market.js'), 'utf8');
    const swCode = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    assert.match(swCode, /CACHE_NAME = 'gozetmenlik-ai-v61'/, 'sw.js önbellek sürümü v61 olmalı');
    assert.match(html, /swap_market\.js\?v=20261110c/, 'index.html swap_market güncel sürüm parametresi içermeli');
    assert.match(swapMarketCode, /Talebime Git/, 'Banner üzerinde Talebime Git butonu bulunmalı');
    assert.match(swapMarketCode, /acceptDirectSwap/, 'Banner üzerinde doğrudan kabul butonu bulunmalı');
});
