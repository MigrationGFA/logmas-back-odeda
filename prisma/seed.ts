import { PrismaClient, RevenueCategory } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

// Initialize with your driver adapter setup
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Isolated helper function to populate default permit configurations
async function seedPermitConfigurations() {
  console.log('⏳ Injecting Trade Permit framework configurations...');

  const permitConfigs = [
    {
      name: 'Standard Retail Trade Permit (Kiosk / Small Shop)',
      code: 'TP_RETAIL_SM',
      baseAmount: 15000.00,
      category: RevenueCategory.trade_permit,
      isActive: true,
    },
    {
      name: 'Medium Commercial Trade Permit (Supermarket / Pharmacy)',
      code: 'TP_COMM_MD',
      baseAmount: 45000.00,
      category: RevenueCategory.trade_permit,
      isActive: true,
    },
    {
      name: 'Large Scale Industrial Trade Permit (Wholesale / Manufacturing)',
      code: 'TP_IND_LG',
      baseAmount: 120000.00,
      category: RevenueCategory.trade_permit,
      isActive: true,
    },
    {
      name: 'Social Event Permit (Plaza / Hall / Open Air Blockage)',
      code: 'EP_SOCIAL_LG',
      baseAmount: 35000.00,
      category: RevenueCategory.event_permit,
      isActive: true,
    },
    {
      name: 'Corporate Event Permit (Exhibition / Concert Venue)',
      code: 'EP_CORP_MD',
      baseAmount: 75000.00,
      category: RevenueCategory.event_permit,
      isActive: true,
    },
  ];

  const seededConfigs = await prisma.permitConfig.createMany({
    data: permitConfigs,
    skipDuplicates: true,
  });

  console.log(`📋 Permit configurations seeded: ${seededConfigs.count} item records.`);
}

async function main() {
  console.log('🌱 Starting database seeding sequence...');

  // 1. Clear out data in reverse order of dependencies to respect foreign key constraints
  await prisma.permitConfig.deleteMany();
  await prisma.ward.deleteMany();
  console.log('🗑️ Cleared existing configurations and wards.');

  // 2. Real administrative Wards of Ijebu North East LGA, Ogun State
  const ijebuNorthEastWards = [
    { name: 'Atan I', code: 'INE-01', description: 'Atan Headquarters Ward 1' },
    { name: 'Atan II', code: 'INE-02', description: 'Atan Headquarters Ward 2' },
    { name: 'Imesan / Idomila', code: 'INE-03', description: 'Imesan and Idomila residential axis' },
    { name: 'Ilese', code: 'INE-04', description: 'Ilese township sector' },
    { name: 'Ijeun / Ilugun', code: 'INE-05', description: 'Ijeun and Ilugun agrarian community belt' },
    { name: 'Itamapako', code: 'INE-06', description: 'Itamapako territorial boundary' },
    { name: 'Ogbogbo', code: 'INE-07', description: 'Ogbogbo community development area' },
    { name: 'Iwopin / Oru', code: 'INE-08', description: 'Iwopin and outlying settlements' },
    { name: 'Erunwon', code: 'INE-09', description: 'Erunwon ancient township perimeter' },
    { name: 'Imodi / Imosan', code: 'INE-10', description: 'Imodi and Imosan unified ward structure' },
  ];

  console.log(`⏳ Injecting ${ijebuNorthEastWards.length} administrative wards...`);
  const seededWards = await prisma.ward.createMany({
    data: ijebuNorthEastWards,
    skipDuplicates: true,
  });
  console.log(`✅ Wards seeded: ${seededWards.count} records.`);

  // 3. Execute the permit config sub-seeder
  await seedPermitConfigurations();

  console.log('🎉 Database seeding sequence completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Database seeding process terminated due to an error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });