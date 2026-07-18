export type InsumoUnit = "ML" | "UNIDAD" | "GR";
export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA";
export type DiscountType = "NONE" | "CORTESIA" | "MANUAL";
export type OrderStatus = "COMPLETADA" | "ANULADA";

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Insumo {
  id: string;
  name: string;
  unit: InsumoUnit;
  stockQty: number;
  minThreshold: number;
  packageLabel?: string | null;
  packageSize?: number | null;
}

export interface RecipeItem {
  id: string;
  productId: string;
  insumoId: string;
  quantity: number;
  insumo: Insumo;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  category: Category;
  price: number;
  active: boolean;
  sortOrder: number;
  recipeItems: RecipeItem[];
}

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  turnNumber: number;
  cashSessionId: string;
  items: OrderItemSnapshot[];
  paymentMethod: PaymentMethod;
  discountType: DiscountType;
  discountAmount: number;
  discountReason?: string | null;
  subtotal: number;
  total: number;
  status: OrderStatus;
  cancelReason?: string | null;
  authorizedByUserId?: string | null;
  createdAt: string;
  clientRequestId: string;
  pending?: boolean;
}

export interface CashSession {
  id: string;
  openingBase: number;
  openedAt: string;
  status: "ABIERTA" | "CERRADA";
  closedAt?: string | null;
  notes?: string | null;
  consolidatedSnapshot?: Record<string, unknown> | null;
}

export interface CajaActual {
  session: CashSession | null;
  lastTurnNumber: number;
  consolidated: {
    totalVentas: number;
    totalAnuladas: number;
    totalCortesias: number;
    totalIngresos: number;
    byPaymentMethod: Record<PaymentMethod, { count: number; total: number }>;
    byCategoryUnits: Record<string, number>;
  } | null;
}

export interface AppUser {
  id: string;
  name: string;
  role: "ADMIN" | "CAJERO";
  active: boolean;
  createdAt: string;
}
