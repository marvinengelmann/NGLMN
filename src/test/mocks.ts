import type { Mock } from "vitest"

export interface MockDbChain {
  [key: string]: Mock
  select: Mock
  insert: Mock
  update: Mock
  delete: Mock
  from: Mock
  set: Mock
  values: Mock
  onConflictDoUpdate: Mock
  where: Mock
  orderBy: Mock
  limit: Mock
  returning: Mock
  transaction: Mock
  then: Mock
}

/**
 * Create a chainable mock DB object where every method returns the chain itself.
 * Use this in vi.mock("@/db/client.ts") factory functions.
 */
export function createMockDbChain(overrides?: Partial<Record<keyof MockDbChain, Mock>>): MockDbChain {
  const chain = {} as MockDbChain
  const keys: (keyof MockDbChain)[] = [
    "select",
    "insert",
    "update",
    "delete",
    "from",
    "set",
    "values",
    "onConflictDoUpdate",
    "where",
    "orderBy",
    "limit",
    "returning",
    "transaction",
    "then"
  ]
  for (const key of keys) {
    chain[key] = vi.fn().mockReturnValue(chain)
  }
  chain.transaction = vi.fn().mockImplementation((fn: (tx: MockDbChain) => Promise<unknown>) => fn(chain))
  if (overrides) {
    for (const [key, mock] of Object.entries(overrides)) {
      if (mock) chain[key] = mock
    }
  }
  return chain
}
