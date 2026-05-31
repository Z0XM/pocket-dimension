import { refundLinkKind } from "$lib/finance/refunds";

export type TransactionWarningCode = "refund_mismatch" | "split_return_mismatch";

export type TransactionWarning = {
  code: TransactionWarningCode;
  severity: "warning";
  message: string;
  differenceMinor: number;
};

export type RefundLinkRow = {
  creditTransactionId: string;
  expenseTransactionId: string;
};

export type RefundWarningTransaction = {
  id: string;
  amountMinor: number;
  categoryName: string | null;
};

function connectedComponents(links: RefundLinkRow[]) {
  const adjacency = new Map<string, Set<string>>();

  function connect(a: string, b: string) {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }

  for (const link of links) {
    connect(link.creditTransactionId, link.expenseTransactionId);
  }

  const components: string[][] = [];
  const visited = new Set<string>();

  for (const node of adjacency.keys()) {
    if (visited.has(node)) continue;

    const component: string[] = [];
    const queue = [node];
    visited.add(node);

    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
}

export function computeRefundLinkWarnings(
  links: RefundLinkRow[],
  transactions: Map<string, RefundWarningTransaction>,
  formatDifference: (differenceMinor: number) => string
) {
  const warnings = new Map<string, TransactionWarning[]>();
  if (!links.length) return warnings;

  for (const component of connectedComponents(links)) {
    const componentSet = new Set(component);
    const componentLinks = links.filter((link) => componentSet.has(link.creditTransactionId) && componentSet.has(link.expenseTransactionId));

    const creditsInComponent = [...new Set(componentLinks.map((link) => link.creditTransactionId))];
    const expensesInComponent = [...new Set(componentLinks.map((link) => link.expenseTransactionId))];

    const creditTotal = creditsInComponent.reduce((sum, id) => sum + (transactions.get(id)?.amountMinor ?? 0), 0);
    const expenseTotal = expensesInComponent.reduce((sum, id) => sum + (transactions.get(id)?.amountMinor ?? 0), 0);
    const differenceMinor = creditTotal - expenseTotal;
    if (differenceMinor === 0) continue;

    const codes = new Set<TransactionWarningCode>();
    for (const creditId of creditsInComponent) {
      const kind = refundLinkKind(transactions.get(creditId)?.categoryName);
      if (kind === "split_return") codes.add("split_return_mismatch");
      if (kind === "refund") codes.add("refund_mismatch");
    }
    if (!codes.size) codes.add("refund_mismatch");

    const formatted = formatDifference(differenceMinor);
    const message =
      differenceMinor > 0 ? `Linked refunds exceed expenses by ${formatted}` : `Linked expenses exceed refunds by ${formatted.replace(/^-/, "")}`;

    for (const code of codes) {
      const warning: TransactionWarning = {
        code,
        severity: "warning",
        message,
        differenceMinor,
      };

      for (const txnId of component) {
        const existing = warnings.get(txnId) ?? [];
        existing.push(warning);
        warnings.set(txnId, existing);
      }
    }
  }

  return warnings;
}

export function transactionHasRefundLinks(transactionId: string, links: RefundLinkRow[]) {
  return links.some((link) => link.creditTransactionId === transactionId || link.expenseTransactionId === transactionId);
}
