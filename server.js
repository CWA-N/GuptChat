const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 50 * 1024 * 1024 // 50MB ki size limit allow kar di hai
});

app.use(express.static(path.join(__dirname, 'public')));

const users = {};

io.on('connection', (socket) => {
    
    // === ROOM JOIN LOGIC ===
    socket.on('joinRoom', ({ username, room }) => {
        socket.join(room);
        users[socket.id] = { username, room };

        socket.emit('message', { user: 'System', text: `Welcome to Room ${room}, ${username}!` });
        socket.broadcast.to(room).emit('message', { user: 'System', text: `${username} has joined.` });

        io.to(room).emit('roomUsers', {
            room: room,
            users: Object.values(users).filter(u => u.room === room)
        });
    });

    // === VIDEO CALL SIGNALING (GROUP MESH NETWORK) ===
    socket.on('join-call', () => {
        const user = users[socket.id];
        if (user) {
            // Jab koi naya banda call start kare, room mein sabko batao
            socket.to(user.room).emit('user-joined-call', socket.id);
        }
    });

    socket.on('offer', (data) => {
        // Target user (specific dost) ko offer bhejo
        io.to(data.target).emit('offer', { callerId: socket.id, offer: data.offer });
    });

    socket.on('answer', (data) => {
        io.to(data.target).emit('answer', { answererId: socket.id, answer: data.answer });
    });

    socket.on('ice-candidate', (data) => {
        io.to(data.target).emit('ice-candidate', { senderId: socket.id, candidate: data.candidate });
    });

    socket.on('end-call', () => {
        const user = users[socket.id];
        if (user) {
            socket.to(user.room).emit('user-left-call', socket.id);
        }
    });
    // ==================================================

    // === NORMAL CHAT & IMAGE LOGIC ===
    socket.on('chatMessage', (msg) => {
        const user = users[socket.id];
        if (user) {
            io.to(user.room).emit('message', { user: user.username, text: msg });
        }
    });

    socket.on('chatImage', (imgData) => {
        const user = users[socket.id];
        if (user) {
            io.to(user.room).emit('imageMessage', { user: user.username, img: imgData });
        }
    });

    // === TYPING INDICATOR CODE ===
    socket.on('typing', () => {
        const user = users[socket.id];
        if (user) {
            socket.broadcast.to(user.room).emit('typing', user.username);
        }
    });

    socket.on('stopTyping', () => {
        const user = users[socket.id];
        if (user) {
            socket.broadcast.to(user.room).emit('stopTyping');
        }
    });

    // === CLEAR CHAT CODE ===
    socket.on('clearRoomChat', () => {
        const user = users[socket.id];
        if (user) {
            io.to(user.room).emit('chatCleared');
        }
    });

    // === DISCONNECT LOGIC ===
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.to(user.room).emit('message', { user: 'System', text: `${user.username} has left.` });
            socket.to(user.room).emit('user-left-call', socket.id); // Call se bhi hata do
            delete users[socket.id];

            io.to(user.room).emit('roomUsers', {
                room: user.room,
                users: Object.values(users).filter(u => u.room === user.room)
            });
        }
    });
});

// === AUTO CLEAR CHAT EVERY 2 MINUTES (120,000 ms) ===
setInterval(() => {
    io.emit('chatCleared');
}, 120000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));