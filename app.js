document.addEventListener('DOMContentLoaded', () => {
    // --- 1. State Management ---
    // --- 1. State Management & Zero-Config Sync ---
    const state = {
        submissions: JSON.parse(localStorage.getItem('pw_data_submissions') || '[]'),
        shifts: JSON.parse(localStorage.getItem('pw_data_shifts') || '[]'),
        leads: JSON.parse(localStorage.getItem('pw_data_leads') || '["西本 b", "橋本 b", "間瀬"]'),
        dailyMessages: JSON.parse(localStorage.getItem('pw_data_daily_messages') || '[]'),
        selectedShifts: [],
        currentView: 'register-view'
    };

    // --- Cloud Sync Mechanism (Google Apps Script based for zero-config) ---
    // User's deployed GAS URL for live synchronization
    const SYNC_URL = "https://script.google.com/macros/s/AKfycbwuh_lqL8N_8qXhC8j_x5xSbpj3mp2Qk5cwCuO8i6TUv3Q8s5p-590cFbo1HEkewDOs/exec"; 

    const mySubmissionIds = JSON.parse(localStorage.getItem('pw_my_submission_ids') || '[]');

    const syncToCloud = async () => {
        try {
            const dataToSync = {
                leads: state.leads,
                shifts: state.shifts,
                submissions: state.submissions,
                dailyMessages: state.dailyMessages
            };
            // Send to cloud bridge
            await fetch(SYNC_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(dataToSync)
            });
            console.log("Synced to cloud.");
        } catch (e) { console.error("Sync failed", e); }
    };

    const fetchFromCloud = async () => {
        try {
            const response = await fetch(SYNC_URL);
            if (response.ok) {
                const cloudData = await response.json();
                if (cloudData.shifts) state.shifts = cloudData.shifts;
                if (cloudData.submissions) state.submissions = cloudData.submissions;
                if (cloudData.leads) state.leads = cloudData.leads;
                if (cloudData.dailyMessages) state.dailyMessages = cloudData.dailyMessages;
                
                localStorage.setItem('pw_data_shifts', JSON.stringify(state.shifts));
                localStorage.setItem('pw_data_submissions', JSON.stringify(state.submissions));
                localStorage.setItem('pw_data_leads', JSON.stringify(state.leads));
                localStorage.setItem('pw_data_daily_messages', JSON.stringify(state.dailyMessages || []));
                render();
            }
        } catch (e) { }
    };

    // Auto-poll for changes from other devices every 5 seconds
    setInterval(fetchFromCloud, 5000);

    const autoCleanupShifts = () => {
        const now = Date.now();
        state.shifts = state.shifts.filter(s => !s.expiresAt || s.expiresAt > now);
        if (state.dailyMessages) {
            state.dailyMessages = state.dailyMessages.filter(m => !m.expiresAt || m.expiresAt > now);
        }
    };

    const autoCleanupSubmissions = () => {
        const now = Date.now();
        state.submissions = state.submissions.filter(sub => {
            sub.shifts = (sub.shifts || []).filter(sh => !sh.expiresAt || sh.expiresAt > now);
            return sub.shifts.length > 0;
        });
    };

    const saveState = () => {
        localStorage.setItem('pw_data_submissions', JSON.stringify(state.submissions));
        localStorage.setItem('pw_data_shifts', JSON.stringify(state.shifts));
        localStorage.setItem('pw_data_leads', JSON.stringify(state.leads));
        localStorage.setItem('pw_data_daily_messages', JSON.stringify(state.dailyMessages || []));
        syncToCloud(); // Push changes immediately
    };

    // --- 2. View Controller ---
    const switchView = (viewId) => {
        state.currentView = viewId;
        const views = ['register-view', 'status-view', 'admin-view'];

        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === viewId) {
                    el.style.display = 'block';
                    el.classList.add('active');
                } else {
                    el.style.display = 'none';
                    el.classList.remove('active');
                }
            }
        });

        // UI Adjustments
        const tabHeader = document.getElementById('user-nav');
        const pageTitle = document.getElementById('page-title');
        const adminBtn = document.getElementById('main-admin-btn');
        const tabs = document.querySelectorAll('.tab');

        if (viewId === 'admin-view') {
            if (tabHeader) tabHeader.style.display = 'none';
            if (pageTitle) pageTitle.textContent = 'ADMIN CONSOLE';
            if (adminBtn) adminBtn.classList.add('active');
        } else {
            if (tabHeader) tabHeader.style.display = 'block';
            if (pageTitle) pageTitle.textContent = 'PW参加申込フォーム';
            if (adminBtn) adminBtn.classList.remove('active');

            // Sync active tab state
            tabs.forEach(t => {
                t.classList.toggle('active', t.dataset.view === viewId);
            });
        }

        // Render data for specific view
        render();
    };

    // --- 3. Rendering Logic ---
    const render = () => {
        autoCleanupShifts();
        autoCleanupSubmissions(); // Run both cleanups before every render
        if (state.currentView === 'register-view') renderRegister();
        if (state.currentView === 'status-view') renderStatus();
        if (state.currentView === 'admin-view') renderAdmin();
        if (window.lucide) lucide.createIcons();
    };

    const renderRegister = () => {
        const msgContainer = document.getElementById('daily-messages-container');
        if (msgContainer) {
            const msgs = (state.dailyMessages || []).filter(m => !m.expiresAt || m.expiresAt > Date.now());
            msgs.sort((a,b) => a.expiresAt - b.expiresAt);
            if (msgs.length > 0) {
                msgContainer.innerHTML = msgs.map(m => `
                    <div style="background: var(--surface); border: 2px solid var(--primary); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <h3 style="margin-bottom: 0.75rem; color: var(--primary); display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem; margin-top: 0;">
                            <i data-lucide="info"></i> ${m.date} の予定・お知らせ
                        </h3>
                        ${m.text ? `<p style="white-space: pre-wrap; font-size: 0.95rem; line-height: 1.5; color: var(--text); margin-bottom: ${m.photoData ? '1rem' : '0'}; margin-top: 0;">${m.text}</p>` : ''}
                        ${m.photoData ? `<img src="${m.photoData}" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border);" alt="${m.date}の画像">` : ''}
                    </div>
                `).join('');
            } else {
                msgContainer.innerHTML = '';
            }
        }

        const tbody = document.getElementById('user-shift-tbody');
        if (!tbody) return;

        if (state.shifts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:1.5rem;">現在募集中のシフトはありません</td></tr>';
            return;
        }

        // 「自分のこの端末（ブラウザ）」で申し込んだシフトIDだけを収集
        const mySubmittedShiftIds = new Set();
        state.submissions.forEach(sub => {
            if (mySubmissionIds.includes(sub.id)) {
                (sub.shifts || []).forEach(sh => mySubmittedShiftIds.add(sh.id));
            }
        });

        tbody.innerHTML = state.shifts.map(s => {
            const isSubmittedByMe = mySubmittedShiftIds.has(s.id);
            const isSelected = state.selectedShifts.includes(s.id);

            // 自分がすでに申し込んでいる場合は「申込済み」としてクリック不可にする
            if (isSubmittedByMe) {
                return `
                    <tr>
                        <td style="opacity: 0.6;"><strong>${s.date}</strong><br><small>${s.time}</small></td>
                        <td style="opacity: 0.6;">${s.lead}</td>
                        <td>
                            <div class="status-toggle active" style="background:#e2e8f0; color:var(--text-muted); cursor:default; border:1px solid var(--border);">
                                <i data-lucide="check-circle"></i>
                                <span>申込済み</span>
                            </div>
                        </td>
                    </tr>
                `;
            }

            return `
                <tr>
                    <td><strong>${s.date}</strong><br><small>${s.time}</small></td>
                    <td>${s.lead}</td>
                    <td>
                        <div class="status-toggle ${isSelected ? 'active' : ''}" onclick="window.toggleShiftSelection(${s.id})">
                            <i data-lucide="${isSelected ? 'check' : 'circle'}"></i>
                            <span>${isSelected ? '選択中' : '参加'}</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };

    const renderStatus = () => {
        const container = document.getElementById('personal-history-list');
        if (!container) return;

        // クラウド上のデータ(state.submissions)と、この端末のID(mySubmissionIds)を照らし合わせる
        // 型の不一致を防ぐため文字列に変換して比較します
        const mySubmissions = state.submissions.filter(s => 
            mySubmissionIds.map(String).includes(String(s.id))
        );

        if (mySubmissions.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-muted);">履歴がありません</div>';
            return;
        }

        container.innerHTML = `<h3>あなたの申込履歴</h3>` + mySubmissions.map(s => `
            <div class="admin-main-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                    <small>${new Date(s.timestamp).toLocaleDateString()} 申込</small>
                    <button onclick="window.deleteSubmissionUser(${s.id})" class="text-link-btn" style="color:var(--error); font-size:0.7rem;">取消</button>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                    ${(s.shifts || []).map(sh => `<span class="badge" style="background:var(--primary); color:white; padding:4px 8px; border-radius:8px; font-size:0.75rem;">${sh.date} ${sh.time}</span>`).join('')}
                </div>
            </div>
        `).reverse().join('');
    };

    const renderAdmin = () => {
        // Leads List
        const leadSelect = document.getElementById('adm-lead');
        const leadTags = document.getElementById('adm-leads-tags');
        if (leadSelect) {
            leadSelect.innerHTML = '<option value="" disabled selected>責任者</option>' +
                state.leads.map(l => `<option value="${l}">${l}</option>`).join('');
        }
        if (leadTags) {
            leadTags.innerHTML = state.leads.map(l => `
                <div class="lead-tag">${l} <span onclick="window.removeLead('${l}')" style="cursor:pointer; color:red;">&times;</span></div>
            `).join('');
        }

        // Shifts List
        const shiftTbody = document.getElementById('adm-shift-list-tbody');
        if (shiftTbody) {
            shiftTbody.innerHTML = state.shifts.map(s => `
                <tr>
                    <td>${s.date} ${s.time}</td>
                    <td>${s.lead}</td>
                    <td><button onclick="window.deleteShift(${s.id})" style="color:red; background:none; border:none; cursor:pointer;">削除</button></td>
                </tr>
            `).join('');
        }

        // Submissions List (Aggregated by Shift)
        const subTbody = document.getElementById('adm-submission-tbody');
        if (subTbody) {
            // Aggregation: Map shiftId to names
            const shiftMap = {};
            state.submissions.forEach(sub => {
                sub.shifts.forEach(sh => {
                    if (!shiftMap[sh.id]) shiftMap[sh.id] = [];
                    // Duplicate check: if the same name appears multiple times in the same shift (unlikely with recent fixes but safe)
                    if (!shiftMap[sh.id].includes(sub.name)) {
                        shiftMap[sh.id].push(sub.name);
                    }
                });
            });

            subTbody.innerHTML = state.shifts.map(s => {
                const names = shiftMap[s.id] || [];
                return `
                    <tr>
                        <td style="white-space:nowrap;"><strong>${s.date}</strong> <small>${s.time}</small></td>
                        <td>
                            ${names.length > 0
                        ? names.map(n => `<span style="display:inline-block; background:#f1f5f9; padding:4px 10px; border-radius:6px; margin:2px; font-weight:500;">${n}</span>`).join(' ')
                        : '<span style="color:var(--text-muted); font-size:0.75rem;">(空き)</span>'}
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Daily Messages List
        const msgTbody = document.getElementById('adm-msg-list-tbody');
        if (msgTbody && state.dailyMessages) {
            msgTbody.innerHTML = state.dailyMessages.map(m => `
                <tr>
                    <td style="white-space:nowrap; vertical-align:top;"><strong>${m.date}</strong></td>
                    <td style="max-width: 200px;">
                        <div style="white-space: pre-wrap; font-size: 0.85rem; margin-bottom: ${m.photoData ? '0.5rem' : '0'};">${m.text ? m.text : ''}</div>
                        ${m.photoData ? `<img src="${m.photoData}" style="max-width: 100%; max-height: 100px; border-radius: 4px; border: 1px solid var(--border); display: block; margin-top: 0.5rem;">` : ''}
                    </td>
                    <td style="vertical-align:top;"><button onclick="window.deleteMessage(${m.id})" style="color:var(--error); background:none; border:none; cursor:pointer; font-size:0.85rem; padding: 0.5rem;">削除</button></td>
                </tr>
            `).join('');
        }
    };

    // --- 4. Global Actions (for onclick) ---
    window.deleteSubmission = (id) => {
        if (!confirm('削除しますか？')) return;
        state.submissions = state.submissions.filter(s => s.id !== id);
        saveState();
        render();
    };

    window.deleteSubmissionUser = async (id) => {
        if (!confirm('この申込を取り消しますか？')) return;
        
        // 1. ローカルメモリから削除
        state.submissions = state.submissions.filter(s => String(s.id) !== String(id));
        
        // 2. この端末の「自分の履歴」リストから削除
        const sId = String(id);
        const idx = mySubmissionIds.findIndex(mid => String(mid) === sId);
        if (idx !== -1) {
            mySubmissionIds.splice(idx, 1);
            localStorage.setItem('pw_my_submission_ids', JSON.stringify(mySubmissionIds));
        }
        
        // 3. クラウドに同期（保存）
        saveState();
        render();
        alert('申込を取り消しました。反映まで数秒かかる場合があります。');
    };

    window.toggleShiftSelection = (id) => {
        const index = state.selectedShifts.indexOf(id);
        if (index > -1) state.selectedShifts.splice(index, 1);
        else state.selectedShifts.push(id);
        render();
    };

    window.deleteShift = (id) => {
        if (!confirm('削除しますか？')) return;
        state.shifts = state.shifts.filter(s => s.id !== id);
        saveState();
        render();
    };

    window.removeLead = (name) => {
        state.leads = state.leads.filter(l => l !== name);
        saveState();
        render();
    };

    window.deleteMessage = (id) => {
        if (!confirm('メッセージを削除しますか？')) return;
        state.dailyMessages = state.dailyMessages.filter(m => m.id !== id);
        saveState();
        render();
    };

    // --- 5. Event Listeners ---
    // Tab switching
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // --- Password Management ---
    const getStoredPassword = () => localStorage.getItem('pw_admin_password') || '0000';
    const setStoredPassword = (newPw) => localStorage.setItem('pw_admin_password', newPw);

    const passwordModal = document.getElementById('password-modal');
    const passwordInput = document.getElementById('admin-password-input');
    const pwErrorMsg = document.getElementById('pw-error-msg');
    const pwSubmitBtn = document.getElementById('pw-submit-btn');
    const pwCancelBtn = document.getElementById('pw-cancel-btn');
    const pwForgotBtn = document.getElementById('pw-forgot-btn');

    const showPasswordModal = () => {
        passwordModal.classList.remove('hidden');
        passwordInput.value = '';
        pwErrorMsg.textContent = '';
        passwordInput.focus();
    };

    const hidePasswordModal = () => {
        passwordModal.classList.add('hidden');
    };

    const handleAuth = () => {
        const input = passwordInput.value;
        if (input === getStoredPassword()) {
            hidePasswordModal();
            switchView('admin-view');
        } else {
            pwErrorMsg.textContent = 'パスワードが正しくありません';
            passwordInput.value = '';
            passwordInput.focus();
        }
    };

    pwSubmitBtn.addEventListener('click', handleAuth);
    pwCancelBtn.addEventListener('click', hidePasswordModal);
    passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleAuth(); });

    const handleResetFlow = () => {
        const answer = prompt('リセット用質問：\n扇会衆の会衆番号は？');
        if (answer === '33704') {
            const newPw = prompt('認証に成功しました。新しい4桁のパスワードを設定してください：');
            if (newPw && newPw.length === 4 && /^\d+$/.test(newPw)) {
                setStoredPassword(newPw);
                alert('パスワードを更新しました。新しいパスワードでログインしてください。');
                hidePasswordModal();
            } else if (newPw) {
                alert('4桁の数字で指定してください');
            }
        } else if (answer !== null) {
            alert('回答が正しくありません。変更案内については 33704.ogi@gmail.com までお問い合わせください。');
        }
    };

    pwForgotBtn.addEventListener('click', handleResetFlow);


    // Admin toggle (Password Gated)
    const adminBtn = document.getElementById('main-admin-btn');
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            if (state.currentView === 'admin-view') {
                switchView('register-view');
            } else {
                showPasswordModal();
            }
        });
    }

    // Admin back button
    const adminBackBtn = document.getElementById('admin-back-btn');
    if (adminBackBtn) {
        adminBackBtn.addEventListener('click', () => switchView('register-view'));
    }


    // Lead addition
    const addLeadBtn = document.getElementById('adm-add-lead-btn');
    if (addLeadBtn) {
        addLeadBtn.addEventListener('click', () => {
            const input = document.getElementById('adm-new-lead');
            const name = input.value.trim();
            if (name && !state.leads.includes(name)) {
                state.leads.push(name);
                input.value = '';
                saveState();
                render();
            }
        });
    }

    // Helper: Resize Image
    const resizeImage = (file, maxSize) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    // Resize logic
                    if (width > height) {
                        if (width > maxSize) {
                            height *= maxSize / width;
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width *= maxSize / height;
                            height = maxSize;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); // Add compression
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    // Daily Message addition
    const addMsgForm = document.getElementById('admin-add-message-form');
    if (addMsgForm) {
        addMsgForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rawDate = document.getElementById('adm-msg-date').value;
            const text = document.getElementById('adm-msg-text').value;
            const photoInput = document.getElementById('adm-msg-photo');
            
            const submitBtn = addMsgForm.querySelector('button[type="submit"]');
            const originalBtnHtml = submitBtn.innerHTML;
            
            // UI feedback
            submitBtn.innerHTML = '処理中...';
            submitBtn.disabled = true;

            try {
                let photoData = null;
                if (photoInput.files && photoInput.files[0]) {
                    const file = photoInput.files[0];
                    photoData = await resizeImage(file, 800);
                }

                const d = new Date(rawDate);
                const formattedDate = `${d.getMonth() + 1}/${d.getDate()}`;
                
                const expiryDate = new Date(rawDate);
                expiryDate.setHours(23, 59, 59, 999);

                state.dailyMessages = state.dailyMessages || [];
                const existingIdx = state.dailyMessages.findIndex(m => m.date === formattedDate);
                const msgObj = {
                    id: Date.now(),
                    date: formattedDate,
                    text,
                    photoData,
                    expiresAt: expiryDate.getTime()
                };

                if (existingIdx > -1) {
                    state.dailyMessages[existingIdx] = msgObj;
                } else {
                    state.dailyMessages.push(msgObj);
                }

                saveState();
                addMsgForm.reset();
                render();
            } catch (err) {
                console.error(err);
                alert('画像の処理に失敗しました。');
            } finally {
                submitBtn.innerHTML = originalBtnHtml;
                submitBtn.disabled = false;
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // Shift addition
    const addShiftForm = document.getElementById('admin-add-shift-form');
    if (addShiftForm) {
        addShiftForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const rawDate = document.getElementById('adm-date').value;
            const time = document.getElementById('adm-time').value;
            const lead = document.getElementById('adm-lead').value;

            // Format date 2023-03-05 -> 3/5
            const d = new Date(rawDate);
            const formattedDate = `${d.getMonth() + 1}/${d.getDate()}`;

            // Original date for expiration check (Set time to 23:59:59 of that day)
            const expiryDate = new Date(rawDate);
            expiryDate.setHours(23, 59, 59, 999);

            state.shifts.push({
                id: Date.now(),
                date: formattedDate,
                time,
                lead,
                expiresAt: expiryDate.getTime()
            });
            saveState();
            addShiftForm.reset();
            render();
        });
    }

    // Main Form Submit
    const mainForm = document.getElementById('main-form');
    if (mainForm) {
        mainForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (state.selectedShifts.length === 0) {
                alert('希望日を選択してください');
                return;
            }

            const formData = new FormData(mainForm);
            const userName = formData.get('user_name');
            const newShiftIds = [...state.selectedShifts].sort().join(',');

            // 重複チェック: 同じ名前で同じシフトの組み合わせがある場合は上書き（または無視）する
            // ユーザーの要望「何度も表示されるのを一度にしたい」に対応
            state.submissions = state.submissions.filter(s => {
                const existingShiftIds = s.shifts.map(sh => sh.id).sort().join(',');
                // 名前が同じ、かつシフトの組み合わせが全く同じものは古い方を削除
                return !(s.name === userName && existingShiftIds === newShiftIds);
            });

            const submission = {
                id: Date.now(),
                name: userName,
                shifts: state.selectedShifts.map(id => state.shifts.find(s => s.id === id)),
                timestamp: new Date().toISOString()
            };

            state.submissions.push(submission);
            
            // Record this submission as "mine" on this device
            mySubmissionIds.push(submission.id);
            localStorage.setItem('pw_my_submission_ids', JSON.stringify(mySubmissionIds));
            
            saveState();

            // Success
            document.getElementById('success-modal').classList.remove('hidden');
            mainForm.reset();
            state.selectedShifts = [];
            render();
        });
    }

    // --- Sync Settings Listener (Simplified) ---
    // (Settings are now automatic via cloud bridge)
    fetchFromCloud(); 

    // Start
    render();
});
