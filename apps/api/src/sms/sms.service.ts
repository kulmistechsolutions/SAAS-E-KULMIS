import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type {
  AssignSmsPackageInput,
  CreateSmsCampaignInput,
  CreateSmsPackageInput,
  CreateSmsTemplateInput,
  PreviewAudienceInput,
  SendAudienceSmsInput,
  SendSmsInput,
  TestSmsConnectionInput,
  UpdateSmsGlobalConfigInput,
  UpdateSmsPackageInput,
} from "@ekulmis/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  clearHormuudTokenCache,
  estimateSmsCredits,
  hormuudSendSms,
  hormuudTestConnection,
  normalizeSomaliPhone,
  type HormuudConnectionTestResult,
} from "./hormuud.client";
import { DEFAULT_TEMPLATES, renderSmsTemplate } from "./sms-template.util";

type Recipient = {
  phone: string;
  name?: string | null;
  type?: string | null;
  refId?: string | null;
  /** The selectable entity id (studentId for parent recipients, teacherId for teachers) — used for preview/exclude checkboxes. */
  recordId?: string | null;
  variables?: Record<string, string>;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  /** Guards against a slow batch overlapping with the next cron tick. */
  private scheduledRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  // ── Platform: global config ──────────────────────────────────────────────

  async getGlobalConfig() {
    const row = await this.ensureGlobalConfig();
    return this.mapConfig(row);
  }

  private mapConfig(row: {
    id: string;
    enabled: boolean;
    baseUrl: string;
    username: string;
    password: string;
    defaultSenderId: string | null;
    connectionStatus: string;
    connectionMessage: string | null;
    lastTestedAt: Date | null;
    lastSuccessAt: Date | null;
    providerBalance: string | null;
    connectionVerified: boolean;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      enabled: row.enabled,
      baseUrl: row.baseUrl,
      username: row.username,
      hasPassword: Boolean(row.password),
      defaultSenderId: row.defaultSenderId,
      connectionStatus: row.connectionStatus as
        | "CONNECTED"
        | "DISCONNECTED"
        | "ERROR",
      connectionMessage: row.connectionMessage,
      lastTestedAt: row.lastTestedAt,
      lastSuccessAt: row.lastSuccessAt,
      providerBalance: row.providerBalance,
      connectionVerified: row.connectionVerified,
      packagesUnlocked: row.connectionVerified && row.enabled,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Test Hormuud credentials. Optionally persist + enable only after success.
   * Packages remain locked until connectionVerified is true.
   */
  async testConnection(
    input: TestSmsConnectionInput,
    adminId?: string,
  ): Promise<{
    config: ReturnType<SmsService["mapConfig"]>;
    test: HormuudConnectionTestResult;
  }> {
    const existing = await this.ensureGlobalConfig();
    const baseUrl = input.baseUrl?.trim() || existing.baseUrl;
    const username = input.username?.trim() || existing.username;
    const password =
      input.password && input.password.length > 0
        ? input.password
        : existing.password;

    const test = await hormuudTestConnection({ baseUrl, username, password });

    await this.prisma.smsConnectionLog.create({
      data: {
        action: "TEST",
        success: test.ok,
        status: test.status,
        message: test.message,
        details: test.steps as unknown as Prisma.InputJsonValue,
        adminId: adminId ?? null,
      },
    });

    if (!test.ok) {
      const updated = await this.prisma.smsGlobalConfig.update({
        where: { id: existing.id },
        data: {
          connectionStatus: test.status,
          connectionMessage: test.message,
          lastTestedAt: new Date(test.testedAt),
          connectionVerified: false,
          // Keep enabled as-is unless they asked to save — never enable on failure
        },
      });
      return { config: this.mapConfig(updated), test };
    }

    // Success path
    const saveOnSuccess = input.saveOnSuccess !== false;
    const data: Prisma.SmsGlobalConfigUpdateInput = {
      connectionStatus: "CONNECTED",
      connectionMessage: test.message,
      lastTestedAt: new Date(test.testedAt),
      lastSuccessAt: new Date(test.testedAt),
      providerBalance: test.providerBalance ?? null,
      connectionVerified: true,
    };

    if (saveOnSuccess) {
      data.baseUrl = baseUrl;
      data.username = username;
      if (input.password && input.password.length > 0) {
        data.password = input.password;
      }
      if (input.defaultSenderId !== undefined) {
        data.defaultSenderId = input.defaultSenderId;
      }
      if (input.enabled !== undefined) {
        data.enabled = input.enabled;
      } else if (!existing.enabled) {
        // First successful verification enables the service by default
        data.enabled = true;
      }
      clearHormuudTokenCache();
    }

    const updated = await this.prisma.smsGlobalConfig.update({
      where: { id: existing.id },
      data,
    });

    if (saveOnSuccess) {
      await this.prisma.smsConnectionLog.create({
        data: {
          action: "SAVE",
          success: true,
          status: "CONNECTED",
          message: "Configuration saved after successful connection test.",
          adminId: adminId ?? null,
        },
      });
    }

    return { config: this.mapConfig(updated), test };
  }

  async listConnectionLogs(take = 50) {
    return this.prisma.smsConnectionLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  async updateGlobalConfig(
    input: UpdateSmsGlobalConfigInput,
    adminId?: string,
  ) {
    const existing = await this.ensureGlobalConfig();

    // Enabling or changing credentials requires a verified connection.
    const changingCreds =
      (input.username !== undefined && input.username !== existing.username) ||
      (input.password !== undefined && input.password !== "") ||
      (input.baseUrl !== undefined && input.baseUrl !== existing.baseUrl);

    if (changingCreds) {
      throw new BadRequestException(
        "API credentials can only be saved through Test Connection. Use “Test & Save” so Hormuud is verified first.",
      );
    }

    if (input.enabled === true && !existing.connectionVerified) {
      throw new BadRequestException(
        "Cannot enable SMS until Hormuud connection is tested successfully.",
      );
    }

    const data: Prisma.SmsGlobalConfigUpdateInput = {};
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.defaultSenderId !== undefined) {
      data.defaultSenderId = input.defaultSenderId;
    }

    const updated = await this.prisma.smsGlobalConfig.update({
      where: { id: existing.id },
      data,
    });

    await this.prisma.smsConnectionLog.create({
      data: {
        action: input.enabled === false ? "DISABLE" : input.enabled === true ? "ENABLE" : "SAVE",
        success: true,
        status: updated.connectionStatus,
        message:
          input.enabled === false
            ? "SMS service disabled by Super Admin."
            : input.enabled === true
              ? "SMS service enabled by Super Admin."
              : "SMS settings updated.",
        adminId: adminId ?? null,
      },
    });

    return this.mapConfig(updated);
  }

  private async ensureGlobalConfig() {
    const existing = await this.prisma.smsGlobalConfig.findFirst();
    if (existing) return existing;
    return this.prisma.smsGlobalConfig.create({
      data: {
        id: "sms_global_default",
        enabled: false,
        baseUrl: "https://smsapi.hormuud.com",
        username: "",
        password: "",
        connectionStatus: "DISCONNECTED",
        connectionVerified: false,
      },
    });
  }

  private async requireProvider() {
    const cfg = await this.ensureGlobalConfig();
    if (!cfg.connectionVerified) {
      throw new ServiceUnavailableException(
        "Hormuud SMS API has not been verified. Super Admin must complete Test Connection first.",
      );
    }
    if (!cfg.enabled) {
      throw new ServiceUnavailableException(
        "SMS service is disabled by the platform administrator.",
      );
    }
    if (!cfg.username || !cfg.password) {
      throw new ServiceUnavailableException(
        "Hormuud SMS credentials are not configured.",
      );
    }
    if (cfg.connectionStatus !== "CONNECTED") {
      throw new ServiceUnavailableException(
        `Hormuud connection status is ${cfg.connectionStatus}. Re-test the connection in Platform SMS Settings.`,
      );
    }
    return cfg;
  }

  /** Packages / assign / adjust require a verified + enabled Hormuud connection. */
  private async requirePackagesUnlocked() {
    const cfg = await this.ensureGlobalConfig();
    if (!cfg.connectionVerified || cfg.connectionStatus !== "CONNECTED") {
      throw new ForbiddenException(
        "SMS packages are locked until Hormuud API connection is tested and verified by Super Admin.",
      );
    }
    if (!cfg.enabled) {
      throw new ForbiddenException(
        "SMS service is disabled. Enable it in SMS Settings after a successful connection test.",
      );
    }
    return cfg;
  }

  // ── Platform: packages ───────────────────────────────────────────────────

  listPackages(activeOnly = false) {
    return this.prisma.smsPackage.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { credits: "asc" }],
    });
  }

  async createPackage(input: CreateSmsPackageInput) {
    await this.requirePackagesUnlocked();
    return this.prisma.smsPackage.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        credits: input.credits,
        price: new Prisma.Decimal(input.price),
        currency: input.currency ?? "USD",
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async updatePackage(id: string, input: UpdateSmsPackageInput) {
    await this.requirePackagesUnlocked();
    const existing = await this.prisma.smsPackage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("SMS package not found.");
    return this.prisma.smsPackage.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        credits: input.credits,
        price: input.price !== undefined ? new Prisma.Decimal(input.price) : undefined,
        currency: input.currency,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });
  }

  async setPackageActive(id: string, isActive: boolean) {
    await this.requirePackagesUnlocked();
    const existing = await this.prisma.smsPackage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("SMS package not found.");
    return this.prisma.smsPackage.update({ where: { id }, data: { isActive } });
  }

  async deletePackage(id: string) {
    await this.requirePackagesUnlocked();
    const existing = await this.prisma.smsPackage.findUnique({
      where: { id },
      include: { _count: { select: { purchases: true, paymentOrders: true } } },
    });
    if (!existing) throw new NotFoundException("SMS package not found.");
    if (existing._count.purchases > 0 || existing._count.paymentOrders > 0) {
      // Soft-delete: deactivate instead of hard delete when referenced
      return this.prisma.smsPackage.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.smsPackage.delete({ where: { id } });
  }

  // ── Platform: assign package to school ───────────────────────────────────

  async assignPackage(input: AssignSmsPackageInput, adminId?: string) {
    await this.requirePackagesUnlocked();
    const school = await this.prisma.school.findUnique({
      where: { id: input.schoolId },
    });
    if (!school) throw new NotFoundException("School not found.");
    const pkg = await this.prisma.smsPackage.findUnique({
      where: { id: input.packageId },
    });
    if (!pkg) throw new NotFoundException("SMS package not found.");
    if (!pkg.isActive) {
      throw new BadRequestException("This SMS package is inactive.");
    }

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.smsPurchase.create({
        data: {
          schoolId: school.id,
          packageId: pkg.id,
          creditsTotal: pkg.credits,
          creditsRemaining: pkg.credits,
          amountPaid: pkg.price,
          currency: pkg.currency,
          status: "ACTIVE",
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          note: input.note ?? null,
          createdByAdminId: adminId ?? null,
        },
        include: { package: true, school: { select: { id: true, name: true, subdomain: true } } },
      });

      const balance = await this.sumRemaining(tx, school.id);
      await tx.smsTransaction.create({
        data: {
          schoolId: school.id,
          purchaseId: purchase.id,
          type: "PURCHASE",
          credits: pkg.credits,
          balanceAfter: balance,
          description: `Purchased package "${pkg.name}" (${pkg.credits} credits)`,
        },
      });

      return purchase;
    });
  }

  async platformOverview() {
    const [config, packages, purchases, messages, bySchool] = await Promise.all([
      this.getGlobalConfig(),
      this.listPackages(),
      this.prisma.smsPurchase.findMany({
        include: {
          school: { select: { id: true, name: true, subdomain: true } },
          package: true,
        },
        orderBy: { purchasedAt: "desc" },
        take: 50,
      }),
      this.prisma.smsMessage.groupBy({
        by: ["status"],
        _count: { _all: true },
        _sum: { creditsUsed: true },
      }),
      this.prisma.smsPurchase.groupBy({
        by: ["schoolId"],
        where: { status: "ACTIVE" },
        _sum: { creditsRemaining: true, creditsTotal: true },
      }),
    ]);

    const schools = await this.prisma.school.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        smsEnabled: true,
        smsSenderName: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });

    const balanceMap = new Map(
      bySchool.map((b) => [b.schoolId, b._sum.creditsRemaining ?? 0]),
    );

    return {
      config,
      packages,
      recentPurchases: purchases,
      deliveryStats: messages.map((m) => ({
        status: m.status,
        count: m._count._all,
        credits: m._sum.creditsUsed ?? 0,
      })),
      schools: schools.map((s) => ({
        ...s,
        creditsRemaining: balanceMap.get(s.id) ?? 0,
      })),
    };
  }

  async platformMessages(opts: {
    schoolId?: string;
    status?: string;
    q?: string;
    take?: number;
  }) {
    return this.prisma.smsMessage.findMany({
      where: {
        schoolId: opts.schoolId,
        status: opts.status as never,
        OR: opts.q
          ? [
              { recipientPhone: { contains: opts.q } },
              { recipientName: { contains: opts.q, mode: "insensitive" } },
              { body: { contains: opts.q, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: {
        school: { select: { id: true, name: true, subdomain: true } },
      },
      orderBy: { createdAt: "desc" },
      take: opts.take ?? 100,
    });
  }

  async adjustCredits(
    schoolId: string,
    credits: number,
    description?: string,
    purchaseId?: string,
  ) {
    await this.requirePackagesUnlocked();
    if (credits === 0) throw new BadRequestException("Credits delta cannot be zero.");
    return this.prisma.$transaction(async (tx) => {
      let purchase = purchaseId
        ? await tx.smsPurchase.findFirst({
            where: { id: purchaseId, schoolId },
          })
        : await tx.smsPurchase.findFirst({
            where: { schoolId, status: "ACTIVE" },
            orderBy: { purchasedAt: "asc" },
          });

      if (!purchase && credits > 0) {
        throw new BadRequestException(
          "No purchase wallet found. Assign a package first.",
        );
      }
      if (!purchase) {
        throw new BadRequestException("No active SMS purchase to adjust.");
      }

      const next = purchase.creditsRemaining + credits;
      if (next < 0) {
        throw new BadRequestException("Adjustment would make balance negative.");
      }

      purchase = await tx.smsPurchase.update({
        where: { id: purchase.id },
        data: {
          creditsRemaining: next,
          status: next === 0 ? "EXHAUSTED" : "ACTIVE",
        },
      });

      const balance = await this.sumRemaining(tx, schoolId);
      await tx.smsTransaction.create({
        data: {
          schoolId,
          purchaseId: purchase.id,
          type: "ADJUSTMENT",
          credits,
          balanceAfter: balance,
          description: description ?? "Manual credit adjustment",
        },
      });

      return purchase;
    });
  }

  // ── School: balance & settings ───────────────────────────────────────────

  async schoolBalance(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        smsSenderName: true,
        smsEnabled: true,
      },
    });
    if (!school) throw new NotFoundException("School not found.");

    const providerCfg = await this.ensureGlobalConfig();
    const provider = {
      enabled: providerCfg.enabled,
      connected: providerCfg.connectionVerified && providerCfg.connectionStatus === "CONNECTED",
      status: providerCfg.connectionStatus,
      message: providerCfg.connectionVerified
        ? providerCfg.connectionStatus === "CONNECTED"
          ? "Hormuud SMS is ready. You can send messages."
          : providerCfg.connectionMessage ?? "Hormuud connection needs attention."
        : "Platform admin must verify Hormuud SMS in Platform → SMS Settings.",
      canSend:
        providerCfg.enabled &&
        providerCfg.connectionVerified &&
        providerCfg.connectionStatus === "CONNECTED" &&
        school.smsEnabled,
    };

    return this.prisma.forTenant(schoolId, async (tx) => {
      const purchases = await tx.smsPurchase.findMany({
        where: { schoolId },
        include: { package: true },
        orderBy: { purchasedAt: "desc" },
      });
      const remaining = purchases
        .filter((p) => p.status === "ACTIVE")
        .reduce((s, p) => s + p.creditsRemaining, 0);
      const stats = await tx.smsMessage.groupBy({
        by: ["status"],
        where: { schoolId },
        _count: { _all: true },
        _sum: { creditsUsed: true },
      });
      return {
        school,
        provider,
        creditsRemaining: remaining,
        purchases,
        deliveryStats: stats.map((s) => ({
          status: s.status,
          count: s._count._all,
          credits: s._sum.creditsUsed ?? 0,
        })),
      };
    });
  }

  async updateSchoolSettings(
    schoolId: string,
    input: { smsSenderName?: string | null; smsEnabled?: boolean },
  ) {
    return this.prisma.school.update({
      where: { id: schoolId },
      data: {
        smsSenderName: input.smsSenderName,
        smsEnabled: input.smsEnabled,
      },
      select: {
        id: true,
        name: true,
        smsSenderName: true,
        smsEnabled: true,
      },
    });
  }

  // ── Templates ────────────────────────────────────────────────────────────

  listTemplates(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.smsTemplate.findMany({
        where: { schoolId },
        orderBy: { name: "asc" },
      }),
    );
  }

  async ensureDefaultTemplates(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const count = await tx.smsTemplate.count({ where: { schoolId } });
      if (count > 0) return this.listTemplates(schoolId);
      await tx.smsTemplate.createMany({
        data: DEFAULT_TEMPLATES.map((t) => ({
          schoolId,
          name: t.name,
          category: t.category as never,
          body: t.body,
        })),
      });
      return tx.smsTemplate.findMany({
        where: { schoolId },
        orderBy: { name: "asc" },
      });
    });
  }

  /**
   * Delete all of this school's templates and reseed the built-in defaults.
   * Used when the built-in wording changes (e.g. a translation fix) after a
   * school already seeded templates, since ensureDefaultTemplates only seeds
   * once. This is a destructive, explicit admin action — it also removes any
   * custom templates the school created.
   */
  async resetTemplatesToDefaults(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      await tx.smsTemplate.deleteMany({ where: { schoolId } });
      await tx.smsTemplate.createMany({
        data: DEFAULT_TEMPLATES.map((t) => ({
          schoolId,
          name: t.name,
          category: t.category as never,
          body: t.body,
        })),
      });
      return tx.smsTemplate.findMany({
        where: { schoolId },
        orderBy: { name: "asc" },
      });
    });
  }

  createTemplate(schoolId: string, input: CreateSmsTemplateInput) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.smsTemplate.create({
        data: {
          schoolId,
          name: input.name,
          category: input.category,
          body: input.body,
          isActive: input.isActive ?? true,
        },
      }),
    );
  }

  async updateTemplate(
    schoolId: string,
    id: string,
    input: Partial<CreateSmsTemplateInput>,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const existing = await tx.smsTemplate.findFirst({
        where: { id, schoolId },
      });
      if (!existing) throw new NotFoundException("Template not found.");
      return tx.smsTemplate.update({
        where: { id },
        data: {
          name: input.name,
          category: input.category,
          body: input.body,
          isActive: input.isActive,
        },
      });
    });
  }

  async deleteTemplate(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const existing = await tx.smsTemplate.findFirst({
        where: { id, schoolId },
      });
      if (!existing) throw new NotFoundException("Template not found.");
      await tx.smsTemplate.delete({ where: { id } });
      return { ok: true };
    });
  }

  // ── Logs / transactions ──────────────────────────────────────────────────

  listMessages(
    schoolId: string,
    opts: { status?: string; category?: string; q?: string; take?: number } = {},
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.smsMessage.findMany({
        where: {
          schoolId,
          status: opts.status as never,
          category: opts.category as never,
          OR: opts.q
            ? [
                { recipientPhone: { contains: opts.q } },
                { recipientName: { contains: opts.q, mode: "insensitive" } },
                { body: { contains: opts.q, mode: "insensitive" } },
              ]
            : undefined,
        },
        orderBy: { createdAt: "desc" },
        take: opts.take ?? 100,
      }),
    );
  }

  listTransactions(schoolId: string, take = 100) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.smsTransaction.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        take,
        include: { purchase: { include: { package: true } } },
      }),
    );
  }

  // ── Send ─────────────────────────────────────────────────────────────────

  async sendDirect(
    schoolId: string,
    userId: string | undefined,
    input: SendSmsInput,
  ) {
    const recipients: Recipient[] = input.recipients.map((r) => ({
      phone: r.phone,
      name: r.name,
      type: r.type,
      refId: r.refId,
      variables: r.variables,
    }));
    return this.dispatch(schoolId, userId, {
      category: input.category,
      body: input.body,
      templateId: input.templateId,
      recipients,
      scheduledAt: input.scheduledAt,
    });
  }

  /** Resolve who would receive a message for the given audience, without sending. */
  async previewAudience(schoolId: string, input: PreviewAudienceInput) {
    const recipients = await this.resolveAudience(schoolId, {
      ...input,
      category: "CUSTOM",
      body: "",
    } as SendAudienceSmsInput);
    return recipients.map((r) => ({
      recordId: r.recordId ?? r.refId ?? r.phone,
      refId: r.refId ?? null,
      phone: r.phone,
      name: r.name ?? null,
      type: r.type ?? null,
      variables: r.variables ?? {},
    }));
  }

  async sendToAudience(
    schoolId: string,
    userId: string | undefined,
    input: SendAudienceSmsInput,
  ) {
    const recipients = await this.resolveAudience(schoolId, input);
    if (recipients.length === 0) {
      throw new BadRequestException("No recipients matched the selected audience.");
    }

    let campaignId: string | undefined;
    if (input.campaignName || recipients.length > 1) {
      const campaign = await this.prisma.forTenant(schoolId, (tx) =>
        tx.smsCampaign.create({
          data: {
            schoolId,
            name:
              input.campaignName ??
              `${input.category} ${new Date().toISOString().slice(0, 10)}`,
            category: input.category,
            body: input.body,
            status: input.scheduledAt ? "SCHEDULED" : "RUNNING",
            audience: input.audience,
            classId: input.classId ?? null,
            sectionId: input.sectionId ?? null,
            scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
            totalRecipients: recipients.length,
            createdByUserId: userId ?? null,
            startedAt: input.scheduledAt ? null : new Date(),
          },
        }),
      );
      campaignId = campaign.id;
    }

    const result = await this.dispatch(schoolId, userId, {
      category: input.category,
      body: input.body,
      templateId: input.templateId,
      recipients,
      scheduledAt: input.scheduledAt,
      campaignId,
    });

    if (campaignId) {
      await this.prisma.forTenant(schoolId, (tx) =>
        tx.smsCampaign.update({
          where: { id: campaignId },
          data: {
            status: input.scheduledAt ? "SCHEDULED" : "COMPLETED",
            sentCount: result.sent,
            failedCount: result.failed,
            creditsUsed: result.creditsUsed,
            completedAt: input.scheduledAt ? null : new Date(),
          },
        }),
      );
    }

    return { ...result, campaignId };
  }

  async createCampaign(
    schoolId: string,
    userId: string | undefined,
    input: CreateSmsCampaignInput,
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.smsCampaign.create({
        data: {
          schoolId,
          name: input.name,
          category: input.category,
          body: input.body,
          status: input.scheduledAt ? "SCHEDULED" : "DRAFT",
          audience: input.audience,
          classId: input.classId ?? null,
          sectionId: input.sectionId ?? null,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          reminderIntervalDays: input.reminderIntervalDays ?? null,
          createdByUserId: userId ?? null,
        },
      }),
    );
  }

  listCampaigns(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.smsCampaign.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  }

  async runFeeReminders(schoolId: string, userId?: string, body?: string) {
    const message =
      body ??
      "Dear {{Parent Name}}, {{Student Name}} ({{Class}}) has an outstanding balance of {{Outstanding Balance}} at {{School Name}}. Please settle soon.";
    return this.sendToAudience(schoolId, userId, {
      category: "FEE_REMINDER",
      body: message,
      audience: "OUTSTANDING",
      campaignName: `Fee reminders ${new Date().toISOString().slice(0, 10)}`,
    });
  }

  /**
   * Deliver any scheduled message whose time has come. Runs every minute so a
   * message goes out within ~60s of the time the school picked.
   *
   * Cross-tenant by design: this uses the privileged base client (not
   * forTenant) because it sweeps queued messages for every school at once,
   * the same way the daily subscription job does.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async runScheduledSmsJob(): Promise<void> {
    if (this.scheduledRunning) return;
    this.scheduledRunning = true;
    try {
      const res = await this.processScheduled();
      if (res.processed > 0) {
        this.logger.log(
          `Scheduled SMS batch — sent=${res.sent}, failed=${res.failed}`,
        );
      }
    } catch (e) {
      this.logger.error(
        `Scheduled SMS job failed: ${e instanceof Error ? e.message : e}`,
      );
    } finally {
      this.scheduledRunning = false;
    }
  }

  /** Process due scheduled messages (called from the cron above). */
  async processScheduled(limit = 50) {
    const due = await this.prisma.smsMessage.findMany({
      where: {
        status: "QUEUED",
        scheduledAt: { lte: new Date() },
      },
      take: limit,
      orderBy: { scheduledAt: "asc" },
    });
    if (due.length === 0) return { processed: 0, sent: 0, failed: 0 };

    // Resolve the provider once per batch. If it is unavailable the messages
    // stay QUEUED and go out on a later tick, rather than being burned.
    let provider: Awaited<ReturnType<SmsService["requireProvider"]>>;
    try {
      provider = await this.requireProvider();
    } catch (e) {
      this.logger.warn(
        `${due.length} scheduled SMS are due but the provider is unavailable: ${
          e instanceof Error ? e.message : e
        }`,
      );
      return { processed: 0, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    for (const msg of due) {
      try {
        const delivered = await this.deliverStoredMessage(msg.id, provider);
        if (delivered.status === "SENT" || delivered.status === "DELIVERED") {
          sent++;
        } else {
          failed++;
          // Match the immediate-send path: a hard failure returns the credits.
          await this.refundCredits(
            msg.schoolId,
            msg.id,
            msg.purchaseId,
            msg.creditsUsed,
          );
        }
      } catch (e) {
        failed++;
        this.logger.error(
          `Scheduled SMS ${msg.id} failed: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    return { processed: due.length, sent, failed };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async sumRemaining(
    tx: Prisma.TransactionClient | PrismaService,
    schoolId: string,
  ) {
    const rows = await tx.smsPurchase.findMany({
      where: { schoolId, status: "ACTIVE" },
      select: { creditsRemaining: true },
    });
    return rows.reduce((s, r) => s + r.creditsRemaining, 0);
  }

  private async resolveAudience(
    schoolId: string,
    input: SendAudienceSmsInput,
  ): Promise<Recipient[]> {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    const schoolName = school?.name ?? "School";

    return this.prisma.forTenant(schoolId, async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { schoolId, isActive: true },
      });

      if (input.audience === "TEACHERS" || input.teacherIds?.length) {
        const teachers = await tx.teacher.findMany({
          where: {
            schoolId,
            status: "ACTIVE",
            phone: { not: null },
            ...(input.teacherIds?.length
              ? { id: { in: input.teacherIds } }
              : {}),
          },
        });
        return teachers
          .filter((t) => t.phone)
          .map((t) => ({
            phone: t.phone!,
            name: t.fullName,
            type: "TEACHER",
            refId: t.id,
            recordId: t.id,
            variables: {
              schoolName,
              academicYear: year?.name ?? "",
              parentName: t.fullName,
              studentName: t.fullName,
            },
          }));
      }

      if (input.audience === "OUTSTANDING") {
        const charges = await tx.feeCharge.findMany({
          where: {
            status: { not: "PAID" },
            student: {
              status: "ACTIVE",
              ...(input.classId ? { classId: input.classId } : {}),
              ...(input.sectionId ? { sectionId: input.sectionId } : {}),
            },
          },
          include: {
            student: {
              include: {
                parent: true,
                class: true,
                section: true,
              },
            },
          },
        });

        const byParentStudent = new Map<string, { studentId: string; recipient: Recipient }>();
        for (const c of charges) {
          const st = c.student;
          const parent = st.parent;
          if (!parent?.phone) continue;
          const key = `${parent.id}:${st.id}`;
          const outstanding = Number(c.amount) - Number(c.paidAmount);
          const prev = byParentStudent.get(key);
          const total = (prev
            ? Number(prev.recipient.variables?.outstandingBalance ?? 0)
            : 0) + outstanding;
          byParentStudent.set(key, {
            studentId: st.id,
            recipient: {
              phone: parent.phone,
              name: parent.name,
              type: "PARENT",
              refId: parent.id,
              recordId: st.id,
              variables: {
                parentName: parent.name,
                studentName: st.fullName,
                studentCode: st.code,
                className: st.class?.name ?? "",
                section: st.section?.name ?? "",
                schoolName,
                academicYear: year?.name ?? "",
                outstandingBalance: `$${total.toFixed(2)}`,
              },
            },
          });
        }

        let entries = [...byParentStudent.values()];
        if (input.studentIds?.length) {
          const allow = new Set(input.studentIds);
          entries = entries.filter((e) => allow.has(e.studentId));
        } else if (input.parentIds?.length) {
          const allow = new Set(input.parentIds);
          entries = entries.filter(
            (e) => e.recipient.refId && allow.has(e.recipient.refId),
          );
        }
        return entries.map((e) => e.recipient);
      }

      const students = await tx.student.findMany({
        where: {
          schoolId,
          status: "ACTIVE",
          ...(input.audience === "CLASS" && input.classId
            ? { classId: input.classId }
            : {}),
          ...(input.audience === "SECTION" && input.sectionId
            ? { sectionId: input.sectionId }
            : {}),
          ...(input.studentIds?.length
            ? { id: { in: input.studentIds } }
            : {}),
          ...(input.parentIds?.length
            ? { parentId: { in: input.parentIds } }
            : {}),
        },
        include: { parent: true, class: true, section: true },
      });

      const seen = new Set<string>();
      const out: Recipient[] = [];
      for (const st of students) {
        const parent = st.parent;
        if (!parent?.phone) continue;
        const phone = normalizeSomaliPhone(parent.phone);
        const dedupe = `${phone}:${st.id}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        out.push({
          phone: parent.phone,
          name: parent.name,
          type: "PARENT",
          refId: parent.id,
          recordId: st.id,
          variables: {
            parentName: parent.name,
            studentName: st.fullName,
            studentCode: st.code,
            className: st.class?.name ?? "",
            section: st.section?.name ?? "",
            schoolName,
            academicYear: year?.name ?? "",
          },
        });
      }
      return out;
    });
  }

  private async dispatch(
    schoolId: string,
    userId: string | undefined,
    opts: {
      category: string;
      body: string;
      templateId?: string;
      recipients: Recipient[];
      scheduledAt?: string | null;
      campaignId?: string;
    },
  ) {
    const provider = await this.requireProvider();

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) throw new NotFoundException("School not found.");
    if (!school.smsEnabled) {
      throw new ForbiddenException("SMS is disabled for this school.");
    }

    const senderId = (
      school.smsSenderName?.trim() ||
      school.name ||
      provider.defaultSenderId ||
      "eKulmis"
    ).slice(0, 20);

    let templateBody = opts.body;
    if (opts.templateId) {
      const tpl = await this.prisma.forTenant(schoolId, (tx) =>
        tx.smsTemplate.findFirst({
          where: { id: opts.templateId, schoolId, isActive: true },
        }),
      );
      if (!tpl) throw new NotFoundException("SMS template not found.");
      templateBody = tpl.body;
    }

    const scheduledAt = opts.scheduledAt ? new Date(opts.scheduledAt) : null;
    const isScheduled = scheduledAt && scheduledAt.getTime() > Date.now();

    // Pre-estimate credits
    let estimatedCredits = 0;
    const prepared = opts.recipients.map((r) => {
      const body = renderSmsTemplate(templateBody, {
        schoolName: school.name,
        ...(r.variables ?? {}),
        parentName: r.variables?.parentName ?? r.name ?? "",
      });
      const credits = estimateSmsCredits(body);
      estimatedCredits += credits;
      return { ...r, body, credits };
    });

    const balance = await this.prisma.forTenant(schoolId, (tx) =>
      this.sumRemaining(tx, schoolId),
    );
    if (balance < estimatedCredits) {
      throw new BadRequestException(
        `Insufficient SMS credits. Need ${estimatedCredits}, have ${balance}. Purchase a package from the platform administrator.`,
      );
    }

    let sent = 0;
    let failed = 0;
    let queued = 0;
    let creditsUsed = 0;
    const messages: unknown[] = [];

    for (const r of prepared) {
      const created = await this.prisma.forTenant(schoolId, async (tx) => {
        const purchase = await tx.smsPurchase.findFirst({
          where: {
            schoolId,
            status: "ACTIVE",
            creditsRemaining: { gte: r.credits },
          },
          orderBy: { purchasedAt: "asc" },
        });
        if (!purchase) {
          throw new BadRequestException(
            "Insufficient SMS credits on an active package.",
          );
        }

        // Reserve credits up-front
        const remaining = purchase.creditsRemaining - r.credits;
        await tx.smsPurchase.update({
          where: { id: purchase.id },
          data: {
            creditsRemaining: remaining,
            status: remaining === 0 ? "EXHAUSTED" : "ACTIVE",
          },
        });
        const bal = await this.sumRemaining(tx, schoolId);
        await tx.smsTransaction.create({
          data: {
            schoolId,
            purchaseId: purchase.id,
            type: "DEDUCTION",
            credits: -r.credits,
            balanceAfter: bal,
            description: `Reserved for SMS to ${r.phone}`,
            createdByUserId: userId ?? null,
          },
        });

        return tx.smsMessage.create({
          data: {
            schoolId,
            purchaseId: purchase.id,
            campaignId: opts.campaignId ?? null,
            category: opts.category as never,
            recipientPhone: normalizeSomaliPhone(r.phone),
            recipientName: r.name ?? null,
            recipientType: r.type ?? null,
            recipientRefId: r.refId ?? null,
            senderId,
            body: r.body,
            creditsUsed: r.credits,
            status: isScheduled ? "QUEUED" : "PENDING",
            scheduledAt,
            providerRefId: undefined,
            createdByUserId: userId ?? null,
          },
        });
      });

      if (isScheduled) {
        queued++;
        messages.push(created);
        continue;
      }

      const delivered = await this.deliverStoredMessage(created.id, provider);
      if (delivered.status === "SENT" || delivered.status === "DELIVERED") {
        sent++;
        creditsUsed += delivered.creditsUsed;
      } else {
        failed++;
        // Refund on hard failure
        await this.refundCredits(schoolId, created.id, created.purchaseId, created.creditsUsed);
      }
      messages.push(delivered);
    }

    return {
      sent,
      failed,
      queued,
      creditsUsed: isScheduled ? 0 : creditsUsed,
      estimatedCredits,
      messages,
    };
  }

  private async refundCredits(
    schoolId: string,
    messageId: string,
    purchaseId: string | null,
    credits: number,
  ) {
    if (!purchaseId || credits <= 0) return;
    await this.prisma.forTenant(schoolId, async (tx) => {
      const purchase = await tx.smsPurchase.findFirst({
        where: { id: purchaseId, schoolId },
      });
      if (!purchase) return;
      await tx.smsPurchase.update({
        where: { id: purchase.id },
        data: {
          creditsRemaining: purchase.creditsRemaining + credits,
          status: "ACTIVE",
        },
      });
      const bal = await this.sumRemaining(tx, schoolId);
      await tx.smsTransaction.create({
        data: {
          schoolId,
          purchaseId,
          type: "REFUND",
          credits,
          balanceAfter: bal,
          description: `Refund for failed SMS ${messageId}`,
          messageId,
        },
      });
      await tx.smsMessage.update({
        where: { id: messageId },
        data: { creditsUsed: 0 },
      });
    });
  }

  private async deliverStoredMessage(
    messageId: string,
    providerCfg?: Awaited<ReturnType<SmsService["requireProvider"]>>,
  ) {
    const provider = providerCfg ?? (await this.requireProvider());
    const msg = await this.prisma.smsMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg) throw new NotFoundException("SMS message not found.");
    if (msg.status === "SENT" || msg.status === "DELIVERED") return msg;

    let lastError = "";
    let result = await hormuudSendSms(
      {
        baseUrl: provider.baseUrl,
        username: provider.username,
        password: provider.password,
      },
      {
        mobile: msg.recipientPhone,
        message: msg.body,
        senderid: msg.senderId,
        refid: msg.id,
      },
    );

    // One retry on transient failure
    if (!result.ok) {
      lastError = result.error ?? result.responseMessage ?? "Send failed";
      await new Promise((r) => setTimeout(r, 500));
      result = await hormuudSendSms(
        {
          baseUrl: provider.baseUrl,
          username: provider.username,
          password: provider.password,
        },
        {
          mobile: msg.recipientPhone,
          message: msg.body,
          senderid: msg.senderId,
          refid: msg.id,
        },
      );
    }

    const credits =
      result.ok && result.totalSms && result.totalSms > 0
        ? result.totalSms
        : msg.creditsUsed;

    return this.prisma.smsMessage.update({
      where: { id: messageId },
      data: result.ok
        ? {
            status: "SENT",
            providerMessageId: result.messageId,
            providerCode: result.responseCode,
            providerMessage: result.responseMessage,
            creditsUsed: credits,
            sentAt: new Date(),
            retryCount: { increment: result.ok ? 0 : 1 },
            error: null,
          }
        : {
            status: "FAILED",
            providerCode: result.responseCode,
            providerMessage: result.responseMessage,
            error: result.error ?? lastError ?? "Send failed",
            retryCount: { increment: 1 },
          },
    });
  }
}
