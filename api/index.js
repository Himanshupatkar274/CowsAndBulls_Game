const express = require("express");
const socketIo = require("socket.io");
const cors = require('cors');
const mongoose = require("mongoose"); // Added mongoose for MongoDB connection
const { connect } = require("../connections/DbConnection"); // Assuming you have a db connection file
const serverless = require('serverless-http');

// Initialize Express
const app = express();
const server = require('http').createServer(app);
app.use(cors());
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:4200", "https://cows-bulls-e9faf.web.app/"],  // Adjust the origin to match your Angular app's URL
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

const PORT = process.env.PORT || 5000; // Define your port

// Connect to MongoDB
connect();

// Middleware
app.use(express.json());


// Initialize Socket.IO
// Room management variables
const { Room, GuestUser } = require('../models/Room');
// Socket.IO logic
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("createRoom", async (playerName, expectedPlayers, gameOwner) => {
    try {
      const newRoom = new Room({
        players: [{ name: playerName, attempts: 0, gameStatus: 'ongoing', username: gameOwner }],
        expectedPlayers: expectedPlayers,
        gameOwner: gameOwner
      });
      await newRoom.save();
      socket.emit("roomCreated", newRoom._id.toString());
      console.log(`Player ${playerName} created and joined room ${newRoom._id}`);
    } catch (error) {
      socket.emit("createRoomError", { message: "Error creating room" });
    }
  });

  socket.on("joinRoom", async (roomId, playerName, userId) => {
    try {
      // Find the room by roomId
      const room = await Room.findById(roomId);

      if (!room) {
        socket.emit("joinRoomError", { message: "Room not found" });
        return;
      }

      // Check if the player is already in the room
      if (room.players.some(player => player.name === playerName)) {
        socket.emit("joinRoomError", { message: "Player already in the room" });
        return;
      }

      // Check if the room is full
      if (room.players.length >= room.expectedPlayers) {
        socket.emit("joinRoomError", { message: "Room is already full" });
        return;
      }
      

      // Add player to the room in MongoDB
      room.players.push({ name: playerName, attempts: 0, gameStatus: 'ongoing', username: userId});
      await room.save();

      // Join the room
      socket.join(roomId);
      // Emit event to client confirming join
      socket.emit("joinedRoom", {
        roomId: room._id.toString(),
        players: room.players,
      });
      io.emit('roomStateUpdate', room);
      if (room.players.length === room.expectedPlayers) {
        io.emit("startMatch", { message: "All players have joined. The match can start." });
        console.log('expectedPlayers players complete');
      } else {
        io.emit("waitingPlayers", { message: "Waiting for the players" });
      }
    } catch (error) {
      socket.emit("joinRoomError", { message: "Error joining room" });
    }
  });

  socket.on("updateScore", async (roomId, playerName, score) => {
    try {
      const room = await Room.findById(roomId);
      if (!room) {
        throw new Error("Room not found");
      }
      const player = room.players.find((p) => p.name === playerName);
      if (player) {
        player.score = score;
        await room.save();
        io.emit("scoreUpdated", { playerName, score });
      } else {
        throw new Error("Player not found");
      }
    } catch (error) {
      console.error("Error updating score:", error);
      io.emit("errorUpdateScore", { message: "Error updating score" });
    }
  });

  socket.on("makeGuess", async (roomId, playerName, guess, secretGuessNumber) => {
    try {
      const room = await Room.findById(roomId);
      if (!room) {
        throw new Error("Room not found");
      }
      console.log(`Searching for player: "${playerName}"`);
      room.players.forEach(p => {
        console.log(`Player in room: "${p.name}"`);
      });
       // Find the player
      // Check for player name matching
       const player = room.players.find(p => p.name.trim() === playerName.trim());

      if (!player) {
        throw new Error("Player not found in room");
      }
  
      // Assume timeTaken is calculated somehow, for now set it to 0
      const timeTaken = 0;
  
      const { cows, bulls } = checkGuess(guess, secretGuessNumber);
      player.attempts += 1;
      player.timeTaken += timeTaken;
  
      // Emit result to clients in the room
      io.emit("guessResult", { cows, bulls, result: bulls === 4 ? `Congratulations! Game Over the winner is ${playerName}` : '' });
  
      // Update attempts in room and save to database
      // room.attempts.push({ guess, cows, bulls });
      await room.save();
  
      // Emit updated room state to all clients in the room
      io.emit('roomStateUpdate', room);
  
      // Example: Check if game is over (all bulls)
      if (bulls === 4) {
        player.gameStatus = 'won';
        await room.save();
        io.emit('roomStateUpdate', room);
        io.emit("gameOver", { winner: playerName, score: bulls });
        await Room.findByIdAndDelete(roomId);
      }
    } catch (error) {
      console.error("Error processing guess:", error);
    }
  });;

  socket.on("startMatch", async (players, roomId) => {
    
    try {
        io.emit("startMatch", { message: "All players have joined. The match can start." });
    } catch (error) {
        console.error("Error starting match:", error);
        io.emit("StartMatchError", { message: "Error starting match" });
    }
  });

  socket.on("playerAttempt", async ({ roomId, username, currentGuess }) => {
    try {
      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit("playerAttemptError", "Room not found");
        return;
      }
      const player = room.players.find(p => p.name === username);
      if (player) {
        player.attempts += 1;
        // Optionally, you can add logic to update other player properties like time taken
        await room.save();
        io.emit("scoreUpdated", room);
        console.log(`Player ${username} made an attempt in room ${roomId}`);
      } else {
        socket.emit("playerAttemptError", "Player not found in room");
      }
    } catch (error) {
      socket.emit("playerAttemptError", error.message);
    }
  });

  socket.on("gameCompleted", async ({ roomId, username, timeTaken }) => {
    try {
      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit("gameCompletedError", "Room not found");
        return;
      }
      const player = room.players.find(p => p.name === username);
      if (player) {
        player.gameStatus = 'completed';
        player.timeTaken = timeTaken;
        await room.save();
        io.emit("gameOver", room);
        console.log(`Game completed by ${username} in room ${roomId}`);
      } else {
        socket.emit("gameCompletedError", "Player not found in room");
      }
    } catch (error) {
      socket.emit("gameCompletedError", error.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });

});





app.get("/leaderboard/:roomId", async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).send("Room not found");
    }
    const leaderboard = room.players.sort((a, b) => b.score - a.score);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).send("Error fetching leaderboard: " + error.message);
  }
});

app.get('/players', async (req, res) => {
  try {
    const players = await Room.find();
    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/join-as-guest', async (req, res) => {
  const { userId } = req.body;

  try {
    // Check if userId already exists
    const existingUser = await GuestUser.findOne({ userId });
    if (existingUser) {
      return res.status(400).json({ message: 'User ID already exists' });
    }
    // Create a new guest user if userId doesn't exist
    const newGuestUser = new GuestUser({ userId });
    const user = await newGuestUser.save();
    res.json(user);
  } catch (error) {
    console.error('Error creating guest user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
})

app.get('/get-users', async (req, res) => {
  const userId = req.query.userId;
  try {
    const user = await GuestUser.findOne({ userId }); // Adjust to find by userId field
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
})

function checkGuess(guess, secret) {
  let cows = 0;
  let bulls = 0;

  // Logic to calculate cows and bulls
  const guessArr = guess.split('');
  const secretArr = secret.split('');

  const checkedSecret = Array(4).fill(false);
  const checkedGuess = Array(4).fill(false);

  // Calculate bulls
  for (let i = 0; i < 4; i++) {
    if (guessArr[i] === secretArr[i]) {
      bulls++;
      checkedSecret[i] = true;
      checkedGuess[i] = true;
    }
  }

  // Calculate cows
  for (let i = 0; i < 4; i++) {
    if (!checkedGuess[i]) {
      for (let j = 0; j < 4; j++) {
        if (!checkedSecret[j] && guessArr[i] === secretArr[j]) {
          cows++;
          checkedSecret[j] = true;
          break;
        }
      }
    }
  }

  return { cows, bulls };
}

// Start Express server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
module.exports.handler = serverless(app);