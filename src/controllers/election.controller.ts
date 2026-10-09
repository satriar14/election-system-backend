import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { createAuditLog } from "../services/audit.service";

const validStatuses = [
  "DRAFT",
  "UPCOMING",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
] as const;

export const getElections = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const elections = await prisma.election.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            candidates: true,
            votes: true,
          },
        },
      },
    });

    const data = elections.map((election) => ({
      id: election.id,
      title: election.title,
      description: election.description,
      status: election.status,
      startAt: election.startAt,
      endAt: election.endAt,
      candidateCount: election._count.candidates,
      voteCount: election._count.votes,
      createdAt: election.createdAt,
      updatedAt: election.updatedAt,
    }));

    return res.json({
      success: true,
      message: "Data pemilihan berhasil diambil",
      data,
    });
  } catch (error) {
    console.error("GET ELECTIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data pemilihan",
    });
  }
};

export const getElectionById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const election = await prisma.election.findUnique({
      where: {
        id,
      },
      include: {
        candidates: {
          orderBy: {
            createdAt: "asc",
          },
        },
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    if (!election) {
      return res.status(404).json({
        success: false,
        message: "Pemilihan tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Detail pemilihan berhasil diambil",
      data: {
        ...election,
        voteCount: election._count.votes,
      },
    });
  } catch (error) {
    console.error("GET ELECTION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil detail pemilihan",
    });
  }
};

export const createElection = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const {
      title,
      description,
      status,
      startAt,
      endAt,
    } = req.body || {};

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Judul pemilihan wajib diisi",
      });
    }

    const electionStatus = status || "DRAFT";

    if (!validStatuses.includes(electionStatus)) {
      return res.status(400).json({
        success: false,
        message:
          "Status harus DRAFT, UPCOMING, ONGOING, COMPLETED, atau CANCELLED",
      });
    }

    let parsedStartAt: Date | null = null;
    let parsedEndAt: Date | null = null;

    if (startAt) {
      parsedStartAt = new Date(startAt);

      if (Number.isNaN(parsedStartAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Format startAt tidak valid",
        });
      }
    }

    if (endAt) {
      parsedEndAt = new Date(endAt);

      if (Number.isNaN(parsedEndAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Format endAt tidak valid",
        });
      }
    }

    if (
      parsedStartAt &&
      parsedEndAt &&
      parsedEndAt <= parsedStartAt
    ) {
      return res.status(400).json({
        success: false,
        message: "Waktu selesai harus setelah waktu mulai",
      });
    }

    const election = await prisma.election.create({
      data: {
        title: String(title).trim(),
        description: description
          ? String(description).trim()
          : null,
        status: electionStatus,
        startAt: parsedStartAt,
        endAt: parsedEndAt,
      },
    });

    await createAuditLog({
      userId: req.user!.userId,
      action: "CREATE",
      entity: "ELECTION",
      entityId: election.id,
      details: `Membuat pemilihan "${election.title}" dengan status ${election.status}`,
    });

    return res.status(201).json({
      success: true,
      message: "Pemilihan berhasil dibuat",
      data: election,
    });
  } catch (error) {
    console.error("CREATE ELECTION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal membuat pemilihan",
    });
  }
};

export const updateElection = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const existingElection = await prisma.election.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    if (!existingElection) {
      return res.status(404).json({
        success: false,
        message: "Pemilihan tidak ditemukan",
      });
    }

    const {
      title,
      description,
      status,
      startAt,
      endAt,
    } = req.body || {};

    const newStatus =
      status !== undefined
        ? status
        : existingElection.status;

    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message:
          "Status harus DRAFT, UPCOMING, ONGOING, COMPLETED, atau CANCELLED",
      });
    }

    let parsedStartAt = existingElection.startAt;
    let parsedEndAt = existingElection.endAt;

    if (startAt !== undefined) {
      parsedStartAt = startAt
        ? new Date(startAt)
        : null;

      if (
        parsedStartAt &&
        Number.isNaN(parsedStartAt.getTime())
      ) {
        return res.status(400).json({
          success: false,
          message: "Format startAt tidak valid",
        });
      }
    }

    if (endAt !== undefined) {
      parsedEndAt = endAt
        ? new Date(endAt)
        : null;

      if (
        parsedEndAt &&
        Number.isNaN(parsedEndAt.getTime())
      ) {
        return res.status(400).json({
          success: false,
          message: "Format endAt tidak valid",
        });
      }
    }

    if (
      parsedStartAt &&
      parsedEndAt &&
      parsedEndAt <= parsedStartAt
    ) {
      return res.status(400).json({
        success: false,
        message: "Waktu selesai harus setelah waktu mulai",
      });
    }

    // Pemilihan yang sudah memiliki vote tidak boleh
    // dikembalikan ke DRAFT atau UPCOMING.
    if (
      existingElection._count.votes > 0 &&
      (newStatus === "DRAFT" ||
        newStatus === "UPCOMING")
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Pemilihan yang sudah memiliki suara tidak dapat dikembalikan ke DRAFT atau UPCOMING",
      });
    }

    const election = await prisma.election.update({
      where: {
        id,
      },
      data: {
        ...(title !== undefined && {
          title: String(title).trim(),
        }),

        ...(description !== undefined && {
          description: description
            ? String(description).trim()
            : null,
        }),

        status: newStatus,
        startAt: parsedStartAt,
        endAt: parsedEndAt,
      },
    });

    await createAuditLog({
      userId: req.user!.userId,
      action: "UPDATE",
      entity: "ELECTION",
      entityId: election.id,
      details: `Memperbarui pemilihan "${election.title}" dari status ${existingElection.status} menjadi ${election.status}`,
    });

    return res.json({
      success: true,
      message: "Pemilihan berhasil diperbarui",
      data: election,
    });
  } catch (error) {
    console.error("UPDATE ELECTION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui pemilihan",
    });
  }
};

export const resetElection = async (req: AuthRequest, res: Response) => {
  try {
    const deletedVotes = await prisma.vote.deleteMany({});

    const deletedCandidates = await prisma.candidate.deleteMany({});

    await createAuditLog({
      userId: req.user!.userId,
      action: "DELETE",
      entity: "ELECTION",
      entityId: "reset",
      details: `Reset pemilihan: ${deletedCandidates.count} kandidat & ${deletedVotes.count} vote dihapus`,
    });

    return res.json({
      success: true,
      message: "Pemilihan berhasil di-reset. Siap untuk pemilihan baru.",
      data: {
        deletedCandidates: deletedCandidates.count,
        deletedVotes: deletedVotes.count,
      },
    });
  } catch (error) {
    console.error("RESET ELECTION ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal reset pemilihan",
    });
  }
};

export const deleteElection = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const election = await prisma.election.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    if (!election) {
      return res.status(404).json({
        success: false,
        message: "Pemilihan tidak ditemukan",
      });
    }

    if (election._count.votes > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Pemilihan yang sudah memiliki suara tidak dapat dihapus",
      });
    }

    await prisma.election.delete({
      where: {
        id,
      },
    });

    await createAuditLog({
      userId: req.user!.userId,
      action: "DELETE",
      entity: "ELECTION",
      entityId: election.id,
      details: `Menghapus pemilihan "${election.title}"`,
    });

    return res.json({
      success: true,
      message: "Pemilihan berhasil dihapus",
    });
  } catch (error) {
    console.error("DELETE ELECTION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus pemilihan",
    });
  }
};