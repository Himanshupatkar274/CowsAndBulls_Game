const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  score: { type: Number, default: 0 }, // Default score to 0
  username: { type: String,  required: true },
  attempts: { type: Number, default: 0 },
  gameStatus: { type: String, default: 'ongoing' } // Default game status to 'ongoing'
});

const RoomSchema = new mongoose.Schema({
  players: [PlayerSchema],
  expectedPlayers: { type: Number, required: true }, // Corrected schema definition
  gameOwner: { type: String, required: true},
  // Add other properties as needed
});

const GuestUserSchema = new mongoose.Schema({
  userId: { type: String, required: true }
})
const GuestUser = mongoose.model('Guest-Users', GuestUserSchema)
const Room = mongoose.model('Room', RoomSchema);

module.exports = {
  Room, GuestUser
};