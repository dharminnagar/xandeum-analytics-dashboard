// Xandeum pRPC endpoints (prioritized based on testing)
export const XANDEUM_ENDPOINTS = [
  "http://192.190.136.28:6000/rpc",
  "http://192.190.136.36:6000/rpc", // PRIMARY - Fastest & most stable
  "http://192.190.136.29:6000/rpc",
  "http://161.97.97.41:6000/rpc",
  "http://207.244.255.1:6000/rpc",
  "http://192.190.136.37:6000/rpc",
  "http://192.190.136.38:6000/rpc",
  "http://173.212.203.145:6000/rpc",
  "http://173.212.220.65:6000/rpc",
].filter(Boolean);

// Timeout configuration (in milliseconds)
export const RPC_TIMEOUT_MS = 10000;

// Maximum number of error details to return
export const MAX_ERROR_DETAILS = 5;
