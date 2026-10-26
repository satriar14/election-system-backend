import { Router } from "express";
import {
  getElections,
  getElectionById,
  createElection,
  updateElection,
  deleteElection,
  resetElection,
  endElectionNow,
  publishElection,
  showGraphElection,
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

router.post(
  "/reset",
  authenticate,
  authorize("SUPERADMIN", "ADMIN"),
  resetElection
);

router.get(
  "/:id",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  getElectionById
);

router.post(
  "/:id/publish",
  authenticate,
  authorize("SUPERADMIN", "ADMIN"),
  publishElection
);

router.post(
  "/:id/end-now",
  authenticate,
  authorize("SUPERADMIN", "ADMIN"),
  endElectionNow
);

router.post(
  "/:id/show-graph",
  authenticate,
  authorize("SUPERADMIN", "ADMIN"),
  showGraphElection
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