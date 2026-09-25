import mongoose from "mongoose";

export async function connectDB(uri: string) {
  try {
    await mongoose.connect(uri);
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
}
