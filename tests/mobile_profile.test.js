const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('mobil.css: Profilim sekmesi Bento KPI, Hero ve Takas mobil optimizasyonları eksiksiz mevcut', () => {
    const mobilCss = fs.readFileSync(path.join(ROOT, 'mobil.css'), 'utf8');

    // 1. Profil Bento Grid ve Kolon Kuralları
    assert.match(mobilCss, /\.profile-bento-grid/, 'Bento grid kuralı bulunmalı');
    assert.match(mobilCss, /\.profile-hero-actions/, 'Hero aksiyon düğmeleri mobil kuralı bulunmalı');
    
    // 2. Bento KPI Kartları
    assert.match(mobilCss, /\.profile-bento-kpi-grid/, 'Bento KPI ızgara kuralı bulunmalı');
    assert.match(mobilCss, /\.bento-kpi-card/, 'Bento KPI kart stili bulunmalı');
    assert.match(mobilCss, /#profile-countdown/, 'Geri sayım yazı boyutu optimize edilmiş olmalı');

    // 3. Scorecard (Puan Karnesi) 3 sütunlu kompakt düzen
    assert.match(mobilCss, /#scorecard-stats-grid/, 'Puan karnesi mobil ızgara kuralı bulunmalı');

    // 4. Checkbox / Radio 44px min-height taşma düzeltmesi
    assert.match(mobilCss, /input\[type="checkbox"\][\s\S]*?min-height:\s*0\s*!important/, 'Checkbox min-height 0 ile sıfırlanmış olmalı');

    // 5. Profil Kurulum Ekranı
    assert.match(mobilCss, /#profile-identity-setup/, 'Profil kimlik kurulum ekranı mobil kuralı bulunmalı');

    // 6. Takas Talepleri Kartları
    assert.match(mobilCss, /#card-my-swap-requests/, 'Takas talepleri kart mobil kuralı bulunmalı');
    assert.match(mobilCss, /\.swap-summary-table/, 'Takas özet tablosu mobil kuralı bulunmalı');
});
