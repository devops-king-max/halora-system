import type {
  Account,
  AccountRealm,
  AccountStatusUpdateInput,
  ActionInput,
  ApiError,
  ApiErrorResponse,
  ApiResponse,
  Brand,
  BrandInput,
  Cart,
  Category,
  CategoryInput,
  CheckoutQuote,
  CheckoutQuoteInput,
  CreateInvoiceInput,
  CreateOrderInput,
  CreateOrderPaymentInput,
  Customer,
  CustomerAddress,
  CustomerAddressInput,
  CustomerAddressUpdateInput,
  CustomerAuthResult,
  CustomerProfileUpdateInput,
  Employee,
  EmployeeAccountInput,
  EmployeeInput,
  EmployeeRoleAssignInput,
  GoodsReceipt,
  GoodsReceiptDetail,
  GoodsReceiptInput,
  InventoryAdjustment,
  InventoryAdjustmentDetail,
  InventoryAdjustmentInput,
  InventoryBalance,
  Invoice,
  InvoiceDetail,
  InvoiceUpdateInput,
  ListQuery,
  MediaAsset,
  OrderAmounts,
  OrderCancelInput,
  OrderDetail,
  OrderPromotionRule,
  OrderPromotionRuleInput,
  OrderSummary,
  PaginatedResponse,
  Payment,
  PaymentActionInput,
  PaymentFailInput,
  Permission,
  Principal,
  Product,
  ProductFilterQuery,
  ProductImage,
  ProductImageInput,
  ProductInput,
  ProductPromotionRule,
  ProductPromotionRuleInput,
  ProductVariant,
  Promotion,
  PromotionInput,
  PublicProductDetail,
  PublicProductSummary,
  Refund,
  ReportData,
  ReportFilterQuery,
  Role,
  RolePermissionAssignInput,
  StaffAuthResult,
  StockMovement,
  Supplier,
  SupplierInput,
  SupplierVariant,
  SupplierVariantInput,
  UUID,
  UpdatePendingOrderInput,
  VariantInput,
  Voucher,
  VoucherInput,
} from "./types";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;
  readonly requestId: string;

  constructor(status: number, error: ApiError) {
    super(error.message || `API Error: ${error.code}`);
    this.name = "ApiClientError";
    this.status = status;
    this.code = error.code || "UNKNOWN_ERROR";
    this.fieldErrors = error.fieldErrors;
    this.requestId = error.requestId || "";
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  realm?: AccountRealm;
  getAccessToken?: () => string | null;
  setAccessToken?: (token: string | null) => void;
  getRefreshToken?: () => Promise<string | null> | string | null;
  setRefreshToken?: (token: string | null) => Promise<void> | void;
  onUnauthenticated?: () => void;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, unknown>;
  idempotencyKey?: string;
  requiresAuth?: boolean;
  isMultipart?: boolean;
  responseType?: "json" | "blob";
}

export class HaloraApiClient {
  private readonly baseUrl: string;
  private readonly realm: AccountRealm;
  private inMemoryAccessToken: string | null = null;
  private readonly getAccessTokenFn?: () => string | null;
  private readonly setAccessTokenFn?: (token: string | null) => void;
  private readonly getRefreshTokenFn?: () => Promise<string | null> | string | null;
  private readonly setRefreshTokenFn?: (token: string | null) => Promise<void> | void;
  private readonly onUnauthenticatedFn?: () => void;

  private refreshPromise: Promise<string | null> | null = null;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.realm = config.realm || "STAFF";
    this.getAccessTokenFn = config.getAccessToken;
    this.setAccessTokenFn = config.setAccessToken;
    this.getRefreshTokenFn = config.getRefreshToken;
    this.setRefreshTokenFn = config.setRefreshToken;
    this.onUnauthenticatedFn = config.onUnauthenticated;
  }

  public getAccessToken(): string | null {
    if (this.getAccessTokenFn) {
      return this.getAccessTokenFn();
    }
    return this.inMemoryAccessToken;
  }

  public setAccessToken(token: string | null): void {
    this.inMemoryAccessToken = token;
    if (this.setAccessTokenFn) {
      this.setAccessTokenFn(token);
    }
  }

  private async getRefreshToken(): Promise<string | null> {
    if (this.getRefreshTokenFn) {
      return await this.getRefreshTokenFn();
    }
    return null;
  }

  private async setRefreshToken(token: string | null): Promise<void> {
    if (this.setRefreshTokenFn) {
      await this.setRefreshTokenFn(token);
    }
  }

  private buildUrl(path: string, params?: Record<string, unknown>): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.append(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async performRefresh(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        if (this.realm === "STAFF") {
          // Staff refresh uses HttpOnly cookies
          const res = await fetch(`${this.baseUrl}/auth/staff/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          if (!res.ok) {
            throw new Error("Staff refresh failed");
          }
          const json = (await res.json()) as ApiResponse<StaffAuthResult>;
          const newToken = json.data.accessToken;
          this.setAccessToken(newToken);
          return newToken;
        } else {
          // Customer refresh uses stored refreshToken
          const refreshToken = await this.getRefreshToken();
          if (!refreshToken) {
            throw new Error("No refresh token available");
          }
          const res = await fetch(`${this.baseUrl}/auth/customer/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
          if (!res.ok) {
            throw new Error("Customer refresh failed");
          }
          const json = (await res.json()) as ApiResponse<CustomerAuthResult>;
          const newToken = json.data.accessToken;
          this.setAccessToken(newToken);
          if (json.data.refreshToken) {
            await this.setRefreshToken(json.data.refreshToken);
          }
          return newToken;
        }
      } catch (err) {
        this.setAccessToken(null);
        await this.setRefreshToken(null);
        if (this.onUnauthenticatedFn) {
          this.onUnauthenticatedFn();
        }
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = "GET",
      headers = {},
      body,
      params,
      idempotencyKey,
      requiresAuth = true,
      isMultipart = false,
      responseType = "json",
    } = options;

    const execute = async (tokenOverride?: string): Promise<Response> => {
      const reqHeaders: Record<string, string> = { ...headers };
      if (!isMultipart && body && !reqHeaders["Content-Type"]) {
        reqHeaders["Content-Type"] = "application/json";
      }

      const activeToken = tokenOverride !== undefined ? tokenOverride : this.getAccessToken();
      if (requiresAuth && activeToken) {
        reqHeaders["Authorization"] = `Bearer ${activeToken}`;
      }

      if (idempotencyKey) {
        reqHeaders["Idempotency-Key"] = idempotencyKey;
      }

      const fetchOptions: RequestInit = {
        method,
        headers: reqHeaders,
        credentials: "include", // for cookie support on web
      };

      if (body) {
        if (isMultipart) {
          fetchOptions.body = body as BodyInit;
        } else {
          fetchOptions.body = JSON.stringify(body);
        }
      }

      const fullUrl = this.buildUrl(path, params);
      return await fetch(fullUrl, fetchOptions);
    };

    let response: Response;
    try {
      response = await execute();
    } catch (networkError: unknown) {
      throw new ApiClientError(0, {
        code: "NETWORK_ERROR",
        message: "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.",
        requestId: "",
      });
    }

    // Single 401 automatic retry with refresh deduplication
    if (response.status === 401 && requiresAuth && !path.includes("/auth/")) {
      const refreshedToken = await this.performRefresh();
      if (refreshedToken) {
        try {
          response = await execute(refreshedToken);
        } catch (networkError: unknown) {
          throw new ApiClientError(0, {
            code: "NETWORK_ERROR",
            message: "Không thể kết nối đến máy chủ khi thử lại yêu cầu.",
            requestId: "",
          });
        }
      } else {
        if (this.onUnauthenticatedFn) {
          this.onUnauthenticatedFn();
        }
      }
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    if (!response.ok) {
      let errPayload: ApiErrorResponse | null = null;
      try {
        errPayload = (await response.json()) as ApiErrorResponse;
      } catch {
        // Response is not JSON
      }

      const errorInfo: ApiError = errPayload?.error || {
        code: `HTTP_${response.status}`,
        message: response.statusText || "Yêu cầu không thành công",
        requestId: response.headers.get("x-request-id") || "",
      };

      throw new ApiClientError(response.status, errorInfo);
    }

    if (responseType === "blob") {
      return (await response.blob()) as unknown as T;
    }

    return (await response.json()) as T;
  }

  // ================= AUTH METHODS =================
  public readonly auth = {
    staffLogin: async (identifier: string, password: string): Promise<StaffAuthResult> => {
      const res = await this.request<ApiResponse<StaffAuthResult>>("/auth/staff/login", {
        method: "POST",
        body: { identifier, password },
        requiresAuth: false,
      });
      this.setAccessToken(res.data.accessToken);
      return res.data;
    },

    customerLogin: async (identifier: string, password: string): Promise<CustomerAuthResult> => {
      const res = await this.request<ApiResponse<CustomerAuthResult>>("/auth/customer/login", {
        method: "POST",
        body: { identifier, password },
        requiresAuth: false,
      });
      this.setAccessToken(res.data.accessToken);
      await this.setRefreshToken(res.data.refreshToken);
      return res.data;
    },

    customerRegister: async (input: {
      fullName: string;
      username: string;
      email: string;
      phone: string;
      password: string;
    }): Promise<{ customerId: UUID; accountId: UUID }> => {
      const res = await this.request<ApiResponse<{ customerId: UUID; accountId: UUID }>>(
        "/auth/customer/register",
        {
          method: "POST",
          body: input,
          requiresAuth: false,
        }
      );
      return res.data;
    },

    staffRefresh: async (): Promise<StaffAuthResult> => {
      const res = await this.request<ApiResponse<StaffAuthResult>>("/auth/staff/refresh", {
        method: "POST",
        requiresAuth: false,
      });
      this.setAccessToken(res.data.accessToken);
      return res.data;
    },

    customerRefresh: async (refreshToken: string): Promise<CustomerAuthResult> => {
      const res = await this.request<ApiResponse<CustomerAuthResult>>("/auth/customer/refresh", {
        method: "POST",
        body: { refreshToken },
        requiresAuth: false,
      });
      this.setAccessToken(res.data.accessToken);
      if (res.data.refreshToken) {
        await this.setRefreshToken(res.data.refreshToken);
      }
      return res.data;
    },

    staffLogout: async (): Promise<{ message: string }> => {
      try {
        const res = await this.request<ApiResponse<{ message: string }>>("/auth/staff/logout", {
          method: "POST",
          requiresAuth: true,
        });
        return res.data;
      } finally {
        this.setAccessToken(null);
      }
    },

    customerLogout: async (refreshToken: string): Promise<{ message: string }> => {
      try {
        const res = await this.request<ApiResponse<{ message: string }>>("/auth/customer/logout", {
          method: "POST",
          body: { refreshToken },
          requiresAuth: true,
        });
        return res.data;
      } finally {
        this.setAccessToken(null);
        await this.setRefreshToken(null);
      }
    },

    getMe: async (): Promise<Principal> => {
      const res = await this.request<ApiResponse<Principal>>("/auth/me", {
        method: "GET",
        requiresAuth: true,
      });
      return res.data;
    },

    changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
      const res = await this.request<ApiResponse<{ message: string }>>("/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
        requiresAuth: true,
      });
      return res.data;
    },

    staffForgotPassword: async (email: string): Promise<{ message: string }> => {
      const res = await this.request<ApiResponse<{ message: string }>>("/auth/staff/forgot-password", {
        method: "POST",
        body: { email },
        requiresAuth: false,
      });
      return res.data;
    },

    customerForgotPassword: async (email: string): Promise<{ message: string }> => {
      const res = await this.request<ApiResponse<{ message: string }>>("/auth/customer/forgot-password", {
        method: "POST",
        body: { email },
        requiresAuth: false,
      });
      return res.data;
    },

    staffResetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
      const res = await this.request<ApiResponse<{ message: string }>>("/auth/staff/reset-password", {
        method: "POST",
        body: { token, newPassword },
        requiresAuth: false,
      });
      return res.data;
    },

    customerResetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
      const res = await this.request<ApiResponse<{ message: string }>>("/auth/customer/reset-password", {
        method: "POST",
        body: { token, newPassword },
        requiresAuth: false,
      });
      return res.data;
    },
  };

  // ================= CATEGORIES =================
  public readonly categories = {
    listPublic: (query?: ListQuery) =>
      this.request<PaginatedResponse<Category>>("/categories", {
        method: "GET",
        params: query as Record<string, unknown>,
        requiresAuth: false,
      }),

    listAdmin: (query?: ListQuery & { status?: string }) =>
      this.request<PaginatedResponse<Category>>("/admin/categories", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdmin: (id: UUID) =>
      this.request<ApiResponse<Category>>(`/admin/categories/${id}`, { method: "GET" }).then((r) => r.data),

    createAdmin: (input: CategoryInput) =>
      this.request<ApiResponse<Category>>("/admin/categories", {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateAdmin: (id: UUID, input: CategoryInput & { version: number }) =>
      this.request<ApiResponse<Category>>(`/admin/categories/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteAdmin: (id: UUID) =>
      this.request<void>(`/admin/categories/${id}`, { method: "DELETE" }),
  };

  // ================= BRANDS =================
  public readonly brands = {
    listPublic: (query?: ListQuery) =>
      this.request<PaginatedResponse<Brand>>("/brands", {
        method: "GET",
        params: query as Record<string, unknown>,
        requiresAuth: false,
      }),

    listAdmin: (query?: ListQuery & { status?: string }) =>
      this.request<PaginatedResponse<Brand>>("/admin/brands", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdmin: (id: UUID) =>
      this.request<ApiResponse<Brand>>(`/admin/brands/${id}`, { method: "GET" }).then((r) => r.data),

    createAdmin: (input: BrandInput) =>
      this.request<ApiResponse<Brand>>("/admin/brands", {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateAdmin: (id: UUID, input: BrandInput & { version: number }) =>
      this.request<ApiResponse<Brand>>(`/admin/brands/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteAdmin: (id: UUID) =>
      this.request<void>(`/admin/brands/${id}`, { method: "DELETE" }),
  };

  // ================= PRODUCTS =================
  public readonly products = {
    listPublic: (query?: ProductFilterQuery) =>
      this.request<PaginatedResponse<PublicProductSummary>>("/products", {
        method: "GET",
        params: query as Record<string, unknown>,
        requiresAuth: false,
      }),

    getPublic: (id: UUID) =>
      this.request<ApiResponse<PublicProductDetail>>(`/products/${id}`, {
        method: "GET",
        requiresAuth: false,
      }).then((r) => r.data),

    listAdmin: (query?: ProductFilterQuery & { status?: string }) =>
      this.request<PaginatedResponse<Product>>("/admin/products", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdmin: (id: UUID) =>
      this.request<ApiResponse<Product>>(`/admin/products/${id}`, { method: "GET" }).then((r) => r.data),

    createAdmin: (input: ProductInput) =>
      this.request<ApiResponse<Product>>("/admin/products", {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateAdmin: (id: UUID, input: ProductInput & { version: number }) =>
      this.request<ApiResponse<Product>>(`/admin/products/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteAdmin: (id: UUID) =>
      this.request<void>(`/admin/products/${id}`, { method: "DELETE" }),

    // Variants
    listVariants: (productId: UUID, query?: ListQuery) =>
      this.request<PaginatedResponse<ProductVariant>>(`/admin/products/${productId}/variants`, {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    createVariant: (productId: UUID, input: VariantInput) =>
      this.request<ApiResponse<ProductVariant>>(`/admin/products/${productId}/variants`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateVariant: (productId: UUID, id: UUID, input: VariantInput & { version: number }) =>
      this.request<ApiResponse<ProductVariant>>(`/admin/products/${productId}/variants/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteVariant: (productId: UUID, id: UUID) =>
      this.request<void>(`/admin/products/${productId}/variants/${id}`, { method: "DELETE" }),

    // Images
    listImages: (productId: UUID) =>
      this.request<ApiResponse<ProductImage[]>>(`/admin/products/${productId}/images`, {
        method: "GET",
      }).then((r) => r.data),

    createImage: (productId: UUID, input: ProductImageInput) =>
      this.request<ApiResponse<ProductImage>>(`/admin/products/${productId}/images`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateImage: (
      productId: UUID,
      id: UUID,
      input: { variantId?: string | null; altText?: string | null; sortOrder?: number; version: number }
    ) =>
      this.request<ApiResponse<ProductImage>>(`/admin/products/${productId}/images/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteImage: (productId: UUID, id: UUID) =>
      this.request<void>(`/admin/products/${productId}/images/${id}`, { method: "DELETE" }),
  };

  // ================= MEDIA =================
  public readonly media = {
    upload: (formData: FormData) =>
      this.request<ApiResponse<MediaAsset>>("/admin/media", {
        method: "POST",
        body: formData,
        isMultipart: true,
      }).then((r) => r.data),
  };

  // ================= CUSTOMER PORTAL (/me) =================
  public readonly customerPortal = {
    getProfile: () =>
      this.request<ApiResponse<Customer>>("/me/profile", { method: "GET" }).then((r) => r.data),

    updateProfile: (input: CustomerProfileUpdateInput) =>
      this.request<ApiResponse<Customer>>("/me/profile", {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    listAddresses: () =>
      this.request<ApiResponse<CustomerAddress[]>>("/me/addresses", { method: "GET" }).then((r) => r.data),

    createAddress: (input: CustomerAddressInput) =>
      this.request<ApiResponse<CustomerAddress>>("/me/addresses", {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateAddress: (id: UUID, input: CustomerAddressUpdateInput) =>
      this.request<ApiResponse<CustomerAddress>>(`/me/addresses/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteAddress: (id: UUID) =>
      this.request<void>(`/me/addresses/${id}`, { method: "DELETE" }),
  };

  // ================= CART =================
  public readonly cart = {
    getCart: () =>
      this.request<ApiResponse<Cart>>("/me/cart", { method: "GET" }).then((r) => r.data),

    addItem: (variantId: UUID, quantity: number) =>
      this.request<ApiResponse<Cart>>("/me/cart/items", {
        method: "POST",
        body: { variantId, quantity },
      }).then((r) => r.data),

    updateItem: (id: UUID, quantity: number, version: number) =>
      this.request<ApiResponse<Cart>>(`/me/cart/items/${id}`, {
        method: "PATCH",
        body: { quantity, version },
      }).then((r) => r.data),

    removeItem: (id: UUID, version: number) =>
      this.request<void>(`/me/cart/items/${id}`, {
        method: "DELETE",
        params: { version },
      }),

    clearCart: (version: number) =>
      this.request<void>("/me/cart/items", {
        method: "DELETE",
        params: { version },
      }),
  };

  // ================= CHECKOUT =================
  public readonly checkout = {
    getQuote: (input: CheckoutQuoteInput) =>
      this.request<ApiResponse<CheckoutQuote>>("/me/checkout/quote", {
        method: "POST",
        body: input,
      }).then((r) => r.data),
  };

  // ================= ORDERS =================
  public readonly orders = {
    create: (input: CreateOrderInput, idempotencyKey: string) =>
      this.request<ApiResponse<OrderDetail>>("/me/orders", {
        method: "POST",
        body: input,
        idempotencyKey,
      }).then((r) => r.data),

    listMy: (query?: ListQuery & { status?: string; from?: string; to?: string }) =>
      this.request<PaginatedResponse<OrderSummary>>("/me/orders", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getMy: (id: UUID) =>
      this.request<ApiResponse<OrderDetail>>(`/me/orders/${id}`, { method: "GET" }).then((r) => r.data),

    updatePending: (id: UUID, input: UpdatePendingOrderInput) =>
      this.request<ApiResponse<OrderDetail>>(`/me/orders/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    cancelMy: (id: UUID, input: OrderCancelInput) =>
      this.request<ApiResponse<OrderDetail>>(`/me/orders/${id}/cancel`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    // Admin order methods
    listAdmin: (query?: ListQuery & { status?: string; paymentMethod?: string; from?: string; to?: string }) =>
      this.request<PaginatedResponse<OrderSummary>>("/admin/orders", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdmin: (id: UUID) =>
      this.request<ApiResponse<OrderDetail>>(`/admin/orders/${id}`, { method: "GET" }).then((r) => r.data),

    confirm: (id: UUID, input: ActionInput, idempotencyKey: string) =>
      this.request<ApiResponse<OrderDetail>>(`/admin/orders/${id}/confirm`, {
        method: "POST",
        body: input,
        idempotencyKey,
      }).then((r) => r.data),

    dispatch: (id: UUID, input: ActionInput) =>
      this.request<ApiResponse<OrderDetail>>(`/admin/orders/${id}/dispatch`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    complete: (id: UUID, input: ActionInput) =>
      this.request<ApiResponse<OrderDetail>>(`/admin/orders/${id}/complete`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    cancelAdmin: (id: UUID, input: OrderCancelInput) =>
      this.request<ApiResponse<OrderDetail>>(`/admin/orders/${id}/cancel`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    createPayment: (id: UUID, input: CreateOrderPaymentInput) =>
      this.request<ApiResponse<Payment>>(`/admin/orders/${id}/payments`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),
  };

  // ================= PAYMENTS & REFUNDS =================
  public readonly payments = {
    confirmPayment: (id: UUID, input: PaymentActionInput | undefined, idempotencyKey: string) =>
      this.request<ApiResponse<Payment>>(`/admin/payments/${id}/confirm`, {
        method: "POST",
        body: input || {},
        idempotencyKey,
      }).then((r) => r.data),

    failPayment: (id: UUID, input: PaymentFailInput) =>
      this.request<ApiResponse<Payment>>(`/admin/payments/${id}/fail`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    confirmRefund: (id: UUID, input: PaymentActionInput | undefined, idempotencyKey: string) =>
      this.request<ApiResponse<Refund>>(`/admin/refunds/${id}/confirm`, {
        method: "POST",
        body: input || {},
        idempotencyKey,
      }).then((r) => r.data),

    failRefund: (id: UUID, input: PaymentFailInput) =>
      this.request<ApiResponse<Refund>>(`/admin/refunds/${id}/fail`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),
  };

  // ================= INVOICES =================
  public readonly invoices = {
    createFromOrder: (orderId: UUID, input?: CreateInvoiceInput) =>
      this.request<ApiResponse<InvoiceDetail>>(`/admin/orders/${orderId}/invoice`, {
        method: "POST",
        body: input || {},
      }).then((r) => r.data),

    listAdmin: (query?: ListQuery & { status?: string; from?: string; to?: string }) =>
      this.request<PaginatedResponse<Invoice>>("/admin/invoices", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdmin: (id: UUID) =>
      this.request<ApiResponse<InvoiceDetail>>(`/admin/invoices/${id}`, { method: "GET" }).then((r) => r.data),

    updateAdmin: (id: UUID, input: InvoiceUpdateInput) =>
      this.request<ApiResponse<InvoiceDetail>>(`/admin/invoices/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteAdmin: (id: UUID) =>
      this.request<void>(`/admin/invoices/${id}`, { method: "DELETE" }),

    refreshItems: (id: UUID, input: ActionInput) =>
      this.request<ApiResponse<InvoiceDetail>>(`/admin/invoices/${id}/refresh-items`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    post: (id: UUID, input: ActionInput, idempotencyKey: string) =>
      this.request<ApiResponse<InvoiceDetail>>(`/admin/invoices/${id}/post`, {
        method: "POST",
        body: input,
        idempotencyKey,
      }).then((r) => r.data),

    exportPdf: (id: UUID) =>
      this.request<Blob>(`/admin/invoices/${id}/export`, {
        method: "GET",
        params: { format: "pdf" },
        responseType: "blob",
      }),
  };

  // ================= SUPPLIERS =================
  public readonly suppliers = {
    listAdmin: (query?: ListQuery & { status?: string }) =>
      this.request<PaginatedResponse<Supplier>>("/admin/suppliers", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdmin: (id: UUID) =>
      this.request<ApiResponse<Supplier>>(`/admin/suppliers/${id}`, { method: "GET" }).then((r) => r.data),

    createAdmin: (input: SupplierInput) =>
      this.request<ApiResponse<Supplier>>("/admin/suppliers", {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateAdmin: (id: UUID, input: SupplierInput & { version: number }) =>
      this.request<ApiResponse<Supplier>>(`/admin/suppliers/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteAdmin: (id: UUID) =>
      this.request<void>(`/admin/suppliers/${id}`, { method: "DELETE" }),

    listVariants: (supplierId: UUID, query?: ListQuery) =>
      this.request<PaginatedResponse<SupplierVariant>>(`/admin/suppliers/${supplierId}/variants`, {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    createVariant: (supplierId: UUID, input: SupplierVariantInput) =>
      this.request<ApiResponse<SupplierVariant>>(`/admin/suppliers/${supplierId}/variants`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateVariant: (
      supplierId: UUID,
      id: UUID,
      input: { quotedCostPrice?: string; status?: string; version: number }
    ) =>
      this.request<ApiResponse<SupplierVariant>>(`/admin/suppliers/${supplierId}/variants/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteVariant: (supplierId: UUID, id: UUID) =>
      this.request<void>(`/admin/suppliers/${supplierId}/variants/${id}`, { method: "DELETE" }),
  };

  // ================= GOODS RECEIPTS =================
  public readonly goodsReceipts = {
    listAdmin: (query?: ListQuery & { supplierId?: string; status?: string; from?: string; to?: string }) =>
      this.request<PaginatedResponse<GoodsReceipt>>("/admin/goods-receipts", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdmin: (id: UUID) =>
      this.request<ApiResponse<GoodsReceiptDetail>>(`/admin/goods-receipts/${id}`, { method: "GET" }).then(
        (r) => r.data
      ),

    createAdmin: (input: GoodsReceiptInput) =>
      this.request<ApiResponse<GoodsReceiptDetail>>("/admin/goods-receipts", {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateAdmin: (id: UUID, input: GoodsReceiptInput & { version: number }) =>
      this.request<ApiResponse<GoodsReceiptDetail>>(`/admin/goods-receipts/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteAdmin: (id: UUID) =>
      this.request<void>(`/admin/goods-receipts/${id}`, { method: "DELETE" }),

    post: (id: UUID, input: ActionInput, idempotencyKey: string) =>
      this.request<ApiResponse<GoodsReceiptDetail>>(`/admin/goods-receipts/${id}/post`, {
        method: "POST",
        body: input,
        idempotencyKey,
      }).then((r) => r.data),

    exportPdf: (id: UUID) =>
      this.request<Blob>(`/admin/goods-receipts/${id}/export`, {
        method: "GET",
        params: { format: "pdf" },
        responseType: "blob",
      }),
  };

  // ================= INVENTORY =================
  public readonly inventory = {
    getBalances: (query?: ListQuery & { productId?: string; lowStockOnly?: boolean }) =>
      this.request<PaginatedResponse<InventoryBalance>>("/admin/inventory/balances", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getMovements: (query?: ListQuery & { variantId?: string; type?: string; from?: string; to?: string }) =>
      this.request<PaginatedResponse<StockMovement>>("/admin/inventory/movements", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    listAdjustments: (query?: ListQuery & { status?: string; from?: string; to?: string }) =>
      this.request<PaginatedResponse<InventoryAdjustment>>("/admin/inventory-adjustments", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdjustment: (id: UUID) =>
      this.request<ApiResponse<InventoryAdjustmentDetail>>(`/admin/inventory-adjustments/${id}`, {
        method: "GET",
      }).then((r) => r.data),

    createAdjustment: (input: InventoryAdjustmentInput) =>
      this.request<ApiResponse<InventoryAdjustmentDetail>>("/admin/inventory-adjustments", {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateAdjustment: (id: UUID, input: InventoryAdjustmentInput & { version: number }) =>
      this.request<ApiResponse<InventoryAdjustmentDetail>>(`/admin/inventory-adjustments/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteAdjustment: (id: UUID) =>
      this.request<void>(`/admin/inventory-adjustments/${id}`, { method: "DELETE" }),

    postAdjustment: (id: UUID, input: ActionInput, idempotencyKey: string) =>
      this.request<ApiResponse<InventoryAdjustmentDetail>>(`/admin/inventory-adjustments/${id}/post`, {
        method: "POST",
        body: input,
        idempotencyKey,
      }).then((r) => r.data),
  };

  // ================= PROMOTIONS =================
  public readonly promotions = {
    listAdmin: (query?: ListQuery & { status?: string }) =>
      this.request<PaginatedResponse<Promotion>>("/admin/promotions", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdmin: (id: UUID) =>
      this.request<ApiResponse<Promotion>>(`/admin/promotions/${id}`, { method: "GET" }).then((r) => r.data),

    createAdmin: (input: PromotionInput) =>
      this.request<ApiResponse<Promotion>>("/admin/promotions", {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateAdmin: (id: UUID, input: PromotionInput & { version: number }) =>
      this.request<ApiResponse<Promotion>>(`/admin/promotions/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteAdmin: (id: UUID) =>
      this.request<void>(`/admin/promotions/${id}`, { method: "DELETE" }),

    // Product rules
    listProductRules: (promotionId: UUID, query?: ListQuery) =>
      this.request<PaginatedResponse<ProductPromotionRule>>(`/admin/promotions/${promotionId}/product-rules`, {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    createProductRule: (promotionId: UUID, input: ProductPromotionRuleInput) =>
      this.request<ApiResponse<ProductPromotionRule>>(`/admin/promotions/${promotionId}/product-rules`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateProductRule: (promotionId: UUID, id: UUID, input: ProductPromotionRuleInput & { version: number }) =>
      this.request<ApiResponse<ProductPromotionRule>>(`/admin/promotions/${promotionId}/product-rules/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteProductRule: (promotionId: UUID, id: UUID) =>
      this.request<void>(`/admin/promotions/${promotionId}/product-rules/${id}`, { method: "DELETE" }),

    // Order rules
    listOrderRules: (promotionId: UUID, query?: ListQuery) =>
      this.request<PaginatedResponse<OrderPromotionRule>>(`/admin/promotions/${promotionId}/order-rules`, {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    createOrderRule: (promotionId: UUID, input: OrderPromotionRuleInput) =>
      this.request<ApiResponse<OrderPromotionRule>>(`/admin/promotions/${promotionId}/order-rules`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateOrderRule: (promotionId: UUID, id: UUID, input: OrderPromotionRuleInput & { version: number }) =>
      this.request<ApiResponse<OrderPromotionRule>>(`/admin/promotions/${promotionId}/order-rules/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteOrderRule: (promotionId: UUID, id: UUID) =>
      this.request<void>(`/admin/promotions/${promotionId}/order-rules/${id}`, { method: "DELETE" }),

    // Vouchers
    listVouchers: (promotionId: UUID, query?: ListQuery) =>
      this.request<PaginatedResponse<Voucher>>(`/admin/promotions/${promotionId}/vouchers`, {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    createVoucher: (promotionId: UUID, input: VoucherInput) =>
      this.request<ApiResponse<Voucher>>(`/admin/promotions/${promotionId}/vouchers`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateVoucher: (promotionId: UUID, id: UUID, input: VoucherInput & { version: number }) =>
      this.request<ApiResponse<Voucher>>(`/admin/promotions/${promotionId}/vouchers/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteVoucher: (promotionId: UUID, id: UUID) =>
      this.request<void>(`/admin/promotions/${promotionId}/vouchers/${id}`, { method: "DELETE" }),
  };

  // ================= EMPLOYEES =================
  public readonly employees = {
    listAdmin: (query?: ListQuery & { status?: string }) =>
      this.request<PaginatedResponse<Employee>>("/admin/employees", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdmin: (id: UUID) =>
      this.request<ApiResponse<Employee>>(`/admin/employees/${id}`, { method: "GET" }).then((r) => r.data),

    createAdmin: (input: EmployeeInput) =>
      this.request<ApiResponse<Employee>>("/admin/employees", {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    updateAdmin: (id: UUID, input: EmployeeInput & { version: number }) =>
      this.request<ApiResponse<Employee>>(`/admin/employees/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteAdmin: (id: UUID) =>
      this.request<void>(`/admin/employees/${id}`, { method: "DELETE" }),

    createAccount: (id: UUID, input: EmployeeAccountInput) =>
      this.request<ApiResponse<Account>>(`/admin/employees/${id}/account`, {
        method: "POST",
        body: input,
      }).then((r) => r.data),

    assignRoles: (id: UUID, input: EmployeeRoleAssignInput) =>
      this.request<ApiResponse<Employee>>(`/admin/employees/${id}/roles`, {
        method: "PUT",
        body: input,
      }).then((r) => r.data),
  };

  // ================= ADMIN CUSTOMERS =================
  public readonly customers = {
    listAdmin: (query?: ListQuery & { status?: string; accountStatus?: string }) =>
      this.request<PaginatedResponse<Customer>>("/admin/customers", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdmin: (id: UUID) =>
      this.request<ApiResponse<Customer>>(`/admin/customers/${id}`, { method: "GET" }).then((r) => r.data),

    updateAdmin: (id: UUID, input: { fullName?: string; phone?: string; status?: string; version: number }) =>
      this.request<ApiResponse<Customer>>(`/admin/customers/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),

    deleteAdmin: (id: UUID) =>
      this.request<void>(`/admin/customers/${id}`, { method: "DELETE" }),

    listAddressesAdmin: (id: UUID) =>
      this.request<ApiResponse<CustomerAddress[]>>(`/admin/customers/${id}/addresses`, {
        method: "GET",
      }).then((r) => r.data),

    listOrdersAdmin: (id: UUID, query?: ListQuery) =>
      this.request<PaginatedResponse<OrderSummary>>(`/admin/customers/${id}/orders`, {
        method: "GET",
        params: query as Record<string, unknown>,
      }),
  };

  // ================= ADMIN ACCOUNTS =================
  public readonly accounts = {
    listAdmin: (query?: ListQuery & { realm?: string; status?: string }) =>
      this.request<PaginatedResponse<Account>>("/admin/accounts", {
        method: "GET",
        params: query as Record<string, unknown>,
      }),

    getAdmin: (id: UUID) =>
      this.request<ApiResponse<Account>>(`/admin/accounts/${id}`, { method: "GET" }).then((r) => r.data),

    updateStatus: (id: UUID, input: AccountStatusUpdateInput) =>
      this.request<ApiResponse<Account>>(`/admin/accounts/${id}`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),
  };

  // ================= ROLES & PERMISSIONS =================
  public readonly roles = {
    listAdmin: () =>
      this.request<ApiResponse<Role[]>>("/admin/roles", { method: "GET" }).then((r) => r.data),

    listPermissionsAdmin: () =>
      this.request<ApiResponse<Permission[]>>("/admin/permissions", { method: "GET" }).then((r) => r.data),

    assignPermissions: (id: UUID, input: RolePermissionAssignInput) =>
      this.request<ApiResponse<Role>>(`/admin/roles/${id}/permissions`, {
        method: "PATCH",
        body: input,
      }).then((r) => r.data),
  };

  // ================= DASHBOARD & REPORTS =================
  public readonly dashboard = {
    getAdmin: (params?: { from?: string; to?: string }) =>
      this.request<ApiResponse<ReportData>>("/admin/dashboard", {
        method: "GET",
        params,
      }).then((r) => r.data),
  };

  public readonly reports = {
    getSales: (query?: ReportFilterQuery) =>
      this.request<ApiResponse<ReportData>>("/admin/reports/sales", {
        method: "GET",
        params: query as Record<string, unknown>,
      }).then((r) => r.data),

    getPayments: (query?: ReportFilterQuery) =>
      this.request<ApiResponse<ReportData>>("/admin/reports/payments", {
        method: "GET",
        params: query as Record<string, unknown>,
      }).then((r) => r.data),

    getInventory: (query?: ReportFilterQuery) =>
      this.request<ApiResponse<ReportData>>("/admin/reports/inventory", {
        method: "GET",
        params: query as Record<string, unknown>,
      }).then((r) => r.data),

    getPurchases: (query?: ReportFilterQuery) =>
      this.request<ApiResponse<ReportData>>("/admin/reports/purchases", {
        method: "GET",
        params: query as Record<string, unknown>,
      }).then((r) => r.data),

    getPromotions: (query?: ReportFilterQuery) =>
      this.request<ApiResponse<ReportData>>("/admin/reports/promotions", {
        method: "GET",
        params: query as Record<string, unknown>,
      }).then((r) => r.data),

    getActivity: (query?: ReportFilterQuery) =>
      this.request<ApiResponse<ReportData>>("/admin/reports/activity", {
        method: "GET",
        params: query as Record<string, unknown>,
      }).then((r) => r.data),

    export: (reportType: string, format: "xlsx" | "pdf", query?: ReportFilterQuery) =>
      this.request<Blob>(`/admin/reports/${reportType}/export`, {
        method: "GET",
        params: { ...query, format } as Record<string, unknown>,
        responseType: "blob",
      }),
  };
}
