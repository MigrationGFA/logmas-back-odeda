"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.validateBody = void 0;
const response_1 = require("../utils/response");
const validateBody = (schema) => {
    return async (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return (0, response_1.sendError)(res, 'Data validation validation processing failed', 'VALIDATION_ERROR', result.error.format(), 400);
        }
        req.body = result.data;
        next();
    };
};
exports.validateBody = validateBody;
const validateQuery = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success)
        return (0, response_1.sendError)(res, 'Invalid query parameters', 'VALIDATION_ERROR', result.error.format(), 400);
    req.query = result.data;
    next();
};
exports.validateQuery = validateQuery;
