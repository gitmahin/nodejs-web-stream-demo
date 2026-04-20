module.exports = {
  apps: [
    {
      name: "server",
      script: "./server/src/index.js",
      watch: ["server"],
      ignore_watch: ["**./node_modules"],
      max_memory_restart: "150M",
      watch: true,
    },
  ],
};
