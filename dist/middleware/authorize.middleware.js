"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
const response_1 = require("../utils/response");
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, response_1.sendError)(res, 'Unauthenticated', 'UNAUTHORIZED', null, 401);
        }
        if (!roles.includes(req.user.role)) {
            return (0, response_1.sendError)(res, 'You do not have permission to access this resource', 'FORBIDDEN', null, 403);
        }
        next();
    };
};
exports.requireRole = requireRole;
