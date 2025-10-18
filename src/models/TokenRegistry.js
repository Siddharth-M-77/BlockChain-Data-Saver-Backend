import mongoose from "mongoose";

const TokenSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true },
  name: String,
  symbol: String,
  decimals: Number,
});

export default mongoose.model("TokenRegistry", TokenSchema);
