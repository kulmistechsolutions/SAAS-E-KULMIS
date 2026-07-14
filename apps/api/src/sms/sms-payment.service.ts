import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  PurchaseSmsPackageInput,
  TestWaafiConnectionInput,
  UpdateWaafiConfigInput,
} from "@ekulmis/shared";
import { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  isApprovedCallbackStatus,
  normalizeWaafiAccount,
  waafiApiPurchase,
  waafiGetTranInfo,
  waafiHppPurchase,
  waafiTestConnection,
  type WaafiCredentials,
} from "./waafi.client";

const ORDER_TTL_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class SmsPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Waafi config (platform) ──────────────────────────────────────────────

  async getWaafiConfig() {
    const row = await this.ensureWaafiConfig();
    return this.mapWaafiConfig(row);
  }

  private mapWaafiConfig(row: {
    id: string;
    enabled: boolean;
    baseUrl: string;
    merchantUid: string;
    apiUserId: string;
    apiKey: string;
    storeId: string;
    hppKey: string;
    defaultMethod: string;
    currency: string;
    callbackBaseUrl: string | null;
    connectionStatus: string;
    connectionMessage: string | null;
    lastTestedAt: Date | null;
    lastSuccessAt: Date | null;
    connectionVerified: boolean;
    simulationMode: boolean;
    updatedAt: Date;
  }) {
    const paymentsUnlocked =
      row.simulationMode || (row.connectionVerified && row.enabled);
    return {
      id: row.id,
      enabled: row.enabled,
      baseUrl: row.baseUrl,
      merchantUid: row.merchantUid,
      apiUserId: row.apiUserId,
      hasApiKey: Boolean(row.apiKey),
      storeId: row.storeId,
      hasHppKey: Boolean(row.hppKey),
      defaultMethod: row.defaultMethod as "API_PURCHASE" | "HPP_PURCHASE",
      currency: row.currency,
      callbackBaseUrl: row.callbackBaseUrl,
      connectionStatus: row.connectionStatus as
        | "CONNECTED"
        | "DISCONNECTED"
        | "ERROR",
      connectionMessage: row.connectionMessage,
      lastTestedAt: row.lastTestedAt,
      lastSuccessAt: row.lastSuccessAt,
      connectionVerified: row.connectionVerified,
      simulationMode: row.simulationMode,
      paymentsUnlocked,
      updatedAt: row.updatedAt,
    };
  }

  private async ensureWaafiConfig() {
    const existing = await this.prisma.waafiPaymentConfig.findFirst();
    if (existing) return existing;
    return this.prisma.waafiPaymentConfig.create({
      data: {
        baseUrl:
          process.env.WAAFI_BASE_URL ?? "https://sandbox.waafipay.net/asm",
        merchantUid: process.env.WAAFI_MERCHANT_UID ?? "",
        apiUserId: process.env.WAAFI_API_USER_ID ?? "",
        apiKey: process.env.WAAFI_API_KEY ?? "",
        storeId: process.env.WAAFI_STORE_ID ?? "",
        hppKey: process.env.WAAFI_HPP_KEY ?? "",
        callbackBaseUrl: process.env.WAAFI_CALLBACK_BASE_URL ?? null,
      },
    });
  }

  private toCreds(row: {
    baseUrl: string;
    merchantUid: string;
    apiUserId: string;
    apiKey: string;
    storeId: string;
    hppKey: string;
  }): WaafiCredentials {
    return {
      baseUrl: row.baseUrl,
      merchantUid: row.merchantUid,
      apiUserId: row.apiUserId,
      apiKey: row.apiKey,
      storeId: row.storeId,
      hppKey: row.hppKey,
    };
  }

  async testWaafiConnection(input: TestWaafiConnectionInput, adminId?: string) {
    const existing = await this.ensureWaafiConfig();
    const merged = {
      baseUrl: input.baseUrl?.trim() || existing.baseUrl,
      merchantUid: input.merchantUid?.trim() || existing.merchantUid,
      apiUserId: input.apiUserId?.trim() || existing.apiUserId,
      apiKey:
        input.apiKey && input.apiKey.length > 0 ? input.apiKey : existing.apiKey,
      storeId: input.storeId?.trim() || existing.storeId,
      hppKey:
        input.hppKey && input.hppKey.length > 0 ? input.hppKey : existing.hppKey,
    };

    const test = await waafiTestConnection(merged);

    if (!test.ok) {
      const updated = await this.prisma.waafiPaymentConfig.update({
        where: { id: existing.id },
        data: {
          connectionStatus: test.status,
          connectionMessage: test.message,
          lastTestedAt: new Date(test.testedAt),
          connectionVerified: false,
        },
      });
      return { config: this.mapWaafiConfig(updated), test };
    }

    const saveOnSuccess = input.saveOnSuccess !== false;
    const data: Prisma.WaafiPaymentConfigUpdateInput = {
      connectionStatus: "CONNECTED",
      connectionMessage: test.message,
      lastTestedAt: new Date(test.testedAt),
      lastSuccessAt: new Date(test.testedAt),
      connectionVerified: true,
    };

    if (saveOnSuccess) {
      data.baseUrl = merged.baseUrl;
      data.merchantUid = merged.merchantUid;
      data.apiUserId = merged.apiUserId;
      if (input.apiKey && input.apiKey.length > 0) data.apiKey = input.apiKey;
      data.storeId = merged.storeId;
      if (input.hppKey && input.hppKey.length > 0) data.hppKey = input.hppKey;
      if (input.defaultMethod) data.defaultMethod = input.defaultMethod;
      if (input.currency) data.currency = input.currency;
      if (input.callbackBaseUrl !== undefined) {
        data.callbackBaseUrl = input.callbackBaseUrl;
      }
      if (input.enabled !== undefined) data.enabled = input.enabled;
      else if (!existing.enabled) data.enabled = true;
    }

    const updated = await this.prisma.waafiPaymentConfig.update({
      where: { id: existing.id },
      data,
    });

    void adminId; // reserved for future audit actor
    return { config: this.mapWaafiConfig(updated), test };
  }

  async updateWaafiConfig(input: UpdateWaafiConfigInput) {
    const existing = await this.ensureWaafiConfig();
    const changingSecrets =
      (input.merchantUid !== undefined &&
        input.merchantUid !== existing.merchantUid) ||
      (input.apiUserId !== undefined &&
        input.apiUserId !== existing.apiUserId) ||
      (input.apiKey !== undefined && input.apiKey !== "") ||
      (input.storeId !== undefined && input.storeId !== existing.storeId) ||
      (input.hppKey !== undefined && input.hppKey !== "") ||
      (input.baseUrl !== undefined && input.baseUrl !== existing.baseUrl);

    if (changingSecrets) {
      throw new ForbiddenException(
        "Waafi credentials can only be saved via Test Connection. Use POST /platform/sms/waafi/test-connection.",
      );
    }

    if (
      input.enabled === true &&
      !existing.connectionVerified &&
      !input.simulationMode &&
      !existing.simulationMode
    ) {
      throw new ForbiddenException(
        "Enable Waafi payments only after a successful connection test, or turn on Simulation mode for demo.",
      );
    }

    const data: Prisma.WaafiPaymentConfigUpdateInput = {
      enabled: input.enabled,
      defaultMethod: input.defaultMethod,
      currency: input.currency,
      callbackBaseUrl:
        input.callbackBaseUrl === undefined
          ? undefined
          : input.callbackBaseUrl,
    };

    if (input.simulationMode !== undefined) {
      data.simulationMode = input.simulationMode;
      if (input.simulationMode) {
        // Unlock demo purchases without live Waafi credentials
        data.enabled = input.enabled ?? true;
        data.connectionStatus = "CONNECTED";
        data.connectionMessage =
          "Simulation mode — payments succeed without calling WaafiPay.";
        data.connectionVerified = true;
        data.lastTestedAt = new Date();
        data.lastSuccessAt = new Date();
      } else if (!existing.merchantUid && !existing.apiKey && !existing.hppKey) {
        data.connectionStatus = "DISCONNECTED";
        data.connectionMessage =
          "Simulation mode off. Enter Waafi credentials and Test Connection.";
        data.connectionVerified = false;
        data.enabled = false;
      }
    }

    const updated = await this.prisma.waafiPaymentConfig.update({
      where: { id: existing.id },
      data,
    });
    return this.mapWaafiConfig(updated);
  }

  private async requirePaymentsUnlocked() {
    const cfg = await this.ensureWaafiConfig();
    if (cfg.simulationMode) return cfg;
    if (!cfg.connectionVerified || cfg.connectionStatus !== "CONNECTED") {
      throw new ServiceUnavailableException(
        "WaafiPay is not verified. Super Admin must open Platform → Waafi Payments, enter Hormuud Waafi credentials, click Test Connection & Save, then Enable payments. Or turn on Simulation mode for demo testing.",
      );
    }
    if (!cfg.enabled) {
      throw new ServiceUnavailableException(
        "WaafiPay payments are disabled by Super Admin. Enable them in Platform → Waafi Payments.",
      );
    }
    return cfg;
  }

  // ── School: initiate purchase ────────────────────────────────────────────

  async initiatePurchase(
    schoolId: string,
    userId: string,
    input: PurchaseSmsPackageInput,
  ) {
    const cfg = await this.requirePaymentsUnlocked();
    const pkg = await this.prisma.smsPackage.findUnique({
      where: { id: input.packageId },
    });
    if (!pkg || !pkg.isActive) {
      throw new NotFoundException("SMS package not found or inactive.");
    }

    const channel =
      input.channel ??
      (cfg.defaultMethod as "API_PURCHASE" | "HPP_PURCHASE");
    const paymentMethod = input.paymentMethod ?? "MWALLET_ACCOUNT";

    let payerAccount: string | null = null;
    if (input.payerAccount) {
      payerAccount = normalizeWaafiAccount(input.payerAccount);
      if (!/^\d{9,15}$/.test(payerAccount)) {
        throw new BadRequestException(
          "Invalid payer mobile number. Use international format, e.g. 252611111111.",
        );
      }
    }
    if (channel === "API_PURCHASE" && !payerAccount) {
      throw new BadRequestException(
        "payerAccount (mobile wallet number) is required for direct Waafi payment.",
      );
    }

    // Expire stale pending orders for this school+package
    await this.expireStaleOrders(schoolId);

    const referenceId = this.makeReferenceId();
    const invoiceId = referenceId;
    const amount = Number(pkg.price);
    const expiresAt = new Date(Date.now() + ORDER_TTL_MS);

    const order = await this.prisma.smsPaymentOrder.create({
      data: {
        schoolId,
        packageId: pkg.id,
        referenceId,
        invoiceId,
        amount: pkg.price,
        currency: pkg.currency || cfg.currency || "USD",
        credits: pkg.credits,
        status: "PENDING",
        paymentMethod,
        channel,
        payerAccount,
        initiatedByUserId: userId,
        expiresAt,
      },
    });

    await this.audit(order.id, schoolId, "CREATED", true, "Payment order created", {
      packageId: pkg.id,
      amount,
      channel,
      referenceId,
      simulation: cfg.simulationMode,
    }, userId);

    // Simulation / demo: skip Waafi and activate credits immediately
    if (cfg.simulationMode) {
      const simTxn = `SIM-${Date.now()}`;
      await this.prisma.smsPaymentOrder.update({
        where: { id: order.id },
        data: {
          status: "PROCESSING",
          channel: "SIMULATION",
          waafiTransactionId: simTxn,
          responsePayload: {
            simulation: true,
            message: "Simulated WaafiPay approval",
            referenceId,
          } as Prisma.InputJsonValue,
        },
      });
      await this.audit(
        order.id,
        schoolId,
        "WAAFI_RESPONSE",
        true,
        "Simulated WaafiPay approval (simulation mode)",
        { transactionId: simTxn },
        userId,
      );
      return this.activateOrder(order.id, {
        transactionId: simTxn,
        responsePayload: { simulation: true, referenceId },
      });
    }

    const creds = this.toCreds(cfg);
    const description = `SMS package: ${pkg.name} (${pkg.credits} credits)`;

    if (channel === "HPP_PURCHASE") {
      const callbackBase =
        cfg.callbackBaseUrl?.replace(/\/+$/, "") ||
        process.env.WAAFI_CALLBACK_BASE_URL?.replace(/\/+$/, "");
      if (!callbackBase) {
        await this.failOrder(
          order.id,
          schoolId,
          "Callback base URL is not configured by Super Admin.",
        );
        throw new ServiceUnavailableException(
          "Payment callbacks are not configured. Contact platform administrator.",
        );
      }

      const result = await waafiHppPurchase(creds, {
        accountNo: payerAccount ?? undefined,
        referenceId,
        amount,
        currency: order.currency,
        description,
        successCallbackUrl: `${callbackBase}/api/sms/payments/waafi/callback/success`,
        failureCallbackUrl: `${callbackBase}/api/sms/payments/waafi/callback/failure`,
      });

      await this.prisma.smsPaymentOrder.update({
        where: { id: order.id },
        data: {
          status: result.ok ? "PROCESSING" : "FAILED",
          waafiRequestId: result.requestId,
          waafiOrderId: result.orderId ?? null,
          hppUrl: result.hppUrl ?? result.directPaymentLink ?? null,
          requestPayload: result.requestBody as Prisma.InputJsonValue,
          responsePayload: result.raw as Prisma.InputJsonValue,
          failureReason: result.ok ? null : result.responseMsg,
        },
      });

      await this.audit(
        order.id,
        schoolId,
        "WAAFI_RESPONSE",
        result.ok,
        result.ok ? "HPP session created" : result.responseMsg,
        { responseCode: result.responseCode, orderId: result.orderId },
        userId,
      );

      if (!result.ok) {
        throw new BadRequestException(
          result.responseMsg || "Failed to create Waafi hosted payment session.",
        );
      }

      return this.getOrderReceipt(schoolId, order.id);
    }

    // Direct API_PURCHASE
    const result = await waafiApiPurchase(creds, {
      accountNo: payerAccount!,
      referenceId,
      invoiceId,
      amount,
      currency: order.currency,
      description,
      paymentMethod,
    });

    await this.prisma.smsPaymentOrder.update({
      where: { id: order.id },
      data: {
        status: result.ok ? "PROCESSING" : "FAILED",
        waafiRequestId: result.requestId,
        waafiTransactionId: result.transactionId ?? null,
        waafiIssuerTxnId: result.issuerTransactionId ?? null,
        requestPayload: result.requestBody as Prisma.InputJsonValue,
        responsePayload: result.raw as Prisma.InputJsonValue,
        failureReason: result.ok ? null : result.responseMsg,
      },
    });

    await this.audit(
      order.id,
      schoolId,
      "WAAFI_RESPONSE",
      result.ok,
      result.ok ? "Waafi purchase approved" : result.responseMsg,
      {
        responseCode: result.responseCode,
        transactionId: result.transactionId,
        state: result.state,
      },
      userId,
    );

    if (!result.ok) {
      throw new BadRequestException(
        result.responseMsg || "Waafi payment was declined.",
      );
    }

    // Auto-activate on successful API purchase
    return this.activateOrder(order.id, {
      transactionId: result.transactionId,
      issuerTransactionId: result.issuerTransactionId,
      responsePayload: result.raw,
    });
  }

  // ── Callbacks / verify ───────────────────────────────────────────────────

  async handleCallback(
    kind: "success" | "failure",
    payload: Record<string, unknown>,
  ) {
    const referenceId = String(
      payload.referenceId ??
        payload.ReferenceId ??
        payload.invoiceId ??
        payload.InvoiceId ??
        "",
    ).trim();
    if (!referenceId) {
      return { ok: false, message: "Missing referenceId" };
    }

    const order = await this.prisma.smsPaymentOrder.findUnique({
      where: { referenceId },
    });
    if (!order) {
      return { ok: false, message: "Unknown payment reference" };
    }

    // Idempotent: already activated
    if (order.status === "SUCCESS") {
      return { ok: true, message: "Already activated", orderId: order.id };
    }

    await this.prisma.smsPaymentOrder.update({
      where: { id: order.id },
      data: { callbackPayload: payload as Prisma.InputJsonValue },
    });

    await this.audit(
      order.id,
      order.schoolId,
      "CALLBACK",
      kind === "success",
      `Waafi ${kind} callback received`,
      payload,
    );

    if (kind === "failure") {
      await this.failOrder(
        order.id,
        order.schoolId,
        String(payload.responseMsg ?? payload.message ?? "Payment failed"),
      );
      return { ok: false, message: "Payment marked failed", orderId: order.id };
    }

    const status =
      payload.status ??
      payload.tranStatusDesc ??
      payload.state ??
      payload.Status;
    const transactionId =
      payload.transactionId ??
      payload.TransactionId ??
      payload.transaction_id;

    if (!isApprovedCallbackStatus(status) && !transactionId) {
      // Still try verify against Waafi
      return this.verifyAndActivate(order.id);
    }

    return this.activateOrder(order.id, {
      transactionId: transactionId != null ? String(transactionId) : undefined,
      responsePayload: payload,
    });
  }

  async verifyAndActivate(orderId: string, schoolId?: string) {
    const order = await this.prisma.smsPaymentOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException("Payment order not found.");
    if (schoolId && order.schoolId !== schoolId) {
      throw new ForbiddenException("Payment order does not belong to this school.");
    }
    if (order.status === "SUCCESS") {
      return this.getOrderReceipt(order.schoolId, order.id);
    }
    if (order.status === "REFUNDED" || order.status === "CANCELLED") {
      throw new ConflictException(`Payment is ${order.status}.`);
    }

    if (order.expiresAt && order.expiresAt < new Date() && order.status === "PENDING") {
      await this.failOrder(order.id, order.schoolId, "Payment order expired.", "EXPIRED");
      throw new BadRequestException("Payment order expired.");
    }

    const cfg = await this.ensureWaafiConfig();
    const info = await waafiGetTranInfo(this.toCreds(cfg), order.referenceId);

    await this.prisma.smsPaymentOrder.update({
      where: { id: order.id },
      data: { verifyPayload: info.raw as Prisma.InputJsonValue },
    });

    await this.audit(
      order.id,
      order.schoolId,
      "VERIFY",
      info.ok,
      info.ok
        ? `Verified with Waafi (${info.status ?? info.tranStatusDesc})`
        : info.raw.responseMsg || "Verification failed",
      info.raw as unknown as Record<string, unknown>,
    );

    if (!info.ok) {
      throw new BadRequestException(
        info.raw.responseMsg ||
          "Payment not yet confirmed by WaafiPay. Try again shortly.",
      );
    }

    return this.activateOrder(order.id, {
      transactionId: info.transactionId,
      responsePayload: info.raw,
    });
  }

  // ── Activation (idempotent, transactional) ───────────────────────────────

  private async activateOrder(
    orderId: string,
    opts: {
      transactionId?: string;
      issuerTransactionId?: string;
      responsePayload?: unknown;
    } = {},
  ) {
    // Duplicate Waafi transaction protection
    if (opts.transactionId) {
      const dup = await this.prisma.smsPaymentOrder.findFirst({
        where: {
          waafiTransactionId: opts.transactionId,
          id: { not: orderId },
          status: "SUCCESS",
        },
      });
      if (dup) {
        throw new ConflictException(
          "This Waafi transaction was already applied to another order.",
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.smsPaymentOrder.findUnique({
        where: { id: orderId },
        include: { package: true, purchase: true },
      });
      if (!order) throw new NotFoundException("Payment order not found.");

      if (order.status === "SUCCESS" && order.purchase) {
        return { order, purchase: order.purchase, already: true };
      }

      if (
        order.status === "FAILED" ||
        order.status === "EXPIRED" ||
        order.status === "REFUNDED" ||
        order.status === "CANCELLED"
      ) {
        throw new ConflictException(
          `Cannot activate payment in status ${order.status}.`,
        );
      }

      const receiptNumber = order.receiptNumber ?? (await this.nextReceipt(tx));

      const updated = await tx.smsPaymentOrder.update({
        where: { id: order.id },
        data: {
          status: "SUCCESS",
          receiptNumber,
          waafiTransactionId:
            opts.transactionId ?? order.waafiTransactionId ?? null,
          waafiIssuerTxnId:
            opts.issuerTransactionId ?? order.waafiIssuerTxnId ?? null,
          responsePayload:
            opts.responsePayload !== undefined
              ? (opts.responsePayload as Prisma.InputJsonValue)
              : undefined,
          paidAt: new Date(),
          activatedAt: new Date(),
          failureReason: null,
        },
      });

      let purchase = order.purchase;
      if (!purchase) {
        purchase = await tx.smsPurchase.create({
          data: {
            schoolId: order.schoolId,
            packageId: order.packageId,
            creditsTotal: order.credits,
            creditsRemaining: order.credits,
            amountPaid: order.amount,
            currency: order.currency,
            status: "ACTIVE",
            note: `Waafi payment ${updated.referenceId}`,
            paymentOrderId: order.id,
          },
        });

        const balanceRows = await tx.smsPurchase.findMany({
          where: { schoolId: order.schoolId, status: "ACTIVE" },
          select: { creditsRemaining: true },
        });
        const balance = balanceRows.reduce((s, r) => s + r.creditsRemaining, 0);

        await tx.smsTransaction.create({
          data: {
            schoolId: order.schoolId,
            purchaseId: purchase.id,
            type: "PURCHASE",
            credits: order.credits,
            balanceAfter: balance,
            description: `Purchased "${order.package.name}" via WaafiPay (${order.credits} credits)`,
          },
        });
      }

      await tx.smsPaymentAuditLog.create({
        data: {
          schoolId: order.schoolId,
          orderId: order.id,
          action: "ACTIVATED",
          success: true,
          message: `Package activated — ${order.credits} SMS credits added`,
          details: {
            purchaseId: purchase.id,
            receiptNumber,
            transactionId: opts.transactionId,
          } as Prisma.InputJsonValue,
        },
      });

      return { order: updated, purchase, already: false };
    });

    return this.getOrderReceipt(result.order.schoolId, result.order.id);
  }

  private async failOrder(
    orderId: string,
    schoolId: string,
    reason: string,
    status: "FAILED" | "EXPIRED" | "CANCELLED" = "FAILED",
  ) {
    await this.prisma.smsPaymentOrder.update({
      where: { id: orderId },
      data: { status, failureReason: reason },
    });
    await this.audit(
      orderId,
      schoolId,
      status === "EXPIRED" ? "EXPIRED" : "FAILED",
      false,
      reason,
    );
  }

  async expireStaleOrders(schoolId?: string) {
    const where: Prisma.SmsPaymentOrderWhereInput = {
      status: { in: ["PENDING", "PROCESSING"] },
      expiresAt: { lt: new Date() },
      ...(schoolId ? { schoolId } : {}),
    };
    const stale = await this.prisma.smsPaymentOrder.findMany({ where, take: 100 });
    for (const o of stale) {
      await this.failOrder(o.id, o.schoolId, "Payment order timed out.", "EXPIRED");
    }
    return { expired: stale.length };
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  async listSchoolOrders(schoolId: string) {
    await this.expireStaleOrders(schoolId);
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.smsPaymentOrder.findMany({
        where: { schoolId },
        include: {
          package: {
            select: { id: true, name: true, credits: true, price: true },
          },
          purchase: {
            select: {
              id: true,
              creditsTotal: true,
              creditsRemaining: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  }

  async getOrderReceipt(schoolId: string, orderId: string) {
    const order = await this.prisma.forTenant(schoolId, (tx) =>
      tx.smsPaymentOrder.findFirst({
        where: { id: orderId, schoolId },
        include: {
          package: true,
          purchase: true,
          auditLogs: { orderBy: { createdAt: "asc" }, take: 50 },
        },
      }),
    );
    if (!order) throw new NotFoundException("Payment order not found.");

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, subdomain: true },
    });

    return {
      id: order.id,
      referenceId: order.referenceId,
      invoiceId: order.invoiceId,
      receiptNumber: order.receiptNumber,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      credits: order.credits,
      channel: order.channel,
      paymentMethod: order.paymentMethod,
      payerAccount: order.payerAccount,
      hppUrl: order.hppUrl,
      waafiTransactionId: order.waafiTransactionId,
      waafiOrderId: order.waafiOrderId,
      failureReason: order.failureReason,
      paidAt: order.paidAt,
      activatedAt: order.activatedAt,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      package: {
        id: order.package.id,
        name: order.package.name,
        credits: order.package.credits,
        price: order.package.price,
        description: order.package.description,
      },
      purchase: order.purchase
        ? {
            id: order.purchase.id,
            creditsTotal: order.purchase.creditsTotal,
            creditsRemaining: order.purchase.creditsRemaining,
            status: order.purchase.status,
          }
        : null,
      school,
      auditLogs: order.auditLogs.map((a) => ({
        id: a.id,
        action: a.action,
        success: a.success,
        message: a.message,
        createdAt: a.createdAt,
      })),
    };
  }

  async platformPaymentOverview() {
    await this.expireStaleOrders();
    const [config, orders, byStatus, revenue] = await Promise.all([
      this.getWaafiConfig(),
      this.prisma.smsPaymentOrder.findMany({
        include: {
          school: { select: { id: true, name: true, subdomain: true } },
          package: { select: { id: true, name: true, credits: true } },
          purchase: {
            select: { id: true, creditsRemaining: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.prisma.smsPaymentOrder.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.smsPaymentOrder.aggregate({
        where: { status: "SUCCESS" },
        _sum: { amount: true, credits: true },
        _count: { _all: true },
      }),
    ]);

    return {
      config,
      orders,
      statusBreakdown: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
        amount: s._sum.amount ?? 0,
      })),
      revenue: {
        totalAmount: revenue._sum.amount ?? 0,
        totalCredits: revenue._sum.credits ?? 0,
        successfulPayments: revenue._count._all,
      },
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private makeReferenceId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = randomBytes(4).toString("hex").toUpperCase();
    return `SMS-${ts}-${rnd}`;
  }

  private async nextReceipt(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const count = await tx.smsPaymentOrder.count({
      where: { receiptNumber: { not: null } },
    });
    return `SMSRCP${String(count + 1).padStart(6, "0")}`;
  }

  private async audit(
    orderId: string,
    schoolId: string,
    action: string,
    success: boolean,
    message: string,
    details?: Record<string, unknown>,
    actorId?: string,
  ) {
    await this.prisma.smsPaymentAuditLog.create({
      data: {
        orderId,
        schoolId,
        action,
        success,
        message,
        details: details
          ? (details as Prisma.InputJsonValue)
          : undefined,
        actorId: actorId ?? null,
      },
    });
  }
}
