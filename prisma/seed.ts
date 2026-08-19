import {
  Prisma,
  PrismaClient,
  ServiceCategory,
  FeeType,
  CertificateType,
  FeeStatus,
} from "@prisma/client";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";


const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const services = [
    // CERTIFICATES
    {
      code: "certificate_of_origin",
      certificateType: CertificateType.CERTIFICATE_OF_ORIGIN,
      name: "Certificate of Origin",
      description:
        "Official certificate confirming the origin of goods or products supplied from Odeda.",
      category: ServiceCategory.CERTIFICATE,
      revenueHead: "1001 - Statutory Certificate Fees",
      requirements: ["passport_photo", "nin_slip", "proof_of_residency"],
      estimatedDays: 3,
      fee: 10000,
    },
    {
      code: "club_registration",
      certificateType: CertificateType.CLUB_REGISTRATION,
      name: "Certificate of Club Registration",
      description:
        "Registration certificate issued to social and professional clubs operating in Odeda.",
      category: ServiceCategory.CERTIFICATE,
      revenueHead: "1002 - Social & Club Fees",
      requirements: ["constitution", "members_list", "cac_docs"],
      estimatedDays: 5,
      fee: 15000,
    },
    {
      code: "cda_registration",
      certificateType: CertificateType.CDA_REGISTRATION,
      name: "Certificate of CDA Registration",
      description:
        "Certificate acknowledging the registration of a Community Development Association.",
      category: ServiceCategory.CERTIFICATE,
      revenueHead: "1003 - Community Dev. Fees",
      requirements: ["cda_constitution", "executive_list"],
      estimatedDays: 5,
      fee: 12000,
    },
    {
      code: "farmers_registration",
      certificateType: CertificateType.FARMERS_REGISTRATION,
      name: "Certificate of Farmers Registration",
      description:
        "Registration certificate for farmers and agricultural producers within Odeda.",
      category: ServiceCategory.CERTIFICATE,
      revenueHead: "1004 - Agricultural & Farmers Fees",
      requirements: ["farm_location_proof", "passport_photo"],
      estimatedDays: 3,
      fee: 5000,
    },
    {
      code: "sanitation_compliance",
      certificateType: CertificateType.ENVIRONMENTAL_SANITATION_COMPLIANCE,
      name: "Certificate of Environmental Sanitation",
      description:
        "Certificate confirming environmental sanitation compliance after inspection.",
      category: ServiceCategory.CERTIFICATE,
      revenueHead: "1005 - Environmental Sanitation Fees",
      requirements: ["site_inspection", "sanitation_report"],
      estimatedDays: 7,
      fee: 8000,
    },

    // RATES AND LEVIES
    {
      code: "tenement_rate",
      certificateType: CertificateType.TENEMENT_RATE_CLEARANCE,
      name: "Tenement Rate",
      description:
        "Assessment and levy on property or tenement holdings located in Odeda.",
      category: ServiceCategory.RATES_AND_LEVIES,
      revenueHead: "2001 - Tenement & Property Rates",
      requirements: ["property_title", "survey_plan"],
      estimatedDays: 14,
      fee: 25000,
    },
    {
      code: "haulage_fees",
      certificateType: CertificateType.HAULAGE_PERMIT,
      name: "Haulage Fees",
      description:
        "Fees charged for the movement and transit of goods or materials through Odeda.",
      category: ServiceCategory.RATES_AND_LEVIES,
      revenueHead: "2002 - Haulage & Transit Levies",
      requirements: ["vehicle_papers", "driver_license"],
      estimatedDays: 2,
      fee: 7500,
    },

    // LICENCES AND PERMITS
    {
      code: "liquor_licence",
      certificateType: CertificateType.LIQUOR_LICENCE,
      name: "Liquor Licence Fees",
      description:
        "Licence fee for retail or commercial sale of liquor and associated outlets.",
      category: ServiceCategory.LICENCES_AND_PERMITS,
      revenueHead: "2003 - Liquor & Liquor Outlets",
      requirements: ["premises_photo", "cac_docs", "health_certificate"],
      estimatedDays: 10,
      fee: 30000,
    },
    {
      code: "viewing_centre_licence",
      certificateType: CertificateType.VIEWING_CENTRE_LICENCE,
      name: "Viewing Centre Licence Fee",
      description:
        "Licence fee for operating a cinema, viewing centre, or entertainment outlet.",
      category: ServiceCategory.LICENCES_AND_PERMITS,
      revenueHead: "2004 - Entertainment & Viewing Centres",
      requirements: ["premises_photo", "capacity_plan"],
      estimatedDays: 7,
      fee: 20000,
    },
    {
      code: "quarry_permit",
      certificateType: CertificateType.QUARRY_PERMIT,
      name: "Quarry Fees and Permits",
      description:
        "Permit and operational fee for quarrying, mining, and mineral exploration activities.",
      category: ServiceCategory.LICENCES_AND_PERMITS,
      revenueHead: "2005 - Mining & Mineral Resources",
      requirements: ["site_survey", "equipment_list", "eia_report"],
      estimatedDays: 21,
      fee: 50000,
    },
    {
      code: "kiosk_licence",
      certificateType: CertificateType.KIOSK_LICENCE,
      name: "Kiosk Licence",
      description:
        "Licence for operating a temporary kiosk or small commercial structure.",
      category: ServiceCategory.LICENCES_AND_PERMITS,
      revenueHead: "2007 - Kiosk & Temporary Structures",
      requirements: ["kiosk_photo", "location_plan"],
      estimatedDays: 3,
      fee: 5000,
    },

    // URBAN DEVELOPMENT
    {
      code: "street_naming",
      certificateType: CertificateType.STREET_NAMING_CERTIFICATE,
      name: "Street Naming and Property Numbering",
      description:
        "Urban development service for assigning official street names and property numbering.",
      category: ServiceCategory.URBAN_DEVELOPMENT,
      revenueHead: "2006 - Urban Dev & Street Naming",
      requirements: ["survey_plan", "property_title"],
      estimatedDays: 14,
      fee: 35000,
    },

    // STATE OF ORIGIN
    {
      code: "state_of_origin",
      certificateType: CertificateType.CERTIFICATE_OF_ORIGIN,
      name: "State of Origin Certificate",
      description:
        "Certificate of Origin / State of Origin issued by LGA for residents.",
      category: ServiceCategory.CERTIFICATE,
      revenueHead: "1010 - State of Origin Fees",
      requirements: ["passport_photo", "nin_slip", "proof_of_residency"],
      estimatedDays: 5,
      fee: 7500,
    },

    // BUSINESS REGISTRATION
    {
      code: "business_registration",
      certificateType: CertificateType.CDA_REGISTRATION,
      name: "Business Registration",
      description: "Register a new business with the Local Government",
      category: ServiceCategory.LICENCES_AND_PERMITS,
      revenueHead: "3001 - Business Registration",
      requirements: ["business_name", "owner_name", "cac_docs", "phone"],
      estimatedDays: 7,
      fee: 15000,
    },
  ];

  for (const s of services) {
    const supportsRenewal = [
      "liquor_licence",
      "viewing_centre_licence",
      "kiosk_licence",
      "quarry_permit",
    ].includes(s.code);

    // ---------------------------------------------------------
    // 1. Create/update service
    // ---------------------------------------------------------
    const service = await prisma.service.upsert({
      where: {
        code: s.code,
      },
      update: {
        name: s.name,
        category: s.category,
        revenueHead: s.revenueHead,
        requirements: s.requirements,
        estimatedDays: s.estimatedDays,
        certificateType: s.certificateType,
        supportsRenewal,
        isActive: true,
        description: s.description,
      },
      create: {
        code: s.code,
        name: s.name,
        description: s.description,
        certificateType: s.certificateType,
        category: s.category,
        revenueHead: s.revenueHead,
        requirements: s.requirements,
        estimatedDays: s.estimatedDays,
        supportsRenewal,
        isActive: true,
      },
    });

    // ---------------------------------------------------------
    // 2. Create/update the service fee configuration
    // ---------------------------------------------------------
    await prisma.serviceFeeConfig.upsert({
      where: {
        serviceId: service.id,
      },
      update: {
        amount: s.fee,
        status: FeeStatus.ACTIVE,
      },
      create: {
        serviceId: service.id,
        amount: s.fee,
        status: FeeStatus.ACTIVE,
      },
    });

    console.log(
      `✅ ${service.name} → ₦${s.fee.toLocaleString()} (${FeeStatus.ACTIVE})`,
    );
  }

  console.log("✅ Odeda services and service fees seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });