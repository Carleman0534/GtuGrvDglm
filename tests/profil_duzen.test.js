/**
 * Profilim sekmesi düzeni (profil_duzen.js) ve sade profil sayfası testleri.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

test('profil_duzen.js: 4 ana grup ve alt sekmeler doğru tanımlı', () => {
    const code = fs.readFileSync(path.join(ROOT, 'profil_duzen.js'), 'utf8');
    assert.match(code, /key:\s*'gorevler'/, 'Görevlerim ana sekmesi olmalı');
    assert.match(code, /key:\s*'takas'/, 'Takas ana sekmesi olmalı');
    assert.match(code, /key:\s*'puan'/, 'Puanım ana sekmesi olmalı');
    assert.match(code, /key:\s*'ayarlar'/, 'Ayarlarım ana sekmesi olmalı');

    // Görevlerim alt sekmeleri
    assert.match(code, /id:\s*'active'[\s\S]*?id:\s*'my-timeline'[\s\S]*?id:\s*'archive'/, 'Görevlerim altında Liste, Takvim ve Geçmiş sekmeleri olmalı');

    // Ayarlarım alt sekmeleri
    assert.match(code, /id:\s*'availability'[\s\S]*?id:\s*'settings'/, 'Ayarlarım altında Kısıtlarım ve Şifre ve Diğer sekmeleri olmalı');
});

test('profil_duzen.js: Ayarlarım sekmesi tüm yönetim butonlarını içeriyor', () => {
    const code = fs.readFileSync(path.join(ROOT, 'profil_duzen.js'), 'utf8');
    assert.match(code, /openChangePasswordModal\(\)/, 'Şifremi Değiştir butonu Ayarlarımda olmalı');
    assert.match(code, /TemaSecici\.open/, 'Tema Rengi butonu Ayarlarımda olmalı');
    assert.match(code, /openNotificationSettingsModal/, 'Bildirim Ayarları butonu Ayarlarımda olmalı');
    assert.match(code, /exportMyExamsToICal\(\)/, 'Takvimime Ekle butonu Ayarlarımda olmalı');
    assert.match(code, /openCourseHistoryArchiveModal\(\)/, 'Sınav Süre Arşivi butonu Ayarlarımda olmalı');
    assert.match(code, /changeProfileIdentity/, 'Kimliği Değiştir butonu Ayarlarımda olmalı');
});

test('profil_duzen.js: Masaüstü sağ takvim kutusu Görevlerim > Takvim sekmesine taşınıyor ve sidebar gizleniyor', () => {
    const code = fs.readFileSync(path.join(ROOT, 'profil_duzen.js'), 'utf8');
    assert.match(code, /personal-calendar-card/, 'Takvim kartı seçilmeli');
    assert.match(code, /tab-my-timeline/, 'Görevlerim Takvim sekmesi hedeflenmeli');
    assert.match(code, /timelinePane\.appendChild\(cal\)/, 'Takvim kutusu Takvim sekmesine eklenmeli');
    assert.match(code, /profile-sidebar-column[\s\S]*?display\s*=\s*'none'/, 'Boşalan sağ sidebar gizlenmeli');
});

test('style.css: Tek kolonlu sade masaüstü profil kuralları mevcut', () => {
    const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    assert.match(css, /\.profile-duzen\s+\.profile-bento-grid[\s\S]*?display:\s*block\s*!important/, 'Tek kolon block düzeni olmalı');
    assert.match(css, /\.profile-duzen\s+\.profile-sidebar-column[\s\S]*?display:\s*none\s*!important/, 'Sidebar gizleme kuralı olmalı');
    assert.match(css, /\.profile-duzen\s+\.profile-main-column[\s\S]*?width:\s*100%\s*!important/, 'Ana kolon tam genişlik olmalı');
    assert.match(css, /\.hero-score-chip/, 'Hero mini puan rozeti stili olmalı');
});

test('index.html & profil_duzen.js: Bento KPI tablosu Puanım sekmesine gömülü ve hero sade', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const js = fs.readFileSync(path.join(ROOT, 'profil_duzen.js'), 'utf8');

    // 1. Bento KPI grid tab-scorecard içinde
    const scorecardIdx = html.indexOf('id="tab-scorecard"');
    const kpiIdx = html.indexOf('class="profile-bento-kpi-grid"');
    assert.ok(scorecardIdx > 0 && kpiIdx > scorecardIdx, 'Bento KPI ızgarası tab-scorecard içinde yer almalı');

    // 2. profil_duzen.js kpi grid'i tab-scorecard içine taşır/korur
    assert.match(js, /tab-scorecard/, 'Puanım sekmesi hedeflenmeli');
    assert.match(js, /profile-bento-kpi-grid/, 'Bento KPI seçilmeli');

    // 3. Hero başlığında tıklanabilir mini puan rozeti mevcut
    assert.match(html, /id="profile-hero-score-chip"/, 'Hero mini puan rozeti index.html içinde olmalı');
    assert.match(js, /updateHeroScoreChip/, 'profil_duzen.js puan rozetini güncellemeli');

    // 4. Hero aksiyonlarında kalabalık butonlar yok, yalnızca Ayarlarım var
    assert.match(html, /class="profile-hero-actions"[\s\S]*?profile-hero-settings-btn/, 'Hero içinde yalnızca Ayarlarım butonu olmalı');
    assert.ok(!html.includes('class="profile-hero-actions">\r\n                            <button type="button" class="btn-primary" style="background: linear-gradient(135deg, #6366f1'), 'Eski 6 buton hero içinde olmamalı');

    // 5. Görünüm değiştirici (Kart/Tablo) butonu Aktif Görevler tablosu başlığında
    const activeIdx = html.indexOf('id="tab-active"');
    const toggleIdx = html.indexOf('id="btn-profile-view-toggle"');
    assert.ok(activeIdx > 0 && toggleIdx > activeIdx, 'Kart Görünümü butonu Aktif Görevler tablosunda olmalı');
});
