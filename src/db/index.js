import mongoose from "mongoose";
const connectDB=async()=>{
   try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MONGODB CONNECTED ");
   } catch (error) {
    console.error("MongoDB Connection Error : ",error);
    process.exit(1);
   }
}
export default connectDB;