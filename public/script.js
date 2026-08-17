const socket = io();

const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const joinForm = document.getElementById('join-form');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const roomNameDisplays = document.querySelectorAll('#room-name, #header-room-name');
const userCountDisplay = document.getElementById('user-count');
const usersList = document.getElementById('users-list');
const currentUsernameDisplay = document.getElementById('current-username');
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg');
const chatMessages = document.getElementById('chat-messages');
const leaveBtn = document.getElementById('leave-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const imageInput = document.getElementById('image-input');
const imgBtn = document.getElementById('img-btn');
const mobileToggle = document.getElementById('mobile-toggle');
const sidebarContent = document.getElementById('sidebar-content');

// === Naye Variables Typing ke liye ===
const typingIndicator = document.getElementById('typing-indicator');
let typingTimeout; 
// ====================================

let currentUsername = '';
let currentRoom = ''; 

joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentUsername = usernameInput.value.trim();
    currentRoom = roomInput.value.trim(); 

    if (currentUsername && currentRoom) {
        socket.emit('joinRoom', { username: currentUsername, room: currentRoom });
        roomNameDisplays.forEach(el => el.innerText = currentRoom);
        currentUsernameDisplay.innerText = currentUsername;
        
        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        document.body.style.backgroundImage = 'none'; 
    }
});

socket.on('message', (message) => {
    outputMessage(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('imageMessage', (message) => {
    outputImage(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('roomUsers', ({ users }) => {
    userCountDisplay.innerText = users.length;
    usersList.innerHTML = users.map(user => `<li><span class="dot"></span> ${user.username}</li>`).join('');
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = msgInput.value.trim();
    if (!msg) return;
    
    socket.emit('chatMessage', msg);
    
    // Nayi line: Message bhejne ke baad typing hide karne ke liye
    socket.emit('stopTyping'); 
    
    msgInput.value = '';
    msgInput.focus();
});

imgBtn.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
        if (file.size > 15 * 1024 * 1024) {
            alert("File is too large! Please select an image smaller than 15MB.");
            this.value = ''; 
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            socket.emit('chatImage', e.target.result);
        };
        reader.readAsDataURL(file);
        this.value = '';
    }
});

function outputMessage(message) {
    const div = document.createElement('div');
    div.classList.add('message');
    if (message.user === 'System') {
        div.classList.add('system-msg');
        div.innerText = `- ${message.text} -`;
    } else {
        div.innerHTML = `<p class="meta"><span>${message.user}</span></p><p class="text">${message.text}</p>`;
    }
    chatMessages.appendChild(div);
}

function outputImage(message) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `<p class="meta"><span>${message.user}</span></p><div class="text"><img src="${message.img}" alt="Shared Image"></div>`;
    chatMessages.appendChild(div);
}

clearChatBtn.addEventListener('click', () => {
    socket.emit('clearRoomChat');
});

socket.on('chatCleared', () => {
    chatMessages.innerHTML = '<div class="system-msg">- Start of conversation -</div>';
});

mobileToggle.addEventListener('click', () => {
    sidebarContent.classList.toggle('active');
});

leaveBtn.addEventListener('click', () => {
    window.location.reload();
});

socket.on('connect', () => {
    if (currentUsername && currentRoom) {
        socket.emit('joinRoom', { username: currentUsername, room: currentRoom });
    }
});


// === IMAGE PREVIEW MODAL LOGIC ===
const imageModal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const closeModal = document.querySelector('.close-modal');

chatMessages.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG') {
        modalImg.src = e.target.src; 
        imageModal.classList.remove('hidden'); 
    }
});

closeModal.addEventListener('click', () => {
    imageModal.classList.add('hidden');
});

imageModal.addEventListener('click', (e) => {
    if (e.target !== modalImg) {
        imageModal.classList.add('hidden');
    }
});
// ==================================


// === TYPING INDICATOR LOGIC (NAYA ADD KIYA HAI) ===
msgInput.addEventListener('input', () => {
    socket.emit('typing');
    clearTimeout(typingTimeout);
    
    typingTimeout = setTimeout(() => {
        socket.emit('stopTyping');
    }, 1500); 
});

socket.on('typing', (username) => {
    typingIndicator.innerText = `${username} is typing...`;
});

socket.on('stopTyping', () => {
    typingIndicator.innerText = '';
});
// ==================================================