import { zodResolver } from "@hookform/resolvers/zod";
import type { UseFormProps } from "react-hook-form";

export const defaultFormOptions = {
  mode: "onBlur",
  reValidateMode: "onChange",
  shouldFocusError: true,
} as const satisfies UseFormProps;

export { zodResolver };
