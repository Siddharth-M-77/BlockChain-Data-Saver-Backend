import mongoose from "mongoose";

const HoldingSchema = new mongoose.Schema({
  address: { type: String, required: true, index: true },
  tokenAddress: { type: String, required: true },
  tokenSymbol: String,
  tokenName: String,
  balance: { type: Number, default: 0 },
});

const UserHolding = mongoose.model("UserHolding", HoldingSchema);
export default UserHolding;
