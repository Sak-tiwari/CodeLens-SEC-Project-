import { CheckCircle2, Clock, Bug, XCircle, MinusCircle } from "lucide-react";

/** One place that maps a test outcome to a label, icon and colour tokens (colour is never the only signal). */
export const STATUS = {
  PASS: { label: "Pass", icon: CheckCircle2, text: "text-success", bg: "bg-success-bg", solid: "bg-success-solid" },
  WRONG_ANSWER: { label: "Wrong answer", icon: MinusCircle, text: "text-warning", bg: "bg-warning-bg", solid: "bg-warning-solid" },
  COMPILATION_ERROR: { label: "Compile error", icon: XCircle, text: "text-danger", bg: "bg-danger-bg", solid: "bg-danger-solid" },
  RUNTIME_ERROR: { label: "Runtime error", icon: Bug, text: "text-purple", bg: "bg-purple-bg", solid: "bg-purple-solid" },
  TIMEOUT: { label: "Timeout", icon: Clock, text: "text-info", bg: "bg-info-bg", solid: "bg-info-solid" },
};
export const STATUS_ORDER = Object.keys(STATUS);
