import type { PrismaClient } from "../prisma/generated/client.js";
import type {
  ManualPaymentMethod,
  PaymentDestination,
} from "../types/payment.js";
import type {
  CheckoutSellerResolution,
  SellerPaymentProfile,
  SellerPaymentRepository,
} from "./seller-payment.repository.js";

interface DestinationDefinition {
  accountNumberLabel: PaymentDestination["accountNumberLabel"];
  method: ManualPaymentMethod;
  profileField:
    | "awashBankAccountNumber"
    | "cbeBankAccountNumber"
    | "cbeBirrNumber"
    | "dashenBankAccountNumber"
    | "eBirrNumber"
    | "telebirrNumber";
  providerName: string;
}

const destinationDefinitions: readonly DestinationDefinition[] = [
  {
    method: "TELEBIRR",
    providerName: "Telebirr",
    profileField: "telebirrNumber",
    accountNumberLabel: "Payment number",
  },
  {
    method: "CBE_BIRR",
    providerName: "CBE Birr",
    profileField: "cbeBirrNumber",
    accountNumberLabel: "Payment number",
  },
  {
    method: "CBE_BANK",
    providerName: "CBE Bank",
    profileField: "cbeBankAccountNumber",
    accountNumberLabel: "Account number",
  },
  {
    method: "AWASH_BANK",
    providerName: "Awash Bank",
    profileField: "awashBankAccountNumber",
    accountNumberLabel: "Account number",
  },
  {
    method: "DASHEN_BANK",
    providerName: "Dashen Bank",
    profileField: "dashenBankAccountNumber",
    accountNumberLabel: "Account number",
  },
  {
    method: "E_BIRR",
    providerName: "E-birr",
    profileField: "eBirrNumber",
    accountNumberLabel: "Payment number",
  },
];

export class PrismaSellerPaymentRepository
  implements SellerPaymentRepository
{
  constructor(private readonly client: PrismaClient) {}

  async findBySellerId(
    sellerId: string,
  ): Promise<SellerPaymentProfile | null> {
    const seller = await this.client.user.findUnique({
      where: { id: sellerId, role: "SELLER", isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        sellerProfile: {
          select: {
            shopName: true,
            phone: true,
            paymentAccountName: true,
            telebirrNumber: true,
            cbeBirrNumber: true,
            cbeBankAccountNumber: true,
            awashBankAccountNumber: true,
            dashenBankAccountNumber: true,
            eBirrNumber: true,
          },
        },
      },
    });

    if (!seller?.sellerProfile) {
      return null;
    }

    const profile = seller.sellerProfile;
    const accountName =
      profile.paymentAccountName?.trim() ||
      profile.shopName.trim() ||
      seller.name;
    const destinations = destinationDefinitions.flatMap((definition) => {
      const accountNumber = profile[definition.profileField]?.trim();
      if (!accountNumber) {
        return [];
      }

      return [
        {
          method: definition.method,
          providerName: definition.providerName,
          accountName,
          accountNumber,
          accountNumberLabel: definition.accountNumberLabel,
        },
      ];
    });

    return {
      sellerId: seller.id,
      sellerName: profile.shopName || seller.name,
      sellerPhone: profile.phone || seller.phone || "",
      destinations,
    };
  }

  async resolveCheckoutSellers(
    productIds: string[],
  ): Promise<CheckoutSellerResolution> {
    const uniqueProductIds = [...new Set(productIds)];
    const products = await this.client.product.findMany({
      where: { id: { in: uniqueProductIds } },
      select: { id: true, sellerId: true },
    });
    const foundProductIds = new Set(products.map((product) => product.id));

    return {
      missingProductIds: uniqueProductIds.filter(
        (productId) => !foundProductIds.has(productId),
      ),
      sellerIds: [...new Set(products.map((product) => product.sellerId))],
    };
  }
}
