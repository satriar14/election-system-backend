import { Router } from "express";
import {
  getAllCandidates,
  getCandidatesByElection,
  getCandidateById,
  createCandidate,
  updateCandidate,
  deleteCandidate,
} from "../controllers/candidate.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

router.get(
  "/",
  getAllCandidates
);

router.get(
  "/election/:electionId",
  getCandidatesByElection
);

router.get(
  "/:id",
  getCandidateById
);

router.post(
  "/",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  createCandidate
);

router.put(
  "/:id",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  updateCandidate
);

router.delete(
  "/:id",
  authenticate,
  authorize("SUPERADMIN", "ADMIN", "PENGAWAS"),
  deleteCandidate
);

export default router;