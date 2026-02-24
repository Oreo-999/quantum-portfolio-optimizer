import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 300_000, // 5 min — IBM queue can be slow
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

export async function optimizePortfolio(payload) {
  const { data } = await api.post("/optimize", payload);
  return data;
}

export async function validateTickers(tickers) {
  const params = new URLSearchParams();
  tickers.forEach((t) => params.append("tickers", t));
  const { data } = await api.get(`/validate-tickers?${params.toString()}`);
  return data;
}

export async function checkHealth() {
  const { data } = await api.get("/health");
  return data;
}
