import { StudentReportsService, NONE_RECORDED } from "./student-reports.service";

/**
 * Where the students come from. A school asked which village sends the most
 * students and how many each sends, and to print one village's students with
 * the columns they choose.
 */
const st = (gender: string, village: string | null, district: string | null = null) => ({
  gender,
  village: village ? { name: village } : null,
  district: district ? { name: district } : null,
});

function service(rows: unknown[], districtCount = 0) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const tx = { student: { findMany, count: jest.fn().mockResolvedValue(districtCount) } };
  const prisma = { forTenant: (_s: string, fn: (t: typeof tx) => unknown) => fn(tx) };
  return { svc: new StudentReportsService(prisma as never), findMany };
}

describe("students by village", () => {
  const rows = [
    st("MALE", "Hodan"),
    st("FEMALE", "Hodan"),
    st("MALE", "Hodan"),
    st("FEMALE", "Wadajir"),
    st("MALE", null),
  ];

  it("ranks villages by how many students come from each, most first", async () => {
    const { svc } = service(rows);
    const r = await svc.build("s", "by-village", {});
    expect(r.rows.map((x) => [x.rank, x.group, x.total])).toEqual([
      [1, "Hodan", 3],
      [2, "Wadajir", 1],
      ["—", "No village recorded", 1],
    ]);
    expect(r.rows[0]).toMatchObject({ male: 2, female: 1, share: "60.0%" });
  });

  it("names the village that sends the most", async () => {
    const { svc } = service(rows);
    const r = await svc.build("s", "by-village", {});
    expect(r.summary).toContainEqual({ label: "Most students from", value: "Hodan (3)" });
    expect(r.summary).toContainEqual({ label: "Students", value: "5" });
  });

  it("counts districts the same way", async () => {
    const { svc } = service([st("MALE", null, "Hodan"), st("MALE", null, "Hodan"), st("FEMALE", null, "Karaan")]);
    const r = await svc.build("s", "by-district", {});
    expect(r.rows.map((x) => x.group)).toEqual(["Hodan", "Karaan"]);
  });
});

describe("the village student list", () => {
  it("filters by the chosen village and district", async () => {
    const { svc, findMany } = service([]);
    await svc.build("s", "village-list", { village: "Hodan", district: "Wadajir" });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      village: { name: "Hodan" },
      district: { name: "Wadajir" },
    });
  });

  it("can list the students with no village recorded", async () => {
    const { svc, findMany } = service([]);
    await svc.build("s", "village-list", { village: NONE_RECORDED });
    expect(findMany.mock.calls[0][0].where).toMatchObject({ villageId: null });
  });

  it("offers a District column only to a school that records districts", async () => {
    const without = await service([], 0).svc.build("s", "village-list", {});
    expect(without.columns.map((c) => c.key)).not.toContain("district");
    const withD = await service([], 4).svc.build("s", "village-list", {});
    expect(withD.columns.map((c) => c.key)).toContain("district");
  });
});
