const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  score: { type: Number, default: 0 }, // Default score to 0
  username: { type: String },
  attempts: { type: Number, default: 0 },
  timeTaken: { type: Number, default: 0 },
  gameStatus: { type: String, default: 'ongoing' } // Default game status to 'ongoing'
});

const RoomSchema = new mongoose.Schema({
  players: [PlayerSchema],
  expectedPlayers: { type: Number, required: true }, // Corrected schema definition
  // Add other properties as needed
});

const Room = mongoose.model('Room', RoomSchema);

module.exports = Room;