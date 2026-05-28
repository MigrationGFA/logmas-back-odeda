"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// users.routes.ts
const express_1 = require("express");
const users_controller_1 = require("./users.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin'));
router.post('/', users_controller_1.createUser);
router.get('/', users_controller_1.getUsers);
router.get('/:id', users_controller_1.getUserById);
router.put('/:id', users_controller_1.updateUser);
router.delete('/:id', users_controller_1.softDeleteUser);
exports.default = router;
