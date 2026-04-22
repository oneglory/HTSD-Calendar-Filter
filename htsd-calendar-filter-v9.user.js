// ==UserScript==
// @name         HTSD Calendar Filter v9
// @namespace    http://tampermonkey.net/
// @version      9.2
// @description  Floating modal to filter HTSD calendar to your schools. Scroll the left sidebar once, then use the two-step flow.
// @author       oneglory
// @match        https://www.htsdnj.org/our-district/hamilton-township-school-district-calendar*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ─── CONFIG ───────────────────────────────────────────────────────────────
    // Add or remove school name fragments to match what you want checked.
    const MY_SCHOOLS = [];
    // ─────────────────────────────────────────────────────────────────────────

    // ─── UI INJECTION ─────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        #htsd-v9 {
            position: fixed; top: 16px; right: 16px; z-index: 9999999;
            width: 300px; background: #fff; border: 2px solid #003366;
            border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.22);
            font-family: system-ui, sans-serif; font-size: 13px; overflow: hidden;
        }
        #htsd-v9 .hdr {
            background: #003366; color: #fff; padding: 10px 14px;
            font-weight: 700; font-size: 13px; letter-spacing: 0.03em;
        }
        #htsd-v9 .body { padding: 12px; max-height: 360px; overflow-y: auto; background: #f7f9fc; }
        #htsd-v9 .foot { padding: 10px 12px; background: #fff; border-top: 1px solid #e0e6ee; }
        #htsd-v9 .hint { font-size: 11px; color: #666; margin-bottom: 10px; line-height: 1.5; }
        #htsd-v9 .row {
            display: flex; align-items: center; gap: 8px;
            padding: 7px 10px; margin-bottom: 5px;
            background: #fff; border: 1px solid #dce4ef; border-radius: 6px;
            cursor: pointer;
        }
        #htsd-v9 .row:hover { background: #eef3fb; }
        #htsd-v9 .row input { cursor: pointer; width: 15px; height: 15px; flex-shrink: 0; }
        #htsd-v9 .row span { flex: 1; }
        #htsd-v9 .btn {
            width: 100%; padding: 11px; border: none; border-radius: 7px;
            font-weight: 700; font-size: 13px; cursor: pointer; margin-bottom: 7px;
            transition: opacity 0.15s, background 0.15s;
        }
        #htsd-v9 .btn:hover { opacity: 0.88; }
        #htsd-v9 .btn:disabled { opacity: 0.45; cursor: not-allowed; }
        #htsd-v9 .btn-prep  { background: #e05c00; color: #fff; }
        #htsd-v9 .btn-apply { background: #003366; color: #fff; display: none; }
        #htsd-v9 .btn-clear  { background: #fff; color: #c0392b; border: 1.5px solid #c0392b; }
        #htsd-v9 .status {
            font-size: 11px; font-weight: 600; text-align: center;
            min-height: 16px; color: #666;
        }
        #htsd-v9 .status.ok   { color: #1a7a3a; }
        #htsd-v9 .status.warn { color: #c0392b; }
        #htsd-v9 .status.info { color: #e05c00; }
    `;
    document.head.appendChild(style);

    const ui = document.createElement('div');
    ui.id = 'htsd-v9';
    ui.innerHTML = `
        <div class="hdr">HTSD Calendar Filter</div>
        <div class="body" id="v9-body">
            <p class="hint">
                <b>Before Step 1:</b> Scroll the school list on the left side of the page
                up and down once so the browser renders all the checkboxes.
                Then click <b>Step 1</b>.
            </p>
            <button class="btn btn-prep" id="v9-prep">Step 1 — Load schools</button>
            <button class="btn btn-clear" id="v9-clear">Reset calendar to default</button>
        </div>
        <div class="foot">
            <button class="btn btn-apply" id="v9-apply">Step 2 — Apply filter</button>

            <button class="btn btn-clear" id="v9-clear2" style="display:none;">Reset calendar to default</button>
            <div class="status" id="v9-status">Ready</div>
        </div>
    `;
    document.body.appendChild(ui);

    const body      = document.getElementById('v9-body');
    const prepBtn   = document.getElementById('v9-prep');
    const applyBtn  = document.getElementById('v9-apply');
    const statusEl  = document.getElementById('v9-status');

    function setStatus(msg, type = '') {
        statusEl.textContent = msg;
        statusEl.className = 'status' + (type ? ' ' + type : '');
    }

    // ─── STEP 1: LOAD SCHOOLS ─────────────────────────────────────────────────
    async function loadSchools() {
        prepBtn.disabled = true;
        setStatus('Expanding categories...', 'info');

        // Expand every collapsed category in the filter sidebar
        document.querySelectorAll('.fsCalendarFilterCategoryTitle, .fsCalendarFilterCategoryExpand')
            .forEach(el => {
                const cat = el.closest('.fsCalendarFilterCategory');
                if (cat && !cat.classList.contains('fsIsExpanded')) el.click();
            });

        // Wait for the DOM to populate the checkboxes after expansion
        await delay(1200);

        // Strategy: find all checkboxes, then resolve their label — regardless of class names.
        // We try three ways to get the label for each checkbox:
        //   1. The checkbox's own <label> ancestor
        //   2. A <label for="checkbox-id"> sibling
        //   3. The checkbox's parent element text
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
            .filter(cb => {
                // Keep only checkboxes that live inside the calendar filter area.
                // We detect this by walking up and checking for known Finalsite classes,
                // or by proximity to the sidebar. We fall back to any checkbox not inside
                // the injected modal.
                return !cb.closest('#htsd-v9');
            });

        if (checkboxes.length === 0) {
            setStatus('No checkboxes found — scroll the sidebar, then try again.', 'warn');
            prepBtn.disabled = false;
            return;
        }

        // Build a list of { label (DOM element), text (string), checkbox (DOM element) }
        const entries = [];
        for (const cb of checkboxes) {
            let labelEl = cb.closest('label') || null;
            if (!labelEl && cb.id) {
                labelEl = document.querySelector(`label[for="${cb.id}"]`);
            }
            if (!labelEl) {
                labelEl = cb.parentElement;
            }

            let text = labelEl ? labelEl.innerText.trim() : '';

            // Clean doubled text (Finalsite sometimes renders "School School")
            const half = Math.ceil(text.length / 2);
            if (text.slice(0, half).trim() === text.slice(half).trim()) {
                text = text.slice(0, half).trim();
            }

            // Skip "Select All" / "Deselect All" and empty entries
            if (!text || text.toLowerCase().includes('select all') || text.toLowerCase().includes('deselect')) continue;

            entries.push({ labelEl, text, cb });
        }

        if (entries.length === 0) {
            setStatus('Checkboxes found but labels unreadable — scroll sidebar and retry.', 'warn');
            prepBtn.disabled = false;
            return;
        }

        // Build the list in the modal
        body.innerHTML = '';
        entries.forEach(({ text, cb: siteCb }) => {
            const isTarget = MY_SCHOOLS.some(s => text.toLowerCase().includes(s.toLowerCase()));

            const row = document.createElement('div');
            row.className = 'row';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'modal-cb';
            cb.checked = isTarget;
            cb.dataset.labelText = text;

            const span = document.createElement('span');
            span.textContent = text;

            row.appendChild(cb);
            row.appendChild(span);
            row.addEventListener('click', e => {
                if (e.target !== cb) cb.checked = !cb.checked;
            });

            body.appendChild(row);
        });

        applyBtn.style.display = 'block';
        document.getElementById('v9-clear2').style.display = 'block';
        setStatus(`Loaded ${body.querySelectorAll('.modal-cb').length} schools.`, 'ok');
        prepBtn.disabled = false;
    }

    // ─── STEP 2: APPLY FILTER ─────────────────────────────────────────────────
    // Core insight: DO NOT set checkbox.checked directly.
    // Finalsite's JS only reacts to a real .click() on the label.
    // So we click the label when the state is wrong — and we verify after each click.

    async function applyFilter(targetSchools) {
        applyBtn.disabled = true;
        setStatus('Working...', 'info');

        const updateBtn = findUpdateButton();
        if (!updateBtn) {
            setStatus('Cannot find the Update Calendar button.', 'warn');
            applyBtn.disabled = false;
            return;
        }

        // Build the same checkbox entries map that loadSchools uses
        const siteEntries = buildSiteEntries();
        if (siteEntries.length === 0) {
            setStatus('Site labels gone — scroll sidebar and retry Step 1.', 'warn');
            applyBtn.disabled = false;
            return;
        }

        // First: uncheck everything by clicking currently-checked labels
        for (const { labelEl, cb } of siteEntries) {
            if (cb.checked) {
                labelEl.click();
                await delay(80);
            }
        }

        await delay(300);

        // Second: click the labels for target schools to check them
        if (targetSchools.length > 0) {
            for (const { labelEl, text, cb } of siteEntries) {
                const shouldCheck = targetSchools.some(s =>
                    text.toLowerCase().includes(s.toLowerCase())
                );
                if (shouldCheck && !cb.checked) {
                    labelEl.click();
                    await delay(80);
                    // If a single click didn't register, try once more
                    if (!cb.checked) {
                        labelEl.click();
                        await delay(80);
                    }
                }
            }
        }

        await delay(300);

        setStatus('Clicking Update Calendar...', 'info');
        updateBtn.click();

        // Wait for the site to respond (watch for the loading overlay to clear)
        await waitForCalendarUpdate();

        setStatus('Done!', 'ok');
        applyBtn.disabled = false;
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────────
    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // Finds all calendar filter checkboxes on the page (excluding our modal)
    // and resolves each one to { labelEl, text, cb }.
    function buildSiteEntries() {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
            .filter(cb => !cb.closest('#htsd-v9'));

        const entries = [];
        for (const cb of checkboxes) {
            let labelEl = cb.closest('label') || null;
            if (!labelEl && cb.id) {
                labelEl = document.querySelector(`label[for="${cb.id}"]`);
            }
            if (!labelEl) labelEl = cb.parentElement;

            let text = labelEl ? labelEl.innerText.trim() : '';
            const half = Math.ceil(text.length / 2);
            if (text.slice(0, half).trim() === text.slice(half).trim()) {
                text = text.slice(0, half).trim();
            }

            if (!text || text.toLowerCase().includes('select all') || text.toLowerCase().includes('deselect')) continue;

            entries.push({ labelEl, text, cb });
        }
        return entries;
    }

    // Call htsdDebug() in the browser console to see what checkboxes the script can see
    window.htsdDebug = function() {
        const all = Array.from(document.querySelectorAll('input[type="checkbox"]'));
        console.group('HTSD Debug — all checkboxes on page');
        all.forEach((cb, i) => {
            const label = cb.closest('label') || cb.parentElement;
            console.log(i, '|', cb.className, '|', 'checked:', cb.checked, '|', 'label text:', label?.innerText?.trim().slice(0, 60));
        });
        console.groupEnd();
    };

    function findUpdateButton() {
        return (
            document.querySelector('button.fsUpdateFilters') ||
            Array.from(document.querySelectorAll('button')).find(b =>
                b.innerText.trim().toUpperCase().includes('UPDATE')
            )
        );
    }

    async function waitForCalendarUpdate(maxWait = 8000) {
        const step = 300;
        let elapsed = 0;
        while (elapsed < maxWait) {
            await delay(step);
            elapsed += step;
            const loader = document.querySelector('.fsCalendarLoading, .fsLoading');
            if (!loader) break;
        }
    }

    // ─── BUTTON WIRING ────────────────────────────────────────────────────────
    prepBtn.addEventListener('click', loadSchools);

    function clearSiteData() {
        localStorage.clear();
        sessionStorage.clear();
        document.cookie.split(';').forEach(cookie => {
            const name = cookie.split('=')[0].trim();
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
        });
        location.reload();
    }

    document.getElementById('v9-clear').addEventListener('click', clearSiteData);
    document.getElementById('v9-clear2').addEventListener('click', clearSiteData);

    applyBtn.addEventListener('click', () => {
        const selected = Array.from(body.querySelectorAll('.modal-cb:checked'))
            .map(cb => cb.dataset.labelText);
        applyFilter(selected);
    });

})();
