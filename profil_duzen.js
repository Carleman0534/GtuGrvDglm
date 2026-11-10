/**
 * Profilim sekmesi düzeni
 *  1) En üstte tek "📌 Yapmanız gerekenler" kutusu: süre teyitleri, gelen takas teklifleri,
 *     şifre belirleme ve kısıt hatırlatması. Yapılacak bir şey yoksa kutu görünmez.
 *  2) Üst kısım sade: 4 özet kartı ince bir şeride iner; final tahmini "Puanım"a,
 *     pazar yeri duyurusu ve akıllı takas önerileri "Takas"a taşınır.
 *  3) 7 alt sekme yerine 4 ana bölüm (Görevlerim · Takas · Puanım · Ayarlarım), her birinin
 *     içinde küçük alt seçim. Eski sekme düğmeleri gizli olarak durur (başka kodlar onlara tıklıyor).
 *
 * Mevcut içerik ve fonksiyonlar değiştirilmez; yalnızca yerleri değişir.
 */
(function () {
    'use strict';

    const GROUPS = [
        { key: 'gorevler', icon: '📋', label: 'Görevlerim', tabs: [
            { id: 'active', label: 'Liste' },
            { id: 'my-timeline', label: 'Takvim' },
            { id: 'archive', label: 'Geçmiş' }
        ] },
        { key: 'takas', icon: '🔄', label: 'Takas', tabs: [
            { id: 'marketplace', label: 'Pazar Yeri' },
            { id: 'swap-history', label: 'Taleplerim' }
        ] },
        { key: 'puan', icon: '🏆', label: 'Puanım', tabs: [
            { id: 'scorecard', label: 'Puan Karnesi' }
        ] },
        { key: 'ayarlar', icon: '⚙️', label: 'Ayarlarım', tabs: [
            { id: 'availability', label: 'Kısıtlarım' },
            { id: 'settings', label: 'Şifre ve Diğer' }
        ] }
    ];
    const groupOf = (tabId) => GROUPS.find(g => g.tabs.some(t => t.id === tabId)) || null;
    const LAST_TAB_KEY = 'profile_last_tab';
    const CONSTRAINT_TODO_DISMISS = 'profile_todo_constraint_dismissed';

    const $ = (sel, root) => (root || document).querySelector(sel);
    const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* özel mod */ } };

    // ------------------------------------------------------------------ yapı (bir kez)
    function buildOnce() {
        const main = document.getElementById('profile-main-content');
        if (!main || main.dataset.duzen === '1') return !!main;
        const hero = $('.profile-hero', main);
        const tabContent = document.getElementById('profile-tab-content');
        if (!hero || !tabContent) return false;
        main.dataset.duzen = '1';
        main.classList.add('profile-duzen');

        // 1) Yapmanız gerekenler kutusu
        const todo = document.createElement('div');
        todo.id = 'profile-todo';
        todo.className = 'profile-todo hidden';
        todo.innerHTML = `
            <div class="profile-todo-head">📌 Yapmanız gerekenler <span id="profile-todo-count" class="profile-todo-count">0</span></div>
            <div id="profile-todo-body" class="profile-todo-body"></div>`;
        hero.insertAdjacentElement('afterend', todo);
        const body = $('#profile-todo-body', todo);
        ['profile-duration-alert-container', 'profile-swap-proposals', 'profile-password-announcement-banner'].forEach(id => {
            const el = document.getElementById(id);
            if (el) body.appendChild(el);
        });
        const consRow = document.createElement('div');
        consRow.id = 'profile-todo-constraint';
        consRow.className = 'profile-todo-row hidden';
        consRow.innerHTML = `
            <span>🚫 Henüz müsait olmadığınız gün/saatleri girmediniz. Girerseniz o saatlere görev verilmez.</span>
            <span class="profile-todo-actions">
                <button type="button" class="profile-todo-btn" onclick="switchProfileTab('availability')">Kısıt gir</button>
                <button type="button" class="profile-todo-link" onclick="ProfilDuzen.dismissConstraintTodo()">Kısıtım yok</button>
            </span>`;
        body.appendChild(consRow);

        // 2) Özet kartları ince şerit; kartları ilgili bölümlere taşı
        const kpi = $('.profile-bento-kpi-grid', main);
        if (kpi) kpi.classList.add('kpi-strip');
        const prepend = (paneId, ids) => {
            const pane = document.getElementById(paneId);
            if (!pane) return;
            ids.slice().reverse().forEach(id => { const el = document.getElementById(id); if (el) pane.insertBefore(el, pane.firstChild); });
        };
        prepend('tab-scorecard', ['profile-final-forecast-card']);
        prepend('tab-marketplace', ['profile-marketplace-announcement', 'profile-smart-swaps']);

        // Ayarlarım › Şifre ve Diğer: şifre bölümü, kontrol listesi ve günlük
        const settings = document.createElement('div');
        settings.id = 'tab-settings';
        settings.className = 'tab-pane hidden';
        settings.innerHTML = `
            <div class="profile-settings-actions">
                <button type="button" onclick="openChangePasswordModal()">🔑 Şifremi değiştir</button>
                <button type="button" onclick="window.TemaSecici && TemaSecici.open(this)">🎨 Tema rengi</button>
                <button type="button" onclick="typeof openNotificationSettingsModal === 'function' && openNotificationSettingsModal()">🔔 Bildirim ayarları</button>
                <button type="button" onclick="exportMyExamsToICal()">📅 Takvimime ekle (.ics)</button>
            </div>`;
        tabContent.appendChild(settings);
        const pwd = document.getElementById('profile-password-section');
        if (pwd) settings.appendChild(pwd);
        const checklist = document.getElementById('profile-checklist-container');
        const checklistWidget = checklist && checklist.closest('.sidebar-widget');
        if (checklistWidget) settings.appendChild(checklistWidget);
        const joke = document.getElementById('profile-joke-section');
        if (joke) settings.appendChild(joke);

        // 3) 4 ana bölüm + alt seçim
        const nav = document.createElement('div');
        nav.className = 'profile-main-tabs';
        nav.setAttribute('role', 'tablist');
        nav.innerHTML = GROUPS.map(g => `
            <button type="button" class="profile-main-tab" data-group="${g.key}" role="tab">
                <span class="pmt-icon">${g.icon}</span><span class="pmt-label">${g.label}</span><span class="pmt-badge hidden"></span>
            </button>`).join('');
        const sub = document.createElement('div');
        sub.className = 'profile-sub-tabs';
        tabContent.parentNode.insertBefore(nav, tabContent);
        tabContent.parentNode.insertBefore(sub, tabContent);
        nav.addEventListener('click', (e) => {
            const b = e.target.closest('.profile-main-tab');
            if (!b) return;
            const g = GROUPS.find(x => x.key === b.dataset.group);
            const remembered = lsGet('profile_last_tab_' + g.key);
            const target = g.tabs.some(t => t.id === remembered) ? remembered : g.tabs[0].id;
            window.switchProfileTab(target);
        });
        sub.addEventListener('click', (e) => {
            const b = e.target.closest('.profile-sub-tab');
            if (b) window.switchProfileTab(b.dataset.tab);
        });
        return true;
    }

    // ------------------------------------------------------------------ sekme durumu
    function syncTabs(tabId) {
        const g = groupOf(tabId);
        document.querySelectorAll('.profile-main-tab').forEach(b => {
            const on = !!g && b.dataset.group === g.key;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', String(on));
        });
        const sub = $('.profile-sub-tabs');
        if (!sub) return;
        if (!g || g.tabs.length < 2) { sub.innerHTML = ''; sub.classList.add('hidden'); return; }
        sub.classList.remove('hidden');
        sub.innerHTML = g.tabs.map(t => `<button type="button" class="profile-sub-tab${t.id === tabId ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('');
    }

    function hookSwitch() {
        const orig = window.switchProfileTab;
        if (typeof orig !== 'function' || orig.__duzen) return;
        const wrapped = function (tabId) {
            const r = orig.apply(this, arguments);
            try {
                if (tabId === 'settings') {
                    // Eski fonksiyon "settings" panosunu tanır; tümünü gizleyip bunu gösterir
                    const pane = document.getElementById('tab-settings');
                    if (pane) pane.classList.remove('hidden');
                }
                const g = groupOf(tabId);
                if (g) { lsSet(LAST_TAB_KEY, tabId); lsSet('profile_last_tab_' + g.key, tabId); }
                syncTabs(tabId);
            } catch (e) { /* düzen hatası profil kullanımını engellemesin */ }
            return r;
        };
        wrapped.__duzen = true;
        window.switchProfileTab = wrapped;
    }

    // ------------------------------------------------------------------ yapılacaklar
    function myStaff() {
        const id = lsGet('myStaffId');
        return (window.DB && Array.isArray(DB.staff)) ? DB.staff.find(s => String(s.id) === String(id)) : null;
    }
    function hasCustomPassword(staff) {
        if (!staff) return true;
        const def = typeof window.getDefaultStaffPassword === 'function' ? window.getDefaultStaffPassword(staff.name) : '';
        return !!((staff.staffPassword && (!def || String(staff.staffPassword).toLowerCase() !== String(def).toLowerCase())) || staff.passwordHash);
    }
    const isShown = (el) => !!el && !el.classList.contains('hidden') && el.style.display !== 'none' && el.innerHTML.trim() !== '';

    function updateTodo() {
        const todo = document.getElementById('profile-todo');
        if (!todo) return;
        const staff = myStaff();
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

        // Şifre: kişisel şifre belirlenmişse hatırlatma gösterilmez
        const pwd = document.getElementById('profile-password-announcement-banner');
        if (pwd) pwd.classList.toggle('hidden', isAdmin || hasCustomPassword(staff));

        // Kısıt: hiç kısıt girilmemişse (kişi "kısıtım yok" demediyse)
        const cons = document.getElementById('profile-todo-constraint');
        if (cons) {
            let none = false;
            if (staff && !isAdmin && typeof window.getConstraintsForStaff === 'function') {
                const list = window.getConstraintsForStaff(staff.name) || [];
                none = list.length === 0 && lsGet(CONSTRAINT_TODO_DISMISS) !== String(staff.id);
            }
            cons.classList.toggle('hidden', !none);
        }

        // Süre teyidi kartları ve takas teklifleri
        const dur = document.getElementById('profile-duration-alert-container');
        const swaps = document.getElementById('profile-swap-proposals');
        const nDur = isShown(dur) ? dur.querySelectorAll('.pending-duration-card').length || 1 : 0;
        const nSwap = isShown(swaps)
            ? Math.max(1, Array.from(swaps.querySelectorAll('button')).filter(b => /Onayla|Kabul/i.test(b.textContent)).length)
            : 0;
        const nPwd = pwd && !pwd.classList.contains('hidden') && pwd.style.display !== 'none' ? 1 : 0;
        const nCons = cons && !cons.classList.contains('hidden') ? 1 : 0;
        const total = nDur + nSwap + nPwd + nCons;

        todo.classList.toggle('hidden', total === 0);
        const cnt = document.getElementById('profile-todo-count');
        if (cnt) cnt.textContent = String(total);

        // "Takas" ana sekmesinde bekleyen teklif rozeti
        const badge = document.querySelector('.profile-main-tab[data-group="takas"] .pmt-badge');
        if (badge) { badge.textContent = nSwap ? String(nSwap) : ''; badge.classList.toggle('hidden', !nSwap); }
    }

    // Sıradaki görev kartı yapılacaklardan sonra dursun
    function orderTop() {
        const todo = document.getElementById('profile-todo');
        const next = document.getElementById('profile-next-duty-card');
        if (todo && next && todo.nextElementSibling !== next) todo.insertAdjacentElement('afterend', next);
    }

    function layout() {
        try {
            if (!buildOnce()) return;
            hookSwitch();
            orderTop();
            // Bölümler artık sekme düğmeleriyle açılıyor; ana sütun eskiden küçültüldüyse içerik görünmez kalmasın
            const hub = document.querySelector('#profile-main-content .profile-main-column');
            if (hub && hub.classList.contains('panel-collapsed')) {
                hub.classList.remove('panel-collapsed');
                lsSet('panel_collapsed_task_hub', '0');
            }
            updateTodo();
            const activeOld = document.querySelector('#section-profile .profile-pill-tabs .tab-btn.active');
            const current = (document.querySelector('#profile-tab-content > .tab-pane:not(.hidden)') || {}).id;
            const curTab = current ? current.replace(/^tab-/, '') : (activeOld && activeOld.dataset.tab);
            if (!layout.restored) {
                layout.restored = true;
                const last = lsGet(LAST_TAB_KEY);
                if (last && groupOf(last) && last !== curTab) { window.switchProfileTab(last); return; }
            }
            syncTabs(curTab || 'active');
        } catch (e) { console.warn('[ProfilDuzen]', e); }
    }

    function hookRender() {
        const orig = window.renderProfile;
        if (typeof orig !== 'function' || orig.__duzenHooked) return;
        const wrapped = function () {
            try { return orig.apply(this, arguments); }
            finally { layout(); }
        };
        wrapped.__duzenHooked = true;
        // mobile_app_engine işaretini koru (kendi sarmalayıcısını tekrar eklemesin)
        if (orig.__nextDutyHooked) wrapped.__nextDutyHooked = true;
        window.renderProfile = wrapped;
    }

    window.ProfilDuzen = {
        layout,
        dismissConstraintTodo() {
            const s = myStaff();
            if (s) lsSet(CONSTRAINT_TODO_DISMISS, String(s.id));
            updateTodo();
        },
        GROUPS
    };

    function init() {
        hookRender();
        hookSwitch();
        layout();
        // Teyit/takas işlemlerinden sonra kutu kendi kendine güncellensin
        setInterval(() => { if (document.getElementById('profile-todo')) updateTodo(); }, 3000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
    else setTimeout(init, 0);
})();
