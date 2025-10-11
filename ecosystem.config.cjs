module.exports = {
  apps: [
    {
      name: "cbm-server",
      script: "./src/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
    },
    {
      name: "cbm-indexer",
      script: "./src/indexer.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
    },
  ],
};
