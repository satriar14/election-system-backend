import { Router } from "express";
import {
  getUsers,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
} from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SUPERADMIN", "ADMIN", "PENGAWAS"), getUsers);
router.put("/:id/role", authorize("SUPERADMIN"), updateUserRole);
router.put("/:id/status", authorize("SUPERADMIN", "ADMIN"), toggleUserStatus);
router.delete("/:id", authorize("SUPERADMIN"), deleteUser);

export default router;
