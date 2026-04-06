import type { BankAccountBalance } from '../types';

/** Match Jupiter Money / Jupiter account by name (case-insensitive). */
export function findJupiterAccount(accounts: BankAccountBalance[]): BankAccountBalance | undefined {
  return accounts.find((a) => /jupiter/i.test(String(a.name).trim()));
}
