import multer from "multer";

const MAX_PAYMENT_PROOF_SIZE = 5 * 1024 * 1024;

export const uploadPaymentProof = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PAYMENT_PROOF_SIZE,
    files: 1,
    fields: 2,
  },
}).single("proof");
