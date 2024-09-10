const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const admin = require('firebase-admin');
const serviceAccount = require('./swiftui-demo-c439a-firebase-adminsdk-hkggd-dae6248fab.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://your-firebase-project.firebaseio.com"
});

const db = admin.firestore();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Listen for a message to update Firestore
  socket.on('update_firestore', async (data) => {
    try {
      const docRef = db.collection('messages').doc(data.id);
      await docRef.update(data.updateFields);

      // Notify all clients about the update
      io.emit('firestore_updated', data);
      console.log('Firestore updated with:', data);
    } catch (error) {
      console.error('Error updating Firestore:', error);
      socket.emit('error', 'Firestore update failed');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
