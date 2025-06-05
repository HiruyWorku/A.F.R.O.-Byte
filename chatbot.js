// Chatbot functionality
class Chatbot {
    constructor() {
        this.messages = document.getElementById('chat-messages');
        this.input = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-button');
        this.suggestedQuestions = document.querySelectorAll('.suggested-question');
        
        // Initialize Socket.IO
        console.log('Initializing Socket.IO connection...');
        this.socket = io('http://localhost:3000', {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        this.setupSocketListeners();
        
        this.setupEventListeners();
        this.setupTypingIndicator();
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server successfully');
            this.addMessage('Connected to server! How can I help you today?', 'bot');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.addMessage('Unable to connect to server. Please make sure the server is running.', 'bot');
        });

        this.socket.on('chat response', (response) => {
            console.log('Received response:', response);
            this.hideTypingIndicator();
            this.addMessage(response, 'bot');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.addMessage('Connection lost. Trying to reconnect...', 'bot');
        });
    }

    setupEventListeners() {
        // Send message on button click
        this.sendButton.addEventListener('click', () => this.handleUserInput());

        // Send message on Enter key
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUserInput();
            }
        });

        // Handle suggested questions
        this.suggestedQuestions.forEach(question => {
            question.addEventListener('click', () => {
                this.input.value = question.textContent;
                this.handleUserInput();
            });
        });
    }

    setupTypingIndicator() {
        this.typingIndicator = document.createElement('div');
        this.typingIndicator.className = 'typing-indicator';
        this.typingIndicator.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        this.typingIndicator.style.display = 'none';
        this.messages.appendChild(this.typingIndicator);
    }

    async handleUserInput() {
        const message = this.input.value.trim();
        if (!message) return;

        // Add user message
        this.addMessage(message, 'user');
        this.input.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        try {
            console.log('Sending message to server:', message);
            // Send message to server
            this.socket.emit('chat message', message);
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
        }
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        // Handle multiline messages
        const formattedText = text.split('\n').map(line => {
            if (line.startsWith('- ')) {
                return `<li>${line.substring(2)}</li>`;
            } else if (line.match(/^\d+\./)) {
                return `<li>${line}</li>`;
            }
            return line;
        }).join('<br>');

        // If the message contains list items, wrap them in a ul
        if (formattedText.includes('<li>')) {
            messageDiv.innerHTML = formattedText.replace(/<br><li>/g, '<ul><li>').replace(/<\/li><br>/g, '</li></ul>');
        } else {
            messageDiv.innerHTML = formattedText;
        }

        this.messages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';
    }

    scrollToBottom() {
        this.messages.scrollTop = this.messages.scrollHeight;
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing chatbot...');
    const chatbot = new Chatbot();
}); 