"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.softDeleteUser = exports.updateUser = exports.getUserById = exports.getUsers = exports.createUser = void 0;
const prisma_1 = require("../../utils/prisma");
const response_1 = require("../../utils/response");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const createUser = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, role } = req.body;
        const hash = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.prisma.user.create({
            data: { email, password: hash, firstName, lastName, role }
        });
        return (0, response_1.sendSuccess)(res, user, null, 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createUser = createUser;
const getUsers = async (req, res, next) => {
    try {
        const records = await prisma_1.prisma.user.findMany({ where: { deletedAt: null } });
        return (0, response_1.sendSuccess)(res, records);
    }
    catch (err) {
        next(err);
    }
};
exports.getUsers = getUsers;
const getUserById = async (req, res, next) => {
    try {
        const record = await prisma_1.prisma.user.findFirst({ where: { id: String(req.params.id), deletedAt: null } });
        if (!record)
            return (0, response_1.sendError)(res, 'User system entity missing', 'NOT_FOUND', null, 404);
        return (0, response_1.sendSuccess)(res, record);
    }
    catch (err) {
        next(err);
    }
};
exports.getUserById = getUserById;
const updateUser = async (req, res, next) => {
    try {
        const updated = await prisma_1.prisma.user.update({ where: { id: String(req.params.id) }, data: req.body });
        return (0, response_1.sendSuccess)(res, updated);
    }
    catch (err) {
        next(err);
    }
};
exports.updateUser = updateUser;
const softDeleteUser = async (req, res, next) => {
    try {
        await prisma_1.prisma.user.update({ where: { id: String(req.params.id) }, data: { deletedAt: new Date() } });
        return (0, response_1.sendSuccess)(res, { message: 'User runtime identity profile flag-deleted successfully' });
    }
    catch (err) {
        next(err);
    }
};
exports.softDeleteUser = softDeleteUser;
