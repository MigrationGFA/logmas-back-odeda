"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = __importDefault(require("./config/env"));
const app_1 = __importDefault(require("./app"));
const PORT = env_1.default.PORT || 3004;
app_1.default.listen(PORT, () => {
    console.log(`🚀 LOGMAS API Engine running on mode: [${env_1.default.NODE_ENV}] listening intently on tracking socket port reference: ${PORT}`);
    console.log(`📑 Swagger Documentation active dashboard endpoints maps served directly on: http://localhost:${PORT}/api/v1/docs`);
    console.log("✅✅ endpoint active");
});
