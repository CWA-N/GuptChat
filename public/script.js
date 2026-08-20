const socket = io();

const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const joinForm = document.getElementById('join-form');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const roomNameDisplays = document.querySelectorAll('#room-name, #header-room-name');
const userCountDisplay = document.getElementById('user-count');
const usersList = document.getElementById('users-list');
// const currentUsernameDisplay = document.getElementById('current-username'); // Ise comment hi rehne diya hai
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg');
const chatMessages = document.getElementById('chat-messages');
const leaveBtn = document.getElementById('leave-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const imageInput = document.getElementById('image-input');
const imgBtn = document.getElementById('img-btn');
const mobileToggle = document.getElementById('mobile-toggle');
const sidebarContent = document.getElementById('sidebar-content');

// === Typing Indicator Variables ===
const typingIndicator = document.getElementById('typing-indicator');
let typingTimeout;

let currentUsername = '';
let currentRoom = '';

// === LOGIN & ROOM JOIN ===
joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentUsername = usernameInput.value.trim();
    currentRoom = roomInput.value.trim();

    if (currentUsername && currentRoom) {
        socket.emit('joinRoom', { username: currentUsername, room: currentRoom });
        roomNameDisplays.forEach(el => el.innerText = currentRoom);
        // currentUsernameDisplay.innerText = currentUsername; // Ise bhi comment rehne diya

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

// === CHAT & MESSAGING ===
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = msgInput.value.trim();
    if (!msg) return;

    socket.emit('chatMessage', msg);
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

// === CLEAR CHAT ===
clearChatBtn.addEventListener('click', () => {
    socket.emit('clearRoomChat');
});

socket.on('chatCleared', () => {
    chatMessages.innerHTML = '<div class="system-msg">- Start of conversation -</div>';
});

// === UI CONTROLS ===
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

// === IMAGE PREVIEW MODAL ===
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

// === TYPING INDICATOR ===
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

// =======================================================
// === GROUP VIDEO CALL & CAMERA CONTROLS (PRO LEVEL) ===
// =======================================================
let localStream;
let peers = {}; // Saare doston ke connections yahan save honge
let currentFacingMode = "user"; // "user" (front) ya "environment" (back)
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const videoContainer = document.getElementById('video-container');
const videoGrid = document.getElementById('video-grid');
const localVideo = document.getElementById('localVideo');
const callButton = document.getElementById('callButton');
const endCallButton = document.getElementById('endCallButton');
const toggleCamBtn = document.getElementById('toggleCamBtn');
const flipCamBtn = document.getElementById('flipCamBtn');

// 1. Camera Start Karna (Front ya Back)
async function startCamera(facingMode = "user") {
    if (localStream) return true;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: facingMode }, 
            audio: true 
        });
        localVideo.srcObject = localStream;
        return true;
    } catch (error) {
        console.log("Camera error!", error);
        alert("Camera ya Mic ki permission nahi mili!");
        return false;
    }
}

// 2. Peer Connection Banana (Naye user ke liye)
function createPeerConnection(userId) {
    const pc = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Jab uski video aaye, naya dabba banakar grid mein daalo
    pc.ontrack = (event) => {
        let remoteVid = document.getElementById(`video-${userId}`);
        if(!remoteVid) {
            remoteVid = document.createElement('video');
            remoteVid.id = `video-${userId}`;
            remoteVid.autoplay = true;
            remoteVid.style.width = "150px";
            remoteVid.style.border = "2px solid #f44336";
            remoteVid.style.borderRadius = "8px";
            videoGrid.appendChild(remoteVid);
        }
        remoteVid.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { target: userId, candidate: event.candidate });
        }
    };
    return pc;
}

// 3. Call Start Karna
callButton.onclick = async () => {
    videoContainer.classList.remove('hidden');
    videoContainer.style.display = 'flex'; // UI theek karne ke liye
    const success = await startCamera(currentFacingMode);
    if (!success) {
        videoContainer.classList.add('hidden');
        return;
    }
    socket.emit('join-call'); 
};

// 4. Jab koi call join kare
socket.on('user-joined-call', async (userId) => {
    if(!localStream) return; 
    
    const pc = createPeerConnection(userId);
    peers[userId] = pc;
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { target: userId, offer: offer });
});

socket.on('offer', async (data) => {
    if(!localStream) {
        if(confirm("📞 Room mein Group Video Call chal rahi hai. Join karna hai?")) {
            videoContainer.classList.remove('hidden');
            videoContainer.style.display = 'flex';
            const success = await startCamera(currentFacingMode);
            if(!success) return;
            socket.emit('join-call'); 
        } else {
            return;
        }
    }

    const pc = createPeerConnection(data.callerId);
    peers[data.callerId] = pc;
    await pc.setRemoteDescription(data.offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { target: data.callerId, answer: answer });
});

socket.on('answer', async (data) => {
    const pc = peers[data.answererId];
    if (pc) await pc.setRemoteDescription(data.answer);
});

socket.on('ice-candidate', async (data) => {
    const pc = peers[data.senderId];
    if (pc) await pc.addIceCandidate(data.candidate);
});

// --- NEW PRO FEATURES ---

// A. Camera ON / OFF Toggle
toggleCamBtn.onclick = () => {
    if(localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if(videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            toggleCamBtn.innerText = videoTrack.enabled ? "📹 Cam Off" : "🚫 Cam On";
            toggleCamBtn.style.color = videoTrack.enabled ? "" : "#f44336";
        }
    }
};

// B. Camera Flip (Front/Back)
flipCamBtn.onclick = async () => {
    if(!localStream) return;
    
    // Switch state
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    
    // Purana video track roko
    const oldVideoTrack = localStream.getVideoTracks()[0];
    oldVideoTrack.stop();
    localStream.removeTrack(oldVideoTrack);

    try {
        // Naya camera kholo
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode },
            audio: false // Aawaz same rahegi
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        localStream.addTrack(newVideoTrack);
        localVideo.srcObject = localStream;

        // Sabhi doston ke screens par apni nayi video replace karo
        for(let id in peers) {
            const sender = peers[id].getSenders().find(s => s.track.kind === 'video');
            if(sender) sender.replaceTrack(newVideoTrack);
        }
    } catch (error) {
        console.log("Flip cam error", error);
        alert("Peeche ka camera nahi mila ya support nahi kar raha!");
    }
};

// C. Call End Karna & Clean Up
function stopCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop()); // Camera/Mic poori tarah band
        localStream = null;
    }
    
    // Sabhi connections kaat do
    for(let id in peers) {
        peers[id].close();
    }
    peers = {}; 
    
    // 👇 YAHAN FIX ADD KIYA HAI: Sirf video tags hatenge 👇
    document.querySelectorAll('video[id^="video-"]').forEach(vid => {
        if(vid.id !== "localVideo") vid.remove(); 
    });
    // 👆 ================================================== 👆

    localVideo.srcObject = null; // Purani image freeze hone se rokne ke liye
    
    videoContainer.classList.add('hidden');
    videoContainer.style.display = 'none';
    
    // Button styles reset
    toggleCamBtn.innerText = "📹 Cam Off"; 
    toggleCamBtn.style.color = ""; 
}

endCallButton.onclick = () => {
    stopCall();
    socket.emit('end-call'); 
};

// Jab koi dost call se leave kare
socket.on('user-left-call', (userId) => {
    if(peers[userId]) {
        peers[userId].close();
        delete peers[userId];
    }
    const vid = document.getElementById(`video-${userId}`);
    if(vid) vid.remove(); // Us dost ka dabba hatao
});