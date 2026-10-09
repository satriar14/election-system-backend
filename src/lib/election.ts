import prisma from "./prisma";

const withCandidates = {
  candidates: {
    orderBy: {
      createdAt: "asc" as const,
    },
  },
};

// Status ONGOING yang sudah melewati endAt otomatis menjadi COMPLETED
export const syncElectionStatus = async <
  T extends { id: string; status: string; endAt: Date | null }
>(
  election: T
): Promise<T> => {
  if (
    election.status === "ONGOING" &&
    election.endAt &&
    election.endAt.getTime() <= Date.now()
  ) {
    await prisma.election.update({
      where: { id: election.id },
      data: { status: "COMPLETED" },
    });
    return { ...election, status: "COMPLETED" };
  }

  return election;
};

// Pemilihan yang ditampilkan ke warga: yang punya kandidat, lalu ONGOING, lalu terbaru
export const findActiveElection = async () => {
  let election = await prisma.election.findFirst({
    where: { candidates: { some: {} } },
    orderBy: { createdAt: "desc" },
    include: withCandidates,
  });

  if (!election) {
    election = await prisma.election.findFirst({
      where: { status: "ONGOING" },
      orderBy: { createdAt: "desc" },
      include: withCandidates,
    });
  }

  if (!election) {
    election = await prisma.election.findFirst({
      orderBy: { createdAt: "desc" },
      include: withCandidates,
    });
  }

  if (!election) {
    election = await prisma.election.create({
      data: {
        title: "Pemilihan Ketua RT",
        description: "Agenda Pemilihan Ketua RT Resmi",
        status: "DRAFT",
      },
      include: withCandidates,
    });
  }

  return syncElectionStatus(election);
};
