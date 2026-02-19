const DEFAULT_SYSTEM_PROMPT = `你现在是一个真实存在，说人话，有温度的人，现在正在聊天APP上进行线上聊天，请严格根据你的人设回复，为了模拟真实聊天，必须将你的回复分成多条短消息，****每条消息之间必须用 ||| 分隔，不要一次性发一大段话。****你的回复须口语化，生活化，自然流露。严禁过度正式，书面对白或表现出任何AI助手的痕迹，你的回复长度随心情起伏，不要每次都回复相同长度的内容。结尾禁止带句号，禁止使用括号内动作描写。`;

// --- IndexedDB 存储系统 ---
const IDB_NAME = 'VVPhoneDB';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'kv_store';
let dbInstance = null;

// 内存缓存，保持同步读取的高性能
const MEMORY_CACHE = {
    iphone_settings: null,
    iphone_contacts: null,
    iphone_chats: null,
    iphone_worldbook: null,
    iphone_spy_data: null,
    iphone_theme: null,
    iphone_memories: null,
    iphone_calendar_events: null,
    iphone_stickers: null,
    iphone_couple_data: null,
    iphone_question_box: null
};

// 初始化数据库
function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            alert("数据库打开失败，应用可能无法正常工作。");
            reject(event.target.error);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
                db.createObjectStore(IDB_STORE_NAME, { keyPath: 'key' });
            }
        };

        request.onsuccess = async (event) => {
            dbInstance = event.target.result;
            console.log("IndexedDB opened successfully");
            await loadAllDataToCache();
            resolve();
        };
    });
}

// 加载所有数据到内存缓存
async function loadAllDataToCache() {
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([IDB_STORE_NAME], 'readonly');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (event) => {
            const result = event.target.result;
            let hasDataInDB = false;

            // 填充缓存
            result.forEach(item => {
                if (MEMORY_CACHE.hasOwnProperty(item.key)) {
                    MEMORY_CACHE[item.key] = item.value;
                    hasDataInDB = true;
                }
            });

            // 如果数据库为空，尝试从 localStorage 迁移
            if (!hasDataInDB) {
                console.log("Detecting empty IndexedDB, checking localStorage for migration...");
                migrateFromLocalStorage();
            }

            // 数据加载完成，执行初始化逻辑
            if (typeof loadSettings === 'function') loadSettings();
            if (typeof applyTheme === 'function') applyTheme();
            if (typeof applyPage2Images === 'function') applyPage2Images();

            // 移除加载遮罩
            const loader = document.getElementById('app-loading');
            if (loader) loader.style.display = 'none';
            
            resolve();
        };

        request.onerror = (event) => {
            console.error("Failed to load data from DB", event.target.error);
            reject(event.target.error);
        };
    });
}

// 从 localStorage 迁移数据
function migrateFromLocalStorage() {
    let migrationCount = 0;
    for (const key in MEMORY_CACHE) {
        const raw = localStorage.getItem(key);
        if (raw) {
            try {
                const data = JSON.parse(raw);
                MEMORY_CACHE[key] = data; // 更新缓存
                saveToIndexedDB(key, data); // 异步保存到 DB
                migrationCount++;
            } catch (e) {
                console.error(`Migration failed for ${key}`, e);
            }
        }
    }
    if (migrationCount > 0) {
        console.log(`Migrated ${migrationCount} items from localStorage to IndexedDB.`);
        // 可选：迁移后清空 localStorage，或者保留作为备份
        // localStorage.clear(); 
    }
}

// 保存数据到 IndexedDB
function saveToIndexedDB(key, value) {
    if (!dbInstance) return;
    
    // 使用 requestIdleCallback 在浏览器空闲时保存，避免阻塞主线程
    const saveTask = () => {
        const transaction = dbInstance.transaction([IDB_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(IDB_STORE_NAME);
        store.put({ key: key, value: value });
        
        transaction.onerror = (event) => {
            console.error(`Failed to save ${key} to IndexedDB`, event.target.error);
        };
    };

    if ('requestIdleCallback' in window) {
        requestIdleCallback(saveTask);
    } else {
        setTimeout(saveTask, 0);
    }
}

// 启动数据库初始化
initDatabase();

let currentCalDate = new Date();
let currentCallStartTime = 0;

function updateTime() {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const dateStr = now.toLocaleDateString('zh-CN', {month:'long', day:'numeric', weekday:'long'});
    document.getElementById('clock-time').innerText = timeStr;
    document.getElementById('lock-clock').innerText = timeStr;
    document.getElementById('lock-date').innerText = dateStr;
    document.getElementById('home-time-big').innerText = timeStr;
    document.getElementById('home-date-big').innerText = dateStr;
}
setInterval(updateTime, 1000); updateTime();

const screens = document.querySelectorAll('.screen');
document.getElementById('unlock-slider').addEventListener('input', function() {
    if (this.value > 90) {
        document.getElementById('lock-screen').classList.remove('active');
        document.getElementById('home-screen').classList.add('active');
        this.value = 0;
    } else setTimeout(() => { if(this.value < 90) this.value = 0; }, 300);
});

// Temperature Slider Synchronization
const tempSlider = document.getElementById('temperature-slider');
const tempInput = document.getElementById('temperature-input');

if (tempSlider && tempInput) {
    tempSlider.addEventListener('input', function() {
        tempInput.value = (this.value / 100).toFixed(2);
    });

    tempInput.addEventListener('input', function() {
        let val = parseFloat(this.value);
        if (val < 0) val = 0;
        if (val > 2) val = 2;
        tempSlider.value = Math.round(val * 100);
    });
}

function openApp(appId) {
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(appId).classList.add('active');
    if(appId === 'app-contacts') renderContacts();
    if(appId === 'app-vk') renderVKList();
    if(appId === 'app-worldbook') renderWorldBook();
    if(appId === 'app-spy-list') renderSpyContactList();
    if(appId === 'app-theme') renderThemeSettings();
    if(appId === 'app-memos') renderMemoContacts();
    if(appId === 'app-calendar') renderCalendar();
    if(appId === 'app-couple') renderCoupleSpace();
}

function goHome() {
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById('home-screen').classList.add('active');
    document.getElementById('chat-interface').style.display = 'none';
    closeAllOverlays();
    exitDeleteMode();
    cancelQuote();
    endCall(); 
    exitOfflineMode(); 
    document.getElementById('wb-create-menu').classList.remove('active');
    closeCalendarModal();
    closeOfflineEditModal();
    closeSpyDiaryEdit();
    exitMusicDeleteMode();
    closeMusicPlayer();
}

function closeAllOverlays() {
    document.getElementById('ctx-overlay').classList.remove('active');
    document.getElementById('msg-context-menu').classList.remove('active');
    document.getElementById('chat-settings-modal').classList.remove('active');
    document.getElementById('wb-create-menu').classList.remove('active');
    document.getElementById('transfer-modal').classList.remove('active');
    document.getElementById('thoughts-modal').classList.remove('active');
    document.getElementById('offline-settings-modal').classList.remove('active');
    document.getElementById('calendar-event-modal').classList.remove('active');
    document.getElementById('offline-edit-modal').classList.remove('active');
    document.getElementById('spy-diary-edit-modal').classList.remove('active');
}

const DB = {
    getSettings: () => {
        const saved = MEMORY_CACHE['iphone_settings'];
        const defaultSettings = { url: 'https://api.openai.com/v1', key: '', model: 'gpt-3.5-turbo', prompt: DEFAULT_SYSTEM_PROMPT, fullscreen: false, temperature: 0.7 };
        if (!saved) return defaultSettings;
        if (!saved.prompt || saved.prompt.length < 50) saved.prompt = DEFAULT_SYSTEM_PROMPT;
        if (saved.temperature === undefined) saved.temperature = 0.7;
        return saved;
    },
    saveSettings: (data) => {
        MEMORY_CACHE['iphone_settings'] = data;
        saveToIndexedDB('iphone_settings', data);
    },
    getContacts: () => MEMORY_CACHE['iphone_contacts'] || [],
    saveContacts: (data) => {
        MEMORY_CACHE['iphone_contacts'] = data;
        saveToIndexedDB('iphone_contacts', data);
    },
    getChats: () => MEMORY_CACHE['iphone_chats'] || {}, 
    saveChats: (data) => {
        MEMORY_CACHE['iphone_chats'] = data;
        saveToIndexedDB('iphone_chats', data);
    },
    getWorldBook: () => MEMORY_CACHE['iphone_worldbook'] || { categories: [{id: 'default', name: '默认分类'}], entries: [] },
    saveWorldBook: (data) => {
        MEMORY_CACHE['iphone_worldbook'] = data;
        saveToIndexedDB('iphone_worldbook', data);
    },
    getSpyData: () => MEMORY_CACHE['iphone_spy_data'] || {},
    saveSpyData: (data) => {
        MEMORY_CACHE['iphone_spy_data'] = data;
        saveToIndexedDB('iphone_spy_data', data);
    },
    getTheme: () => MEMORY_CACHE['iphone_theme'] || { wallpaperType: 'color', wallpaperValue: '#ffffff', caseColor: '#1a1a1a', widgetImage: '', appIcons: {}, customFontUrl: '', fontColor: '#000000' },
    saveTheme: (data) => {
        MEMORY_CACHE['iphone_theme'] = data;
        saveToIndexedDB('iphone_theme', data);
    },
    getMemories: () => {
        let mems = MEMORY_CACHE['iphone_memories'] || {};
        // 数据结构迁移逻辑
        for (let id in mems) {
            if (Array.isArray(mems[id])) {
                const oldArr = mems[id];
                mems[id] = { important: [], normal: oldArr.map(content => ({ content: content, keywords: [] })) };
            }
        }
        return mems;
    },
    saveMemories: (data) => {
        MEMORY_CACHE['iphone_memories'] = data;
        saveToIndexedDB('iphone_memories', data);
    },
    getCalendarEvents: () => MEMORY_CACHE['iphone_calendar_events'] || {},
    saveCalendarEvents: (data) => {
        MEMORY_CACHE['iphone_calendar_events'] = data;
        saveToIndexedDB('iphone_calendar_events', data);
    },
    getStickers: () => MEMORY_CACHE['iphone_stickers'] || [],
    saveStickers: (data) => {
        MEMORY_CACHE['iphone_stickers'] = data;
        saveToIndexedDB('iphone_stickers', data);
    },
    getCoupleData: () => MEMORY_CACHE['iphone_couple_data'] || { active: false, partnerId: null, startTime: 0, lastWaterTime: 0, treeLevel: 0, letters: [] },
    saveCoupleData: (data) => {
        MEMORY_CACHE['iphone_couple_data'] = data;
        saveToIndexedDB('iphone_couple_data', data);
    },
    // 提问箱数据
    getQuestionBox: () => MEMORY_CACHE['iphone_question_box'] || {},
    saveQuestionBox: (data) => {
        MEMORY_CACHE['iphone_question_box'] = data;
        saveToIndexedDB('iphone_question_box', data);
    }
};

// --- 情侣空间逻辑 ---
function openCoupleInvite() {
    document.getElementById('couple-invite-modal').classList.add('active');
    renderCoupleInviteList();
}

function closeCoupleInvite() {
    document.getElementById('couple-invite-modal').classList.remove('active');
}

function renderCoupleInviteList() {
    const list = document.getElementById('couple-invite-list');
    list.innerHTML = '';
    const contacts = DB.getContacts();
    if (contacts.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">通讯录暂无联系人</div>';
        return;
    }
    contacts.forEach(c => {
        const div = document.createElement('div');
        div.className = 'invite-item';
        div.onclick = () => sendCoupleInvite(c);
        div.innerHTML = `
            <img src="${c.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>'}">
            <div class="invite-item-name">${c.name}</div>
        `;
        list.appendChild(div);
    });
}

function sendCoupleInvite(contact) {
    if (!confirm(`确定向 ${contact.name} 发送开通邀请吗？`)) return;
    
    closeCoupleInvite();
    
    // 发送特殊邀请消息
    const c = DB.getChats();
    if (!c[contact.id]) c[contact.id] = [];
    
    c[contact.id].push({
        role: 'user',
        type: 'couple_invite_req',
        content: '申请开通与你的情侣空间',
        timestamp: Date.now(),
        mode: 'online'
    });
    
    DB.saveChats(c);
    
    // 跳转到聊天界面
    openChat(contact);
    alert('邀请已发送！请点击底部的“✨”按钮呼叫 TA 回复。');
}

function resetCoupleSpace() {
    if (!confirm("确定要重置情侣空间吗？所有数据将丢失。")) return;
    const cd = { active: false, partnerId: null, startTime: 0, lastWaterTime: 0, treeLevel: 0 };
    DB.saveCoupleData(cd);
    renderCoupleSpace();
    alert("情侣空间已重置");
}

function renderCoupleSpace() {
    const cd = DB.getCoupleData();
    const lockView = document.getElementById('couple-lock-view');
    const mainView = document.getElementById('couple-main-view');
    
    if (cd.active) {
        lockView.style.display = 'none';
        mainView.style.display = 'flex';
        
        // 更新天数
        const days = Math.floor((Date.now() - cd.startTime) / (1000 * 60 * 60 * 24)) + 1;
        document.getElementById('couple-days-count').innerText = days;
        
        // 更新伴侣信息
        const contacts = DB.getContacts();
        const partner = contacts.find(c => c.id == cd.partnerId);
        if (partner) {
            // 修复：直接从 partner.userSettings 获取用户头像，而不是依赖聊天设置弹窗的 DOM
            const myAvatar = partner.userSettings?.userAvatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23007aff%22 width=%22100%22 height=%22100%22/></svg>';
            const pAvatar = partner.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>';
            
            document.getElementById('couple-partner-info').innerHTML = `
                <img src="${myAvatar}" class="couple-avatar">
                <span class="couple-heart-icon">❤️</span>
                <img src="${pAvatar}" class="couple-avatar">
            `;
        }
        
        updateWaterBtnState();
    } else {
        lockView.style.display = 'flex';
        mainView.style.display = 'none';
    }
}

function updateWaterBtnState() {
    const cd = DB.getCoupleData();
    const btn = document.getElementById('water-btn');
    const btnText = document.getElementById('water-btn-text');
    const now = Date.now();
    
    // 检查是否超过24小时
    if (now - cd.lastWaterTime > 24 * 60 * 60 * 1000) {
        btn.disabled = false;
        btnText.innerText = "给小树浇水";
    } else {
        btn.disabled = true;
        // 计算剩余时间
        const nextTime = cd.lastWaterTime + 24 * 60 * 60 * 1000;
        const diff = nextTime - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        btnText.innerText = `${hours}小时${mins}分后可浇水`;
    }
}

function waterTree() {
    const cd = DB.getCoupleData();
    const now = Date.now();
    
    if (now - cd.lastWaterTime <= 24 * 60 * 60 * 1000) {
        return alert("小树今天已经喝饱啦，明天再来吧！");
    }
    
    // 执行浇水
    cd.lastWaterTime = now;
    cd.treeLevel = (cd.treeLevel || 0) + 1;
    DB.saveCoupleData(cd);
    
    // 播放动画
    const container = document.getElementById('water-anim-container');
    const drop = document.createElement('div');
    drop.className = 'water-anim';
    drop.innerText = '💧';
    drop.style.left = '50%';
    drop.style.top = '20%';
    drop.style.transform = 'translateX(-50%)';
    container.appendChild(drop);
    
    setTimeout(() => {
        drop.remove();
        const heart = document.createElement('div');
        heart.className = 'water-anim';
        heart.innerText = '❤️';
        heart.style.left = '50%';
        heart.style.top = '40%';
        heart.style.transform = 'translateX(-50%)';
        container.appendChild(heart);
        setTimeout(() => heart.remove(), 1000);
    }, 800);
    
    updateWaterBtnState();
}

// --- 表情包功能 ---
let currentStickerUploadTab = 'single';

function toggleStickerPanel() {
    const panel = document.getElementById('sticker-panel');
    panel.classList.toggle('active');
    if (panel.classList.contains('active')) {
        renderStickerGrid();
    }
}

function renderStickerGrid() {
    const grid = document.getElementById('sticker-grid');
    const stickers = DB.getStickers();
    grid.innerHTML = '';
    
    if (stickers.length === 0) {
        grid.innerHTML = '<div class="sticker-empty">暂无表情包，点击右上角 + 添加</div>';
        return;
    }

    stickers.forEach((sticker, index) => {
        const item = document.createElement('div');
        item.className = 'sticker-item';
        item.innerHTML = `
            <img src="${sticker.url}" alt="${sticker.desc}">
            <div class="sticker-delete" onclick="deleteSticker(${index}, event)">×</div>
        `;
        item.onclick = (e) => {
            if (!e.target.classList.contains('sticker-delete')) {
                sendSticker(sticker);
            }
        };
        grid.appendChild(item);
    });
}

function sendSticker(sticker) {
    if (!currentChatContact) return;
    
    // 保存消息，type为sticker，包含url和desc
    const c = DB.getChats();
    if (!c[currentChatContact.id]) c[currentChatContact.id] = [];
    c[currentChatContact.id].push({
        role: 'user',
        type: 'sticker',
        stickerUrl: sticker.url,
        stickerDesc: sticker.desc,
        content: `[表情包：${sticker.desc}]`, // AI读取的内容
        timestamp: Date.now(),
        mode: 'online'
    });
    DB.saveChats(c);
    
    // 关闭表情包面板
    document.getElementById('sticker-panel').classList.remove('active');
    
    // 重新渲染聊天记录
    renderChatHistory();
}

function deleteSticker(index, event) {
    event.stopPropagation();
    if (!confirm('确定删除这个表情包吗？')) return;
    
    const stickers = DB.getStickers();
    stickers.splice(index, 1);
    DB.saveStickers(stickers);
    renderStickerGrid();
}

function openStickerManager() {
    document.getElementById('sticker-manager-modal').classList.add('active');
    document.getElementById('ctx-overlay').classList.add('active');
    switchStickerUploadTab('single');
}

function closeStickerManager() {
    document.getElementById('sticker-manager-modal').classList.remove('active');
    document.getElementById('ctx-overlay').classList.remove('active');
    
    // 清空输入
    document.getElementById('sticker-file-input').value = '';
    document.getElementById('sticker-url-input').value = '';
    document.getElementById('sticker-desc-input').value = '';
    document.getElementById('sticker-batch-input').value = '';
    document.getElementById('sticker-preview-single').innerHTML = '<span class="sticker-preview-placeholder">预览</span>';
}

function switchStickerUploadTab(tab) {
    currentStickerUploadTab = tab;
    
    document.querySelectorAll('.sticker-upload-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sticker-upload-section').forEach(s => s.classList.remove('active'));
    
    if (tab === 'single') {
        document.querySelector('.sticker-upload-tab:first-child').classList.add('active');
        document.getElementById('sticker-upload-single').classList.add('active');
    } else {
        document.querySelector('.sticker-upload-tab:last-child').classList.add('active');
        document.getElementById('sticker-upload-batch').classList.add('active');
    }
}

function previewSingleSticker(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('sticker-preview-single').innerHTML = `<img src="${e.target.result}">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function previewSingleStickerUrl(url) {
    if (url) {
        document.getElementById('sticker-preview-single').innerHTML = `<img src="${url}">`;
    } else {
        document.getElementById('sticker-preview-single').innerHTML = '<span class="sticker-preview-placeholder">预览</span>';
    }
}

function saveSingleSticker() {
    const fileInput = document.getElementById('sticker-file-input');
    const urlInput = document.getElementById('sticker-url-input').value;
    const desc = document.getElementById('sticker-desc-input').value.trim();
    
    if (!desc) {
        alert('请输入表情包描述');
        return;
    }

    const processSave = (url) => {
        const stickers = DB.getStickers();
        stickers.push({ url: url, desc: desc });
        DB.saveStickers(stickers);
        alert('表情包已保存');
        closeStickerManager();
        renderStickerGrid();
    };

    if (urlInput) {
        processSave(urlInput);
    } else if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => processSave(e.target.result);
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        alert('请选择图片或输入URL');
    }
}

function saveBatchStickers() {
    const input = document.getElementById('sticker-batch-input').value.trim();
    if (!input) {
        alert('请输入表情包信息');
        return;
    }

    const lines = input.split('\n').filter(line => line.trim());
    const stickers = DB.getStickers();
    let successCount = 0;

    lines.forEach(line => {
        const parts = line.split('：'); // 中文冒号
        if (parts.length === 2) {
            const desc = parts[0].trim();
            const url = parts[1].trim();
            if (desc && url) {
                stickers.push({ url: url, desc: desc });
                successCount++;
            }
        }
    });

    if (successCount > 0) {
        DB.saveStickers(stickers);
        alert(`成功添加 ${successCount} 个表情包`);
        closeStickerManager();
        renderStickerGrid();
    } else {
        alert('没有有效的表情包数据，请检查格式');
    }
}

function loadSettings() { const s = DB.getSettings(); document.getElementById('api-url').value = s.url; document.getElementById('api-key').value = s.key; document.getElementById('model-name').value = s.model; document.getElementById('system-prompt').value = s.prompt; document.getElementById('fullscreen-toggle').checked = s.fullscreen; const temp = s.temperature || 0.7; document.getElementById('temperature-slider').value = Math.round(temp * 100); document.getElementById('temperature-input').value = temp; applyFullscreen(s.fullscreen); applyTheme(); applyPage2Images(); }
function saveSettings() { const temperature = parseFloat(document.getElementById('temperature-input').value) || 0.7; DB.saveSettings({ url: document.getElementById('api-url').value, key: document.getElementById('api-key').value, model: document.getElementById('model-name').value, prompt: document.getElementById('system-prompt').value, fullscreen: document.getElementById('fullscreen-toggle').checked, temperature: temperature }); alert('设置已保存'); }
function toggleFullscreen() { const isChecked = document.getElementById('fullscreen-toggle').checked; applyFullscreen(isChecked); const s = DB.getSettings(); s.fullscreen = isChecked; DB.saveSettings(s); }
function applyFullscreen(isFull) { if (isFull) document.body.classList.add('fullscreen-mode'); else document.body.classList.remove('fullscreen-mode'); }
async function fetchModels(btn) { const url = document.getElementById('api-url').value.replace(/\/$/, ''); const key = document.getElementById('api-key').value; if (!url || !key) return alert("请先填写 API Base URL 和 API Key"); const originalText = btn.innerText; btn.innerText = "加载中..."; btn.disabled = true; try { const res = await fetch(`${url}/models`, { method: 'GET', headers: { 'Authorization': `Bearer ${key}` } }); if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`); const data = await res.json(); const models = Array.isArray(data) ? data : (data.data || []); const select = document.getElementById('model-select'); select.innerHTML = '<option value="">-- 请选择模型 --</option>'; models.sort((a, b) => (a.id || a).localeCompare(b.id || b)); models.forEach(m => { const modelId = typeof m === 'string' ? m : m.id; const opt = document.createElement('option'); opt.value = modelId; opt.innerText = modelId; select.appendChild(opt); }); select.style.display = 'block'; btn.innerText = "拉取成功"; setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 2000); } catch (e) { alert("拉取失败: " + e.message); btn.innerText = originalText; btn.disabled = false; } }
function selectModel(sel) { if (sel.value) document.getElementById('model-name').value = sel.value; }
function exportBackup() { const backupData = { settings: DB.getSettings(), contacts: DB.getContacts(), chats: DB.getChats(), worldbook: DB.getWorldBook(), spyData: DB.getSpyData(), theme: DB.getTheme(), memories: DB.getMemories(), calendar: DB.getCalendarEvents(), coupleData: DB.getCoupleData(), stickers: DB.getStickers(), timestamp: Date.now() }; const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData)); const a = document.createElement('a'); a.href = dataStr; a.download = "iphone_sim_backup_" + new Date().toISOString().slice(0,10) + ".json"; document.body.appendChild(a); a.click(); a.remove(); }
function importBackup(input) { 
    const file = input.files[0]; 
    if (!file) return; 
    const reader = new FileReader(); 
    reader.onload = function(e) { 
        try { 
            const data = JSON.parse(e.target.result); 
            
            // 计算备份数据大小
            const dataSize = new Blob([e.target.result]).size;
            const dataSizeMB = (dataSize / (1024 * 1024)).toFixed(2);
            
            console.log(`备份文件大小: ${dataSizeMB} MB`);
            
            // 检查当前存储使用情况
            let currentSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    currentSize += localStorage[key].length + key.length;
                }
            }
            const currentSizeMB = (currentSize / (1024 * 1024)).toFixed(2);
            console.log(`当前存储使用: ${currentSizeMB} MB`);
            
            // 尝试导入，使用 try-catch 捕获配额错误
            try {
                if (data.settings) DB.saveSettings(data.settings); 
                if (data.contacts) DB.saveContacts(data.contacts); 
                if (data.chats) DB.saveChats(data.chats); 
                if (data.worldbook) DB.saveWorldBook(data.worldbook); 
                if (data.spyData) DB.saveSpyData(data.spyData); 
                if (data.theme) DB.saveTheme(data.theme); 
                if (data.memories) DB.saveMemories(data.memories); 
                if (data.calendar) DB.saveCalendarEvents(data.calendar); 
                if (data.coupleData) DB.saveCoupleData(data.coupleData);
                if (data.stickers) DB.saveStickers(data.stickers);
                
                alert("备份导入成功！"); 
                location.reload(); 
            } catch (storageErr) {
                if (storageErr.name === 'QuotaExceededError' || storageErr.message.includes('quota')) {
                    // 配额超限错误处理
                    handleQuotaExceeded(data, dataSizeMB);
                } else {
                    throw storageErr;
                }
            }
        } catch (err) { 
            alert("导入失败：" + err.message); 
        } 
    }; 
    reader.readAsText(file); 
}

function handleQuotaExceeded(data, dataSizeMB) {
    // 分析各部分数据大小
    const sizes = {
        settings: JSON.stringify(data.settings || {}).length,
        contacts: JSON.stringify(data.contacts || []).length,
        chats: JSON.stringify(data.chats || {}).length,
        worldbook: JSON.stringify(data.worldbook || {}).length,
        spyData: JSON.stringify(data.spyData || {}).length,
        theme: JSON.stringify(data.theme || {}).length,
        memories: JSON.stringify(data.memories || {}).length,
        calendar: JSON.stringify(data.calendar || {}).length
    };
    
    const sortedSizes = Object.entries(sizes)
        .sort((a, b) => b[1] - a[1])
        .map(([key, size]) => `${key}: ${(size / 1024).toFixed(2)} KB`);
    
    const message = `❌ 存储空间不足！\n\n备份文件大小: ${dataSizeMB} MB\n浏览器存储限制通常为 5-10 MB\n\n各部分数据大小：\n${sortedSizes.join('\n')}\n\n建议解决方案：\n1. 清空当前数据后再导入\n2. 使用选择性导入功能\n3. 清理聊天记录中的大图片\n\n是否清空当前所有数据后重新导入？`;
    
    if (confirm(message)) {
        // 清空所有数据
        localStorage.clear();
        
        // 重新尝试导入
        try {
            if (data.settings) DB.saveSettings(data.settings); 
            if (data.contacts) DB.saveContacts(data.contacts); 
            if (data.chats) DB.saveChats(data.chats); 
            if (data.worldbook) DB.saveWorldBook(data.worldbook); 
            if (data.spyData) DB.saveSpyData(data.spyData); 
            if (data.theme) DB.saveTheme(data.theme); 
            if (data.memories) DB.saveMemories(data.memories); 
            if (data.calendar) DB.saveCalendarEvents(data.calendar); 
            if (data.coupleData) DB.saveCoupleData(data.coupleData);
            if (data.stickers) DB.saveStickers(data.stickers);
            
            alert("✅ 备份导入成功！"); 
            location.reload(); 
        } catch (err) {
            alert("❌ 即使清空数据后仍然失败。\n备份文件可能过大，请尝试选择性导入。\n\n错误: " + err.message);
            openSelectiveImport(data);
        }
    } else {
        openSelectiveImport(data);
    }
}

function openSelectiveImport(data) {
    const sizes = {
        settings: { size: JSON.stringify(data.settings || {}).length, label: '设置' },
        contacts: { size: JSON.stringify(data.contacts || []).length, label: '通讯录' },
        chats: { size: JSON.stringify(data.chats || {}).length, label: '聊天记录' },
        worldbook: { size: JSON.stringify(data.worldbook || {}).length, label: '世界书' },
        spyData: { size: JSON.stringify(data.spyData || {}).length, label: '查岗数据' },
        theme: { size: JSON.stringify(data.theme || {}).length, label: '主题美化' },
        memories: { size: JSON.stringify(data.memories || {}).length, label: '记忆' },
        calendar: { size: JSON.stringify(data.calendar || {}).length, label: '日历' },
        coupleData: { size: JSON.stringify(data.coupleData || {}).length, label: '情侣空间' },
        stickers: { size: JSON.stringify(data.stickers || []).length, label: '表情包' }
    };
    
    let message = "📦 选择性导入\n\n请选择要导入的数据（输入序号，用逗号分隔）：\n\n";
    const keys = Object.keys(sizes);
    keys.forEach((key, index) => {
        const sizeMB = (sizes[key].size / 1024).toFixed(2);
        message += `${index + 1}. ${sizes[key].label} (${sizeMB} KB)\n`;
    });
    message += "\n例如：1,2,3 表示导入设置、通讯录和聊天记录";
    
    const input = prompt(message);
    if (!input) return;
    
    const selected = input.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < keys.length);
    
    if (selected.length === 0) {
        alert("未选择任何数据");
        return;
    }
    
    try {
        selected.forEach(index => {
            const key = keys[index];
            switch(key) {
                case 'settings': if (data.settings) DB.saveSettings(data.settings); break;
                case 'contacts': if (data.contacts) DB.saveContacts(data.contacts); break;
                case 'chats': if (data.chats) DB.saveChats(data.chats); break;
                case 'worldbook': if (data.worldbook) DB.saveWorldBook(data.worldbook); break;
                case 'spyData': if (data.spyData) DB.saveSpyData(data.spyData); break;
                case 'theme': if (data.theme) DB.saveTheme(data.theme); break;
                case 'memories': if (data.memories) DB.saveMemories(data.memories); break;
                case 'calendar': if (data.calendar) DB.saveCalendarEvents(data.calendar); break;
                case 'coupleData': if (data.coupleData) DB.saveCoupleData(data.coupleData); break;
                case 'stickers': if (data.stickers) DB.saveStickers(data.stickers); break;
            }
        });
        
        alert(`✅ 已成功导入 ${selected.length} 项数据！`);
        location.reload();
    } catch (err) {
        if (err.name === 'QuotaExceededError' || err.message.includes('quota')) {
            alert("❌ 仍然超出存储限制。\n建议：\n1. 减少选择的数据项\n2. 清空当前数据后再试\n3. 清理聊天记录中的图片");
        } else {
            alert("导入失败：" + err.message);
        }
    }
}
loadSettings();
let currentThemeType = 'color';
function renderThemeSettings() { const theme = DB.getTheme(); currentThemeType = theme.wallpaperType; switchThemeType(currentThemeType); if (theme.wallpaperType === 'color') document.getElementById('theme-wallpaper-color').value = theme.wallpaperValue; document.getElementById('theme-case-color').value = theme.caseColor; document.getElementById('theme-font-url').value = theme.customFontUrl || ''; document.getElementById('theme-font-color').value = theme.fontColor || '#000000'; }
function switchThemeType(type) { currentThemeType = type; document.getElementById('theme-type-color').classList.toggle('active', type === 'color'); document.getElementById('theme-type-image').classList.toggle('active', type === 'image'); document.getElementById('theme-input-color').style.display = type === 'color' ? 'block' : 'none'; document.getElementById('theme-input-image').style.display = type === 'image' ? 'block' : 'none'; }
function saveTheme() { const caseColor = document.getElementById('theme-case-color').value; const currentTheme = DB.getTheme(); const processSave = (val) => { currentTheme.wallpaperType = currentThemeType; currentTheme.wallpaperValue = val; currentTheme.caseColor = caseColor; DB.saveTheme(currentTheme); applyTheme(); alert('主题已应用'); }; if (currentThemeType === 'color') { processSave(document.getElementById('theme-wallpaper-color').value); } else { const urlInput = document.getElementById('theme-wallpaper-url').value; const fileInput = document.getElementById('theme-wallpaper-image'); if (urlInput) processSave(urlInput); else if (fileInput.files && fileInput.files[0]) { const r = new FileReader(); r.onload = (e) => processSave(e.target.result); r.readAsDataURL(fileInput.files[0]); } else { if (currentTheme.wallpaperType === 'image') processSave(currentTheme.wallpaperValue); else alert('请选择图片'); } } }
function getAppLabelName(appId) { const names = { 'icon-app-vk': 'Vkontakte', 'icon-app-contacts': '通讯录', 'icon-app-memos': '备忘录', 'icon-app-calendar': '日历', 'icon-app-worldbook': '世界书', 'icon-app-spy-list': '查岗', 'icon-app-theme': '美化', 'icon-app-settings': '设置', 'icon-app-couple': '情侣空间', 'icon-app-tomato': '番茄钟', 'icon-app-music': '音乐', 'icon-app-forum': '论坛', 'icon-app-shopping': '购物', 'icon-app-game': '小游戏', 'icon-app-accounting': '记账', 'icon-app-wallet': '钱包', 'spy-icon-browser': '浏览器', 'spy-icon-diary': '日记' }; return names[appId] || 'App'; }
function applyTheme() { const theme = DB.getTheme(); document.documentElement.style.setProperty('--case-color', theme.caseColor); document.documentElement.style.setProperty('--wallpaper', theme.wallpaperType === 'color' ? theme.wallpaperValue : `url(${theme.wallpaperValue})`); document.documentElement.style.setProperty('--global-text-color', theme.fontColor || '#000000'); const widget = document.getElementById('home-widget'); const widgetImg = document.getElementById('home-widget-img'); if (theme.widgetImage) { widgetImg.src = theme.widgetImage; widget.classList.add('has-image'); } else { widget.classList.remove('has-image'); } if (theme.appIcons) { for (const [id, iconUrl] of Object.entries(theme.appIcons)) { const el = document.getElementById(id); if (el && iconUrl) { el.style.background = 'none'; el.style.backgroundColor = 'transparent'; el.style.backgroundImage = `url(${iconUrl})`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; el.innerHTML = `<div class="app-label">${getAppLabelName(id)}</div>`; } } } const fontStyle = document.getElementById('custom-font-style'); if (theme.customFontUrl) { fontStyle.innerHTML = ` @font-face { font-family: 'UserCustomFont'; src: url('${theme.customFontUrl}'); font-display: swap; } body, input, textarea, button, select { font-family: 'UserCustomFont', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; } `; } else { fontStyle.innerHTML = ''; } }
function saveFont() { const url = document.getElementById('theme-font-url').value; const theme = DB.getTheme(); theme.customFontUrl = url; DB.saveTheme(theme); applyTheme(); alert('字体已更新'); }
function resetFont() { const theme = DB.getTheme(); theme.customFontUrl = ''; DB.saveTheme(theme); applyTheme(); document.getElementById('theme-font-url').value = ''; alert('已恢复默认字体'); }
function saveFontColor() { const color = document.getElementById('theme-font-color').value; const theme = DB.getTheme(); theme.fontColor = color; DB.saveTheme(theme); applyTheme(); alert('字体颜色已更新'); }
function resetAllThemes() {
    if (!confirm("确定要清空所有美化设置吗？\n这将重置壁纸、图标、字体、颜色以及所有联系人的聊天背景和气泡设置。")) return;
    const defaultTheme = { wallpaperType: 'color', wallpaperValue: '#ffffff', caseColor: '#1a1a1a', widgetImage: '', appIcons: {}, customFontUrl: '', fontColor: '#000000' };
    DB.saveTheme(defaultTheme);
    
    let contacts = DB.getContacts();
    contacts.forEach(c => {
        delete c.chatTheme;
        if (c.offlineSettings) delete c.offlineSettings.bg;
    });
    DB.saveContacts(contacts);
    
    applyTheme();
    renderThemeSettings();
    alert("所有美化已重置！");
}
function triggerWidgetUpload() { const url = prompt("请输入图片 URL (或点击取消以上传文件)"); if (url) saveWidgetImage(url); else document.getElementById('widget-file-input').click(); }
function uploadWidgetImage(input) { if (input.files && input.files[0]) { const reader = new FileReader(); reader.onload = (e) => saveWidgetImage(e.target.result); reader.readAsDataURL(input.files[0]); } }
function saveWidgetImage(imgData) { const theme = DB.getTheme(); theme.widgetImage = imgData; DB.saveTheme(theme); applyTheme(); }

function saveAppIcon() { 
    const appId = document.getElementById('theme-app-select').value; 
    const urlInput = document.getElementById('theme-icon-url').value; 
    const fileInput = document.getElementById('theme-icon-file'); 
    const processIconSave = (imgData) => { 
        const theme = DB.getTheme(); 
        if (!theme.appIcons) theme.appIcons = {}; 
        theme.appIcons[appId] = imgData; 
        DB.saveTheme(theme); 
        applyTheme(); 
        alert('图标已更新'); 
    }; 
    if (urlInput) {
        processIconSave(urlInput); 
    } else if (fileInput.files && fileInput.files[0]) { 
        const reader = new FileReader(); 
        reader.onload = (e) => processIconSave(e.target.result); 
        reader.readAsDataURL(fileInput.files[0]); 
    } else {
        alert('请选择图片或输入URL'); 
    }
}

// --- 第二页小组件和便签功能 ---
let currentPage = 0;

function goToPage(pageIndex) {
    currentPage = pageIndex;
    const wrapper = document.getElementById('home-pages-wrapper');
    wrapper.style.transform = `translateX(-${pageIndex * 50}%)`;
    
    document.querySelectorAll('.page-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === pageIndex);
    });
}

let touchStartX = 0;
let touchEndX = 0;

function handleGesture() {
    const threshold = 50; 
    if (touchEndX < touchStartX - threshold && currentPage < 1) {
        goToPage(currentPage + 1);
    }
    if (touchEndX > touchStartX + threshold && currentPage > 0) {
        goToPage(currentPage - 1);
    }
}

document.getElementById('home-pages-container').addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
});

document.getElementById('home-pages-container').addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleGesture();
});

function triggerPage2WidgetUpload() {
    const url = prompt("请输入图片 URL (或点击取消以上传文件)");
    if (url) {
        savePage2WidgetImage(url);
    } else {
        document.getElementById('page2-widget-file-input').click();
    }
}

function uploadPage2WidgetImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => savePage2WidgetImage(e.target.result);
        reader.readAsDataURL(input.files[0]);
    }
}

function savePage2WidgetImage(imgData) {
    const theme = DB.getTheme();
    if (!theme.page2Images) theme.page2Images = {};
    theme.page2Images.widget = imgData;
    DB.saveTheme(theme);
    applyPage2Images();
}

function applyPage2Images() {
    const theme = DB.getTheme();
    
    // 应用方块小组件图片
    if (theme.page2Images?.widget) {
        const widget = document.getElementById('page2-widget-square');
        const widgetImg = document.getElementById('page2-widget-img');
        if (widget && widgetImg) {
            widgetImg.src = theme.page2Images.widget;
            widget.classList.add('has-image');
        }
    }

    // 应用新设计元素的图片
    if (theme.page2Images?.circleLeft) {
        const circle = document.getElementById('circle-left');
        const img = document.getElementById('circle-left-img');
        if (circle && img) {
            img.src = theme.page2Images.circleLeft;
            circle.classList.add('has-image');
        }
    }

    if (theme.page2Images?.circleRight) {
        const circle = document.getElementById('circle-right');
        const img = document.getElementById('circle-right-img');
        if (circle && img) {
            img.src = theme.page2Images.circleRight;
            circle.classList.add('has-image');
        }
    }

    if (theme.page2Images?.rectangle) {
        const rect = document.getElementById('rectangle-bottom');
        const img = document.getElementById('rectangle-img');
        if (rect && img) {
            img.src = theme.page2Images.rectangle;
            rect.classList.add('has-image');
        }
    }
}

function triggerCircleUpload(side) {
    const url = prompt("请输入图片 URL (或点击取消以上传文件)");
    if (url) {
        saveCircleImage(url, side);
    } else {
        document.getElementById(`circle-${side}-input`).click();
    }
}

function uploadCircleImage(input, side) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => saveCircleImage(e.target.result, side);
        reader.readAsDataURL(input.files[0]);
    }
}

function saveCircleImage(imgData, side) {
    const theme = DB.getTheme();
    if (!theme.page2Images) theme.page2Images = {};
    
    if (side === 'left') {
        theme.page2Images.circleLeft = imgData;
    } else {
        theme.page2Images.circleRight = imgData;
    }
    
    DB.saveTheme(theme);
    applyPage2Images();
}

function triggerRectangleUpload() {
    const url = prompt("请输入图片 URL (或点击取消以上传文件)");
    if (url) {
        saveRectangleImage(url);
    } else {
        document.getElementById('rectangle-input').click();
    }
}

function uploadRectangleImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => saveRectangleImage(e.target.result);
        reader.readAsDataURL(input.files[0]);
    }
}

function saveRectangleImage(imgData) {
    const theme = DB.getTheme();
    if (!theme.page2Images) theme.page2Images = {};
    theme.page2Images.rectangle = imgData;
    DB.saveTheme(theme);
    applyPage2Images();
}

function exportThemePreset() {
    const globalTheme = DB.getTheme();
    const contacts = DB.getContacts();
    let chatTemplate = {};
    let offlineTemplate = {};
    if (contacts.length > 0) {
        chatTemplate = contacts[0].chatTheme || {};
        offlineTemplate = contacts[0].offlineSettings || {};
    }
    const presetData = { global: globalTheme, chatTemplate: chatTemplate, offlineTemplate: offlineTemplate, timestamp: Date.now() };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(presetData));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "iphone_sim_theme_preset_" + new Date().toISOString().slice(0,10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function importThemePreset(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.global) { DB.saveTheme(data.global); applyTheme(); }
            if (data.chatTemplate || data.offlineTemplate) {
                if (confirm("预设包含聊天界面和线下模式的美化设置。\n是否将其应用到【所有】联系人？")) {
                    let contacts = DB.getContacts();
                    contacts.forEach(c => {
                        if (data.chatTemplate) c.chatTheme = JSON.parse(JSON.stringify(data.chatTemplate));
                        if (data.offlineTemplate) {
                            const oldSettings = c.offlineSettings || { min: 500, max: 700, style: '' };
                            c.offlineSettings = { ...oldSettings, bg: data.offlineTemplate.bg };
                        }
                    });
                    DB.saveContacts(contacts);
                }
            }
            alert("美化预设导入成功！");
            renderThemeSettings();
        } catch (err) { alert("导入失败：" + err.message); }
    };
    reader.readAsText(file);
}

function calculatePeriodDays(year, month) { const events = DB.getCalendarEvents(); const periodMap = {}; const predictedStarts = []; const manualStarts = []; const manualEnds = []; Object.keys(events).forEach(dateStr => { events[dateStr].forEach(ev => { if (ev.type === 'period_start' || ev.type === 'period') { manualStarts.push({ date: new Date(dateStr), cycle: ev.cycle || 28, duration: ev.duration || 5 }); } if (ev.type === 'period_end') { manualEnds.push(new Date(dateStr)); } }); }); manualStarts.sort((a, b) => a.date - b.date); manualEnds.sort((a, b) => a.date - b.date); manualStarts.forEach(startObj => { const startDate = startObj.date; const endDate = manualEnds.find(end => end >= startDate); let limitDate; if (endDate) { limitDate = endDate; } else { limitDate = new Date(startDate); limitDate.setDate(startDate.getDate() + startObj.duration - 1); } let temp = new Date(startDate); while (temp <= limitDate) { const dStr = `${temp.getFullYear()}-${String(temp.getMonth()+1).padStart(2,'0')}-${String(temp.getDate()).padStart(2,'0')}`; periodMap[dStr] = 'active'; temp.setDate(temp.getDate() + 1); } }); if (manualStarts.length > 0) { const lastManual = manualStarts[manualStarts.length - 1]; let nextStart = new Date(lastManual.date); const viewEnd = new Date(year, month + 1, 15); while (nextStart <= viewEnd) { nextStart.setDate(nextStart.getDate() + lastManual.cycle); if (nextStart > lastManual.date) { const pStr = `${nextStart.getFullYear()}-${String(nextStart.getMonth()+1).padStart(2,'0')}-${String(nextStart.getDate()).padStart(2,'0')}`; if (!periodMap[pStr]) { predictedStarts.push(pStr); let tempP = new Date(nextStart); for (let i = 0; i < lastManual.duration; i++) { const pdStr = `${tempP.getFullYear()}-${String(tempP.getMonth()+1).padStart(2,'0')}-${String(tempP.getDate()).padStart(2,'0')}`; if (!periodMap[pdStr]) { periodMap[pdStr] = 'predicted'; } tempP.setDate(tempP.getDate() + 1); } } } } } return { periodMap, predictedStarts }; }
function renderCalendar() { const year = currentCalDate.getFullYear(); const month = currentCalDate.getMonth(); document.getElementById('calendar-month-title').innerText = `${year}年 ${month + 1}月`; const firstDay = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0); const daysInMonth = lastDay.getDate(); const startDayOfWeek = firstDay.getDay(); const grid = document.getElementById('calendar-grid'); grid.innerHTML = ''; const { periodMap } = calculatePeriodDays(year, month); const events = DB.getCalendarEvents(); const today = new Date(); for (let i = 0; i < startDayOfWeek; i++) { const div = document.createElement('div'); div.className = 'calendar-day other-month'; grid.appendChild(div); } for (let d = 1; d <= daysInMonth; d++) { const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const div = document.createElement('div'); div.className = 'calendar-day'; const dayEvents = events[dateStr]; if (dayEvents && dayEvents.length > 0) { div.classList.add('has-event'); } if (periodMap[dateStr]) { div.classList.add('period-day'); } if (year === today.getFullYear() && month === today.getMonth() && d === today.getDate()) { div.classList.add('today'); } div.innerHTML = `<div class="day-number">${d}</div>`; div.onclick = () => openCalendarModal(dateStr); grid.appendChild(div); } renderMonthEventList(year, month); }
function renderMonthEventList(year, month) { const container = document.getElementById('calendar-month-events'); container.innerHTML = ''; const events = DB.getCalendarEvents(); const lastDay = new Date(year, month + 1, 0).getDate(); const { predictedStarts } = calculatePeriodDays(year, month); let hasEvents = false; for (let d = 1; d <= lastDay; d++) { const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const dayEvents = events[dateStr]; if (dayEvents && dayEvents.length > 0) { dayEvents.forEach(ev => { if (ev.type === 'period_end') return; hasEvents = true; const row = document.createElement('div'); row.className = 'calendar-event-row'; let displayText = `${year}年${month+1}月${d}日`; let dotColor = '#ccc'; switch(ev.type) { case 'anniversary': displayText += ` - 纪念日 - ${ev.title}`; dotColor = '#ff9500'; break; case 'birthday_char': displayText += ` - TA的生日 - ${ev.title || '未知角色'}`; dotColor = '#5856d6'; break; case 'birthday_user': displayText += ` - 我的生日`; dotColor = '#5856d6'; break; case 'period_start': case 'period': displayText += ` - 上次月经来潮日`; dotColor = '#ff2d55'; break; case 'custom': displayText += ` - 行程 - ${ev.title}`; dotColor = '#34c759'; break; } row.innerHTML = `<div class="cal-event-dot" style="background:${dotColor}"></div><div>${displayText}</div>`; container.appendChild(row); }); } if (predictedStarts.includes(dateStr)) { hasEvents = true; const row = document.createElement('div'); row.className = 'calendar-event-row'; row.innerHTML = `<div class="cal-event-dot" style="background:#ff2d55; opacity:0.6;"></div><div style="color:#666;">${year}年${month+1}月${d}日 - 预计下月月经来潮日</div>`; container.appendChild(row); } } if (!hasEvents) { container.innerHTML = '<div style="text-align:center; color:#ccc; padding:20px; font-size:12px;">本月暂无标记事件</div>'; } }
function changeCalendarMonth(delta) { currentCalDate.setMonth(currentCalDate.getMonth() + delta); renderCalendar(); }
function goToToday() { currentCalDate = new Date(); renderCalendar(); }
function openCalendarModal(dateStr) { selectedCalDateStr = dateStr; document.getElementById('cal-modal-date-title').innerText = dateStr.replace(/-/g, ' / '); document.getElementById('calendar-event-modal').classList.add('active'); renderCalendarEventList(); }
function closeCalendarModal() { document.getElementById('calendar-event-modal').classList.remove('active'); renderCalendar(); }
function renderCalendarEventList() { const list = document.getElementById('cal-event-list'); list.innerHTML = ''; const events = DB.getCalendarEvents()[selectedCalDateStr] || []; if (events.length === 0) { list.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">暂无事件</div>'; return; } events.forEach((ev, index) => { const div = document.createElement('div'); div.className = 'event-list-item'; let typeLabel = ''; let details = ''; switch(ev.type) { case 'anniversary': typeLabel = '❤️ 纪念日'; details = ev.title; break; case 'birthday_char': typeLabel = '🎂 【' + (ev.title || '未知') + '】的生日'; break; case 'birthday_user': typeLabel = '🎉 我的生日'; break; case 'period_start': case 'period': typeLabel = '🩸 月经开始'; details = `(周期:${ev.cycle}天, 持续:${ev.duration}天)`; break; case 'period_end': typeLabel = '🏁 月经结束'; break; case 'custom': typeLabel = '📌 ' + (ev.title || '自定义'); break; } div.innerHTML = `<div><div style="font-weight:bold;">${typeLabel}</div><div style="font-size:12px; color:#666;">${details}</div></div><div style="color:#ff3b30; cursor:pointer;" onclick="deleteCalendarEvent(${index})">🗑️</div>`; list.appendChild(div); }); }
function addCalendarEvent(type) { 
    let title = ''; 
    let cycle = 28; 
    let duration = 5; 
    
    if (type === 'custom') { 
        title = prompt("请输入行程名称："); 
        if (!title) return; 
    } 
    if (type === 'anniversary') { 
        title = prompt("请输入纪念日名称："); 
        if (!title) return; 
    } 
    if (type === 'birthday_char') {
        const contacts = DB.getContacts();
        if (contacts.length === 0) return alert("请先在通讯录添加角色");
        let msg = "请选择角色 (输入序号):\n";
        contacts.forEach((c, i) => msg += `${i+1}. ${c.name}\n`);
        const input = prompt(msg);
        if (!input) return;
        const index = parseInt(input) - 1;
        if (contacts[index]) {
            title = contacts[index].name;
        } else {
            return alert("无效的选择");
        }
    }
    if (type === 'period_start') { 
        const c = prompt("请输入月经周期 (天)：", "28"); 
        if (c === null) return; 
        cycle = parseInt(c) || 28; 
        const d = prompt("请输入行经期 (天)：", "5"); 
        if (d === null) return; 
        duration = parseInt(d) || 5; 
    } 
    
    const allEvents = DB.getCalendarEvents(); 
    if (!allEvents[selectedCalDateStr]) allEvents[selectedCalDateStr] = []; 
    if (type === 'period_start') { 
        allEvents[selectedCalDateStr] = allEvents[selectedCalDateStr].filter(e => e.type !== 'period_start' && e.type !== 'period'); 
    } 
    allEvents[selectedCalDateStr].push({ type: type, title: title, cycle: cycle, duration: duration }); 
    DB.saveCalendarEvents(allEvents); 
    renderCalendarEventList(); 
}
function deleteCalendarEvent(index) { if (!confirm("确定删除此事件？")) return; const allEvents = DB.getCalendarEvents(); allEvents[selectedCalDateStr].splice(index, 1); if (allEvents[selectedCalDateStr].length === 0) delete allEvents[selectedCalDateStr]; DB.saveCalendarEvents(allEvents); renderCalendarEventList(); }
function openContactForm(contactId = null) { const form = document.getElementById('add-contact-area'); form.classList.add('active'); document.getElementById('contact-avatar-input').value = ''; document.getElementById('contact-avatar-url').value = ''; if (contactId) { const c = DB.getContacts().find(c => c.id === contactId); if (c) { document.getElementById('contact-form-title').innerText = "编辑联系人"; document.getElementById('contact-id-hidden').value = c.id; document.getElementById('contact-name-input').value = c.name; document.getElementById('contact-persona-input').value = c.persona; if (c.avatar && c.avatar.startsWith('http')) document.getElementById('contact-avatar-url').value = c.avatar; } } else { document.getElementById('contact-form-title').innerText = "添加联系人"; document.getElementById('contact-id-hidden').value = ''; document.getElementById('contact-name-input').value = ''; document.getElementById('contact-persona-input').value = ''; } }
function closeContactForm() { document.getElementById('add-contact-area').classList.remove('active'); }
function saveContact() { const id = document.getElementById('contact-id-hidden').value; const name = document.getElementById('contact-name-input').value; const persona = document.getElementById('contact-persona-input').value; const fileInput = document.getElementById('contact-avatar-input'); const urlInput = document.getElementById('contact-avatar-url').value; if (!name) return alert('请输入姓名'); const processSave = (avatarUrl) => { let contacts = DB.getContacts(); if (id) { const i = contacts.findIndex(c => c.id == id); if (i !== -1) { contacts[i].name = name; contacts[i].persona = persona; if (avatarUrl) contacts[i].avatar = avatarUrl; } } else { contacts.push({ id: Date.now(), name, persona, avatar: avatarUrl || '' }); } DB.saveContacts(contacts); renderContacts(); closeContactForm(); }; if (urlInput) processSave(urlInput); else if (fileInput.files[0]) { const r = new FileReader(); r.onload = (e) => processSave(e.target.result); r.readAsDataURL(fileInput.files[0]); } else processSave(null); }
function deleteContact(id) { if(confirm('确定删除？')) { DB.saveContacts(DB.getContacts().filter(c => c.id !== id)); let chats = DB.getChats(); delete chats[id]; DB.saveChats(chats); renderContacts(); } }
function renderContacts() { const list = document.getElementById('contacts-list'); list.innerHTML = ''; DB.getContacts().forEach(c => { const div = document.createElement('div'); div.className = 'contact-list-item'; div.innerHTML = `<img src="${c.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>'}" class="avatar-preview"><div class="contact-info"><div class="contact-name">${c.name}</div><div class="contact-persona">${c.persona}</div></div><div class="contact-actions"><div class="contact-btn" onclick="openContactForm(${c.id})">✏️</div><div class="contact-btn" style="color:#ff3b30" onclick="deleteContact(${c.id})">🗑️</div></div>`; list.appendChild(div); }); }
let currentWBTab = 'global';
function toggleWBCreateMenu() { document.getElementById('wb-create-menu').classList.toggle('active'); }
function switchWBTab(tab) { currentWBTab = tab; document.getElementById('wb-tab-global').classList.toggle('active', tab === 'global'); document.getElementById('wb-tab-local').classList.toggle('active', tab === 'local'); renderWorldBook(); }
function createWBCategory() { const name = prompt("分类名称"); if (name) { const wb = DB.getWorldBook(); wb.categories.push({ id: Date.now(), name }); DB.saveWorldBook(wb); renderWorldBook(); toggleWBCreateMenu(); } }
function editWBCategoryName(id) { const wb = DB.getWorldBook(); const cat = wb.categories.find(c => c.id == id); if (cat) { const n = prompt("修改名称", cat.name); if (n) { cat.name = n; DB.saveWorldBook(wb); renderWorldBook(); } } }
function deleteWBCategory(id) { if (!confirm("删除分类？")) return; const wb = DB.getWorldBook(); wb.categories = wb.categories.filter(c => c.id != id); wb.entries = wb.entries.filter(e => e.categoryId != id); DB.saveWorldBook(wb); renderWorldBook(); }
function deleteWBEntry(id, e) { e.stopPropagation(); if (!confirm("删除条目？")) return; const wb = DB.getWorldBook(); wb.entries = wb.entries.filter(en => en.id != id); DB.saveWorldBook(wb); renderWorldBook(); }
function openWBEditor(entryId = null) { toggleWBCreateMenu(); document.getElementById('wb-editor-modal').classList.add('active'); const wb = DB.getWorldBook(); const sel = document.getElementById('wb-edit-category'); sel.innerHTML = ''; wb.categories.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.innerText = c.name; sel.appendChild(o); }); if (entryId) { const en = wb.entries.find(e => e.id == entryId); if(en) { document.getElementById('wb-edit-id').value = en.id; document.getElementById('wb-edit-title').value = en.title; document.getElementById('wb-edit-type').value = en.type; document.getElementById('wb-edit-category').value = en.categoryId; document.getElementById('wb-edit-content').value = en.content; } } else { document.getElementById('wb-edit-id').value = ''; document.getElementById('wb-edit-title').value = ''; document.getElementById('wb-edit-type').value = currentWBTab; document.getElementById('wb-edit-content').value = ''; } }
function closeWBEditor() { document.getElementById('wb-editor-modal').classList.remove('active'); }
function saveWBEntry() { const id = document.getElementById('wb-edit-id').value, title = document.getElementById('wb-edit-title').value, type = document.getElementById('wb-edit-type').value, catId = document.getElementById('wb-edit-category').value, content = document.getElementById('wb-edit-content').value; if (!title) return alert("请输入标题"); const wb = DB.getWorldBook(); if (id) { const i = wb.entries.findIndex(e => e.id == id); if (i !== -1) wb.entries[i] = { id, title, type, categoryId: catId, content }; } else { wb.entries.push({ id: Date.now(), title, type, categoryId: catId, content }); } DB.saveWorldBook(wb); renderWorldBook(); closeWBEditor(); }
function renderWorldBook() { const list = document.getElementById('wb-content-list'); list.innerHTML = ''; const wb = DB.getWorldBook(); const entries = wb.entries.filter(e => e.type === currentWBTab); wb.categories.forEach(cat => { const catEntries = entries.filter(e => e.categoryId == cat.id); const div = document.createElement('div'); div.className = 'wb-category'; div.innerHTML = `<div class="wb-category-header"><div><span>${cat.name}</span> <span style="font-size:10px;color:#999;cursor:pointer;margin-left:5px;" onclick="editWBCategoryName('${cat.id}')">编辑</span></div><span style="cursor:pointer;" onclick="deleteWBCategory('${cat.id}')">🗑️</span></div>`; if (catEntries.length === 0) { div.innerHTML += `<div style="padding:10px 15px;color:#ccc;font-size:12px;">无条目</div>`; } else { catEntries.forEach(en => { const it = document.createElement('div'); it.className = 'wb-entry-item'; it.innerHTML = `<span>${en.title}</span><span style="color:#ccc;padding:5px;" onclick="deleteWBEntry('${en.id}', event)">✕</span>`; it.onclick = () => openWBEditor(en.id); div.appendChild(it); }); } list.appendChild(div); }); }
let currentMemoContact = null;
function renderMemoContacts() { const list = document.getElementById('memo-contact-list'); list.innerHTML = ''; DB.getContacts().forEach(c => { const div = document.createElement('div'); div.className = 'chat-list-item'; div.onclick = () => openMemoDetail(c); div.innerHTML = `<img src="${c.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>'}" class="avatar-preview"><div class="contact-info"><div class="contact-name">${c.name}</div><div class="contact-persona">点击查看记忆</div></div>`; list.appendChild(div); }); }
function openMemoDetail(c) { currentMemoContact = c; openApp('app-memo-detail'); document.getElementById('memo-detail-title').innerText = c.name + "的记忆"; renderMemoDetailList(); }
function renderMemoDetailList() { const list = document.getElementById('memo-detail-list'); list.innerHTML = ''; const mems = DB.getMemories()[currentMemoContact.id] || { important: [], normal: [] }; const impHeader = document.createElement('div'); impHeader.className = 'memo-section-header'; impHeader.innerText = "⭐ 重要回忆 (永久)"; list.appendChild(impHeader); if (mems.important.length === 0) list.innerHTML += '<div style="text-align:center;color:#ccc;font-size:12px;margin-bottom:20px;">暂无重要回忆</div>'; else { mems.important.forEach((m, i) => { const div = document.createElement('div'); div.className = 'memo-item important'; div.innerHTML = `<span class="memo-date">重要记忆 #${i+1}</span>${m.content}<span class="memo-delete" onclick="deleteMemory('important', ${i})">🗑️</span>`; div.onclick = () => editMemory('important', i); list.appendChild(div); }); } const normHeader = document.createElement('div'); normHeader.className = 'memo-section-header'; normHeader.innerText = "📝 普通回忆"; list.appendChild(normHeader); if (mems.normal.length === 0) list.innerHTML += '<div style="text-align:center;color:#ccc;font-size:12px;">暂无普通回忆</div>'; else { mems.normal.forEach((m, i) => { const div = document.createElement('div'); div.className = 'memo-item'; const kwHtml = m.keywords && m.keywords.length > 0 ? `<div class="memo-keywords">关键词: ${m.keywords.join(', ')}</div>` : ''; div.innerHTML = `<span class="memo-date">记忆 #${i+1}</span>${m.content}${kwHtml}<span class="memo-delete" onclick="deleteMemory('normal', ${i})">🗑️</span>`; div.onclick = () => editMemory('normal', i); list.appendChild(div); }); } }
function addImportantMemory() { const m = prompt("添加一条重要记忆 (永久保存)："); if (m) { const mems = DB.getMemories(); if (!mems[currentMemoContact.id]) mems[currentMemoContact.id] = { important: [], normal: [] }; mems[currentMemoContact.id].important.push({ content: m, keywords: [] }); DB.saveMemories(mems); renderMemoDetailList(); } }
function editMemory(type, i) { const mems = DB.getMemories(); const old = mems[currentMemoContact.id][type][i]; const n = prompt("编辑记忆内容：", old.content); if (n !== null) { mems[currentMemoContact.id][type][i].content = n; if (type === 'normal') { const k = prompt("编辑关键词 (用逗号分隔)：", old.keywords ? old.keywords.join(',') : ''); if (k !== null) mems[currentMemoContact.id][type][i].keywords = k.split(',').map(s => s.trim()).filter(s => s); } DB.saveMemories(mems); renderMemoDetailList(); } }
function deleteMemory(type, i) { event.stopPropagation(); if (confirm("删除这条记忆？")) { const mems = DB.getMemories(); mems[currentMemoContact.id][type].splice(i, 1); DB.saveMemories(mems); renderMemoDetailList(); } }

// --- 备忘录设置和每日总结功能 ---
function openMemoSettings() {
    if (!currentMemoContact) return;
    document.getElementById('memo-settings-modal').classList.add('active');
    
    const contacts = DB.getContacts();
    const contact = contacts.find(c => c.id === currentMemoContact.id);
    const dailySummarySettings = contact?.dailySummarySettings || { enabled: false, time: '08:00', lastSummary: null };
    
    document.getElementById('daily-summary-toggle').checked = dailySummarySettings.enabled;
    document.getElementById('daily-summary-time').value = dailySummarySettings.time || '08:00';
    
    if (dailySummarySettings.lastSummary) {
        const lastTime = new Date(dailySummarySettings.lastSummary);
        document.getElementById('last-summary-time').innerText = lastTime.toLocaleString('zh-CN');
    } else {
        document.getElementById('last-summary-time').innerText = '暂无记录';
    }
}

function closeMemoSettings() {
    document.getElementById('memo-settings-modal').classList.remove('active');
}

function addImportantMemoryFromSettings() {
    closeMemoSettings();
    addImportantMemory();
}

function saveMemoSettings() {
    if (!currentMemoContact) return;
    
    const enabled = document.getElementById('daily-summary-toggle').checked;
    const time = document.getElementById('daily-summary-time').value;
    
    let contacts = DB.getContacts();
    const i = contacts.findIndex(c => c.id === currentMemoContact.id);
    if (i !== -1) {
        if (!contacts[i].dailySummarySettings) {
            contacts[i].dailySummarySettings = {};
        }
        contacts[i].dailySummarySettings.enabled = enabled;
        contacts[i].dailySummarySettings.time = time;
        DB.saveContacts(contacts);
        currentMemoContact = contacts[i];
    }
    
    setupDailySummaryTimers();
}

async function triggerManualDailySummary() {
    if (!currentMemoContact) return;
    
    const settings = DB.getSettings();
    if (!settings.key) return alert('请先在设置中配置 API Key');
    
    if (!confirm('确定要执行每日总结吗？\n这将总结过去24小时的聊天记录和记忆。')) return;
    
    alert('正在生成每日总结，请稍候...');
    
    try {
        await executeDailySummary(currentMemoContact);
        alert('每日总结已完成！');
        renderMemoDetailList();
        
        document.getElementById('last-summary-time').innerText = new Date().toLocaleString('zh-CN');
    } catch (e) {
        alert('每日总结失败：' + e.message);
    }
}

async function executeDailySummary(contact) {
    const settings = DB.getSettings();
    if (!settings.key) return;
    
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const allChats = DB.getChats();
    const chatHistory = allChats[contact.id] || [];
    const recentChats = chatHistory.filter(msg => msg.timestamp && msg.timestamp >= yesterday.getTime());
    
    const mems = DB.getMemories();
    const contactMems = mems[contact.id] || { important: [], normal: [] };
    
    const recentNormalMems = [];
    const recentNormalMemIndices = [];
    contactMems.normal.forEach((m, idx) => {
        if (m.timestamp && m.timestamp >= yesterday.getTime()) {
            recentNormalMems.push(m);
            recentNormalMemIndices.push(idx);
        }
    });
    
    if (recentChats.length === 0 && recentNormalMems.length === 0) {
        console.log('No recent content to summarize');
        return;
    }
    
    const chatText = recentChats.map(m => {
        const time = m.timestamp ? new Date(m.timestamp).toLocaleString('zh-CN', { hour12: false }) : "未知时间";
        const role = m.role === 'user' ? 'User' : contact.name;
        return `[${time}] ${role}: ${m.content}`;
    }).join('\n');
    
    const memText = recentNormalMems.map((m, i) => `记忆${i+1}: ${m.content}`).join('\n');
    
    const nowStr = now.toLocaleString('zh-CN', { hour12: false });
    const yesterdayStr = yesterday.toLocaleString('zh-CN', { hour12: false });
    
    const prompt = `你现在是 ${contact.name}。
请阅读以下过去24小时（${yesterdayStr} 至 ${nowStr}）的聊天记录和已有记忆，进行每日总结。

===== 聊天记录 =====
${chatText || '（无聊天记录）'}

===== 已有记忆片段 =====
${memText || '（无记忆片段）'}

===== 任务要求 =====
1. 以【第一人称】（我...）总结这一天发生的所有重要事件
2. 将所有记忆片段整合为一条完整的每日总结
3. 判断是否有【重要记忆】（重要的决定、人生转折点、共同创造的甜蜜回忆、重大事件等）
4. 如果有重要记忆，请单独提取出来

严格返回JSON格式：
{
    "dailySummary": "今天的完整总结内容...",
    "keywords": ["关键词1", "关键词2"],
    "importantMemories": ["重要记忆1（如果有）", "重要记忆2（如果有）"],
    "hasContent": true/false
}

注意：
- 如果这一天没有任何有意义的内容，hasContent 返回 false，dailySummary 返回 "无"
- importantMemories 数组可以为空，只有真正重要的事件才放入
- 每日总结应该是一段连贯的叙述，不是简单罗列`;

    try {
        const res = await fetch(`${settings.url}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.key}` },
            body: JSON.stringify({ model: settings.model, messages: [{ role: "user", content: prompt }], temperature: 0.5 })
        });
        
        const data = await res.json();
        if (data.choices?.length > 0) {
            let raw = data.choices[0].message.content.trim().replace(/```json/g, '').replace(/```/g, '').trim();
            
            try {
                const result = JSON.parse(raw);
                
                if (result.hasContent && result.dailySummary && result.dailySummary !== "无") {
                    const updatedMems = DB.getMemories();
                    if (!updatedMems[contact.id]) {
                        updatedMems[contact.id] = { important: [], normal: [] };
                    }
                    
                    recentNormalMemIndices.sort((a, b) => b - a).forEach(idx => {
                        updatedMems[contact.id].normal.splice(idx, 1);
                    });
                    
                    const dateStr = now.toLocaleDateString('zh-CN');
                    updatedMems[contact.id].normal.push({
                        content: `【${dateStr} 每日总结】\n${result.dailySummary}`,
                        keywords: result.keywords || [],
                        timestamp: now.getTime(),
                        isDailySummary: true
                    });
                    
                    if (result.importantMemories && result.importantMemories.length > 0) {
                        result.importantMemories.forEach(impMem => {
                            if (impMem && impMem.trim()) {
                                updatedMems[contact.id].important.push({
                                    content: `【${dateStr}】${impMem}`,
                                    keywords: [],
                                    timestamp: now.getTime()
                                });
                            }
                        });
                    }
                    
                    DB.saveMemories(updatedMems);
                    
                    let contacts = DB.getContacts();
                    const idx = contacts.findIndex(c => c.id === contact.id);
                    if (idx !== -1) {
                        if (!contacts[idx].dailySummarySettings) {
                            contacts[idx].dailySummarySettings = { enabled: false, time: '08:00' };
                        }
                        contacts[idx].dailySummarySettings.lastSummary = now.getTime();
                        DB.saveContacts(contacts);
                    }
                    
                    console.log('Daily summary generated:', result);
                }
            } catch (e) {
                console.error('JSON parse failed:', e);
                throw e;
            }
        }
    } catch (e) {
        console.error('Daily summary generation failed:', e);
        throw e;
    }
}

let dailySummaryTimers = {};

function setupDailySummaryTimers() {
    Object.values(dailySummaryTimers).forEach(timer => clearTimeout(timer));
    dailySummaryTimers = {};
    
    const contacts = DB.getContacts();
    contacts.forEach(contact => {
        const settings = contact.dailySummarySettings;
        if (settings?.enabled && settings?.time) {
            scheduleDailySummary(contact);
        }
    });
}

function scheduleDailySummary(contact) {
    const settings = contact.dailySummarySettings;
    if (!settings?.enabled || !settings?.time) return;
    
    const [hours, minutes] = settings.time.split(':').map(Number);
    const now = new Date();
    let targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    
    if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    if (settings.lastSummary) {
        const lastSummaryDate = new Date(settings.lastSummary);
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (lastSummaryDate >= todayStart) {
            targetTime.setDate(targetTime.getDate() + 1);
        }
    }
    
    const delay = targetTime.getTime() - now.getTime();
    
    console.log(`Scheduled daily summary for ${contact.name} at ${targetTime.toLocaleString()}, delay: ${Math.round(delay/1000/60)} minutes`);
    
    dailySummaryTimers[contact.id] = setTimeout(async () => {
        console.log(`Executing scheduled daily summary for ${contact.name}`);
        try {
            await executeDailySummary(contact);
            const updatedContacts = DB.getContacts();
            const updatedContact = updatedContacts.find(c => c.id === contact.id);
            if (updatedContact) {
                scheduleDailySummary(updatedContact);
            }
        } catch (e) {
            console.error('Scheduled daily summary failed:', e);
            scheduleDailySummary(contact);
        }
    }, delay);
}

setupDailySummaryTimers();

setInterval(() => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const contacts = DB.getContacts();
    contacts.forEach(async contact => {
        const settings = contact.dailySummarySettings;
        if (!settings?.enabled || settings?.time !== currentTime) return;
        
        if (settings.lastSummary) {
            const lastSummaryDate = new Date(settings.lastSummary);
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (lastSummaryDate >= todayStart) return;
        }
        
        console.log(`Backup timer: Executing daily summary for ${contact.name}`);
        try {
            await executeDailySummary(contact);
        } catch (e) {
            console.error('Backup daily summary failed:', e);
        }
    });
}, 60000);

let currentSpyContact = null, currentSpyNPC = null;
function renderSpyContactList() { const list = document.getElementById('spy-contact-list'); list.innerHTML = ''; DB.getContacts().forEach(c => { const d = document.createElement('div'); d.className = 'chat-list-item'; d.onclick = () => { currentSpyContact = c; openApp('app-spy-home'); document.getElementById('spy-home-title').innerText = c.name + "'s Phone"; applySpyTheme(); }; d.innerHTML = `<img src="${c.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>'}" class="avatar-preview"><div class="contact-info"><div class="contact-name">${c.name}</div><div class="contact-persona">点击查看手机</div></div>`; list.appendChild(d); }); }
function openSpyVK() { openApp('app-spy-vk'); renderSpyVKContacts(); }
function openSpyMemos() { openApp('app-spy-memos'); renderSpyMemos(); }
function renderSpyVKContacts() { const c = document.getElementById('spy-vk-contacts'); c.innerHTML = ''; const sd = DB.getSpyData(); const cs = (sd[currentSpyContact.id]?.vk_contacts) || []; if (cs.length === 0) { c.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">暂无，点击 + 生成</div>'; return; } cs.forEach((npc,i) => { const d = document.createElement('div'); d.className = 'chat-list-item'; d.onclick = () => { currentSpyNPC = npc; openApp('app-spy-vk-chat'); document.getElementById('spy-vk-chat-title').innerText = npc.name; renderSpyVKMessages(); }; d.innerHTML = `<div class="avatar-preview" style="background:#${Math.floor(Math.random()*16777215).toString(16)};display:flex;justify-content:center;align-items:center;color:#fff;font-weight:bold;">${npc.name[0]}</div><div class="contact-info"><div class="contact-name">${npc.name}</div><div class="contact-persona">点击查看</div></div>`; c.appendChild(d); }); }
function renderSpyVKMessages() { const c = document.getElementById('spy-vk-messages'); c.innerHTML = ''; if (!currentSpyNPC?.messages) return; currentSpyNPC.messages.forEach(m => { const r = document.createElement('div'); r.className = `message-row ${m.role === 'me' ? 'user' : 'ai'}`; r.innerHTML = `<div class="message-bubble ${m.role === 'me' ? 'user' : 'ai'}">${m.content}</div>`; c.appendChild(r); }); }
function renderSpyMemos() { const c = document.getElementById('spy-memo-list'); c.innerHTML = ''; const memos = (DB.getSpyData()[currentSpyContact.id]?.memos) || []; if (memos.length === 0) { c.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">暂无，点击 + 生成</div>'; return; } memos.forEach((m, i) => { const d = document.createElement('div'); d.className = 'memo-item'; d.innerHTML = `<span class="memo-date">${new Date().toLocaleDateString()}</span>${m}<span class="memo-delete" onclick="deleteSpyMemo(${i})">🗑️</span>`; c.appendChild(d); }); }
function deleteSpyMemo(i) { if(!confirm("删除？")) return; const sd = DB.getSpyData(); sd[currentSpyContact.id]?.memos?.splice(i, 1); DB.saveSpyData(sd); renderSpyMemos(); }
function clearSpyVK() { if(!confirm("清空？")) return; const sd = DB.getSpyData(); if(sd[currentSpyContact.id]) sd[currentSpyContact.id].vk_contacts = []; DB.saveSpyData(sd); renderSpyVKContacts(); }
function clearSpyMemos() { if(!confirm("清空？")) return; const sd = DB.getSpyData(); if(sd[currentSpyContact.id]) sd[currentSpyContact.id].memos = []; DB.saveSpyData(sd); renderSpyMemos(); }
async function generateSpyChat() { if (!confirm("生成聊天记录？")) return; await callSpyAPI('chat'); }
async function generateSpyMemos() { if (!confirm("生成备忘录？")) return; await callSpyAPI('memo'); }
async function refreshSpyVK() { if (!confirm("刷新将清空当前所有聊天记录并重新生成，确定吗？")) return; const sd = DB.getSpyData(); if (sd[currentSpyContact.id]) sd[currentSpyContact.id].vk_contacts = []; DB.saveSpyData(sd); renderSpyVKContacts(); await callSpyAPI('chat'); }
async function refreshSpyMemos() { if (!confirm("刷新将清空当前所有备忘录并重新生成，确定吗？")) return; const sd = DB.getSpyData(); if (sd[currentSpyContact.id]) sd[currentSpyContact.id].memos = []; DB.saveSpyData(sd); renderSpyMemos(); await callSpyAPI('memo'); }

function openSpyBrowser() { openApp('app-spy-browser'); renderSpyBrowser(); }
function openSpyDiary() { openApp('app-spy-diary'); renderSpyDiaries(); }
function openSpySettings() { openApp('app-spy-settings'); applySpyTheme(); }

function renderSpyBrowser() {
    const c = document.getElementById('spy-browser-list');
    c.innerHTML = '';
    const history = (DB.getSpyData()[currentSpyContact.id]?.browser_history) || [];
    if (history.length === 0) {
        c.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">暂无搜索记录，点击 + 生成</div>';
        return;
    }
    history.forEach(item => {
        const d = document.createElement('div');
        d.className = 'browser-item';
        d.innerText = item;
        c.appendChild(d);
    });
}

function renderSpyDiaries() {
    const c = document.getElementById('spy-diary-list');
    c.innerHTML = '';
    const diaries = (DB.getSpyData()[currentSpyContact.id]?.diaries) || [];
    
    const now = new Date();
    const todayPrefix = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`;
    const hasToday = diaries.some(d => d.content.includes(todayPrefix));
    const addBtn = document.getElementById('spy-diary-add-btn');
    if (addBtn) addBtn.style.display = hasToday ? 'none' : 'inline-block';

    if (diaries.length === 0) {
        c.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">暂无日记，点击 + 生成</div>';
        return;
    }

    const reversedDiaries = [...diaries].reverse();
    let separatorRendered = false;

    reversedDiaries.forEach((entry, reverseIndex) => {
        const realIndex = diaries.length - 1 - reverseIndex;
        
        const isToday = entry.content.includes(todayPrefix);

        if (!isToday && !separatorRendered) {
            const sep = document.createElement('div');
            sep.className = 'diary-separator';
            sep.innerText = '以下为曾经写下的日记';
            c.appendChild(sep);
            separatorRendered = true;
        }

        const d = document.createElement('div');
        d.className = 'diary-entry';
        
        const lines = entry.content.split('\n');
        const title = lines[0];
        const body = lines.slice(1).join('\n');

        d.innerHTML = `
            <div class="diary-date">${title}</div>
            <div class="diary-content">${body.replace(/\n/g, '<br>')}</div>
            <div class="diary-actions">
                <span class="diary-action-btn" onclick="openSpyDiaryEdit(${realIndex})">编辑</span>
                <span class="diary-action-btn" style="color:#ff3b30" onclick="deleteSpyDiary(${realIndex})">删除</span>
            </div>
        `;
        c.appendChild(d);
    });
}

async function generateSpyBrowser() { if (!confirm("生成搜索记录？")) return; await callSpyAPI('browser'); }
async function refreshSpyBrowser() { if (!confirm("清空并重新生成搜索记录？")) return; clearSpyBrowser(false); await callSpyAPI('browser'); }
function clearSpyBrowser(confirmFlag = true) { 
    if (confirmFlag && !confirm("清空搜索记录？")) return; 
    const sd = DB.getSpyData(); 
    if (sd[currentSpyContact.id]) sd[currentSpyContact.id].browser_history = []; 
    DB.saveSpyData(sd); 
    renderSpyBrowser(); 
}

async function generateSpyDiary() { if (!confirm("写一篇新日记？")) return; await callSpyAPI('diary'); }
async function refreshSpyDiary() { 
    if (!confirm("删除最新一篇日记并重新生成？")) return; 
    const sd = DB.getSpyData();
    if (sd[currentSpyContact.id] && sd[currentSpyContact.id].diaries && sd[currentSpyContact.id].diaries.length > 0) {
        sd[currentSpyContact.id].diaries.pop();
        DB.saveSpyData(sd);
        renderSpyDiaries();
    }
    await callSpyAPI('diary'); 
}
function clearSpyDiaries() { 
    if (!confirm("清空所有日记？")) return; 
    const sd = DB.getSpyData(); 
    if (sd[currentSpyContact.id]) sd[currentSpyContact.id].diaries = []; 
    DB.saveSpyData(sd); 
    renderSpyDiaries(); 
}
function deleteSpyDiary(index) {
    if (!confirm("删除这篇日记？")) return;
    const sd = DB.getSpyData();
    if (sd[currentSpyContact.id]?.diaries) {
        sd[currentSpyContact.id].diaries.splice(index, 1);
        DB.saveSpyData(sd);
        renderSpyDiaries();
    }
}

let editingSpyDiaryIndex = -1;

function openSpyDiaryEdit(index) {
    editingSpyDiaryIndex = index;
    const sd = DB.getSpyData();
    const entry = sd[currentSpyContact.id].diaries[index];
    document.getElementById('spy-diary-edit-textarea').value = entry.content;
    document.getElementById('spy-diary-edit-modal').classList.add('active');
}

function closeSpyDiaryEdit() {
    document.getElementById('spy-diary-edit-modal').classList.remove('active');
    editingSpyDiaryIndex = -1;
}

function saveSpyDiaryEdit() {
    if (editingSpyDiaryIndex === -1) return;
    const newContent = document.getElementById('spy-diary-edit-textarea').value;
    if (newContent) {
        const sd = DB.getSpyData();
        sd[currentSpyContact.id].diaries[editingSpyDiaryIndex].content = newContent;
        DB.saveSpyData(sd);
        renderSpyDiaries();
        closeSpyDiaryEdit();
    }
}

async function callSpyAPI(type) { 
    const s = DB.getSettings(); 
    if (!s.key) return alert('请配置 API Key'); 
    
    const chatHistory = (DB.getChats()[currentSpyContact.id] || []).slice(-20).map(m => `${m.role === 'user' ? 'User' : 'Me'}: ${m.content}`).join('\n');
    
    let prompt = "";
    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 星期${['日','一','二','三','四','五','六'][now.getDay()]}`;

    if (type === 'chat') {
        prompt = `你正在扮演 ${currentSpyContact.name}。人设：${currentSpyContact.persona}。生成JSON数组，包含2-5个对象，每个代表你与一个NPC的聊天。格式：[{"name":"NPC名","messages":[{"role":"npc","content":"..."},{"role":"me","content":"..."}]}]。不要出现用户。每对话100字以内。严格返回JSON，不要Markdown。`;
    } else if (type === 'memo') {
        prompt = `你正在扮演 ${currentSpyContact.name}。人设：${currentSpyContact.persona}。根据聊天记录：\n${chatHistory}\n生成3-6条备忘录，第一人称，每条不超50字。格式：["备忘录1","备忘录2"]。严格返回JSON。`;
    } else if (type === 'browser') {
        prompt = `你正在扮演 ${currentSpyContact.name}。人设：${currentSpyContact.persona}。
                请生成 5 到 10 条该角色的手机浏览器搜索记录。
                
                **重要生成逻辑**：
                1. **活人感**：搜索记录必须主要基于角色的个人爱好、生活琐事、工作/学习需求、突发奇想或当下流行梗。不要只围绕用户转。
                2. **关系判定**：请根据以下聊天记录判断角色与用户的关系：
                   - 若关系亲密（情侣/家人）：可以包含约 30% 关于用户的搜索（如送礼、共同话题）。
                   - 若关系一般或陌生/敌对：几乎不要搜索关于用户的内容，专注于角色自己的生活。
                
                参考聊天记录（仅用于判断关系和近期状态，不要直接照搬对话）：
                ${chatHistory}
                
                格式：["搜索内容1", "搜索内容2", ...]，严格返回JSON字符串数组。`;
    } else if (type === 'diary') {
        prompt = `你正在扮演 ${currentSpyContact.name}。人设：${currentSpyContact.persona}。
                今天是 ${dateStr}。
                请根据今天你与用户的聊天记录：
                ${chatHistory}
                写一篇日记。
                
                **核心要求：**
                1. **活人感**：日记必须真实、生活化。重点记录今天发生了什么事、和用户聊了什么话题、以及你对这些事的真实感受。不要写成流水账，要有情感波动。
                2. **关于阴暗想法**：<strike>删除线内容</strike> 代表你写下后又后悔、或者不想被人看到的阴暗/私密想法。**请注意：这并非必须！** 只有当你真的有想隐藏的秘密、对用户的真实吐槽、或者一闪而过的负面情绪时才使用。如果今天很开心，或者没有特别阴暗的想法，就不要强行使用删除线。让它自然流露。
                3. **重点标记**：使用 <mark>重点内容</mark> 标记你觉得今天最重要、最开心或最难忘的事情。
                
                格式要求：
                1. 字数 200-500 字。
                2. 必须以 "${dateStr}" 开头，然后换行写正文。
                3. 严格返回 JSON 格式，包含一个 content 字段：{"content": "日记完整内容..."}`;
    }

    try { 
        const temp = s.temperature !== undefined ? s.temperature : 0.7;
        const res = await fetch(`${s.url}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s.key}` }, body: JSON.stringify({ model: s.model, messages: [{ role: "system", content: prompt }], temperature: temp }) }); 
        const data = await res.json(); 
        if (data.choices?.length > 0) { 
            let c = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim(); 
            const parsed = JSON.parse(c); 
            const sd = DB.getSpyData(); 
            if (!sd[currentSpyContact.id]) sd[currentSpyContact.id] = {}; 
            
            if (type === 'chat') { 
                sd[currentSpyContact.id].vk_contacts = parsed; 
                DB.saveSpyData(sd); 
                renderSpyVKContacts(); 
            } else if (type === 'memo') { 
                sd[currentSpyContact.id].memos = parsed; 
                DB.saveSpyData(sd); 
                renderSpyMemos(); 
            } else if (type === 'browser') {
                sd[currentSpyContact.id].browser_history = parsed;
                DB.saveSpyData(sd);
                renderSpyBrowser();
            } else if (type === 'diary') {
                if (!sd[currentSpyContact.id].diaries) sd[currentSpyContact.id].diaries = [];
                if (parsed.content) {
                    sd[currentSpyContact.id].diaries.push({ id: Date.now(), content: parsed.content });
                    DB.saveSpyData(sd);
                    renderSpyDiaries();
                }
            }
        } 
    } catch (e) { 
        alert("生成失败：" + e.message); 
    } 
}

let currentChatContact = null, longPressTimer, selectedMessageIndex = -1, isSelectionMode = false, selectedIndices = new Set(), pendingQuoteContent = null;
let displayedMessageCount = 20; // 初始显示的消息数量
const MESSAGES_PER_PAGE = 20; // 每次加载的消息数量
function renderVKList() { const l = document.getElementById('vk-chat-list'); l.innerHTML = ''; DB.getContacts().forEach(c => { const d = document.createElement('div'); d.className = 'chat-list-item'; d.onclick = () => openChat(c); d.innerHTML = `<img src="${c.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>'}" class="avatar-preview"><div class="contact-info"><div class="contact-name">${c.name}</div><div class="contact-persona">点击开始聊天</div></div>`; l.appendChild(d); }); }
function openChat(c) { 
    currentChatContact = c; 
    displayedMessageCount = MESSAGES_PER_PAGE; // 重置显示的消息数量
    document.getElementById('chat-interface').style.display = 'flex'; 
    document.getElementById('chat-title').innerText = c.name; 
    exitDeleteMode(); 
    cancelQuote(); 
    applyChatTheme(c); 
    renderChatHistory(); 
}
function applyChatTheme(contact) { const theme = contact.chatTheme || {}; const styleTag = document.getElementById('dynamic-chat-theme'); const chatInterface = document.getElementById('chat-interface'); if (theme.bgType === 'image' && theme.bgValue) { chatInterface.style.backgroundImage = `url(${theme.bgValue})`; chatInterface.style.backgroundColor = 'transparent'; } else { chatInterface.style.backgroundImage = 'none'; chatInterface.style.backgroundColor = theme.bgValue || '#f5f5f5'; } let css = ''; if (theme.userBubbleColor) css += `.message-bubble.user { background-color: ${theme.userBubbleColor} !important; color: #fff; } `; if (theme.userBubbleCSS) css += `.message-bubble.user { ${theme.userBubbleCSS} } `; if (theme.aiBubbleColor) css += `.message-bubble.ai { background-color: ${theme.aiBubbleColor} !important; } `; if (theme.aiBubbleCSS) css += `.message-bubble.ai { ${theme.aiBubbleCSS} } `; styleTag.innerHTML = css; }
function closeChat() { document.getElementById('chat-interface').style.display = 'none'; currentChatContact = null; }
let currentChatBgType = 'color';
function openChatSettings() { if(!currentChatContact) return; document.getElementById('ctx-overlay').classList.add('active'); document.getElementById('chat-settings-modal').classList.add('active'); const us = currentChatContact.userSettings || {}; document.getElementById('user-setting-name').value = us.userName || ''; document.getElementById('user-setting-persona').value = us.userPersona || ''; document.getElementById('user-setting-avatar-preview').src = us.userAvatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23eee%22 width=%22100%22 height=%22100%22/></svg>'; document.getElementById('user-setting-avatar-url').value = (us.userAvatar?.startsWith('http') ? us.userAvatar : ''); document.getElementById('time-perception-toggle').checked = us.enableTimePerception || false; document.getElementById('auto-summary-toggle').checked = us.autoSummaryEnabled !== false; document.getElementById('summary-interval-input').value = us.summaryInterval || 20; document.getElementById('context-limit-input').value = us.contextLimit || 100; renderBindWorldBookList(); const theme = currentChatContact.chatTheme || {}; document.getElementById('theme-user-color').value = theme.userBubbleColor || '#007aff'; document.getElementById('theme-user-css').value = theme.userBubbleCSS || ''; document.getElementById('theme-ai-color').value = theme.aiBubbleColor || '#ffffff'; document.getElementById('theme-ai-css').value = theme.aiBubbleCSS || ''; currentChatBgType = theme.bgType || 'color'; switchChatBgType(currentChatBgType); if (currentChatBgType === 'color') document.getElementById('theme-chat-bg-color').value = theme.bgValue || '#f5f5f5'; if (currentChatBgType === 'image' && theme.bgValue && theme.bgValue.startsWith('http')) { document.getElementById('theme-chat-bg-url').value = theme.bgValue; } else { document.getElementById('theme-chat-bg-url').value = ''; } }
function switchChatBgType(type) { currentChatBgType = type; document.getElementById('chat-bg-type-color').classList.toggle('active', type === 'color'); document.getElementById('chat-bg-type-image').classList.toggle('active', type === 'image'); document.getElementById('chat-bg-input-color').style.display = type === 'color' ? 'block' : 'none'; document.getElementById('chat-bg-input-image').style.display = type === 'image' ? 'block' : 'none'; }
function renderBindWorldBookList() { const l = document.getElementById('bind-wb-list'); l.innerHTML = ''; const wb = DB.getWorldBook(); const local = wb.entries.filter(e => e.type === 'local'); const bound = currentChatContact.boundWorldBooks || []; if (local.length === 0) { l.innerHTML = '<div style="padding:10px;color:#999;font-size:12px;">暂无局部世界书</div>'; return; } local.forEach(en => { const d = document.createElement('div'); d.className = 'bind-wb-item'; d.innerHTML = `<input type="checkbox" value="${en.id}" id="wb-bind-${en.id}" ${bound.includes(en.id.toString()) ? 'checked' : ''}><label for="wb-bind-${en.id}">${en.title}</label>`; l.appendChild(d); }); }
function closeChatSettings() { saveChatUserSettings(); document.getElementById('ctx-overlay').classList.remove('active'); document.getElementById('chat-settings-modal').classList.remove('active'); }
function previewUserAvatar(input) { if (input.files?.[0]) { const r = new FileReader(); r.onload = e => document.getElementById('user-setting-avatar-preview').src = e.target.result; r.readAsDataURL(input.files[0]); } }
function saveChatBubbleSettings() { saveChatUserSettings().then(() => alert("气泡设置已保存")); }
function saveChatBgSettings() { saveChatUserSettings().then(() => alert("聊天背景已保存")); }
function saveChatUserSettings() { if(!currentChatContact) return Promise.resolve(); const userName = document.getElementById('user-setting-name').value; const userPersona = document.getElementById('user-setting-persona').value; const urlInput = document.getElementById('user-setting-avatar-url').value; const fileInput = document.getElementById('user-setting-avatar-input'); const enableTime = document.getElementById('time-perception-toggle').checked; const autoSummary = document.getElementById('auto-summary-toggle').checked; const summaryInterval = parseInt(document.getElementById('summary-interval-input').value) || 20; const contextLimit = parseInt(document.getElementById('context-limit-input').value) || 100; const boundIds = [...document.querySelectorAll('#bind-wb-list input:checked')].map(cb => cb.value); const userBubbleColor = document.getElementById('theme-user-color').value; const userBubbleCSS = document.getElementById('theme-user-css').value; const aiBubbleColor = document.getElementById('theme-ai-color').value; const aiBubbleCSS = document.getElementById('theme-ai-css').value; const bgUrlInput = document.getElementById('theme-chat-bg-url').value; const bgFileInput = document.getElementById('theme-chat-bg-file'); const processSave = (av, bgVal) => { let cs = DB.getContacts(); const i = cs.findIndex(c => c.id === currentChatContact.id); if (i !== -1) { cs[i].userSettings = { userName, userPersona, userAvatar: av || cs[i].userSettings?.userAvatar || '', enableTimePerception: enableTime, autoSummaryEnabled: autoSummary, summaryInterval: summaryInterval, contextLimit: contextLimit }; cs[i].boundWorldBooks = boundIds; let finalBgValue = bgVal; if (!finalBgValue) { if (currentChatBgType === 'color') { finalBgValue = document.getElementById('theme-chat-bg-color').value; } else { finalBgValue = cs[i].chatTheme?.bgValue || ''; } } cs[i].chatTheme = { userBubbleColor, userBubbleCSS, aiBubbleColor, aiBubbleCSS, bgType: currentChatBgType, bgValue: finalBgValue }; DB.saveContacts(cs); currentChatContact = cs[i]; applyChatTheme(currentChatContact); renderChatHistory(); } }; const handleAvatar = () => { return new Promise(resolve => { if (urlInput) resolve(urlInput); else if (fileInput.files?.[0]) { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.readAsDataURL(fileInput.files[0]); } else resolve(null); }); }; const handleBg = () => { return new Promise(resolve => { if (currentChatBgType === 'color') { resolve(document.getElementById('theme-chat-bg-color').value); } else { if (bgUrlInput) resolve(bgUrlInput); else if (bgFileInput.files?.[0]) { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.readAsDataURL(bgFileInput.files[0]); } else { resolve(null); } } }); }; return Promise.all([handleAvatar(), handleBg()]).then(([av, bg]) => { processSave(av, bg); }); }
function applyThemeToAllChats() { if (!confirm("确定要将当前的气泡样式和背景应用到所有联系人的聊天中吗？")) return; saveChatUserSettings().then(() => { const currentTheme = currentChatContact.chatTheme; if (!currentTheme) return; let contacts = DB.getContacts(); contacts.forEach(c => { c.chatTheme = JSON.parse(JSON.stringify(currentTheme)); }); DB.saveContacts(contacts); alert("已应用到所有聊天！"); }); }
function clearCurrentHistory() { if (confirm('清空记录？')) { const c = DB.getChats(); c[currentChatContact.id] = []; DB.saveChats(c); renderChatHistory(); closeChatSettings(); } }
function openTransferModal() { document.getElementById('transfer-modal').classList.add('active'); document.getElementById('transfer-amount').value = ''; document.getElementById('transfer-note').value = ''; }
function closeTransferModal() { document.getElementById('transfer-modal').classList.remove('active'); }
function sendTransfer() { const amt = document.getElementById('transfer-amount').value, note = document.getElementById('transfer-note').value; if (!amt) return alert("请输入金额"); const c = DB.getChats(); if (!c[currentChatContact.id]) c[currentChatContact.id] = []; c[currentChatContact.id].push({ role: 'user', type: 'transfer', amount: amt, note: note, status: 'pending', timestamp: Date.now() }); DB.saveChats(c); renderChatHistory(); closeTransferModal(); }

function formatChatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    if (isToday) return timeStr;
    if (isYesterday) return `昨日 ${timeStr}`;
    return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
}

function loadMoreMessages() {
    displayedMessageCount += MESSAGES_PER_PAGE;
    renderChatHistory(true); // true 表示保持滚动位置
}

function renderChatHistory(maintainScroll = false) { 
    const fullChat = DB.getChats()[currentChatContact.id] || []; 
    const h = document.getElementById('chat-history'); 
    const callHistory = document.getElementById('call-history');
    const isCallActive = document.getElementById('call-screen').classList.contains('active');

    // 保存当前的滚动高度和位置，用于加载更多消息后恢复位置
    let oldScrollHeight = 0;
    let oldScrollTop = 0;
    if (h && maintainScroll) {
        oldScrollHeight = h.scrollHeight;
        oldScrollTop = h.scrollTop;
    }

    if (h) h.innerHTML = '';
    if (isCallActive && callHistory) callHistory.innerHTML = '';

    const onlineMsgs = fullChat.map((msg, originalIndex) => ({ msg, originalIndex })).filter(item => item.msg.mode !== 'offline'); 
    
    // 分页逻辑：只取最后 displayedMessageCount 条消息
    const totalOnlineMsgs = onlineMsgs.length;
    const startIndex = Math.max(0, totalOnlineMsgs - displayedMessageCount);
    const visibleMsgs = onlineMsgs.slice(startIndex);
    
    // 如果还有更多消息，显示"加载更早的消息"按钮
    if (startIndex > 0 && h && document.getElementById('chat-interface').style.display !== 'none') {
        const loadMoreBtn = document.createElement('div');
        loadMoreBtn.className = 'load-more-btn';
        loadMoreBtn.innerText = '加载更早的消息';
        loadMoreBtn.onclick = loadMoreMessages;
        loadMoreBtn.style.textAlign = 'center';
        loadMoreBtn.style.padding = '10px';
        loadMoreBtn.style.color = '#007aff';
        loadMoreBtn.style.fontSize = '12px';
        loadMoreBtn.style.cursor = 'pointer';
        h.appendChild(loadMoreBtn);
    }

    const aiAv = currentChatContact.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>'; 
    const userAv = currentChatContact.userSettings?.userAvatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23007aff%22 width=%22100%22 height=%22100%22/></svg>'; 
    
    let lastMsgTime = 0; 

    visibleMsgs.forEach((item, i) => { 
        const msg = item.msg;
        const originalIndex = item.originalIndex;
        if (msg.timestamp) {
            const diff = msg.timestamp - lastMsgTime;
            if (lastMsgTime === 0 || diff > 5 * 60 * 1000) {
                const tsDiv = document.createElement('div');
                tsDiv.className = 'chat-timestamp';
                tsDiv.innerText = formatChatTime(msg.timestamp);
                if (h && document.getElementById('chat-interface').style.display !== 'none') h.appendChild(tsDiv);
                if (isCallActive && callHistory && msg.timestamp >= currentCallStartTime) callHistory.appendChild(tsDiv.cloneNode(true));
                lastMsgTime = msg.timestamp;
            }
        }

        if (msg.isRetracted) {
            const row = document.createElement('div');
            row.className = 'message-row';
            row.style.justifyContent = 'center';
            
            // 添加选择框
            const cb = document.createElement('div');
            cb.className = 'selection-checkbox';
            if (selectedIndices.has(originalIndex)) cb.classList.add('checked');
            row.appendChild(cb);
            
            const retractedDiv = document.createElement('div');
            retractedDiv.className = 'retracted-message-bar';
            const name = msg.role === 'user' ? (currentChatContact.userSettings?.userName || '我') : currentChatContact.name;
            retractedDiv.innerText = `【${name}】撤回了一条消息`;
            row.appendChild(retractedDiv);
            
            if (isSelectionMode) row.onclick = () => toggleSelection(originalIndex);
            
            if (h && document.getElementById('chat-interface').style.display !== 'none') h.appendChild(row);
            if (isCallActive && callHistory && msg.timestamp >= currentCallStartTime) callHistory.appendChild(row.cloneNode(true));
            return; 
        }

        const row = document.createElement('div'); 
        row.className = `message-row ${msg.role === 'user' ? 'user' : 'ai'}`; 
        if (msg.type === 'call_end') { 
            row.className = 'message-row'; 
            row.style.justifyContent = 'center'; 
            const sysMsg = document.createElement('div'); 
            sysMsg.className = 'system-message-bar'; 
            sysMsg.innerText = msg.content; 
            row.appendChild(sysMsg); 
        } else {
            const cb = document.createElement('div'); 
            cb.className = 'selection-checkbox'; 
            if (selectedIndices.has(originalIndex)) cb.classList.add('checked'); 
            row.appendChild(cb); 
            if (msg.role === 'assistant') { 
                const img = document.createElement('img'); 
                img.src = aiAv; 
                img.className = 'chat-avatar-small'; 
                row.appendChild(img); 
            } 
            const bc = document.createElement('div'); 
            bc.className = 'bubble-container'; 
            if (msg.type === 'transfer') { 
                const b = document.createElement('div'); 
                b.className = 'message-bubble transfer-bubble'; 
                let st = "等待确认", ic = "💰"; 
                if (msg.status === 'accepted') { st = "已收款"; ic = "✅"; b.classList.add('accepted'); } 
                if (msg.status === 'rejected') { st = "已退还"; ic = "↩️"; b.classList.add('rejected'); } 
                b.innerHTML = `<div class="transfer-header"><div class="transfer-icon">${ic}</div><div class="transfer-info"><span class="transfer-amount">¥${msg.amount}</span><span class="transfer-status">${st}</span></div></div><div class="transfer-footer">转账备注: ${msg.note || '无'}</div>`; 
                bc.appendChild(b); 
            } else if (msg.type === 'transfer_receipt') { 
                const b = document.createElement('div'); 
                b.className = 'message-bubble transfer-bubble'; 
                if (msg.status === 'rejected') b.classList.add('rejected'); else b.classList.add('accepted'); 
                const title = msg.status === 'accepted' ? "已收款" : "已退还", ic = msg.status === 'accepted' ? "✅" : "↩️", desc = msg.status === 'accepted' ? "已接受您的转账" : "已拒收您的转账"; 
                b.innerHTML = `<div class="transfer-header"><div class="transfer-icon">${ic}</div><div class="transfer-info"><span class="transfer-amount">${title}</span><span class="transfer-status">¥${msg.amount}</span></div></div><div class="transfer-footer">${desc}</div>`; 
                bc.appendChild(b); 
            } else if (msg.type === 'couple_invite_req') {
                const b = document.createElement('div');
                b.className = `message-bubble couple-invite-req`;
                b.innerText = msg.content;
                bc.appendChild(b);
            } else if (msg.type === 'couple_invite_accept') {
                const b = document.createElement('div');
                b.className = `message-bubble couple-invite-accept`;
                b.innerText = msg.content;
                bc.appendChild(b);
            } else if (msg.type === 'couple_invite_reject') {
                const b = document.createElement('div');
                b.className = `message-bubble couple-invite-reject`;
                b.innerText = msg.content;
                bc.appendChild(b);
            } else if (msg.type === 'sticker') {
                const b = document.createElement('div');
                b.className = `message-bubble sticker-bubble ${msg.role === 'user' ? 'user' : 'ai'}`;
                b.innerHTML = `<img src="${msg.stickerUrl}" alt="${msg.stickerDesc}" title="${msg.stickerDesc}">`;
                bc.appendChild(b);
                if (!isSelectionMode) {
                    b.addEventListener('touchstart', () => startLongPress(originalIndex));
                    b.addEventListener('touchend', cancelLongPress);
                    b.addEventListener('mousedown', () => startLongPress(originalIndex));
                    b.addEventListener('mouseup', cancelLongPress);
                    b.addEventListener('contextmenu', e => e.preventDefault());
                }
            } else { 
                const b = document.createElement('div'); 
                b.className = `message-bubble ${msg.role === 'user' ? 'user' : 'ai'}`; 
                if (msg.quote) { 
                    const q = document.createElement('div'); 
                    q.className = 'quote-block-in-msg'; 
                    q.innerText = msg.quote; 
                    b.appendChild(q); 
                } 
                const t = document.createElement('span'); 
                t.innerText = msg.content; 
                b.appendChild(t); 
                bc.appendChild(b);
                if (!isSelectionMode) { 
                    b.addEventListener('touchstart', () => startLongPress(originalIndex)); 
                    b.addEventListener('touchend', cancelLongPress); 
                    b.addEventListener('mousedown', () => startLongPress(originalIndex)); 
                    b.addEventListener('mouseup', cancelLongPress); 
                    b.addEventListener('contextmenu', e => e.preventDefault()); 
                } 
            } 
            row.appendChild(bc); 
            if (msg.role === 'user') { 
                const img = document.createElement('img'); 
                img.src = userAv; 
                img.className = 'chat-avatar-small'; 
                row.appendChild(img); 
            } 
            if (isSelectionMode) row.onclick = () => toggleSelection(originalIndex); 
        }

        if (h && document.getElementById('chat-interface').style.display !== 'none') h.appendChild(row); 
        if (isCallActive && callHistory && msg.timestamp >= currentCallStartTime) callHistory.appendChild(row.cloneNode(true));
    }); 
    
    if (h && !isSelectionMode) {
        if (maintainScroll) {
            // 恢复滚动位置：新的滚动高度 - 旧的滚动高度 + 旧的滚动位置
            // 实际上，当在顶部加载内容时，我们需要保持视口相对于底部内容的相对位置
            // 或者简单地：滚动到 (新高度 - 旧高度) 的位置
            h.scrollTop = h.scrollHeight - oldScrollHeight;
        } else {
            h.scrollTop = h.scrollHeight; 
        }
    }
    if (isCallActive && callHistory) callHistory.scrollTop = callHistory.scrollHeight;

    const offlineHistory = document.getElementById('offline-history'); 
    if (offlineHistory && document.getElementById('offline-mode').classList.contains('active')) { 
        offlineHistory.innerHTML = ''; 
        fullChat.forEach((msg, index) => { 
            if (msg.mode !== 'offline') return; 
            const div = document.createElement('div'); 
            div.className = `offline-msg-block ${msg.role === 'user' ? 'user' : (msg.role === 'system' ? 'system' : 'ai')}`; 
            let content = msg.content; 
            if (msg.role === 'user') { 
                div.innerText = `我：${content}`; 
            } else if (msg.role === 'system') { 
                div.innerText = `[系统] ${content}`; 
            } else { 
                content = content.replace(/\|\|\|/g, '\n\n'); 
                div.innerText = content; 
            } 
            offlineHistory.appendChild(div); 
            
            if (msg.role === 'user' || msg.role === 'assistant') { 
                const actionBar = document.createElement('div'); 
                actionBar.className = 'offline-action-bar'; 
                const editBtn = document.createElement('button'); 
                editBtn.className = 'offline-action-btn'; 
                editBtn.innerText = '编辑'; 
                editBtn.onclick = () => editOfflineMsg(index); 
                actionBar.appendChild(editBtn); 
                const delBtn = document.createElement('button'); 
                delBtn.className = 'offline-action-btn delete'; 
                delBtn.innerText = '删除'; 
                delBtn.onclick = () => deleteOfflineMsg(index); 
                actionBar.appendChild(delBtn); 
                if (msg.role === 'assistant') { 
                    const retryBtn = document.createElement('button'); 
                    retryBtn.className = 'offline-action-btn'; 
                    retryBtn.innerText = '重试'; 
                    retryBtn.onclick = () => retryOfflineMsg(index); 
                    actionBar.appendChild(retryBtn); 
                } 
                if (msg.role === 'assistant') {
                    const continueBtn = document.createElement('button'); 
                    continueBtn.className = 'offline-action-btn'; 
                    continueBtn.innerText = '继续'; 
                    continueBtn.onclick = () => continueOfflineMsg(); 
                    actionBar.appendChild(continueBtn); 
                }
                offlineHistory.appendChild(actionBar); 
            } 
        }); 
        offlineHistory.scrollTop = offlineHistory.scrollHeight; 
    } 
}

let editingOfflineIndex = -1;

function editOfflineMsg(index) { 
    editingOfflineIndex = index;
    const c = DB.getChats(); 
    const msg = c[currentChatContact.id][index]; 
    document.getElementById('offline-edit-textarea').value = msg.content;
    document.getElementById('offline-edit-modal').classList.add('active');
}

function closeOfflineEditModal() {
    document.getElementById('offline-edit-modal').classList.remove('active');
    editingOfflineIndex = -1;
}

function saveOfflineEditedMsg() {
    if (editingOfflineIndex === -1) return;
    const newContent = document.getElementById('offline-edit-textarea').value;
    if (newContent !== null) {
        const c = DB.getChats();
        c[currentChatContact.id][editingOfflineIndex].content = newContent;
        DB.saveChats(c);
        renderChatHistory();
        closeOfflineEditModal();
    }
}

function deleteOfflineMsg(index) { if (confirm("确定删除这条消息吗？")) { const c = DB.getChats(); c[currentChatContact.id].splice(index, 1); DB.saveChats(c); renderChatHistory(); } }
function retryOfflineMsg(index) { if (confirm("删除此回复并重新生成？")) { const c = DB.getChats(); c[currentChatContact.id].splice(index, 1); DB.saveChats(c); renderChatHistory(); triggerAIResponse(); } }
function continueOfflineMsg() { triggerAIResponse(); }
function startLongPress(i) { longPressTimer = setTimeout(() => showContextMenu(i), 600); }
function cancelLongPress() { clearTimeout(longPressTimer); }

function showContextMenu(i) { 
    selectedMessageIndex = i; 
    const chat = DB.getChats()[currentChatContact.id];
    const msg = chat[i];
    const retractBtn = document.getElementById('ctx-retract-btn');
    if (msg.role === 'user' && !msg.isRetracted) {
        retractBtn.style.display = 'block';
    } else {
        retractBtn.style.display = 'none';
    }
    document.getElementById('ctx-overlay').classList.add('active'); 
    document.getElementById('msg-context-menu').classList.add('active'); 
}

function closeContextMenu() { document.getElementById('ctx-overlay').classList.remove('active'); document.getElementById('msg-context-menu').classList.remove('active'); }
function triggerQuote() { const c = DB.getChats()[currentChatContact.id], m = c[selectedMessageIndex]; if (m.type || m.isRetracted) return alert("无法引用"); pendingQuoteContent = m.content; document.getElementById('quote-preview-area').style.display = 'flex'; document.getElementById('quote-preview-content').innerText = pendingQuoteContent; closeContextMenu(); }
function cancelQuote() { pendingQuoteContent = null; document.getElementById('quote-preview-area').style.display = 'none'; }
function triggerEdit() { const c = DB.getChats()[currentChatContact.id], m = c[selectedMessageIndex]; if (m.type || m.isRetracted) return alert("无法编辑"); document.getElementById('edit-msg-textarea').value = m.content; document.getElementById('edit-msg-modal').classList.add('active'); closeContextMenu(); }
function closeEditModal() { document.getElementById('edit-msg-modal').classList.remove('active'); }
function saveEditedMessage() { const n = document.getElementById('edit-msg-textarea').value; if (n) { const c = DB.getChats(); c[currentChatContact.id][selectedMessageIndex].content = n; DB.saveChats(c); renderChatHistory(); closeEditModal(); } }

function triggerRetract() {
    const c = DB.getChats();
    const msg = c[currentChatContact.id][selectedMessageIndex];
    if (msg.role !== 'user') return alert("只能撤回自己的消息");
    if (confirm("确定撤回这条消息吗？")) {
        c[currentChatContact.id][selectedMessageIndex].isRetracted = true;
        DB.saveChats(c);
        renderChatHistory();
        closeContextMenu();
    }
}

function triggerDeleteMode() { closeContextMenu(); isSelectionMode = true; selectedIndices.clear(); document.getElementById('chat-history').classList.add('selection-mode'); document.getElementById('delete-mode-bar').classList.add('active'); renderChatHistory(); }
function exitDeleteMode() { isSelectionMode = false; selectedIndices.clear(); document.getElementById('chat-history').classList.remove('selection-mode'); document.getElementById('delete-mode-bar').classList.remove('active'); renderChatHistory(); }
function toggleSelection(i) { if (selectedIndices.has(i)) selectedIndices.delete(i); else selectedIndices.add(i); renderChatHistory(); }
function confirmDeleteMessages() { if (selectedIndices.size === 0) return exitDeleteMode(); if (confirm(`删除 ${selectedIndices.size} 条？`)) { const c = DB.getChats(); c[currentChatContact.id] = c[currentChatContact.id].filter((_, i) => !selectedIndices.has(i)); DB.saveChats(c); exitDeleteMode(); } }
function saveMessage(role, content, quote = null, thought = null) { const c = DB.getChats(); if (!c[currentChatContact.id]) c[currentChatContact.id] = []; const isOffline = document.getElementById('offline-mode').classList.contains('active'); const mode = isOffline ? 'offline' : 'online'; const o = { role, content, timestamp: Date.now(), mode: mode }; if (quote) o.quote = quote; if (thought) o.thought = thought; c[currentChatContact.id].push(o); DB.saveChats(c); renderChatHistory(); }

function handleEnterKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); 
        sendMessage();
    }
}

function sendMessage() { const isCallActive = document.getElementById('call-screen').classList.contains('active'); const isOfflineActive = document.getElementById('offline-mode').classList.contains('active'); let inputId = 'message-input'; if (isCallActive) inputId = 'call-message-input'; if (isOfflineActive) inputId = 'offline-message-input'; const input = document.getElementById(inputId); const t = input.value.trim(); if (!t) return; saveMessage('user', t, pendingQuoteContent); input.value = ''; cancelQuote(); if (isOfflineActive) { document.getElementById('offline-typing-indicator').style.display = 'block'; triggerAIResponse(); } }
function regenerateLastResponse() { if (!currentChatContact) return; const c = DB.getChats(); let chat = c[currentChatContact.id] || []; if (chat.length === 0) return; let removed = false; while (chat.length > 0 && chat[chat.length - 1].role === 'assistant') { chat.pop(); removed = true; } if (removed) { DB.saveChats(c); renderChatHistory(); triggerAIResponse(); } else alert("最后一条不是AI消息"); }
function continueChat() { triggerAIResponse(); }
let callTimerInterval = null;
let callSeconds = 0;
function startCall() { 
    if (!currentChatContact) return; 
    const settings = DB.getSettings(); 
    if (!settings.key) return alert('请配置 API Key'); 
    currentCallStartTime = Date.now();
    document.getElementById('call-screen').classList.add('active'); 
    document.getElementById('call-avatar').src = currentChatContact.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>'; 
    document.getElementById('call-status').innerText = "对方正在思考中..."; 
    document.getElementById('call-timer').innerText = "00:00"; 
    callSeconds = 0; 
    if (callTimerInterval) clearInterval(callTimerInterval); 
    callTimerInterval = setInterval(() => { callSeconds++; const m = Math.floor(callSeconds / 60).toString().padStart(2, '0'); const s = (callSeconds % 60).toString().padStart(2, '0'); document.getElementById('call-timer').innerText = `${m}:${s}`; }, 1000); 
    triggerCallStartResponse(); 
    renderChatHistory(); 
}
function endCall() { if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; } document.getElementById('call-screen').classList.remove('active'); if (callSeconds > 0 && currentChatContact) { const userName = currentChatContact.userSettings?.userName || "用户"; const c = DB.getChats(); if (!c[currentChatContact.id]) c[currentChatContact.id] = []; c[currentChatContact.id].push({ role: 'system', type: 'call_end', content: `通话已结束，${userName} 已挂断电话`, timestamp: Date.now(), mode: 'online' }); DB.saveChats(c); renderChatHistory(); } callSeconds = 0; }
async function triggerCallStartResponse() { const settings = DB.getSettings(); let systemContent = `${settings.prompt}\n\n[角色信息]\n名字：${currentChatContact.name}\n人设：${currentChatContact.persona}`; const userSettings = currentChatContact.userSettings || {}; if (userSettings.userName) systemContent += `\n\n[用户信息]\n名字：${userSettings.userName}`; systemContent += `\n\n===== 【语音通话接听模式】 =====\n用户刚刚给你拨打了语音电话，你接通了电话。\n请生成一段接听电话时的回复。回复必须包含心声。\n**重要规则**：\n1. 现在是语音通话，请像打电话一样回复。\n2. **严禁**使用 '|||' 分隔消息。\n3. 一次只回复一段话，字数限制在150字以内。\n格式：[THOUGHTS: 心声内容] ||| 你的口语回复。`; const messages = [{ role: "system", content: systemContent }]; try { const temp = settings.temperature !== undefined ? settings.temperature : 0.7; const response = await fetch(`${settings.url}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.key}` }, body: JSON.stringify({ model: settings.model, messages: messages, temperature: temp }) }); const data = await response.json(); if (data.choices && data.choices.length > 0) { let content = data.choices[0].message.content; let extractedThought = null; const thoughtMatch = content.match(/^\[THOUGHTS:(.*?)\]/s); if (thoughtMatch) { extractedThought = thoughtMatch[1].trim(); content = content.replace(thoughtMatch[0], '').trim(); content = content.replace(/^\|\|\|\s*/, '').trim(); } document.getElementById('call-status').innerText = "通话中"; if (content && content.trim()) { saveMessage('assistant', content, null, extractedThought); } } } catch (error) { document.getElementById('call-status').innerText = "连接失败"; alert('通话连接错误: ' + error.message); } }
function openOfflineMode() { if (!currentChatContact) return; document.getElementById('offline-mode').classList.add('active'); const settings = currentChatContact.offlineSettings || {}; if (settings.bg) { document.getElementById('offline-mode').style.backgroundImage = `url(${settings.bg})`; } else { document.getElementById('offline-mode').style.backgroundImage = 'none'; } renderChatHistory(); }
function exitOfflineMode() { document.getElementById('offline-mode').classList.remove('active'); document.getElementById('offline-typing-indicator').style.display = 'none'; closeOfflineSettings(); }
function openOfflineSettings() { 
    const settings = currentChatContact.offlineSettings || { min: 500, max: 700, style: '', bg: '', retell: false, interrupt: false, perspective: 'first_user' }; 
    document.getElementById('offline-min-len').value = settings.min; 
    document.getElementById('offline-max-len').value = settings.max; 
    document.getElementById('offline-style-prompt').value = settings.style; 
    document.getElementById('offline-bg-url').value = settings.bg && settings.bg.startsWith('http') ? settings.bg : ''; 
    
    document.getElementById('offline-retell-yes').classList.toggle('active', settings.retell === true);
    document.getElementById('offline-retell-no').classList.toggle('active', settings.retell !== true);
    
    document.getElementById('offline-interrupt-yes').classList.toggle('active', settings.interrupt === true);
    document.getElementById('offline-interrupt-no').classList.toggle('active', settings.interrupt !== true);
    
    document.getElementById('offline-perspective').value = settings.perspective || 'first_user';
    
    document.getElementById('offline-settings-modal').classList.add('active'); 
    document.getElementById('ctx-overlay').classList.add('active'); 
}

function setOfflineRetell(value) {
    document.getElementById('offline-retell-yes').classList.toggle('active', value === true);
    document.getElementById('offline-retell-no').classList.toggle('active', value !== true);
}

function setOfflineInterrupt(value) {
    document.getElementById('offline-interrupt-yes').classList.toggle('active', value === true);
    document.getElementById('offline-interrupt-no').classList.toggle('active', value !== true);
}
function closeOfflineSettings() { document.getElementById('offline-settings-modal').classList.remove('active'); document.getElementById('ctx-overlay').classList.remove('active'); }
function saveOfflineSettings() { 
    const min = parseInt(document.getElementById('offline-min-len').value) || 500; 
    const max = parseInt(document.getElementById('offline-max-len').value) || 700; 
    const style = document.getElementById('offline-style-prompt').value; 
    const bgUrl = document.getElementById('offline-bg-url').value; 
    const bgFile = document.getElementById('offline-bg-file'); 
    
    const retell = document.getElementById('offline-retell-yes').classList.contains('active');
    const interrupt = document.getElementById('offline-interrupt-yes').classList.contains('active');
    const perspective = document.getElementById('offline-perspective').value;
    
    const processSave = (bgVal) => { 
        let contacts = DB.getContacts(); 
        const i = contacts.findIndex(c => c.id === currentChatContact.id); 
        if (i !== -1) { 
            const oldBg = contacts[i].offlineSettings?.bg || ''; 
            const finalBg = bgVal || oldBg; 
            contacts[i].offlineSettings = { min, max, style, bg: finalBg, retell, interrupt, perspective }; 
            DB.saveContacts(contacts); 
            currentChatContact = contacts[i]; 
            if (finalBg) { 
                document.getElementById('offline-mode').style.backgroundImage = `url(${finalBg})`; 
            } 
        } 
        closeOfflineSettings(); 
    }; 
    if (bgUrl) { 
        processSave(bgUrl); 
    } else if (bgFile.files && bgFile.files[0]) { 
        const reader = new FileReader(); 
        reader.onload = (e) => processSave(e.target.result); 
        reader.readAsDataURL(bgFile.files[0]); 
    } else { 
        processSave(null); 
    } 
}
function toggleThoughts() { const modal = document.getElementById('thoughts-modal'); if (modal.classList.contains('active')) { modal.classList.remove('active'); } else { const chat = DB.getChats()[currentChatContact.id] || []; let lastThought = "暂无心声..."; for (let i = chat.length - 1; i >= 0; i--) { if (chat[i].role === 'assistant' && chat[i].thought) { lastThought = chat[i].thought; break; } } document.getElementById('thoughts-text').innerText = lastThought; modal.classList.add('active'); } }
function calculateChatRounds(history) { let rounds = 0; let hasUser = false; for (const msg of history) { if (msg.role === 'user') { hasUser = true; } else if (msg.role === 'assistant' && hasUser) { rounds++; hasUser = false; } } return rounds; }

function getCalendarContextPrompt() {
    const events = DB.getCalendarEvents();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let context = "";
    if (events[todayStr]) {
        events[todayStr].forEach(ev => {
            if (ev.type === 'anniversary') context += `\n- 今天是纪念日：${ev.title}！请根据人设主动提起并庆祝。`;
            if (ev.type === 'birthday_char') {
                if (currentChatContact && ev.title === currentChatContact.name) {
                    context += `\n- 今天是你的生日！请等待用户祝福或主动暗示。`;
                }
            }
            if (ev.type === 'birthday_user') context += `\n- 今天是用户的生日！请主动送上祝福。`;
            if (ev.type === 'custom') context += `\n- 今天是自定义行程日：${ev.title}。请根据情况提起。`;
        });
    }
    const { periodMap } = calculatePeriodDays(today.getFullYear(), today.getMonth());
    if (periodMap[todayStr] === 'active') {
        context += `\n- [生理期提示] 用户目前正处于生理期中。请表现出关心、体贴，注意她的身体状况。`;
    } else if (periodMap[todayStr] === 'predicted') {
        context += `\n- [生理期提示] 根据推算，用户今天可能处于生理期。请留意她的状态。`;
    } else {
        let futureCheck = new Date(today);
        futureCheck.setDate(today.getDate() + 2);
        const fStr = `${futureCheck.getFullYear()}-${String(futureCheck.getMonth()+1).padStart(2,'0')}-${String(futureCheck.getDate()).padStart(2,'0')}`;
        if (periodMap[fStr] === 'predicted') {
            context += `\n- [生理期提示] 用户的生理期预计将在 2 天后到来。请适当提醒她注意休息，避免生冷。`;
        }
    }
    if (context) {
        return `\n\n===== 【日历事件提醒】 =====${context}\n===========================`;
    }
    return "";
}

async function triggerAIResponse() {
    if (!currentChatContact) return;
    const settings = DB.getSettings();
    if (!settings.key) return alert('请配置 API Key');
    
    const isCallActive = document.getElementById('call-screen').classList.contains('active');
    const isOfflineActive = document.getElementById('offline-mode').classList.contains('active');
    
    if (isCallActive) {
        document.getElementById('call-status').innerText = "对方正在思考中...";
    } else if (!isOfflineActive) {
        document.getElementById('typing-indicator').style.display = 'block';
    }

    // 添加60秒超时保护
    const timeoutId = setTimeout(() => {
        if (isCallActive) {
            document.getElementById('call-status').innerText = "连接超时";
        } else if (isOfflineActive) {
            document.getElementById('offline-typing-indicator').style.display = 'none';
        } else {
            document.getElementById('typing-indicator').style.display = 'none';
        }
        alert('请求超时，请检查网络连接或稍后重试');
    }, 60000);

    let allChats = DB.getChats();
    let history = allChats[currentChatContact.id] || [];
    const userSettings = currentChatContact.userSettings || {};
    const contextLimit = userSettings.contextLimit || 100;
    const autoSummaryEnabled = userSettings.autoSummaryEnabled !== false;
    const summaryInterval = userSettings.summaryInterval || 20;
    const limitedHistory = history.slice(-contextLimit);

    let pendingTransferIndex = -1, pendingTransferAmount = 0, pendingTransferNote = '';
    let pendingInviteIndex = -1;
    
    // 检查是否已经绑定情侣空间
    const coupleData = DB.getCoupleData();
    const isAlreadyCoupled = coupleData.active && coupleData.partnerId == currentChatContact.id;
    
    for (let i = limitedHistory.length - 1; i >= 0; i--) {
        if (limitedHistory[i].type === 'transfer' && limitedHistory[i].status === 'pending') {
            pendingTransferIndex = i; pendingTransferAmount = limitedHistory[i].amount; pendingTransferNote = limitedHistory[i].note;
        }
        // 只有在未绑定情侣空间且最后一条消息是邀请时才处理
        if (!isAlreadyCoupled && i === limitedHistory.length - 1 && limitedHistory[i].type === 'couple_invite_req') {
            pendingInviteIndex = i;
        }
        if (pendingTransferIndex !== -1 || pendingInviteIndex !== -1) break;
    }
    const isTransferEvent = pendingTransferIndex !== -1;
    const isInviteEvent = pendingInviteIndex !== -1;
    const isTimePerceptionEnabled = userSettings.enableTimePerception || false;

    const apiMessages = limitedHistory.map(msg => {
        let content = msg.content;
        if (msg.isRetracted) {
            if (msg.role === 'user') {
                return { role: 'system', content: `[系统提示：用户撤回了一条消息。你虽然看不到内容，但知道用户撤回了。请根据情况做出反应，比如询问"你撤回了什么？"]` };
            } else {
                return { role: 'assistant', content: `[已撤回的消息]` };
            }
        }

        if (isTimePerceptionEnabled && msg.timestamp) { const timeStr = new Date(msg.timestamp).toLocaleString('zh-CN', { hour12: false }); content = `[发送于: ${timeStr}] ${content}`; }
        if (msg.type === 'transfer') return { role: 'user', content: `[用户向你转账 ¥${msg.amount}，备注：${msg.note || '无'}]` };
        if (msg.type === 'transfer_receipt') return { role: 'assistant', content: msg.status === 'accepted' ? `[我已收款 ¥${msg.amount}]` : `[我已拒收并退还 ¥${msg.amount}]` };
        if (msg.type === 'couple_invite_req') return { role: 'user', content: `[用户向你发送了“情侣空间”开通邀请]` };
        if (msg.type === 'couple_invite_accept') return { role: 'assistant', content: `[我已同意你的情侣空间邀请]` };
        if (msg.type === 'couple_invite_reject') return { role: 'assistant', content: `[我已拒绝你的情侣空间邀请]` };
        if (msg.type === 'call_end') return { role: 'system', content: msg.content }; 
        if (msg.type === 'sticker') {
            const stickerDesc = msg.stickerDesc || '表情';
            return { role: msg.role, content: `[图片表情：${stickerDesc}]` };
        }
        return { role: msg.role, content: content };
    });

    let systemContent = `${settings.prompt}\n\n[角色信息]\n名字：${currentChatContact.name}\n人设：${currentChatContact.persona}`;
    if (userSettings.userName || userSettings.userPersona) systemContent += `\n\n[用户信息]\n名字：${userSettings.userName || 'User'}\n人设：${userSettings.userPersona || ''}`;

    const mems = DB.getMemories()[currentChatContact.id] || { important: [], normal: [] };
    if (mems.important.length > 0) { systemContent += `\n\n[⭐ 重要回忆 - 绝对不能遗忘]\n`; mems.important.forEach((m, i) => { systemContent += `${i+1}. ${m.content}\n`; }); }
    const lastUserMsg = limitedHistory.filter(m => m.role === 'user').pop()?.content || "";
    const triggeredMemories = mems.normal.filter(m => m.keywords?.length > 0 && m.keywords.some(kw => lastUserMsg.includes(kw)));
    if (triggeredMemories.length > 0) { systemContent += `\n\n[📝 相关回忆 - 联想触发]\n`; triggeredMemories.forEach((m, i) => { systemContent += `${i+1}. ${m.content}\n`; }); }

    if (isTimePerceptionEnabled) { const nowStr = new Date().toLocaleString('zh-CN', { hour12: false }); systemContent += `\n\n[时间感知模式已开启]\n当前现实时间：${nowStr}\n请注意：\n1. 每一条消息前都标记了发送时间，这仅供你判断时间流逝。\n2. **绝对不要**在回复开头显示时间戳（如 [12:00:00]），直接回复内容即可。\n3. 请根据当前时间判断你的作息（如深夜在睡觉或熬夜，早晨在通勤）。\n4. 观察用户回复的时间间隔。如果用户隔了很久才回，请根据人设做出反应（如吐槽、担心等）。`; }
    if (isTransferEvent) systemContent += `\n\n===== 【转账处理 - 强制格式】 =====\n用户刚刚向你转账 ¥${pendingTransferAmount}，备注：${pendingTransferNote || '无'}。\n你必须按照以下格式回复：\n- 如果你决定【收下】转账，回复必须以 [ACCEPT] 开头\n- 如果你决定【拒收】转账，回复必须以 [REJECT] 开头\n===================================`;
    if (isInviteEvent) systemContent += `\n\n===== 【重要指令：情侣空间邀请处理】 =====\n用户刚刚邀请你开通情侣空间。\n你现在必须做出决定。\n\n请严格遵守以下回复格式（不要包含其他多余分析，直接给出结果）：\n- 同意邀请：必须在回复内容中包含 [ACCEPT_INVITE]\n- 拒绝邀请：必须在回复内容中包含 [REJECT_INVITE]\n\n示例：\n[THOUGHTS: 我好开心...] ||| [ACCEPT_INVITE] 好呀，我也想和你有一个小窝！\n\n注意：如果没有标签，系统将无法识别你的决定，导致开通失败！请务必带上标签！`;

    systemContent += getCalendarContextPrompt();

    const wb = DB.getWorldBook();
    const globalEntries = wb.entries.filter(e => e.type === 'global');
    if (globalEntries.length > 0) { systemContent += `\n\n[世界观设定]\n`; globalEntries.forEach(e => { systemContent += `【${e.title}】：${e.content}\n`; }); }
    const boundIds = currentChatContact.boundWorldBooks || [];
    if (boundIds.length > 0) { systemContent += `\n\n[角色专属设定]\n`; boundIds.forEach(bid => { const entry = wb.entries.find(e => e.id == bid); if (entry) systemContent += `【${entry.title}】：${entry.content}\n`; }); }

    const aiStickerEnabled = document.getElementById('ai-sticker-toggle').checked;
    if (aiStickerEnabled) {
        const stickers = DB.getStickers();
        if (stickers.length > 0) {
            systemContent += `\n\n===== 【表情包功能】 =====\n你可以使用表情包来回复。可用的表情包列表如下：\n`;
            stickers.forEach((sticker, index) => {
                systemContent += `${index + 1}. ${sticker.desc}\n`;
            });
            systemContent += `\n**使用规则**：\n1. 如果你想发送表情包，请在回复中使用格式：[STICKER:表情包描述]\n2. 表情包描述必须完全匹配上述列表中的某一项，不能自创。\n3. 例如：[STICKER:开心] 或 [STICKER:难过]\n4. 表情包可以单独发送，也可以和文字一起发送。\n5. 如果列表中没有合适的表情包，就不要使用表情包功能。\n===========================`;
        }
    }


    if (isCallActive) {
        systemContent += `\n\n===== 【语音通话模式】 =====\n现在你正在和用户进行语音通话。\n**重要规则**：\n1. 请像打电话一样回复，保持口语化。\n2. **严禁**使用 '|||' 分隔消息。\n3. 一次只回复一段话，字数限制在150字以内。\n4. 必须在回复前生成心声。\n格式：[THOUGHTS: 心声] ||| 回复内容`;
    } else if (isOfflineActive) {
        const offSet = currentChatContact.offlineSettings || { min: 500, max: 700, style: '' };
        systemContent += `\n\n===== 【线下见面模式】 =====\n现在你和用户正在线下见面，面对面交流。\n**重要规则**：\n1. **严禁**使用 '|||' 分隔消息。\n2. 请使用小说般的描写手法，包含详细的动作描写、神态描写、环境描写和心理描写。\n3. 字数要求：${offSet.min} - ${offSet.max} 字。\n4. 文风要求：${offSet.style || '细腻、沉浸感强'}\n5. 必须在回复前生成心声。\n格式：[THOUGHTS: 心声] ||| 长篇描写回复内容`;
    } else {
        systemContent += `\n\n===== 【强制回复格式】 =====\n你必须在每次回复的**最开始**生成一段内心独白（心声），展示你此刻真实的心理活动、情绪或对用户的看法。心声必须包裹在 [THOUGHTS: ...] 中，且不超过100字。心声之后，使用 ||| 分隔，然后才是你对用户的实际回复。\n格式示例：\n[THOUGHTS: 他怎么突然问这个？有点害羞...] ||| 呃，这个嘛... ||| 其实我也不太清楚。`;
    }

    const messages = [{ role: "system", content: systemContent }, ...apiMessages];

    try {
        const temp = settings.temperature !== undefined ? settings.temperature : 0.7;
        
        // 使用 AbortController 实现请求超时控制
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 55000); // 55秒后中断请求
        
        const response = await fetch(`${settings.url}/chat/completions`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.key}` }, 
            body: JSON.stringify({ model: settings.model, messages: messages, temperature: temp }),
            signal: controller.signal
        });
        
        clearTimeout(fetchTimeout);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 清除超时定时器
        clearTimeout(timeoutId);
        
        if (isCallActive) {
            document.getElementById('call-status').innerText = "通话中";
        } else if (isOfflineActive) {
            document.getElementById('offline-typing-indicator').style.display = 'none'; 
        } else {
            document.getElementById('typing-indicator').style.display = 'none';
        }
        
        if (!data || !data.choices || data.choices.length === 0) {
            throw new Error('API返回数据格式异常');
        }
        
        if (data.choices && data.choices.length > 0) {
            let content = data.choices[0].message.content;
            

            let extractedThought = null;
            const thoughtMatch = content.match(/^\[THOUGHTS:(.*?)\]/s);
            if (thoughtMatch) {
                extractedThought = thoughtMatch[1].trim();
                content = content.replace(thoughtMatch[0], '').trim();
                content = content.replace(/^\|\|\|\s*/, '').trim();
            }

            if (isTransferEvent) {
                allChats = DB.getChats();
                let receiptStatus = content.match(/^\s*\[ACCEPT\]/i) ? 'accepted' : (content.match(/^\s*\[REJECT\]/i) ? 'rejected' : 'accepted');
                content = content.replace(/^\s*\[(ACCEPT|REJECT)\]\s*/i, '').trim();
                if (allChats[currentChatContact.id]?.[pendingTransferIndex]) allChats[currentChatContact.id][pendingTransferIndex].status = receiptStatus;
                allChats[currentChatContact.id].push({ role: 'assistant', type: 'transfer_receipt', status: receiptStatus, amount: pendingTransferAmount, timestamp: Date.now() });
                DB.saveChats(allChats); renderChatHistory();
            }
            if (isInviteEvent) {
                allChats = DB.getChats();
                
                const acceptMatch = content.match(/\[ACCEPT_INVITE\]/i);
                const rejectMatch = content.match(/\[REJECT_INVITE\]/i);
                
                let inviteStatus = 'rejected';
                
                if (acceptMatch) {
                    inviteStatus = 'accepted';
                    content = content.replace(/\[ACCEPT_INVITE\]/i, '').trim();
                } else if (rejectMatch) {
                    inviteStatus = 'rejected';
                    content = content.replace(/\[REJECT_INVITE\]/i, '').trim();
                } else {
                    const positiveKeywords = ['同意', '答应', '愿意', '好呀', '好的', '没问题', '可以', '开通', '建立', '想和你', '开心'];
                    const negativeKeywords = ['拒绝', '不行', '不要', '不答应', '不愿意', '抱歉', '对不起', '再等等', '考虑', '不想'];
                    
                    let score = 0;
                    positiveKeywords.forEach(kw => { if (content.includes(kw)) score++; });
                    negativeKeywords.forEach(kw => { if (content.includes(kw)) score -= 2; });
                    
                    if (score > 0) inviteStatus = 'accepted';
                }
                
                if (inviteStatus === 'accepted') {
                    const cd = DB.getCoupleData();
                    cd.active = true;
                    cd.partnerId = currentChatContact.id;
                    cd.startTime = Date.now();
                    cd.lastWaterTime = 0;
                    cd.treeLevel = 0;
                    DB.saveCoupleData(cd);
                    
                    allChats[currentChatContact.id].push({ role: 'assistant', type: 'couple_invite_accept', content: '我已同意你的情侣空间邀请', timestamp: Date.now() });
                } else {
                    allChats[currentChatContact.id].push({ role: 'assistant', type: 'couple_invite_reject', content: '我已拒绝你的情侣空间邀请', timestamp: Date.now() });
                }
                DB.saveChats(allChats); renderChatHistory();
            }
            if (content && content.trim()) {
                content = content.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
                
                if (aiStickerEnabled) {
                    const stickerRegex = /\[STICKER:(.*?)\]/g;
                    const stickers = DB.getStickers();
                    
                    content = content.replace(stickerRegex, (match, desc) => {
                        const trimmedDesc = desc.trim();
                        const foundSticker = stickers.find(s => s.desc === trimmedDesc);
                        if (foundSticker) {
                            const c = DB.getChats();
                            if (!c[currentChatContact.id]) c[currentChatContact.id] = [];
                            c[currentChatContact.id].push({
                                role: 'assistant',
                                type: 'sticker',
                                stickerUrl: foundSticker.url,
                                stickerDesc: foundSticker.desc,
                                content: `[表情包：${foundSticker.desc}]`,
                                timestamp: Date.now(),
                                mode: isOfflineActive ? 'offline' : 'online'
                            });
                            DB.saveChats(c);
                            renderChatHistory();
                            return '';
                        }
                        return match;
                    });
                    
                    content = content.trim();
                }
                
                if (isCallActive || isOfflineActive) {
                    if (content) {
                        saveMessage('assistant', content, null, extractedThought);
                    }
                } else {
                    const parts = content.split('|||').filter(p => p.trim());
                    let delay = isTransferEvent ? 500 : 0;
                    parts.forEach((part, index) => { 
                        const clean = part.trim(); 
                        if (clean) { 
                            setTimeout(() => {
                                const isLastPart = index === parts.length - 1;
                                saveMessage('assistant', clean, null, isLastPart ? extractedThought : null);
                            }, delay); 
                            delay += 800; 
                        } 
                    });
                }
                
                if (autoSummaryEnabled) {
                    const updatedHistory = DB.getChats()[currentChatContact.id] || [];
                    const currentRounds = calculateChatRounds(updatedHistory);
                    if (currentRounds > 0 && currentRounds % summaryInterval === 0) {
                        generateSummary(currentChatContact, updatedHistory.slice(-summaryInterval * 4));
                    }
                }
            }
        }
    } catch (error) {
        // 清除超时定时器
        clearTimeout(timeoutId);
        
        if (isCallActive) document.getElementById('call-status').innerText = "连接错误";
        else if (isOfflineActive) document.getElementById('offline-typing-indicator').style.display = 'none';
        else document.getElementById('typing-indicator').style.display = 'none';
        
        // 更详细的错误提示
        let errorMsg = 'Error: ';
        if (error.name === 'AbortError') {
            errorMsg += '请求超时，请检查网络连接';
        } else if (error.message.includes('Failed to fetch')) {
            errorMsg += '网络连接失败，请检查网络设置';
        } else {
            errorMsg += error.message;
        }
        
        console.error('API请求错误详情:', error);
        alert(errorMsg);
    }
}

async function generateSummary(contact, recentMessages) {
    const settings = DB.getSettings(); if (!settings.key) return;
    const msgsText = recentMessages.map(m => { const time = m.timestamp ? new Date(m.timestamp).toLocaleString('zh-CN', {hour12:false}) : "未知时间"; return `[${time}] ${m.role === 'user' ? 'User' : 'Me'}: ${m.content}`; }).join('\n');
    const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
    const prompt = `你现在是 ${contact.name}。请阅读以下你与用户的近期对话记录，并以【第一人称】（我...）总结这段对话中发生的关键事件。要求：1.包含具体时间点。2.提取3-5个关键词。3.如果无重要信息，content返回"无"。4.严格返回JSON格式：{"content":"...","keywords":["..."]}。对话记录：\n${msgsText}\n当前时间：${nowStr}`;
    try {
        const res = await fetch(`${settings.url}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.key}` }, body: JSON.stringify({ model: settings.model, messages: [{ role: "user", content: prompt }], temperature: 0.5 }) });
        const data = await res.json();
        if (data.choices?.length > 0) {
            let raw = data.choices[0].message.content.trim().replace(/```json/g, '').replace(/```/g, '').trim();
            try { const result = JSON.parse(raw); if (result.content && result.content !== "无") { const mems = DB.getMemories(); if (!mems[contact.id]) mems[contact.id] = { important: [], normal: [] }; mems[contact.id].normal.push({ content: result.content, keywords: result.keywords || [] }); DB.saveMemories(mems); console.log("Auto summary generated:", result); } } catch (e) { console.error("JSON parse failed:", e); }
        }
    } catch (e) { console.error("Summary generation failed:", e); }
}

if ('serviceWorker' in navigator) { window.addEventListener('load', function() { navigator.serviceWorker.register('./sw.js').then(r => console.log('SW registered:', r.scope)).catch(e => console.log('SW failed:', e)); }); }

// --- 情书功能已移除，保留入口按钮用于重建 ---

// --- 提问箱功能 ---
let currentQBoxContact = null;

// 提问箱数据方法已移至 DB 对象定义中

// 渲染提问箱联系人列表
function renderQBoxContactList() {
    const list = document.getElementById('qbox-contact-list');
    list.innerHTML = '';
    const contacts = DB.getContacts();
    
    if (contacts.length === 0) {
        list.innerHTML = `
            <div class="qbox-empty">
                <div class="qbox-empty-icon">📮</div>
                <div>暂无联系人</div>
                <div style="font-size:12px; margin-top:5px;">请先在通讯录添加角色</div>
            </div>
        `;
        return;
    }
    
    contacts.forEach(c => {
        const qbData = DB.getQuestionBox()[c.id] || [];
        const qaCount = qbData.length;
        
        const div = document.createElement('div');
        div.className = 'qbox-contact-item';
        div.onclick = () => openQBoxAsk(c);
        div.innerHTML = `
            <img class="qbox-contact-avatar" src="${c.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>'}">
            <div class="qbox-contact-info">
                <div class="qbox-contact-name">${c.name}</div>
                <div class="qbox-contact-desc">${qaCount > 0 ? `${qaCount} 条问答` : '点击进入提问箱'}</div>
            </div>
            <div class="qbox-contact-arrow">›</div>
        `;
        list.appendChild(div);
    });
}

// 打开提问界面
function openQBoxAsk(contact) {
    currentQBoxContact = contact;
    openApp('app-question-box-ask');
    document.getElementById('qbox-ask-title').innerText = contact.name + ' 的提问箱';
    document.getElementById('qbox-question-input').value = '';
    document.getElementById('qbox-anonymous-toggle').checked = false;
    renderQBoxHistory();
}

// 渲染历史问答
function renderQBoxHistory() {
    const list = document.getElementById('qbox-history-list');
    list.innerHTML = '';
    
    if (!currentQBoxContact) return;
    
    const qbData = DB.getQuestionBox()[currentQBoxContact.id] || [];
    
    if (qbData.length === 0) {
        return; // 没有历史记录时不显示任何内容
    }
    
    // 添加标题
    const titleDiv = document.createElement('div');
    titleDiv.className = 'qbox-history-title';
    titleDiv.innerText = '历史问答';
    list.appendChild(titleDiv);
    
    // 按时间倒序显示（最新的在最上面）
    const sortedData = [...qbData].reverse();
    
    sortedData.forEach(qa => {
        const card = document.createElement('div');
        card.className = 'qbox-qa-card';
        
        // 问题区域
        const questionArea = document.createElement('div');
        questionArea.className = 'qbox-question-area';
        
        const fromText = qa.isAnonymous ? '匿名用户' : (currentQBoxContact.userSettings?.userName || '用户');
        
        questionArea.innerHTML = `
            <div class="qbox-question-header">
                <span class="qbox-question-from">来自：${fromText}</span>
                ${qa.isAnonymous ? '<span class="qbox-question-anonymous">匿名</span>' : ''}
            </div>
            <div class="qbox-question-text">${qa.question}</div>
        `;
        
        // 回答区域
        const answerArea = document.createElement('div');
        answerArea.className = 'qbox-answer-area';
        answerArea.innerHTML = `
            <div class="qbox-answer-header">
                <img class="qbox-answer-avatar" src="${currentQBoxContact.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>'}">
                <span class="qbox-answer-name">${currentQBoxContact.name}</span>
            </div>
            <div class="qbox-answer-text">${qa.answer}</div>
        `;
        
        card.appendChild(questionArea);
        card.appendChild(answerArea);
        list.appendChild(card);
    });
}

// 发送提问
async function sendQuestion() {
    if (!currentQBoxContact) return;
    
    const questionInput = document.getElementById('qbox-question-input');
    const question = questionInput.value.trim();
    
    if (!question) {
        alert('请输入问题');
        return;
    }
    
    const settings = DB.getSettings();
    if (!settings.key) {
        alert('请先在设置中配置 API Key');
        return;
    }
    
    const isAnonymous = document.getElementById('qbox-anonymous-toggle').checked;
    
    // 显示加载状态
    document.getElementById('qbox-loading').classList.add('active');
    
    try {
        const answer = await callQuestionBoxAPI(currentQBoxContact, question, isAnonymous);
        
        // 保存问答记录
        const qbData = DB.getQuestionBox();
        if (!qbData[currentQBoxContact.id]) {
            qbData[currentQBoxContact.id] = [];
        }
        
        qbData[currentQBoxContact.id].push({
            id: Date.now(),
            question: question,
            answer: answer,
            isAnonymous: isAnonymous,
            timestamp: Date.now()
        });
        
        DB.saveQuestionBox(qbData);
        
        // 清空输入框
        questionInput.value = '';
        
        // 重新渲染历史记录
        renderQBoxHistory();
        
    } catch (e) {
        alert('获取回答失败：' + e.message);
    } finally {
        document.getElementById('qbox-loading').classList.remove('active');
    }
}

// 调用 API 获取回答
async function callQuestionBoxAPI(contact, question, isAnonymous) {
    const settings = DB.getSettings();
    if (!settings.key) throw new Error('请先配置 API Key');
    
    // 获取用户信息
    const userSettings = contact.userSettings || {};
    const userName = userSettings.userName || '用户';
    const userPersona = userSettings.userPersona || '';
    
    // 构建提示词
    let prompt = `你正在扮演 ${contact.name}。
人设：${contact.persona}

你正在回答提问箱中的问题。`;

    if (isAnonymous) {
        prompt += `

有一位匿名用户向你提出了问题。你不知道对方是谁，请以你的人设和性格来回答这个问题。

问题：${question}`;
    } else {
        prompt += `

${userName} 向你提出了问题。
${userPersona ? `关于 ${userName}：${userPersona}` : ''}

请以你的人设和性格，结合你对 ${userName} 的了解来回答这个问题。

问题：${question}`;
    }

    prompt += `

回答要求：
1. 以第一人称回答。
2. 保持你的人设和性格特点。
3. 回答要自然、真诚，像是真的在回答粉丝或朋友的提问。
4. 字数控制在 50-200 字左右。
5. 严禁返回 JSON 或 Markdown 格式，直接返回回答内容。`;

    const temp = settings.temperature !== undefined ? settings.temperature : 0.7;
    
    const res = await fetch(`${settings.url}/chat/completions`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${settings.key}` 
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [{ role: "user", content: prompt }],
            temperature: temp
        })
    });
    
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
    }
    
    throw new Error("API 无响应");
}

// --- 音乐 App 功能 ---
let musicList = [];
let currentMusicIndex = -1;
let isPlaying = false;
let playMode = 'single'; // 'single' 单曲循环, 'list' 列表播放
let parsedLyrics = [];
let currentLyricIndex = -1;
let isMiniPlayerDragging = false;
let miniPlayerOffset = { x: 0, y: 0 };

// 获取音乐数据
DB.getMusicList = () => {
    const theme = DB.getTheme();
    return theme.musicList || [];
};

DB.saveMusicList = (list) => {
    const theme = DB.getTheme();
    theme.musicList = list;
    DB.saveTheme(theme);
};

// 音乐删除模式变量（必须在renderMusicList之前定义）
let isMusicDeleteMode = false;
let selectedMusicIds = new Set();

// 渲染音乐列表
function renderMusicList() {
    musicList = DB.getMusicList();
    const container = document.getElementById('music-list');
    const emptyState = document.getElementById('music-empty');
    
    container.innerHTML = '';
    
    if (musicList.length === 0) {
        emptyState.style.display = 'block';
        container.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    container.style.display = 'block';
    
    // 按添加时间排序：越早添加的在越下面（时间戳从大到小）
    const sortedList = [...musicList].sort((a, b) => b.timestamp - a.timestamp);
    
    sortedList.forEach((music, index) => {
        // 找到原始索引
        const originalIndex = musicList.findIndex(m => m.id === music.id);
        
        const item = document.createElement('div');
        item.className = 'music-list-item';
        
        // 删除模式下的复选框
        if (isMusicDeleteMode) {
            const checkbox = document.createElement('div');
            checkbox.className = 'music-list-checkbox';
            if (selectedMusicIds.has(music.id)) {
                checkbox.classList.add('checked');
            }
            item.appendChild(checkbox);
            
            item.onclick = () => toggleMusicSelection(music.id);
        } else {
            item.onclick = () => openMusicPlayer(originalIndex);
        }
        
        let coverHtml = '';
        if (music.cover) {
            coverHtml = `<div class="music-list-cover"><img src="${music.cover}" alt="封面"></div>`;
        } else {
            coverHtml = `<div class="music-list-cover">🎵</div>`;
        }
        
        let styleHtml = '';
        if (music.style) {
            styleHtml = `<div class="music-list-style">${music.style}</div>`;
        }
        
        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = `
            ${coverHtml}
            <div class="music-list-info">
                <div class="music-list-title">${music.title}</div>
                <div class="music-list-artist">${music.artist}</div>
                ${styleHtml}
            </div>
        `;
        item.innerHTML += infoDiv.innerHTML;
        
        container.appendChild(item);
    });
}

// 打开添加音乐弹窗
function openAddMusicModal() {
    document.getElementById('add-music-modal').classList.add('active');
    resetAddMusicForm();
}

// 关闭添加音乐弹窗
function closeAddMusicModal() {
    document.getElementById('add-music-modal').classList.remove('active');
}

// 重置添加音乐表单
function resetAddMusicForm() {
    document.getElementById('music-title-input').value = '';
    document.getElementById('music-artist-input').value = '';
    document.getElementById('music-url-input').value = '';
    document.getElementById('music-style-input').value = '';
    document.getElementById('music-cover-url').value = '';
    document.getElementById('music-cover-file').value = '';
    document.getElementById('music-lyrics-input').value = '';
    
    const preview = document.getElementById('music-cover-preview');
    preview.innerHTML = '<span>点击上传封面</span>';
    const previewImg = document.getElementById('music-cover-preview-img');
    previewImg.style.display = 'none';
    previewImg.src = '';
    
    // 重置封面上传标签
    document.getElementById('cover-tab-file').classList.add('active');
    document.getElementById('cover-tab-url').classList.remove('active');
    document.getElementById('cover-file-section').style.display = 'block';
    document.getElementById('cover-url-section').style.display = 'none';
}

// 切换封面上传方式
function switchCoverTab(tab) {
    document.getElementById('cover-tab-file').classList.toggle('active', tab === 'file');
    document.getElementById('cover-tab-url').classList.toggle('active', tab === 'url');
    document.getElementById('cover-file-section').style.display = tab === 'file' ? 'block' : 'none';
    document.getElementById('cover-url-section').style.display = tab === 'url' ? 'block' : 'none';
}

// 预览封面（本地上传）
function previewMusicCover(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewContainer = document.getElementById('music-cover-preview');
            const spanElement = previewContainer.querySelector('span');
            let previewImg = document.getElementById('music-cover-preview-img');
            
            // 如果img元素不存在（被resetAddMusicForm删除了），则创建一个新的
            if (!previewImg) {
                previewImg = document.createElement('img');
                previewImg.id = 'music-cover-preview-img';
                previewImg.style.width = '100%';
                previewImg.style.height = '100%';
                previewImg.style.objectFit = 'cover';
                previewImg.style.borderRadius = '8px';
                previewContainer.appendChild(previewImg);
            }
            
            // 设置图片源并显示
            previewImg.src = e.target.result;
            previewImg.style.display = 'block';
            
            // 隐藏"点击上传封面"文字
            if (spanElement) {
                spanElement.style.display = 'none';
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// 预览封面（URL）
function previewMusicCoverUrl(url) {
    if (url && url.trim()) {
        const previewImg = document.getElementById('music-cover-preview-img');
        previewImg.src = url;
        previewImg.style.display = 'block';
        document.getElementById('music-cover-preview').querySelector('span').style.display = 'none';
    }
}

// 保存新音乐
function saveNewMusic() {
    const title = document.getElementById('music-title-input').value.trim();
    const artist = document.getElementById('music-artist-input').value.trim();
    const url = document.getElementById('music-url-input').value.trim();
    const style = document.getElementById('music-style-input').value.trim();
    const lyrics = document.getElementById('music-lyrics-input').value.trim();
    
    if (!title) {
        alert('请输入音乐标题');
        return;
    }
    
    if (!artist) {
        alert('请输入歌手/制作者');
        return;
    }
    
    // 获取封面
    const getCover = () => {
        return new Promise((resolve) => {
            const urlInput = document.getElementById('music-cover-url').value.trim();
            const fileInput = document.getElementById('music-cover-file');
            
            if (urlInput) {
                resolve(urlInput);
            } else if (fileInput.files && fileInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(fileInput.files[0]);
            } else {
                resolve(null);
            }
        });
    };
    
    getCover().then(cover => {
        const newMusic = {
            id: Date.now(),
            title: title,
            artist: artist,
            url: url,
            style: style,
            cover: cover,
            lyrics: lyrics,
            timestamp: Date.now()
        };
        
        const list = DB.getMusicList();
        list.push(newMusic);
        DB.saveMusicList(list);
        
        closeAddMusicModal();
        renderMusicList();
        
        alert('音乐添加成功！');
    });
}

// 打开音乐播放器
function openMusicPlayer(index) {
    musicList = DB.getMusicList();
    if (index < 0 || index >= musicList.length) return;
    
    currentMusicIndex = index;
    const music = musicList[index];
    
    // 显示播放器
    document.getElementById('music-player-modal').classList.add('active');
    
    // 更新播放器信息
    document.getElementById('music-player-title').innerText = music.title;
    document.getElementById('music-player-artist').innerText = music.artist;
    
    // 更新封面
    const coverImg = document.getElementById('music-player-cover-img');
    if (music.cover) {
        coverImg.src = music.cover;
        coverImg.style.display = 'block';
    } else {
        coverImg.style.display = 'none';
    }
    
    // 解析歌词
    parseLyrics(music.lyrics);
    renderLyrics();
    
    // 加载音频
    const audio = document.getElementById('music-audio');
    if (music.url) {
        audio.src = music.url;
        audio.load();
    }
    
    // 更新菜单歌曲列表
    renderMusicMenuSongs();
    
    // 关闭菜单
    document.getElementById('music-player-menu').classList.remove('active');
}

// 解析LRC歌词
function parseLyrics(lrcText) {
    parsedLyrics = [];
    if (!lrcText) return;
    
    const lines = lrcText.split('\n');
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    
    lines.forEach(line => {
        let match;
        const times = [];
        let text = line;
        
        while ((match = timeRegex.exec(line)) !== null) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const ms = parseInt(match[3].padEnd(3, '0'));
            const time = minutes * 60 + seconds + ms / 1000;
            times.push(time);
            text = text.replace(match[0], '');
        }
        
        text = text.trim();
        if (text && times.length > 0) {
            times.forEach(time => {
                parsedLyrics.push({ time, text });
            });
        }
    });
    
    // 按时间排序
    parsedLyrics.sort((a, b) => a.time - b.time);
}

// 渲染歌词
function renderLyrics() {
    const container = document.getElementById('music-player-lyrics');
    container.innerHTML = '';
    
    if (parsedLyrics.length === 0) {
        container.innerHTML = '<div class="lyrics-line">暂无歌词</div>';
        return;
    }
    
    parsedLyrics.forEach((lyric, index) => {
        const line = document.createElement('div');
        line.className = 'lyrics-line';
        line.id = `lyric-${index}`;
        line.innerText = lyric.text;
        container.appendChild(line);
    });
}

// 更新歌词高亮
function updateLyricHighlight(currentTime) {
    if (parsedLyrics.length === 0) return;
    
    let newIndex = -1;
    for (let i = parsedLyrics.length - 1; i >= 0; i--) {
        if (currentTime >= parsedLyrics[i].time) {
            newIndex = i;
            break;
        }
    }
    
    if (newIndex !== currentLyricIndex) {
        // 移除旧高亮
        if (currentLyricIndex >= 0) {
            const oldLine = document.getElementById(`lyric-${currentLyricIndex}`);
            if (oldLine) oldLine.classList.remove('active');
        }
        
        // 添加新高亮
        if (newIndex >= 0) {
            const newLine = document.getElementById(`lyric-${newIndex}`);
            if (newLine) {
                newLine.classList.add('active');
                // 滚动到当前歌词
                const container = document.getElementById('music-player-lyrics');
                const lineTop = newLine.offsetTop;
                const containerHeight = container.clientHeight;
                container.scrollTop = lineTop - containerHeight / 2 + newLine.clientHeight / 2;
            }
        }
        
        currentLyricIndex = newIndex;
    }
}

// 切换播放/暂停
function toggleMusicPlay() {
    const audio = document.getElementById('music-audio');
    const playBtn = document.getElementById('music-play-btn');
    const cover = document.getElementById('music-player-cover');
    
    if (!audio.src) {
        alert('当前歌曲没有音乐链接');
        return;
    }
    
    if (isPlaying) {
        audio.pause();
        playBtn.innerText = '▶';
        cover.classList.remove('playing');
        isPlaying = false;
        
        // 更新迷你播放器状态
        document.getElementById('music-mini-player').classList.add('paused');
    } else {
        audio.play().then(() => {
            playBtn.innerText = '⏸';
            cover.classList.add('playing');
            isPlaying = true;
            
            // 更新迷你播放器状态
            document.getElementById('music-mini-player').classList.remove('paused');
        }).catch(e => {
            console.error('播放失败:', e);
            alert('播放失败，请检查音乐链接是否有效');
        });
    }
}

// 上一首
function prevMusic() {
    if (musicList.length === 0) return;
    
    let newIndex;
    if (playMode === 'single') {
        // 单曲循环模式下，上一首还是当前歌曲
        newIndex = currentMusicIndex;
    } else {
        // 列表播放模式
        newIndex = currentMusicIndex - 1;
        if (newIndex < 0) newIndex = musicList.length - 1;
    }
    
    openMusicPlayer(newIndex);
    
    // 自动播放
    setTimeout(() => {
        if (isPlaying) {
            const audio = document.getElementById('music-audio');
            audio.play();
        }
    }, 100);
}

// 下一首
function nextMusic() {
    if (musicList.length === 0) return;
    
    let newIndex;
    if (playMode === 'single') {
        // 单曲循环模式下，下一首还是当前歌曲
        newIndex = currentMusicIndex;
    } else {
        // 列表播放模式（从新到旧）
        newIndex = currentMusicIndex + 1;
        if (newIndex >= musicList.length) newIndex = 0;
    }
    
    openMusicPlayer(newIndex);
    
    // 自动播放
    setTimeout(() => {
        if (isPlaying) {
            const audio = document.getElementById('music-audio');
            audio.play();
        }
    }, 100);
}

// 进度条点击
function seekMusic(event) {
    const audio = document.getElementById('music-audio');
    if (!audio.duration) return;
    
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percent = clickX / rect.width;
    
    audio.currentTime = percent * audio.duration;
}

// 格式化时间
function formatMusicTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 切换播放模式
function switchPlayMode(mode) {
    playMode = mode;
    
    document.getElementById('mode-single-check').style.display = mode === 'single' ? 'inline' : 'none';
    document.getElementById('mode-list-check').style.display = mode === 'list' ? 'inline' : 'none';
}

// 切换菜单显示
function toggleMusicMenu() {
    const menu = document.getElementById('music-player-menu');
    menu.classList.toggle('active');
}

// 渲染菜单歌曲列表
function renderMusicMenuSongs() {
    const container = document.getElementById('music-menu-songs');
    container.innerHTML = '';
    
    musicList.forEach((music, index) => {
        const item = document.createElement('div');
        item.className = 'music-menu-song-item';
        if (index === currentMusicIndex) {
            item.classList.add('active');
        }
        
        let coverHtml = '';
        if (music.cover) {
            coverHtml = `<div class="music-menu-song-cover"><img src="${music.cover}"></div>`;
        } else {
            coverHtml = `<div class="music-menu-song-cover">🎵</div>`;
        }
        
        item.innerHTML = `
            ${coverHtml}
            <div class="music-menu-song-info">
                <div class="music-menu-song-title">${music.title}</div>
                <div class="music-menu-song-artist">${music.artist}</div>
            </div>
        `;
        
        item.onclick = () => {
            openMusicPlayer(index);
            toggleMusicMenu();
            
            // 自动播放
            setTimeout(() => {
                const audio = document.getElementById('music-audio');
                audio.play().then(() => {
                    document.getElementById('music-play-btn').innerText = '⏸';
                    document.getElementById('music-player-cover').classList.add('playing');
                    isPlaying = true;
                });
            }, 100);
        };
        
        container.appendChild(item);
    });
}

// 缩小播放器（显示迷你播放器）
function minimizeMusicPlayer() {
    document.getElementById('music-player-modal').classList.remove('active');
    
    // 显示迷你播放器
    const miniPlayer = document.getElementById('music-mini-player');
    miniPlayer.classList.add('active');
    
    // 更新迷你播放器封面
    const music = musicList[currentMusicIndex];
    const miniCover = document.getElementById('mini-player-cover');
    if (music && music.cover) {
        miniCover.src = music.cover;
        miniCover.style.display = 'block';
    } else {
        miniCover.style.display = 'none';
    }
    
    // 更新播放状态
    if (!isPlaying) {
        miniPlayer.classList.add('paused');
    } else {
        miniPlayer.classList.remove('paused');
    }
}

// 音频事件监听
document.addEventListener('DOMContentLoaded', function() {
    const audio = document.getElementById('music-audio');
    
    if (audio) {
        // 时间更新
        audio.addEventListener('timeupdate', function() {
            const currentTime = audio.currentTime;
            const duration = audio.duration;
            
            // 更新进度条
            if (duration) {
                const percent = (currentTime / duration) * 100;
                document.getElementById('music-progress-bar').style.width = percent + '%';
            }
            
            // 更新时间显示
            document.getElementById('music-current-time').innerText = formatMusicTime(currentTime);
            
            // 更新歌词高亮
            updateLyricHighlight(currentTime);
        });
        
        // 加载完成
        audio.addEventListener('loadedmetadata', function() {
            document.getElementById('music-duration').innerText = formatMusicTime(audio.duration);
        });
        
        // 播放结束
        audio.addEventListener('ended', function() {
            if (playMode === 'single') {
                // 单曲循环
                audio.currentTime = 0;
                audio.play();
            } else {
                // 列表播放
                nextMusic();
                setTimeout(() => {
                    audio.play().then(() => {
                        document.getElementById('music-play-btn').innerText = '⏸';
                        document.getElementById('music-player-cover').classList.add('playing');
                        isPlaying = true;
                    });
                }, 100);
            }
        });
        
        // 播放错误
        audio.addEventListener('error', function() {
            console.error('音频加载错误');
        });
    }
    
    // 迷你播放器点击事件
    const miniPlayer = document.getElementById('music-mini-player');
    if (miniPlayer) {
        miniPlayer.addEventListener('click', function(e) {
            if (!isMiniPlayerDragging) {
                // 重新打开播放器
                document.getElementById('music-player-modal').classList.add('active');
                miniPlayer.classList.remove('active');
            }
        });
        
        // 迷你播放器拖动
        miniPlayer.addEventListener('mousedown', startMiniPlayerDrag);
        miniPlayer.addEventListener('touchstart', startMiniPlayerDrag);
    }
});

// 迷你播放器拖动功能
function startMiniPlayerDrag(e) {
    isMiniPlayerDragging = false;
    const miniPlayer = document.getElementById('music-mini-player');
    
    const startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    
    const rect = miniPlayer.getBoundingClientRect();
    miniPlayerOffset.x = startX - rect.left;
    miniPlayerOffset.y = startY - rect.top;
    
    let hasMoved = false;
    
    function onMove(e) {
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        
        const deltaX = Math.abs(clientX - startX);
        const deltaY = Math.abs(clientY - startY);
        
        if (deltaX > 5 || deltaY > 5) {
            hasMoved = true;
            isMiniPlayerDragging = true;
        }
        
        if (hasMoved) {
            const newX = clientX - miniPlayerOffset.x;
            const newY = clientY - miniPlayerOffset.y;
            
            miniPlayer.style.right = 'auto';
            miniPlayer.style.bottom = 'auto';
            miniPlayer.style.left = newX + 'px';
            miniPlayer.style.top = newY + 'px';
        }
    }
    
    function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        
        setTimeout(() => {
            isMiniPlayerDragging = false;
        }, 100);
    }
    
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
}

// 切换音乐删除模式
function toggleMusicDeleteMode() {
    if (isMusicDeleteMode) {
        exitMusicDeleteMode();
    } else {
        enterMusicDeleteMode();
    }
}

// 进入音乐删除模式
function enterMusicDeleteMode() {
    isMusicDeleteMode = true;
    selectedMusicIds.clear();
    document.getElementById('music-list').classList.add('music-delete-mode');
    document.getElementById('music-delete-bar').classList.add('active');
    renderMusicList();
}

// 退出音乐删除模式
function exitMusicDeleteMode() {
    isMusicDeleteMode = false;
    selectedMusicIds.clear();
    const musicListEl = document.getElementById('music-list');
    if (musicListEl) musicListEl.classList.remove('music-delete-mode');
    const deleteBar = document.getElementById('music-delete-bar');
    if (deleteBar) deleteBar.classList.remove('active');
    renderMusicList();
}

// 切换音乐选择
function toggleMusicSelection(musicId) {
    if (selectedMusicIds.has(musicId)) {
        selectedMusicIds.delete(musicId);
    } else {
        selectedMusicIds.add(musicId);
    }
    renderMusicList();
}

// 确认删除选中的音乐
function confirmDeleteMusic() {
    if (selectedMusicIds.size === 0) {
        exitMusicDeleteMode();
        return;
    }
    
    if (confirm(`确定要删除选中的 ${selectedMusicIds.size} 首音乐吗？`)) {
        let list = DB.getMusicList();
        list = list.filter(m => !selectedMusicIds.has(m.id));
        DB.saveMusicList(list);
        exitMusicDeleteMode();
    }
}

// 关闭音乐播放器
function closeMusicPlayer() {
    const audio = document.getElementById('music-audio');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
    
    isPlaying = false;
    document.getElementById('music-player-modal').classList.remove('active');
    document.getElementById('music-mini-player').classList.remove('active');
    document.getElementById('music-player-cover').classList.remove('playing');
    document.getElementById('music-play-btn').innerText = '▶';
    
    // 重置歌词
    currentLyricIndex = -1;
}

// 在 openApp 中添加音乐APP的渲染
const originalOpenAppForMusic = openApp;
openApp = function(appId) {
    originalOpenAppForMusic(appId);
    if (appId === 'app-music') {
        renderMusicList();
    }
};

// --- 交换情书功能 ---
let currentCharLetter = null; // 当前角色情书内容

// 获取情书数据
DB.getLetterBox = () => {
    const cd = DB.getCoupleData();
    return cd.letterBox || [];
};

DB.saveLetterBox = (letterBox) => {
    const cd = DB.getCoupleData();
    cd.letterBox = letterBox;
    DB.saveCoupleData(cd);
};

// 打开交换情书界面
function openLoveLetterView() {
    document.getElementById('couple-main-view').style.display = 'none';
    document.getElementById('couple-letter-view').style.display = 'flex';
    
    // 重置状态
    currentCharLetter = null;
    
    // 显示邀请状态
    document.getElementById('letter-invite-state').style.display = 'flex';
    document.getElementById('letter-loading-state').style.display = 'none';
    document.getElementById('letter-display-area').style.display = 'none';
}

// 关闭交换情书界面
function closeLoveLetterView() {
    document.getElementById('couple-letter-view').style.display = 'none';
    document.getElementById('couple-main-view').style.display = 'flex';
    currentCharLetter = null;
}

// 邀请TA写情书
async function inviteTAWriteLetter() {
    const cd = DB.getCoupleData();
    const contacts = DB.getContacts();
    const partner = contacts.find(c => c.id == cd.partnerId);
    
    if (!partner) {
        alert('找不到伴侣信息');
        return;
    }
    
    const settings = DB.getSettings();
    if (!settings.key) {
        alert('请先在设置中配置 API Key');
        return;
    }
    
    // 显示加载状态
    document.getElementById('letter-invite-state').style.display = 'none';
    document.getElementById('letter-loading-state').style.display = 'flex';
    document.getElementById('letter-display-area').style.display = 'none';
    
    try {
        const letterContent = await callLoveLetterAPI(partner);
        
        if (letterContent) {
            currentCharLetter = {
                content: letterContent,
                timestamp: Date.now()
            };
            
            // 显示情书
            document.getElementById('char-letter-content').innerText = letterContent;
            document.getElementById('letter-loading-state').style.display = 'none';
            document.getElementById('letter-display-area').style.display = 'block';
        }
    } catch (e) {
        alert('生成情书失败：' + e.message);
        document.getElementById('letter-loading-state').style.display = 'none';
        document.getElementById('letter-invite-state').style.display = 'flex';
    }
}

// 调用API生成情书
async function callLoveLetterAPI(partner) {
    const settings = DB.getSettings();
    
    // 获取用户信息
    const userSettings = partner.userSettings || {};
    const userName = userSettings.userName || '亲爱的';
    
    // 获取聊天记录作为参考
    const chatHistory = (DB.getChats()[partner.id] || []).slice(-30).map(m => {
        return `${m.role === 'user' ? 'User' : partner.name}: ${m.content}`;
    }).join('\n');
    
    const prompt = `你正在扮演 ${partner.name}。人设：${partner.persona}

你现在要给恋人 ${userName} 写一封情书。

参考你们最近的聊天记录：
${chatHistory || '（暂无聊天记录）'}

要求：
1. 以第一人称（我）的角色视角写
2. 采用书信格式，开头可以是"亲爱的${userName}："或类似称呼
3. 内容要真诚、有感情，符合你的人设和性格
4. 可以回忆你们之间的甜蜜时刻
5. 可以表达对恋人的爱意和思念
6. 结尾要有落款，如"永远爱你的 ${partner.name}"
7. 字数控制在200-400字
8. 直接返回情书内容，不要加任何格式标记`;

    const temp = settings.temperature !== undefined ? settings.temperature : 0.8;
    
    const res = await fetch(`${settings.url}/chat/completions`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${settings.key}` 
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [{ role: "user", content: prompt }],
            temperature: temp
        })
    });
    
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
    }
    
    throw new Error("API 无响应");
}

// 打开编辑情书界面
function openLetterEditor() {
    if (!currentCharLetter) {
        alert('请先邀请TA写一封情书');
        return;
    }
    
    document.getElementById('couple-letter-editor').style.display = 'flex';
    document.getElementById('love-letter-textarea').value = '';
    document.getElementById('love-letter-textarea').focus();
}

// 关闭编辑情书界面
function closeLetterEditor() {
    document.getElementById('couple-letter-editor').style.display = 'none';
}

// 提交情书交换
function submitLetterExchange() {
    const userLetter = document.getElementById('love-letter-textarea').value.trim();
    
    if (!userLetter) {
        alert('请写下你的情书');
        return;
    }
    
    if (!currentCharLetter) {
        alert('情书数据丢失，请重新邀请TA写情书');
        closeLetterEditor();
        return;
    }
    
    // 保存到收纳箱
    const letterBox = DB.getLetterBox();
    const now = new Date();
    
    letterBox.push({
        id: Date.now(),
        charLetter: currentCharLetter.content,
        charLetterTime: currentCharLetter.timestamp,
        userLetter: userLetter,
        userLetterTime: now.getTime(),
        displayDate: `${now.getMonth() + 1}月${now.getDate()}日`
    });
    
    DB.saveLetterBox(letterBox);
    
    // 重置状态
    currentCharLetter = null;
    
    // 关闭编辑界面
    closeLetterEditor();
    
    // 打开收纳箱
    openLetterBox();
    
    alert('情书交换成功！已收纳到情书收纳箱');
}

// 打开情书收纳箱
function openLetterBox() {
    document.getElementById('couple-letter-view').style.display = 'none';
    document.getElementById('couple-letter-box').style.display = 'flex';
    renderLetterBox();
}

// 关闭情书收纳箱
function closeLetterBox() {
    document.getElementById('couple-letter-box').style.display = 'none';
    document.getElementById('couple-letter-view').style.display = 'flex';
    
    // 重置交换情书界面状态
    document.getElementById('letter-invite-state').style.display = 'flex';
    document.getElementById('letter-loading-state').style.display = 'none';
    document.getElementById('letter-display-area').style.display = 'none';
}

// 渲染情书收纳箱
function renderLetterBox() {
    const container = document.getElementById('letter-box-content');
    const emptyState = document.getElementById('letter-box-empty');
    const letterBox = DB.getLetterBox();
    
    container.innerHTML = '';
    
    if (letterBox.length === 0) {
        emptyState.style.display = 'flex';
        container.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    container.style.display = 'flex';
    
    // 按时间排序：越旧的在下面（时间戳从大到小）
    const sortedLetters = [...letterBox].sort((a, b) => b.userLetterTime - a.userLetterTime);
    
    sortedLetters.forEach((letter, index) => {
        const card = document.createElement('div');
        card.className = 'letter-preview-card';
        card.innerHTML = `
            <div class="letter-preview-date">${letter.displayDate}</div>
            <div class="letter-preview-hint">点击查看</div>
        `;
        card.onclick = () => openLetterDetailModal(letter);
        container.appendChild(card);
    });
}

// 打开情书详情弹窗
function openLetterDetailModal(letter) {
    document.getElementById('letter-detail-modal').classList.add('active');
    document.getElementById('detail-char-letter').innerText = letter.charLetter;
    document.getElementById('detail-user-letter').innerText = letter.userLetter;
}

// 关闭情书详情弹窗
function closeLetterDetailModal() {
    document.getElementById('letter-detail-modal').classList.remove('active');
}

// --- 留言板功能 ---
let isMessageBoardDeleteMode = false;
let selectedMessageIds = new Set();
let currentReplyMessageId = null;

// 获取留言板数据
DB.getCoupleMessages = () => {
    const cd = DB.getCoupleData();
    return cd.messages || [];
};

DB.saveCoupleMessages = (messages) => {
    const cd = DB.getCoupleData();
    cd.messages = messages;
    DB.saveCoupleData(cd);
};

// 打开留言板
function openCoupleMessageBoard() {
    document.getElementById('couple-main-view').style.display = 'none';
    document.getElementById('couple-message-board-view').style.display = 'flex';
    exitMessageBoardDeleteMode();
    renderCoupleMessages();
}

// 关闭留言板
function closeCoupleMessageBoard() {
    document.getElementById('couple-message-board-view').style.display = 'none';
    document.getElementById('couple-main-view').style.display = 'flex';
    exitMessageBoardDeleteMode();
}

// 切换删除模式
function toggleMessageBoardDeleteMode() {
    if (isMessageBoardDeleteMode) {
        exitMessageBoardDeleteMode();
    } else {
        enterMessageBoardDeleteMode();
    }
}

function enterMessageBoardDeleteMode() {
    isMessageBoardDeleteMode = true;
    selectedMessageIds.clear();
    document.getElementById('message-board-list').classList.add('message-board-delete-mode');
    document.getElementById('message-board-delete-bar').classList.add('active');
    renderCoupleMessages(true);
}

function exitMessageBoardDeleteMode() {
    isMessageBoardDeleteMode = false;
    selectedMessageIds.clear();
    document.getElementById('message-board-list').classList.remove('message-board-delete-mode');
    document.getElementById('message-board-delete-bar').classList.remove('active');
    renderCoupleMessages(true);
}

function toggleMessageSelection(msgId) {
    if (selectedMessageIds.has(msgId)) {
        selectedMessageIds.delete(msgId);
    } else {
        selectedMessageIds.add(msgId);
    }
    renderCoupleMessages(true);
}

function confirmDeleteMessagesBoard() {
    if (selectedMessageIds.size === 0) {
        exitMessageBoardDeleteMode();
        return;
    }
    
    if (confirm(`确定要删除选中的 ${selectedMessageIds.size} 条留言吗？`)) {
        let messages = DB.getCoupleMessages();
        messages = messages.filter(m => !selectedMessageIds.has(m.id));
        DB.saveCoupleMessages(messages);
        exitMessageBoardDeleteMode();
    }
}

// 渲染留言板
function renderCoupleMessages(maintainScroll = false) {
    const list = document.getElementById('message-board-list');
    const previousScrollTop = list.scrollTop;
    const messages = DB.getCoupleMessages();
    
    list.innerHTML = '';
    
    // 按时间排序：越旧的留言位置越下 -> 新的在上面，旧的在下面 -> 时间戳从大到小
    // 等等，通常 "越旧的在下面" 意味着是一个堆栈，新的堆在上面？
    // 或者是指像普通列表一样，往下滚是旧的？
    // 让我们再读一遍："越旧的留言位置越下"。
    // 如果屏幕上方是 Top，下方是 Bottom。
    // Old -> Bottom. New -> Top.
    // 所以排序应该是：Newest (Top) -> Oldest (Bottom).
    // timestamp: Big (New) -> Small (Old).
    const sortedMessages = [...messages].sort((a, b) => b.timestamp - a.timestamp);
    
    const contacts = DB.getContacts();
    const cd = DB.getCoupleData();
    const partner = contacts.find(c => c.id == cd.partnerId);
    
    // 获取用户头像
    let userAvatar = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23007aff%22 width=%22100%22 height=%22100%22/></svg>';
    if (partner && partner.userSettings && partner.userSettings.userAvatar) {
        userAvatar = partner.userSettings.userAvatar;
    }
    
    // 获取TA头像
    let partnerAvatar = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>';
    if (partner && partner.avatar) {
        partnerAvatar = partner.avatar;
    }
    
    // 获取TA名字
    const partnerName = partner ? partner.name : "TA";

    sortedMessages.forEach(msg => {
        const item = document.createElement('div');
        item.className = 'message-board-item';
        
        // 删除复选框
        const checkbox = document.createElement('div');
        checkbox.className = 'message-board-checkbox';
        if (selectedMessageIds.has(msg.id)) {
            checkbox.classList.add('checked');
        }
        item.appendChild(checkbox);
        
        const date = new Date(msg.timestamp);
        const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
        const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        
        const avatarSrc = msg.isTaMessage ? partnerAvatar : userAvatar;
        
        let html = `
            <div class="message-board-header">
                <img src="${avatarSrc}" class="message-board-avatar">
                <div class="message-board-info">
                    <span class="message-board-date">${dateStr}</span>
                    <span class="message-board-time">${timeStr}</span>
                </div>
            </div>
            <div class="message-board-content">${msg.content}</div>
        `;
        
        // 显示TA的回复 (如果不是TA发的留言)
        if (!msg.isTaMessage && msg.taReply) {
            html += `<div class="message-board-reply-area"><div class="message-board-reply-label">❤️ ${partnerName}的回复：</div>${msg.taReply}</div>`;
        }
        
        // 如果是TA发的留言，显示回复按钮或用户的回复
        if (msg.isTaMessage) {
            if (msg.userReply) {
                html += `<div class="message-board-user-reply">${msg.userReply}</div>`;
                if (msg.taReplyToUser) {
                    html += `<div class="message-board-reply-area"><div class="message-board-reply-label">❤️ ${partnerName}的回复：</div>${msg.taReplyToUser}</div>`;
                }
            } else {
                html += `<div class="message-board-reply-btn" onclick="openReplyMessageModal(${msg.id})">回复TA</div>`;
            }
        }
        
        item.innerHTML += html;
        
        item.onclick = (e) => {
            if (isMessageBoardDeleteMode) {
                toggleMessageSelection(msg.id);
            } else {
                // 如果点击的是回复按钮，阻止冒泡
                if (e.target.classList.contains('message-board-reply-btn')) {
                    e.stopPropagation();
                }
            }
        };
        
        list.appendChild(item);
    });
    
    // 自动滚动到底部
    if (maintainScroll) {
        list.scrollTop = previousScrollTop;
    } else {
        list.scrollTop = list.scrollHeight;
    }
}

// 打开添加留言弹窗
function openAddMessageModal() {
    document.getElementById('add-message-modal').classList.add('active');
    document.getElementById('message-board-input').value = '';
}

// 关闭添加留言弹窗
function closeAddMessageModal() {
    document.getElementById('add-message-modal').classList.remove('active');
}

// 保存新留言
async function saveNewMessage() {
    const content = document.getElementById('message-board-input').value.trim();
    if (!content) return alert("请输入留言内容");
    
    const messages = DB.getCoupleMessages();
    const newMessage = {
        id: Date.now(),
        content: content,
        timestamp: Date.now(),
        isTaMessage: false,
        taReply: null
    };
    
    messages.push(newMessage);
    DB.saveCoupleMessages(messages);
    
    closeAddMessageModal();
    renderCoupleMessages();
    
    // 触发API生成回复
    const cd = DB.getCoupleData();
    const contacts = DB.getContacts();
    const partner = contacts.find(c => c.id == cd.partnerId);
    
    if (partner) {
        try {
            const reply = await callMessageBoardAPI(partner, 'reply_to_user', content);
            if (reply) {
                const msgs = DB.getCoupleMessages();
                const target = msgs.find(m => m.id === newMessage.id);
                if (target) {
                    target.taReply = reply;
                    DB.saveCoupleMessages(msgs);
                    renderCoupleMessages();
                }
            }
        } catch (e) {
            console.error("生成回复失败", e);
        }
    }
}

// 打开回复弹窗
function openReplyMessageModal(msgId) {
    currentReplyMessageId = msgId;
    const messages = DB.getCoupleMessages();
    const msg = messages.find(m => m.id === msgId);
    
    if (!msg) return;
    
    document.getElementById('reply-target-content').innerText = "回复TA：" + msg.content;
    document.getElementById('reply-message-modal').classList.add('active');
    document.getElementById('reply-message-input').value = '';
}

// 关闭回复弹窗
function closeReplyMessageModal() {
    document.getElementById('reply-message-modal').classList.remove('active');
    currentReplyMessageId = null;
}

// 保存回复
async function saveReplyMessage() {
    if (!currentReplyMessageId) return;
    
    const content = document.getElementById('reply-message-input').value.trim();
    if (!content) return alert("请输入回复内容");
    
    const messages = DB.getCoupleMessages();
    const msgIndex = messages.findIndex(m => m.id === currentReplyMessageId);
    
    if (msgIndex !== -1) {
        messages[msgIndex].userReply = content;
        DB.saveCoupleMessages(messages);
        
        closeReplyMessageModal();
        renderCoupleMessages();
        
        // 触发API生成TA对用户回复的回复
        const cd = DB.getCoupleData();
        const contacts = DB.getContacts();
        const partner = contacts.find(c => c.id == cd.partnerId);
        
        if (partner) {
            try {
                const reply = await callMessageBoardAPI(partner, 'reply_to_reply', content, messages[msgIndex].content);
                if (reply) {
                    const msgs = DB.getCoupleMessages();
                    const target = msgs.find(m => m.id === currentReplyMessageId);
                    if (target) {
                        target.taReplyToUser = reply;
                        DB.saveCoupleMessages(msgs);
                        renderCoupleMessages();
                    }
                }
            } catch (e) {
                console.error("生成回复失败", e);
            }
        }
    }
}

// 邀请TA留言
async function inviteTAMessage() {
    const cd = DB.getCoupleData();
    const contacts = DB.getContacts();
    const partner = contacts.find(c => c.id == cd.partnerId);
    
    if (!partner) return alert("找不到伴侣信息");
    
    const settings = DB.getSettings();
    if (!settings.key) return alert("请先配置 API Key");
    
    if (!confirm("邀请TA来留言板写几句？")) return;
    
    alert("TA正在思考中...");
    
    try {
        const result = await callMessageBoardAPI(partner, 'invite');
        if (result && Array.isArray(result)) {
            const messages = DB.getCoupleMessages();
            result.forEach(content => {
                messages.push({
                    id: Date.now() + Math.random(),
                    content: content,
                    timestamp: Date.now(),
                    isTaMessage: true,
                    userReply: null,
                    taReplyToUser: null
                });
            });
            DB.saveCoupleMessages(messages);
            renderCoupleMessages();
            alert("TA留下了新的留言！");
        }
    } catch (e) {
        alert("邀请失败：" + e.message);
    }
}

// 留言板 API 调用
async function callMessageBoardAPI(partner, type, userContent = '', contextContent = '') {
    const settings = DB.getSettings();
    let prompt = "";
    
    if (type === 'reply_to_user') {
        prompt = `你正在扮演 ${partner.name}。人设：${partner.persona}
        
        你的恋人（用户）在情侣空间留言板上写了一条留言：
        "${userContent}"
        
        请给这条留言写一条回复（评论）。
        
        要求：
        1. 50字以内。
        2. 语气自然、符合人设。
        3. 直接返回内容，不要JSON。`;
    } else if (type === 'invite') {
        prompt = `你正在扮演 ${partner.name}。人设：${partner.persona}
        
        恋人邀请你在情侣空间留言板上写几句留言。
        
        请生成 1 到 3 条留言。
        
        要求：
        1. 每条留言 50 字以内。
        2. 内容可以是日常分享、情话、碎碎念等。
        3. 严格返回 JSON 字符串数组格式：["留言1", "留言2"]`;
    } else if (type === 'reply_to_reply') {
        prompt = `你正在扮演 ${partner.name}。人设：${partner.persona}
        
        你在留言板上写了："${contextContent}"
        你的恋人回复了你："${userContent}"
        
        请对恋人的回复进行回应。
        
        要求：
        1. 50字以内。
        2. 语气自然、符合人设。
        3. 直接返回内容，不要JSON。`;
    }
    
    const temp = settings.temperature !== undefined ? settings.temperature : 0.8;
    const res = await fetch(`${settings.url}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.key}` },
        body: JSON.stringify({
            model: settings.model,
            messages: [{ role: "user", content: prompt }],
            temperature: temp
        })
    });
    
    const data = await res.json();
    if (data.choices && data.choices.length > 0) {
        let content = data.choices[0].message.content.trim();
        
        if (type === 'invite') {
            content = content.replace(/```json/g, '').replace(/```/g, '').trim();
            try {
                return JSON.parse(content);
            } catch (e) {
                console.error("JSON parse failed", e);
                return [content]; // Fallback
            }
        }
        
        return content;
    }
    throw new Error("API 无响应");
}

// 在 openApp 函数中添加提问箱的渲染
const originalOpenApp = openApp;
openApp = function(appId) {
    originalOpenApp(appId);
    if (appId === 'app-question-box') {
        renderQBoxContactList();
    }
};

// --- 论坛功能 ---
let currentForumTab = 'following';
let currentEditingPostId = null;
let isForumDeleteMode = false;
let selectedForumPostIds = new Set();

// 获取论坛数据
DB.getForumData = () => {
    const theme = DB.getTheme();
    return theme.forumData || { settings: { systemPrompt: '' }, posts: [] };
};

DB.saveForumData = (data) => {
    const theme = DB.getTheme();
    theme.forumData = data;
    DB.saveTheme(theme);
};

// 切换论坛标签
function switchForumTab(tab) {
    currentForumTab = tab;
    document.getElementById('forum-tab-following').classList.toggle('active', tab === 'following');
    document.getElementById('forum-tab-recommended').classList.toggle('active', tab === 'recommended');
    renderForumPosts();
}

// 渲染论坛帖子
function renderForumPosts() {
    const container = document.getElementById('forum-posts-container');
    const forumData = DB.getForumData();
    const posts = forumData.posts || [];
    
    container.innerHTML = '';
    
    // 按时间倒序排列
    const sortedPosts = [...posts].sort((a, b) => b.timestamp - a.timestamp);
    
    // 根据当前标签过滤
    const filteredPosts = sortedPosts.filter(post => {
        if (currentForumTab === 'following') {
            return post.type === 'character';
        } else {
            return post.type === 'passerby';
        }
    });
    
    if (filteredPosts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #999; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 15px;">📝</div>
                <div style="font-size: 16px;">暂无帖子</div>
                <div style="font-size: 13px; margin-top: 8px; opacity: 0.7;">点击右上角加号生成帖子</div>
            </div>
        `;
        return;
    }
    
    filteredPosts.forEach(post => {
        const postEl = document.createElement('div');
        postEl.className = 'forum-post';
        
        // 选择框
        const checkbox = document.createElement('div');
        checkbox.className = 'forum-post-checkbox';
        if (selectedForumPostIds.has(post.id)) {
            checkbox.classList.add('checked');
        }
        postEl.appendChild(checkbox);
        
        // 格式化时间
        const date = new Date(post.timestamp);
        const timeStr = `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        
        // 头像
        let avatarHtml = '';
        if (post.avatar) {
            avatarHtml = `<div class="forum-post-avatar"><img src="${post.avatar}"></div>`;
        } else {
            const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const initial = post.username.charAt(0).toUpperCase();
            avatarHtml = `<div class="forum-post-avatar" style="background: ${color};">${initial}</div>`;
        }
        
        let contentHtml = `
            <div class="forum-post-header">
                ${avatarHtml}
                <div class="forum-post-info">
                    <div class="forum-post-username">${post.username}</div>
                    <div class="forum-post-time">${timeStr}</div>
                </div>
                <div class="forum-post-menu" onclick="openForumPostMenu(${post.id})">⋯</div>
            </div>
            <div class="forum-post-content">${post.content}</div>
        `;
        
        // 如果有图片描述
        if (post.imageDesc) {
            contentHtml += `<div class="forum-post-image-desc">${post.imageDesc}</div>`;
        }
        
        postEl.innerHTML += contentHtml;
        
        // 点击事件
        if (isForumDeleteMode) {
            postEl.onclick = () => toggleForumPostSelection(post.id);
        }
        
        container.appendChild(postEl);
    });
}

// 打开帖子菜单
function openForumPostMenu(postId) {
    currentEditingPostId = postId;
    document.getElementById('forum-action-sheet').classList.add('active');
}

// 关闭 Action Sheet
function closeForumActionSheet() {
    document.getElementById('forum-action-sheet').classList.remove('active');
    currentEditingPostId = null;
}

// 处理编辑操作
function handleForumEditAction() {
    if (!currentEditingPostId) return;
    openForumEditModal(currentEditingPostId);
    document.getElementById('forum-action-sheet').classList.remove('active');
}

// 处理删除操作
function handleForumDeleteAction() {
    if (!currentEditingPostId) return;
    if (confirm('确定要删除这条帖子吗？')) {
        const forumData = DB.getForumData();
        forumData.posts = forumData.posts.filter(p => p.id !== currentEditingPostId);
        DB.saveForumData(forumData);
        renderForumPosts();
    }
    closeForumActionSheet();
}

// 删除单条帖子
function deleteForumPost(postId) {
    if (!confirm('确定要删除这条帖子吗？')) return;
    
    const forumData = DB.getForumData();
    forumData.posts = forumData.posts.filter(p => p.id !== postId);
    DB.saveForumData(forumData);
    renderForumPosts();
}

// 打开设置弹窗
function openForumSettings() {
    const forumData = DB.getForumData();
    document.getElementById('forum-system-prompt').value = forumData.settings?.systemPrompt || '';
    renderForumBindCharacters();
    document.getElementById('forum-settings-modal').classList.add('active');
}

// 渲染论坛绑定角色列表
function renderForumBindCharacters() {
    const container = document.getElementById('forum-bind-characters');
    const contacts = DB.getContacts();
    const forumData = DB.getForumData();
    const boundCharacters = forumData.settings?.boundCharacters || [];
    
    container.innerHTML = '';
    
    if (contacts.length === 0) {
        container.innerHTML = '<div style="padding: 10px; color: #999; font-size: 12px;">暂无联系人</div>';
        return;
    }
    
    contacts.forEach(contact => {
        const isChecked = boundCharacters.includes(contact.id.toString());
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #333;';
        item.innerHTML = `
            <input type="checkbox" id="forum-bind-char-${contact.id}" value="${contact.id}" ${isChecked ? 'checked' : ''} style="margin-right: 10px;">
            <label for="forum-bind-char-${contact.id}" style="flex: 1; cursor: pointer; color: #fff;">${contact.name}</label>
        `;
        container.appendChild(item);
    });
}

// 关闭设置弹窗
function closeForumSettings() {
    document.getElementById('forum-settings-modal').classList.remove('active');
}

// 保存论坛设置
function saveForumSettings() {
    const systemPrompt = document.getElementById('forum-system-prompt').value.trim();
    const boundCharacters = [...document.querySelectorAll('#forum-bind-characters input:checked')].map(cb => cb.value);
    
    const forumData = DB.getForumData();
    forumData.settings = { 
        systemPrompt: systemPrompt,
        boundCharacters: boundCharacters
    };
    DB.saveForumData(forumData);
    closeForumSettings();
    alert('论坛设置已保存');
}

// 清空所有帖子
function clearAllForumPosts() {
    if (!confirm('确定要清空所有帖子吗？（不包括用户自己发的帖）')) return;
    
    const forumData = DB.getForumData();
    forumData.posts = [];
    DB.saveForumData(forumData);
    renderForumPosts();
    closeForumSettings();
    alert('所有帖子已清空');
}

// 打开添加帖子弹窗
function openForumAddModal() {
    document.getElementById('forum-add-modal').classList.add('active');
}

// 关闭添加帖子弹窗
function closeForumAddModal() {
    document.getElementById('forum-add-modal').classList.remove('active');
}

// 生成论坛帖子
async function generateForumPosts(type) {
    const settings = DB.getSettings();
    if (!settings.key) {
        alert('请先在设置中配置 API Key');
        return;
    }
    
    // 如果是角色帖子，检查是否有绑定的角色
    if (type === 'character') {
        const forumData = DB.getForumData();
        const boundCharacters = forumData.settings?.boundCharacters || [];
        
        if (boundCharacters.length === 0) {
            alert('请先在论坛设置中绑定角色');
            return;
        }
    }
    
    closeForumAddModal();
    alert('正在生成帖子，请稍候...');
    
    try {
        const posts = await callForumAPI(type);
        if (posts && posts.length > 0) {
            const forumData = DB.getForumData();
            posts.forEach(postData => {
                forumData.posts.push({
                    id: Date.now() + Math.random(),
                    type: type,
                    username: postData.username,
                    avatar: postData.avatar || null,
                    content: postData.content,
                    imageDesc: postData.imageDesc || null,
                    timestamp: Date.now()
                });
            });
            DB.saveForumData(forumData);
            renderForumPosts();
            alert(`成功生成 ${posts.length} 条帖子！`);
        }
    } catch (e) {
        alert('生成失败：' + e.message);
    }
}

// 调用API生成帖子
async function callForumAPI(type) {
    const settings = DB.getSettings();
    const forumData = DB.getForumData();
    const systemPrompt = forumData.settings?.systemPrompt || '这是一个普通的论坛';
    
    let prompt = '';
    
    if (type === 'character') {
        // 角色帖子
        const contacts = DB.getContacts();
        if (contacts.length === 0) {
            throw new Error('请先在通讯录添加角色');
        }
        
        const contact = contacts[0]; // 使用第一个联系人
        
        prompt = `你正在扮演 ${contact.name}。人设：${contact.persona}

论坛设定：${systemPrompt}

请生成 5-10 条你在这个论坛上发布的帖子。

要求：
1. 以第一人称（我）发帖
2. 每条帖子不超过100字
3. 内容符合你的人设和性格
4. 至少生成1条带图帖子（不需要真实图片，只生成图片描述）
5. 严格返回JSON数组格式：
[
  {
    "content": "帖子文本内容",
    "imageDesc": "图片描述（可选，如果没有图则为 null）"
  }
]`;
        
        const temp = settings.temperature !== undefined ? settings.temperature : 0.8;
        const res = await fetch(`${settings.url}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.key}` },
            body: JSON.stringify({
                model: settings.model,
                messages: [{ role: "user", content: prompt }],
                temperature: temp
            })
        });
        
        const data = await res.json();
        if (data.choices && data.choices.length > 0) {
            let content = data.choices[0].message.content.trim();
            content = content.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const postsData = JSON.parse(content);
            return postsData.map(p => ({
                username: contact.name,
                avatar: contact.avatar,
                content: p.content,
                imageDesc: p.imageDesc
            }));
        }
    } else {
        // 路人帖子
        prompt = `论坛设定：${systemPrompt}

请生成 4-8 条路人在这个论坛上发布的帖子。

要求：
1. 随机生成网名
2. 每条帖子不超过100字
3. 为了增加真实感，允许出现各种发言，包括但不限于：
   - 分享生活
   - 提问
   - 杠精/喷子发言
   - 负面情绪言论
   - 吐槽抱怨
   - 炫耀
   - 求助
4. 至少生成1条带图帖子（不需要真实图片，只生成图片描述）
5. 严格返回JSON数组格式：
[
  {
    "username": "随机网名",
    "content": "帖子文本内容",
    "imageDesc": "图片描述（可选，如果没有图则为 null）"
  }
]`;
        
        const temp = settings.temperature !== undefined ? settings.temperature : 0.9;
        const res = await fetch(`${settings.url}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.key}` },
            body: JSON.stringify({
                model: settings.model,
                messages: [{ role: "user", content: prompt }],
                temperature: temp
            })
        });
        
        const data = await res.json();
        if (data.choices && data.choices.length > 0) {
            let content = data.choices[0].message.content.trim();
            content = content.replace(/```json/g, '').replace(/```/g, '').trim();
            
            return JSON.parse(content);
        }
    }
    
    throw new Error('API 无响应');
}

// 打开编辑帖子弹窗
function openForumEditModal(postId) {
    currentEditingPostId = postId;
    const forumData = DB.getForumData();
    const post = forumData.posts.find(p => p.id === postId);
    
    if (!post) return;
    
    document.getElementById('forum-edit-textarea').value = post.content;
    document.getElementById('forum-edit-modal').classList.add('active');
}

// 关闭编辑帖子弹窗
function closeForumEditModal() {
    document.getElementById('forum-edit-modal').classList.remove('active');
    currentEditingPostId = null;
}

// 保存编辑后的帖子
function saveForumPostEdit() {
    if (!currentEditingPostId) return;
    
    const newContent = document.getElementById('forum-edit-textarea').value.trim();
    if (!newContent) {
        alert('帖子内容不能为空');
        return;
    }
    
    const forumData = DB.getForumData();
    const post = forumData.posts.find(p => p.id === currentEditingPostId);
    
    if (post) {
        post.content = newContent;
        DB.saveForumData(forumData);
        renderForumPosts();
        closeForumEditModal();
        alert('帖子已更新');
    }
}

// 进入删除模式
function enterForumDeleteMode() {
    isForumDeleteMode = true;
    selectedForumPostIds.clear();
    document.getElementById('forum-posts-container').classList.add('forum-delete-mode');
    document.getElementById('forum-delete-bar').classList.add('active');
    renderForumPosts();
}

// 退出删除模式
function exitForumDeleteMode() {
    isForumDeleteMode = false;
    selectedForumPostIds.clear();
    document.getElementById('forum-posts-container').classList.remove('forum-delete-mode');
    document.getElementById('forum-delete-bar').classList.remove('active');
    renderForumPosts();
}

// 切换帖子选择
function toggleForumPostSelection(postId) {
    if (selectedForumPostIds.has(postId)) {
        selectedForumPostIds.delete(postId);
    } else {
        selectedForumPostIds.add(postId);
    }
    renderForumPosts();
}

// 确认删除选中的帖子
function confirmDeleteForumPosts() {
    if (selectedForumPostIds.size === 0) {
        exitForumDeleteMode();
        return;
    }
    
    if (confirm(`确定要删除选中的 ${selectedForumPostIds.size} 条帖子吗？`)) {
        const forumData = DB.getForumData();
        forumData.posts = forumData.posts.filter(p => !selectedForumPostIds.has(p.id));
        DB.saveForumData(forumData);
        exitForumDeleteMode();
    }
}

// 在 openApp 函数中添加论坛的渲染
const originalOpenAppForForum = openApp;
openApp = function(appId) {
    originalOpenAppForForum(appId);
    if (appId === 'app-forum') {
        renderForumPosts();
    }
};

// --- 角色手机美化功能 ---
let currentSpyThemeType = 'color';

function switchSpyThemeType(type) {
    currentSpyThemeType = type;
    document.getElementById('spy-theme-type-color').classList.toggle('active', type === 'color');
    document.getElementById('spy-theme-type-image').classList.toggle('active', type === 'image');
    document.getElementById('spy-theme-input-color').style.display = type === 'color' ? 'block' : 'none';
    document.getElementById('spy-theme-input-image').style.display = type === 'image' ? 'block' : 'none';
}

function saveSpyWallpaper() {
    if (!currentSpyContact) return;
    const sd = DB.getSpyData();
    if (!sd[currentSpyContact.id]) sd[currentSpyContact.id] = {};
    if (!sd[currentSpyContact.id].theme) sd[currentSpyContact.id].theme = {};

    const processSave = (val) => {
        sd[currentSpyContact.id].theme.wallpaperType = currentSpyThemeType;
        sd[currentSpyContact.id].theme.wallpaperValue = val;
        DB.saveSpyData(sd);
        applySpyTheme();
        alert('壁纸已保存');
    };

    if (currentSpyThemeType === 'color') {
        processSave(document.getElementById('spy-theme-wallpaper-color').value);
    } else {
        const urlInput = document.getElementById('spy-theme-wallpaper-url').value;
        const fileInput = document.getElementById('spy-theme-wallpaper-image');
        if (urlInput) {
            processSave(urlInput);
        } else if (fileInput.files && fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => processSave(e.target.result);
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            if (sd[currentSpyContact.id].theme.wallpaperType === 'image' && sd[currentSpyContact.id].theme.wallpaperValue) {
                processSave(sd[currentSpyContact.id].theme.wallpaperValue);
            } else {
                alert('请选择图片');
            }
        }
    }
}

function saveSpyAppIcon() {
    if (!currentSpyContact) return;
    const appId = document.getElementById('spy-theme-app-select').value;
    const urlInput = document.getElementById('spy-theme-icon-url').value;
    const fileInput = document.getElementById('spy-theme-icon-file');

    const processIconSave = (imgData) => {
        const sd = DB.getSpyData();
        if (!sd[currentSpyContact.id]) sd[currentSpyContact.id] = {};
        if (!sd[currentSpyContact.id].theme) sd[currentSpyContact.id].theme = {};
        if (!sd[currentSpyContact.id].theme.appIcons) sd[currentSpyContact.id].theme.appIcons = {};
        
        sd[currentSpyContact.id].theme.appIcons[appId] = imgData;
        DB.saveSpyData(sd);
        applySpyTheme();
        alert('图标已更新');
    };

    if (urlInput) {
        processIconSave(urlInput);
    } else if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => processIconSave(e.target.result);
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        alert('请选择图片或输入URL');
    }
}

function resetSpyTheme() {
    if (!currentSpyContact) return;
    if (!confirm("确定要重置此角色的手机美化吗？")) return;
    
    const sd = DB.getSpyData();
    if (sd[currentSpyContact.id]) {
        delete sd[currentSpyContact.id].theme;
        DB.saveSpyData(sd);
    }
    applySpyTheme();
    alert("角色手机美化已重置");
}

function applySpyTheme() {
    if (!currentSpyContact) return;
    const sd = DB.getSpyData();
    const theme = (sd[currentSpyContact.id] && sd[currentSpyContact.id].theme) || { wallpaperType: 'color', wallpaperValue: '#ffffff' };
    
    currentSpyThemeType = theme.wallpaperType || 'color';
    switchSpyThemeType(currentSpyThemeType);
    
    if (theme.wallpaperType === 'color') {
        document.getElementById('spy-theme-wallpaper-color').value = theme.wallpaperValue || '#ffffff';
    } else {
        if (theme.wallpaperValue && theme.wallpaperValue.startsWith('http')) {
            document.getElementById('spy-theme-wallpaper-url').value = theme.wallpaperValue;
        } else {
             document.getElementById('spy-theme-wallpaper-url').value = '';
        }
    }

    const spyHome = document.getElementById('app-spy-home');
    if (theme.wallpaperType === 'image' && theme.wallpaperValue) {
        spyHome.style.backgroundImage = `url(${theme.wallpaperValue})`;
        spyHome.style.backgroundSize = 'cover';
        spyHome.style.backgroundPosition = 'center';
        spyHome.style.backgroundColor = 'transparent';
    } else {
        spyHome.style.backgroundImage = 'none';
        spyHome.style.backgroundColor = theme.wallpaperValue || '#ffffff';
    }
    
    const spyAppIds = ['spy-icon-vk', 'spy-icon-memos', 'spy-icon-browser', 'spy-icon-diary', 'spy-icon-settings'];
    const spyAppNames = {'spy-icon-vk': 'Vkontakte', 'spy-icon-memos': '备忘录', 'spy-icon-browser': '浏览器', 'spy-icon-diary': '日记', 'spy-icon-settings': '设置'};
    
    spyAppIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.background = '';
            el.style.backgroundColor = '';
            el.style.backgroundImage = '';
            el.innerHTML = '';
            
            if (theme.appIcons && theme.appIcons[id]) {
                el.style.background = 'none';
                el.style.backgroundColor = 'transparent';
                el.style.backgroundImage = `url(${theme.appIcons[id]})`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
                el.innerHTML = `<div class="app-label">${spyAppNames[id]}</div>`;
            } else {
                let emoji = '';
                let bgColor = '';
                let color = '#fff';
                let label = spyAppNames[id];
                
                switch(id) {
                    case 'spy-icon-vk': emoji = 'VK'; bgColor = ''; color = ''; break;
                    case 'spy-icon-memos': emoji = '📝'; bgColor = '#f1c40f'; color = '#000'; break;
                    case 'spy-icon-browser': emoji = '🌐'; bgColor = '#007aff'; color = '#fff'; break;
                    case 'spy-icon-diary': emoji = '📔'; bgColor = '#8e44ad'; color = '#fff'; break;
                    case 'spy-icon-settings': emoji = '⚙️'; bgColor = '#8e8e93'; color = '#fff'; break;
                }
                
                if (id === 'spy-icon-vk') {
                    el.removeAttribute('style');
                    el.innerHTML = `VK<div class="app-label">Vkontakte</div>`;
                } else {
                    el.style.backgroundColor = bgColor;
                    el.style.color = color;
                    el.innerHTML = `${emoji}<div class="app-label">${label}</div>`;
                }
            }
        }
    });
}

// --- 恋爱相册功能 ---
let currentViewingPhotoIndex = -1;
let currentUploadTab = 'file';
let tempPhotoData = null;
let isAlbumDeleteMode = false;
let selectedPhotoIds = new Set();

// 获取相册数据
DB.getAlbumData = () => {
    const cd = DB.getCoupleData();
    return cd.album || [];
};

DB.saveAlbumData = (albumData) => {
    const cd = DB.getCoupleData();
    cd.album = albumData;
    DB.saveCoupleData(cd);
};

// 打开恋爱相册
function openCoupleAlbum() {
    document.getElementById('couple-main-view').style.display = 'none';
    document.getElementById('couple-album-view').style.display = 'flex';
    exitAlbumDeleteMode();
    renderAlbumPhotos();
}

// 关闭恋爱相册
function closeCoupleAlbum() {
    document.getElementById('couple-album-view').style.display = 'none';
    document.getElementById('couple-main-view').style.display = 'flex';
    exitAlbumDeleteMode();
}

// 切换删除模式
function toggleAlbumDeleteMode() {
    if (isAlbumDeleteMode) {
        exitAlbumDeleteMode();
    } else {
        enterAlbumDeleteMode();
    }
}

function enterAlbumDeleteMode() {
    isAlbumDeleteMode = true;
    selectedPhotoIds.clear();
    document.getElementById('album-photos-container').classList.add('album-delete-mode');
    document.getElementById('album-delete-bar').classList.add('active');
    renderAlbumPhotos();
}

function exitAlbumDeleteMode() {
    isAlbumDeleteMode = false;
    selectedPhotoIds.clear();
    document.getElementById('album-photos-container').classList.remove('album-delete-mode');
    document.getElementById('album-delete-bar').classList.remove('active');
    renderAlbumPhotos();
}

function togglePhotoSelection(photoId) {
    if (selectedPhotoIds.has(photoId)) {
        selectedPhotoIds.delete(photoId);
    } else {
        selectedPhotoIds.add(photoId);
    }
    renderAlbumPhotos();
}

function confirmDeletePhotos() {
    if (selectedPhotoIds.size === 0) {
        exitAlbumDeleteMode();
        return;
    }
    
    if (confirm(`确定要删除选中的 ${selectedPhotoIds.size} 张照片吗？`)) {
        let albumData = DB.getAlbumData();
        albumData = albumData.filter(p => !selectedPhotoIds.has(p.id));
        DB.saveAlbumData(albumData);
        exitAlbumDeleteMode();
    }
}

// 渲染相册照片
function renderAlbumPhotos() {
    const container = document.getElementById('album-photos-container');
    const emptyState = document.getElementById('album-empty');
    const albumData = DB.getAlbumData();
    
    container.innerHTML = '';
    
    if (albumData.length === 0) {
        emptyState.style.display = 'flex';
        container.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    container.style.display = 'flex';
    
    // 按时间倒序排列（最新的在最上面）
    const sortedPhotos = [...albumData].sort((a, b) => b.timestamp - a.timestamp);
    
    sortedPhotos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'album-photo-item';
        
        // 找到原始索引
        const originalIndex = albumData.findIndex(p => p.id === photo.id);
        
        // 选择框
        const checkbox = document.createElement('div');
        checkbox.className = 'album-photo-checkbox';
        if (selectedPhotoIds.has(photo.id)) {
            checkbox.classList.add('checked');
        }
        item.appendChild(checkbox);
        
        if (photo.imageUrl) {
            // 有真实图片
            const img = document.createElement('img');
            img.src = photo.imageUrl;
            img.alt = "照片";
            item.appendChild(img);
            
            if (photo.isCharPhoto) {
                const badge = document.createElement('div');
                badge.className = 'album-photo-badge';
                badge.innerText = 'TA拍的';
                item.appendChild(badge);
            }
        } else {
            // 只有描述（角色拍的照片）
            item.classList.add('text-photo');
            const textDiv = document.createElement('div');
            textDiv.className = 'album-photo-text';
            textDiv.innerText = photo.description;
            item.appendChild(textDiv);
            
            const badge = document.createElement('div');
            badge.className = 'album-photo-badge';
            badge.innerText = 'TA拍的';
            item.appendChild(badge);
        }
        
        item.onclick = () => {
            if (isAlbumDeleteMode) {
                togglePhotoSelection(photo.id);
            } else {
                openViewPhotoModal(originalIndex);
            }
        };
        container.appendChild(item);
    });
}

// 打开添加照片弹窗
function openAddPhotoModal() {
    document.getElementById('add-photo-modal').classList.add('active');
    resetAddPhotoForm();
}

// 关闭添加照片弹窗
function closeAddPhotoModal() {
    document.getElementById('add-photo-modal').classList.remove('active');
    resetAddPhotoForm();
}

// 重置添加照片表单
function resetAddPhotoForm() {
    currentUploadTab = 'file';
    tempPhotoData = null;
    
    document.getElementById('upload-tab-file').classList.add('active');
    document.getElementById('upload-tab-url').classList.remove('active');
    document.getElementById('upload-file-section').style.display = 'block';
    document.getElementById('upload-url-section').style.display = 'none';
    
    document.getElementById('photo-file-input').value = '';
    document.getElementById('photo-url-input').value = '';
    document.getElementById('photo-description').value = '';
    document.getElementById('photo-user-comment').value = '';
    
    const filePreview = document.getElementById('photo-file-preview');
    filePreview.innerHTML = '<span>点击选择图片</span>';
    filePreview.classList.remove('has-image');
    
    const urlPreview = document.getElementById('photo-url-preview');
    urlPreview.innerHTML = '';
    urlPreview.classList.remove('has-image');
}

// 切换上传方式
function switchUploadTab(tab) {
    currentUploadTab = tab;
    
    document.getElementById('upload-tab-file').classList.toggle('active', tab === 'file');
    document.getElementById('upload-tab-url').classList.toggle('active', tab === 'url');
    document.getElementById('upload-file-section').style.display = tab === 'file' ? 'block' : 'none';
    document.getElementById('upload-url-section').style.display = tab === 'url' ? 'block' : 'none';
}

// 预览本地文件
function previewPhotoFile(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            tempPhotoData = e.target.result;
            const preview = document.getElementById('photo-file-preview');
            preview.innerHTML = `<img src="${e.target.result}">`;
            preview.classList.add('has-image');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// 点击文件预览区域
document.addEventListener('DOMContentLoaded', function() {
    const filePreview = document.getElementById('photo-file-preview');
    if (filePreview) {
        filePreview.onclick = () => {
            document.getElementById('photo-file-input').click();
        };
    }
});

// 预览URL图片
function previewPhotoUrl(url) {
    const preview = document.getElementById('photo-url-preview');
    if (url && url.trim()) {
        tempPhotoData = url.trim();
        preview.innerHTML = `<img src="${url}" onerror="this.parentElement.classList.remove('has-image')">`;
        preview.classList.add('has-image');
    } else {
        preview.innerHTML = '';
        preview.classList.remove('has-image');
        tempPhotoData = null;
    }
}

// 保存新照片
function saveNewPhoto() {
    const description = document.getElementById('photo-description').value.trim();
    const userComment = document.getElementById('photo-user-comment').value.trim();
    
    if (!description) {
        alert('请填写照片描述');
        return;
    }
    
    // 获取图片数据
    let imageUrl = null;
    if (currentUploadTab === 'file' && tempPhotoData) {
        imageUrl = tempPhotoData;
    } else if (currentUploadTab === 'url') {
        const urlInput = document.getElementById('photo-url-input').value.trim();
        if (urlInput) {
            imageUrl = urlInput;
        }
    }
    
    // 创建照片对象
    const newPhoto = {
        id: Date.now(),
        imageUrl: imageUrl,
        description: description,
        userComment: userComment || null,
        charComment: null,
        isCharPhoto: false,
        timestamp: Date.now()
    };
    
    // 保存到数据库
    const albumData = DB.getAlbumData();
    albumData.push(newPhoto);
    DB.saveAlbumData(albumData);
    
    // 关闭弹窗并刷新
    closeAddPhotoModal();
    renderAlbumPhotos();
}

// 打开照片查看弹窗
function openViewPhotoModal(index) {
    currentViewingPhotoIndex = index;
    const albumData = DB.getAlbumData();
    const photo = albumData[index];
    
    if (!photo) return;
    
    document.getElementById('view-photo-modal').classList.add('active');
    
    // 显示照片或描述
    const photoContainer = document.getElementById('view-photo-container');
    if (photo.imageUrl) {
        photoContainer.innerHTML = `<img src="${photo.imageUrl}">`;
    } else {
        photoContainer.innerHTML = `<div class="album-view-photo-text">${photo.description}</div>`;
    }
    
    // 显示描述
    document.getElementById('view-photo-description').innerText = photo.description;
    
    // 显示用户评论
    const userCommentEl = document.getElementById('view-photo-user-comment');
    if (photo.userComment) {
        userCommentEl.innerText = photo.userComment;
        userCommentEl.classList.add('has-content');
    } else {
        userCommentEl.innerText = '';
        userCommentEl.classList.remove('has-content');
    }
    
    // 显示角色评论
    const charCommentEl = document.getElementById('view-photo-char-comment');
    if (photo.charComment) {
        charCommentEl.innerText = photo.charComment;
        charCommentEl.classList.add('has-content');
    } else {
        charCommentEl.innerText = '';
        charCommentEl.classList.remove('has-content');
    }
    
    // 更新按钮状态
    const commentBtn = document.getElementById('invite-comment-btn');
    const loadingEl = document.getElementById('comment-loading');
    
    if (photo.charComment) {
        commentBtn.style.display = 'none';
    } else {
        commentBtn.style.display = 'flex';
    }
    loadingEl.classList.remove('active');
}

// 关闭照片查看弹窗
function closeViewPhotoModal() {
    document.getElementById('view-photo-modal').classList.remove('active');
    currentViewingPhotoIndex = -1;
}

// 邀请TA来评论
async function invitePhotoComment() {
    if (currentViewingPhotoIndex === -1) return;
    
    const cd = DB.getCoupleData();
    const contacts = DB.getContacts();
    const partner = contacts.find(c => c.id == cd.partnerId);
    
    if (!partner) {
        alert('找不到伴侣信息');
        return;
    }
    
    const settings = DB.getSettings();
    if (!settings.key) {
        alert('请先在设置中配置 API Key');
        return;
    }
    
    const albumData = DB.getAlbumData();
    const photo = albumData[currentViewingPhotoIndex];
    
    // 显示加载状态
    document.getElementById('invite-comment-btn').style.display = 'none';
    document.getElementById('comment-loading').classList.add('active');
    
    try {
        const comment = await callPhotoCommentAPI(partner, photo);
        
        if (comment) {
            // 保存评论
            albumData[currentViewingPhotoIndex].charComment = comment;
            DB.saveAlbumData(albumData);
            
            // 更新显示
            const charCommentEl = document.getElementById('view-photo-char-comment');
            charCommentEl.innerText = comment;
            charCommentEl.classList.add('has-content');
        }
    } catch (e) {
        alert('获取评论失败：' + e.message);
        document.getElementById('invite-comment-btn').style.display = 'flex';
    } finally {
        document.getElementById('comment-loading').classList.remove('active');
    }
}

// 调用API获取照片评论
async function callPhotoCommentAPI(partner, photo) {
    const settings = DB.getSettings();
    
    let prompt = `你正在扮演 ${partner.name}。人设：${partner.persona}

你和恋人正在一起看恋爱相册中的一张照片。

照片描述：${photo.description}`;

    if (photo.userComment) {
        prompt += `

恋人对这张照片的评论：${photo.userComment}`;
    }

    prompt += `

请根据照片描述${photo.userComment ? '和恋人的评论' : ''}，以第一人称发表你对这张照片的看法和评论。

要求：
1. 保持你的人设和性格特点
2. 评论要真诚、有感情
3. 可以回忆相关的甜蜜时刻
4. 最多不超过100字
5. 直接返回评论内容，不要加任何格式`;

    const temp = settings.temperature !== undefined ? settings.temperature : 0.8;
    
    const res = await fetch(`${settings.url}/chat/completions`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${settings.key}` 
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [{ role: "user", content: prompt }],
            temperature: temp
        })
    });
    
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
    }
    
    throw new Error("API 无响应");
}

// 邀请TA来添加照片
async function inviteAddPhotos() {
    const cd = DB.getCoupleData();
    const contacts = DB.getContacts();
    const partner = contacts.find(c => c.id == cd.partnerId);
    
    if (!partner) {
        alert('找不到伴侣信息');
        return;
    }
    
    const settings = DB.getSettings();
    if (!settings.key) {
        alert('请先在设置中配置 API Key');
        return;
    }
    
    if (!confirm('邀请TA添加2-5张照片到相册？')) return;
    
    // 关闭添加照片弹窗
    closeAddPhotoModal();
    
    // 显示加载提示
    alert('TA正在拍照中，请稍候...');
    
    try {
        const photos = await callAddPhotosAPI(partner);
        
        if (photos && photos.length > 0) {
            // 保存照片
            const albumData = DB.getAlbumData();
            photos.forEach(photoDesc => {
                albumData.push({
                    id: Date.now() + Math.random(),
                    imageUrl: null, // 角色拍的照片没有真实图片
                    description: photoDesc,
                    userComment: null,
                    charComment: null,
                    isCharPhoto: true,
                    timestamp: Date.now()
                });
            });
            DB.saveAlbumData(albumData);
            
            // 刷新相册
            renderAlbumPhotos();
            
            alert(`TA添加了 ${photos.length} 张照片到相册！`);
        }
    } catch (e) {
        alert('添加照片失败：' + e.message);
    }
}

// 调用API生成角色拍摄的照片
async function callAddPhotosAPI(partner) {
    const settings = DB.getSettings();
    
    // 获取聊天记录作为参考
    const chatHistory = (DB.getChats()[partner.id] || []).slice(-20).map(m => {
        return `${m.role === 'user' ? 'User' : partner.name}: ${m.content}`;
    }).join('\n');
    
    const prompt = `你正在扮演 ${partner.name}。人设：${partner.persona}

你和恋人正在使用情侣空间的"恋爱相册"功能。现在恋人邀请你添加一些照片到相册。

请生成 2-5 张你"拍摄"的照片。注意：这不是真实照片，而是你对照片内容的描述。

参考你们最近的聊天记录：
${chatHistory || '（暂无聊天记录）'}

要求：
1. 每张照片描述要生动、有画面感
2. 可以是你们一起的合照、你拍的风景、你的自拍、你拍的美食等
3. 内容要符合你的人设和性格
4. 每张照片描述不超过100字
5. 严格返回JSON数组格式：["照片1描述", "照片2描述", ...]`;

    const temp = settings.temperature !== undefined ? settings.temperature : 0.8;
    
    const res = await fetch(`${settings.url}/chat/completions`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${settings.key}` 
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [{ role: "user", content: prompt }],
            temperature: temp
        })
    });
    
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.choices && data.choices.length > 0) {
        let content = data.choices[0].message.content.trim();
        // 清理可能的markdown格式
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        try {
            const photos = JSON.parse(content);
            if (Array.isArray(photos)) {
                return photos.slice(0, 5); // 最多5张
            }
        } catch (e) {
            console.error('JSON parse failed:', e);
            throw new Error('解析照片数据失败');
        }
    }
    
    throw new Error("API 无响应");
}
