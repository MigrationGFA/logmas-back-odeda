import { Prisma, PrismaClient, ServiceCategory, FeeType, CertificateType } from '@prisma/client';

import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

// Initialize with your driver adapter setup
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const services = [
    // CERTIFICATES
    {
      code: 'certificate_of_origin',
      certificateType: CertificateType.CERTIFICATE_OF_ORIGIN,
      name: 'Certificate of Origin',
      description: 'Official certificate confirming the origin of goods or products supplied from Odeda.',
      category: ServiceCategory.CERTIFICATE,
      revenueHead: '1001 - Statutory Certificate Fees',
      requirements: ['Passport Photo', 'NIN', 'Proof of Residency'],
      estimatedDays: 3,
    },
    {
      code: 'club_registration',
      certificateType: CertificateType.CLUB_REGISTRATION,
      name: 'Certificate of Club Registration',
      description: 'Registration certificate issued to social and professional clubs operating in Odeda.',
      category: ServiceCategory.CERTIFICATE,
      revenueHead: '1002 - Social & Club Fees',
      requirements: ['Constitution', 'Members List', 'CAC Docs'],
      estimatedDays: 5,
    },
    {
      code: 'cda_registration',
      certificateType: CertificateType.CDA_REGISTRATION,
      name: 'Certificate of CDA Registration',
      description: 'Certificate acknowledging the registration of a Community Development Association.',
      category: ServiceCategory.CERTIFICATE,
      revenueHead: '1003 - Community Dev. Fees',
      requirements: ['CDA Constitution', 'Executive List'],
      estimatedDays: 5,
    },
    {
      code: 'farmers_registration',
      certificateType: CertificateType.FARMERS_REGISTRATION,
      name: 'Certificate of Farmers Registration',
      description: 'Registration certificate for farmers and agricultural producers within Odeda.',
      category: ServiceCategory.CERTIFICATE,
      revenueHead: '1004 - Agricultural & Farmers Fees',
      requirements: ['Farm Location Proof', 'Passport Photo'],
      estimatedDays: 3,
    },
    {
      code: 'sanitation_compliance',
      certificateType: CertificateType.ENVIRONMENTAL_SANITATION_COMPLIANCE,
      name: 'Certificate of Environmental Sanitation',
      description: 'Certificate confirming environmental sanitation compliance after inspection.',
      category: ServiceCategory.CERTIFICATE,
      revenueHead: '1005 - Environmental Sanitation Fees',
      requirements: ['Site Inspection', 'Sanitation Report'],
      estimatedDays: 7,
    },
    // RATES AND LEVIES
    {
      code: 'tenement_rate',
      certificateType: CertificateType.TENEMENT_RATE_CLEARANCE,
      name: 'Tenement Rate',
      description: 'Assessment and levy on property or tenement holdings located in Odeda.',
      category: ServiceCategory.RATES_AND_LEVIES,
      revenueHead: '2001 - Tenement & Property Rates',
      requirements: ['Property Title', 'Survey Plan'],
      estimatedDays: 14,
    },
    {
      code: 'haulage_fees',
      certificateType: CertificateType.HAULAGE_PERMIT,
      name: 'Haulage Fees',
      description: 'Fees charged for the movement and transit of goods or materials through Odeda.',
      category: ServiceCategory.RATES_AND_LEVIES,
      revenueHead: '2002 - Haulage & Transit Levies',
      requirements: ['Vehicle Papers', 'Driver Licence'],
      estimatedDays: 2,
    },
    // LICENCES AND PERMITS
    {
      code: 'liquor_licence',
      certificateType: CertificateType.LIQUOR_LICENCE,
      name: 'Liquor Licence Fees',
      description: 'Licence fee for retail or commercial sale of liquor and associated outlets.',
      category: ServiceCategory.LICENCES_AND_PERMITS,
      revenueHead: '2003 - Liquor & Liquor Outlets',
      requirements: ['Premises Photo', 'CAC', 'Health Certificate'],
      estimatedDays: 10,
    },
    {
      code: 'viewing_centre_licence',
      certificateType: CertificateType.VIEWING_CENTRE_LICENCE,
      name: 'Viewing Centre Licence Fee',
      description: 'Licence fee for operating a cinema, viewing centre, or entertainment outlet.',
      category: ServiceCategory.LICENCES_AND_PERMITS,
      revenueHead: '2004 - Entertainment & Viewing Centres',
      requirements: ['Premises Photo', 'Capacity Plan'],
      estimatedDays: 7,
    },
    {
      code: 'quarry_permit',
      certificateType: CertificateType.QUARRY_PERMIT,
      name: 'Quarry Fees and Permits',
      description: 'Permit and operational fee for quarrying, mining, and mineral exploration activities.',
      category: ServiceCategory.LICENCES_AND_PERMITS,
      revenueHead: '2005 - Mining & Mineral Resources',
      requirements: ['Site Survey', 'Equipment List', 'EIA Report'],
      estimatedDays: 21,
    },
    {
      code: 'kiosk_licence',
      certificateType: CertificateType.KIOSK_LICENCE,
      name: 'Kiosk Licence',
      description: 'Licence for operating a temporary kiosk or small commercial structure.',
      category: ServiceCategory.LICENCES_AND_PERMITS,
      revenueHead: '2007 - Kiosk & Temporary Structures',
      requirements: ['Kiosk Photo', 'Location Plan'],
      estimatedDays: 3,
    },
    // URBAN DEVELOPMENT
    {
      code: 'street_naming',
      certificateType: CertificateType.STREET_NAMING_CERTIFICATE,
      name: 'Street Naming and Property Numbering',
      description: 'Urban development service for assigning official street names and property numbering.',
      category: ServiceCategory.URBAN_DEVELOPMENT,
      revenueHead: '2006 - Urban Dev & Street Naming',
      requirements: ['Survey Plan', 'Property Title'],
      estimatedDays: 14,
    },
  ];

  for (const s of services) {
    const supportsRenewal = ['liquor_licence', 'viewing_centre_licence', 'kiosk_licence', 'quarry_permit'].includes(s.code);

    await prisma.service.upsert({
      where: { code: s.code },
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
  }

  console.log('✅ 12 Odeda services seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });