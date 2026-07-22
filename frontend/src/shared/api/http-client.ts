import axios from "axios";
import { env } from "@/shared/config/env";

const commonConfiguration = {
  baseURL: env.VITE_API_BASE_URL,
  timeout: env.VITE_API_TIMEOUT_MS,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
};

export const apiClient = axios.create(commonConfiguration);

export const sessionClient = axios.create(commonConfiguration);
