"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const users_routes_1 = __importDefault(require("./modules/user/users.routes"));
const wards_routes_1 = __importDefault(require("./modules/ward/wards.routes"));
const complaints_routes_1 = __importDefault(require("./modules/complaints/complaints.routes"));
const field_routes_1 = __importDefault(require("./modules/operations/field.routes"));
const stateOfOrigin_routes_1 = __importDefault(require("./modules/stateOfOrigin/stateOfOrigin.routes"));
const business_routes_1 = __importDefault(require("./modules/business/business.routes"));
const upload_routes_1 = __importDefault(require("./modules/uploads/upload.routes"));
const lgaAdmin_routes_1 = __importDefault(require("./modules/lgaAdmin/lgaAdmin.routes"));
const contractor_routes_1 = __importDefault(require("./modules/contractor/contractor.routes"));
const treasurer_routes_1 = __importDefault(require("./modules/treasurer/treasurer.routes"));
const permits_routes_1 = __importDefault(require("./modules/permits/permits.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const swagger_1 = require("./config/swagger");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
// Base Health-Check Endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        status: "healthy",
        system: "LOGMAS API Engine",
        version: "1.0.0-phase1",
        timestamp: new Date().toISOString()
    });
});
app.use('/public', express_1.default.static('public'));
// API Engine Base Routing Architecture
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/users', users_routes_1.default);
app.use('/api/v1/wards', wards_routes_1.default);
app.use('/api/v1/lga', lgaAdmin_routes_1.default);
app.use('/api/v1/contractor', contractor_routes_1.default);
app.use('/api/v1/treasurer', treasurer_routes_1.default);
app.use('/api/v1/complaints', complaints_routes_1.default);
app.use('/api/v1/permits', permits_routes_1.default);
app.use('/api/v1/state-of-origin', stateOfOrigin_routes_1.default);
app.use('/api/v1/business', business_routes_1.default);
app.use('/api/v1/operations/field', field_routes_1.default);
app.use('/api/v1/uploads', upload_routes_1.default);
// Shared Interactive Engine Schema Verification Explorer Links UI Routes
app.use('/api/v1/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerDocument));
// Catch-All Global Pipeline Middleware Interceptors Engine Layer Handler
app.use(error_middleware_1.errorHandler);
exports.default = app;
