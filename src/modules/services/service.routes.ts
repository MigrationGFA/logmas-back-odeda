import { Router } from "express";
import { getServiceByCode, listServices } from "./services.controller";


const router = Router();

// Public service catalogue
router.get("/", listServices);

// Single service
router.get("/:code", getServiceByCode);

export default router;