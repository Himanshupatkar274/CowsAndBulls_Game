const express = require("express");
const socketIo = require("socket.io");
const cors = require('cors');
const mongoose = require("mongoose"); // Added mongoose for MongoDB connection
const { connect } = require("../connections/DbConnection"); // Assuming you have a db connection file

// Initialize Express
const app = express();
app.use(cors());
const serverless = require('serverless-http');
const PORT = process.env.PORT || 5000; // Define your port

// Connect to MongoDB
connect();

// Middleware
app.use(express.json());

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:4200", // Adjust the origin to match your Angular app's URL
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// Room management variables
const Room = require("../models/Room"); // This will hold room data

// Socket.IO logic
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("createRoom", async (playerName, expectedPlayers) => {
    try {
      const newRoom = new Room({
        players: [{ name: playerName, attempts: 0, timeTaken: 0, gameStatus: 'ongoing' }],
        expectedPlayers: expectedPlayers
      });
      await newRoom.save();
      socket.emit("roomCreated", newRoom._id.toString());
    } catch (error) {
      socket.emit("createRoomError", { message: "Error creating room" });
    }
  });

  socket.on("joinRoom", async (roomId, playerName, userId) => {
    try {
      // Find the room by roomId
      const room = await Room.findById(roomId);

      if (!room) {
        throw new Error("Room not found");
      }

      // Check if the player is already in the room
      if (room.players.some(player => player.name === playerName)) {
        throw new Error("Player already in the room");
      }

      // Check if the room is full
      if (room.players.length >= room.expectedPlayers) {
        throw new Error("Room is already full");
      }
      

      // Add player to the room in MongoDB
      room.players.push({ name: playerName, attempts: 0, timeTaken: 0, gameStatus: 'ongoing', username: userId});
      await room.save();

      // Join the room
      socket.join(roomId);

      // Emit event to client confirming join
      socket.emit("joinedRoom", {
        roomId: room._id.toString(),
        players: room.players,
      });
      emitRoomStateUpdate(roomId, room);
        // Emit updated player list to room
      // Check if all players have joined
      if (room.players.length === room.expectedPlayers) {
        io.emit("startMatch", { message: "All players have joined. The match can start." });
      } else {
        io.emit("startMatchError", { message: "All players have joined. start Another room" });
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
 // Replace with actual secret number generation logic
      const { cows, bulls } = checkGuess(guess, secretGuessNumber);

      player.attempts += 1;
      player.timeTaken += timeTaken;
      // Emit result to client
      io.emit("guessResult", { cows, bulls, result: bulls === 4 ? "Congratulations! You guessed the number." : "" });
      // Update attempts in room and save to database
      room.attempts.push({ guess, cows, bulls });
      await room.save();

      // Emit updated room state to all clients in the room
      emitRoomStateUpdate(roomId, room);

      // Example: Check if game is over (all bulls)
      if (bulls === 4) {
        player.gameStatus = 'won';
        await room.save();
        await Room.findByIdAndDelete(roomId);
        emitRoomStateUpdate(roomId, room);
        io.emit("gameOver", { winner: playerName, score: bulls });
      }
    } catch (error) {
      console.error("Error processing guess:", error);
    }
  });

  socket.on("startMatch", async (players, roomId) => {
    
    try {
        io.emit("startMatch", { message: "All players have joined. The match can start." });
        // await Room.findByIdAndDelete(roomId);
    } catch (error) {
        console.error("Error starting match:", error);
        io.emit("StartMatchError", { message: "Error starting match" });
    }
});


});

function emitRoomStateUpdate(roomId, updatedState) {
  io.emit('roomStateUpdate', { players: updatedState.players, attempts: updatedState.attempts });
}



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



module.exports = app;
module.exports.handler = serverless(app);