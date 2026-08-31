import { Router } from "express";
import {
  createServiceController,
  getServiceByCode,
  listServices,
  updateServiceController,
} from "./services.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const router = Router();

// Public service catalogue
router.post("/", requireAuth, createServiceController);
router.get("/", listServices);
router.patch("/:id",requireAuth, updateServiceController);

// Single service
router.get("/:code", getServiceByCode);

export default router;
