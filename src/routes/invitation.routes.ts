import { Router } from "express";
import {
  createInvitation,
  acceptInvitation,
  getInvitation,
} from "../controllers/invitation.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("SUPERADMIN", "ADMIN"),
  createInvitation
);

router.post("/accept", acceptInvitation);

router.get("/verify/:token", getInvitation);

export default router;