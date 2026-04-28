import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoUri = process.env.USER_MONGO_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('Missing USER_MONGO_URI or MONGO_URI');
    }
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
