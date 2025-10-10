import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    hash: { type: String, unique: true, index: true },
    from: { type: String, index: true },
    to: { type: String, index: true, sparse: true },
    value: String,
    gasUsed: String,
    gasPrice: String,
    nonce: Number,
    blockNumber: { type: Number, index: true },
    timeStamp: Number,
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;
