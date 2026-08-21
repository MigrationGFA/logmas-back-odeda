import {
  Prisma,
  PrismaClient,
  ServiceCategory,
  FeeType,
  CertificateType,
  FeeStatus,
  Role,
} from "@prisma/client";
import bcrypt from "bcryptjs";

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
      requirements: ["club_constitution", "inaugural_minutes", "executives_list_signed","president_passport","secretariat_proof"],
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
      requirements: ["cda_constitution", "inaugural_minutes","boundary_sketch","chairman_passport","baale_letter"],
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
      requirements: ["land_tenure_proof", "farmer_photo","farmer_nin","farm_sketch_map","coop_membership_doc"],
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
      requirements: ["cac_cert", "facility_restroom_photos","sanitation_layout","fumigation_cert","waste_contract_agreement"],
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
      requirements: ["previous_receipt", "owner_id","title_document","building_photos"],
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
      requirements: ["vehicle_reg_papers", "drivers_licences","roadworthiness_cert","quarry_loading_pass","cac_cert"],
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
      requirements: ["premises_plan", "cac_cert", "fire_clearance","police_clearance","hygiene_cert"],
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
      requirements: ["operator_id", "cac_cert","hall_layout","commercial_broadcast_receipt","fire_safety_cert"],
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
      requirements: ["eia_approval", "police_explosives_permit", "mining_cadastre_lease","cda_agreement","coren_mining_cert"],
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
      requirements: ["kiosk_photo", "landowner_consent","passport_photo","operator_id"],
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
      requirements: ["cda_resolution", "survey_layout_plan","traditional_ruler_letter","applicant_id"],
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
      requirements: ["passport_photo", "nin_slip", "proof_of_residency"],
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

   const users = [
    {
      email: "citizen@odeda.test",
      firstName: "Citizen User",
      lastName: "Odeda",
      role: Role.citizen,
      // Plain password: Citizen123!
      password: "Citizen123!",
    },
    {
      email: "fieldofficer@odeda.test",
      firstName: "Field Officer",
      lastName: "Odeda",
      role: Role.field_officer,
      // Plain password: FieldOfficer123!
      password: "FieldOfficer123!",
    },
    {
      email: "evans@joemarineng.com",
      firstName: "LGA Admin",
      lastName: "Odeda",
      role: Role.lga_admin,
      // Plain password: LgaAdmin123!
      password: "LgaAdmin123!",
    },
  ];

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        password: hashed,
        isActive: true,
      },
      create: {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        password: hashed,
        isActive: true,
      },
    });
    console.log(`✅ User seeded: ${u.email} (${u.role})`);
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