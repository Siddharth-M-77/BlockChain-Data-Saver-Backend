import Transaction from "../models/Transaction.model.js";

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

    // ✅ Detect input type
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

export const getAllTRansactionCount = async(req, res) => {

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
}