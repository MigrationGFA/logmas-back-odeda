"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// wards.routes.ts
const express_1 = require("express");
const wards_controller_1 = require("./wards.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.requireAuth, wards_controller_1.getWards);
router.post('/', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin'), wards_controller_1.createWard);
router.put('/:id', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin'), wards_controller_1.updateWard);
router.delete('/:id', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin'), wards_controller_1.softDeleteWard);
exports.default = router;
