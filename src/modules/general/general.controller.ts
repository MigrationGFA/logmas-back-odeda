



import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';

/**
 * @desc    Get all active wards (Lightweight list for general public/dropdown use)
 * @route   GET /api/v1/wards
 * @access  Public / General
 */
export const getWardsList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const wards = await prisma.ward.findMany({
      where: {
        // deletedAt: null // Exclude soft-deleted records
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: {
        name: 'asc' // Sorted alphabetically for UI convenience
      }
    });

    res.status(200).json({
      success: true,
      count: wards.length,
      data: wards
    });
  } catch (error) {
    next(error);
  }
};
