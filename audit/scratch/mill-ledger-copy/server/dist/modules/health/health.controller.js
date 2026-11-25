export function getHealth(_req, res) {
    const healthData = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: "mill-ledger-server",
        version: "0.1.0",
    };
    res.status(200).json(healthData);
}
