import mongoose from "mongoose";

// ✅ Sub-schema for RBM token transfers
const tokenTransferSchema = new mongoose.Schema(
  {
    tokenAddress: { type: String, required: true, index: true },
    from: { type: String, required: true, index: true },
    to: { type: String, required: true, index: true },
    value: { type: String, required: true },
    symbol: { type: String, default: "RBM" },
    decimals: { type: Number, default: 18 },
  },
  { _id: false } // No need for separate _id inside array
);

// ✅ Main transaction schema (supports both CBM & RBM)
const transactionSchema = new mongoose.Schema(
  {
    hash: { type: String, unique: true, index: true },
    from: { type: String, index: true },
    to: { type: String, index: true, sparse: true },
    value: { type: String, default: "0" },
    gasUsed: { type: String },
    gasPrice: { type: String },
    nonce: { type: Number },
    blockNumber: { type: Number, index: true },
    timeStamp: { type: Number },

    // 🧩 Transaction type
    type: {
      type: String,
      enum: ["native", "token"],
      default: "native",
      index: true,
    },

    // 🪙 Array of token transfers (for RBM)
    tokenTransfers: [tokenTransferSchema],
  },
  { timestamps: true }
);

// ✅ Export model
const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;
