const mongoose = require('mongoose');
const uri = "mongodb+srv://himanshu:Raju123@cluster0.pdw4wjh.mongodb.net/?appName=Cluster0";
// db.js

// MongoDB connection URI


// Connect to MongoDB
async function connect() {
  try {
    await mongoose.connect(uri);
    console.log("Connected successfully to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1); // Exit process with failure
  }
}

module.exports = { connect };

