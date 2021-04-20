import localTunnel from "localtunnel";

export const runLocalTunnel = async (env, port) => {
  if (env === "development") {
    const tunnel = await localTunnel({
      port: port,
      subdomain: "tgg-gaming-serve",
    });

    console.log("Tunnel started: " + tunnel.url);

    tunnel.on("close", () => {
      console.log("local tunnel closed.");
    });
  }
};
