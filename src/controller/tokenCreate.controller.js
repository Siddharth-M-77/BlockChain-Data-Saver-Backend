import TokenCreate from "../models/TokenCreate.model.js";
import { ethers } from "ethers";
import solc from "solc";
import { uploadToImageKit } from "../utils/imagekit.js";

export const verifyAndPublish = async (req, res) => {
  try {
    const { tokenAddress, sourceCode, compilerVersion, license } = req.body;

    if (!tokenAddress || !sourceCode || !compilerVersion) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields (tokenAddress, sourceCode, compilerVersion)",
      });
    }

    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    // ✅ Step 2: Fetch deployed bytecode from blockchain
    const onChainBytecode = await provider.getCode(tokenAddress);
    if (!onChainBytecode || onChainBytecode === "0x") {
      return res.status(404).json({
        success: false,
        message: "No contract found at this address on blockchain",
      });
    }

    // ✅ Step 3: Prepare input JSON for solc compiler
    const input = {
      language: "Solidity",
      sources: {
        "Contract.sol": {
          content: sourceCode,
        },
      },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: {
          "*": {
            "*": ["evm.bytecode.object"],
          },
        },
      },
    };

    // ✅ Step 4: Load specific compiler version dynamically
    const solcVersion = compilerVersion.replace("v", "soljson-") + ".js";

    const solcCompiler = await new Promise((resolve, reject) => {
      solc.loadRemoteVersion(solcVersion, (err, solcSpecific) => {
        if (err) reject(err);
        else resolve(solcSpecific);
      });
    });

    const compiled = JSON.parse(solcCompiler.compile(JSON.stringify(input)));

    // ✅ Step 5: Check compiler errors
    if (compiled.errors) {
      const errors = compiled.errors.filter((e) => e.severity === "error");
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Solidity compilation failed",
          errors: errors.map((e) => e.formattedMessage),
        });
      }
    }

    // ✅ Step 6: Extract compiled bytecode
    const contractName = Object.keys(compiled.contracts["Contract.sol"])[0];
    const compiledBytecode =
      compiled.contracts["Contract.sol"][contractName].evm.bytecode.object;

    if (!compiledBytecode || compiledBytecode.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Compiled bytecode is empty or missing",
      });
    }

    // ✅ Step 7: Compare on-chain bytecode with compiled one
    const cleanedOnChain = onChainBytecode.toLowerCase().replace(/^0x/, "");
    const cleanedCompiled = compiledBytecode.toLowerCase().replace(/^0x/, "");

    const match = cleanedOnChain.startsWith(cleanedCompiled);

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Bytecode mismatch! Contract not verified.",
      });
    }

    // ✅ Step 8: Update DB entry
    const updated = await TokenCreate.findOneAndUpdate(
      { tokenAddress },
      {
        isVerified: true,
        compilerVersion,
        license,
        sourceCode,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Token not found in database",
      });
    }

    // ✅ Step 9: Return success response
    res.status(200).json({
      success: true,
      message: "✅ Contract verified and published successfully!",
      token: updated,
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during verification",
      error: error.message,
    });
  }
};

export const createToken = async (req, res) => {
  try {
    const token = await TokenCreate.create(req.body);
    res.status(201).json({
      success: true,
      token,
    });
  } catch (error) {
    console.error("Error in createToken:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllTokens = async (req, res) => {
  try {
    const tokens = await TokenCreate.find();
    res.status(200).json({
      success: true,
      tokens,
    });
  } catch (error) {
    console.error("Error in getAllTokens:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const submitToken = async (req, res) => {
  try {
    const { name, symbol, description, ownerAddress } = req.body;
    console.log(req.body);

    if (!name || !symbol || !ownerAddress) {
      return res.status(400).json({
        success: false,
        message: "❌ Missing required fields: name, symbol, or ownerAddress",
      });
    }

    let imageUrl = null;
    if (req.file) {
      const uploaded = await uploadToImageKit(req.file, "Blockchain_Tokens");
      imageUrl = uploaded?.url || null;

      fs.unlinkSync(req.file.path);
    }

    const newToken = await TokenVerificationList.create({
      name,
      symbol,
      description,
      ownerAddress,
      image: imageUrl,
      verified: false,
      submittedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "✅ Token submitted successfully!",
      token: newToken,
    });
  } catch (err) {
    console.error("❌ Error submitting token:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🧑‍⚖️ Admin verify token
export const verifyToken = async (req, res) => {
  try {
    const { id } = req.params;
    const dbPath = "./data/tokens.json";
    if (!fs.existsSync(dbPath))
      return res
        .status(404)
        .json({ success: false, message: "No tokens found" });

    let tokens = JSON.parse(fs.readFileSync(dbPath));
    const index = tokens.findIndex((t) => t.id === Number(id));

    if (index === -1)
      return res
        .status(404)
        .json({ success: false, message: "Token not found" });

    tokens[index].verified = true;
    tokens[index].verifiedAt = new Date();

    fs.writeFileSync(dbPath, JSON.stringify(tokens, null, 2));
    res
      .status(200)
      .json({ success: true, message: "Token verified successfully" });
  } catch (err) {
    console.error("❌ Error verifying token:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📋 List tokens (admin view)
export const getTokens = async (req, res) => {
  try {
    const dbPath = "./data/tokens.json";
    if (!fs.existsSync(dbPath)) return res.json({ tokens: [] });

    const tokens = JSON.parse(fs.readFileSync(dbPath));
    res.json({ success: true, tokens });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
