/* 提问箱功能 JavaScript */

let currentQBContact = null;

// 打开提问箱联系人列表
function openQuestionBox() {
    openApp('app-question-box');
    renderQBContactList();
}

// 渲染联系人列表
function renderQBContactList() {
    const list = document.getElementById('qb-contact-list');
    list.innerHTML = '';
    
    const contacts = DB.getContacts();
    
    if (contacts.length === 0) {
        list.innerHTML = '<div class="qb-empty">暂无联系人，请先在通讯录添加角色</div>';
        return;
    }
    
    contacts.forEach(contact => {
        const div = document.createElement('div');
        div.className = 'qb-contact-item';
        div.onclick = () => openQBInput(contact);
        
        div.innerHTML = `
            <img src="${contact.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>'}" alt="${contact.name}">
            <div class="qb-contact-info">
                <div class="qb-contact-name">${contact.name}</div>
                <div class="qb-contact-desc">点击进入TA的提问箱</div>
            </div>
        `;
        
        list.appendChild(div);
    });
}

// 打开提问输入界面
function openQBInput(contact) {
    currentQBContact = contact;
    openApp('app-question-input');
    document.getElementById('qb-input-title').innerText = contact.name + '的提问箱';
    document.getElementById('qb-textarea').value = '';
    document.getElementById('qb-anonymous-check').checked = false;
    renderQBHistory();
}

// 发送提问
async function sendQuestion() {
    if (!currentQBContact) return;
    
    const textarea = document.getElementById('qb-textarea');
    const question = textarea.value.trim();
    
    if (!question) {
        return alert('请输入问题');
    }
    
    const isAnonymous = document.getElementById('qb-anonymous-check').checked;
    const settings = DB.getSettings();
    
    if (!settings.key) {
        return alert('请先在设置中配置 API Key');
    }
    
    // 显示加载状态
    const sendBtn = document.getElementById('qb-send-btn');
    const originalText = sendBtn.innerText;
    sendBtn.innerText = '正在提问...';
    sendBtn.disabled = true;
    
    try {
        // 调用 API 获取角色回答
        const answer = await getCharacterAnswer(question, isAnonymous);
        
        // 保存提问和回答
        const qbData = DB.getQuestionBoxData();
        if (!qbData[currentQBContact.id]) {
            qbData[currentQBContact.id] = [];
        }
        
        qbData[currentQBContact.id].unshift({
            id: Date.now(),
            question: question,
            answer: answer,
            isAnonymous: isAnonymous,
            timestamp: Date.now()
        });
        
        DB.saveQuestionBoxData(qbData);
        
        // 清空输入框
        textarea.value = '';
        document.getElementById('qb-anonymous-check').checked = false;
        
        // 刷新历史列表
        renderQBHistory();
        
        alert('提问成功！');
        
    } catch (error) {
        alert('提问失败：' + error.message);
    } finally {
        sendBtn.innerText = originalText;
        sendBtn.disabled = false;
    }
}

// 获取角色回答
async function getCharacterAnswer(question, isAnonymous) {
    const settings = DB.getSettings();
    const contact = currentQBContact;
    
    // 构建 prompt
    let systemPrompt = `你正在扮演 ${contact.name}。人设：${contact.persona}\n\n`;
    
    if (isAnonymous) {
        systemPrompt += `现在有一个匿名陌生人向你提问。你不知道对方是谁。\n`;
    } else {
        const userSettings = contact.userSettings || {};
        const userName = userSettings.userName || '用户';
        const userPersona = userSettings.userPersona || '';
        
        systemPrompt += `现在是用户向你提问。\n`;
        systemPrompt += `用户名称：${userName}\n`;
        if (userPersona) {
            systemPrompt += `用户人设：${userPersona}\n`;
        }
    }
    
    systemPrompt += `\n问题：${question}\n\n`;
    systemPrompt += `请以你的角色视角回答这个问题。回答要符合你的人设，自然、真实。字数控制在 100-300 字之间。\n`;
    systemPrompt += `直接返回回答内容，不要包含任何格式标记或前缀。`;
    
    const temp = settings.temperature !== undefined ? settings.temperature : 0.7;
    
    const response = await fetch(`${settings.url}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.key}`
        },
        body: JSON.stringify({
            model: settings.model,
            messages: [
                { role: 'system', content: systemPrompt }
            ],
            temperature: temp
        })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
    }
    
    throw new Error('API 返回数据异常');
}

// 渲染历史提问列表
function renderQBHistory() {
    const container = document.getElementById('qb-history-list');
    container.innerHTML = '';
    
    const qbData = DB.getQuestionBoxData();
    const history = qbData[currentQBContact.id] || [];
    
    if (history.length === 0) {
        return;
    }
    
    const title = document.createElement('div');
    title.className = 'qb-history-title';
    title.innerText = '历史提问';
    container.appendChild(title);
    
    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'qb-history-item';
        
        const timeStr = new Date(item.timestamp).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        div.innerHTML = `
            <div class="qb-question-section">
                <div class="qb-question-header">
                    <span class="qb-question-status ${item.isAnonymous ? 'anonymous' : ''}">
                        ${item.isAnonymous ? '匿名提问' : '实名提问'}
                    </span>
                    <span class="qb-question-time">${timeStr}</span>
                </div>
                <div class="qb-question-content">${item.question}</div>
            </div>
            <div class="qb-answer-section">
                <div class="qb-answer-header">
                    <img class="qb-answer-avatar" src="${currentQBContact.avatar || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ccc%22 width=%22100%22 height=%22100%22/></svg>'}" alt="${currentQBContact.name}">
                    <span class="qb-answer-name">${currentQBContact.name}</span>
                </div>
                <div class="qb-answer-content">${item.answer}</div>
            </div>
        `;
        
        container.appendChild(div);
    });
}

// 添加数据库方法
if (typeof DB !== 'undefined') {
    DB.getQuestionBoxData = () => JSON.parse(localStorage.getItem('iphone_question_box')) || {};
    DB.saveQuestionBoxData = (data) => localStorage.setItem('iphone_question_box', JSON.stringify(data));
}
