"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerDocument = void 0;
// src/config/swagger.ts
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const env_1 = __importDefault(require("./env"));
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'LOGMAS API Engine',
            version: '1.0.0',
            description: 'Local Government Management & Automation System — API Documentation',
        },
        servers: [
            {
                url: `http://localhost:${env_1.default.PORT}/api/v1`,
                description: 'Local Development',
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [{ BearerAuth: [] }],
    },
    // Scans all route files automatically
    apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.routes.js'],
};
exports.swaggerDocument = (0, swagger_jsdoc_1.default)(options);
