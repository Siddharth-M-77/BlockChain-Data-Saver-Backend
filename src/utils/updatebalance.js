import { ethers } from "ethers";
import Balance from "../models/balance.model.js";

export const updateBalances = async (tx) => {
  try {
    // 🛡️ Null safety for tx and value
    if (!tx || !tx.value) {
      return; // no transaction or no value — skip silently
    }

    let rawValue = tx.value;

    // 🧩 Ensure valid hex string (ethers BigNumberish format)
    if (typeof rawValue !== "string" || !rawValue.startsWith("0x")) {
      rawValue = "0x0";
    }

    let value = 0;

    try {
      // ✅ Safe conversion to ether value
      value = Number(ethers.formatEther(rawValue));
      if (isNaN(value)) value = 0;
    } catch (err) {
      console.warn(`⚠️ Skipping tx with invalid value: ${rawValue}`);
      return;
    }

    // ✅ From wallet balance update
    if (tx.from) {
      await Balance.updateOne(
        { address: tx.from },
        {
          $inc: { balance: -value, txnCount: 1 },
        },
        { upsert: true }
      );
    }

    // ✅ To wallet balance update
    if (tx.to) {
      await Balance.updateOne(
        { address: tx.to },
        {
          $inc: { balance: value, txnCount: 1 },
        },
        { upsert: true }
      );
    }
  } catch (error) {
    console.error(`❌ updateBalances failed: ${error.message}`);
  }
};
