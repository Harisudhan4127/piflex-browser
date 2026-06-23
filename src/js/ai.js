// ==========================================================
// PiFlex AI & Ollama Assistant Integration (Version 1.2.0)
// ==========================================================

class AiAssistant {
    constructor() {
        this.chatHistory = this.loadChatHistory();
        this.sidebarEl = document.getElementById('aiSidebar');
        this.toggleBtn = document.getElementById('aiToggleBtn');
        this.closeBtn = document.getElementById('closeAiSidebar');
        this.chatMessagesEl = document.getElementById('aiChatMessages');
        this.chatInputEl = document.getElementById('aiChatInput');
        this.sendBtn = document.getElementById('sendAiChatBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.modelSelectEl = document.getElementById('aiModelSelect');
        
        this.summarizeBtn = document.getElementById('aiSummarizeBtn');
        this.explainBtn = document.getElementById('aiExplainBtn');
        
        this.voiceBtn = document.getElementById('voiceInputBtn');
        this.recognition = null;
        this.isRecording = false;

        this.ollamaHost = localStorage.getItem('piflex_ollama_host') || 'http://localhost:11434';
        this.selectedModel = localStorage.getItem('piflex_ai_model') || '';

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadAvailableModels();
        this.renderChatHistory();
        this.setupVoiceRecognition();
    }

    setupEventListeners() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleSidebar());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.toggleSidebar(false));
        }
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
        }
        if (this.chatInputEl) {
            this.chatInputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        if (this.newChatBtn) {
            this.newChatBtn.addEventListener('click', () => this.startNewChat());
        }
        if (this.modelSelectEl) {
            this.modelSelectEl.addEventListener('change', (e) => {
                this.selectedModel = e.target.value;
                localStorage.setItem('piflex_ai_model', this.selectedModel);
            });
        }
        if (this.summarizeBtn) {
            this.summarizeBtn.addEventListener('click', () => this.summarizeActivePage());
        }
        if (this.explainBtn) {
            this.explainBtn.addEventListener('click', () => this.explainSelection());
        }
    }

    toggleSidebar(show = null) {
        if (show === null) {
            this.sidebarEl.classList.toggle('collapsed');
        } else if (show) {
            this.sidebarEl.classList.remove('collapsed');
        } else {
            this.sidebarEl.classList.add('collapsed');
        }
    }

    async loadAvailableModels() {
        try {
            const res = await fetch(`${this.ollamaHost}/api/tags`);
            if (res.ok) {
                const data = await res.json();
                if (data.models && data.models.length > 0) {
                    this.modelSelectEl.innerHTML = data.models.map(m => 
                        `<option value="${m.name}" ${m.name === this.selectedModel ? 'selected' : ''}>${m.name}</option>`
                    ).join('');
                    this.selectedModel = this.modelSelectEl.value;
                    localStorage.setItem('piflex_ai_model', this.selectedModel);
                } else {
                    this.modelSelectEl.innerHTML = '<option value="">No models installed</option>';
                }
            } else {
                throw new Error('Connection failed');
            }
        } catch (e) {
            console.error('Ollama connection error:', e);
            this.modelSelectEl.innerHTML = '<option value="">Ollama Offline/Disconnected</option>';
        }
    }

    loadChatHistory() {
        try {
            const data = localStorage.getItem('piflex_chat_history');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    saveChatHistory() {
        localStorage.setItem('piflex_chat_history', JSON.stringify(this.chatHistory));
    }

    startNewChat() {
        this.chatHistory = [];
        this.saveChatHistory();
        this.renderChatHistory();
    }

    renderChatHistory() {
        this.chatMessagesEl.innerHTML = '';
        if (this.chatHistory.length === 0) {
            this.chatMessagesEl.innerHTML = `
                <div style="text-align: center; color: var(--text-light); padding-top: 30px; font-size: 13px;">
                    <i class="fas fa-robot" style="font-size: 28px; color: var(--primary); margin-bottom: 12px;"></i>
                    <p style="font-weight: 600;">Welcome to PiFlex AI Assistant</p>
                    <p style="font-size: 11px; margin-top: 4px;">Connects directly to your local or network Ollama host to run AI completely offline.</p>
                </div>
            `;
            return;
        }

        this.chatHistory.forEach(msg => {
            this.appendMessageToUI(msg.role, msg.content);
        });
        this.scrollToBottom();
    }

    appendMessageToUI(role, content) {
        const msgEl = document.createElement('div');
        msgEl.className = `ai-message ${role}`;
        
        // Simple Markdown parsing for paragraph and pre-formatted text/code block support
        let htmlContent = content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/\n/g, '<br>');

        msgEl.innerHTML = `
            <div class="ai-message-text">${htmlContent}</div>
            <span class="ai-message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        `;
        
        this.chatMessagesEl.appendChild(msgEl);
    }

    async sendMessage(prePromptText = null) {
        const text = prePromptText || this.chatInputEl.value.trim();
        if (!text) return;

        if (!prePromptText) {
            this.chatInputEl.value = '';
        }

        // Add user message to history & UI
        this.chatHistory.push({ role: 'user', content: text });
        this.saveChatHistory();
        this.appendMessageToUI('user', text);
        this.scrollToBottom();

        if (!this.selectedModel) {
            this.appendMessageToUI('assistant', 'Error: No model selected. Please make sure Ollama is active.');
            this.scrollToBottom();
            return;
        }

        // Append typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'ai-message assistant typing-indicator-container';
        typingIndicator.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        this.chatMessagesEl.appendChild(typingIndicator);
        this.scrollToBottom();

        try {
            const messages = this.chatHistory.map(m => ({ role: m.role, content: m.content }));
            
            const response = await fetch(`${this.ollamaHost}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.selectedModel,
                    messages: messages,
                    stream: true
                })
            });

            // Remove typing indicator
            typingIndicator.remove();

            if (!response.ok) {
                throw new Error('Connection error');
            }

            // Create Assistant Message Bubble
            const assistantBubble = document.createElement('div');
            assistantBubble.className = 'ai-message assistant';
            assistantBubble.innerHTML = '<div class="ai-message-text"></div>';
            this.chatMessagesEl.appendChild(assistantBubble);
            const bubbleTextEl = assistantBubble.querySelector('.ai-message-text');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.trim()) {
                        const parsed = JSON.parse(line);
                        if (parsed.message && parsed.message.content) {
                            assistantResponse += parsed.message.content;
                            // Format bubble
                            bubbleTextEl.innerHTML = assistantResponse
                                .replace(/&/g, "&amp;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;")
                                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                                .replace(/\n/g, '<br>');
                            this.scrollToBottom();
                        }
                    }
                }
            }

            // Save assistant response
            this.chatHistory.push({ role: 'assistant', content: assistantResponse });
            this.saveChatHistory();

        } catch (e) {
            typingIndicator.remove();
            this.appendMessageToUI('assistant', 'Error: Failed to fetch response from Ollama. Make sure the server is reachable.');
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
    }

    // Summarize Active Webview Page Text
    summarizeActivePage() {
        const activeTab = window.tabManager.getActiveTab();
        if (!activeTab || !activeTab.webview) {
            this.appendMessageToUI('assistant', 'No active page found to summarize.');
            this.scrollToBottom();
            return;
        }

        this.toggleSidebar(true);

        activeTab.webview.executeJavaScript('document.body.innerText')
            .then(text => {
                if (text && text.trim().length > 50) {
                    const pageTitle = activeTab.title || 'this page';
                    const truncated = text.slice(0, 4500); // safety cap to prevent context window explosion
                    const prompt = `Summarize the following content from the web page "${pageTitle}". Present key points clearly and concisely:\n\n${truncated}`;
                    this.sendMessage(prompt);
                } else {
                    this.appendMessageToUI('assistant', 'Could not retrieve text content from this page.');
                }
            })
            .catch(() => {
                this.appendMessageToUI('assistant', 'Failed to read content from the active tab.');
            });
    }

    // Explain Selected Text or Clipboard content
    explainSelection() {
        const activeTab = window.tabManager.getActiveTab();
        this.toggleSidebar(true);

        if (activeTab && activeTab.webview) {
            activeTab.webview.executeJavaScript('window.getSelection().toString()')
                .then(selection => {
                    if (selection && selection.trim()) {
                        const prompt = `Explain the following text selection in detail:\n\n"${selection.trim()}"`;
                        this.sendMessage(prompt);
                    } else {
                        // Fallback to clipboard
                        navigator.clipboard.readText()
                            .then(clipText => {
                                if (clipText && clipText.trim()) {
                                    const prompt = `Explain the following clipboard text:\n\n"${clipText.trim()}"`;
                                    this.sendMessage(prompt);
                                } else {
                                    this.appendMessageToUI('assistant', 'Please select text on the webpage or copy text to explain.');
                                }
                            })
                            .catch(() => {
                                this.appendMessageToUI('assistant', 'Unable to access clipboard. Highlight text on page instead.');
                            });
                    }
                })
                .catch(() => {
                    this.appendMessageToUI('assistant', 'Could not fetch text selection.');
                });
        }
    }

    setupVoiceRecognition() {
        const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Speech) {
            if (this.voiceBtn) this.voiceBtn.style.display = 'none';
            return;
        }

        this.recognition = new Speech();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isRecording = true;
            this.voiceBtn.classList.add('recording');
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            this.voiceBtn.classList.remove('recording');
        };

        this.recognition.onerror = () => {
            this.isRecording = false;
            this.voiceBtn.classList.remove('recording');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (this.chatInputEl) {
                this.chatInputEl.value = transcript;
                this.chatInputEl.focus();
            }
        };

        this.voiceBtn.addEventListener('click', () => {
            if (this.isRecording) {
                this.recognition.stop();
            } else {
                this.recognition.start();
            }
        });
    }
}

window.aiAssistant = new AiAssistant();
