import { prisma } from "../utils/prisma";


const TEST_EMAIL = "hemaxev859@airhemp.com";

// Change this to the actual service ID you want to test.
const SERVICE_ID = "14308c03-c06a-4e01-9869-ee8adaa5800e";

function generateReference(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase()}`;
}

async function main() {
  console.log("Creating test awaiting-form application...\n");

  // --------------------------------------------------
  // 1. FIND EXISTING USER
  // --------------------------------------------------

  const user = await prisma.user.findUnique({
    where: {
      email: TEST_EMAIL,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    throw new Error(
      `User ${TEST_EMAIL} was not found. No user will be created.`,
    );
  }

  console.log(`User found: ${user.email}`);
  console.log(`User ID: ${user.id}`);

  // --------------------------------------------------
  // 2. FIND SERVICE
  // --------------------------------------------------

  const service = await prisma.service.findUnique({
    where: {
      id: SERVICE_ID,
    },
    include: {
      feeConfig: true,
    },
  });

  if (!service) {
    throw new Error(`Service ${SERVICE_ID} was not found.`);
  }

  if (!service.isActive) {
    throw new Error(`Service "${service.name}" is not active.`);
  }

  if (!service.feeConfig || service.feeConfig.status !== "ACTIVE") {
    throw new Error(
      `Service "${service.name}" does not have an active fee configuration.`,
    );
  }

  const feeAmount = service.feeConfig.amount;

  console.log(`Service: ${service.name}`);
  console.log(`Fee: ₦${feeAmount.toString()}`);

  // --------------------------------------------------
  // 3. CREATE EVERYTHING IN ONE TRANSACTION
  // --------------------------------------------------

  const result = await prisma.$transaction(async (tx) => {
    // Application
    const application = await tx.application.create({
      data: {
        applicationNumber: generateReference("APP"),

        service: {
          connect: {
            id: service.id,
          },
        },

        applicant: {
          connect: {
            id: user.id,
          },
        },

        createdBy: {
          connect: {
            id: user.id,
          },
        },

        feeAmount,

        formData: {},

        status: "awaiting_form",
      },
    });

    // Invoice
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: generateReference("INV"),

        application: {
          connect: {
            id: application.id,
          },
        },

        service: {
          connect: {
            id: service.id,
          },
        },

        amount: feeAmount,

        paymentStatus: "confirmed",

        createdBy: {
          connect: {
            id: user.id,
          },
        },

        paidAt: new Date(),

        transactionRef: generateReference("TEST-PAY"),
      },
    });

    // Payment
    const payment = await tx.payment.create({
      data: {
        invoice: {
          connect: {
            id: invoice.id,
          },
        },

        amount: feeAmount,

        method: "online_gateway",

        status: "confirmed",

        reference: generateReference("TEST-REF"),

        gatewayRef: generateReference("TEST-GATEWAY"),

        paidBy: {
          connect: {
            id: user.id,
          },
        },

        confirmedAt: new Date(),
      },
    });

    // Receipt
    const receipt = await tx.receipt.create({
      data: {
        receiptNumber: generateReference("RCP"),

        verificationCode: generateReference("VERIFY"),

        qrToken: generateReference("QR"),

        amountPaid: feeAmount,

        invoice: {
          connect: {
            id: invoice.id,
          },
        },

        issuedBy: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    return {
      application,
      invoice,
      payment,
      receipt,
    };
  });

  // --------------------------------------------------
  // 4. DISPLAY RESULT
  // --------------------------------------------------

  console.log("\n========================================");
  console.log("TEST APPLICATION CREATED");
  console.log("========================================");

  console.log(`Application ID:     ${result.application.id}`);
  console.log(
    `Application Number: ${result.application.applicationNumber}`,
  );
  console.log(`Status:             ${result.application.status}`);
  console.log(`Service:            ${service.name}`);
  console.log(`Applicant:          ${user.email}`);
  console.log(`Invoice:            ${result.invoice.invoiceNumber}`);
  console.log(`Payment:            ${result.payment.reference}`);
  console.log(`Receipt:            ${result.receipt.receiptNumber}`);

  console.log("\nYou can now log in as:");
  console.log(TEST_EMAIL);

  console.log("\nApplication is ready for form completion.");
}

main()
  .catch((error) => {
    console.error("\nFailed to create test application:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });