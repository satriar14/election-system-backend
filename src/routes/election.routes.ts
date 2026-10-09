import { Router } from "express";
import {
  getElections,
  getElectionById,
  createElection,
  updateElection,
  deleteElection,
} from "../controllers/election.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  getElections
);

router.get(
  "/:id",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  getElectionById
);

router.post(
  "/",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  createElection
);

router.put(
  "/:id",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  updateElection
);

router.delete(
  "/:id",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  deleteElection
);

export default router;