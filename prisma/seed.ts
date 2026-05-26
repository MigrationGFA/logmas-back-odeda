import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

// Initialize with the Prisma 7 Driver Adapter setup you implemented
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seeding sequence...');

  // 1. Clean out existing test ward records to prevent unique constraints issues (name/code)
  await prisma.ward.deleteMany();
  console.log('🗑️ Cleared existing wards.');

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

  // 3. Batch insert using createMany
  const seededWards = await prisma.ward.createMany({
    data: ijebuNorthEastWards,
    skipDuplicates: true,
  });

  console.log(`✅ Database seeding completed successfully! Inserted ${seededWards.count} records.`);
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