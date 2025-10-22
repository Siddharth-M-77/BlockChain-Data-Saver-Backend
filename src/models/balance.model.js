import mongoose from "mongoose";

const balanceSchema = new mongoose.Schema({
  address: { type: String, unique: true },
  balance: { type: Number, default: 0 },
  txnCount: { type: Number, default: 0 },
});

const Balance = mongoose.model("Balance", balanceSchema);
export default Balance;
