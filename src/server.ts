import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import prisma from "./lib/prisma";
import authRoutes from "./routes/auth.routes"
import invitationRoutes from "./routes/invitation.routes"
import houseRoutes from "./routes/house.routes"
import votingRoutes from "./routes/voting.routes"
import electionRoutes from "./routes/election.routes"
import candidateRoutes from "./routes/candidate.routes"
import auditRoutes from "./routes/audit.routes"
import userRoutes from "./routes/user.routes"

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/auth",authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/houses", houseRoutes);
app.use("/api/voting", votingRoutes);
app.use("/api/elections", electionRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/audit-logs", auditRoutes);

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Backend Pemilihan RT berjalan",
  });
});

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "Database terhubung",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database tidak terhubung",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});