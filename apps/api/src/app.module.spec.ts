import { Test } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";

/**
 * Can the application actually be built?
 *
 * `nest build` type-checks files; it does not resolve the dependency graph.
 * So a controller can import a service its own module does not provide, the
 * build passes, and the container then dies on boot with "Nest can't resolve
 * dependencies" — which is what happened when the scope endpoints moved onto
 * the users controller: two deploys reported failed with a green build, and
 * the only symptom was the API sitting on the previous version.
 *
 * This resolves the whole graph. Prisma is replaced because a database is not
 * needed to answer the question, and requiring one would make the check the
 * kind nobody runs.
 */
describe("the application", () => {
  it("resolves every dependency it declares", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: () => Promise.resolve(),
        $disconnect: () => Promise.resolve(),
        forTenant: () => Promise.resolve(null),
        $on: () => undefined,
      })
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  }, 60_000);
});
