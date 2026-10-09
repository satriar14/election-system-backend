import { Router } from "express";
import {
  getHouses,
  getHouseById,
  createHouse,
  updateHouse,
  deleteHouse,
} from "../controllers/house.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  getHouses
);

router.get(
  "/:id",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  getHouseById
);

router.post(
  "/",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  createHouse
);

router.put(
  "/:id",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  updateHouse
);

router.delete(
  "/:id",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  deleteHouse
);

export default router;