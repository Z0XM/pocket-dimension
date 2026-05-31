export const REFUND_CATEGORY_NAME = "Refund";
export const SPLIT_RETURN_CATEGORY_NAME = "Split Return";

export function isRefundCategoryName(name: string | null | undefined) {
  return name === REFUND_CATEGORY_NAME || name === SPLIT_RETURN_CATEGORY_NAME;
}

export function refundLinkKind(name: string | null | undefined): "refund" | "split_return" | null {
  if (name === REFUND_CATEGORY_NAME) return "refund";
  if (name === SPLIT_RETURN_CATEGORY_NAME) return "split_return";
  return null;
}
