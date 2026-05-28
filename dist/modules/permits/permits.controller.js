"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPermitByToken = exports.getPermits = exports.issuePermit = exports.createPermitApplication = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../../utils/prisma");
const response_1 = require("../../utils/response");
const createPermitApplication = async (req, res, next) => {
    try {
        // const { title, description } = req.body;
        const permitNumber = `LOGMAS-PMT-${crypto_1.default.randomInt(100000, 999999)}`;
        const verificationCode = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
        const qrTokenToken = crypto_1.default.randomUUID();
        // const entry = await prisma.permit.create({
        //   data: {
        //     // title,
        //     // description,
        //     permitNumber,
        //     verificationCode,
        //     qrToken:qrTokenToken,
        //     status: 'pending_payment',
        //     // userId: req.user!.id
        //   }
        // });
        // return sendSuccess(res, entry, null, 201);
        return true;
    }
    catch (err) {
        next(err);
    }
};
exports.createPermitApplication = createPermitApplication;
const issuePermit = async (req, res, next) => {
    try {
        let { id } = req.params;
        if (Array.isArray(id))
            id = id[0];
        const entry = await prisma_1.prisma.permit.update({
            where: { id },
            data: { status: 'issued' }
        });
        return (0, response_1.sendSuccess)(res, entry);
    }
    catch (err) {
        next(err);
    }
};
exports.issuePermit = issuePermit;
const getPermits = async (req, res, next) => {
    try {
        const list = await prisma_1.prisma.permit.findMany({ include: { issuedBy: true, business: true, invoice: true } });
        return (0, response_1.sendSuccess)(res, list);
    }
    catch (err) {
        next(err);
    }
};
exports.getPermits = getPermits;
const verifyPermitByToken = async (req, res, next) => {
    try {
        // const token = req.params.token;
        const token = Array.isArray(req.params.token)
            ? req.params.token[0]
            : req.params.token;
        const entry = await prisma_1.prisma.permit.findFirst({
            where: { OR: [{ verificationCode: token }, { qrToken: token }] }
        });
        if (!entry)
            return (0, response_1.sendError)(res, 'No registered verification system match for token sequence', 'NOT_FOUND', null, 404);
        return (0, response_1.sendSuccess)(res, entry);
    }
    catch (err) {
        next(err);
    }
};
exports.verifyPermitByToken = verifyPermitByToken;
