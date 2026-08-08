import "dotenv/config";

process.env.NODE_ENV = "test";
process.env.PORT = "3000";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/cmm_test";
process.env.JWT_ACCESS_SECRET =
  "test-access-secret-at-least-thirty-two-characters";
process.env.JWT_REFRESH_SECRET =
  "test-refresh-secret-at-least-thirty-two-characters";
process.env.ACCESS_TOKEN_EXPIRES = "15m";
process.env.REFRESH_TOKEN_EXPIRES = "7d";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.BANK_TRANSFER_BANK_NAME = "Test Bank";
process.env.BANK_TRANSFER_ACCOUNT_NAME = "CMM Test Account";
process.env.BANK_TRANSFER_ACCOUNT_NUMBER = "1000123456789";
