import { Router } from "express";
import {
  getAuditLogs,
  getAuditLogById,
} from "../controllers/audit.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  getAuditLogs
);

router.get(
  "/:id",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  getAuditLogById
);

export default router;