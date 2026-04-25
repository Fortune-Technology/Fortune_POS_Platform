/**
 * API client for the ecom-backend.
 * Used in both getStaticProps (server-side) and client-side fetches.
 */

import axios from 'axios';
import type {
  Store,
  Product,
  ProductListResponse,
  Department,
  EcomPage,
  CartItem,
} from '@storeveu/types';

const ECOM_API_URL = process.env.ECOM_API_URL || 'http://localhost:5005/api';

const api = axios.create({
  baseURL: ECOM_API_URL,
  timeout: 10000,
});

/* ── Store ───────────────────────────────────────────────────────────────── */

export async function getStoreInfo(slug: string): Promise<Store> {
  const { data } = await api.get(`/store/${slug}`);
  return data.data;
}

/* ── Products ───────────────────────────────────────────────────────────── */

export async function getProducts(
  slug: string,
  params: Record<string, unknown> = {}
): Promise<ProductListResponse> {
  const { data } = await api.get(`/store/${slug}/products`, { params });
  return data;
}

export async function getProduct(slug: string, productSlug: string): Promise<Product> {
  const { data } = await api.get(`/store/${slug}/products/${productSlug}`);
  return data.data;
}

/* ── Departments ────────────────────────────────────────────────────────── */

export async function getDepartments(slug: string): Promise<Department[]> {
  const { data } = await api.get(`/store/${slug}/departments`);
  return data.data;
}

/* ── Pages ──────────────────────────────────────────────────────────────── */

export async function getPages(slug: string): Promise<EcomPage[]> {
  const { data } = await api.get(`/store/${slug}/pages`);
  return data.data;
}

export async function getPage(slug: string, pageSlug: string): Promise<EcomPage> {
  const { data } = await api.get(`/store/${slug}/pages/${pageSlug}`);
  return data.data;
}

/* ── Cart ────────────────────────────────────────────────────────────────── */

export interface ServerCart {
  sessionId: string;
  items: CartItem[];
  [key: string]: unknown;
}

export async function getCart(slug: string, sessionId: string): Promise<ServerCart> {
  const { data } = await api.get(`/store/${slug}/cart/${sessionId}`);
  return data.data;
}

export async function updateCart(
  slug: string,
  sessionId: string,
  items: CartItem[]
): Promise<ServerCart> {
  const { data } = await api.put(`/store/${slug}/cart`, { sessionId, items });
  return data.data;
}

/* ── Checkout ───────────────────────────────────────────────────────────── */

/**
 * Response from POST /store/:slug/checkout.
 *
 * - For card payments (Dejavoo HPP), `paymentUrl` is the iPOSpays hosted-page
 *   URL the storefront must redirect the shopper to. `paymentStatus` will be
 *   `'pending'` until the webhook confirms.
 * - For cash-on-pickup, `paymentUrl` is omitted and the order is `confirmed`
 *   immediately.
 */
export interface CheckoutResponse {
  id: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  paymentUrl?: string;
  [key: string]: unknown;
}

export async function submitCheckout(
  slug: string,
  orderData: Record<string, unknown>
): Promise<CheckoutResponse> {
  const { data } = await api.post(`/store/${slug}/checkout`, orderData);
  return data.data;
}

/**
 * Public order lookup, scoped by email. Used by the order confirmation
 * page to poll for payment status after the shopper returns from the
 * iPOSpays hosted page.
 */
export interface PublicOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  grandTotal?: number | string;
  fulfillmentType?: string;
  lineItems?: unknown[];
  cancelReason?: string;
  [key: string]: unknown;
}

export async function fetchPublicOrder(
  slug: string,
  orderId: string,
  email: string
): Promise<PublicOrder> {
  const { data } = await api.get(`/store/${slug}/order/${orderId}`, { params: { email } });
  return data.data;
}
