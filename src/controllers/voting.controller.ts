import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const verifyHouse = async (
  req: Request,
  res: Response
) => {
  try {
    const { block, houseNumber } = req.body || {};

    if (!block || !houseNumber) {
      return res.status(400).json({
        success: false,
        message: "Block dan nomor rumah wajib diisi",
      });
    }

    const normalizedBlock = String(block)
      .trim()
      .toUpperCase();

    const normalizedHouseNumber = String(houseNumber)
      .trim();

    const house = await prisma.house.findUnique({
      where: {
        block_houseNumber: {
          block: normalizedBlock,
          houseNumber: normalizedHouseNumber,
        },
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    if (!house) {
      return res.status(404).json({
        success: false,
        message: "Nomor rumah tidak terdaftar",
      });
    }

    const usedQuota = house._count.votes;

    const remainingQuota = Math.max(
      house.voterQuota - usedQuota,
      0
    );

    if (remainingQuota <= 0) {
      return res.status(400).json({
        success: false,
        message: "Hak pilih untuk rumah ini sudah habis",
        data: {
          block: house.block,
          houseNumber: house.houseNumber,
          voterQuota: house.voterQuota,
          usedQuota,
          remainingQuota: 0,
        },
      });
    }

    return res.json({
      success: true,
      message: "Rumah terverifikasi",
      data: {
        houseId: house.id,
        block: house.block,
        houseNumber: house.houseNumber,
        ownerName: house.ownerName,
        voterQuota: house.voterQuota,
        usedQuota,
        remainingQuota,
      },
    });
  } catch (error) {
    console.error("VERIFY HOUSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal memverifikasi rumah",
    });
  }
};

export const castVote = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      block,
      houseNumber,
      candidateId,
      electionId,
      ownerName,
      voterName,
    } = req.body || {};

    if (
      !block ||
      !houseNumber ||
      !candidateId ||
      !electionId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Block, nomor rumah, candidate ID, dan election ID wajib diisi",
      });
    }

    const incomingName = ownerName || voterName;
    const trimmedName =
      incomingName !== undefined && incomingName !== null && String(incomingName).trim() !== ""
        ? String(incomingName).trim()
        : null;

    const normalizedBlock = String(block)
      .trim()
      .toUpperCase();

    const normalizedHouseNumber = String(houseNumber)
      .trim();

    const election = await prisma.election.findUnique({
      where: {
        id: String(electionId),
      },
    });

    if (!election) {
      return res.status(404).json({
        success: false,
        message: "Pemilihan tidak ditemukan",
      });
    }

    if (election.status !== "ONGOING") {
      return res.status(400).json({
        success: false,
        message: "Pemilihan sudah tidak aktif",
      });
    }

    const now = new Date();

    if (election.startAt && now < election.startAt) {
      return res.status(400).json({
        success: false,
        message: "Pemilihan belum dimulai",
      });
    }

    if (election.endAt && now > election.endAt) {
      return res.status(400).json({
        success: false,
        message: "Waktu pemilihan sudah berakhir",
      });
    }

    const candidate = await prisma.candidate.findUnique({
      where: {
        id: String(candidateId),
      },
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Kandidat tidak ditemukan",
      });
    }

    if (candidate.electionId !== election.id) {
      return res.status(400).json({
        success: false,
        message:
          "Kandidat tidak termasuk dalam pemilihan ini",
      });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const house = await tx.house.findUnique({
          where: {
            block_houseNumber: {
              block: normalizedBlock,
              houseNumber: normalizedHouseNumber,
            },
          },
        });

        if (!house) {
          throw new Error("HOUSE_NOT_FOUND");
        }

        const usedQuota = await tx.vote.count({
          where: {
            houseId: house.id,
            electionId: election.id,
          },
        });

        const remainingQuota =
          house.voterQuota - usedQuota;

        if (remainingQuota <= 0) {
          throw new Error("QUOTA_EXHAUSTED");
        }

        if (trimmedName && (!house.ownerName || house.ownerName.trim() === "")) {
          await tx.house.update({
            where: { id: house.id },
            data: { ownerName: trimmedName },
          });
          house.ownerName = trimmedName;
        }

        const vote = await tx.vote.create({
          data: {
            houseId: house.id,
            candidateId: candidate.id,
            electionId: election.id,
          },
        });

        return {
          vote,
          house,
          usedQuota: usedQuota + 1,
          remainingQuota: remainingQuota - 1,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return res.status(201).json({
      success: true,
      message: "Vote berhasil disimpan",
      data: {
        voteId: result.vote.id,
        electionId: election.id,
        candidateId: candidate.id,
        candidateName: candidate.name,
        block: result.house.block,
        houseNumber: result.house.houseNumber,
        ownerName: result.house.ownerName,
        voterQuota: result.house.voterQuota,
        usedQuota: result.usedQuota,
        remainingQuota: result.remainingQuota,
        votedAt: result.vote.createdAt,
      },
    });
  } catch (error) {
    console.error("CAST VOTE ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "HOUSE_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Nomor rumah tidak terdaftar",
      });
    }

    if (
      error instanceof Error &&
      error.message === "QUOTA_EXHAUSTED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Hak pilih untuk rumah ini sudah habis",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Gagal menyimpan vote",
    });
  }
};

export const getActiveElection = async (
  _req: Request,
  res: Response
) => {
  try {
    const election = await prisma.election.findFirst({
      where: {
        status: "ONGOING",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        candidates: {
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
        },
      },
    });

    if (
      election &&
      election.endAt &&
      new Date() > election.endAt &&
      election.status === "ONGOING"
    ) {
      const updated = await prisma.election.update({
        where: { id: election.id },
        data: { status: "COMPLETED" },
        include: {
          candidates: {
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
          },
        },
      });

      return res.json({
        success: true,
        message: "Pemilihan telah berakhir",
        data: {
          id: updated.id,
          title: updated.title,
          description: updated.description,
          status: updated.status,
          showGraph: updated.showGraph,
          startAt: updated.startAt,
          endAt: updated.endAt,
          candidates: updated.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            photo: c.photo,
            vision: c.vision,
            mission: c.mission,
            electionId: c.electionId,
            voteCount: c._count.votes,
          })),
        },
      });
    }

    if (election) {
      return res.json({
        success: true,
        message: "Pemilihan aktif berhasil diambil",
        data: {
          id: election.id,
          title: election.title,
          description: election.description,
          status: election.status,
          showGraph: election.showGraph,
          startAt: election.startAt,
          endAt: election.endAt,
          candidates: election.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            photo: c.photo,
            vision: c.vision,
            mission: c.mission,
            electionId: c.electionId,
            voteCount: c._count.votes,
          })),
        },
      });
    }

    const completedElection = await prisma.election.findFirst({
      where: {
        status: "COMPLETED",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        candidates: {
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
        },
      },
    });

    if (completedElection) {
      return res.json({
        success: true,
        message: "Pemilihan telah berakhir",
        data: {
          id: completedElection.id,
          title: completedElection.title,
          description: completedElection.description,
          status: completedElection.status,
          showGraph: completedElection.showGraph,
          startAt: completedElection.startAt,
          endAt: completedElection.endAt,
          candidates: completedElection.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            photo: c.photo,
            vision: c.vision,
            mission: c.mission,
            electionId: c.electionId,
            voteCount: c._count.votes,
          })),
        },
      });
    }

    const draftElection = await prisma.election.findFirst({
      where: {
        status: "DRAFT",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        candidates: {
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
        },
      },
    });

    if (draftElection) {
      return res.json({
        success: true,
        message: "Pemilihan belum dibuka",
        data: {
          id: draftElection.id,
          title: draftElection.title,
          description: draftElection.description,
          status: draftElection.status,
          showGraph: draftElection.showGraph,
          startAt: draftElection.startAt,
          endAt: draftElection.endAt,
          candidates: draftElection.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            photo: c.photo,
            vision: c.vision,
            mission: c.mission,
            electionId: c.electionId,
            voteCount: c._count.votes,
          })),
        },
      });
    }

    return res.status(404).json({
      success: false,
      message: "Tidak ada pemilihan",
      data: null,
    });
  } catch (error) {
    console.error("GET ACTIVE ELECTION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil pemilihan",
    });
  }
};

export const getElectionResults = async (
  req: Request,
  res: Response
) => {
  try {
    const electionId = req.params.electionId as string;

    const election = await prisma.election.findUnique({
      where: {
        id: electionId,
      },
    });

    if (!election) {
      return res.status(404).json({
        success: false,
        message: "Pemilihan tidak ditemukan",
      });
    }

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

    const totalVotes = await prisma.vote.count({
      where: {
        electionId,
      },
    });

    const data = candidates.map((candidate) => {
      const voteCount = candidate._count.votes;

      const percentage =
        totalVotes > 0
          ? Number(
              ((voteCount / totalVotes) * 100).toFixed(2)
            )
          : 0;

      return {
        id: candidate.id,
        name: candidate.name,
        photo: candidate.photo,
        voteCount,
        percentage,
      };
    });

    return res.json({
      success: true,
      message: "Hasil pemilihan berhasil diambil",
      data: {
        election: {
          id: election.id,
          title: election.title,
          status: election.status,
        },
        totalVotes,
        candidates: data,
      },
    });
  } catch (error) {
    console.error("GET ELECTION RESULTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil hasil pemilihan",
    });
  }
};

export const getVoteTrend = async (
  req: Request,
  res: Response
) => {
  try {
    const electionId = req.params.electionId as string;

    const election = await prisma.election.findUnique({
      where: { id: electionId },
    });

    if (!election) {
      return res.status(404).json({
        success: false,
        message: "Pemilihan tidak ditemukan",
      });
    }

    const votes = await prisma.vote.findMany({
      where: { electionId },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const dailyMap: Record<string, number> = {};
    for (const vote of votes) {
      const dateKey = vote.createdAt.toISOString().split("T")[0];
      dailyMap[dateKey] = (dailyMap[dateKey] || 0) + 1;
    }

    const trendData: {
      date: string;
      label: string;
      suara: number;
      kumulatif: number;
    }[] = [];
    let cumulative = 0;
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

    const sortedDates = Object.keys(dailyMap).sort();

    for (const dateStr of sortedDates) {
      const d = new Date(dateStr);
      const dayLabel = dayNames[d.getUTCDay()];
      const dailyCount = dailyMap[dateStr];
      cumulative += dailyCount;

      trendData.push({
        date: dateStr,
        label: `${dayLabel} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
        suara: dailyCount,
        kumulatif: cumulative,
      });
    }

    return res.json({
      success: true,
      message: "Tren suara berhasil diambil",
      data: trendData,
    });
  } catch (error) {
    console.error("GET VOTE TREND ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil tren suara",
    });
  }
};