// Amounts are preformatted strings, never cents.
export function renderReceipt(order) {
  return `${order.item}\nTotal: ${order.total}\nReturns within 14 days with receipt.`;
}
