/**
 * KİŞİSEL TEMA SEÇİCİ
 * Başlıktaki 🌓 düğmesi; açık/koyu görünüm ve tema rengini seçtiren küçük bir panel açar.
 *
 * - Seçim kişiye özeldir: giriş yapmış gözetmen için "tema_renk_<personelId>",
 *   giriş yapılmamışsa "tema_renk_cihaz" anahtarıyla bu cihazda (localStorage) saklanır.
 * - Hiç seçim yapılmamışsa uygulamanın eski otomatik davranışı (applyGenderTheme) aynen sürer.
 * - Açık/koyu tercihi uygulamanın mevcut "theme" anahtarını kullanır.
 */
(function () {
    'use strict';

    const PALETTES = [
        { key: 'oxford',  label: 'Oxford Mavi', swatch: 'hsl(212, 85%, 22%)', swatchDark: 'hsl(212, 100%, 65%)' },
        { key: 'bordo',   label: 'Bordo',       swatch: 'hsl(348, 70%, 32%)', swatchDark: 'hsl(348, 75%, 68%)' },
        { key: 'zumrut',  label: 'Zümrüt',      swatch: 'hsl(160, 84%, 24%)', swatchDark: 'hsl(158, 64%, 52%)' },
        { key: 'turkuaz', label: 'Turkuaz',     swatch: 'hsl(190, 85%, 26%)', swatchDark: 'hsl(188, 80%, 55%)' },
        { key: 'mor',     label: 'Mor',         swatch: 'hsl(262, 60%, 40%)', swatchDark: 'hsl(262, 80%, 74%)' },
        { key: 'turuncu', label: 'Turuncu',     swatch: 'hsl(24, 85%, 38%)',  swatchDark: 'hsl(30, 90%, 62%)' },
        { key: 'pembe',   label: 'Pembe',       swatch: 'hsl(340, 70%, 42%)', swatchDark: 'hsl(340, 80%, 65%)' },
        { key: 'grafit',  label: 'Grafit',      swatch: 'hsl(220, 15%, 28%)', swatchDark: 'hsl(220, 15%, 78%)' }
    ];
    const CLASS_PREFIX = 'theme-color-';

    const safeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
    const safeDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };

    function storageKey() {
        const sid = safeGet('myStaffId');
        return sid ? 'tema_renk_' + sid : 'tema_renk_cihaz';
    }
    function getChoice() {
        const v = safeGet(storageKey());
        return PALETTES.some(p => p.key === v) ? v : null;
    }

    // Uygulamanın eski otomatik (isimden tahmin) tema fonksiyonunu sakla
    let originalGenderTheme = null;

    function applyColor() {
        const body = document.body;
        if (!body) return;
        const choice = getChoice();
        [...body.classList].filter(c => c.startsWith(CLASS_PREFIX)).forEach(c => body.classList.remove(c));

        if (!choice) {
            // Seçim yok → eski otomatik davranış
            if (typeof originalGenderTheme === 'function') {
                try { originalGenderTheme(); } catch (e) {}
            }
        } else {
            body.classList.toggle('theme-female', choice === 'pembe');
            if (choice !== 'oxford' && choice !== 'pembe') body.classList.add(CLASS_PREFIX + choice);
        }
        updateMetaColor();
        renderPanelState();
    }

    function updateMetaColor() {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) return;
        const primary = getComputedStyle(document.body).getPropertyValue('--primary').trim();
        if (primary) meta.setAttribute('content', document.body.classList.contains('dark-theme') ? '#0f172a' : primary);
    }

    function setMode(dark) {
        document.body.classList.toggle('dark-theme', dark);
        safeSet('theme', dark ? 'dark' : 'light');
        setHeaderIcon();
        updateMetaColor();
        renderPanelState();
    }

    function setColor(key) {
        if (key) safeSet(storageKey(), key); else safeDel(storageKey());
        applyColor();
    }

    // ------------------------------------------------------------------ Panel
    let panel = null;

    function buildPanel() {
        panel = document.createElement('div');
        panel.id = 'theme-picker-panel';
        panel.className = 'theme-picker hidden';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Tema ayarları');
        panel.innerHTML = `
            <div class="theme-picker-head">
                <strong>🎨 Tema</strong>
                <button type="button" class="theme-picker-close" aria-label="Kapat">✕</button>
            </div>
            <div class="theme-picker-label">Görünüm</div>
            <div class="theme-picker-modes">
                <button type="button" data-mode="light">☀️ Açık</button>
                <button type="button" data-mode="dark">🌙 Koyu</button>
            </div>
            <div class="theme-picker-label">Renk</div>
            <div class="theme-picker-swatches">
                ${PALETTES.map(p => `
                    <button type="button" class="theme-swatch" data-color="${p.key}" title="${p.label}" aria-label="${p.label}">
                        <span class="theme-swatch-dot" style="--sw:${p.swatch}; --sw-dark:${p.swatchDark};"></span>
                        <span class="theme-swatch-name">${p.label}</span>
                    </button>`).join('')}
            </div>
            <button type="button" class="theme-picker-reset">↺ Otomatik (varsayılan)</button>
            <div class="theme-picker-note"></div>
        `;
        document.body.appendChild(panel);

        panel.querySelector('.theme-picker-close').addEventListener('click', closePanel);
        panel.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode === 'dark')));
        panel.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => setColor(b.dataset.color)));
        panel.querySelector('.theme-picker-reset').addEventListener('click', () => setColor(null));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
        document.addEventListener('click', (e) => {
            if (!panel || panel.classList.contains('hidden')) return;
            // Paneli açan düğmelere tıklama "dışarı tıklama" sayılmasın (yoksa açılır açılmaz kapanır)
            if (panel.contains(e.target) || e.target.closest('#btn-theme-toggle, #btn-profile-theme, [data-tema-ac]')) return;
            closePanel();
        });
    }

    function renderPanelState() {
        if (!panel) return;
        const dark = document.body.classList.contains('dark-theme');
        panel.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', (b.dataset.mode === 'dark') === dark));
        const choice = getChoice();
        panel.querySelectorAll('[data-color]').forEach(b => {
            const on = b.dataset.color === choice;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
        });
        const sid = safeGet('myStaffId');
        let who = '';
        if (sid && typeof DB !== 'undefined' && Array.isArray(DB.staff)) {
            const s = DB.staff.find(x => String(x.id) === String(sid));
            if (s) who = s.name;
        }
        panel.querySelector('.theme-picker-note').textContent = sid
            ? `Seçiminiz${who ? ' (' + who + ')' : ''} bu cihazda saklanır.`
            : 'Seçim bu cihazda saklanır.';
        panel.querySelector('.theme-picker-reset').classList.toggle('active', !choice);
    }

    // Başlık simgesi her zaman 🎨 (uygulama açılışta ☀️/🌙 yazıyordu; panelin açılacağı belli olsun)
    function setHeaderIcon() {
        const btn = document.getElementById('btn-theme-toggle');
        if (btn && btn.textContent.trim() !== '🎨') btn.textContent = '🎨';
    }

    let lastTrigger = null;
    function positionPanel() {
        if (!panel) return;
        if (window.innerWidth <= 600) { panel.style.left = ''; panel.style.top = ''; return; }
        // Paneli açan düğmenin altına yerleştir; düğme ekranda değilse sağ üst köşeye
        const trigger = (lastTrigger && document.body.contains(lastTrigger)) ? lastTrigger : document.getElementById('btn-theme-toggle');
        let r = trigger ? trigger.getBoundingClientRect() : null;
        if (!r || r.bottom < 0 || r.top > window.innerHeight || (r.width === 0 && r.height === 0)) {
            r = { bottom: 64, right: window.innerWidth - 16 };
        }
        const w = panel.offsetWidth || 290;
        const h = panel.offsetHeight || 380;
        panel.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, r.bottom + 8)) + 'px';
        panel.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    }

    function openPanel(trigger) {
        if (!panel) buildPanel();
        lastTrigger = (trigger && trigger.nodeType === 1) ? trigger : null;
        renderPanelState();
        panel.classList.remove('hidden');
        positionPanel();
        const first = panel.querySelector('.theme-swatch.active') || panel.querySelector('.theme-swatch');
        if (first) first.focus({ preventScroll: true });
    }
    function closePanel() { if (panel) panel.classList.add('hidden'); }

    // ------------------------------------------------------------------ Kurulum
    function init() {
        // Eski otomatik temayı sar: seçim varsa kişinin seçimi uygulanır
        if (typeof window.applyGenderTheme === 'function' && !window.applyGenderTheme.__temaWrapped) {
            originalGenderTheme = window.applyGenderTheme;
            const wrapped = function () { applyColor(); };
            wrapped.__temaWrapped = true;
            window.applyGenderTheme = wrapped;
        }

        // 🌓 düğmesi artık paneli açar (eski açık/koyu geçişi panelin içinde)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('#btn-theme-toggle');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            if (panel && !panel.classList.contains('hidden')) closePanel(); else openPanel();
        }, true);
        const btn = document.getElementById('btn-theme-toggle');
        if (btn) {
            btn.title = 'Tema: görünüm ve renk';
            btn.setAttribute('aria-haspopup', 'dialog');
            setHeaderIcon();
            // app.js applyTheme() simgeyi sonradan ☀️/🌙 yapabiliyor; değişirse 🎨'ye geri al
            try { new MutationObserver(setHeaderIcon).observe(btn, { childList: true, characterData: true, subtree: true }); } catch (e) {}
        }
        // Kaydırma sırasında açık panel düğmeyle birlikte doğru yerde kalsın
        window.addEventListener('scroll', () => { if (panel && !panel.classList.contains('hidden')) positionPanel(); }, { passive: true });

        window.addEventListener('resize', positionPanel);
        // Kimlik değişince (profil değiştir / giriş) kişinin kendi seçimi uygulansın
        window.addEventListener('storage', (e) => { if (e.key === 'myStaffId' || (e.key || '').startsWith('tema_renk_')) applyColor(); });
        applyColor();
    }

    window.TemaSecici = { open: openPanel, close: closePanel, setColor, setMode, apply: applyColor, palettes: PALETTES.map(p => p.key) };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
