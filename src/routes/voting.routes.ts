import { Router } from "express";
import {
  verifyHouse,
  castVote,
  getActiveElection,
  getElectionResults,
  getVoteTrend,
} from "../controllers/voting.controller";

const router = Router();

router.get(
  "/election",
  getActiveElection
);

router.get(
  "/active-election",
  getActiveElection
);

router.post(
  "/verify-house",
  verifyHouse
);

router.post(
  "/vote",
  castVote
);

router.post(
  "/cast-vote",
  castVote
);

router.get(
  "/results/:electionId",
  getElectionResults
);

router.get(
  "/vote-trend/:electionId",
  getVoteTrend
);

export default router;