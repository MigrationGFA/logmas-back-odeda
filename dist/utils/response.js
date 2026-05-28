"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = void 0;
const sendSuccess = (res, data, meta = null, statusCode = 200) => {
    return res.status(statusCode).json({
        data,
        meta,
        error: null
    });
};
exports.sendSuccess = sendSuccess;
const sendError = (res, message, code = 'INTERNAL_SERVER_ERROR', details = null, statusCode = 500) => {
    return res.status(statusCode).json({
        data: null,
        meta: null,
        error: {
            code,
            message,
            details
        }
    });
};
exports.sendError = sendError;
