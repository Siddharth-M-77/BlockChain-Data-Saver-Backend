module.exports = {
  apps: [
    {
      name: "indexer",
      script: "./src/indexer.js",
      autorestart: true,
      watch: false,
    },
    {
      name: "api",
      script: "./src/server.js",
      autorestart: true,
      watch: false,
    },
  ],
};
