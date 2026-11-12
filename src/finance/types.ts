export interface Expense {
  date: string;
  item: string;
  amount: number;
  category: string;
  receiptName?: string;
  receiptUrl?: string;
  id?: string;
  createdAt?: string;
}

export const Category = {
  Transport: "Grab/Transport/Fuel/Parking",
  Groceries: "Groceries",
  Lifestyle: "Lifestyle",
  Entertainment: "Entertainment",
  Food: "Food",
  Unknown: "Unknown",
} as const;
