import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Define the schema for warnings
const warningSchema = new Schema({
  groupId: String, // Group chat ID
  userId: String,  // User's WhatsApp ID
  warnings: { type: Number, default: 0 }, // Number of warnings
  lastWarningDate: Date, // Date of the last warning
});

// Create a model from the schema
const Warning = model('Warning', warningSchema);

// Connect to MongoDB
const connectToDatabase = async () => {
  try {
    await mongoose.connect('mongodb://username:password@cluster.mongodb.net/dbname', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
};

// Call the connection function when the file is imported
connectToDatabase();

export default Warning;
