import mongoose from "mongoose";
import config from "../config/app.config.js";

const connectDatabase = async () => {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("Database connected to MONGODB successfully");
  } catch (error) {
    console.log("Database connection failed");
    process.exit(1);
  }
};

export default connectDatabase;
