import axios from "axios";

export const getCompilerVersions = async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://binaries.soliditylang.org/bin/list.json"
    );

    // data.releases contains list of all compiler versions
    const versions = Object.keys(data.releases).map((key) => ({
      version: key,
      file: data.releases[key],
    }));

    res.status(200).json({
      success: true,
      message: "Fetched compiler versions successfully",
      versions,
    });
  } catch (error) {
    console.error("Error fetching compiler versions:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch compiler versions",
    });
  }
};
