"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// permits.routes.ts
const express_1 = require("express");
const permits_controller_1 = require("./permits.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const router = (0, express_1.Router)();
router.get('/verify/:token', permits_controller_1.verifyPermitByToken);
router.post('/', auth_middleware_1.requireAuth, permits_controller_1.createPermitApplication);
router.get('/', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin', 'chairman'), permits_controller_1.getPermits);
router.patch('/:id/issue', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin'), permits_controller_1.issuePermit);
exports.default = router;
