import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { createAuditLog } from "../services/audit.service";

// Helper to find or create the default active election
const getOrCreateDefaultElection = async () => {
  let election = await prisma.election.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!election) {
    election = await prisma.election.create({
      data: {
        title: "Pemilihan Ketua RT",
        description: "Agenda Pemilihan Ketua RT Resmi",
        status: "ONGOING",
      },
    });
  } else if (election.status !== "ONGOING") {
    election = await prisma.election.update({
      where: { id: election.id },
      data: { status: "ONGOING" },
    });
  }

  return election;
};

export const getAllCandidates = async (req: AuthRequest, res: Response) => {
  try {
    const candidates = await prisma.candidate.findMany({
      orderBy: {
        createdAt: "asc",
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    const data = candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      photo: candidate.photo,
      vision: candidate.vision,
      mission: candidate.mission,
      isLag: candidate.isLag,
      electionId: candidate.electionId,
      voteCount: candidate._count.votes,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    }));

    return res.json({
      success: true,
      message: "Data kandidat berhasil diambil",
      data,
    });
  } catch (error) {
    console.error("GET ALL CANDIDATES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data kandidat",
    });
  }
};

export const getCandidatesByElection = async (req: AuthRequest, res: Response) => {
  try {
    const electionId = req.params.electionId as string;

    const candidates = await prisma.candidate.findMany({
      where: {
        electionId,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    const data = candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      photo: candidate.photo,
      vision: candidate.vision,
      mission: candidate.mission,
      isLag: candidate.isLag,
      electionId: candidate.electionId,
      voteCount: candidate._count.votes,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    }));

    return res.json({
      success: true,
      message: "Data kandidat berhasil diambil",
      data,
    });
  } catch (error) {
    console.error("GET CANDIDATES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data kandidat",
    });
  }
};

export const getCandidateById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        election: true,
        _count: {
          select: { votes: true },
        },
      },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Kandidat tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Detail kandidat berhasil diambil",
      data: {
        id: candidate.id,
        name: candidate.name,
        photo: candidate.photo,
        vision: candidate.vision,
        mission: candidate.mission,
        isLag: candidate.isLag,
        electionId: candidate.electionId,
        election: candidate.election,
        voteCount: candidate._count.votes,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      },
    });
  } catch (error) {
    console.error("GET CANDIDATE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil detail kandidat",
    });
  }
};

export const createCandidate = async (req: AuthRequest, res: Response) => {
  try {
    const { electionId: inputElectionId, name, photo, vision, mission, isLag } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Nama kandidat wajib diisi",
      });
    }

    let targetElectionId = inputElectionId;
    if (!targetElectionId) {
      const defaultElection = await getOrCreateDefaultElection();
      targetElectionId = defaultElection.id;
    }

    const candidate = await prisma.candidate.create({
      data: {
        electionId: targetElectionId,
        name: String(name).trim(),
        photo: photo ? String(photo).trim() : null,
        vision: vision ? String(vision).trim() : null,
        mission: mission ? String(mission).trim() : null,
        ...(req.user!.role === "SUPERADMIN" && isLag !== undefined && { isLag: Boolean(isLag) }),
      },
    });

    await createAuditLog({
      userId: req.user!.userId,
      action: "CREATE",
      entity: "CANDIDATE",
      entityId: candidate.id,
      details: `Menambahkan kandidat "${candidate.name}"`,
    });

    return res.status(201).json({
      success: true,
      message: "Kandidat berhasil ditambahkan",
      data: candidate,
    });
  } catch (error) {
    console.error("CREATE CANDIDATE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menambahkan kandidat",
    });
  }
};

export const updateCandidate = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, photo, vision, mission, isLag } = req.body || {};

    const candidate = await prisma.candidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Kandidat tidak ditemukan",
      });
    }

    const updatedCandidate = await prisma.candidate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(photo !== undefined && { photo: photo ? String(photo).trim() : null }),
        ...(vision !== undefined && { vision: vision ? String(vision).trim() : null }),
        ...(mission !== undefined && { mission: mission ? String(mission).trim() : null }),
        ...(req.user!.role === "SUPERADMIN" && isLag !== undefined && { isLag: Boolean(isLag) }),
      },
    });

    await createAuditLog({
      userId: req.user!.userId,
      action: "UPDATE",
      entity: "CANDIDATE",
      entityId: updatedCandidate.id,
      details: `Memperbarui data kandidat "${updatedCandidate.name}"`,
    });

    return res.json({
      success: true,
      message: "Kandidat berhasil diperbarui",
      data: updatedCandidate,
    });
  } catch (error) {
    console.error("UPDATE CANDIDATE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui kandidat",
    });
  }
};

export const deleteCandidate = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const candidate = await prisma.candidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Kandidat tidak ditemukan",
      });
    }

    const voteCount = await prisma.vote.count({
      where: { candidateId: id },
    });

    if (voteCount > 0 && req.user!.role !== "SUPERADMIN") {
      return res.status(403).json({
        success: false,
        message: `Kandidat tidak dapat dihapus karena sudah memiliki ${voteCount} suara. Hanya superadmin yang dapat menghapusnya`,
      });
    }

    // Suara kandidat ikut dihapus (relasi Vote -> Candidate bersifat RESTRICT)
    await prisma.$transaction([
      prisma.vote.deleteMany({ where: { candidateId: id } }),
      prisma.candidate.delete({ where: { id } }),
    ]);

    await createAuditLog({
      userId: req.user!.userId,
      action: "DELETE",
      entity: "CANDIDATE",
      entityId: candidate.id,
      details:
        voteCount > 0
          ? `Menghapus kandidat "${candidate.name}" beserta ${voteCount} suaranya`
          : `Menghapus kandidat "${candidate.name}"`,
    });

    return res.json({
      success: true,
      message: "Kandidat berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE CANDIDATE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal menghapus kandidat",
    });
  }
};