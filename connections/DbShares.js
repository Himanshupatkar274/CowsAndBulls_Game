const { ObjectId } = require('mongodb'); // For handling MongoDB ObjectId

const { connect, close } = require('/dbConnection'); // Adjust path as needed

async function createDocument(doc) {
  let client;
  try {
    client = await connect();
    const database = client.db('sampleDB'); // Replace with your database name
    const collection = database.collection('sampleCollection'); // Replace with your collection name
    
    const result = await collection.insertOne(doc);
    console.log(`Created document with ID ${result.insertedId}`);
    
    return result;
  } catch (err) {
    console.error("Error creating document:", err);
    throw err;
  } finally {
    if (client) {
      await close(); // Close connection when done
    }
  }
}

async function readDocument(query) {
  let client;
  try {
    client = await connect();
    const database = client.db('sampleDB'); // Replace with your database name
    const collection = database.collection('sampleCollection'); // Replace with your collection name
    
    const user = await collection.findOne(query);
    console.log('Found document:', user);
    
    return user;
  } catch (err) {
    console.error("Error reading document:", err);
    throw err;
  } finally {
    if (client) {
      await close(); // Close connection when done
    }
  }
}

async function updateDocument(query, updateDoc) {
  let client;
  try {
    client = await connect();
    const database = client.db('sampleDB'); // Replace with your database name
    const collection = database.collection('sampleCollection'); // Replace with your collection name
    
    const result = await collection.updateOne(query, { $set: updateDoc });
    console.log(`${result.modifiedCount} document(s) updated`);
    
    return result;
  } catch (err) {
    console.error("Error updating document:", err);
    throw err;
  } finally {
    if (client) {
      await close(); // Close connection when done
    }
  }
}

async function deleteDocuments(query) {
  let client;
  try {
    client = await connect();
    const database = client.db('sampleDB'); // Replace with your database name
    const collection = database.collection('sampleCollection'); // Replace with your collection name
    
    const result = await collection.deleteMany(query);
    console.log(`${result.deletedCount} document(s) deleted`);
    
    return result;
  } catch (err) {
    console.error("Error deleting document(s):", err);
    throw err;
  } finally {
    if (client) {
      await close(); // Close connection when done
    }
  }
}

module.exports = {
  createDocument,
  readDocument,
  updateDocument,
  deleteDocuments,
};
