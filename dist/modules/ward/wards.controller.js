"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.softDeleteWard = exports.updateWard = exports.getWards = exports.createWard = void 0;
const prisma_1 = require("../../utils/prisma");
const response_1 = require("../../utils/response");
const createWard = async (req, res, next) => {
    try {
        const entity = await prisma_1.prisma.ward.create({ data: req.body });
        return (0, response_1.sendSuccess)(res, entity, null, 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createWard = createWard;
const getWards = async (req, res, next) => {
    try {
        const datasets = await prisma_1.prisma.ward.findMany({ where: { deletedAt: null } });
        return (0, response_1.sendSuccess)(res, datasets);
    }
    catch (err) {
        next(err);
    }
};
exports.getWards = getWards;
const updateWard = async (req, res, next) => {
    try {
        const response = await prisma_1.prisma.ward.update({ where: { id: String(req.params.id) }, data: req.body });
        return (0, response_1.sendSuccess)(res, response);
    }
    catch (err) {
        next(err);
    }
};
exports.updateWard = updateWard;
const softDeleteWard = async (req, res, next) => {
    try {
        await prisma_1.prisma.ward.update({ where: { id: String(req.params.id) }, data: { deletedAt: new Date() } });
        return (0, response_1.sendSuccess)(res, { message: 'Ward systemic perimeter entity soft dropped.' });
    }
    catch (err) {
        next(err);
    }
};
exports.softDeleteWard = softDeleteWard;
