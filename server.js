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

    // === YAHAN SE TYPING INDICATOR CODE ===
    socket.on('typing', () => {
        const user = users[socket.id];
        if (user) {
            // Jo type kar raha hai usko chhodkar, room ke baaki sabko bhejo
            socket.broadcast.to(user.room).emit('typing', user.username);
        }
    });

    socket.on('stopTyping', () => {
        const user = users[socket.id];
        if (user) {
            socket.broadcast.to(user.room).emit('stopTyping');
        }
    });
    // === YAHAN TAK ===

    // === YAHAN HAI GLOBAL CLEAR CHAT KA ASLI CODE ===
    socket.on('clearRoomChat', () => {
        const user = users[socket.id];
        if (user) {
            // Ye line room ke sabhi members ko signal bhejti hai
            io.to(user.room).emit('chatCleared');
        }
    });
    // ===============================================

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.to(user.room).emit('message', { user: 'System', text: `${user.username} has left.` });
            delete users[socket.id];

            io.to(user.room).emit('roomUsers', {
                room: user.room,
                users: Object.values(users).filter(u => u.room === user.room)
            });
        }
    });
});


setInterval(() => {
    
    io.emit('chatCleared');
}, 120000);


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
