"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const response_1 = require("../utils/response");
const env = require('../config/env');
const errorHandler = (err, req, res, next) => {
    console.error('🔥 Centralized Error Captured:', err.message || err);
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_SERVER_ERROR';
    const message = err.message || 'An unexpected operational breakdown occurred.';
    const details = env.NODE_ENV === 'development' ? err.stack : null;
    return (0, response_1.sendError)(res, message, code, details, statusCode);
};
exports.errorHandler = errorHandler;
