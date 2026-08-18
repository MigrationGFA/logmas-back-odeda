import { prisma } from "../../utils/prisma";

export const listActiveServices = async (category?: string) => {
  return prisma.service.findMany({
    where: {
      isActive: true,
      ...(category ? { category: category as any } : {}),
    },
    include: {
      feeConfig: {
        select: {
          id: true,
          amount: true,
          status: true,
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
    orderBy: [
      { category: "asc" },
      { name: "asc" },
    ],
  });
};

export const getActiveServiceByCode = async (code: string) => {
  return prisma.service.findFirst({
    where: {
      isActive: true,
      OR: [
        { id: code },
        { code },
      ],
    },
    include: {
      feeConfig: {
        select: {
          id: true,
          amount: true,
          status: true,
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
  });
};