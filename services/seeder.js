/**
 * Database Seeder for ProShop Microservices
 * 
 * This script seeds the shared MongoDB database with sample data.
 * It connects directly to MongoDB and populates users, products, and orders.
 * 
 * Usage:
 *   node seeder.js         # Import sample data
 *   node seeder.js -d      # Destroy all data
 * 
 * Run from the project root:
 *   node services/seeder.js
 *   node services/seeder.js -d
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import colors from 'colors';

// ─── Import seed data ───────────────────────────────────────────────────────
import users from './user-service/data/users.js';
import products from './product-service/data/products.js';

// ─── Import models from each service ────────────────────────────────────────
import User from './user-service/models/userModel.js';
import Product from './product-service/models/productModel.js';
import Order from './order-service/models/orderModel.js';

dotenv.config({ path: '../.env' });

// Also try loading from current directory
if (!process.env.MONGO_URI) {
  dotenv.config();
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline);
  } catch (error) {
    console.error(`Error: ${error.message}`.red.underline.bold);
    process.exit(1);
  }
};

const importData = async () => {
  try {
    await connectDB();

    await Order.deleteMany();
    await Product.deleteMany();
    await User.deleteMany();

    const createdUsers = await User.insertMany(users);

    const adminUser = createdUsers[0]._id;

    const sampleProducts = products.map((product) => {
      return { ...product, user: adminUser };
    });

    await Product.insertMany(sampleProducts);

    console.log('Data Imported!'.green.inverse);
    process.exit();
  } catch (error) {
    console.error(`${error}`.red.inverse);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await connectDB();

    await Order.deleteMany();
    await Product.deleteMany();
    await User.deleteMany();

    console.log('Data Destroyed!'.red.inverse);
    process.exit();
  } catch (error) {
    console.error(`${error}`.red.inverse);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}
