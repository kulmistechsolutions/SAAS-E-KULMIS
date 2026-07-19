/** ts-jest so specs can import the TypeScript sources directly. */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.spec.ts"],
};
