import express from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// ✅ Connect to CBM Node
const provider = new ethers.JsonRpcProvider("https://rpc.cbmscan.com/");
const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
export const sendCBM = async (req, res) => {
  try {
    console.log(req.body);
    const { userAddress, cbmAmount } = req.body;

    const amountInWei = ethers.parseEther(cbmAmount.toString());

    // Send native CBM
    const tx = await wallet.sendTransaction({
      to: userAddress,
      value: amountInWei,
    });

    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("CBM send failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
