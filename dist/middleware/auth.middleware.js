"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const jwt_1 = require("../utils/jwt");
const response_1 = require("../utils/response");
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return (0, response_1.sendError)(res, 'Authorization token missing or malformed', 'UNAUTHORIZED', null, 401);
        }
        const token = authHeader.split(' ')[1];
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        req.user = {
            ...decoded,
            role: decoded.role
        };
        next();
    }
    catch (error) {
        return (0, response_1.sendError)(res, 'Invalid or expired access token', 'UNAUTHORIZED', null, 401);
    }
};
exports.requireAuth = requireAuth;
