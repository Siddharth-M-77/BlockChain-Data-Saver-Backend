import Transaction from "../models/Transaction.model.js";
import axios from "axios";
import BlockMeta from "../models/BlockMeta.js";
import UserHolding from "../models/UserHolding.js";
import { ethers } from "ethers";
export const smartTransactionSearch = async (req, res) => {
  try {
    const { input } = req.params;

    if (!input || !input.trim()) {
      return res.status(400).json({
        type: "invalid",
        message: "Search input missing or invalid",
      });
    }

    const value = input.trim().toLowerCase();

    const isHash = value.startsWith("0x") && value.length === 66;
    const isAddress = value.startsWith("0x") && value.length === 42;
    const isBlockNumber = /^[0-9]+$/.test(value);

    // ✅ Pagination setup
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log("🔍 Searching:", value, "| page:", page, "| limit:", limit);

    if (isHash) {
      const tx = await Transaction.findOne({ hash: value }).lean();
      if (!tx) {
        return res.status(404).json({
          type: "transaction",
          message: "Transaction not found",
        });
      }

      return res.status(200).json({
        type: "transaction",
        success: true,
        currentPage: 1,
        totalPages: 1,
        totalRecords: 1,
        perPage: 1,
        data: [tx],
      });
    }

    if (isAddress) {
      const total = await Transaction.countDocuments({
        $or: [{ from: value }, { to: value }],
      }).lean();

      const txs = await Transaction.find({
        $or: [{ from: value }, { to: value }],
      })
        .sort({ timeStamp: -1 })
        .skip(skip)
        .limit(limit);

      if (!txs.length) {
        return res.status(404).json({
          type: "address",
          message: "No transactions found for this address",
        });
      }

      return res.status(200).json({
        type: "address",
        success: true,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        perPage: limit,
        data: txs,
      });
    }

    // ✅ CASE 3: Block Number (paginated)
    if (isBlockNumber) {
      const total = await Transaction.countDocuments({
        blockNumber: Number(value),
      });

      const txs = await Transaction.find({ blockNumber: Number(value) })
        .sort({ timeStamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      if (!txs.length) {
        return res.status(404).json({
          type: "block",
          message: "No transactions found for this block number",
        });
      }

      return res.status(200).json({
        type: "block",
        success: true,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        perPage: limit,
        data: txs,
      });
    }

    return res.status(400).json({
      type: "invalid",
      message:
        "Input must be a valid transaction hash, address, or block number",
    });
  } catch (error) {
    console.error("❌ smartTransactionSearch error:", error.message);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

export const getAllTransactions = async (req, res) => {
  console.log("💥 Controller reached");

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await Transaction.countDocuments();

    const txs = await Transaction.find()
      .sort({ timeStamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total,
      perPage: limit,
      data: txs,
    });
  } catch (error) {
    console.error("Error in controller:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllStats = async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const oneHourAgo = now - 3600;
    const twentyFourHoursAgo = now - 86400;

    // 1️⃣ Total transactions in last 24h
    const total24h = await Transaction.countDocuments({
      timeStamp: { $gte: twentyFourHoursAgo },
    });

    // 2️⃣ Pending transactions in last 1h
    const pending1h = await Transaction.countDocuments({
      status: "pending",
      timeStamp: { $gte: oneHourAgo },
    });

    // 3️⃣ Total and average fee in last 24h (handled in JS)
    const txs24h = await Transaction.find({
      timeStamp: { $gte: twentyFourHoursAgo },
      gasUsed: { $exists: true },
      gasPrice: { $exists: true },
    });

    let totalFees = 0;

    txs24h.forEach((tx) => {
      try {
        const gasUsed = tx.gasUsed?.startsWith("0x")
          ? parseInt(tx.gasUsed, 16)
          : Number(tx.gasUsed);

        const gasPrice = tx.gasPrice?.startsWith("0x")
          ? parseInt(tx.gasPrice, 16)
          : Number(tx.gasPrice);

        const fee = gasUsed * gasPrice;
        if (!isNaN(fee)) totalFees += fee;
      } catch {
        // ignore broken values
      }
    });

    const avgFee = txs24h.length ? totalFees / txs24h.length : 0;

    // 4️⃣ Response
    res.status(200).json({
      success: true,
      stats: {
        total24h,
        pending1h,
        totalFees24h: totalFees,
        avgFee24h: avgFee,
      },
    });
  } catch (error) {
    console.error("Error in getAllStats:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllTRansactionCount = async (req, res) => {
  try {
    const count = await Transaction.countDocuments();
    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error in getAllStats:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const RPC_URL = process.env.RPC_HTTP || "http://127.0.0.1:8545";

// Helper function for JSON-RPC calls
const rpcCall = async (method, params = []) => {
  const { data } = await axios.post(RPC_URL, {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  });
  return data.result;
};

// 🧩 Controller: Fetch all validators (Clique signers)
export const getValidators = async (req, res) => {
  try {
    // Fetch validator (signer) addresses
    const signers = await rpcCall("clique_getSigners", ["latest"]);

    // Latest block number
    const latestHex = await rpcCall("eth_blockNumber");
    const latest = parseInt(latestHex, 16);

    // Fetch last 20 blocks to calculate signer activity
    const limit = 20;
    const blocks = [];
    for (let i = Math.max(0, latest - limit); i <= latest; i++) {
      const hex = "0x" + i.toString(16);
      const block = await rpcCall("eth_getBlockByNumber", [hex, false]);
      if (block) {
        blocks.push({
          number: i,
          miner: block.miner,
          timestamp: block.timestamp,
        });
      }
    }

    // Activity count per validator
    const activity = {};
    signers.forEach((s) => (activity[s.toLowerCase()] = 0));
    blocks.forEach((b) => {
      if (b.miner) {
        const m = b.miner.toLowerCase();
        if (activity[m] !== undefined) activity[m]++;
      }
    });

    // Response object
    const validators = signers.map((addr) => ({
      address: addr,
      signedBlocks: activity[addr.toLowerCase()] || 0,
    }));

    const chainId = parseInt(await rpcCall("eth_chainId"), 16);

    res.status(200).json({
      chainId,
      totalValidators: validators.length,
      validators,
    });
  } catch (err) {
    console.error("❌ Error fetching validators:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const getAllBlocks = async (req, res) => {
  try {
    const blocks = await BlockMeta.find().lean();
    res.status(200).json({
      success: true,
      blocks,
    });
  } catch (error) {
    console.error("Error in getAllBlocks:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllRbmHolders = async (req, res) => {
  try {
    const holders = await UserHolding.find().sort({ balance: -1 }).lean();

    res.status(200).json({
      success: true,
      holders,
    });
  } catch (error) {
    console.error("Error in getAllRbmHolders:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

import BigNumber from "bignumber.js";

const fromHexToCbm = (hex) => {
  try {
    const value = new BigNumber(hex);
    return value.dividedBy(new BigNumber(10).pow(18)).toNumber();
  } catch (err) {
    return 0;
  }
};

export const getCbmHolders = async (req, res) => {
  try {
    const txs = await Transaction.find({ type: "native" }).lean();

    if (!txs.length) {
      return res.json({ success: true, holders: [], totalSupply: 0 });
    }

    const balances = new Map();

    for (const tx of txs) {
      const from = tx.from?.toLowerCase();
      const to = tx.to?.toLowerCase();
      const valueCbm = fromHexToCbm(tx.value);

      if (from) {
        const prev = balances.get(from) || 0;
        balances.set(from, prev - valueCbm);
      }

      if (to) {
        const prev = balances.get(to) || 0;
        balances.set(to, prev + valueCbm);
      }
    }

    const holders = [];
    let totalSupply = 0;

    for (const [address, balance] of balances.entries()) {
      if (balance > 0) {
        holders.push({ address, balance });
        totalSupply += balance;
      }
    }

    holders.sort((a, b) => b.balance - a.balance);

    res.json({
      success: true,
      totalHolders: holders.length,
      totalSupply: parseFloat(totalSupply.toFixed(6)),
      holders: holders.map((h) => ({
        address: h.address,
        balance: parseFloat(h.balance.toFixed(6)),
      })),
    });
  } catch (error) {
    console.error("❌ getCbmHolders error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const provider = new ethers.JsonRpcProvider("https://rpc.cbmscan.com/");

// 🧹 Helper to remove all BigInts from any nested object
function sanitizeBigInts(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

export const getTokenDetails = async (req, res) => {
  try {
    const { tokenAddress } = req.params;
    if (!ethers.isAddress(tokenAddress)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid token address" });
    }

    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      provider
    );

    const [name, symbol, decimals, totalSupplyRaw] = await Promise.all([
      tokenContract.name().catch(() => "Unknown"),
      tokenContract.symbol().catch(() => "???"),
      tokenContract.decimals().catch(() => 18),
      tokenContract.totalSupply().catch(() => 0n),
    ]);

    // ✅ Convert BigInt safely to number
    const totalSupply = parseFloat(
      ethers.formatUnits(totalSupplyRaw, decimals)
    );

    // ✅ Fetch transactions
    const txs = await Transaction.find({
      "tokenTransfers.tokenAddress": tokenAddress.toLowerCase(),
    }).lean();

    const holders = new Set();
    txs.forEach((tx) => {
      tx.tokenTransfers?.forEach((t) => {
        if (t.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) {
          if (t.to) holders.add(t.to.toLowerCase());
          if (t.from) holders.add(t.from.toLowerCase());
        }
      });
    });

    // ✅ Create token data
    const tokenData = {
      address: tokenAddress,
      name,
      symbol,
      decimals,
      totalSupply: parseFloat(totalSupply.toFixed(6)),
      holdersCount: holders.size,
    };

    // ✅ Sanitize before sending (no BigInt issue possible now)
    return res.json(sanitizeBigInts({ success: true, token: tokenData }));
  } catch (err) {
    console.error("getTokenDetails error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
// ✅ Get Token Holders
export const getTokenHolders = async (req, res) => {
  try {
    const { tokenAddress } = req.params;

    const txs = await Transaction.find({
      "tokenTransfers.tokenAddress": tokenAddress.toLowerCase(),
    }).lean();

    const balances = new Map();

    for (const tx of txs) {
      for (const t of tx.tokenTransfers || []) {
        if (t.tokenAddress.toLowerCase() !== tokenAddress.toLowerCase())
          continue;

        const value = parseFloat(t.value);
        const from = t.from?.toLowerCase();
        const to = t.to?.toLowerCase();

        if (from) balances.set(from, (balances.get(from) || 0) - value);
        if (to) balances.set(to, (balances.get(to) || 0) + value);
      }
    }

    const holders = [];
    let totalSupply = 0;

    for (const [addr, bal] of balances.entries()) {
      if (bal > 0) {
        holders.push({ address: addr, balance: parseFloat(bal.toFixed(6)) });
        totalSupply += bal;
      }
    }

    holders.sort((a, b) => b.balance - a.balance);

    res.json({
      success: true,
      holders,
      totalSupply: parseFloat(totalSupply.toFixed(6)),
      holdersCount: holders.length,
    });
  } catch (err) {
    console.error("getTokenHolders error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Get Token Transfers
export const getTokenTransfers = async (req, res) => {
  try {
    const { tokenAddress } = req.params;

    const txs = await Transaction.find({
      "tokenTransfers.tokenAddress": tokenAddress.toLowerCase(),
    })
      .sort({ timeStamp: -1 })
      .limit(50)
      .lean();

    const transfers = [];

    for (const tx of txs) {
      for (const t of tx.tokenTransfers || []) {
        if (t.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) {
          transfers.push({
            hash: tx.hash,
            from: t.from,
            to: t.to,
            value: parseFloat(t.value),
            timeStamp: tx.timeStamp,
          });
        }
      }
    }

    res.json({ success: true, transfers });
  } catch (err) {
    console.error("getTokenTransfers error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
